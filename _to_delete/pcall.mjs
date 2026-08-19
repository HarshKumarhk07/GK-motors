import { parse } from '@babel/parser';
import fs from 'fs'; import path from 'path';
const walk=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name);return e.isDirectory()?walk(p):(/\.jsx?$/.test(e.name)?[p]:[]);});
let bad=0,n=0;
for(const f of walk('src')){n++;try{parse(fs.readFileSync(f,'utf8'),{sourceType:'module',plugins:['jsx']});}catch(e){bad++;console.log('FAIL  '+f+' -> '+e.message);}}
console.log(`\n${n} client files checked, ${bad} failed`);
