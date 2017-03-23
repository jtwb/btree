const util = require('util');
const _ = require('lodash');


const NODE_SIZE = 8;
const DEBUG = typeof v8debug !== 'undefined';


function pad(s, n, c=' ') {
    return c.repeat(Math.max(0, Math.min(n, n-s.length))) + s;
}


class Node {
    constructor({
        parent=null,
        children=null,
        data=null
    }={}){
        this.parent = parent;
        this.children = children ? children : [];
        this.data = data ? data : [];
    }
}


const g = (x, n) => ({
    g: (m => g(x.children[n], m)),
    n: x.children[n]
});


class BTree {
    constructor(data, comparator) {
        this.root = new Node();
        this.comparator = comparator;
        this.size = 0;
        for (const item of data) {
            this.put(item);
        }
    }
    put(item) {
        DEBUG && process.stdout.write('\n.');
        const data_insert = (data, item) => {
            for (let i=0; i < data.length; i++) {
                if (this.comparator(data[i], item) > 0) {
                    return i;
                }
            }
            return data.length;
        }

        const locate_leaf = () => {
            let node = this.root, found = null;
            for (; found === null; ) {
                if (node.children.length === 0) {
                    DEBUG && process.stdout.write('o');
                    found = true;
                    continue;
                }
                const i = data_insert(node.data, item);
                DEBUG && process.stdout.write(`${i}>`);
                node = node.children[i];
            }
            return node;
        }


        /*
         * Locate Leaf: this locates the leaf that should contain the inserted item.
         * It's possible the leaf may be full. The next section will handle that case.
         */
        DEBUG && process.stdout.write(`(${item})`);
        const leaf = locate_leaf();

        this.size++;
        leaf.data.push(item);
        leaf.data.sort(this.comparator); // TODO be smarter here - Int32 semantics
        DEBUG && process.stdout.write(leaf.data.length.toString());

        /*
         * Simple path: target node has space. Just insert and return.
         */
        if (leaf.data.length <= NODE_SIZE) {
            DEBUG && this.invariantChecks();
            return;
        }

        /*
         * Tree restructure path.
         *
         * Iteratively 'blow' an overfilled node using the following algorithm:
         * 1. Split node values into three parts
         *    Less than median
         *    Median
         *    More than median
         * 2. Split child pointers into two sets
         *    Less than median
         *    Greater than median
         * 3. Construct a New Right node with the Greater Than sets
         *    Keep the Less Than sets in the blown node
         * 4. If the blown node was the root,
              Promote the Median value to a new root and point to New Right
              If not,
              Promote the Median value to the parent node and point to the New Right
         */
        let done = false;
        let new_root = null;
        let util1 = util;
        //
        for (let blown_node = leaf; !done;) {
            DEBUG && process.stdout.write('x');
            let new_right = null;

            const data = blown_node.data;
            const median_i = Math.floor(data.length / 2);
            const median = data[median_i];
            const to_left = data.slice(0, median_i);
            const to_right = data.slice(median_i + 1);
            if (blown_node.children.length > 0) {
                const children_to_left = blown_node.children.slice(0, median_i + 1);
                const children_to_right = blown_node.children.slice(median_i + 1);
                blown_node.data = to_left;
                blown_node.children = children_to_left;
                new_right = new Node({
                    parent: blown_node.parent,
                    children: children_to_right,
                    data: to_right
                });
                for (const c_to_right of children_to_right) {
                    c_to_right.parent = new_right;
                }
            } else {
                blown_node.data = to_left;
                new_right = new Node({
                    parent: blown_node.parent,
                    data: to_right
                });
            }

            /* Median promotion */
            let parent = blown_node.parent;
            if (!parent) {  // root case
                new_root = new Node({
                    children: [blown_node, new_right],
                    data: [median]
                });
                blown_node.parent = new_root;
                new_right.parent = new_root;
            } else {
                const i = data_insert(parent.data, median);
                parent.data.splice(i, 0, median);
                parent.children.splice(i+1, 0, new_right);
            }
            if (new_root) {
                done = true;
            } else if (parent && parent.data.length < NODE_SIZE) {
                done = true;
            } else {
                blown_node = parent;
            }
        }

        if (new_root) {
            this.root = new_root;
        }
        DEBUG && this.invariantChecks();
    }

    values() {
        const plan_queue = [this.root];
        const result = [];
        const emit = (...values) => result.push(...values);

        DEBUG && process.stdout.write('v');
        for (let visit_node;
                plan_queue.length; ){
            DEBUG && process.stdout.write('.');
            DEBUG && process.stdout.write(`${plan_queue.length}`);

            visit_node = plan_queue.pop();
            if (Array.isArray(visit_node)) {
                emit(visit_node[0]);
                continue;
            }
            if (visit_node.children.length > 0) {
                plan_queue.push(visit_node.children[visit_node.data.length]);
                for (let i = visit_node.data.length - 1; i >= 0; i--) {
                    plan_queue.push([visit_node.data[i]]); // array signals queued raw emit
                    plan_queue.push(visit_node.children[i]);
                }
            } else {
                emit(...visit_node.data);
            }
        }

        return result;
    }

    inspect(depth, options) {
        let out = options.stylize('[BTree]\n', 'special');
        out += '#root\n'
        const plan_queue = [[this.root, 0]];

        for (let visit_node, idepth;
                plan_queue.length; ){
            [visit_node, idepth] = plan_queue.pop();
            if (typeof visit_node === 'undefined') {
                throw new Error('bad vn');
            }
            if (visit_node.children.length > 0) {
                for (const ch of visit_node.children) {
                    if (typeof ch === 'undefined') {
                        throw new Error('bad ch');
                    }
                }
                for (let i = visit_node.children.length - 1; i >= 0; i--) {
                    plan_queue.push([visit_node.children[i], idepth+1]);
                }
            }
            out += ' '.repeat(idepth) + pad(`${idepth}`, 2) + (visit_node.children.length > 0 ? '  ' : 'L ');
            out += util.inspect(visit_node.data);
            out += '\n';
        }
        return out;
    }

    invariantChecks() {
        const sortedvalues = this.values();
        sortedvalues.sort(this.comparator);
        const rawvalues = this.values();
        if (!_.isEqual(sortedvalues, rawvalues)) {
            console.log(util.inspect(this));
            console.log('not sorted');
            debugger;
        }
    }
}


class TestSuite {
    constructor() {
        this.total = 0;
        this.failed = 0;
        this.failures = [];
    }
    assert(assertion, describe=() => '') {
        this.total++;
        if (!assertion) {
            this.failed++;
            const description = describe();
            const localStack = (new Error()).stack.split('\n').slice(1).join('\n');
            this.failures.push(description + '\n' + localStack);
            process.stdout.write('F');
        } else {
            process.stdout.write('.');
        }
    }
    assertEqual(a, b) {
        this.assert(_.isEqual(a, b),
                () => `Not equal:\n> ${a}\n> ${b}`);
    }
    runSuite() {
        console.log('======== Running Tests ========');
        this.run();
        console.log('======== Tests Result  ========');
        if (this.failed) {
            console.log(`FAILED ${this.failed} / ${this.total}`);
            for (const fail_stack of this.failures) {
                console.log(' >>> Stack Trace ');
                console.log(fail_stack);
            }
        } else {
            console.log(`PASSED ${this.total}`);
        }
        console.log('========      DONE     ========');
    }
}


class BTreeTest extends TestSuite {
    constructor() {
        super();
    }
    run() {
        {
            const data = [
                68, 78, 15, 81, 62, 66, 74, 82, 44, 36, 43, 56, 19, 2, 2, 22, 76, 80, 60, 58, 23, 15, 57, 41, 73, 86, 72, 41, 8, 70, 41, 84, 60, 72, 100, 16, 85, 60, 74, 63, 53, 95, 22, 4, 95, 18, 38, 41, 59, 64, 76, 62, 25, 22, 75, 8, 82, 31, 13, 23, 46, 95, 7, 78, 12, 86, 91, 53, 75, 54, 53, 43, 41, 81, 74, 67, 58, 37, 36, 100, 76, 92, 77, 75, 1, 36, 25, 75, 41, 74, 17, 16, 99, 85, 98, 29, 57, 93, 95, 51, 68, 78, 15, 81, 62, 66, 74, 82, 44, 36, 43, 56, 19, 2, 2, 22, 76, 80, 60, 58, 23, 15, 57, 41, 73, 86, 72, 41, 8, 70, 41, 84, 60, 72, 100, 16, 85, 60, 74, 63, 53, 95, 22, 4, 95, 18, 38, 41, 59, 64, 76, 62, 25, 22, 75, 8, 82, 31, 13, 23, 46, 95, 7, 78, 12, 86, 91, 53, 75, 54, 53, 43, 41, 81, 74, 67, 58, 37, 36, 100, 76, 92, 77, 75, 1, 36, 25, 75, 41, 74, 17, 16, 99, 85, 98, 29, 57, 93, 95, 51
            ];
            const bt = new BTree(data.slice(0, 16), (a, b) => a - b);
            debugger;
            this.assertEqual(bt.values(), data.slice(0, 16).sort((a, b) => a - b));
        }
        {
            const data = [
                68, 78, 15, 81, 62, 66, 74, 82, 44, 36, 43, 56, 19, 2, 2, 22, 76, 80, 60, 58, 23, 15, 57, 41, 73, 86, 72, 41, 8, 70, 41, 84, 60, 72, 100, 16, 85, 60, 74, 63, 53, 95, 22, 4, 95, 18, 38, 41, 59, 64, 76, 62, 25, 22, 75, 8, 82, 31, 13, 23, 46, 95, 7, 78, 12, 86, 91, 53, 75, 54, 53, 43, 41, 81, 74, 67, 58, 37, 36, 100, 76, 92, 77, 75, 1, 36, 25, 75, 41, 74, 17, 16, 99, 85, 98, 29, 57, 93, 95, 51, 68, 78, 15, 81, 62, 66, 74, 82, 44, 36, 43, 56, 19, 2, 2, 22, 76, 80, 60, 58, 23, 15, 57, 41, 73, 86, 72, 41, 8, 70, 41, 84, 60, 72, 100, 16, 85, 60, 74, 63, 53, 95, 22, 4, 95, 18, 38, 41, 59, 64, 76, 62, 25, 22, 75, 8, 82, 31, 13, 23, 46, 95, 7, 78, 12, 86, 91, 53, 75, 54, 53, 43, 41, 81, 74, 67, 58, 37, 36, 100, 76, 92, 77, 75, 1, 36, 25, 75, 41, 74, 17, 16, 99, 85, 98, 29, 57, 93, 95, 51
            ];
            const bt = new BTree(data, (a, b) => a - b);
            debugger;
            console.log(util.inspect(bt));
            this.assertEqual(bt.values(), data.sort((a, b) => a - b));
        }
    }
}

new BTreeTest().runSuite();
