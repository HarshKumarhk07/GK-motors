import { parse } from '@babel/parser';
import fs from 'fs';
const files=['src/pages/Services.jsx','src/pages/Home.jsx','src/components/service/CarSelector.jsx','src/components/service/ServiceSelector.jsx','src/components/service/ServiceCart.jsx','src/components/service/CheckoutModal.jsx'];
let bad=0;
for (const f of files){try{parse(fs.readFileSync(f,'utf8'),{sourceType:'module',plugins:['jsx']});console.log('PASS  '+f);}catch(e){bad++;console.log('FAIL  '+f+' -> '+e.message);}}
console.log(bad===0?'\nALL PARSE CLEANLY':'\n'+bad+' FAILED');
