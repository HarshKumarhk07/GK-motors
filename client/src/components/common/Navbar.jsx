import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Menu, X, ChevronDown, User, LogOut, Settings, Wrench, Phone, ShoppingCart, Heart, Package } from 'lucide-react';
import { useScrollLock } from '../../utils/responsive';
import { useCart, useServiceCart } from '../../context/CartContext';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Services', href: '/services' },
  { label: 'Parts', href: '/parts' },
  { label: 'My Bookings', href: '/my-bookings' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

/* [GK MOTORS TRANSFORM] Marketplace nav links — restore alongside the routes in App.jsx
const marketplaceLinks = [
  { label: 'Buy Cars', href: '/bikes' },
  { label: 'Rent Car', href: '/rentals' },
  { label: 'Sell Car', href: '/sell' },
  { label: 'Parts', href: '/parts' },
  { label: 'Featured', href: '/bikes/featured' },
  { label: 'Bestseller', href: '/bikes/bestseller' },
];
*/

const isActive = (pathname, href) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);

const NAV_STYLES = `
  .gk-burger { display: inline-flex; align-items: center; justify-content: center; }
  @media (min-width: 1024px) { .gk-burger { display: none; } }
  /* The link row is dense at exactly 1024px, so tighten it there and let it
     breathe again on wider screens. */
  @media (min-width: 1024px) and (max-width: 1180px) {
    .gk-nav-links a { padding: 0.4rem 0.4rem !important; font-size: 0.78rem !important; }
  }
  /* Below 380px the name label crowds the row; the icons and the hamburger
     are what actually need to stay reachable. */
  @media (max-width: 380px) {
    .gk-nav-row { gap: 0.35rem; }
    .gk-nav-right { gap: 0.5rem !important; }
  }
`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const { serviceCount } = useServiceCart();
  const totalCartCount = (itemCount || 0) + (serviceCount || 0);

  const [mobileOpen, setMobileOpen] = useState(false);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // The panel overlays the page, so the page behind it must not scroll.
  useScrollLock(mobileOpen);

  // Every link already closes the panel, but a browser back/forward gesture
  // changes the route without one, which would leave it hanging open.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Escape is the expected way out of anything overlaying the page.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setDropdownOpen(false);
  };

  return (
    <nav style={{ background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }} className="sticky top-0 z-50">
      <style>{NAV_STYLES}</style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 min-w-0 gk-nav-row">
          {/* Logo — text based for now */}
          <Link to="/" className="flex items-center gap-2 mr-2 sm:mr-0 min-w-0 flex-shrink" style={{ textDecoration: 'none' }}>
            <img
              src="/gkmotorslogo.png"
              alt="GK Motors"
              className="h-9 sm:h-11"
              style={{ width: 'auto', objectFit: 'contain', display: 'block' }}
            />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1 gk-nav-links">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                style={{
                  color: isActive(location.pathname, link.href) ? '#1E3A8A' : '#475569',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  fontFamily: 'Rajdhani, sans-serif',
                  letterSpacing: '0.04em'
                }}
                onMouseEnter={(e) => { if (!isActive(location.pathname, link.href)) e.target.style.color = '#0F172A'; }}
                onMouseLeave={(e) => { if (!isActive(location.pathname, link.href)) e.target.style.color = '#475569'; }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 sm:gap-4 md:gap-5 flex-shrink-0 gk-nav-right">
            {/* Book Service CTA */}
            <Link
              to="/services"
              className="hidden sm:inline-flex"
              style={{
                alignItems: 'center', gap: '0.45rem',
                background: 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)',
                color: 'white', padding: '0.5rem 1.1rem', borderRadius: '10px',
                fontSize: '0.75rem', fontWeight: 800, textDecoration: 'none',
                fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.06em',
                textTransform: 'uppercase', whiteSpace: 'nowrap',
                boxShadow: '0 4px 14px rgba(30, 58, 138, 0.25)', transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <Wrench size={14} /> Book Service
            </Link>

            {/* Cart */}
            <Link to="/cart" style={{ position: 'relative', color: '#0F172A', display: 'flex', alignItems: 'center', padding: '0.4rem', borderRadius: '8px', transition: 'background 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <ShoppingCart size={20} />
              {totalCartCount > 0 && (
                <span style={{
                  position: 'absolute', top: '-2px', right: '-2px',
                  background: '#1E3A8A', color: 'white', borderRadius: '50%',
                  width: '18px', height: '18px', fontSize: '0.65rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800,
                  border: '2px solid white', boxShadow: '0 2px 5px rgba(0,0,0,0.15)'
                }}>{totalCartCount}</span>
              )}
            </Link>

            {/* Call us */}
            <a href="tel:+919253625099" className="hidden xl:flex items-center gk-nav-phone" style={{ gap: '0.4rem', color: '#0F172A', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700, padding: '0.4rem 0.75rem', borderRadius: '8px', background: 'rgba(30, 58, 138, 0.04)', border: '1px solid rgba(30, 58, 138, 0.08)' }}>
              <Phone size={14} style={{ color: '#1E3A8A' }} /> +91 92536 25099
            </a>

            {/* User Menu */}
            {user ? (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    background: '#FFF', border: '1.5px solid rgba(156, 163, 175, 0.3)',
                    borderRadius: '10px', padding: '0.4rem 0.75rem', color: '#0F172A',
                    cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                  }}
                >
                  {dropdownOpen ? (
                    <X size={18} style={{ color: '#1E3A8A' }} />
                  ) : (
                    <>
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'white' }}>
                          {user.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="hidden sm:block">{user.name}</span>
                      <ChevronDown size={14} />
                    </>
                  )}
                </button>

                {dropdownOpen && (
                  <div style={{
                    position: 'absolute', right: 0, top: '110%',
                    background: '#0F172A', border: '1px solid rgba(156, 163, 175, 0.2)',
                    borderRadius: '10px', minWidth: '180px', zIndex: 100,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                    overflow: 'hidden',
                  }}>
                    <Link to="/profile" onClick={() => setDropdownOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', color: '#ccc', textDecoration: 'none', fontSize: '0.9rem' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#1E293B'; e.currentTarget.style.color = 'white'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ccc'; }}>
                      <User size={15} /> My Profile
                    </Link>
                    <Link to="/my-bookings" onClick={() => setDropdownOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', color: '#ccc', textDecoration: 'none', fontSize: '0.9rem' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#1E293B'; e.currentTarget.style.color = 'white'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ccc'; }}>
                      <Wrench size={15} /> My Bookings
                    </Link>
                    <Link to="/my-orders?tab=orders" onClick={() => setDropdownOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', color: '#ccc', textDecoration: 'none', fontSize: '0.9rem' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#1E293B'; e.currentTarget.style.color = 'white'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ccc'; }}>
                      <Package size={15} /> My Orders
                    </Link>
                    <Link to="/wishlist" onClick={() => setDropdownOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', color: '#ccc', textDecoration: 'none', fontSize: '0.9rem' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#1E293B'; e.currentTarget.style.color = 'white'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ccc'; }}>
                      <Heart size={15} /> Wishlist
                    </Link>
                    {user.role === 'admin' && (
                      <Link to="/admin" onClick={() => setDropdownOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', color: '#93C5FD', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#1E293B'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                        <Settings size={15} /> Admin Panel
                      </Link>
                    )}
                    <div style={{ borderTop: '1px solid #1E293B' }}>
                      <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', width: '100%' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#1f0a0a'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                        <LogOut size={15} /> Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap flex-shrink-0">
                <Link to="/login" className="btn-outline-dark !px-2 !py-1 !text-[10px] sm:!px-[0.8rem] sm:!py-[0.4rem] sm:!text-[0.7rem]" style={{ fontWeight: 700 }}>Login</Link>
                <Link to="/register" className="btn-primary !hidden sm:!inline-flex !px-2 !py-1 !text-[10px] sm:!px-[0.8rem] sm:!py-[0.4rem] sm:!text-[0.7rem]" style={{ fontWeight: 700 }}>Sign Up</Link>
              </div>
            )}

            {/* Mobile hamburger */}
            {/* `display` must not be set inline here: an inline style beats
                Tailwind's `md:hidden` (which is not !important), which is why
                the hamburger was still rendering next to the desktop nav and
                pushing the right-hand group past the container. Centring now
                comes from .gk-burger, which yields to the hidden rule. */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden gk-burger"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="gk-mobile-nav"
              style={{
                color: '#0F172A', background: 'none', border: 'none', cursor: 'pointer',
                // 44px is the smallest reliably tappable target.
                minWidth: 44, minHeight: 44,
                margin: '-0.2rem -0.4rem -0.2rem 0',   // grow the hit area, not the layout
              }}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

      </div>

      {/* Mobile Nav — a sibling of the padded container, not a child of it.
          It used to bleed out with a hard-coded `margin: 0 -1rem`, but the
          mobile stylesheet narrows that container to 0.75rem of padding, so
          the drawer hung 4px past each edge. Sitting outside the container it
          is full-width by construction, at any padding. */}
      {mobileOpen && (
        <div id="gk-mobile-nav" style={{ background: '#0F172A', width: '100%', maxHeight: 'calc(100vh - 64px)', overflowY: 'auto' }}>
          <div className="max-w-7xl mx-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '1.25rem 1rem 1rem' }}>
              <Link to="/services" onClick={() => setMobileOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)', color: 'white',
                  padding: '0.8rem', minHeight: 48, borderRadius: '12px', textDecoration: 'none',
                  fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, letterSpacing: '0.08em',
                  textTransform: 'uppercase', fontSize: '0.9rem', marginBottom: '1rem'
                }}>
                <Wrench size={16} /> Book Service Now
              </Link>

              {navLinks.map((link) => (
                <Link key={link.href} to={link.href} onClick={() => setMobileOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', minHeight: 44, color: isActive(location.pathname, link.href) ? '#93C5FD' : '#E2E8F0', textDecoration: 'none', padding: '0.6rem 0.5rem', fontSize: '0.92rem', fontWeight: 600 }}>
                  {link.label}
                </Link>
              ))}

              <a href="tel:+919253625099" style={{ display: 'flex', alignItems: 'center', minHeight: 44, gap: '0.6rem', color: '#E2E8F0', textDecoration: 'none', padding: '0.6rem 0.5rem', fontSize: '0.92rem', fontWeight: 600 }}>
                <Phone size={15} /> +91 92536 25099
              </a>

              {/* Mobile user actions */}
              {user && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '0.8rem', paddingTop: '0.8rem' }}>
                  <Link to="/profile" onClick={() => setMobileOpen(false)} style={{ display: 'flex', alignItems: 'center', minHeight: 44, gap: '0.6rem', color: '#E2E8F0', textDecoration: 'none', padding: '0.6rem 0.5rem', fontSize: '0.92rem', fontWeight: 600 }}>
                    <User size={15} /> My Profile
                  </Link>
                  <Link to="/my-orders?tab=orders" onClick={() => setMobileOpen(false)} style={{ display: 'flex', alignItems: 'center', minHeight: 44, gap: '0.6rem', color: '#E2E8F0', textDecoration: 'none', padding: '0.6rem 0.5rem', fontSize: '0.92rem', fontWeight: 600 }}>
                    <Package size={15} /> My Orders
                  </Link>
                  <Link to="/wishlist" onClick={() => setMobileOpen(false)} style={{ display: 'flex', alignItems: 'center', minHeight: 44, gap: '0.6rem', color: '#E2E8F0', textDecoration: 'none', padding: '0.6rem 0.5rem', fontSize: '0.92rem', fontWeight: 600 }}>
                    <Heart size={15} /> Wishlist
                  </Link>
                  {user.role === 'admin' && (
                    <Link to="/admin" onClick={() => setMobileOpen(false)} style={{ display: 'flex', alignItems: 'center', minHeight: 44, gap: '0.6rem', color: '#93C5FD', textDecoration: 'none', padding: '0.6rem 0.5rem', fontSize: '0.92rem', fontWeight: 700 }}>
                      <Settings size={15} /> Admin Panel
                    </Link>
                  )}
                  <button onClick={() => { handleLogout(); setMobileOpen(false); }} style={{ display: 'flex', alignItems: 'center', minHeight: 44, gap: '0.6rem', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0.6rem 0.5rem', fontSize: '0.92rem', fontWeight: 700, width: '100%' }}>
                    <LogOut size={15} /> Logout
                  </button>
                </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
