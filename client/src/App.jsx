import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import PincodeModal from './components/common/PincodeModal';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Services from './pages/Services';
import MyBookings from './pages/MyBookings';
import AdminDashboard from './pages/admin/Dashboard';
import Profile from './pages/Profile';
import Contact from './pages/Contact';
import About from './pages/About';

// Spare parts storefront — live.
import SpareParts from './pages/SpareParts';
import PartDetail from './pages/PartDetail';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import FeaturedParts from './pages/FeaturedParts';
import BestsellerParts from './pages/BestsellerParts';

/* ═══════════════════════════════════════════════════════════════════════════
   [GK MOTORS TRANSFORM] Buy / sell / rent disabled — GK Motors sells service
   and parts only. These files, their API layer, models and admin tabs are all
   untouched, so restoring them means uncommenting these imports and the
   matching <Route> entries further down.
   ═══════════════════════════════════════════════════════════════════════════
import BuyBikes from './pages/BuyBikes';
import BikeDetail from './pages/BikeDetail';
import SellBike from './pages/SellBike';
import FeaturedBikes from './pages/FeaturedBikes';
import BestsellerBikes from './pages/BestsellerBikes';
import Rentals from './pages/Rentals';
import RentalDetail from './pages/RentalDetail';
   ═════════════════════════════════════════════════════════════════════════ */

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const Layout = ({ children, hideNav = false }) => (
  <div style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', position: 'relative' }}>
    {!hideNav && <Navbar />}
    <main style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', position: 'relative' }}>{children}</main>
    {!hideNav && <Footer />}
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <CartProvider>
          <PincodeModal />
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: '#FFFFFF', color: '#111', border: '1px solid #EEE', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', borderRadius: '14px', fontWeight: 600 },
              success: { iconTheme: { primary: '#10B981', secondary: 'white' } },
              error: { iconTheme: { primary: '#EF4444', secondary: 'white' } },
            }}
          />
          <Routes>
            {/* Auth pages - no nav */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            {/* Admin - no footer */}
            <Route path="/admin" element={<Layout hideNav={true}><AdminDashboard /></Layout>} />

            {/* Public pages */}
            <Route path="/" element={<Layout><Home /></Layout>} />
            <Route path="/services" element={<Layout><Services /></Layout>} />
            <Route path="/my-bookings" element={<Layout><MyBookings /></Layout>} />
            <Route path="/my-orders" element={<Layout><MyBookings /></Layout>} />
            <Route path="/profile" element={<Layout><Profile /></Layout>} />
            <Route path="/contact" element={<Layout><Contact /></Layout>} />
            <Route path="/about" element={<Layout><About /></Layout>} />

            {/* Spare parts storefront */}
            <Route path="/parts" element={<Layout><SpareParts /></Layout>} />
            <Route path="/parts/:id" element={<Layout><PartDetail /></Layout>} />
            <Route path="/featured" element={<Layout><FeaturedParts /></Layout>} />
            <Route path="/bestseller" element={<Layout><BestsellerParts /></Layout>} />
            <Route path="/cart" element={<Layout><Cart /></Layout>} />
            <Route path="/wishlist" element={<Layout><Wishlist /></Layout>} />

            {/* ═══════════════════════════════════════════════════════════════
                [GK MOTORS TRANSFORM] Buy / sell / rent routes disabled.
                Re-enable by uncommenting these together with the imports above.
                ═══════════════════════════════════════════════════════════════
            <Route path="/bikes" element={<Layout><BuyBikes /></Layout>} />
            <Route path="/bikes/featured" element={<Layout><FeaturedBikes /></Layout>} />
            <Route path="/bikes/bestseller" element={<Layout><BestsellerBikes /></Layout>} />
            <Route path="/bikes/:id" element={<Layout><BikeDetail /></Layout>} />
            <Route path="/sell" element={<Layout><SellBike /></Layout>} />
            <Route path="/rentals" element={<Layout><Rentals /></Layout>} />
            <Route path="/rentals/:id" element={<Layout><RentalDetail /></Layout>} />
                ═══════════════════════════════════════════════════════════ */}

            {/* 404 */}
            <Route path="*" element={
              <Layout>
                <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.5rem', background: '#FFFFFF', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 'clamp(5rem, 15vw, 10rem)', fontWeight: 950, color: '#111', lineHeight: 1, letterSpacing: '-0.05em' }}>404</div>
                  <div style={{ height: '6px', width: '80px', background: '#1E3A8A', borderRadius: '4px' }} />
                  <h2 style={{ color: '#0F172A', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontFamily: 'Rajdhani, sans-serif', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PAGE NOT FOUND</h2>
                  <p style={{ color: '#64748B', fontSize: '1.2rem', maxWidth: '450px', fontWeight: 600 }}>The page you're looking for doesn't exist or has moved.</p>
                  <a href="/" style={{ marginTop: '1.5rem', background: '#0F172A', color: 'white', padding: '1.2rem 3rem', borderRadius: '18px', textDecoration: 'none', fontWeight: 900, fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.1em', boxShadow: '0 15px 40px rgba(15, 23, 42, 0.2)', transition: 'all 0.3s' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    BACK TO GK MOTORS
                  </a>
                </div>
              </Layout>
            } />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
