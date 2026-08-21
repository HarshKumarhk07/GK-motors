import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Wrench, Sparkles, Zap, PaintBucket, Droplets, CircleDot, Battery,
  Disc, Settings, Shield, Award, Car, CheckCircle, Clock, Star, Phone,
  Calendar, Users, MapPin
} from 'lucide-react';
import { getServiceCategories, getCategories } from '../api/serviceApi';
import { getFeaturedParts } from '../api/storeApi';
import PartCard from '../components/parts/PartCard';
import CategoryIcon from '../components/service/CategoryIcon';
import heroCar from '../assets/hero-gt3-silver.png';

/* ═══════════════════════════════════════════════════════════════════════════
   SERVICE CATEGORIES — fallback only
   The live list comes from GET /api/service-categories, so categories the admin
   adds show up here without a code change. This array is what renders before
   that request resolves (and if it fails), and it also supplies the lucide icon
   for the twelve built-in categories, which the API does not carry.
   Keyed by categoryId — the same join key the packages use.
   ═══════════════════════════════════════════════════════════════════════════ */
const HOME_FEATURED_CATEGORY_IDS = [1, 2, 3, 4, 5, 12];

const FALLBACK_CATEGORIES = [
  { id: 1,  slug: 'car-service',          label: 'Car Service',           icon: Wrench,     desc: 'Periodic maintenance & oil change',   fromPrice: 2999 },
  { id: 2,  slug: 'ac-service',           label: 'AC Service & Repair',   icon: Zap,        desc: 'AC gas refill, cooling check',        fromPrice: 1499 },
  { id: 3,  slug: 'batteries',            label: 'Batteries',             icon: Battery,    desc: 'Battery replacement & testing',       fromPrice: 299 },
  { id: 4,  slug: 'tyres-wheel-care',     label: 'Tyre & Wheel Care',     icon: CircleDot,  desc: 'Tyre rotation, alignment, balancing', fromPrice: 799 },
  { id: 5,  slug: 'denting-painting',     label: 'Denting & Painting',    icon: PaintBucket,desc: 'Dent removal & premium painting',    fromPrice: 2499 },
  { id: 12, slug: 'insurance-claims',     label: 'Insurance Claims',      icon: Shield,     desc: 'Insurance claim assistance',          fromPrice: 999 },
  { id: 6,  slug: 'detailing-service',    label: 'Detailing Service',     icon: Award,      desc: 'Interior & exterior deep cleaning',    fromPrice: 2999 },
  { id: 7,  slug: 'car-spa-cleaning',     label: 'Car Spa & Cleaning',    icon: Droplets,   desc: 'Washing, waxing & polishing',        fromPrice: 499 },
  { id: 8,  slug: 'car-inspections',      label: 'Car Inspection',        icon: CheckCircle,desc: 'Comprehensive vehicle checkup',      fromPrice: 999 },
  { id: 9,  slug: 'windshields-lights',   label: 'Windshield & Light',    icon: Sparkles,   desc: 'Glass repair & headlight restoration', fromPrice: 899 },
  { id: 10, slug: 'suspension-fitments',  label: 'Suspension & Fitments', icon: Settings,   desc: 'Suspension repair & accessories',     fromPrice: 799 },
  { id: 11, slug: 'clutch-body-parts',    label: 'Clutch & Body Parts',   icon: Disc,       desc: 'Clutch replacement & body repair',     fromPrice: 2499 },
];

const TRUST_INDICATORS = [
  { icon: Shield,      title: 'Certified Mechanics', desc: 'Factory-trained, background-verified technicians' },
  { icon: CheckCircle, title: 'Genuine Parts',       desc: 'OEM and OES parts with authenticity guaranteed' },
  { icon: Clock,       title: '12-Month Warranty',   desc: 'On every service and part we fit, no questions' },
  { icon: Phone,       title: '24/7 Support',        desc: 'Roadside assistance and helpline round the clock' },
];

const STATS = [
  { value: '10,000+', label: 'Cars Serviced',    icon: Car },
  { value: '4.8/5',   label: 'Customer Rating',  icon: Star },
  { value: '500+',    label: 'Expert Mechanics', icon: Users },
  { value: '12 Mo',   label: 'Service Warranty', icon: Shield },
];

const HOW_IT_WORKS = [
  { step: '01', icon: Wrench,   title: 'Pick a Service',    desc: 'Browse every service category with upfront, transparent pricing.' },
  { step: '02', icon: Calendar, title: 'Book Your Slot',    desc: 'Select a date, time and address that suits you.' },
  { step: '03', icon: MapPin,   title: 'Free Pickup',       desc: 'We collect your car from your doorstep at no cost.' },
  { step: '04', icon: CheckCircle, title: 'Service & Return',   desc: 'Track progress live and get your car back, ready to drive.' },
];

/**
 * Placeholder testimonials — replace with real, attributable customer reviews
 * before this counts as social proof.
 *
 * The avatars are illustrations in client/public/testimonials/, deliberately not
 * photographs: a stock photo of a real person attached to a review they never
 * wrote presents a stranger as a GK Motors customer.
 */
/**
 * How many service categories the home page shows before handing off to
 * /services. Twelve tiles at this card size is a wall, not a menu.
 */
const HOME_CATEGORY_COUNT = 6;

const TESTIMONIALS = [
  { name: 'Rahul Sharma',  role: 'BMW 3 Series Owner',     review: 'Booked a periodic service and the pickup arrived exactly on time. Detailed report on WhatsApp, transparent bill, no upselling. Genuinely professional.', color: '#1E3A8A', img: '/testimonials/rahul-sharma.jpg' },
  { name: 'Priya Patel',   role: 'Honda City Owner',       review: 'The doorstep car service is a life saver. Dedicated mechanic, genuine parts, and zero hassle. My car feels brand new again.', color: '#0F172A', img: '/testimonials/priya-patel.jpg' },
  { name: 'Aman Singh',    role: 'Mercedes C-Class Owner', review: 'Denting and painting came back looking factory fresh. They matched the metallic finish perfectly and delivered a day early.', color: '#1E3A8A', img: '/testimonials/aman-singh.jpg' },
  { name: 'Suresh Kumar',  role: 'Toyota Fortuner Owner',  review: 'AC stopped cooling right before a road trip. Got a same-day slot, gas recharge plus filter clean, sorted in three hours.', color: '#0F172A', img: '/testimonials/suresh-kumar.jpg' },
  { name: 'Anjali Mehta',  role: 'Audi A4 Owner',          review: 'Booked my 50k km service online. Pickup and drop were exactly on time. Very professional automotive experience end to end.', color: '#1E3A8A', img: '/testimonials/anjali-mehta.jpg' },
];

export default function Home() {
  const [packages, setPackages] = useState([]);
  const [serviceCategories, setServiceCategories] = useState(FALLBACK_CATEGORIES);
  const [parts, setParts] = useState([]);

  useEffect(() => {
    // Packages (for the "from" price) and the category list itself. The list is
    // admin-managed, so a newly created category has to appear here too — the
    // hardcoded array above is only the pre-load / offline fallback.
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

    // Spare parts strip. Falls back to nothing if the store is empty, so the
    // section simply does not render rather than showing an empty shelf.
    getFeaturedParts({ limit: 5 })
      .then(({ data }) => setParts((data.parts || []).slice(0, 5)))
      .catch((err) => console.error('[Home.getFeaturedParts]', err));

  }, []);

  // Show each category's cheapest live package as its "from" price.
  // Falls back to cat.fromPrice so cards always display clean pricing.
  const categories = serviceCategories.map((cat) => {
    const inCategory = packages.filter((p) => p.categoryId === cat.id);
    const image = cat.apiImage;
    const priced = inCategory.filter((p) => p.basePrice > 0);
    const cheapest = priced.length ? Math.min(...priced.map((p) => p.basePrice)) : (cat.fromPrice || 499);
    return { ...cat, image, price: `From ₹${Number(cheapest).toLocaleString('en-IN')}` };
  });

  // Featured 6 categories to show on the homepage: 1, 2, 3, 4, 5, 12 (Insurance Claims)
  const featuredCategories = HOME_FEATURED_CATEGORY_IDS.map((id) =>
    categories.find((c) => c.id === id)
  ).filter(Boolean);

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', width: '100%', maxWidth: '100%', overflowX: 'hidden', position: 'relative' }}>
      <style>{`
        /* ── Hero: ambient depth ─────────────────────────────────────────── */
        .gk-glow { position: absolute; pointer-events: none; border-radius: 50%; }
        .gk-glow-a {
          top: -25%; right: -12%; width: 720px; height: 720px;
          background: radial-gradient(circle, rgba(59,130,246,0.20) 0%, transparent 68%);
          animation: gk-drift 18s ease-in-out infinite;
        }
        .gk-glow-b {
          bottom: -30%; left: -12%; width: 560px; height: 560px;
          background: radial-gradient(circle, rgba(147,197,253,0.10) 0%, transparent 70%);
          animation: gk-drift 22s ease-in-out infinite reverse;
        }
        @keyframes gk-drift {
          0%,100% { transform: translate3d(0,0,0) scale(1); opacity: 1; }
          50%     { transform: translate3d(-26px,22px,0) scale(1.07); opacity: 0.78; }
        }
        /* Faint engineering grid — masked so it fades out before the edges. */
        .gk-grid-overlay {
          position: absolute; inset: 0; pointer-events: none; opacity: 0.5;
          background-image:
            linear-gradient(rgba(148,163,184,0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,0.055) 1px, transparent 1px);
          background-size: 62px 62px;
          -webkit-mask-image: radial-gradient(ellipse 75% 65% at 50% 42%, #000 35%, transparent 100%);
                  mask-image: radial-gradient(ellipse 75% 65% at 50% 42%, #000 35%, transparent 100%);
        }

        /* ── Entrance: one keyframe, staggered by class ──────────────────── */
        .gk-rise { opacity: 0; animation: gk-rise-in 0.72s cubic-bezier(0.22,0.8,0.28,1) forwards; }
        .gk-d1 { animation-delay: 0.05s; }
        .gk-d2 { animation-delay: 0.16s; }
        .gk-d3 { animation-delay: 0.27s; }
        .gk-d4 { animation-delay: 0.38s; }
        .gk-d5 { animation-delay: 0.52s; }
        @keyframes gk-rise-in {
          from { opacity: 0; transform: translate3d(0,20px,0); }
          to   { opacity: 1; transform: none; }
        }

        /* Sweep across the accent word, then rest. */
        .gk-shimmer {
          background: linear-gradient(100deg, #93C5FD 0%, #E0EDFF 42%, #93C5FD 76%);
          background-size: 220% 100%;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent; color: transparent;
          animation: gk-sweep 6.5s ease-in-out 1.1s infinite;
        }
        @keyframes gk-sweep {
          0%,72%,100% { background-position: 130% 0; }
          22%         { background-position: -30% 0; }
        }

        /* ── Hero car: slides in, then breathes ──────────────────────────── */
        .gk-car {
          opacity: 0;
          filter: drop-shadow(0 34px 58px rgba(0,0,0,0.6));
          animation:
            gk-car-in 1s cubic-bezier(0.2,0.75,0.3,1) 0.3s forwards,
            gk-float 7s ease-in-out 1.4s infinite;
        }
        @keyframes gk-car-in {
          from { opacity: 0; transform: translate3d(46px,0,0) scale(0.965); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes gk-float {
          0%,100% { transform: translate3d(0,0,0); }
          50%     { transform: translate3d(0,-11px,0); }
        }
        /* Soft pool of light the car sits on. */
        .gk-car-pad {
          position: absolute; width: 74%; height: 58%; border-radius: 50%;
          background: radial-gradient(ellipse, rgba(59,130,246,0.19) 0%, transparent 68%);
          filter: blur(26px);
          animation: gk-pulse 7s ease-in-out infinite;
        }
        @keyframes gk-pulse {
          0%,100% { opacity: 0.75; transform: scale(1); }
          50%     { opacity: 1;    transform: scale(1.06); }
        }

        .gk-cta-primary, .gk-cta-ghost { transition: transform .25s, box-shadow .25s, background .25s, border-color .25s; }
        .gk-cta-primary { box-shadow: 0 4px 20px rgba(0,0,0,0.28); }
        .gk-cta-primary:hover { transform: translateY(-4px); box-shadow: 0 12px 30px rgba(0,0,0,0.38); }
        .gk-cta-ghost:hover { border-color: #FFF; background: rgba(255,255,255,0.09); transform: translateY(-2px); }

        /* Motion is decoration here — hold the final frame for anyone who
           has asked their system to reduce it. */
        @media (prefers-reduced-motion: reduce) {
          .gk-rise, .gk-car { opacity: 1 !important; animation: none !important; transform: none !important; }
          .gk-glow-a, .gk-glow-b, .gk-car-pad { animation: none !important; }
          .gk-shimmer {
            animation: none !important; -webkit-text-fill-color: #93C5FD !important; color: #93C5FD !important;
          }
        }

        @media (max-width: 900px) {
          .gk-glow-a, .gk-glow-b { display: none !important; }
          .gk-svc-car, .gk-svc-streaks { display: none !important; }
        }

        @media (max-width: 768px) {
          .gk-hero { padding: 2.25rem 0 2.5rem !important; min-height: auto !important; display: block !important; overflow: hidden !important; width: 100% !important; max-width: 100% !important; }
          .gk-hero h1 { font-size: 1.75rem !important; }
          .gk-hero-sub { font-size: 0.85rem !important; }
          .gk-hero-img { display: none !important; }
          .gk-hero-grid { grid-template-columns: 1fr !important; gap: 1.75rem !important; width: 100% !important; }
          .gk-cta-row { flex-direction: column !important; align-items: stretch !important; gap: 0.75rem !important; }
          .gk-cta-row > a { justify-content: center !important; }
          .gk-trust-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 0.75rem !important; }
          .gk-section { padding: 2.25rem 0 !important; width: 100% !important; max-width: 100% !important; overflow: hidden !important; }
          .gk-section h2 { font-size: 1.65rem !important; }
          .gk-cat-grid { grid-template-columns: 1fr !important; gap: 0.9rem !important; width: 100% !important; }
          .gk-parts-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 0.75rem !important; }
          .gk-cat-card { padding: 1.25rem 1.15rem 1.15rem !important; border-radius: 16px !important; }
          .gk-steps-grid { grid-template-columns: 1fr !important; }
          .gk-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .testimonial-section { padding: 2.5rem 0 !important; width: 100% !important; max-width: 100% !important; overflow: hidden !important; }
          .testimonial-section h2 { font-size: 1.65rem !important; }
          .testimonial-track { gap: 2rem; padding: 1.5rem 0; }
        }
        /* ── Services: six roomy cards, three across ──────────────────────
           Twelve cards in a six-column grid left each one narrower than its
           own thumbnail deserved. The home page now shows the first six and
           sends people to /services for the rest. */
        .gk-cat-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 1.35rem; align-items: stretch;
        }
        .gk-cat-card {
          display: flex; flex-direction: column; height: 100%;
          background: #FFFFFF;
          border: 1px solid #E4EBF7; border-top: 3px solid #1D4ED8;
          border-radius: 18px; padding: 1.7rem 1.6rem 1.4rem;
          text-decoration: none;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
          transition: transform .28s cubic-bezier(.2,.8,.2,1), box-shadow .28s;
        }
        .gk-svc-all {
          display: inline-flex; align-items: center; gap: .5rem;
          margin: 2.1rem auto 0; padding: .85rem 1.9rem;
          background: #1D4ED8; color: #FFFFFF; border-radius: 10px;
          text-decoration: none; font-weight: 800; font-size: .88rem;
          letter-spacing: .02em; white-space: nowrap;
          box-shadow: 0 10px 24px rgba(29, 78, 216, .24);
          transition: transform .25s, box-shadow .25s;
        }
        .gk-svc-all:hover { transform: translateY(-3px); box-shadow: 0 16px 30px rgba(29,78,216,.3); }
        .gk-cat-card:hover { transform: translateY(-6px); box-shadow: 0 20px 38px rgba(37,99,235,0.16); }
        /* Pins the price row to the bottom so it lines up across a row whose
           cards have different amounts of description text. */
        .gk-cat-foot { display: flex; align-items: center; justify-content: space-between; margin-top: auto; }

        /* Decoration: diagonal light streaks behind the heading, fading left. */
        .gk-svc-streaks {
          position: absolute; top: -10%; right: -6%; width: 58%; height: 120%;
          pointer-events: none; opacity: 0.9;
          background: repeating-linear-gradient(115deg,
            rgba(255,255,255,0) 0px, rgba(255,255,255,0) 26px,
            rgba(255,255,255,0.85) 26px, rgba(255,255,255,0.85) 62px);
          -webkit-mask-image: linear-gradient(to left, #000 20%, transparent 95%);
          mask-image: linear-gradient(to left, #000 20%, transparent 95%);
        }
        .gk-svc-car {
          position: absolute; top: -14%; right: 1%; width: 430px;
          pointer-events: none; opacity: 0.20;
          filter: grayscale(1) brightness(1.55) contrast(0.55);
          -webkit-mask-image: linear-gradient(to bottom, #000 48%, transparent 86%);
          mask-image: linear-gradient(to bottom, #000 48%, transparent 86%);
        }

        @media (max-width: 1100px) { .gk-cat-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 900px)  { .gk-svc-car { width: 300px; opacity: 0.13; } }
        @media (max-width: 640px)  { .gk-svc-car, .gk-svc-streaks { display: none; } }
        @media (max-width: 520px)  {
          .gk-cat-grid { grid-template-columns: 1fr !important; }
          .gk-svc-all { width: 100%; justify-content: center; }
        }

      `}</style>

      {/* ════════════════════ HERO ════════════════════ */}
      <section
        className="gk-hero"
        style={{
          position: 'relative', overflow: 'hidden',
          background: '#131B31',
          padding: '4.5rem 0 3rem',
          minHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {/* Depth: a broad cool wash top-right, a cooler one bottom-left, and a
            fine grid — all behind the content and non-interactive. */}
        <div className="gk-glow gk-glow-a" />
        <div className="gk-glow gk-glow-b" />
        <div className="gk-grid-overlay" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ position: 'relative', zIndex: 2, width: '100%' }}>
          <div className="gk-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', alignItems: 'center', width: '100%' }}>
            {/* LEFT */}
            <div>
              <h1 className="gk-rise gk-d1" style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 'clamp(2.1rem, 4.8vw, 3.7rem)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.06, letterSpacing: '-0.02em', marginBottom: '1rem' }}>
                Professional Car<br />Service &amp; <span className="gk-shimmer">Repair</span>
              </h1>

              <p className="gk-hero-sub gk-rise gk-d2" style={{ color: '#94A3B8', fontSize: '0.95rem', fontWeight: 500, lineHeight: 1.7, maxWidth: '450px', marginBottom: '1.8rem' }}>
                Expert technicians, genuine parts, doorstep service. Book online in under two
                minutes and track your car every step of the way.
              </p>

              <div className="gk-cta-row gk-rise gk-d3" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '2rem' }}>
                <Link to="/services" className="gk-cta-primary"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                    background: '#FFFFFF', color: '#0F172A',
                    padding: '0.75rem 1.9rem', borderRadius: '8px', textDecoration: 'none',
                    fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: '0.85rem',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                  <Wrench size={16} /> Book Service Now
                </Link>

                <a href="#services" className="gk-cta-ghost"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                    background: 'transparent', color: '#FFFFFF',
                    padding: '0.75rem 1.9rem', borderRadius: '8px', textDecoration: 'none',
                    border: '1.5px solid rgba(255,255,255,0.2)',
                    fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: '0.85rem',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                  View Services <ArrowRight size={16} />
                </a>
              </div>

              {/* Trust indicators */}
              <div className="gk-trust-grid gk-rise gk-d4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                {TRUST_INDICATORS.map(({ icon: Icon, title }) => (
                  <div key={title} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '8px', background: 'rgba(147, 197, 253, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={13} style={{ color: '#93C5FD' }} />
                    </div>
                    <span style={{ color: '#E2E8F0', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.25 }}>{title}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — hero car */}
            <div className="gk-hero-img" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div className="gk-car-pad" />
              <img
                className="gk-car"
                src={heroCar}
                alt="Car undergoing professional service at GK Motors"
                style={{ width: '100%', maxWidth: '700px', objectFit: 'contain', position: 'relative', zIndex: 1 }}
              />
            </div>
          </div>

        </div>
      </section>

      {/* ════════════════════ SERVICE CATEGORIES ════════════════════ */}
      <section
        id="services"
        className="gk-section"
        style={{
          position: 'relative', overflow: 'hidden', padding: '3.5rem 0 4rem',
          background: 'linear-gradient(135deg, #EEF3FF 0%, #F5F8FF 42%, #FFFFFF 100%)',
        }}
      >
        {/* Decoration only — aria-hidden so a screen reader skips straight to
            the heading rather than announcing a stray image. */}
        <div className="gk-svc-streaks" aria-hidden="true" />
        <img className="gk-svc-car" src="/car.png" alt="" aria-hidden="true" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ position: 'relative' }}>
          <div style={{ marginBottom: '2.4rem' }}>
            <p style={{ color: '#2563EB', fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '0.55rem' }}>What We Do</p>
            <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.5rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.02, letterSpacing: '-0.01em', margin: 0 }}>
              Our <span style={{ color: '#2563EB' }}>Services</span>
            </h2>
            <p style={{ color: '#64748B', fontSize: '0.87rem', fontWeight: 500, lineHeight: 1.6, maxWidth: '390px', margin: '0.7rem 0 0' }}>
              Twelve categories covering everything your car needs — each with upfront pricing and free pickup and drop.
            </p>
            <div style={{ width: 56, height: 4, background: '#2563EB', margin: '1.1rem 0 0', borderRadius: '3px' }} />
          </div>

          <div className="gk-cat-grid">
            {featuredCategories.map(({ id, slug, label, icon: Icon, image, price, desc }) => (
              <Link key={id} to={`/services?category=${id}`} className="gk-cat-card">
                <div style={{ marginBottom: '1.1rem' }}>
                  <CategoryIcon slug={slug} image={image} icon={Icon} size={64} iconSize={30} />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.45rem', lineHeight: 1.25, letterSpacing: '-0.01em' }}>{label}</h3>
                <p style={{ color: '#64748B', fontSize: '0.87rem', lineHeight: 1.6, fontWeight: 500, margin: '0 0 1.35rem' }}>{desc}</p>
                <div className="gk-cat-foot">
                  <span style={{ color: price ? '#1D4ED8' : '#94A3B8', fontWeight: 800, fontSize: '0.95rem' }}>
                    {price || 'View packages'}
                  </span>
                  <span style={{
                    width: 34, height: 34, borderRadius: '50%', border: '1.5px solid #BFD4F7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <ArrowRight size={15} strokeWidth={2.4} style={{ color: '#2563EB' }} />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {categories.length > featuredCategories.length && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Link to="/services" className="gk-svc-all">
                View all {categories.length} services <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════ HOW IT WORKS ════════════════════ */}
      <section className="gk-section" style={{ background: '#FFFFFF', padding: '4rem 0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
            <p style={{ color: '#1E3A8A', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '0.7rem' }}>Simple Process</p>
            <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.2rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.05 }}>
              How It <span style={{ color: '#1E3A8A' }}>Works</span>
            </h2>
            <div style={{ width: 50, height: 3, background: '#1E3A8A', margin: '1.1rem auto 0', borderRadius: '2px' }} />
          </div>

          <div className="gk-steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '0.85rem' }}>
            {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc }) => (
              <div key={step} style={{ position: 'relative', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '1.3rem 1.1rem', overflow: 'hidden' }}>
                <span style={{ position: 'absolute', top: '0.35rem', right: '0.7rem', fontFamily: 'Rajdhani, sans-serif', fontSize: '2.6rem', fontWeight: 950, color: 'rgba(30, 58, 138, 0.06)', lineHeight: 1 }}>{step}</span>
                <div style={{ width: 40, height: 40, borderRadius: '11px', background: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem', position: 'relative' }}>
                  <Icon size={18} style={{ color: '#1E3A8A' }} />
                </div>
                <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1rem', fontWeight: 900, color: '#0F172A', marginBottom: '0.35rem' }}>{title}</h3>
                <p style={{ color: '#64748B', fontSize: '0.76rem', lineHeight: 1.55, fontWeight: 500 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ GENUINE SPARES ════════════════════ */}
      {parts.length > 0 && (
        <section className="gk-section" style={{ background: '#F8FAFC', padding: '4rem 0' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '2rem' }}>
              <div>
                <p style={{ color: '#1E3A8A', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '0.7rem' }}>GK Motors Spares</p>
                <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.2rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.05 }}>
                  Genuine <span style={{ color: '#1E3A8A' }}>Spares</span>
                </h2>
              </div>
              <Link to="/parts" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: '#1E3A8A', color: '#FFF', padding: '0.65rem 1.5rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 800, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                Shop All Parts <ArrowRight size={15} />
              </Link>
            </div>
            {/* Its own class: the services grid is pinned to six columns now,
                and five part cards should not inherit that. */}
            <div className="gk-parts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: '0.85rem' }}>
              {parts.map((part) => <PartCard key={part._id} part={part} />)}
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════ STATS ════════════════════ */}
      <section style={{ background: '#131B31', borderTop: '1px solid rgba(148,163,184,0.10)', borderBottom: '1px solid rgba(148,163,184,0.10)', padding: '2.75rem 0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="gk-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1.2rem' }}>
            {STATS.map(({ value, label, icon: Icon }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(147, 197, 253, 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.6rem' }}>
                  <Icon size={16} style={{ color: '#93C5FD' }} />
                </div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.75rem', fontWeight: 900, color: '#FFFFFF', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
                <div style={{ color: '#94A3B8', fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.35rem' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ WHY GK MOTORS ════════════════════ */}
      <section className="gk-section" style={{ background: '#FFFFFF', padding: '4rem 0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
            <p style={{ color: '#1E3A8A', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '0.7rem' }}>Why Us</p>
            <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.2rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.05 }}>
              Why <span style={{ color: '#1E3A8A' }}>GK Motors?</span>
            </h2>
            <div style={{ width: 50, height: 3, background: '#1E3A8A', margin: '1.1rem auto 0', borderRadius: '2px' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '0.85rem' }}>
            {TRUST_INDICATORS.map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '1.3rem 1.1rem', textAlign: 'center' }}>
                <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.8rem' }}>
                  <Icon size={19} style={{ color: '#FFFFFF' }} />
                </div>
                <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1rem', fontWeight: 900, color: '#0F172A', marginBottom: '0.4rem' }}>{title}</h3>
                <p style={{ color: '#64748B', fontSize: '0.76rem', lineHeight: 1.55, fontWeight: 500 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ TESTIMONIALS ════════════════════ */}
      <section className="testimonial-section" style={{ background: '#F8FAFC', padding: '4rem 0', overflow: 'hidden' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <p style={{ color: '#1E3A8A', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '0.7rem' }}>Testimonials</p>
            <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.2rem', fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>
              What Our <span style={{ color: '#1E3A8A' }}>Clients</span> Say
            </h2>
            <div style={{ width: 50, height: 3, background: '#1E3A8A', margin: '1.1rem auto 0', borderRadius: '2px' }} />
          </div>

          <style>{`
            .testimonial-track {
              display: flex;
              gap: 4rem;
              width: max-content;
              animation: slide-testimonials 35s linear infinite;
              padding: 2.5rem 0;
            }
            .testimonial-track:hover { animation-play-state: paused; }
            @keyframes slide-testimonials {
              0% { transform: translateX(0); }
              100% { transform: translateX(calc(-380px * 5 - 20rem)); }
            }
          `}</style>

          <div style={{ overflow: 'hidden', width: '100%', maxWidth: '100%', position: 'relative' }}>
            <div className="testimonial-track">
              {[...TESTIMONIALS, ...TESTIMONIALS.slice(0, 2)].map((item, i) => (
                <div key={i} style={{ position: 'relative', width: '380px', flexShrink: 0 }}>
                  <div style={{
                    position: 'absolute', left: '-45px', top: '50%', transform: 'translateY(-50%)',
                    width: '90px', height: '90px', borderRadius: '50%',
                    border: `4px solid ${item.color}`, overflow: 'hidden', background: '#fff',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)', zIndex: 2
                  }}>
                    <img src={item.img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={item.name} />
                  </div>
                  <div style={{
                    background: '#fff', padding: '2.5rem 2rem 2.5rem 3.5rem', borderRadius: '24px',
                    border: '1px solid #E2E8F0', boxShadow: '0 15px 35px rgba(0,0,0,0.05)', position: 'relative'
                  }}>
                    <div style={{ position: 'absolute', top: '15px', right: '25px', color: '#E2E8F0', fontSize: '4rem', fontFamily: 'serif', lineHeight: 1, opacity: 0.6 }}>"</div>
                    <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 800, fontSize: '1.4rem', color: '#0F172A', marginBottom: '0.2rem' }}>{item.name}</h3>
                    <p style={{ fontSize: '0.8rem', color: '#1E3A8A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.2rem' }}>{item.role}</p>
                    <div style={{ display: 'flex', gap: '2px', marginBottom: '1.2rem' }}>
                      {[...Array(5)].map((_, j) => <Star key={j} size={12} fill="#FFB400" color="#FFB400" />)}
                    </div>
                    <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: 1.6, fontStyle: 'italic' }}>"{item.review}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════ CTA BANNER ════════════════════ */}
      <section style={{ position: 'relative', background: '#131B31', padding: '3.5rem 0', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-40%', right: '5%', width: '480px', height: '480px', background: 'radial-gradient(circle, rgba(147,197,253,0.16) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.1, marginBottom: '0.8rem' }}>
            Your car deserves better care
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.9rem', fontWeight: 500, maxWidth: '520px', margin: '0 auto 1.6rem', lineHeight: 1.7 }}>
            Book a service in under two minutes. Free pickup and drop, transparent pricing,
            and a 12-month warranty on everything we touch.
          </p>
          <div className="gk-cta-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
            <Link
              to="/services"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                background: '#FFFFFF', color: '#0F172A', padding: '0.7rem 1.8rem',
                borderRadius: '8px', textDecoration: 'none', fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 900, fontSize: '0.85rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)', transition: 'all 0.25s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <Wrench size={16} /> Book Service Now
            </Link>
            <a
              href="tel:+919253625099"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                background: 'transparent', color: '#FFFFFF', padding: '0.7rem 1.8rem',
                borderRadius: '8px', textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.2)',
                fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: '0.85rem',
                letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'all 0.25s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FFFFFF'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <Phone size={16} /> Call Us
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
