import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin } from 'lucide-react';
import { FaFacebook, FaInstagram, FaYoutube, FaWhatsapp } from 'react-icons/fa';

// [label, categoryId] — the id deep-links straight to that category on the
// services page. Ids match ServiceCategory.categoryId (see
// server/src/seeds/seedServiceCategories.js).
const SERVICE_LINKS = [
  ['Car Service', 1],
  ['AC Service & Repair', 2],
  ['Batteries', 3],
  ['Tyre & Wheel Care', 4],
  ['Denting & Painting', 5],
  ['Car Spa & Cleaning', 7],
];

const QUICK_LINKS = [
  ['Book a Service', '/services'],
  ['My Bookings', '/my-bookings'],
  ['My Profile', '/profile'],
  ['About Us', '/about'],
  ['Contact Us', '/contact'],
];

/* href '#' means "no handle on file yet" — the three profile links are
   placeholders for the client to fill in. WhatsApp is wired to the service
   number that already appears in the contact column and the CTA above it. */
const SOCIALS = [
  { icon: FaFacebook,  href: '#',                          label: 'Facebook' },
  { icon: FaInstagram, href: '#',                          label: 'Instagram' },
  { icon: FaYoutube,   href: '#',                          label: 'YouTube' },
  { icon: FaWhatsapp,  href: 'https://wa.me/919253625099', label: 'WhatsApp' },
];

const LOCATIONS = [
  { icon: MapPin, text: 'GURGAON: Tower B, 3rd Floor, Unitech Cyber Park, Sector 39, 122002' },
  { icon: MapPin, text: 'MUMBAI: Third Floor, Vasudev Chamber, Teli Galli Cross Rd, Andheri East, 400069' },
  { icon: MapPin, text: 'ROHTAK: 106, First Floor, Agro Mall, Rohtak' },
  { icon: Phone, text: '+91 9253625099' },
  { icon: Mail, text: 'kp@avanienterprises.in' },
];

export default function Footer() {
  return (
    <footer style={{ background: '#0F172A', borderTop: '1px solid #1E293B', color: '#94A3B8', width: '100%', flexShrink: 0 }}>
      <style>{`
        /* min() floor + min-width:0 on the items: without them a long address
           line sets a column's min-content width and the footer runs 1px past
           the viewport at 768px, which is enough for a scrollbar. */
        .gk-footer-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
          gap: 2.5rem;
        }
        .gk-footer-grid > * { min-width: 0; }
        .gk-footer-grid span, .gk-footer-grid p { overflow-wrap: anywhere; }
        @media (max-width: 640px) {
          .gk-footer-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1.5rem;
          }
          .gk-footer-brand { grid-column: 1 / -1; }
        }
      `}</style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <div className="gk-footer-grid">
          {/* Brand — spans full width on mobile */}
          <div className="gk-footer-brand">
            <div className="flex items-center gap-3 mb-6">
              {/* The logo is dark-on-white artwork, so on the dark footer it
                  sits in a white chip rather than disappearing into it. */}
              <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '0.5rem 0.7rem', display: 'inline-flex', alignItems: 'center' }}>
                {/* Footer sits below the fold on every page — lazy, async-decoded, and
                    sized so it cannot shift the footer as it arrives. */}
                <img src="/gkmotorslogo.png" alt="GK Motors" width={720} height={341}
                  loading="lazy" decoding="async"
                  style={{ height: 40, width: 'auto', objectFit: 'contain', display: 'block' }} />
              </div>
            </div>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.8, color: '#94A3B8', fontWeight: 500 }}>
              Professional car service and repair you can trust. Certified technicians, genuine parts and
              transparent pricing — with doorstep pickup and drop across our service network.
            </p>
            <div className="flex items-center gap-3 mt-4">
              {SOCIALS.map(({ icon: Icon, href, label }) => (
                <a key={label} href={href} aria-label={label}
                  {...(href.startsWith('http') ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                  style={{ width: 40, height: 40, borderRadius: '12px', background: '#1E293B', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', transition: 'all 0.3s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.color = 'white'; e.currentTarget.style.background = '#2563EB'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = '#1E293B'; }}>
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 style={{ color: 'white', fontWeight: 600, marginBottom: '1rem', fontSize: '1rem', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.1em' }}>Our Services</h4>
            {SERVICE_LINKS.map(([s, id]) => (
              <Link key={s} to={`/services?category=${id}`} style={{ display: 'block', color: '#94A3B8', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '0.5rem', transition: 'all 0.3s', fontWeight: 500 }}
                onMouseEnter={(e) => (e.target.style.color = '#93C5FD')}
                onMouseLeave={(e) => (e.target.style.color = '#94A3B8')}>
                {s}
              </Link>
            ))}
          </div>

          {/* Quick Links */}
          <div>
            <h4 style={{ color: 'white', fontWeight: 600, marginBottom: '1rem', fontSize: '1rem', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.1em' }}>Quick Links</h4>
            {QUICK_LINKS.map(([label, href]) => (
              <Link key={href} to={href} style={{ display: 'block', color: '#94A3B8', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '0.5rem', transition: 'all 0.3s', fontWeight: 500 }}
                onMouseEnter={(e) => (e.target.style.color = '#93C5FD')}
                onMouseLeave={(e) => (e.target.style.color = '#94A3B8')}>
                {label}
              </Link>
            ))}
          </div>

          {/* Contact */}
          <div>
            <h4 style={{ color: 'white', fontWeight: 600, marginBottom: '1rem', fontSize: '1rem', fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.1em' }}>Contact Us</h4>
            {LOCATIONS.map(({ icon: Icon, text }, idx) => (
              <div key={idx} className="flex items-start gap-2" style={{ marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: 500 }}>
                <Icon size={16} style={{ flexShrink: 0, color: '#60A5FA', marginTop: '0.15rem' }} />
                <span>{text}</span>
              </div>
            ))}
            <div style={{ marginTop: '2rem', padding: '1.2rem', background: '#1E293B', borderRadius: '12px', border: '1px solid #334155' }}>
              <p style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>24/7 ROADSIDE ASSISTANCE</p>
              <a href="tel:+919253625099" className="flex items-center gap-2" style={{ color: 'white', fontWeight: 950, fontSize: '1.25rem', textDecoration: 'none', fontFamily: "'Space Grotesk', sans-serif" }}>
                <Phone size={20} /> +91 9253625099
              </a>
            </div>
          </div>
        </div>

        {/* The "Car due for a service?" mini-CTA that used to sit here has
            been removed on request. Nothing actionable is lost: the contact
            column above still carries the 24/7 assistance number, and the nav
            bar's "Book Now" is on screen at every scroll position. (On the
            home page the full "Give Your Car The Care It Deserves" section
            also sits directly above this footer.)

            marginTop is 2.5rem rather than the 2rem it was: the strip used to
            supply that separation from the column grid, and without it the
            copyright rule sat too close to the last link. */}
        <div style={{ borderTop: '1px solid #1E293B', marginTop: '2.5rem', paddingTop: '1.25rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>© {new Date().getFullYear()} GK Motors · Avani Enterprises. All rights reserved.</p>
          <div className="flex items-center gap-4" style={{ fontSize: '0.83rem' }}>
            <Link to="/privacy" style={{ color: '#64748B', textDecoration: 'none', fontWeight: 600 }}>Privacy Policy</Link>
            <Link to="/terms" style={{ color: '#64748B', textDecoration: 'none', fontWeight: 600 }}>Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
