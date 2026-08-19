import { parse } from '@babel/parser';
import fs from 'fs';
try { parse(fs.readFileSync('src/pages/admin/Dashboard.jsx','utf8'), {sourceType:'module',plugins:['jsx']}); console.log('PASS  Dashboard.jsx'); }
catch(e){ console.log('FAIL  Dashboard.jsx -> '+e.message); process.exit(1); }
