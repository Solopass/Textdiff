const Diff3 = require('node-diff3');
const o = ['AA', 'ZZ', '00'];
const a = ['AA', 'newA', 'ZZ', '00'];
const b = ['AA', 'ZZ', 'newB', '00'];
console.log(JSON.stringify(Diff3.diff3Merge(a, o, b), null, 2));
