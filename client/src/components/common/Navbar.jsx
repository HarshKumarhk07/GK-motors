/* ═══════════════════════════════════════════════════════════════════════════
   NAVBAR — 2026 reconstruction

   Everything about how this bar BEHAVES is carried over unchanged, because all
   of it was hard-won: the fixed-to-viewport mobile drawer with its measured
   top offset, the deliberate absence of a body scroll lock, the escape key,
   the focus move, the route-change close, and the rule that no inline
   `display` may fight Tailwind's responsive hiding. The long comments
   explaining those decisions are kept verbatim — they document bugs that took
   real effort to find, and deleting them would invite the bugs back.

   What changed is the LOOK:

   • The band behind the floating card is the logo's navy, not slate-900.
   • The active link is marked by a sliding gradient pill that animates between
     items via framer-motion's shared layout, instead of a static underline
     that pops from one link to the next.
   • "Book Now" is the brand gradient, matching every other primary action on
     the site.
   • The bar compacts on scroll — less padding, more shadow — so it takes less
     of the viewport once you are reading.
   • The user dropdown, the cart badge and the drawer all move to the new
     palette and the new radius scale.
   ═══════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import {
  Menu, X, ChevronDown, User, LogOut, Settings, Wrench, Phone,
  ShoppingCart, Heart, Package,
} from 'lucide-react';
import { useCart, useServiceCart } from '../../context/CartContext';
import { BIZ } from '../../theme';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Services', href: '/services' },
  { label: 'Shop', href: '/parts' },
  /* "How It Works" is deliberately not here. The section still exists on the
     home page with its id intact and App.jsx's hash-aware ScrollToTop still
     resolves /#how-it-works, so every existing link and bookmark keeps
     working; it is only gone from this row. */
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

const isActive = (pathname, href) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);

const NAV_STYLES = `
  /* ── Floating card bar ───────────────────────────────────────────────────
     The bar is a white rounded card inset from the viewport edges, sitting on
     a navy band that runs edge to edge. The band is what makes the card read
     as floating: at the top of the page it runs straight into the hero below
     with no seam, and once the bar is pinned it keeps that same figure/ground
     over the page's light sections — where a bare white card would otherwise
     dissolve into a white background.

     There is deliberately NO backdrop-filter on this bar. The card is fully
     opaque so there would be nothing to see through, and its absence removes
     two problems at once: the per-frame blur that made scrolling stutter on
     phones, and the containing block it would create for position:fixed
     children, which is what would re-anchor the mobile drawer below. */
  .gk-nav {
    background: linear-gradient(180deg, var(--gk-ink) 0%, var(--gk-navy) 100%);
    padding: 0.6rem 0;
    transition: padding .35s cubic-bezier(.22,1,.36,1);
  }
  /* Compact once the page has been scrolled: the bar gives back a few pixels
     of viewport and picks up a deeper shadow so it separates from whatever it
     is now floating over. */
  .gk-nav[data-scrolled="true"] { padding: 0.3rem 0; }

  .gk-nav-card {
    background: #FFFFFF;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(4, 16, 31, .3);
    padding: 0 0.75rem;
    transition: box-shadow .35s, border-radius .35s;
  }
  .gk-nav[data-scrolled="true"] .gk-nav-card {
    box-shadow: 0 14px 40px rgba(4, 16, 31, .42);
    border-radius: 14px;
  }
  @media (min-width: 640px) { .gk-nav-card { padding: 0 1.25rem; } }

  /* ── Links ───────────────────────────────────────────────────────────────
     The active marker is a positioned pill BEHIND the label, animated between
     items by framer-motion's layoutId. The label therefore needs its own
     stacking context or the pill paints over it. */
  .gk-nav-links a {
    position: relative;
    display: inline-flex; align-items: center;
    padding: 0.5rem 0.85rem;
    border-radius: 9px;
    font-family: var(--gk-font-display);
    font-size: 0.83rem; font-weight: 600; letter-spacing: .02em;
    color: var(--gk-body);
    text-decoration: none;
    transition: color .25s;
  }
  .gk-nav-links a:hover { color: var(--gk-navy); }
  .gk-nav-links a[data-active="true"] { color: #FFFFFF; }

  /* The label carries its own class rather than being matched as 'a > span'.
     NOTE: no backticks anywhere in this string — NAV_STYLES is a template
     literal, so one inside a CSS comment terminates it and the file stops
     parsing.
     That selector also matched the pill, which is a sibling span, and at
     (0,1,2) it outweighed .gk-nav-pill at (0,1,0) — so the pill was forced
     from position:absolute to relative, collapsed to zero width, and never
     painted. The active link was left as white text on the white nav card:
     on the home page, "Home" simply vanished from the row. */
  .gk-nav-label { position: relative; z-index: 1; }
  .gk-nav-pill {
    position: absolute;
    inset: 0;
    border-radius: 9px;
    background: var(--gk-g-brand);
    box-shadow: 0 4px 14px rgba(21,103,211,.32);
    z-index: 0;
  }

  .gk-burger { display: inline-flex; align-items: center; justify-content: center; }
  @media (min-width: 1024px) { .gk-burger { display: none; } }
  /* The link row is dense at exactly 1024px, so tighten it there and let it
     breathe again on wider screens. */
  @media (min-width: 1024px) and (max-width: 1180px) {
    .gk-nav-links a { padding: 0.45rem 0.5rem; font-size: 0.78rem; }
  }
  /* ── Phone bar ───────────────────────────────────────────────────────── */
  .gk-nav-cta-short { display: none; }
  @media (max-width: 640px) {
    /* A shorter bar: 64px of chrome is a lot of a phone screen to give up
       before any content starts. */
    .gk-nav-row { height: 54px !important; gap: 0.4rem; }
    .gk-nav-right { gap: 0.25rem !important; }
    .gk-nav-card { padding: 0 0.5rem; border-radius: 14px; }
    .gk-nav { padding: 0.4rem 0; }

    .gk-nav-icon { width: 36px; height: 36px; }
    .gk-nav-cta { padding: 0.55rem 0.85rem; font-size: 0.76rem; border-radius: 10px; }
    .gk-nav-cta-full { display: none; }
    .gk-nav-cta-short { display: inline; }

    /* The signed-in chip keeps its avatar but drops the name and chevron —
       the name is the first thing in the drawer anyway. */
    .gk-nav-user { padding: 0.3rem; border-radius: 10px; }
    .gk-nav-user svg:last-child { display: none; }
  }
  @media (min-width: 641px) { .gk-nav-call { display: none; } }

  /* Below 380px even the burger and the CTA are competing for room. */
  @media (max-width: 380px) {
    .gk-nav-cta { padding: 0.5rem 0.7rem; font-size: 0.72rem; }
    .gk-nav-icon { width: 32px; height: 32px; }
  }

  /* ── Icon buttons (cart) ─────────────────────────────────────────────── */
  .gk-nav-icon {
    position: relative;
    display: inline-flex; align-items: center; justify-content: center;
    width: 38px; height: 38px; border-radius: 11px;
    color: var(--gk-navy); text-decoration: none;
    transition: background .25s, color .25s;
  }
  .gk-nav-icon:hover { background: rgba(21,103,211,.08); color: var(--gk-blue); }
  .gk-nav-badge {
    position: absolute; top: 1px; right: 1px;
    min-width: 18px; height: 18px; padding: 0 4px;
    border-radius: 999px;
    background: var(--gk-g-brand); color: #FFF;
    font-family: var(--gk-font-display); font-size: 0.62rem; font-weight: 700;
    display: inline-flex; align-items: center; justify-content: center;
    border: 2px solid #FFFFFF;
    box-shadow: 0 2px 6px rgba(21,103,211,.4);
  }

  /* ── User menu ───────────────────────────────────────────────────────── */
  .gk-nav-user {
    display: flex; align-items: center; gap: 0.45rem;
    background: #FFFFFF; cursor: pointer;
    border: 1.5px solid var(--gk-hairline); border-radius: 12px;
    padding: 0.38rem 0.7rem;
    color: var(--gk-navy);
    font-family: var(--gk-font-display); font-size: 0.8rem; font-weight: 600;
    transition: border-color .25s, box-shadow .25s;
  }
  .gk-nav-user:hover { border-color: rgba(21,103,211,.4); box-shadow: var(--gk-sh-card); }
  .gk-nav-avatar {
    width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--gk-g-brand); color: #FFF;
    font-size: 0.72rem; font-weight: 700; object-fit: cover;
  }
  .gk-nav-user[data-open="true"] { border-color: rgba(21,103,211,.45); }
  .gk-nav-chev { transition: transform .25s cubic-bezier(.22,1,.36,1); }
  .gk-nav-user[data-open="true"] .gk-nav-chev { transform: rotate(180deg); }

  .gk-nav-menu {
    position: absolute; right: 0; top: calc(100% + 0.6rem);
    /* Above the sticky bar's own z-50 and above the announcement strip's 51,
       so the panel can never be painted over by page furniture. */
    min-width: 210px; z-index: 200;
    background: var(--gk-navy);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 14px; overflow: hidden;
    box-shadow: 0 20px 50px rgba(4,16,31,.5);
  }
  .gk-nav-menu a, .gk-nav-menu button {
    display: flex; align-items: center; gap: 0.65rem; width: 100%;
    padding: 0.72rem 1rem;
    color: var(--gk-body-dark); text-decoration: none;
    background: none; border: none; cursor: pointer;
    font-family: var(--gk-font-sans); font-size: 0.86rem; font-weight: 500;
    text-align: left;
    transition: background .2s, color .2s;
  }
  .gk-nav-menu a:hover, .gk-nav-menu button:hover {
    background: rgba(255,255,255,.06); color: #FFFFFF;
  }
  .gk-nav-menu a[data-admin="true"] { color: var(--gk-cyan-soft); font-weight: 600; }
  .gk-nav-menu-sep { border-top: 1px solid rgba(255,255,255,.09); }
  .gk-nav-menu button[data-danger="true"] { color: #FF8A8E; }
  .gk-nav-menu button[data-danger="true"]:hover { background: rgba(229,72,77,.14); color: #FFB4B6; }

  /* ── Mobile drawer ───────────────────────────────────────────────────────
     Fixed to the viewport rather than flowing inside the sticky bar. The bar
     is position:sticky, and anything inside it inherits that bar's fate — if
     sticky resolves badly the drawer goes with it. Anchored to the viewport
     instead, the panel is visible whatever the bar does.

     The offset is MEASURED from the bar rather than hard-coded. It used to be
     a literal 64px, which matched the bar's height only while the bar was the
     first thing on the page. The announcement strip sits above it, so at
     scroll-top the bar occupies 36..100 and a panel pinned at 64px would have
     opened over its own bottom half. The 64px below is only a pre-mount
     fallback; the --gk-drawer-top custom property set on the bar overrides it
     the moment the panel opens.

     ONE THING TO KEEP IN MIND: a backdrop-filter (or a transform, or a filter)
     on .gk-nav would create a containing block for position:fixed descendants
     and re-anchor this panel to the bar instead of the viewport. Nothing does
     that today — but if one is ever introduced, move this markup out of <nav>
     in the same change. */
  .gk-nav-backdrop {
    position: fixed;
    top: var(--gk-drawer-top, 64px); left: 0; right: 0; bottom: 0;
    z-index: 48;
    background: rgba(4, 16, 31, .6);
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
    background: linear-gradient(180deg, var(--gk-navy) 0%, var(--gk-ink) 100%);
    max-height: calc(100vh - var(--gk-drawer-top, 64px));
    max-height: calc(100dvh - var(--gk-drawer-top, 64px));
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    /* A scroll that reaches the panel's end stops there instead of handing the
       remainder to the page behind it. */
    overscroll-behavior: contain;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    border-top: 1px solid rgba(255,255,255,.1);
  }
  .gk-nav-drawer:focus { outline: none; }

  .gk-drawer-link {
    display: flex; align-items: center; gap: 0.65rem;
    min-height: 46px; padding: 0.6rem 0.6rem;
    border-radius: 10px;
    color: #DCE9F6; text-decoration: none;
    font-family: var(--gk-font-display);
    font-size: 0.92rem; font-weight: 600;
    background: none; border: none; width: 100%; cursor: pointer; text-align: left;
    transition: background .2s, color .2s;
  }
  .gk-drawer-link:hover { background: rgba(255,255,255,.05); }
  .gk-drawer-link[data-active="true"] { color: var(--gk-cyan-soft); background: rgba(0,178,240,.09); }
  .gk-drawer-sep { border-top: 1px solid rgba(255,255,255,.1); margin-top: 0.8rem; padding-top: 0.8rem; }

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
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  /* ── Why there is no body scroll lock here ───────────────────────────────
     This used to call useScrollLock(mobileOpen), which sets
     `document.body.style.overflow = 'hidden'`.

     That single line was what froze the site. Giving <body> an `overflow`
     other than `visible` turns it into a scroll container, and
     `position: sticky` resolves against the nearest scrollport. The bar's
     scrollport therefore switched from the viewport — scrolled to wherever the
     reader was — to <body>, whose own scrollTop is 0. Sticky had nothing left
     to stick to, so the bar snapped back to its static position at the very
     top of the document, thousands of pixels above the viewport, and vanished.
     The drawer, being inside it, vanished with it. Meanwhile scrolling was
     locked, so the page could not be moved to go and find them: no menu, no
     navbar, nothing responding.

     The drawer is now a fixed overlay anchored to the viewport rather than to
     the sticky bar, so it cannot be lost. Background scrolling is held off by
     `overscroll-behavior: contain` on the panel and `touch-action: none` on
     the backdrop — neither of which touches <body>'s overflow, so the bar
     keeps its scrollport and stays exactly where it is. */

  // Every link already closes the panel, but a browser back/forward gesture
  // changes the route without one, which would leave it hanging open.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  /* Compact-on-scroll. A passive listener reading a single scalar — no layout
     is read, so this cannot force a synchronous reflow — and the state is only
     written when the boolean actually flips, so a long scroll causes two
     renders rather than one per frame. */
  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 12;
      setScrolled((prev) => (prev === next ? prev : next));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Move focus into the panel when it opens, so keyboard and screen-reader
  // users are not left behind on the burger button.
  const drawerRef = useRef(null);
  useEffect(() => {
    if (mobileOpen) drawerRef.current?.focus();
  }, [mobileOpen]);

  /* Opening the panel: pin its top edge to wherever the bar's bottom edge
     currently is. At scroll-top that is below the announcement strip; once the
     strip has scrolled away and the bar is pinned, it is the bar's own
     height. */
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

  /* ── Closing the account menu ───────────────────────────────────────────
     It previously had no way out except pressing the same button again. Every
     other menu on the web closes when you click away from it or press Escape,
     so one that does not reads as broken even though its toggle works.

     `pointerdown`, not `click`: a click fires only after the button is
     released, which on a link inside the menu means navigation has already
     been queued. Pointerdown also beats the browser's own focus handling, so
     the menu is gone before anything else reacts. The listener is only bound
     while the menu is open, so there is no idle document-level handler. */
  const userMenuRef = useRef(null);
  useEffect(() => {
    if (!dropdownOpen) return undefined;

    const onPointerDown = (e) => {
      if (!userMenuRef.current?.contains(e.target)) setDropdownOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setDropdownOpen(false); };

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [dropdownOpen]);

  // A route change should not leave the account menu hanging open either.
  useEffect(() => { setDropdownOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setDropdownOpen(false);
  };

  const closeDropdown = () => setDropdownOpen(false);

  return (
    <nav
      ref={navRef}
      data-scrolled={scrolled}
      style={{ '--gk-drawer-top': `${drawerTop}px` }}
      className="gk-nav sticky top-0 z-50"
    >
      <style>{NAV_STYLES}</style>

      <div className="gk-wrap">
        <div className="gk-nav-card">
          <div className="flex items-center justify-between h-16 gap-2 min-w-0 gk-nav-row">

            {/* Logo. Intrinsic size lets the browser hold its slot before the
                file lands, so the sticky bar does not reflow on first paint.
                Height still comes from the h-9/h-11 classes. Eager: it is
                above the fold on every route. */}
            <Link to="/" className="flex items-center gap-2 mr-2 sm:mr-0 min-w-0 flex-shrink"
              style={{ textDecoration: 'none' }} aria-label={`${BIZ.name} — home`}>
              <img
                src="/gkmotorslogo.png"
                alt={BIZ.name}
                className="h-9 sm:h-11"
                width={720}
                height={341}
                decoding="async"
                style={{ width: 'auto', objectFit: 'contain', display: 'block' }}
              />
            </Link>

            {/* Desktop links. flex-1 + centred so the row reads
                logo | links | controls with the links taking the slack. */}
            <div className="hidden lg:flex flex-1 items-center justify-center gap-1 gk-nav-links">
              {navLinks.map((link) => {
                const active = isActive(location.pathname, link.href);
                return (
                  <Link key={link.href} to={link.href} data-active={active}>
                    {/* The pill is shared across every link by layoutId, so
                        navigating slides it to the new item rather than making
                        it disappear here and reappear there. */}
                    {active && (
                      <motion.span
                        layoutId="gk-nav-pill"
                        className="gk-nav-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="gk-nav-label">{link.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Right-hand controls */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 gk-nav-right">

              <Link to="/cart" className="gk-nav-icon"
                aria-label={totalCartCount > 0 ? `Cart, ${totalCartCount} items` : 'Cart'}>
                <ShoppingCart size={20} />
                {totalCartCount > 0 && (
                  <span className="gk-nav-badge">{totalCartCount}</span>
                )}
              </Link>

              {user ? (
                <div style={{ position: 'relative' }} ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((v) => !v)}
                    className="gk-nav-user"
                    data-open={dropdownOpen}
                    aria-expanded={dropdownOpen}
                    aria-haspopup="menu"
                  >
                    {/* The button used to swap its whole label for an X while
                        open. That made it collapse from ~150px to ~30px the
                        instant it was clicked, shunting "Book Now" sideways and
                        moving the thing you just pressed out from under the
                        pointer. The contents are now stable and only the
                        chevron rotates. */}
                    {user.avatar ? (
                      <img src={user.avatar} alt="" className="gk-nav-avatar" />
                    ) : (
                      <span className="gk-nav-avatar">{user.name?.charAt(0).toUpperCase()}</span>
                    )}
                    <span className="hidden sm:block">{user.name}</span>
                    <ChevronDown size={14} className="gk-nav-chev" />
                  </button>

                  {dropdownOpen && (
                    <div className="gk-nav-menu" role="menu">
                      <Link to="/profile" onClick={closeDropdown} role="menuitem">
                        <User size={15} /> My Profile
                      </Link>
                      <Link to="/my-bookings" onClick={closeDropdown} role="menuitem">
                        <Wrench size={15} /> My Bookings
                      </Link>
                      <Link to="/my-orders?tab=orders" onClick={closeDropdown} role="menuitem">
                        <Package size={15} /> My Orders
                      </Link>
                      <Link to="/wishlist" onClick={closeDropdown} role="menuitem">
                        <Heart size={15} /> Wishlist
                      </Link>
                      {user.role === 'admin' && (
                        <Link to="/admin" onClick={closeDropdown} data-admin="true" role="menuitem">
                          <Settings size={15} /> Admin Panel
                        </Link>
                      )}
                      <div className="gk-nav-menu-sep">
                        <button type="button" onClick={handleLogout} data-danger="true" role="menuitem">
                          <LogOut size={15} /> Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2 whitespace-nowrap flex-shrink-0">
                  <Link to="/login" className="gk-btn gk-btn--outline gk-btn--sm">Login</Link>
                </div>
              )}

              {/* Tap-to-call, phones only. On a small screen this is the
                  single most likely action and it was previously buried two
                  taps deep inside the drawer. */}
              <a href={`tel:${BIZ.phoneTel}`} className="gk-nav-icon gk-nav-call sm:hidden"
                aria-label={`Call ${BIZ.phoneDisplay}`}>
                <Phone size={19} />
              </a>

              {/* The single filled control in the row, and the only place on
                  the bar that carries the brand gradient.

                  It used to be `hidden sm:inline-flex`, and Login was hidden
                  below 640px too — so on a phone the bar was a logo on the
                  left, a cart and a burger on the right, and a wide band of
                  empty white in between. It now shows at every width and just
                  loses its second word. */}
              <Link to="/services" className="gk-btn gk-btn--primary gk-btn--sm gk-nav-cta">
                <span className="gk-nav-cta-full">Book Now</span>
                <span className="gk-nav-cta-short">Book</span>
              </Link>

              {/* Mobile hamburger.
                  `display` must not be set inline here: an inline style beats
                  Tailwind's `lg:hidden` (which is not !important), which is why
                  the hamburger used to render next to the desktop nav and push
                  the right-hand group past the container. Centring comes from
                  .gk-burger, which yields to the hidden rule. */}
              <button
                type="button"
                onClick={toggleMenu}
                className="lg:hidden gk-burger"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                aria-controls="gk-mobile-nav"
                style={{
                  color: 'var(--gk-navy)', background: 'none', border: 'none', cursor: 'pointer',
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

      {/* Mobile drawer — a sibling of the padded container, not a child of it.
          It used to bleed out with a hard-coded `margin: 0 -1rem`, but the
          mobile stylesheet narrows that container's padding, so the drawer
          hung a few px past each edge. Outside the container it is full-width
          by construction, at any padding. */}
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
            <div className="gk-wrap" style={{ padding: '1.15rem var(--gk-gutter) 1.25rem' }}>

              <Link to="/services" onClick={() => setMobileOpen(false)}
                className="gk-btn gk-btn--primary"
                style={{ width: '100%', marginBottom: '1rem' }}>
                <Wrench size={16} /> Book a service
              </Link>

              {navLinks.map((link) => (
                <Link key={link.href} to={link.href} onClick={() => setMobileOpen(false)}
                  className="gk-drawer-link"
                  data-active={isActive(location.pathname, link.href)}>
                  {link.label}
                </Link>
              ))}

              <a href={`tel:${BIZ.phoneTel}`} className="gk-drawer-link">
                <Phone size={15} /> {BIZ.phoneDisplay}
              </a>

              {/* Signed-out actions. Login and Sign Up are reachable from the
                  bar itself but Sign Up is hidden below 640px — so on a phone
                  the drawer is the only menu and it needs both. */}
              {!user && (
                <div className="gk-drawer-sep" style={{ display: 'flex', gap: '0.6rem' }}>
                  <Link to="/login" onClick={() => setMobileOpen(false)}
                    className="gk-btn gk-btn--ghost gk-btn--sm" style={{ flex: 1 }}>
                    Login
                  </Link>
                  <Link to="/register" onClick={() => setMobileOpen(false)}
                    className="gk-btn gk-btn--primary gk-btn--sm" style={{ flex: 1 }}>
                    Sign Up
                  </Link>
                </div>
              )}

              {user && (
                <div className="gk-drawer-sep">
                  <Link to="/profile" onClick={() => setMobileOpen(false)} className="gk-drawer-link">
                    <User size={15} /> My Profile
                  </Link>
                  <Link to="/my-bookings" onClick={() => setMobileOpen(false)} className="gk-drawer-link">
                    <Wrench size={15} /> My Bookings
                  </Link>
                  <Link to="/my-orders?tab=orders" onClick={() => setMobileOpen(false)} className="gk-drawer-link">
                    <Package size={15} /> My Orders
                  </Link>
                  <Link to="/wishlist" onClick={() => setMobileOpen(false)} className="gk-drawer-link">
                    <Heart size={15} /> Wishlist
                  </Link>
                  {user.role === 'admin' && (
                    <Link to="/admin" onClick={() => setMobileOpen(false)}
                      className="gk-drawer-link" data-active="true">
                      <Settings size={15} /> Admin Panel
                    </Link>
                  )}
                  <button type="button" onClick={() => { handleLogout(); setMobileOpen(false); }}
                    className="gk-drawer-link" style={{ color: '#FF8A8E' }}>
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
