const util = require('util');
const _ = require('lodash');


const NODE_SIZE = 8;
const DEBUG = typeof v8debug !== 'undefined';


/*
 *
 *
 * *  Utilities  * */
function pad(s, n, c=' ') {
    /* yeah, it's left-pad */
    return c.repeat(Math.max(0, Math.min(n, n-s.length))) + s;
}


function* range(min, max=null, step=1) {
    /* Array.from(range(4,12)) => [4,5,6,7,8,9,10,11,12] */
    /* Array.from(range(0,4,2)) => [0,2,4] */
    /* Array.from(range(4)) => [0,1,2,3,4] */
    if (max === null) {
        [min, max] = [0, min];
    }
    for (let i = min; i <= max; i += step) {
        yield i;
    }
}



/*
 *
 *
 * * BTree private classes * */
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


/*
 *
 *
 * * BTree-Node private methods * */
const g = (x, n) => ({
    /* A quick decend-child debug tool */
    g: (m => g(x.children[n], m)),
    n: x.children[n]
});


/*
 *
 *
 * *  BTree private methods  * */
function data_insert(data, item) {
    for (let i=0; i < data.length; i++) {
        if (this.comparator(data[i], item) > 0) {
            return i;
        }
    }
    return data.length;
}


function locate_leaf(item) {
    let node = this.root, found = null;
    for (; found === null; ) {
        if (node.children.length === 0) {
            DEBUG && process.stdout.write('o');
            found = true;
            continue;
        }
        const i = data_insert.call(this, node.data, item);
        DEBUG && process.stdout.write(`${i}>`);
        node = node.children[i];
    }
    return node;
}


/*
 *
 *
 * * BTree * */
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


        /*
         * Locate Leaf: this locates the leaf that should contain the inserted item.
         * It's possible the leaf may be full. The next section will handle that case.
         */
        DEBUG && process.stdout.write(`(${item})`);
        const leaf = locate_leaf.call(this, item);

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
                const i = data_insert.call(this, parent.data, median);
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
        return Array.from(this);
    }

    *[Symbol.iterator]() {
        const plan_queue = [this.root];
        const result = [];

        DEBUG && process.stdout.write('v');
        for (let visit_node;
                plan_queue.length; ){
            DEBUG && process.stdout.write('.');
            DEBUG && process.stdout.write(`${plan_queue.length}`);

            visit_node = plan_queue.pop();
            if (Array.isArray(visit_node)) {
                yield visit_node[0];
                continue;
            }
            if (visit_node.children.length > 0) {
                plan_queue.push(visit_node.children[visit_node.data.length]);
                for (let i = visit_node.data.length - 1; i >= 0; i--) {
                    plan_queue.push([visit_node.data[i]]); // array inidicates enqueued emit action
                    plan_queue.push(visit_node.children[i]);
                }
            } else {
                yield* visit_node.data;
            }
        }

        return result;
    }

    has(item) {
        let node = this.root, found = null;
        for (; found === null; ) {
            if (node.children.length === 0) {
                return node.data.includes(item);
            }
            let i = 0;
            for (; i < node.data.length; i++) {
                const comp = this.comparator(node.data[i], item);
                if (comp === 0) {
                    return true;
                }
                if (comp > 0) {
                    break;
                }
            }
            node = node.children[i];
        }
    }

    *iteratorRange({ min=null, max=null, ascending=true }={}) {
        /*
         * Return all items in the collection between min and max, inclusive, ordered ascending or decending.
         *
         * Introduction to the code:
         *  (1) it's a non-recursive implementation, so we maintain a stack in memory. However, it's not a
         *      call stack, it's a stack of work-to-process which is a little different. A key difference between
         *      a call stack and a work-to-process stack is illustrated by the state of the stack when finishing
         *      a big sub-tree. In a call stack, after finishing a big sub-tree the stack would look like so:
         *      (a) [(node=root i=0), (node=0 i=8), (node=0,8 i=8), (node=0,8,8 i=8)]
         *      And on the next step it would look like:
         *      (b) [(node=root i=0), (node=0 i=8), (node=0,8 i=8)]
         *      And three steps later:
         *      (c) [(node=root i=1), (node=1 i=0)]
         *      The work-to-process stack is simpler. After finishing a big sub-tree the work stack would be:
         *      (d) [(action=emit val=15), (action=visit node=1), (action=emit val=40), (action=visit node=2), ...]
         *      And after a two steps, we would process the emit action and the visit action:
         *      (d) [(action=visit node=1,0), (action=emit val=16), (action=visit node=1,1), (action=emit val=17), ...]
         *      So that pushes a few more visit and emit actions to the stack.
         *  (2) three special cases require special attention: when we visit a node where no values match the range filter,
         *      we still need to explore the approriate sub-nodes
         *      (a) if the min and max fall in between two values, explore the sub-node in that gap
         *      (b) if the max is smaller than all values, explore the leftmost sub-node
         *      (c) if the min is greater than all values, explore the rightmost sub-node
         *      Technically (b) and (c) are sub-cases of (a), however (a) requires a scan through the the data values
         *      while (b) and (c) can be short-circuited around the scan, so we handle them separately.
         */
        let filter;
        if (min === null && max === null) {
            filter = x => true;
        } else if (min === null) {
            filter = x => this.comparator(x, max) <= 0;
        } else if (max === null) {
            filter = x => this.comparator(x, min) >= 0;
        } else {
            if (min > max) {
                return;
            }
            filter = x => this.comparator(x, min) >= 0 && this.comparator(x, max) <= 0
        }

        let plan_stack = [this.root];
        for (let node; plan_stack.length > 0; ) {
            /*
             * A non-array item on the stack is a 'visit' action.
             * An array item on the stack is an 'emit' action.
             */
            node = plan_stack.pop();
            if (Array.isArray(node)) {
                yield node[0];
                continue;
            }
            if (node.children.length > 0) {
                const to_stack = [];
                if (max !== null && this.comparator(node.data[0], max) > 0) {
                    /* If max < smallest intermediate, special case: follow leftmost child */
                    plan_stack.push(node.children[0]);
                    continue;
                }
                if (min !== null && this.comparator(node.data[node.data.length - 1], min) < 0) {
                    /* If min > largest intermediate, special case: follow rightmost child */
                    plan_stack.push(node.children[node.children.length - 1]);
                    continue;
                }
                const ok = Array.from(range(node.data.length-1)) /* Note: helper fn also named range */
                    .map(i => [i, node.data[i]])
                    .filter(([__, x]) => filter(x));

                if (ok.length > 0) {
                    const [last_i, __a] = ok[ok.length-1];
                    for (const [i, __b] of ok) {
                        to_stack.push(node.children[i]);
                        to_stack.push([node.data[i]]); // array indicates enqueued emit action
                    }
                    to_stack.push(node.children[last_i + 1])
                } else {
                    if (min !== null && max !== null) {
                        /* If min and max fall between two values, we must still explore
                         * the child node between those two values.
                         *
                         * Approach: scan for the first value greater than min. This is the uppermost
                         * value bound of the desired target node.
                         */
                        let i;
                        for (i of range(node.data.length-1)) { /* Note: helper fn also named range */
                            if (this.comparator(node.data[i], min) >= 0) {
                                break;
                            }
                        }
                        plan_stack.push(node.children[i]);
                    }
                }
                if (ascending) {
                    to_stack.reverse();
                }
                plan_stack.push(...to_stack);
            } else {
                if (ascending) {
                    yield* node.data
                        .filter(filter)
                } else {
                    yield* node.data
                        .filter(filter)
                        .reverse();
                }
            }
        }
    }

    range(options) {
        return Array.from(this.iteratorRange(options));
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


module.exports = BTree;
