import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Wrench, Sparkles, Zap, PaintBucket, Droplets, CircleDot, Battery,
  Disc, Settings, Shield, Award, Car, CheckCircle, Clock, Star, Phone,
  Calendar, Users, MapPin, AlertCircle, RefreshCw
} from 'lucide-react';
import { getServiceCategories, getCategories } from '../api/serviceApi';
import { getFeaturedParts, getRecentParts } from '../api/storeApi';
import PartCard, { PartCardSkeleton } from '../components/parts/PartCard';
import ServiceCategoryGrid from '../components/service/ServiceCategoryGrid';
import heroCar from '../assets/hero-gt3-silver.png';

/* ═══════════════════════════════════════════════════════════════════════════
   SERVICE CATEGORIES — fallback only
   The live list comes from GET /api/service-categories, so categories the admin
   adds show up here without a code change. Keyed by categoryId.
   ═══════════════════════════════════════════════════════════════════════════ */
const FALLBACK_CATEGORIES = [
  { id: 1,  slug: 'car-service',          label: 'Car Service',           icon: Wrench,     desc: 'Periodic maintenance & oil change',   fromPrice: 2999 },
  { id: 2,  slug: 'ac-service',           label: 'AC Service & Repair',   icon: Zap,        desc: 'AC gas refill, cooling check',        fromPrice: 1499 },
  { id: 3,  slug: 'batteries',            label: 'Batteries',             icon: Battery,    desc: 'Battery replacement & testing',       fromPrice: 299 },
  { id: 4,  slug: 'tyres-wheel-care',     label: 'Tyre & Wheel Care',     icon: CircleDot,  desc: 'Tyre rotation, alignment, balancing', fromPrice: 799 },
  { id: 5,  slug: 'denting-painting',     label: 'Denting & Painting',    icon: PaintBucket,desc: 'Dent removal & premium painting',    fromPrice: 2499 },
  { id: 12, slug: 'insurance-claims',     label: 'Insurance Claims',     icon: Shield,     desc: 'Insurance claim assistance',          fromPrice: 999 },
  { id: 6,  slug: 'detailing-service',    label: 'Detailing Service',    icon: Award,      desc: 'Interior & exterior deep cleaning',    fromPrice: 2999 },
  { id: 7,  slug: 'car-spa-cleaning',     label: 'Car Spa & Cleaning',    icon: Droplets,   desc: 'Washing, waxing & polishing',        fromPrice: 499 },
  { id: 8,  slug: 'car-inspections',      label: 'Car Inspection',        icon: CheckCircle,desc: 'Comprehensive vehicle checkup',      fromPrice: 999 },
  { id: 9,  slug: 'windshields-lights',   label: 'Windshield & Light',    icon: Sparkles,   desc: 'Glass repair & headlight restoration', fromPrice: 899 },
  { id: 10, slug: 'suspension-fitments',  label: 'Suspension & Fitments', icon: Settings,   desc: 'Suspension repair & accessories',     fromPrice: 799 },
  { id: 11, slug: 'clutch-body-parts',    label: 'Clutch & Body Parts',   icon: Disc,       desc: 'Clutch replacement & body repair',     fromPrice: 2499 },
];

const TRUST_TAGS = [
  { icon: Shield,      title: 'Certified Mechanics' },
  { icon: CheckCircle, title: 'Genuine Parts' },
  { icon: Clock,       title: 'Affordable Pricing' },
];

const WHY_CHOOSE_US = [
  { icon: CheckCircle, title: '100% Genuine Parts',    desc: 'OEM & OES certified parts with guaranteed authenticity.' },
  { icon: Users,       title: 'Trained Technicians',    desc: 'Skilled, background-verified expert mechanics.' },
  { icon: MapPin,      title: 'Doorstep Service',       desc: 'Free doorstep pickup & drop across our network.' },
  { icon: Clock,       title: 'Transparent Pricing',    desc: 'Upfront fixed quotes with zero hidden charges.' },
  { icon: Shield,      title: '12-Month Warranty',      desc: 'Comprehensive service & parts warranty, no questions.' },
];

const STATS = [
  { value: '10,000+', label: 'Happy Customers',   icon: Car },
  { value: '4.8/5',   label: 'Customer Ratings', icon: Star },
  { value: '50+',     label: 'Expert Technicians',icon: Users },
  { value: '100%',    label: 'Genuine Parts',    icon: Shield },
];

const HOW_IT_WORKS = [
  { step: '01', icon: Wrench,     title: 'Pick a Service',    desc: 'Select a service category with upfront, transparent pricing.' },
  { step: '02', icon: Calendar,   title: 'Book Your Slot',    desc: 'Pick a convenient date, time and address that suits you.' },
  { step: '03', icon: MapPin,     title: 'We Pickup',         desc: 'We collect your car from your doorstep at no extra cost.' },
  { step: '04', icon: CheckCircle, title: 'Service & Return', desc: 'We service your car and deliver it back, ready to drive.' },
];

const HOME_CATEGORY_COUNT = 12;
const HOME_PART_COUNT = 5;

const TESTIMONIALS = [
  { name: 'Rohit Sharma',  role: 'BMW 3 Series Owner',     review: 'Excellent service! They picked up my car on time and delivered after service. Highly professional team.', color: '#1E3A8A', img: '/testimonials/rahul-sharma.jpg' },
  { name: 'Priya Mehta',   role: 'Honda City Owner',       review: 'AC service was done perfectly. My car is now cooling like new. Highly recommended!', color: '#0F172A', img: '/testimonials/priya-patel.jpg' },
  { name: 'Arun Verma',    role: 'Audi A4 Owner',          review: 'Genuine parts and transparent pricing. Finally found a service center I can trust.', color: '#1E3A8A', img: '/testimonials/aman-singh.jpg' },
  { name: 'Suresh Kumar',  role: 'Toyota Fortuner Owner',  review: 'Doorstep pickup and drop saved my day. Quick turn-around and great communication.', color: '#0F172A', img: '/testimonials/suresh-kumar.jpg' },
];

export default function Home() {
  const [packages, setPackages] = useState([]);
  const [serviceCategories, setServiceCategories] = useState(FALLBACK_CATEGORIES);
  const [parts, setParts] = useState([]);
  const [partsLoading, setPartsLoading] = useState(true);
  const [partsError, setPartsError] = useState(false);

  // Fetch service categories
  useEffect(() => {
    Promise.all([
      getServiceCategories(),
      getCategories().catch(() => ({ data: { categories: [] } })),
    ])
      .then(([pkgRes, catRes]) => {
        setPackages(pkgRes.data.categories || []);
        const live = catRes.data.categories || [];
        if (live.length) {
          setServiceCategories(
            live.map((c) => {
              const known = FALLBACK_CATEGORIES.find((f) => f.id === c.categoryId);
              return {
                id: c.categoryId,
                slug: c.slug || known?.slug,
                label: c.name || known?.label,
                desc: c.description || known?.desc || '',
                icon: known?.icon || Wrench,
                apiImage: c.image || null,
              };
            })
          );
        }
      })
      .catch((err) => console.error('[Home.getServiceCategories]', err));
  }, []);

  // Fetch parts independently (non-blocking for the rest of the homepage)
  const fetchParts = () => {
    setPartsLoading(true);
    setPartsError(false);
    getFeaturedParts()
      .then(({ data }) => {
        const featured = data.parts || [];
        if (featured.length >= HOME_PART_COUNT) return featured;
        return getRecentParts({ limit: HOME_PART_COUNT })
          .then((res) => {
            const merged = [...featured];
            (res.data.parts || []).forEach((p) => {
              if (!merged.some((f) => f._id === p._id)) merged.push(p);
            });
            return merged;
          })
          .catch(() => featured);
      })
      .then((list) => {
        setParts(list.slice(0, HOME_PART_COUNT));
      })
      .catch((err) => {
        console.error('[Home.loadShopStrip]', err);
        setPartsError(true);
      })
      .finally(() => {
        setPartsLoading(false);
      });
  };

  useEffect(() => {
    fetchParts();
  }, []);

  // Compute category "from" price
  const categories = serviceCategories.map((cat) => {
    const inCategory = packages.filter((p) => p.categoryId === cat.id);
    const image = cat.apiImage;
    const priced = inCategory.filter((p) => p.basePrice > 0);
    const cheapest = priced.length ? Math.min(...priced.map((p) => p.basePrice)) : (cat.fromPrice || 499);
    return { ...cat, image, price: `From ₹${Number(cheapest).toLocaleString('en-IN')}` };
  });

  const shownCount = Math.min(categories.length, HOME_CATEGORY_COUNT);

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', width: '100%', maxWidth: '100%', position: 'relative' }}>
      <style>{`
        /* ── Hero & Automotive Styling ─────────────────────────────────────── */
        .gk-glow { position: absolute; pointer-events: none; border-radius: 50%; }
        .gk-glow-a {
          top: -25%; right: -12%; width: 720px; height: 720px;
          background: radial-gradient(circle, rgba(37,99,235,0.22) 0%, transparent 68%);
          animation: gk-drift 18s ease-in-out infinite;
        }
        .gk-glow-b {
          bottom: -30%; left: -12%; width: 560px; height: 560px;
          background: radial-gradient(circle, rgba(147,197,253,0.12) 0%, transparent 70%);
          animation: gk-drift 22s ease-in-out infinite reverse;
        }
        @keyframes gk-drift {
          0%,100% { transform: translate3d(0,0,0) scale(1); opacity: 1; }
          50%     { transform: translate3d(-26px,22px,0) scale(1.07); opacity: 0.78; }
        }
        .gk-grid-overlay {
          position: absolute; inset: 0; pointer-events: none; opacity: 0.45;
          background-image:
            linear-gradient(rgba(148,163,184,0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,0.055) 1px, transparent 1px);
          background-size: 62px 62px;
          -webkit-mask-image: radial-gradient(ellipse 75% 65% at 50% 42%, #000 35%, transparent 100%);
                  mask-image: radial-gradient(ellipse 75% 65% at 50% 42%, #000 35%, transparent 100%);
        }

        /* Hero Text Shimmer */
        .gk-shimmer {
          background: linear-gradient(100deg, #60A5FA 0%, #E0EDFF 45%, #3B82F6 80%);
          background-size: 220% 100%;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent; color: transparent;
          animation: gk-sweep 6.5s ease-in-out infinite;
        }
        @keyframes gk-sweep {
          0%,72%,100% { background-position: 130% 0; }
          22%         { background-position: -30% 0; }
        }

        /* Hero Car Animation */
        .gk-car {
          opacity: 0;
          filter: drop-shadow(0 30px 50px rgba(0,0,0,0.55));
          animation:
            gk-car-in 1s cubic-bezier(0.2,0.75,0.3,1) 0.2s forwards,
            gk-float 7s ease-in-out 1.2s infinite;
        }
        @keyframes gk-car-in {
          from { opacity: 0; transform: translate3d(40px,0,0) scale(0.97); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes gk-float {
          0%,100% { transform: translate3d(0,0,0); }
          50%     { transform: translate3d(0,-10px,0); }
        }

        /* Booking Card responsive layout */
        .gk-booking-card {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 18px;
          box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
          padding: 1.5rem 2rem;
          margin-top: -2.5rem;
          position: relative;
          z-index: 10;
        }

        .gk-parts-grid {
          display: grid; width: 100%;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr));
          gap: 1.1rem; align-items: stretch;
        }
        @media (max-width: 640px) {
          .gk-parts-grid { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
        }

        .gk-svc-all {
          display: inline-flex; align-items: center; gap: .5rem;
          margin: 2.2rem auto 0; padding: .85rem 2rem;
          background: #1D4ED8; color: #FFFFFF; border-radius: 999px;
          text-decoration: none; font-weight: 800; font-size: .88rem;
          letter-spacing: .02em; white-space: nowrap;
          box-shadow: 0 10px 24px rgba(29, 78, 216, .24);
          transition: transform .25s, box-shadow .25s;
        }
        .gk-svc-all:hover { transform: translateY(-3px); box-shadow: 0 16px 30px rgba(29,78,216,.32); }

        .gk-shop-all {
          display: inline-flex; align-items: center; gap: .45rem;
          background: #1E3A8A; color: #FFFFFF; padding: .65rem 1.4rem; min-height: 42px;
          border-radius: 10px; text-decoration: none; font-weight: 800; font-size: .82rem;
          white-space: nowrap; box-shadow: 0 8px 20px rgba(30,58,138,.22);
          transition: transform .2s, box-shadow .2s;
        }
        .gk-shop-all:hover { transform: translateY(-2px); box-shadow: 0 14px 26px rgba(30,58,138,.28); }

        @media (max-width: 900px) {
          .gk-hero-img { display: none !important; }
        }

        @media (max-width: 768px) {
          .gk-hero { padding: 3rem 0 3.5rem !important; min-height: auto !important; }
          .gk-hero h1 { font-size: 2rem !important; }
          .gk-booking-card { margin-top: 1.5rem !important; padding: 1.25rem !important; }
          .gk-parts-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 0.75rem !important; }
        }

        @media (max-width: 375px) {
          .gk-parts-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ════════════════════ 1. HERO SECTION ════════════════════ */}
      <section
        className="gk-hero"
        style={{
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(180deg, #0F172A 0%, #131B31 100%)',
          padding: '4.5rem 0 5.5rem',
          minHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div className="gk-glow gk-glow-a" />
        <div className="gk-glow gk-glow-b" />
        <div className="gk-grid-overlay" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ position: 'relative', zIndex: 2, width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '2.5rem', alignItems: 'center', width: '100%' }}>
            {/* LEFT TEXT CONTENT */}
            <div>
              <p style={{ color: '#93C5FD', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.8rem' }}>
                PREMIUM CAR CARE
              </p>

              <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.08, letterSpacing: '-0.02em', marginBottom: '1.1rem' }}>
                Professional<br />
                <span className="gk-shimmer">Car Service &amp; Repair</span>
              </h1>

              <p style={{ color: '#94A3B8', fontSize: '0.96rem', fontWeight: 500, lineHeight: 1.7, maxWidth: '480px', marginBottom: '2rem' }}>
                Expert technicians, genuine parts, doorstep service. We ensure a safe ride for you
                and your loved ones. Book online in under 2 minutes.
              </p>

              {/* CTAs */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', marginBottom: '2.2rem' }}>
                <Link
                  to="/services"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                    background: '#2563EB', color: '#FFFFFF',
                    padding: '0.85rem 2.1rem', borderRadius: '10px', textDecoration: 'none',
                    fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: '0.9rem',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)', transition: 'all 0.25s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.background = '#1D4ED8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = '#2563EB'; }}
                >
                  <Wrench size={16} /> Book Service Now
                </Link>

                <a
                  href="#services"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                    background: 'rgba(255,255,255,0.05)', color: '#FFFFFF',
                    padding: '0.85rem 2.1rem', borderRadius: '10px', textDecoration: 'none',
                    border: '1.5px solid rgba(255,255,255,0.25)',
                    fontFamily: 'Rajdhani, sans-serif', fontWeight: 800, fontSize: '0.9rem',
                    letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'all 0.25s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FFFFFF'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                >
                  View All Services <ArrowRight size={16} />
                </a>
              </div>

              {/* Trust Tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.2rem', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                {TRUST_TAGS.map(({ icon: Icon, title }) => (
                  <div key={title} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '6px', background: 'rgba(147, 197, 253, 0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={13} style={{ color: '#93C5FD' }} />
                    </div>
                    <span style={{ color: '#E2E8F0', fontSize: '0.78rem', fontWeight: 700 }}>{title}</span>
                  </div>
                ))}
              </div>

              {/* Social Proof */}
              <div style={{ marginTop: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600 }}>Trusted by 10,000+ Car Owners</span>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                  {[...Array(5)].map((_, i) => <Star key={i} size={13} fill="#F59E0B" color="#F59E0B" />)}
                  <span style={{ color: '#FFFFFF', fontSize: '0.8rem', fontWeight: 800, marginLeft: '0.3rem' }}>4.8/5 Rating</span>
                </div>
              </div>
            </div>

            {/* RIGHT — GT3 HERO CAR */}
            <div className="gk-hero-img" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ position: 'absolute', width: '80%', height: '60%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(37,99,235,0.24) 0%, transparent 70%)', filter: 'blur(30px)' }} />
              <img
                className="gk-car"
                src={heroCar}
                alt="Car undergoing professional service at GK Motors"
                style={{ width: '100%', maxWidth: '680px', objectFit: 'contain', position: 'relative', zIndex: 1 }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════ 2. BOOKING STEPS BAR ════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="gk-booking-card">
          <div style={{ marginBottom: '1.2rem' }}>
            <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
              Book Your Service in 3 Easy Steps
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', alignItems: 'center' }}>
            {/* Step 1 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Wrench size={20} style={{ color: '#2563EB' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#2563EB', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>STEP 1</div>
                <div style={{ fontSize: '0.9rem', color: '#0F172A', fontWeight: 800 }}>Select Service</div>
                <div style={{ fontSize: '0.76rem', color: '#64748B' }}>Choose your service</div>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Calendar size={20} style={{ color: '#2563EB' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#2563EB', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>STEP 2</div>
                <div style={{ fontSize: '0.9rem', color: '#0F172A', fontWeight: 800 }}>Select Date &amp; Time</div>
                <div style={{ fontSize: '0.76rem', color: '#64748B' }}>Pick convenient slot</div>
              </div>
            </div>

            {/* Step 3 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircle size={20} style={{ color: '#2563EB' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#2563EB', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>STEP 3</div>
                <div style={{ fontSize: '0.9rem', color: '#0F172A', fontWeight: 800 }}>Confirm Booking</div>
                <div style={{ fontSize: '0.76rem', color: '#64748B' }}>We'll take care of the rest</div>
              </div>
            </div>

            {/* CTA */}
            <div>
              <Link
                to="/services"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  background: '#2563EB', color: '#FFFFFF', padding: '0.9rem 1.4rem', borderRadius: '12px',
                  textDecoration: 'none', fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: '0.88rem',
                  letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                  boxShadow: '0 6px 18px rgba(37, 99, 235, 0.3)'
                }}
              >
                Book Service Now <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════ 3. SERVICES SECTION ════════════════════ */}
      <section
        id="services"
        style={{ position: 'relative', overflow: 'hidden', padding: '4rem 0 4.5rem', background: '#FFFFFF' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p style={{ color: '#2563EB', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '0.55rem' }}>
              WHAT WE OFFER
            </p>
            <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.5rem', fontWeight: 900, color: '#0F172A', lineHeight: 1, margin: 0 }}>
              Our <span style={{ color: '#2563EB' }}>Services</span>
            </h2>
            <p style={{ color: '#64748B', fontSize: '0.9rem', fontWeight: 500, lineHeight: 1.6, maxWidth: '480px', margin: '0.7rem auto 0' }}>
              Tailored car care solutions — everything your car needs with upfront pricing and doorstep pickup.
            </p>
            <div style={{ width: 56, height: 4, background: '#2563EB', margin: '1.1rem auto 0', borderRadius: '3px' }} />
          </div>

          {/* Strict Equal-Sized Cards Grid */}
          <ServiceCategoryGrid categories={categories} limit={HOME_CATEGORY_COUNT} />

          {categories.length > shownCount && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Link to="/services" className="gk-svc-all">
                View All Services <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════ 4. SHOP CAR ESSENTIALS (moved here, after Services) ════════════════════ */}
      <section style={{ background: '#F8FAFC', padding: '4rem 0', borderTop: '1px solid #E2E8F0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '2rem' }}>
            <div>
              <p style={{ color: '#1E3A8A', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '0.55rem' }}>
                GENUINE SPARES
              </p>
              <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.3rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Shop Car <span style={{ color: '#1E3A8A' }}>Essentials</span>
              </h2>
              <p style={{ color: '#64748B', fontSize: '0.88rem', fontWeight: 500, margin: '0.4rem 0 0', maxWidth: '440px' }}>
                Genuine oils, filters, batteries and accessories — delivered or fitted during your service.
              </p>
            </div>
            <Link to="/parts" className="gk-shop-all">
              View All Products <ArrowRight size={15} />
            </Link>
          </div>

          {/* Loading State: 5 Skeleton cards */}
          {partsLoading ? (
            <div className="gk-parts-grid">
              {[...Array(HOME_PART_COUNT)].map((_, i) => (
                <PartCardSkeleton key={i} />
              ))}
            </div>
          ) : partsError ? (
            /* Error State */
            <div style={{ background: '#FFF', border: '1px solid #FEE2E2', borderRadius: '16px', padding: '2.5rem', textAlign: 'center' }}>
              <AlertCircle size={36} style={{ color: '#EF4444', margin: '0 auto 0.75rem' }} />
              <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Unable to load products</h3>
              <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '0.4rem 0 1.2rem' }}>Something went wrong while fetching car essentials.</p>
              <button
                onClick={fetchParts}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                  background: '#1E3A8A', color: 'white', border: 'none', borderRadius: '8px',
                  padding: '0.6rem 1.4rem', cursor: 'pointer', fontWeight: 800, fontSize: '0.82rem',
                  fontFamily: 'Rajdhani, sans-serif'
                }}
              >
                <RefreshCw size={14} /> Try Again
              </button>
            </div>
          ) : parts.length === 0 ? (
            /* Empty State */
            <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '2.5rem', textAlign: 'center' }}>
              <p style={{ fontSize: '2.5rem', margin: '0 0 0.5rem' }}>📦</p>
              <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>No products available</h3>
              <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '0.4rem 0 1.2rem' }}>Check back soon for new genuine car spares and accessories.</p>
              <Link to="/parts" className="gk-shop-all" style={{ margin: '0 auto' }}>
                View All Products <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            /* Success State */
            <div className="gk-parts-grid">
              {parts.map((part) => (
                <PartCard key={part._id} part={part} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════ 5. WHY CHOOSE GK MOTORS ════════════════════ */}
      <section style={{ background: '#F8FAFC', padding: '4rem 0', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p style={{ color: '#2563EB', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '0.55rem' }}>
              WHY CHOOSE US
            </p>
            <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.3rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
              Why Choose <span style={{ color: '#2563EB' }}>GK Motors?</span>
            </h2>
            <div style={{ width: 52, height: 3, background: '#2563EB', margin: '1.1rem auto 0', borderRadius: '2px' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.1rem' }}>
            {WHY_CHOOSE_US.map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.5rem 1.25rem', textAlign: 'center', boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)' }}>
                <div style={{ width: 46, height: 46, borderRadius: '14px', background: 'linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.9rem', boxShadow: '0 6px 16px rgba(37, 99, 235, 0.25)' }}>
                  <Icon size={21} style={{ color: '#FFFFFF' }} />
                </div>
                <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', marginBottom: '0.45rem' }}>{title}</h3>
                <p style={{ color: '#64748B', fontSize: '0.78rem', lineHeight: 1.55, fontWeight: 500, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ 6. HOW IT WORKS ════════════════════ */}
      <section id="how-it-works" style={{ background: '#FFFFFF', padding: '4.5rem 0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p style={{ color: '#2563EB', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '0.55rem' }}>
              SIMPLE PROCESS
            </p>
            <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.3rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
              How It <span style={{ color: '#2563EB' }}>Works</span>
            </h2>
            <div style={{ width: 50, height: 3, background: '#2563EB', margin: '1.1rem auto 0', borderRadius: '2px' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.1rem' }}>
            {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc }) => (
              <div key={step} style={{ position: 'relative', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.5rem 1.25rem', overflow: 'hidden' }}>
                <span style={{ position: 'absolute', top: '0.3rem', right: '0.8rem', fontFamily: 'Rajdhani, sans-serif', fontSize: '2.8rem', fontWeight: 950, color: 'rgba(37, 99, 235, 0.08)', lineHeight: 1 }}>{step}</span>
                <div style={{ width: 44, height: 44, borderRadius: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.9rem', position: 'relative' }}>
                  <Icon size={20} style={{ color: '#2563EB' }} />
                </div>
                <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', marginBottom: '0.4rem' }}>{title}</h3>
                <p style={{ color: '#64748B', fontSize: '0.78rem', lineHeight: 1.55, fontWeight: 500, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ 7. STATS & TRUST SECTION ════════════════════ */}
      <section style={{ background: 'linear-gradient(180deg, #0F172A 0%, #131B31 100%)', borderTop: '1px solid rgba(148,163,184,0.12)', borderBottom: '1px solid rgba(148,163,184,0.12)', padding: '3rem 0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1.5rem' }}>
            {STATS.map(({ value, label, icon: Icon }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'rgba(147, 197, 253, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                  <Icon size={18} style={{ color: '#93C5FD' }} />
                </div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.9rem', fontWeight: 900, color: '#FFFFFF', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
                <div style={{ color: '#94A3B8', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.4rem' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ 8. TESTIMONIALS ════════════════════ */}
      <section style={{ background: '#FFFFFF', padding: '4.5rem 0', overflow: 'hidden' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p style={{ color: '#2563EB', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '0.55rem' }}>
              WHAT OUR CUSTOMERS SAY
            </p>
            <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.3rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
              Trusted by <span style={{ color: '#2563EB' }}>Thousands</span>
            </h2>
            <div style={{ width: 50, height: 3, background: '#2563EB', margin: '1.1rem auto 0', borderRadius: '2px' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
            {TESTIMONIALS.map((item, i) => (
              <div
                key={i}
                style={{
                  background: '#F8FAFC', padding: '1.75rem 1.5rem', borderRadius: '18px',
                  border: '1px solid #E2E8F0', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.03)',
                  display: 'flex', flexDirection: 'column', position: 'relative'
                }}
              >
                <div style={{ color: '#CBD5E1', fontSize: '3rem', fontFamily: 'serif', lineHeight: 0.8, marginBottom: '0.4rem' }}>"</div>
                <p style={{ color: '#334155', fontSize: '0.88rem', lineHeight: 1.6, fontStyle: 'italic', flex: 1, marginBottom: '1.2rem' }}>
                  "{item.review}"
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
                  <img src={item.img} alt={item.name} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${item.color}` }} />
                  <div>
                    <h4 style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 800, fontSize: '1rem', color: '#0F172A', margin: 0 }}>{item.name}</h4>
                    <p style={{ fontSize: '0.72rem', color: '#2563EB', fontWeight: 700, margin: '2px 0 0' }}>{item.role}</p>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
                    {[...Array(5)].map((_, j) => <Star key={j} size={11} fill="#F59E0B" color="#F59E0B" />)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ 9. FINAL CTA BANNER ════════════════════ */}
      <section style={{ position: 'relative', background: 'linear-gradient(180deg, #0F172A 0%, #131B31 100%)', padding: '4rem 0', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-40%', right: '5%', width: '480px', height: '480px', background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 'clamp(1.8rem, 4.5vw, 2.7rem)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.1, marginBottom: '0.8rem' }}>
            Give Your Car The Care It Deserves
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.92rem', fontWeight: 500, maxWidth: '540px', margin: '0 auto 1.8rem', lineHeight: 1.7 }}>
            Book your service today and experience hassle-free car care at your doorstep. Transparent pricing, genuine parts, and a 12-month warranty.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
            <Link
              to="/services"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                background: '#2563EB', color: '#FFFFFF', padding: '0.8rem 2rem',
                borderRadius: '10px', textDecoration: 'none', fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 900, fontSize: '0.88rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)', transition: 'all 0.25s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.background = '#1D4ED8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = '#2563EB'; }}
            >
              <Wrench size={16} /> Book Service Now <ArrowRight size={16} />
            </Link>

            <a
              href="tel:+919253625099"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                background: 'rgba(255,255,255,0.06)', color: '#FFFFFF', padding: '0.8rem 2rem',
                borderRadius: '10px', textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.25)',
                fontFamily: 'Rajdhani, sans-serif', fontWeight: 800, fontSize: '0.88rem',
                letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'all 0.25s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FFFFFF'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            >
              <Phone size={16} /> Call Us: +91 92536 25099
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
