import { BrowserRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import AnnouncementBar from './components/common/AnnouncementBar';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import PincodeModal from './components/common/PincodeModal';

/* ── Eager routes ──────────────────────────────────────────────────────────
   Only the two pages that make up the core funnel. Home is what the landing
   URL renders, and Services is the destination of every CTA on it — putting
   either behind a network round trip would trade page-load time for click
   latency on exactly the interactions that matter most. */
import Home from './pages/Home';
import Services from './pages/Services';

/* ── Lazy routes ───────────────────────────────────────────────────────────
   Everything else. Previously a single bundle meant that opening the home
   page downloaded, parsed and compiled the entire application — including the
   ~5,900-line admin dashboard that only staff ever open, Leaflet and its CSS
   (pulled in by Cart and Profile), and framer-motion (used only by
   PartDetail). None of that is reachable from the landing page, and none of
   it should be on its critical path.

   Each of these becomes its own chunk, fetched the first time its route is
   visited and then cached by the browser. */
const Login          = lazy(() => import('./pages/Login'));
const Register       = lazy(() => import('./pages/Register'));
const MyBookings     = lazy(() => import('./pages/MyBookings'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const Profile        = lazy(() => import('./pages/Profile'));
const Contact        = lazy(() => import('./pages/Contact'));
const About          = lazy(() => import('./pages/About'));

// Spare parts storefront — live.
const SpareParts      = lazy(() => import('./pages/SpareParts'));
const PartDetail      = lazy(() => import('./pages/PartDetail'));
const Cart            = lazy(() => import('./pages/Cart'));
const OrderDetail     = lazy(() => import('./pages/OrderDetail'));
const Wishlist        = lazy(() => import('./pages/Wishlist'));
const FeaturedParts   = lazy(() => import('./pages/FeaturedParts'));
const BestsellerParts = lazy(() => import('./pages/BestsellerParts'));

/* ═══════════════════════════════════════════════════════════════════════════
   [GK MOTORS TRANSFORM] Buy / sell / rent disabled — GK Motors sells service
   and parts only. These files, their API layer, models and admin tabs are all
   untouched, so restoring them means uncommenting these imports and the
   matching <Route> entries further down.
   ═══════════════════════════════════════════════════════════════════════════
const BuyBikes        = lazy(() => import('./pages/BuyBikes'));
const BikeDetail      = lazy(() => import('./pages/BikeDetail'));
const SellBike        = lazy(() => import('./pages/SellBike'));
const FeaturedBikes   = lazy(() => import('./pages/FeaturedBikes'));
const BestsellerBikes = lazy(() => import('./pages/BestsellerBikes'));
const Rentals         = lazy(() => import('./pages/Rentals'));
const RentalDetail    = lazy(() => import('./pages/RentalDetail'));
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * Scroll handling on navigation.
 *
 * The old version called `window.scrollTo(0, 0)`, which inherits
 * `scroll-behavior: smooth` from the `html` rule in index.css. Leaving the
 * landing page from near its bottom therefore *animated* the viewport back up
 * through six thousand-odd pixels while the next route was mounting — several
 * seconds during which the page looks stuck. That is the "navigation hangs"
 * report.
 *
 * The stylesheet rule is kept, because in-page anchors (the hero's
 * "View All Services" jump to #services) genuinely want smooth scrolling.
 * Instead the behaviour is suppressed for this one call by setting
 * `scroll-behavior: auto` inline on <html> for the duration: an inline style
 * beats the stylesheet, and this works on every browser, unlike passing
 * `behavior: 'instant'` which older engines reject.
 *
 * A hash is honoured rather than overridden, so `/#how-it-works` reaches its
 * section instead of silently landing at the top. (The nav item itself is a
 * later phase's business; this just makes the routing correct.)
 */
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    root.style.scrollBehavior = previous;
  }, [pathname, hash]);

  return null;
};

/**
 * Shared chrome.
 *
 * Rendered as a react-router *layout route* with an <Outlet />, not as a
 * wrapper around each page. Previously every route element was
 * `<Layout><Page /></Layout>`, so navigating anywhere unmounted and remounted
 * Navbar and Footer — re-running their effects, rebuilding the sticky bar's
 * compositing layer and re-reading both cart contexts on every single
 * navigation. As a layout route the chrome is mounted once and only the
 * <Outlet /> content swaps.
 *
 * It is also a sticky-footer shell: a flex column at least one viewport tall
 * with <main> as the only growing item.
 *
 * Without that, a page whose content did not fill the viewport left the strip
 * below the footer uncovered — and index.css sets
 * `html { background-color: #0F172A }`. A background on <html> paints the
 * canvas and stops <body>'s white from reaching it, so that strip rendered as
 * a slab of dark navy directly under the footer. Being the same colour as the
 * footer, it read as extra page rather than as a gap.
 */
const Layout = ({ hideNav = false }) => (
  /* No minHeight here: #root already guarantees one viewport (in dvh, which
     is the mobile-correct unit). This just fills it, so there is exactly one
     viewport-height declaration in the whole chain rather than four. */
  <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100%', position: 'relative' }}>
    {!hideNav && <AnnouncementBar />}
    {!hideNav && <Navbar />}
    {/* flex: 1 0 auto — absorbs all remaining height so footer stays pinned to bottom */}
    <main style={{ width: '100%', maxWidth: '100%', position: 'relative', flex: '1 0 auto', display: 'flex', flexDirection: 'column' }}>
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    </main>
    {!hideNav && <Footer />}
  </div>
);

/**
 * Shown while a lazy route's chunk is in flight.
 *
 * Deliberately plain: the site's own white, roughly a screen tall so the
 * footer does not jump up and then back down, and a small navy spinner rather
 * than the dark full-page PageLoader, which would flash black between two
 * light pages.
 */
const RouteFallback = () => (
  <div
    style={{
      minHeight: '70vh', background: '#FFFFFF',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
    aria-busy="true"
    aria-live="polite"
  >
    <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
      Loading…
    </span>
    <svg width="40" height="40" viewBox="0 0 50 50" style={{ animation: 'spin 0.8s linear infinite' }} aria-hidden="true">
      <circle cx="25" cy="25" r="20" fill="none" stroke="#E2E8F0" strokeWidth="4" />
      <circle cx="25" cy="25" r="20" fill="none" stroke="#1E3A8A" strokeWidth="4"
        strokeDasharray="80" strokeDashoffset="60" strokeLinecap="round" />
    </svg>
  </div>
);

const NotFound = () => (
  <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.5rem', background: '#FFFFFF', textAlign: 'center' }}>
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(5rem, 15vw, 10rem)', fontWeight: 950, color: '#111', lineHeight: 1, letterSpacing: '-0.05em' }}>404</div>
    <div style={{ height: '6px', width: '80px', background: '#1E3A8A', borderRadius: '4px' }} />
    <h2 style={{ color: '#0F172A', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PAGE NOT FOUND</h2>
    <p style={{ color: '#64748B', fontSize: '1.2rem', maxWidth: '450px', fontWeight: 600 }}>The page you're looking for doesn't exist or has moved.</p>
    <a href="/" style={{ marginTop: '1.5rem', background: '#0F172A', color: 'white', padding: '1.2rem 3rem', borderRadius: '18px', textDecoration: 'none', fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.1em', boxShadow: '0 15px 40px rgba(15, 23, 42, 0.2)', transition: 'all 0.3s' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
      BACK TO GK MOTORS
    </a>
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
            {/* Auth pages - no nav. Own Suspense: they render no Layout. */}
            <Route path="/login" element={<Suspense fallback={<RouteFallback />}><Login /></Suspense>} />
            <Route path="/register" element={<Suspense fallback={<RouteFallback />}><Register /></Suspense>} />

            {/* Admin - no footer */}
            <Route element={<Layout hideNav={true} />}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>

            {/* Everything else shares one Navbar + Footer that stay mounted. */}
            <Route element={<Layout />}>
              {/* Public pages */}
              <Route path="/" element={<Home />} />
              <Route path="/services" element={<Services />} />
              <Route path="/my-bookings" element={<MyBookings />} />
              <Route path="/my-orders" element={<MyBookings />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/about" element={<About />} />

              {/* Spare parts storefront */}
              <Route path="/parts" element={<SpareParts />} />
              <Route path="/parts/:id" element={<PartDetail />} />
              <Route path="/featured" element={<FeaturedParts />} />
              <Route path="/bestseller" element={<BestsellerParts />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/wishlist" element={<Wishlist />} />

              {/* ═══════════════════════════════════════════════════════════════
                  [GK MOTORS TRANSFORM] Buy / sell / rent routes disabled.
                  Re-enable by uncommenting these together with the imports above.
                  ═══════════════════════════════════════════════════════════════
              <Route path="/bikes" element={<BuyBikes />} />
              <Route path="/bikes/featured" element={<FeaturedBikes />} />
              <Route path="/bikes/bestseller" element={<BestsellerBikes />} />
              <Route path="/bikes/:id" element={<BikeDetail />} />
              <Route path="/sell" element={<SellBike />} />
              <Route path="/rentals" element={<Rentals />} />
              <Route path="/rentals/:id" element={<RentalDetail />} />
                  ═══════════════════════════════════════════════════════════ */}

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
