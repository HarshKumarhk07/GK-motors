import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Menu, X, ChevronDown, User, LogOut, Settings, Wrench, Phone } from 'lucide-react';
// [GK MOTORS] cart / wishlist / pincode / catalog-search removed with the marketplace.
// import { useCart } from '../../context/CartContext';
// import { ShoppingCart, Heart, MapPin, Search } from 'lucide-react';
// import API from '../../api/axios';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Services', href: '/services' },
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

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
    setDropdownOpen(false);
  };

  return (
    <nav style={{ background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }} className="sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo — text based for now */}
          <Link to="/" className="flex items-center gap-2 mr-4 sm:mr-0" style={{ textDecoration: 'none' }}>
            <div style={{
              width: 38, height: 38, borderRadius: '10px',
              background: 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, boxShadow: '0 4px 12px rgba(30, 58, 138, 0.25)'
            }}>
              <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 950, color: 'white', fontSize: '1.05rem', letterSpacing: '-0.02em' }}>GK</span>
            </div>
            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, color: '#0F172A', letterSpacing: '0.03em' }} className="text-[1.05rem] sm:text-[1.35rem] whitespace-nowrap">
              GK Motors
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
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
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Book Service CTA */}
            <Link
              to="/services"
              className="hidden sm:inline-flex"
              style={{
                alignItems: 'center', gap: '0.4rem',
                background: 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)',
                color: 'white', padding: '0.45rem 1rem', borderRadius: '10px',
                fontSize: '0.72rem', fontWeight: 800, textDecoration: 'none',
                fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.06em',
                textTransform: 'uppercase', whiteSpace: 'nowrap',
                boxShadow: '0 4px 14px rgba(30, 58, 138, 0.25)', transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <Wrench size={14} /> Book Service
            </Link>

            {/* Call us */}
            <a href="tel:+919253625099" className="hidden lg:flex items-center" style={{ gap: '0.35rem', color: '#0F172A', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 700 }}>
              <Phone size={15} style={{ color: '#1E3A8A' }} /> +91 92536 25099
            </a>

            {/* User Menu */}
            {user ? (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    background: '#FFF', border: '1px solid rgba(156, 163, 175, 0.3)',
                    borderRadius: '8px', padding: '0.35rem 0.6rem', color: '#0F172A',
                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700
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
                    {/* [GK MOTORS] Wishlist link removed with the marketplace */}
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
              <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                <Link to="/login" className="btn-outline-dark !px-2 !py-1 !text-[10px] sm:!px-[0.8rem] sm:!py-[0.4rem] sm:!text-[0.7rem]" style={{ fontWeight: 700 }}>Login</Link>
                <Link to="/register" className="btn-primary !hidden sm:!inline-flex !px-2 !py-1 !text-[10px] sm:!px-[0.8rem] sm:!py-[0.4rem] sm:!text-[0.7rem]" style={{ fontWeight: 700 }}>Sign Up</Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden" style={{ color: '#0F172A', background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem' }}>
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div style={{ background: '#0F172A', margin: '0 -1rem' }}>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '1.25rem 1rem 1rem' }}>
              <Link to="/services" onClick={() => setMobileOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)', color: 'white',
                  padding: '0.8rem', borderRadius: '12px', textDecoration: 'none',
                  fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, letterSpacing: '0.08em',
                  textTransform: 'uppercase', fontSize: '0.9rem', marginBottom: '1rem'
                }}>
                <Wrench size={16} /> Book Service Now
              </Link>

              {navLinks.map((link) => (
                <Link key={link.href} to={link.href} onClick={() => setMobileOpen(false)}
                  style={{ display: 'block', color: isActive(location.pathname, link.href) ? '#93C5FD' : '#E2E8F0', textDecoration: 'none', padding: '0.6rem 0.5rem', fontSize: '0.92rem', fontWeight: 600 }}>
                  {link.label}
                </Link>
              ))}

              <a href="tel:+919253625099" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#E2E8F0', textDecoration: 'none', padding: '0.6rem 0.5rem', fontSize: '0.92rem', fontWeight: 600 }}>
                <Phone size={15} /> +91 92536 25099
              </a>

              {/* Mobile user actions */}
              {user && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '0.8rem', paddingTop: '0.8rem' }}>
                  <Link to="/profile" onClick={() => setMobileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#E2E8F0', textDecoration: 'none', padding: '0.6rem 0.5rem', fontSize: '0.92rem', fontWeight: 600 }}>
                    <User size={15} /> My Profile
                  </Link>
                  {user.role === 'admin' && (
                    <Link to="/admin" onClick={() => setMobileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#93C5FD', textDecoration: 'none', padding: '0.6rem 0.5rem', fontSize: '0.92rem', fontWeight: 700 }}>
                      <Settings size={15} /> Admin Panel
                    </Link>
                  )}
                  <button onClick={() => { handleLogout(); setMobileOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0.6rem 0.5rem', fontSize: '0.92rem', fontWeight: 700, width: '100%' }}>
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
