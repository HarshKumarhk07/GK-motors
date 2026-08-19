import { parse } from '@babel/parser';
import fs from 'fs';
const files = [
  'src/App.jsx','src/components/common/Navbar.jsx','src/components/common/Footer.jsx',
  'src/pages/Home.jsx','src/pages/About.jsx','src/pages/Login.jsx','src/pages/Register.jsx',
  'src/pages/MyBookings.jsx','src/pages/Services.jsx','src/pages/admin/Dashboard.jsx',
  'src/pages/Cart.jsx','src/pages/PartDetail.jsx','src/pages/RentalDetail.jsx',
  'src/pages/SpareParts.jsx','src/pages/Wishlist.jsx','src/pages/Profile.jsx','src/pages/Contact.jsx',
  'src/pages/BuyBikes.jsx','src/pages/BikeDetail.jsx','src/pages/SellBike.jsx','src/pages/Rentals.jsx',
  'src/context/AuthContext.jsx','src/context/CartContext.jsx',
];
let bad = 0;
for (const f of files) {
  try { parse(fs.readFileSync(f,'utf8'), { sourceType:'module', plugins:['jsx'] }); console.log('PASS  '+f); }
  catch (e) { bad++; console.log('FAIL  '+f+' -> '+e.message); }
}
console.log(bad === 0 ? '\nALL FILES PARSE CLEANLY' : '\n'+bad+' FILE(S) FAILED');
