import Prism from 'prismjs';
import 'prismjs/components/prism-javascript.js';
const tokens = Prism.tokenize("const x = 5;", Prism.languages.javascript);
console.log(JSON.stringify(tokens, null, 2));
