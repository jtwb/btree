const BTree = require('./btree.js');
const TestSuite = require('babytest');


/*
 *
 *
 * * BTree Test Suite * */
class BTreeTest extends TestSuite {
    constructor() {
        super();
    }
    run() {
        const data = [
            68, 78, 15, 81, 62, 66, 74, 82, 44, 36, 43, 56, 19, 2, 2, 22, 76, 80, 60, 58, 23, 15, 57, 41, 73, 86, 72, 41, 8, 70, 41, 84, 60, 72, 100, 16, 85, 60, 74, 63, 53, 95, 22, 4, 95, 18, 38, 41, 59, 64, 76, 62, 25, 22, 75, 8, 82, 31, 13, 23, 46, 95, 7, 78, 12, 86, 91, 53, 75, 54, 53, 43, 41, 81, 74, 67, 58, 37, 36, 100, 76, 92, 77, 75, 1, 36, 25, 75, 41, 74, 17, 16, 99, 85, 98, 29, 57, 93, 95, 51, 68, 78, 15, 81, 62, 66, 74, 82, 44, 36, 43, 56, 19, 2, 2, 22, 76, 80, 60, 58, 23, 15, 57, 41, 73, 86, 72, 41, 8, 70, 41, 84, 60, 72, 100, 16, 85, 60, 74, 63, 53, 95, 22, 4, 95, 18, 38, 41, 59, 64, 76, 62, 25, 22, 75, 8, 82, 31, 13, 23, 46, 95, 7, 78, 12, 86, 91, 53, 75, 54, 53, 43, 41, 81, 74, 67, 58, 37, 36, 100, 76, 92, 77, 75, 1, 36, 25, 75, 41, 74, 17, 16, 99, 85, 98, 29, 57, 93, 95, 51
        ];
        {
            const smdata = data.slice(0, 16);
            const bt = new BTree(smdata,(a, b) => a - b);
            this.assertEqual(bt.values(), smdata.slice().sort((a, b) => a - b));
            this.assertEqual(bt.has(5), false);
            this.assertEqual(bt.has(56), true);
            this.assertEqual(bt.has(68), true);
            this.assertEqual(bt.range({ min: 9 }), smdata.slice().sort((a, b) => a - b).filter(x => x > 8));
            this.assertEqual(bt.range({ min: 8 }), smdata.slice().sort((a, b) => a - b).filter(x => x >= 8));
            this.assertEqual(bt.range({ max: 69 }), smdata.slice().sort((a, b) => a - b).filter(x => x < 70));
            this.assertEqual(bt.range({ max: 70 }), smdata.slice().sort((a, b) => a - b).filter(x => x <= 70));
            this.assertEqual(bt.range({ min: 9, max: 69 }), smdata.slice().sort((a, b) => a - b).filter(x => x >= 9 && x <= 69));
            this.assertEqual(bt.range({ min: 45, max: 63 }), smdata.slice().sort((a, b) => a - b).filter(x => x >= 45 && x <= 63));

            // check zero result cases
            this.assertEqual(bt.range({ min: 200, max: 50 }), []);
            this.assertEqual(bt.range({ min: 51, max: 50 }), []);
        }
        {
            const bt = new BTree(data, (a, b) => a - b);
            //console.log(util.inspect(bt));
            this.assertEqual(bt.values(), data.slice().sort((a, b) => a - b));
            this.assertEqual(bt.has(5), false);
            this.assertEqual(bt.has(56), true);
            this.assertEqual(bt.has(68), true);
            this.assertEqual(bt.range(), bt.values());
            this.assertEqual(bt.range({ min: 9 }), data.slice().sort((a, b) => a - b).filter(x => x > 8));
            this.assertEqual(bt.range({ min: 8 }), data.slice().sort((a, b) => a - b).filter(x => x >= 8));
            this.assertEqual(bt.range({ max: 69 }), data.slice().sort((a, b) => a - b).filter(x => x < 70));
            this.assertEqual(bt.range({ max: 70 }), data.slice().sort((a, b) => a - b).filter(x => x <= 70));
            this.assertEqual(bt.range({ min: 100 }), data.slice().sort((a, b) => a - b).filter(x => x >= 100));
            this.assertEqual(bt.range({ max: 1 }), data.slice().sort((a, b) => a - b).filter(x => x <= 1));

            // check zero result cases
            this.assertEqual([], data.slice().sort((a, b) => a - b).filter(x => x >= 200));
            this.assertEqual(bt.range({ min: 200 }), data.slice().sort((a, b) => a - b).filter(x => x >= 200));
            this.assertEqual(bt.range({ min: 200, max: 400 }), data.slice().sort((a, b) => a - b).filter(x => x >= 200));
            this.assertEqual([], data.slice().sort((a, b) => a - b).filter(x => x <= 0));
            this.assertEqual(bt.range({ max: 0 }), data.slice().sort((a, b) => a - b).filter(x => x <= 0));
            this.assertEqual(bt.range({ min: -200, max: 0 }), data.slice().sort((a, b) => a - b).filter(x => x <= 0));

            // in-between case
            this.assertEqual(bt.range({ min: 26, max: 35 }), data.slice().sort((a, b) => a - b).filter(x => x >= 26 && x <= 35));
        }
    }
}


new BTreeTest().runSuite();
