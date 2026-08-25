import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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

  const shownCount = Math.min(categories.length, HOME_CATEGORY_COUNT);

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
          .gk-why-grid,
          .gk-how-grid,
          .gk-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.75rem !important;
          }
          .gk-why-grid > *,
          .gk-how-grid > *,
          .gk-stats-grid > *,
          .gk-testimonials-grid > * { min-width: 0; }
          .gk-why-grid > div,
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
          .gk-why-grid > div,
          .gk-how-grid > div { box-shadow: 0 3px 8px rgba(15, 23, 42, 0.06) !important; }
          .gk-testimonials-grid > div { box-shadow: 0 3px 10px rgba(15, 23, 42, 0.05) !important; }
          .gk-svc-all { box-shadow: 0 5px 12px rgba(29, 78, 216, .26) !important; }
          .gk-shop-all { box-shadow: 0 4px 10px rgba(30, 58, 138, .24) !important; }
        }

        /* Hover lifts re-blur a shadow and re-composite the card. A touch
           screen fires them on tap and can leave them stuck afterwards, so
           they are reserved for pointers that can actually hover. */
        @media (hover: none) {
          .gk-svc-all:hover, .gk-shop-all:hover {
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

              <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.08, letterSpacing: '-0.02em', marginBottom: '1.1rem' }}>
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
                    fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: '0.9rem',
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
                    fontFamily: 'Rajdhani, sans-serif', fontWeight: 800, fontSize: '0.9rem',
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
              <div className="gk-trust-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
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
              <div className="gk-social-proof" style={{ marginTop: '1.2rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
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

      {/* ── Removed: "Book Your Service in 3 Easy Steps" ──────────────────
          It restated the How It Works section further down the page — Select
          Service / Select Date & Time were the same two steps written twice,
          about two thousand pixels apart, and it carried a fourth "Book
          Service Now" CTA on a page that already had several. How It Works
          keeps the process explanation; this block was pure repetition.

          Deleting it also removes .gk-booking-card's `margin-top: -2.5rem`
          overlap with the hero, so the hero's own bottom padding now reads
          correctly on mobile. */}
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
      {/* ref drives the IntersectionObserver above: this section's requests do
          not leave until it is within 600px of the viewport. */}
      <section ref={shopRef} style={{ background: '#F8FAFC', padding: '4rem 0', borderTop: '1px solid #E2E8F0' }}>
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
          </SectionBoundary>
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

          <div className="gk-why-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.1rem' }}>
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

          <div className="gk-how-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.1rem' }}>
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
          <div className="gk-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
            {STATS.map(({ value, label, icon: Icon }) => (
              <div key={label} style={{ textAlign: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '1.1rem 0.75rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '11px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.6rem' }}>
                  <Icon size={17} style={{ color: '#2563EB' }} />
                </div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.65rem', fontWeight: 900, color: '#0F172A', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
                <div style={{ color: '#64748B', fontSize: '0.64rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.35rem' }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p style={{ color: '#2563EB', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '0.55rem' }}>
              WHAT OUR CUSTOMERS SAY
            </p>
            <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.3rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
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
          </SectionBoundary>
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
            Book your service today and experience hassle-free car care at your doorstep.
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
