import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Wrench } from 'lucide-react';
import { FaFacebook, FaInstagram, FaYoutube, FaTwitter } from 'react-icons/fa';

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

const LOCATIONS = [
  { icon: MapPin, text: 'GURGAON: Tower B, 3rd Floor, Unitech Cyber Park, Sector 39, 122002' },
  { icon: MapPin, text: 'MUMBAI: Third Floor, Vasudev Chamber, Teli Galli Cross Rd, Andheri East, 400069' },
  { icon: MapPin, text: 'ROHTAK: 106, First Floor, Agro Mall, Rohtak' },
  { icon: Phone, text: '+91 9253625099' },
  { icon: Mail, text: 'kp@avanienterprises.in' },
];

export default function Footer() {
  return (
    <footer style={{ background: '#0F172A', borderTop: '1px solid #1E293B', color: '#94A3B8' }}>
      <style>{`
        .gk-footer-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 2.5rem;
        }
        @media (max-width: 640px) {
          .gk-footer-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 1.5rem;
          }
          .gk-footer-brand { grid-column: 1 / -1; }
        }
      `}</style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="gk-footer-grid">
          {/* Brand — spans full width on mobile */}
          <div className="gk-footer-brand">
            <div className="flex items-center gap-3 mb-6">
              {/* The logo is dark-on-white artwork, so on the dark footer it
                  sits in a white chip rather than disappearing into it. */}
              <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '0.5rem 0.7rem', display: 'inline-flex', alignItems: 'center' }}>
                <img src="/gkmotorslogo.png" alt="GK Motors" style={{ height: 40, width: 'auto', objectFit: 'contain', display: 'block' }} />
              </div>
            </div>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.8, color: '#94A3B8', fontWeight: 500 }}>
              Professional car service and repair you can trust. Certified technicians, genuine parts and
              transparent pricing — with doorstep pickup and drop across our service network.
            </p>
            <div className="flex items-center gap-3 mt-4">
              {[FaFacebook, FaInstagram, FaYoutube, FaTwitter].map((Icon, i) => (
                <a key={i} href="#" style={{ width: 40, height: 40, borderRadius: '12px', background: '#1E293B', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', transition: 'all 0.3s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1E3A8A'; e.currentTarget.style.color = 'white'; e.currentTarget.style.background = '#1E3A8A'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = '#1E293B'; }}>
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 style={{ color: 'white', fontWeight: 600, marginBottom: '1rem', fontSize: '1rem', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Our Services</h4>
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
            <h4 style={{ color: 'white', fontWeight: 600, marginBottom: '1rem', fontSize: '1rem', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Quick Links</h4>
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
            <h4 style={{ color: 'white', fontWeight: 600, marginBottom: '1rem', fontSize: '1rem', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Contact Us</h4>
            {LOCATIONS.map(({ icon: Icon, text }, idx) => (
              <div key={idx} className="flex items-start gap-2" style={{ marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: 500 }}>
                <Icon size={16} style={{ flexShrink: 0, color: '#93C5FD', marginTop: '0.15rem' }} />
                <span>{text}</span>
              </div>
            ))}
            <div style={{ marginTop: '2rem', padding: '1.2rem', background: '#1E293B', borderRadius: '12px', border: '1px solid #334155' }}>
              <p style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>24/7 ROADSIDE ASSISTANCE</p>
              <a href="tel:+919253625099" className="flex items-center gap-2" style={{ color: 'white', fontWeight: 950, fontSize: '1.25rem', textDecoration: 'none', fontFamily: 'Rajdhani, sans-serif' }}>
                <Phone size={20} /> +91 9253625099
              </a>
            </div>
          </div>
        </div>

        {/* Book service strip */}
        <div style={{ marginTop: '2.5rem', padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, #1E3A8A 0%, #1E293B 100%)', borderRadius: '16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <p style={{ color: 'white', fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: '1.25rem', letterSpacing: '0.03em' }}>Car due for a service?</p>
            <p style={{ color: '#CBD5E1', fontSize: '0.9rem', fontWeight: 500 }}>Book online in under two minutes — free pickup and drop.</p>
          </div>
          <Link to="/services" className="flex items-center gap-2" style={{ background: 'white', color: '#0F172A', padding: '0.75rem 1.75rem', borderRadius: '12px', textDecoration: 'none', fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
            <Wrench size={16} /> Book Service
          </Link>
        </div>

        <div style={{ borderTop: '1px solid #1E293B', marginTop: '2.5rem', paddingTop: '1.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
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
