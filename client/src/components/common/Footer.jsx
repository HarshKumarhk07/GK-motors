/* ═══════════════════════════════════════════════════════════════════════════
   FOOTER — 2026 reconstruction

   The substantive fix here is not visual. The previous footer advertised head
   offices in Gurgaon (Unitech Cyber Park) and Mumbai (Andheri East) that GK
   Motors does not have — they were left over from the template this project
   started from. A customer who drove to one of those addresses would have
   found somebody else's building. All three location lines are replaced with
   the one real address, taken from the Google Business listing, and every
   detail now comes from BIZ in src/theme.js so it cannot drift out of sync
   with the nav, the hero and the booking flow again.

   Visually it moves to the logo palette, gains a proper closing CTA band, and
   the service links now deep-link to their category on /services the way they
   always did.
   ═══════════════════════════════════════════════════════════════════════════ */
import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Clock, ArrowRight, Navigation } from 'lucide-react';
import { FaFacebook, FaInstagram, FaYoutube, FaWhatsapp } from 'react-icons/fa';
import { BIZ } from '../../theme';

// [label, categoryId] — the id deep-links straight to that category on the
// services page. Ids match ServiceCategory.categoryId (see
// server/src/seeds/seedServiceCategories.js).
const SERVICE_LINKS = [
  ['Periodic Service', 1],
  ['AC Service & Repair', 2],
  ['Batteries', 3],
  ['Tyres & Wheels', 4],
  ['Denting & Painting', 5],
  ['Insurance Claims', 12],
  ['Car Spa & Cleaning', 7],
];

const QUICK_LINKS = [
  ['Book a Service', '/services'],
  ['Shop Parts & Oils', '/parts'],
  ['My Bookings', '/my-bookings'],
  ['About Us', '/about'],
  ['Contact Us', '/contact'],
];

/* href '#' means "no handle on file yet" — the three social profiles are
   placeholders for the client to fill in, and they are rendered as disabled
   rather than as links that go nowhere. WhatsApp is wired to the real
   number. */
const SOCIALS = [
  { icon: FaWhatsapp,  href: `https://wa.me/${BIZ.whatsapp}`, label: 'WhatsApp' },
  { icon: FaFacebook,  href: '#', label: 'Facebook' },
  { icon: FaInstagram, href: '#', label: 'Instagram' },
  { icon: FaYoutube,   href: '#', label: 'YouTube' },
];

export default function Footer() {
  return (
    <footer className="gk-foot">
      <style>{FOOTER_STYLES}</style>

      {/* ── Closing CTA ────────────────────────────────────────────────────
          Sits inside the footer rather than as its own page section, so every
          route gets the same last word without each page having to render
          one. */}
      <div className="gk-wrap">
        <div className="gk-foot-cta">
          <div>
            <h2 className="gk-foot-cta-title">Car making a noise you don&rsquo;t like?</h2>
            <p className="gk-foot-cta-sub">
              Bring it in, or let us come and get it. Either way you&rsquo;ll know what it
              costs before we start.
            </p>
          </div>
          <div className="gk-foot-cta-btns">
            <Link to="/services" className="gk-btn gk-btn--primary">
              Book a service <ArrowRight size={16} />
            </Link>
            <a href={`tel:${BIZ.phoneTel}`} className="gk-btn gk-btn--ghost">
              <Phone size={16} /> {BIZ.phoneDisplay}
            </a>
          </div>
        </div>
      </div>

      <div className="gk-wrap gk-foot-body">
        <div className="gk-foot-grid">

          {/* ── Brand ──────────────────────────────────────────────────── */}
          <div className="gk-foot-brand">
            {/* The logo is dark-on-white artwork, so on the dark footer it sits
                in a white chip rather than disappearing into it. Footer sits
                below the fold on every page — lazy, async-decoded, and sized so
                it cannot shift the layout as it arrives. */}
            <div className="gk-foot-logo">
              <img src="/gkmotorslogo.png" alt={BIZ.name} width={720} height={341}
                loading="lazy" decoding="async" />
            </div>

            <p className="gk-foot-blurb">
              A Rohtak workshop that services every make on the road. Genuine parts,
              an itemised quote before any work starts, and the old parts handed back
              to you when it&rsquo;s done.
            </p>

            <div className="gk-foot-socials">
              {SOCIALS.map(({ icon: Icon, href, label }) => {
                const live = href.startsWith('http');
                return (
                  <a key={label} href={href} aria-label={label}
                    data-live={live}
                    {...(live ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>
                    <Icon size={16} />
                  </a>
                );
              })}
            </div>
          </div>

          {/* ── Services ───────────────────────────────────────────────── */}
          <div>
            <h4 className="gk-foot-h">Services</h4>
            <ul className="gk-foot-list">
              {SERVICE_LINKS.map(([label, id]) => (
                <li key={label}>
                  <Link to={`/services?category=${id}`}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Quick links ────────────────────────────────────────────── */}
          <div>
            <h4 className="gk-foot-h">Quick Links</h4>
            <ul className="gk-foot-list">
              {QUICK_LINKS.map(([label, href]) => (
                <li key={href}><Link to={href}>{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* ── Contact — ONE location, the real one ───────────────────── */}
          <div className="gk-foot-contact">
            <h4 className="gk-foot-h">Find Us</h4>

            <a href={BIZ.mapsUrl} target="_blank" rel="noreferrer noopener" className="gk-foot-addr">
              <MapPin size={16} />
              <span>
                <b>{BIZ.name}</b>
                {BIZ.addressLine1}<br />{BIZ.addressLine2}
                <em><Navigation size={11} /> Get directions</em>
              </span>
            </a>

            <a href={`tel:${BIZ.phoneTel}`} className="gk-foot-row">
              <Phone size={16} /><span>{BIZ.phoneDisplay}</span>
            </a>
            <a href={`mailto:${BIZ.email}`} className="gk-foot-row">
              <Mail size={16} /><span>{BIZ.email}</span>
            </a>
            <p className="gk-foot-row" style={{ margin: 0 }}>
              <Clock size={16} /><span>{BIZ.hours}</span>
            </p>
          </div>
        </div>

        <div className="gk-foot-base">
          <p>© {new Date().getFullYear()} {BIZ.name} · Avani Enterprises. All rights reserved.</p>
          <div>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

const FOOTER_STYLES = `
  .gk-foot {
    background: linear-gradient(180deg, var(--gk-navy) 0%, var(--gk-ink) 100%);
    color: var(--gk-body-dark);
    width: 100%;
    flex-shrink: 0;
    padding-top: clamp(2.5rem, 5vw, 3.5rem);
  }

  /* ── Closing CTA band ──────────────────────────────────────────────────── */
  .gk-foot-cta {
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
    gap: 1.6rem;
    padding: clamp(1.6rem, 3.5vw, 2.4rem) clamp(1.4rem, 3.5vw, 2.6rem);
    border-radius: 24px;
    background:
      radial-gradient(ellipse 80% 140% at 88% 50%, rgba(0,178,240,.22) 0%, transparent 62%),
      linear-gradient(120deg, rgba(21,103,211,.20) 0%, rgba(255,255,255,.045) 100%);
    border: 1px solid rgba(255,255,255,.12);
  }
  .gk-foot-cta-title {
    font-family: var(--gk-font-display);
    font-size: clamp(1.25rem, 2.6vw, 1.8rem);
    font-weight: 700; letter-spacing: -.025em; line-height: 1.15;
    color: #FFFFFF; margin: 0;
  }
  .gk-foot-cta-sub {
    font-size: 0.9rem; line-height: 1.6; color: var(--gk-body-dark);
    margin: 0.55rem 0 0; max-width: 34rem;
  }
  .gk-foot-cta-btns { display: flex; flex-wrap: wrap; gap: 0.75rem; flex-shrink: 0; }
  @media (max-width: 480px) {
    .gk-foot-cta-btns { width: 100%; flex-direction: column; }
    .gk-foot-cta-btns .gk-btn { width: 100%; }
  }

  /* ── Columns ───────────────────────────────────────────────────────────── */
  .gk-foot-body { padding-top: clamp(2.5rem, 5vw, 3.5rem); padding-bottom: 1.5rem; }

  /* min() floor + min-width:0 on the items: without them a long address line
     sets a column's min-content width and the footer runs a pixel past the
     viewport at 768px, which is enough to summon a scrollbar. */
  .gk-foot-grid {
    display: grid;
    grid-template-columns: 1.5fr 1fr 1fr 1.4fr;
    gap: clamp(1.6rem, 3vw, 2.5rem);
  }
  .gk-foot-grid > * { min-width: 0; }
  .gk-foot-grid span, .gk-foot-grid p { overflow-wrap: anywhere; }
  @media (max-width: 900px) {
    .gk-foot-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2rem 1.5rem; }
    .gk-foot-brand, .gk-foot-contact { grid-column: 1 / -1; }
  }

  .gk-foot-logo {
    display: inline-flex; align-items: center;
    background: #FFFFFF; border-radius: 14px;
    padding: 0.5rem 0.75rem; margin-bottom: 1.2rem;
  }
  .gk-foot-logo img { height: 40px; width: auto; object-fit: contain; display: block; }

  .gk-foot-blurb { font-size: 0.9rem; line-height: 1.75; margin: 0; max-width: 27rem; }

  .gk-foot-socials { display: flex; gap: 0.6rem; margin-top: 1.3rem; }
  .gk-foot-socials a {
    width: 40px; height: 40px; border-radius: 12px;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.1);
    color: var(--gk-body-dark);
    transition: background .3s, border-color .3s, color .3s, transform .3s cubic-bezier(.22,1,.36,1);
  }
  .gk-foot-socials a[data-live="true"]:hover {
    background: var(--gk-g-brand); border-color: transparent; color: #FFF;
    transform: translateY(-3px);
    box-shadow: var(--gk-sh-brand);
  }
  /* A profile with no URL yet should not pretend to be clickable. */
  .gk-foot-socials a[data-live="false"] { opacity: .45; cursor: default; }

  .gk-foot-h {
    font-family: var(--gk-font-display);
    color: #FFFFFF; font-size: 0.78rem; font-weight: 700;
    letter-spacing: .17em; text-transform: uppercase;
    margin: 0 0 1.1rem;
  }

  .gk-foot-list { list-style: none; margin: 0; padding: 0; }
  .gk-foot-list li { margin-bottom: 0.62rem; }
  .gk-foot-list a {
    color: var(--gk-body-dark); text-decoration: none;
    font-size: 0.88rem; font-weight: 500;
    display: inline-block;
    transition: color .25s, transform .25s cubic-bezier(.22,1,.36,1);
  }
  .gk-foot-list a:hover { color: var(--gk-cyan-soft); transform: translateX(4px); }

  /* ── Contact column ────────────────────────────────────────────────────── */
  .gk-foot-addr {
    display: flex; align-items: flex-start; gap: 0.65rem;
    padding: 0.9rem; margin-bottom: 0.9rem;
    border-radius: 14px; text-decoration: none;
    background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.09);
    color: var(--gk-body-dark);
    font-size: 0.86rem; line-height: 1.62;
    transition: border-color .3s, background .3s;
  }
  .gk-foot-addr:hover { border-color: rgba(0,178,240,.4); background: rgba(0,178,240,.07); }
  .gk-foot-addr svg { color: var(--gk-cyan); flex-shrink: 0; margin-top: 3px; }
  .gk-foot-addr b {
    display: block; color: #FFFFFF; font-family: var(--gk-font-display);
    font-size: 0.92rem; font-weight: 700; margin-bottom: 0.25rem;
  }
  .gk-foot-addr em {
    display: inline-flex; align-items: center; gap: 0.35rem;
    margin-top: 0.55rem; font-style: normal;
    color: var(--gk-cyan-soft); font-size: 0.78rem; font-weight: 600;
  }

  .gk-foot-row {
    display: flex; align-items: center; gap: 0.65rem;
    padding: 0.42rem 0; text-decoration: none;
    color: var(--gk-body-dark); font-size: 0.88rem; font-weight: 500;
    transition: color .25s;
  }
  .gk-foot-row svg { color: var(--gk-cyan); flex-shrink: 0; }
  a.gk-foot-row:hover { color: #FFFFFF; }

  /* ── Base rule ─────────────────────────────────────────────────────────── */
  .gk-foot-base {
    border-top: 1px solid rgba(255,255,255,.09);
    margin-top: clamp(2rem, 4vw, 3rem);
    padding-top: 1.35rem; padding-bottom: 0.5rem;
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
    gap: 0.9rem;
  }
  .gk-foot-base p { font-size: 0.82rem; margin: 0; color: var(--gk-meta-dark); }
  .gk-foot-base div { display: flex; gap: 1.3rem; }
  .gk-foot-base a {
    color: var(--gk-meta-dark); text-decoration: none;
    font-size: 0.82rem; font-weight: 500; transition: color .25s;
  }
  .gk-foot-base a:hover { color: var(--gk-cyan-soft); }

  @media (prefers-reduced-motion: reduce) {
    .gk-foot-list a, .gk-foot-socials a { transition-duration: .01ms; }
  }
`;
