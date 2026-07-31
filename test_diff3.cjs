const Diff3 = require('node-diff3');
const o = ['AA', 'ZZ', '00', 'M', '99'];
const a = ['AA', 'a', 'b', 'c', 'ZZ', 'new', '00', 'a', 'a', 'M', '99'];
const b = ['AA', 'a', 'd', 'c', 'ZZ', '11', 'M', 'z', 'z', '99'];
console.log(JSON.stringify(Diff3.diff3Merge(a, o, b), null, 2));
