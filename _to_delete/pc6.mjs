import { parse } from '@babel/parser'; import fs from 'fs';
const files=['src/components/service/CategoryIcon.jsx','src/pages/Services.jsx','src/pages/Home.jsx','src/pages/admin/Dashboard.jsx','src/api/adminApi.js'];
let bad=0;
for(const f of files){try{parse(fs.readFileSync(f,'utf8'),{sourceType:'module',plugins:['jsx']});console.log('PASS  '+f);}catch(e){bad++;console.log('FAIL  '+f+' -> '+e.message);}}
console.log(bad===0?'ALL PARSE CLEANLY':bad+' FAILED');
