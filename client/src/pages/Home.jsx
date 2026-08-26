import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Wrench, Sparkles, Zap, PaintBucket, Droplets, CircleDot, Battery,
  Disc, Settings, Shield, Award, Car, CheckCircle, Clock, Star, Phone,
  Calendar, Users, MapPin, AlertCircle, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import { getServiceCategories, getCategories } from '../api/serviceApi';
import { getFeaturedParts, getRecentParts } from '../api/storeApi';
import PartCard, { PartCardSkeleton } from '../components/parts/PartCard';
import ServiceCategoryGrid from '../components/service/ServiceCategoryGrid';
import SectionBoundary from '../components/common/SectionBoundary';
// WebP of the same 554x241 artwork with its alpha preserved exactly: 192 KB of
// PNG for a photographic image became 29 KB. The .png is left in place as a
// rollback, unreferenced, so Vite does not bundle it.
import heroCar from '../assets/hero-gt3-silver.webp';

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

/* The card above the services grid. Deliberately three entries to match its
   heading — HOW_IT_WORKS below is the four-step version further down the page
   and the two are not interchangeable. */
const BOOKING_STEPS = [
  { icon: Wrench,      title: 'Select Service',     desc: 'Choose your service' },
  { icon: Calendar,    title: 'Select Date & Time', desc: 'Pick convenient slot' },
  { icon: CheckCircle, title: 'Confirm Booking',    desc: "We'll take care of the rest" },
];

const HOW_IT_WORKS = [
  { step: '01', icon: Wrench,     title: 'Pick a Service',    desc: 'Select a service category with upfront, transparent pricing.' },
  { step: '02', icon: Calendar,   title: 'Book Your Slot',    desc: 'Pick a convenient date, time and address that suits you.' },
  { step: '03', icon: MapPin,     title: 'We Pickup',         desc: 'We collect your car from your doorstep at no extra cost.' },
  { step: '04', icon: CheckCircle, title: 'Service & Return', desc: 'We service your car and deliver it back, ready to drive.' },
];

/* Primary cards shown before the grid is expanded: the four featured
   services plus the first four of the compact tier. "Show More" reveals the
   remainder in place; "View All Services" is a separate control that leaves
   the page for /services. */
const HOME_CATEGORY_COUNT = 8;
const HOME_PART_COUNT = 5;

const TESTIMONIALS = [
  { name: 'Rohit Sharma',  role: 'BMW 3 Series Owner',     review: 'Excellent service! They picked up my car on time and delivered after service. Highly professional team.', color: '#2563EB', img: '/testimonials/rahul-sharma.jpg' },
  { name: 'Priya Mehta',   role: 'Honda City Owner',       review: 'AC service was done perfectly. My car is now cooling like new. Highly recommended!', color: '#0F172A', img: '/testimonials/priya-patel.jpg' },
  { name: 'Arun Verma',    role: 'Audi A4 Owner',          review: 'Genuine parts and transparent pricing. Finally found a service center I can trust.', color: '#2563EB', img: '/testimonials/aman-singh.jpg' },
  { name: 'Suresh Kumar',  role: 'Toyota Fortuner Owner',  review: 'Doorstep pickup and drop saved my day. Quick turn-around and great communication.', color: '#0F172A', img: '/testimonials/suresh-kumar.jpg' },
];

export default function Home() {
  const [packages, setPackages] = useState([]);
  const [serviceCategories, setServiceCategories] = useState(FALLBACK_CATEGORIES);
  const [parts, setParts] = useState([]);
  /* Expand-in-place for the services grid. Deliberately not a route change and
     not a separate list: the same <ServiceCategoryGrid> simply stops being
     limited, so the featured 2x2 block above stays put and only the compact
     tier below it grows. */
  const [servicesExpanded, setServicesExpanded] = useState(false);
  const [partsLoading, setPartsLoading] = useState(true);
  const [partsError, setPartsError] = useState(false);

  /* ── Service categories ─────────────────────────────────────────────────
     One request on the normal path, not two.

     This used to Promise.all over BOTH /services/categories (a flat package
     list, used only to work out each category's cheapest price) and
     /service-categories (the admin-managed taxonomy). The second already
     returns every category *with* its packages attached — see
     serviceCategoryController.getServiceCategories — so on the happy path the
     first request was pure duplication: the same package documents fetched
     twice, on the landing page's critical path.

     The old arrangement also had a real fault. Promise.all rejects as a whole,
     and only /service-categories carried its own .catch — so if
     /services/categories failed, the successful taxonomy response was thrown
     away with it and the page fell all the way back to hardcoded categories.

     The degraded path is deliberately preserved, not dropped: if the taxonomy
     request fails or returns nothing, the flat package endpoint is still
     called, so live prices continue to appear against the hardcoded fallback
     category list exactly as they did before. Two requests then — but only
     then. */
  useEffect(() => {
    let cancelled = false;

    getCategories()
      .then(({ data }) => {
        const live = data.categories || [];
        if (!live.length) return false;
        if (cancelled) return true;

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

        // Prices come from the packages already embedded in this response.
        // Only `categoryId` and `basePrice` are read (see the `categories`
        // memo below), and both are present on these documents.
        setPackages(live.flatMap((c) => c.packages || []));
        return true;
      })
      .catch((err) => {
        console.error('[Home.getCategories]', err);
        return false;
      })
      .then((served) => {
        if (served || cancelled) return undefined;
        // Degraded path only.
        return getServiceCategories()
          .then(({ data }) => { if (!cancelled) setPackages(data.categories || []); })
          .catch((err) => console.error('[Home.getServiceCategories fallback]', err));
      });

    return () => { cancelled = true; };
  }, []);

  // Fetch parts independently (non-blocking for the rest of the homepage).
  // useCallback with no dependencies: it only ever calls setState, so one
  // stable identity is correct — and it lets the effect below declare it as a
  // dependency honestly instead of relying on an empty array.
  const fetchParts = useCallback(() => {
    setPartsLoading(true);
    setPartsError(false);
    // Only HOME_PART_COUNT cards are rendered, so only that many are asked
    // for. This endpoint was previously unbounded and returned every featured
    // part in the catalogue, with the client throwing all but five away.
    getFeaturedParts({ limit: HOME_PART_COUNT })
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
  }, []);

  /* ── Defer the shop strip's requests until it is nearly in view ──────────
     The parts strip is the fourth section down — roughly two screens below
     the fold on a phone — yet its one-or-two requests used to fire in the
     same burst as everything else the page needs at first paint, competing
     for connections with content the visitor can actually see.

     A single IntersectionObserver on the section, disconnected the moment it
     fires, with 600px of rootMargin so the fetch still starts well before the
     strip scrolls into view. Deliberately NOT a scroll listener and not one
     observer per card — Phase 2B's whole point was to keep the scroll path
     free of per-frame work, and this adds none.

     `partsLoading` still starts true, so the skeletons render exactly as
     before; only the moment the request leaves changes. Browsers without
     IntersectionObserver, and the case where the node is somehow missing,
     fall through to fetching immediately. */
  const shopRef = useRef(null);
  const partsStarted = useRef(false);

  useEffect(() => {
    const start = () => {
      if (partsStarted.current) return;
      partsStarted.current = true;
      fetchParts();
    };

    const el = shopRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      start();
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: '600px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [fetchParts]);

  /* Category "from" prices.
     This ran on every render and, worse, produced a brand-new array of brand-
     new objects each time — so the twelve service cards below could never be
     skipped by React, no matter what had actually changed. The parts strip
     alone flips partsLoading twice and sets parts once, and each of those
     re-rendered the whole page's card tree.

     Memoised on the two inputs it actually derives from, so the reference is
     stable and <ServiceCategoryGrid> (now React.memo) can bail out entirely
     while the parts strip settles. */
  const categories = useMemo(
    () => serviceCategories.map((cat) => {
      const inCategory = packages.filter((p) => p.categoryId === cat.id);
      const priced = inCategory.filter((p) => p.basePrice > 0);
      const cheapest = priced.length
        ? Math.min(...priced.map((p) => p.basePrice))
        : (cat.fromPrice || 499);
      return { ...cat, image: cat.apiImage, price: `From ₹${Number(cheapest).toLocaleString('en-IN')}` };
    }),
    [serviceCategories, packages]
  );

  /* No viewport min-height on the root any more. The Layout shell in App.jsx
     is already at least one viewport tall with <main> growing to fill it, so
     it was redundant — and on mobile `100vh` is measured with the URL bar
     hidden, making it taller than the visible viewport and adding a strip of
     dead scroll at the bottom. The background matches <body>, so dropping it
     changes nothing visually. */
  return (
    <div style={{ background: '#FFFFFF', width: '100%', maxWidth: '100%', position: 'relative' }}>
      <style>{`
        /* ── Skeleton shimmer (always available, even before PartCard mounts) ── */
        @keyframes gk-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .gk-skel {
          background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%) !important;
          background-size: 200% 100% !important;
          animation: gk-shimmer 1.5s infinite linear !important;
        }

        /* ── Hero & Automotive Styling ─────────────────────────────────────── */
        .gk-glow { position: absolute; pointer-events: none; border-radius: 50%; will-change: transform; }
        /* Sized against the container, never in fixed pixels: a 720px circle
           offset by -12% pushed the document 202px wider than a 320px phone.
           The gradient's own falloff still gives the soft bleed. The drift no
           longer scales either — growing the box 7% put its edge back outside
           whatever width it starts from. */
        .gk-glow-a {
          top: -25%; right: 0; width: min(720px, 100%); aspect-ratio: 1;
          background: radial-gradient(circle, rgba(37,99,235,0.22) 0%, transparent 68%);
          animation: gk-drift 18s ease-in-out infinite;
        }
        .gk-glow-b {
          bottom: -30%; left: 0; width: min(560px, 100%); aspect-ratio: 1;
          background: radial-gradient(circle, rgba(147,197,253,0.12) 0%, transparent 70%);
          animation: gk-drift 22s ease-in-out infinite reverse;
        }
        @keyframes gk-drift {
          0%,100% { transform: translate3d(0,0,0); opacity: 1; }
          50%     { transform: translate3d(-26px,22px,0); opacity: 0.78; }
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
          will-change: transform, opacity;
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

        /* ── Mobile: nothing decorative may run continuously ──────────────────
           Smooth scrolling beats decoration on a phone. The drift/float
           animations were already stopped here; two more costs were not.

           .gk-shimmer animates background-position on a background-clip:text
           element, which repaints the H1 on every frame for as long as the
           page is open — the most expensive thing still running on mobile.
           The gradient itself is kept, frozen at its resting position, so the
           heading looks the same and simply stops moving.

           .gk-grid-overlay does not animate, but a mask-image on a full-bleed
           layer forces its own compositing layer that has to be maintained
           while the hero scrolls. The mask is dropped and the opacity halved
           instead: the texture survives, the extra layer does not. */
        @media (max-width: 900px) {
          .gk-glow-a, .gk-glow-b { animation: none !important; }
          .gk-car { animation: gk-car-in 1s cubic-bezier(0.2,0.75,0.3,1) 0.2s forwards !important; }

          .gk-shimmer {
            animation: none !important;
            background-size: 100% 100% !important;
            background-position: 0 0 !important;
          }

          .gk-grid-overlay {
            opacity: 0.22;
            -webkit-mask-image: none !important;
                    mask-image: none !important;
          }
        }

        /* Respect reduced-motion: strip all decorative animations */
        @media (prefers-reduced-motion: reduce) {
          .gk-glow-a, .gk-glow-b, .gk-car, .gk-shimmer { animation: none !important; }
          .gk-car { opacity: 1 !important; }
          .gk-shimmer { -webkit-text-fill-color: #60A5FA; }
        }


        /* ── Booking steps card ───────────────────────────────────────────
           Floats across the hero's bottom edge: a negative top margin pulls it
           up over the dark section, and z-index lifts it above the hero's own
           glow layers. The hero carries 5.5rem of bottom padding, comfortably
           more than the 3.25rem pulled back, so the overlap eats slack rather
           than clipping the hero's content. */
        .gk-booking-card {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 20px;
          box-shadow: 0 24px 55px rgba(15, 23, 42, 0.16);
          padding: 1.5rem 1.75rem;
          margin-top: -3.25rem;
          position: relative;
          z-index: 10;
        }

        .gk-booking-title {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 1.2rem; font-weight: 800; color: #2563EB;
          margin: 0 0 1.15rem; letter-spacing: -0.01em;
        }

        /* Steps take equal share, the CTA only what it needs. */
        .gk-booking-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
          align-items: center;
          gap: 0;
        }

        .gk-booking-step {
          display: flex; align-items: center; gap: 0.8rem;
          padding: 0.35rem 1.25rem;
          min-width: 0;
        }
        /* Hairline rules BETWEEN steps only — on the divider, never on the
           outer edges, so the row is not boxed in. */
        .gk-booking-step + .gk-booking-step { border-left: 1px solid #E2E8F0; }
        .gk-booking-step:first-child { padding-left: 0; }

        .gk-booking-ico {
          width: 42px; height: 42px; border-radius: 12px;
          background: #EBF0FF; color: #2563EB;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .gk-booking-lab { min-width: 0; }
        .gk-booking-lab b {
          display: block; font-size: 0.9rem; font-weight: 700; color: #0F172A;
          line-height: 1.3; overflow-wrap: anywhere;
        }
        .gk-booking-lab span {
          display: block; font-size: 0.78rem; color: #64748B; font-weight: 500;
          line-height: 1.35; margin-top: 1px; overflow-wrap: anywhere;
        }

        .gk-booking-cta {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          background: #2563EB; color: #FFFFFF;
          padding: 0.9rem 1.6rem; border-radius: 12px;
          text-decoration: none; font-weight: 700; font-size: 0.88rem;
          white-space: nowrap; margin-left: 1.25rem;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
          transition: background .2s, transform .2s;
        }
        .gk-booking-cta:hover { background: #1D4ED8; transform: translateY(-2px); }

        /* Below the four-up width the dividers stop making sense: the steps
           become stacked rows with horizontal rules, and the CTA goes full
           width beneath them. */
        @media (max-width: 900px) {
          .gk-booking-row { grid-template-columns: 1fr; }
          .gk-booking-step { padding: 0.75rem 0; }
          .gk-booking-step + .gk-booking-step {
            border-left: 0; border-top: 1px solid #E2E8F0;
          }
          .gk-booking-cta { margin-left: 0; margin-top: 1rem; width: 100%; }
        }

        /* ── Why Choose banner ────────────────────────────────────────────
           One solid blue slab inset from the section edges, rather than five
           white cards on a light ground. These five points are secondary
           reassurance, not five things to weigh against each other, so they
           read better as a single block than as a card row competing with the
           service grid directly above them.

           Items are top-aligned, not centre-aligned: the descriptions are
           different lengths, and centring each one vertically would scatter
           the five icons down the row at five different heights. */
        /* The slab itself is shared by both blue bands on this page — Why
           Choose and the numbers strip — so the gradient, radius and shadow
           have ONE definition and cannot drift apart. Only the padding differs,
           and that lives on the two modifier classes below: Why Choose carries
           a heading, the numbers strip does not. */
        .gk-band {
          background: linear-gradient(120deg, #1E40AF 0%, #2563EB 55%, #1D4ED8 100%);
          border-radius: 24px;
          box-shadow: 0 18px 45px rgba(37, 99, 235, 0.22);
        }
        .gk-why-band   { padding: 2.25rem 2rem 2.4rem; }
        .gk-stats-band { padding: 1.65rem 2rem; }

        /* ── Final CTA band ───────────────────────────────────────────────
           Copy left, car centre, the two actions stacked right — on the same
           .gk-band slab the Why Choose and numbers sections use, so the page's
           three blue blocks read as one material rather than three near-misses.

           The car is the hero's artwork reused: a second decorative render of
           the same subject would be another file to ship for no gain, and this
           one is already in the bundle by the time the section is reached. */
        .gk-cta-band { padding: 2.1rem 2.4rem; }
        .gk-cta-inner {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 1.75rem;
        }
        .gk-cta-title {
          font-family: 'Space Grotesk', sans-serif;
          font-size: clamp(1.35rem, 2.4vw, 1.85rem);
          font-weight: 800; color: #FFFFFF; line-height: 1.2;
          margin: 0 0 0.55rem; letter-spacing: -0.01em;
        }
        .gk-cta-sub {
          color: rgba(255, 255, 255, 0.82); font-size: 0.85rem;
          font-weight: 500; line-height: 1.6; margin: 0; max-width: 34ch;
        }
        .gk-cta-img { display: flex; justify-content: center; }
        .gk-cta-img img { width: 270px; max-width: 100%; height: auto; display: block; }
        .gk-cta-actions { display: flex; flex-direction: column; gap: 0.6rem; }

        /* White fill on blue, not blue on blue: the band's gradient ends near
           blue-700, so a blue-600 button would all but vanish into it. */
        .gk-cta-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          background: #FFFFFF; color: #1D4ED8;
          padding: 0.75rem 1.5rem; border-radius: 10px;
          text-decoration: none; font-weight: 700; font-size: 0.85rem;
          white-space: nowrap; transition: background .2s, transform .2s;
        }
        .gk-cta-primary:hover { background: #EFF6FF; transform: translateY(-2px); }

        .gk-cta-secondary {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          background: rgba(255, 255, 255, 0.1); color: #FFFFFF;
          border: 1px solid rgba(255, 255, 255, 0.35);
          padding: 0.7rem 1.5rem; border-radius: 10px;
          text-decoration: none; font-weight: 600; font-size: 0.82rem;
          white-space: nowrap; transition: background .2s, border-color .2s;
        }
        .gk-cta-secondary:hover { background: rgba(255, 255, 255, 0.18); border-color: #FFFFFF; }

        /* Below the three-up width the car drops out rather than shrinking to
           a smudge, and the block centres as a single column. */
        @media (max-width: 1023px) {
          .gk-cta-inner   { grid-template-columns: 1fr; justify-items: center; text-align: center; gap: 1.35rem; }
          .gk-cta-sub     { max-width: 46ch; }
          .gk-cta-actions { width: 100%; max-width: 320px; }
        }
        @media (max-width: 767px) {
          .gk-cta-img  { display: none; }
          .gk-cta-band { padding: 1.6rem 1.25rem; }
        }

        /* ── Numbers strip ────────────────────────────────────────────────
           Icon chip, then the figure over its label. Vertically centred
           rather than top-aligned (unlike the Why Choose row): every label
           here is two or three words and fits one line, so there is no ragged
           wrap to align against. */
        .gk-stats-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1.25rem;
          align-items: center;
        }
        .gk-stat { display: flex; align-items: center; gap: 0.85rem; min-width: 0; }
        .gk-stat-ico {
          width: 40px; height: 40px; border-radius: 11px;
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.22);
          display: flex; align-items: center; justify-content: center;
          color: #FFFFFF; flex-shrink: 0;
        }
        .gk-stat-txt { min-width: 0; }
        .gk-stat-val {
          display: block; font-family: 'Space Grotesk', sans-serif;
          font-size: 1.6rem; font-weight: 800; color: #FFFFFF;
          line-height: 1.05; letter-spacing: -0.02em; white-space: nowrap;
        }
        .gk-stat-lab {
          display: block; color: rgba(255, 255, 255, 0.8);
          font-size: 0.75rem; font-weight: 500; line-height: 1.35;
          margin-top: 3px; overflow-wrap: anywhere;
        }
        @media (max-width: 860px) { .gk-stats-row { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.3rem 1rem; } }
        @media (max-width: 420px) {
          .gk-stats-row  { grid-template-columns: 1fr; gap: 1.05rem; }
          .gk-stats-band { padding: 1.3rem 1.15rem; }
        }
        .gk-why-title {
          font-family: 'Space Grotesk', sans-serif;
          font-size: clamp(1.3rem, 2.6vw, 1.75rem);
          font-weight: 800; color: #FFFFFF; text-align: center;
          margin: 0 0 1.9rem; letter-spacing: -0.01em;
        }
        .gk-why-row {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 1.25rem;
          align-items: start;
        }
        .gk-why-item { display: flex; align-items: flex-start; gap: 0.7rem; min-width: 0; }
        .gk-why-ico {
          width: 38px; height: 38px; border-radius: 11px;
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.22);
          display: flex; align-items: center; justify-content: center;
          color: #FFFFFF; flex-shrink: 0;
        }
        .gk-why-txt { min-width: 0; padding-top: 0.1rem; }
        .gk-why-txt b {
          display: block; color: #FFFFFF; font-size: 0.82rem; font-weight: 700;
          line-height: 1.3; overflow-wrap: anywhere;
        }
        .gk-why-txt span {
          display: block; color: rgba(255, 255, 255, 0.78); font-size: 0.72rem;
          font-weight: 500; line-height: 1.4; margin-top: 2px; overflow-wrap: anywhere;
        }
        @media (max-width: 1023px) { .gk-why-row { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.3rem 1rem; } }
        @media (max-width: 700px)  { .gk-why-row { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.15rem 0.85rem; } }
        @media (max-width: 420px)  {
          .gk-why-row  { grid-template-columns: 1fr; gap: 1rem; }
          .gk-band     { border-radius: 18px; }
          .gk-why-band { padding: 1.5rem 1.15rem 1.6rem; }
          .gk-why-title { margin-bottom: 1.4rem; }
        }

        .gk-parts-grid {
          display: grid; width: 100%;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr));
          gap: 1.1rem; align-items: stretch;
        }
        @media (max-width: 640px) {
          .gk-parts-grid { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
        }

        /* The row, not the buttons, owns the gap and the offset from the
           grid — otherwise the two controls carry different top margins and
           sit on different baselines. */
        .gk-svc-actions {
          display: flex; flex-wrap: wrap; align-items: center;
          justify-content: center; gap: .8rem;
          margin-top: 2.2rem;
        }

        .gk-svc-more {
          display: inline-flex; align-items: center; gap: .5rem;
          padding: .85rem 1.9rem;
          background: #FFFFFF; color: #0F172A;
          border: 1.5px solid #0F172A; border-radius: 10px;
          font: inherit; font-weight: 800; font-size: .88rem;
          letter-spacing: .02em; white-space: nowrap; cursor: pointer;
          transition: background .2s, color .2s, transform .25s;
        }
        .gk-svc-more:hover { background: #0F172A; color: #FFFFFF; transform: translateY(-2px); }
        .gk-svc-more:focus-visible { outline: 2px solid #2563EB; outline-offset: 2px; }

        .gk-svc-all {
          display: inline-flex; align-items: center; gap: .5rem;
          margin: 0; padding: .85rem 2rem;
          background: #2563EB; color: #FFFFFF; border-radius: 10px;
          text-decoration: none; font-weight: 800; font-size: .88rem;
          letter-spacing: .02em; white-space: nowrap;
          box-shadow: 0 10px 24px rgba(29, 78, 216, .24);
          transition: transform .25s, box-shadow .25s;
        }
        .gk-svc-all:hover { transform: translateY(-3px); box-shadow: 0 16px 30px rgba(29,78,216,.32); }

        .gk-shop-all {
          display: inline-flex; align-items: center; gap: .45rem;
          background: #2563EB; color: #FFFFFF; padding: .65rem 1.4rem; min-height: 42px;
          border-radius: 10px; text-decoration: none; font-weight: 800; font-size: .82rem;
          white-space: nowrap; box-shadow: 0 8px 20px rgba(37,99,235,.24);
          transition: transform .2s, box-shadow .2s;
        }
        .gk-shop-all:hover { transform: translateY(-2px); box-shadow: 0 14px 26px rgba(37,99,235,.3); }

        /* ── Mobile hero ─────────────────────────────────────────────────────
           The car used to be hidden outright below 900px, which left the
           mobile hero as a wall of text — the "too plain" report. It is now
           kept and moved beneath the copy, where it reads as a product shot
           rather than a squeezed desktop column.

           This is affordable precisely because of Phase 2B: the artwork is a
           29 KB WebP, not the 192 KB PNG it used to be. No animation is
           reintroduced — the float and drift stay off below 900px (see the
           block above); only the one-shot fade-in remains. */
        @media (max-width: 900px) {
          .gk-hero-grid {
            grid-template-columns: 1fr !important;
            gap: 1.25rem !important;
          }
          .gk-hero-grid > div:first-child { width: 100% !important; max-width: 100% !important; }
          .gk-hero-img {
            order: 2;
            margin-top: 0.25rem;
          }
          .gk-hero-img img { max-width: 420px !important; margin: 0 auto; }
          /* The blurred halo behind the car is a filter: blur(30px) on a large
             box. Cheap enough on a desktop GPU, not worth it on a phone. */
          .gk-hero-img > div:first-child { display: none !important; }
        }

        @media (max-width: 768px) {
          .gk-hero {
            padding: 2.25rem 0 2.5rem !important;
            min-height: auto !important;
          }
          .gk-hero h1 {
            font-size: clamp(1.8rem, 8vw, 2.4rem) !important;
            line-height: 1.12 !important;
            margin-bottom: 0.75rem !important;
          }
          .gk-hero-eyebrow { font-size: 0.68rem !important; margin-bottom: 0.6rem !important; }
          .gk-hero-desc {
            font-size: 0.9rem !important;
            line-height: 1.6 !important;
            margin-bottom: 1.25rem !important;
          }
          .gk-hero-ctas {
            flex-direction: column !important;
            gap: 0.6rem !important;
            margin-bottom: 1.25rem !important;
          }
          .gk-hero-ctas a {
            width: 100% !important;
            justify-content: center !important;
            padding: 0.95rem 1rem !important;
            white-space: nowrap !important;
            box-sizing: border-box !important;
          }
          /* A 2x2 chip block reads as deliberate; the old single stacked column
             left a tall ribbon of near-empty space down the left edge. */
          .gk-trust-row {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.5rem !important;
            align-items: stretch !important;
          }
          .gk-trust-row > div {
            width: 100% !important;
            min-width: 0;
            background: rgba(148, 163, 184, 0.10);
            border: 1px solid rgba(148, 163, 184, 0.18);
            border-radius: 10px;
            padding: 0.5rem 0.6rem;
          }
          .gk-trust-row span { font-size: 0.74rem !important; white-space: normal !important; }
          .gk-social-proof {
            flex-direction: row !important;
            flex-wrap: wrap !important;
            align-items: center !important;
            gap: 0.5rem 0.9rem !important;
            margin-top: 1rem !important;
          }
          .gk-booking-card { margin-top: 1.5rem !important; padding: 1.25rem !important; }
        }

        /* Smallest phones: the two-up chips would clip, so let them run full
           width rather than truncating the labels. */
        @media (max-width: 359px) {
          .gk-trust-row { grid-template-columns: 1fr !important; }
          .gk-hero h1 { font-size: 1.6rem !important; }
          .gk-hero-img img { max-width: 100% !important; }
        }

        /* ── All card grids: 2 columns on mobile ── */
        @media (max-width: 640px) {
          /* minmax(0, 1fr), not 1fr: a bare 1fr is minmax(auto, 1fr), so a long
             word inside a card sets the track's minimum and the grid grows
             past its container. */
          .gk-how-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.75rem !important;
          }
          .gk-how-grid > *,
          .gk-testimonials-grid > * { min-width: 0; }
          .gk-how-grid > div {
            padding: 1rem 0.85rem !important;
            border-radius: 12px !important;
          }
        }

        /* ── Reviews ─────────────────────────────────────────────────────────
           Testimonials are deliberately NOT in the two-column block above.
           A review is a paragraph of prose plus an avatar, a name, a role and
           five stars; at 640px two columns leaves each card about 150px of
           usable width, which is what made this section read as cramped. One
           column below 620px gives the text a full measure, and the card can
           then lay its author row out horizontally instead of stacking. */
        .gk-testimonials-grid { grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); }
        @media (max-width: 620px) {
          .gk-testimonials-grid {
            grid-template-columns: 1fr !important;
            gap: 0.85rem !important;
          }
          .gk-testimonials-grid > div { padding: 1.15rem 1.1rem !important; }
          .gk-testimonials-grid p { font-size: 0.88rem !important; line-height: 1.6 !important; }
          .gk-testimonials-grid h4 { font-size: 0.95rem !important; }
        }

        /* ── Mobile: cheaper shadows ──────────────────────────────────────────
           A blurred shadow costs the rasteriser roughly in proportion to the
           area its blur covers, and about thirty of them scroll past on this
           page. The radii below are cut roughly in half and the alpha nudged
           up to compensate, so the cards keep the same sense of lift for far
           less paint. Desktop keeps the original values untouched — this only
           applies below 640px, where the pressure actually is.

           !important because most of these shadows are set as inline styles on
           the elements, which a plain stylesheet rule cannot override. */
        @media (max-width: 640px) {
          .gk-booking-card { box-shadow: 0 8px 18px rgba(15, 23, 42, 0.10) !important; }
          .gk-how-grid > div { box-shadow: 0 3px 8px rgba(15, 23, 42, 0.06) !important; }
          .gk-testimonials-grid > div { box-shadow: 0 3px 10px rgba(15, 23, 42, 0.05) !important; }
          .gk-svc-all { box-shadow: 0 5px 12px rgba(29, 78, 216, .26) !important; }
          .gk-shop-all { box-shadow: 0 4px 10px rgba(37, 99, 235, .26) !important; }
        }

        /* Hover lifts re-blur a shadow and re-composite the card. A touch
           screen fires them on tap and can leave them stuck afterwards, so
           they are reserved for pointers that can actually hover. */
        @media (hover: none) {
          .gk-svc-all:hover, .gk-shop-all:hover, .gk-svc-more:hover {
            transform: none;
            box-shadow: 0 5px 12px rgba(29, 78, 216, .26);
          }
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
          <div className="gk-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '2.5rem', alignItems: 'center', width: '100%' }}>
            {/* LEFT TEXT CONTENT */}
            <div>
              <p className="gk-hero-eyebrow" style={{ color: '#93C5FD', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.8rem' }}>
                PREMIUM CAR CARE
              </p>

              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.08, letterSpacing: '-0.02em', marginBottom: '1.1rem' }}>
                Professional<br />
                <span className="gk-shimmer">Car Service &amp; Repair</span>
              </h1>

              <p className="gk-hero-desc" style={{ color: '#94A3B8', fontSize: '0.96rem', fontWeight: 500, lineHeight: 1.7, maxWidth: '480px', marginBottom: '2rem' }}>
                Expert technicians, genuine parts, doorstep service. We ensure a safe ride for you
                and your loved ones. Book online in under 2 minutes.
              </p>

              {/* CTAs */}
              <div className="gk-hero-ctas" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', marginBottom: '2.2rem' }}>
                <Link
                  to="/services"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                    background: '#2563EB', color: '#FFFFFF',
                    padding: '0.85rem 2.1rem', borderRadius: '10px', textDecoration: 'none',
                    fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: '0.9rem',
                    letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
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
                    fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: '0.9rem',
                    letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                    transition: 'all 0.25s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FFFFFF'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                >
                  View All Services <ArrowRight size={16} />
                </a>
              </div>

              {/* Trust Tags */}
              <div className="gk-trust-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                {TRUST_TAGS.map(({ icon: Icon, title }) => (
                  <div key={title} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '7px', background: 'rgba(147, 197, 253, 0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={14} style={{ color: '#93C5FD' }} />
                    </div>
                    <span style={{ color: '#E2E8F0', fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{title}</span>
                  </div>
                ))}
              </div>

              {/* Social Proof */}
              <div className="gk-social-proof" style={{ marginTop: '1.2rem', paddingTop: '1.1rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ color: '#94A3B8', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Trusted by 10,000+ Car Owners</span>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexShrink: 0 }}>
                  {[...Array(5)].map((_, i) => <Star key={i} size={13} fill="#F59E0B" color="#F59E0B" />)}
                  <span style={{ color: '#FFFFFF', fontSize: '0.82rem', fontWeight: 800, marginLeft: '0.35rem', whiteSpace: 'nowrap' }}>4.8/5 Rating</span>
                </div>
              </div>
            </div>

            {/* RIGHT — GT3 HERO CAR */}
            <div className="gk-hero-img" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ position: 'absolute', width: '80%', height: '60%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(37,99,235,0.24) 0%, transparent 70%)', filter: 'blur(30px)' }} />
              {/* Intrinsic size given so the browser reserves the right box
                  before the file arrives — without it the hero column snaps
                  into place mid-load. Left eager on purpose: on desktop this
                  is above the fold. (Below 900px .gk-hero-img is display:none,
                  so this never paints on a phone.) */}
              <img
                className="gk-car"
                src={heroCar}
                alt="Car undergoing professional service at GK Motors"
                width={554}
                height={241}
                decoding="async"
                style={{ width: '100%', maxWidth: '680px', height: 'auto', objectFit: 'contain', position: 'relative', zIndex: 1 }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════ 2. BOOKING STEPS CARD ════════════════════
          Restored on request after previously being removed for overlapping
          How It Works further down the page. The two still describe the same
          journey; this one is the above-the-fold funnel entry and stops at
          three lines, How It Works is the full four-step explanation.

          The three steps are described, not operated: there is no service
          picker, date picker or confirmation step on this page, so they carry
          no chevrons or other controls that would not do anything. The single
          blue CTA is the card's action. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="gk-booking-card">
          <h3 className="gk-booking-title">Book Your Service in 3 Easy Steps</h3>

          <div className="gk-booking-row">
            {BOOKING_STEPS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="gk-booking-step">
                <span className="gk-booking-ico"><Icon size={20} /></span>
                <span className="gk-booking-lab">
                  <b>{title}</b>
                  <span>{desc}</span>
                </span>
              </div>
            ))}

            <Link to="/services" className="gk-booking-cta">
              Book Service Now <ArrowRight size={16} />
            </Link>
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
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '2.5rem', fontWeight: 900, color: '#0F172A', lineHeight: 1, margin: 0 }}>
              Our <span style={{ color: '#2563EB' }}>Services</span>
            </h2>
            <p style={{ color: '#475569', fontSize: '0.9rem', fontWeight: 500, lineHeight: 1.6, maxWidth: '480px', margin: '0.7rem auto 0' }}>
              Tailored car care solutions — everything your car needs with upfront pricing and doorstep pickup.
            </p>
            <div style={{ width: 56, height: 4, background: '#2563EB', margin: '1.1rem auto 0', borderRadius: '3px' }} />
          </div>

          {/* Passing `undefined` rather than a bigger number is what keeps the
              expansion honest: the grid's own slice is simply removed, so the
              expanded state can never disagree with the catalogue length. */}
          <div id="gk-services-grid">
            {/* featured={false} — one flat grid of equally sized cards, four
                to a row. The two-tier featured/compact arrangement is still
                what /services renders; this section is a uniform 8. */}
            <ServiceCategoryGrid
              categories={categories}
              limit={servicesExpanded ? undefined : HOME_CATEGORY_COUNT}
              featured={false}
            />
          </div>

          {/* Two controls, deliberately different jobs and different weights.
              "Show More" is the secondary (slate outline) button and expands
              this grid in place. "View All Services" is the primary and leaves
              for /services, where packages, filtering and booking live. */}
          <div className="gk-svc-actions">
            {categories.length > HOME_CATEGORY_COUNT && (
              <button
                type="button"
                className="gk-svc-more"
                onClick={() => setServicesExpanded((open) => !open)}
                aria-expanded={servicesExpanded}
                aria-controls="gk-services-grid"
              >
                {servicesExpanded ? 'Show Less' : 'Show More'}
                {servicesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            )}

            <Link to="/services" className="gk-svc-all">
              View All Services <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════ 4. SHOP CAR ESSENTIALS (moved here, after Services) ════════════════════ */}
      {/* ref drives the IntersectionObserver above: this section's requests do
          not leave until it is within 600px of the viewport. */}
      <section ref={shopRef} style={{ background: '#F8FAFC', padding: '4rem 0', borderTop: '1px solid #E2E8F0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '2rem' }}>
            <div>
              <p style={{ color: '#2563EB', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '0.55rem' }}>
                GK MOTORS
              </p>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '2.3rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Shop Car <span style={{ color: '#2563EB' }}>Essentials</span>
              </h2>
              <p style={{ color: '#475569', fontSize: '0.88rem', fontWeight: 500, margin: '0.4rem 0 0', maxWidth: '440px' }}>
                Genuine oils, filters, batteries and accessories — delivered or fitted during your service.
              </p>
              {/* Left-aligned rather than centred: this section's header sits
                  beside its CTA instead of over the grid, so the accent follows
                  the heading's own edge. */}
              <div style={{ width: 56, height: 4, background: '#2563EB', margin: '1.1rem 0 0', borderRadius: '3px' }} />
            </div>
            <Link to="/parts" className="gk-shop-all">
              View All Products <ArrowRight size={15} />
            </Link>
          </div>

          {/* Loading State: 5 skeleton cards. aria-busy + a live region so a
              screen reader is told the shelf is loading rather than empty. */}
          <SectionBoundary name="shop strip">
          {partsLoading ? (
            <div className="gk-parts-grid" aria-busy="true" aria-live="polite">
              <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
                Loading products…
              </span>
              {[...Array(HOME_PART_COUNT)].map((_, i) => (
                <PartCardSkeleton key={i} />
              ))}
            </div>
          ) : partsError ? (
            /* Error State */
            <div style={{ background: '#FFF', border: '1px solid #FEE2E2', borderRadius: '16px', padding: '2.5rem', textAlign: 'center' }}>
              <AlertCircle size={36} style={{ color: '#EF4444', margin: '0 auto 0.75rem' }} />
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Unable to load products</h3>
              <p style={{ color: '#475569', fontSize: '0.85rem', margin: '0.4rem 0 1.2rem' }}>Something went wrong while fetching car essentials.</p>
              <button
                onClick={fetchParts}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                  background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px',
                  padding: '0.6rem 1.4rem', cursor: 'pointer', fontWeight: 800, fontSize: '0.82rem',
                  fontFamily: "'Space Grotesk', sans-serif"
                }}
              >
                <RefreshCw size={14} /> Try Again
              </button>
            </div>
          ) : parts.length === 0 ? (
            /* Empty State */
            <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '2.5rem', textAlign: 'center' }}>
              <p style={{ fontSize: '2.5rem', margin: '0 0 0.5rem' }}>📦</p>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>No products available</h3>
              <p style={{ color: '#475569', fontSize: '0.85rem', margin: '0.4rem 0 1.2rem' }}>Check back soon for new genuine car spares and accessories.</p>
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
          </SectionBoundary>
        </div>
      </section>

      {/* ════════════════════ 5. WHY CHOOSE GK MOTORS ════════════════════ */}
      {/* The eyebrow and the blue underline are deliberately not here. Every
          other section carries both, but they exist to sit above a dark
          heading on a light ground — inside a blue slab the heading is already
          the only thing competing for attention, and a blue rule on blue would
          be invisible anyway. */}
      <section style={{ background: '#F8FAFC', padding: '3.5rem 0', borderTop: '1px solid #E2E8F0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="gk-band gk-why-band">
            <h2 className="gk-why-title">Why Choose GK Motors?</h2>

            <div className="gk-why-row">
              {WHY_CHOOSE_US.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="gk-why-item">
                  <span className="gk-why-ico"><Icon size={18} /></span>
                  <span className="gk-why-txt">
                    <b>{title}</b>
                    <span>{desc}</span>
                  </span>
                </div>
              ))}
            </div>
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
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '2.3rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
              How It <span style={{ color: '#2563EB' }}>Works</span>
            </h2>
            <div style={{ width: 50, height: 3, background: '#2563EB', margin: '1.1rem auto 0', borderRadius: '2px' }} />
          </div>

          <div className="gk-how-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.1rem' }}>
            {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc }) => (
              <div key={step} style={{ position: 'relative', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.5rem 1.25rem', overflow: 'hidden' }}>
                <span style={{ position: 'absolute', top: '0.3rem', right: '0.8rem', fontFamily: "'Space Grotesk', sans-serif", fontSize: '2.8rem', fontWeight: 950, color: 'rgba(37, 99, 235, 0.08)', lineHeight: 1 }}>{step}</span>
                <div style={{ width: 44, height: 44, borderRadius: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.9rem', position: 'relative' }}>
                  <Icon size={20} style={{ color: '#2563EB' }} />
                </div>
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', marginBottom: '0.4rem' }}>{title}</h3>
                <p style={{ color: '#475569', fontSize: '0.78rem', lineHeight: 1.55, fontWeight: 500, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Merged: the standalone stats band now opens the reviews section ──
          Two adjacent sections were both doing "trust": a dark stats band
          (10,000+ Happy Customers, 4.8/5 Customer Ratings) immediately
          followed by "Trusted by Thousands" and four five-star reviews. The
          same 4.8/5 figure appeared in both, and in the hero above them.
          One section now carries the evidence, with the numbers as its
          header strip. Nothing was deleted — STATS still renders in full. */}
      {/* ════════════════════ 7. TRUST: NUMBERS + REVIEWS ════════════════════ */}
      <section style={{ background: '#FFFFFF', padding: '4rem 0 4.5rem', overflow: 'hidden' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Numbers strip — restyled for the light background it now sits on. */}
          <div className="gk-band gk-stats-band" style={{ marginBottom: '3rem' }}>
            <div className="gk-stats-row">
              {STATS.map(({ value, label, icon: Icon }) => (
                <div key={label} className="gk-stat">
                  <span className="gk-stat-ico"><Icon size={18} /></span>
                  <span className="gk-stat-txt">
                    <span className="gk-stat-val">{value}</span>
                    <span className="gk-stat-lab">{label}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p style={{ color: '#2563EB', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '0.55rem' }}>
              WHAT OUR CUSTOMERS SAY
            </p>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '2.3rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
              Trusted by <span style={{ color: '#2563EB' }}>Thousands</span>
            </h2>
            <div style={{ width: 50, height: 3, background: '#2563EB', margin: '1.1rem auto 0', borderRadius: '2px' }} />
          </div>

          <SectionBoundary name="reviews">
          <div className="gk-testimonials-grid" style={{ display: 'grid', gap: '1.5rem' }}>
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
                  {/* Below the fold and tiny. Lazy so four avatars are not
                      fetched during first paint, async-decoded so decoding
                      one cannot stall the main thread mid-scroll, and sized
                      so the row does not reflow when they arrive. The files
                      themselves are now 128x128 rather than up to 736x1104. */}
                  <img
                    src={item.img}
                    alt={item.name}
                    width={42}
                    height={42}
                    loading="lazy"
                    decoding="async"
                    style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${item.color}` }}
                  />
                  <div>
                    <h4 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: '1rem', color: '#0F172A', margin: 0 }}>{item.name}</h4>
                    <p style={{ fontSize: '0.72rem', color: '#2563EB', fontWeight: 700, margin: '2px 0 0' }}>{item.role}</p>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
                    {[...Array(5)].map((_, j) => <Star key={j} size={11} fill="#F59E0B" color="#F59E0B" />)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          </SectionBoundary>
        </div>
      </section>

      {/* ════════════════════ 9. FINAL CTA BANNER ════════════════════ */}
      <section style={{ position: 'relative', background: 'linear-gradient(180deg, #0F172A 0%, #131B31 100%)', padding: '4rem 0', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-40%', right: '5%', width: '480px', height: '480px', background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ position: 'relative', zIndex: 2 }}>
          <div className="gk-band gk-cta-band">
            <div className="gk-cta-inner">
              <div>
                <h2 className="gk-cta-title">
                  Give Your Car<br />The Care It Deserves
                </h2>
                <p className="gk-cta-sub">
                  Book your service today &amp; experience hassle-free car care at your doorstep.
                </p>
              </div>

              {/* Decorative: the heading beside it already names the subject, so
                  an empty alt keeps it out of the accessibility tree rather than
                  having it announced twice. Lazy and async-decoded — this is the
                  last section on the page and never near first paint. */}
              <div className="gk-cta-img">
                <img src={heroCar} alt="" width={554} height={241} loading="lazy" decoding="async" />
              </div>

              <div className="gk-cta-actions">
                <Link to="/services" className="gk-cta-primary">
                  Book Service Now <ArrowRight size={15} />
                </Link>
                <a href="tel:+919253625099" className="gk-cta-secondary">
                  <Phone size={14} /> Call Us: +91 92536 25099
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
