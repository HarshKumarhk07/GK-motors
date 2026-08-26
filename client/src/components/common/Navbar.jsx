import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Menu, X, ChevronDown, User, LogOut, Settings, Wrench, Phone, ShoppingCart, Heart, Package } from 'lucide-react';
import { useCart, useServiceCart } from '../../context/CartContext';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Services', href: '/services' },
  { label: 'Shop', href: '/parts' },
  /* "How It Works" removed from the navigation on request. The section itself
     still exists on the home page with its id intact, and App.jsx's hash-aware
     ScrollToTop still resolves /#how-it-works — so any existing link or
     bookmark keeps working; it is only gone from this row. */
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
  /* ── Floating card bar ───────────────────────────────────────────────────
     The bar is a white rounded card inset from the viewport edges, sitting on
     a slate-900 band that runs edge to edge. The band is what makes the card
     read as floating: at the top of the page it runs straight into the hero
     below with no seam, and once the bar is pinned it keeps that same
     figure/ground over the page's light sections — where a bare white card
     would otherwise dissolve into a white background.

     The backdrop-filter that used to frost this bar is gone. The card is fully
     opaque, so there was nothing left to see through, and dropping it removes
     two things at once: the per-frame blur that made scrolling stutter on
     phones, and the containing block it created for position:fixed children,
     which is what constrained the mobile drawer below. */
  .gk-nav { background: #0F172A; padding: 0.55rem 0; }

  .gk-nav-card {
    background: #FFFFFF;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(2, 6, 23, 0.28);
    padding: 0 0.75rem;
  }
  @media (min-width: 640px) { .gk-nav-card { padding: 0 1.25rem; } }

  /* ── Active link underline ───────────────────────────────────────────────
     Inset to the link's text rather than its padding box, so the rule sits
     under the word and not under the hover target's full width. */
  .gk-nav-links a { position: relative; }
  .gk-nav-links a[data-active="true"]::after {
    content: '';
    position: absolute; left: 0.6rem; right: 0.6rem; bottom: 0.05rem;
    height: 2px; border-radius: 2px; background: #2563EB;
  }

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

  /* ── Mobile drawer ───────────────────────────────────────────────────────
     Fixed to the viewport rather than flowing inside the sticky bar. The bar
     is position:sticky, and anything inside it inherits that bar's fate — if
     sticky resolves badly the drawer goes with it. Anchored to the viewport
     instead, the panel is visible whatever the bar does.

     The offset is MEASURED from the bar rather than hard-coded. It used to
     be a literal 64px, which matched the bar's h-16 only while the bar was
     the first thing on the page. The announcement strip now sits above it, so
     at scroll-top the bar occupies 36..100 and a panel pinned at 64px would
     have opened over its bottom half. The 64px below is only a pre-mount
     fallback; the --gk-drawer-top custom property set on this bar overrides
     it the moment the panel opens.

     ONE THING TO KEEP IN MIND: a backdrop-filter (or a transform, or a
     filter) on .gk-nav would create a containing block for position:fixed
     descendants and re-anchor this panel to the bar instead of the viewport.
     The bar carried a blur until the floating-card restyle removed it, so
     nothing does that today — but if one is ever reintroduced, move this
     markup out of <nav> in the same change. */
  .gk-nav-backdrop {
    position: fixed;
    top: var(--gk-drawer-top, 64px); left: 0; right: 0; bottom: 0;
    z-index: 48;
    background: rgba(15, 23, 42, 0.55);
    border: 0; padding: 0; margin: 0;
    width: 100%;
    cursor: pointer;
    /* Stops a drag that starts on the backdrop from scrolling the page behind,
       without touching <body>'s overflow — which is what broke sticky. */
    touch-action: none;
  }

  .gk-nav-drawer {
    position: fixed;
    top: var(--gk-drawer-top, 64px); left: 0; right: 0;
    z-index: 49;
    background: #0F172A;
    max-height: calc(100vh - var(--gk-drawer-top, 64px));
    max-height: calc(100dvh - var(--gk-drawer-top, 64px));
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    /* A scroll that reaches the panel's end stops there instead of handing the
       remainder to the page behind it. */
    overscroll-behavior: contain;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .gk-nav-drawer:focus { outline: none; }

  /* The drawer is a mobile affordance; the burger is hidden from 1024px up, so
     make sure a stale open state can never leave it on screen at desktop. */
  @media (min-width: 1024px) {
    .gk-nav-backdrop, .gk-nav-drawer { display: none; }
  }
`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const { serviceCount } = useServiceCart();
  const totalCartCount = (itemCount || 0) + (serviceCount || 0);

  const [mobileOpen, setMobileOpen] = useState(false);
  /* Where the drawer's top edge belongs: the bar's own bottom edge in viewport
     coordinates. Read once when the panel opens — the backdrop's
     `touch-action: none` and the panel's `overscroll-behavior: contain` keep
     the page behind from scrolling while it is open, so a single measurement
     stays correct for the panel's lifetime and no scroll listener is needed. */
  const navRef = useRef(null);
  const [drawerTop, setDrawerTop] = useState(64);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  /* ── Why there is no body scroll lock here any more ──────────────────────
     This used to call useScrollLock(mobileOpen), which sets
     `document.body.style.overflow = 'hidden'`.

     That single line was what froze the site. Giving <body> an `overflow`
     other than `visible` turns it into a scroll container, and
     `position: sticky` resolves against the nearest scrollport. The bar's
     scrollport therefore switched from the viewport — scrolled to wherever
     the reader was — to <body>, whose own scrollTop is 0. Sticky had nothing
     left to stick to, so the bar snapped back to its static position at the
     very top of the document, thousands of pixels above the viewport, and
     vanished. The drawer, being inside it, vanished with it. Meanwhile
     scrolling was locked, so the page could not be moved to go and find them:
     no menu, no navbar, nothing responding.

     The drawer is now a fixed overlay (see below), anchored to the viewport
     rather than to the sticky bar, so it cannot be lost. Background scrolling
     is held off by `overscroll-behavior: contain` on the panel and
     `touch-action: none` on the backdrop — neither of which touches <body>'s
     overflow, so the bar keeps its scrollport and stays exactly where it is. */

  // Every link already closes the panel, but a browser back/forward gesture
  // changes the route without one, which would leave it hanging open.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Move focus into the panel when it opens, so keyboard and screen-reader
  // users are not left behind on the burger button.
  const drawerRef = useRef(null);
  useEffect(() => {
    if (mobileOpen) drawerRef.current?.focus();
  }, [mobileOpen]);

  /* Opening the panel: pin its top edge to wherever the bar's bottom edge
     currently is. At scroll-top that is below the announcement strip; once the
     strip has scrolled away and the bar is pinned, it is the bar's own height. */
  const toggleMenu = () => {
    setMobileOpen((open) => {
      if (!open) {
        const bottom = navRef.current?.getBoundingClientRect().bottom;
        if (typeof bottom === 'number') setDrawerTop(Math.max(0, Math.round(bottom)));
      }
      return !open;
    });
  };

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
    <nav
      ref={navRef}
      style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.05)', '--gk-drawer-top': `${drawerTop}px` }}
      className="gk-nav sticky top-0 z-50"
    >
      <style>{NAV_STYLES}</style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="gk-nav-card">
        <div className="flex items-center justify-between h-16 gap-2 min-w-0 gk-nav-row">
          {/* Logo — text based for now */}
          <Link to="/" className="flex items-center gap-2 mr-2 sm:mr-0 min-w-0 flex-shrink" style={{ textDecoration: 'none' }}>
            {/* Intrinsic size lets the browser hold the logo's slot before the
                file lands, so the sticky bar does not reflow on first paint.
                Height still comes from the h-9/h-11 classes. Eager: it is
                above the fold on every route. */}
            <img
              src="/gkmotorslogo.png"
              alt="GK Motors"
              className="h-9 sm:h-11"
              width={720}
              height={341}
              decoding="async"
              style={{ width: 'auto', objectFit: 'contain', display: 'block' }}
            />
          </Link>

          {/* Desktop Nav */}
          {/* flex-1 + centred: the row is logo | links | controls, and the
              links take the slack so they sit centred in the card rather than
              tucked against the logo. */}
          <div className="hidden lg:flex flex-1 items-center justify-center gap-1 gk-nav-links">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                data-active={isActive(location.pathname, link.href)}
                style={{
                  color: isActive(location.pathname, link.href) ? '#2563EB' : '#475569',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  fontFamily: "'Space Grotesk', sans-serif",
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
            {/* Cart */}
            <Link to="/cart" style={{ position: 'relative', color: '#0F172A', display: 'flex', alignItems: 'center', padding: '0.4rem', borderRadius: '8px', transition: 'background 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <ShoppingCart size={20} />
              {totalCartCount > 0 && (
                <span style={{
                  position: 'absolute', top: '-2px', right: '-2px',
                  background: '#2563EB', color: 'white', borderRadius: '50%',
                  width: '18px', height: '18px', fontSize: '0.65rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800,
                  border: '2px solid white', boxShadow: '0 2px 5px rgba(0,0,0,0.15)'
                }}>{totalCartCount}</span>
              )}
            </Link>

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
                    <X size={18} style={{ color: '#2563EB' }} />
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

            {/* Book Now — last in the row, which is where the reference puts
                its one filled control. Blue-600 rather than the slate-900 it
                used to be: with the bar now sitting on a slate-900 band, a
                slate button on a white card between two dark fields read as a
                hole rather than as the primary action. */}
            <Link
              to="/services"
              className="hidden sm:inline-flex gk-nav-cta"
              style={{
                alignItems: 'center', justifyContent: 'center',
                background: '#2563EB', color: '#FFFFFF',
                padding: '0.6rem 1.35rem', borderRadius: '10px',
                fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none',
                whiteSpace: 'nowrap', letterSpacing: '0.01em',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                transition: 'background 0.2s, transform 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1D4ED8'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#2563EB'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              Book Now
            </Link>

            {/* Mobile hamburger */}
            {/* `display` must not be set inline here: an inline style beats
                Tailwind's `md:hidden` (which is not !important), which is why
                the hamburger was still rendering next to the desktop nav and
                pushing the right-hand group past the container. Centring now
                comes from .gk-burger, which yields to the hidden rule. */}
            <button
              onClick={toggleMenu}
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

      </div>

      {/* Mobile Nav — a sibling of the padded container, not a child of it.
          It used to bleed out with a hard-coded `margin: 0 -1rem`, but the
          mobile stylesheet narrows that container to 0.75rem of padding, so
          the drawer hung 4px past each edge. Sitting outside the container it
          is full-width by construction, at any padding. */}
      {mobileOpen && (
        <>
          {/* Tap-anywhere-else to close. A real <button> so it is reachable by
              keyboard and announced, rather than a click-handling <div>. */}
          <button
            type="button"
            className="gk-nav-backdrop"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
        <div
          id="gk-mobile-nav"
          ref={drawerRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="gk-nav-drawer"
        >
          <div className="max-w-7xl mx-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '1.25rem 1rem 1rem' }}>
              <Link to="/services" onClick={() => setMobileOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  background: '#2563EB', color: 'white',
                  padding: '0.8rem', minHeight: 48, borderRadius: '12px', textDecoration: 'none',
                  fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, letterSpacing: '0.08em',
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

              {/* Signed-out actions.
                  Login and Sign Up were reachable from the bar itself but not
                  from this panel, and Sign Up is hidden below 640px — so on a
                  phone the drawer was the only menu and it had no way to
                  register. Both live here now, in the same button system as
                  the rest of the redesign: outline for Login, solid blue-600
                  for Sign Up. */}
              {!user && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '0.8rem', paddingTop: '1rem', display: 'flex', gap: '0.6rem' }}>
                  <Link to="/login" onClick={() => setMobileOpen(false)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      minHeight: 46, borderRadius: '10px', textDecoration: 'none',
                      border: '1.5px solid rgba(255,255,255,0.3)', color: '#FFFFFF',
                      fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.04em',
                    }}>
                    Login
                  </Link>
                  <Link to="/register" onClick={() => setMobileOpen(false)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      minHeight: 46, borderRadius: '10px', textDecoration: 'none',
                      background: '#2563EB', color: '#FFFFFF',
                      fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.04em',
                      boxShadow: '0 6px 16px rgba(37, 99, 235, 0.3)',
                    }}>
                    Sign Up
                  </Link>
                </div>
              )}

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
        </>
      )}
    </nav>
  );
}
