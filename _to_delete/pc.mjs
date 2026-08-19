import { parse } from '@babel/parser';
import fs from 'fs';
const files = ['src/context/CartContext.jsx','src/api/serviceApi.js','src/api/apiError.js','src/api/adminApi.js','src/api/axios.js','src/pages/Login.jsx','src/pages/Register.jsx'];
let bad=0;
for (const f of files) {
  try { parse(fs.readFileSync(f,'utf8'), {sourceType:'module', plugins:['jsx']}); console.log('PASS  '+f); }
  catch(e){ bad++; console.log('FAIL  '+f+' -> '+e.message); }
}
console.log(bad===0?'\nALL PARSE CLEANLY':'\n'+bad+' FAILED');
