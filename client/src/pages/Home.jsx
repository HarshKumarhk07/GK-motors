/* ═══════════════════════════════════════════════════════════════════════════
   HOME — 2026 reconstruction
   ═══════════════════════════════════════════════════════════════════════════

   WHAT CHANGED AND WHY

   The previous landing page was structurally sound and visually anonymous: a
   generic blue-600 accent that matched no part of the logo, flat cards with no
   depth or hover state, a stock Porsche GT3 in the hero of a Rohtak general
   workshop, invented head offices in Gurgaon and Mumbai, and testimonials so
   generic they read as filler. Every one of those is addressed here.

   1. COLOUR. The palette is now sampled from the logo — the badge ring's navy
      and the steering-wheel mark's cyan. See src/theme.js. The brand gradient
      (navy→cyan) is the page's signature and appears on every primary action.

   2. NO STOCK SUPERCAR. A Porsche says nothing true about this business. The
      hero's right column is the *product* instead: a live-looking estimate
      card showing what a customer actually gets — an itemised quote with the
      labour line at zero and a pickup slot. Behind it sits the dotted ring
      lifted straight off the logo badge, slowly rotating. It is on-brand,
      it is honest, and it is the single strongest thing we can show before a
      real photograph of the workshop exists.
      ► The one upgrade that would beat it: photographs of the actual bays,
        the team, and a few finished jobs. Drop them in and this section gets
        better again.

   3. MOTION. Scroll-linked reveals, a parallax estimate card, 3D pointer tilt
      on the service cards, counting statistics, and a timeline whose spine
      draws itself as you scroll through it. All of it is defined once in
      components/common/Motion.jsx and all of it stops dead under
      `prefers-reduced-motion`.

   4. THE BRAND RAIL. The one element the client singled out as working on a
      competitor's site. Ours is monochrome, hand-drawn as inline SVG, and
      scrolls continuously — see components/common/BrandRail.jsx.

   5. CONTACT DETAILS. One location, the real one, from the Google listing.
      Every string lives in BIZ in src/theme.js so it cannot drift again.

   ── PLACEHOLDER CONTENT, FLAGGED ──────────────────────────────────────────
   TESTIMONIALS and the figures in STATS below are written to be plausible for
   a workshop of this size and age — they are NOT real. They exist so the
   section can be designed and shipped, and they are meant to be replaced with
   genuine Google reviews and genuine numbers before this goes in front of
   customers. Both arrays are marked at their definition.
   The one number deliberately NOT invented is the Google star rating: rather
   than print a figure nobody has verified, the reviews section links to the
   live listing and lets it speak for itself.
   ═════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Wrench, Sparkles, Zap, PaintBucket, Droplets, CircleDot, Battery,
  Disc, Settings, Shield, ShieldCheck, Award, Car, Check, CheckCircle, Clock,
  Star, Phone, Calendar, Users, MapPin, AlertCircle, RefreshCw, ChevronDown,
  ChevronRight, Truck, Navigation, IndianRupee, Headset, MessageCircle, Pencil,
} from 'lucide-react';

import { getServiceCategories, getCategories } from '../api/serviceApi';
import { getFeaturedParts, getRecentParts } from '../api/storeApi';
import PartCard, { PartCardSkeleton } from '../components/parts/PartCard';
import SectionBoundary from '../components/common/SectionBoundary';
import BrandRail from '../components/common/BrandRail';
import AmbientVideo from '../components/common/AmbientVideo';
import ProcessFlow from '../components/common/ProcessFlow';
import RollingWheel from '../components/common/RollingWheel';
import ScrollWheel from '../components/common/ScrollWheel';
import {
  Reveal, Stagger, StaggerItem, Parallax, ScrollRecede, CountUp, ScrollProgressLine, motion,
} from '../components/common/Motion';
import { C, G, BIZ } from '../theme';
import { nextPickupSlot } from '../utils/istTime';

/* ═══════════════════════════════════════════════════════════════════════════
   CONTENT
   ═══════════════════════════════════════════════════════════════════════════ */

/* Fallback only. The live list comes from GET /api/service-categories so
   categories the admin adds appear without a code change; this array supplies
   the icon and the "from" price when that request has not landed or has
   failed, keyed by categoryId. */
const FALLBACK_CATEGORIES = [
  { id: 1,  slug: 'car-service',         label: 'Periodic Service',    icon: Wrench,      desc: 'Oil, filters, 30-point check',        fromPrice: 2999 },
  { id: 2,  slug: 'ac-service',          label: 'AC Service & Repair', icon: Zap,         desc: 'Gas top-up, cooling coil, blower',    fromPrice: 1499 },
  { id: 3,  slug: 'batteries',           label: 'Batteries',           icon: Battery,     desc: 'Tested, fitted, old one taken away',  fromPrice: 299 },
  { id: 4,  slug: 'tyres-wheel-care',    label: 'Tyres & Wheels',      icon: CircleDot,   desc: 'Alignment, balancing, rotation',      fromPrice: 799 },
  { id: 5,  slug: 'denting-painting',    label: 'Denting & Painting',  icon: PaintBucket, desc: 'Panel repair with matched paint',     fromPrice: 2499 },
  { id: 12, slug: 'insurance-claims',    label: 'Insurance Claims',    icon: Shield,      desc: 'Cashless paperwork handled for you',  fromPrice: 999 },
  { id: 6,  slug: 'detailing-service',   label: 'Detailing',           icon: Award,       desc: 'Paint correction, ceramic, interior', fromPrice: 2999 },
  { id: 7,  slug: 'car-spa-cleaning',    label: 'Car Spa & Cleaning',  icon: Droplets,    desc: 'Foam wash, polish, dry-clean',        fromPrice: 499 },
  { id: 8,  slug: 'car-inspections',     label: 'Pre-Buy Inspection',  icon: CheckCircle, desc: '120-point report before you pay',     fromPrice: 999 },
  { id: 9,  slug: 'windshields-lights',  label: 'Glass & Lights',      icon: Sparkles,    desc: 'Windshield, mirrors, headlamps',      fromPrice: 899 },
  { id: 10, slug: 'suspension-fitments', label: 'Suspension',          icon: Settings,    desc: 'Struts, bushes, noise diagnosis',     fromPrice: 799 },
  { id: 11, slug: 'clutch-body-parts',   label: 'Clutch & Body',       icon: Disc,        desc: 'Clutch kits, mountings, body parts',  fromPrice: 2499 },
];

/* The promises made in the hero. Kept to three: a fourth turns a confident
   line into a list nobody reads. */
const HERO_PROOF = [
  { icon: ShieldCheck, label: 'Genuine parts only' },
  { icon: IndianRupee, label: 'Quote before we start' },
  { icon: Truck,       label: 'Free pickup & drop' },
];

/* The itemised estimate rendered in the hero card. Real prices from the
   fallback catalogue above, so it never contradicts the services grid. */
const SAMPLE_QUOTE = [
  { label: 'Periodic service — full',  note: 'Oil, oil filter, air filter', amount: 2999 },
  { label: 'Engine oil — 5W-30, 3.5L', note: 'Shell Helix, genuine',        amount: 1180 },
  { label: 'Labour',                   note: 'Included, always',            amount: 0 },
];

/* Deliberately written as reasons a person would actually choose a workshop,
   not as feature bullets. Each one is falsifiable — which is the point. */
const WHY_US = [
  {
    icon: IndianRupee,
    title: 'The quote is the bill',
    desc: 'You approve an itemised estimate on WhatsApp before a spanner is picked up. If we find something else, we stop and ask — we never surprise you at the counter.',
    span: 2,
  },
  {
    icon: ShieldCheck,
    title: 'Genuine parts, old parts returned',
    desc: 'OEM or OES only. Every part we take off your car is bagged and handed back to you, so you can see exactly what you paid for.',
    span: 2,
  },
  { icon: Truck,  title: 'Free pickup & drop',  desc: 'Anywhere in Rohtak. We collect, service, and return it washed.', span: 1 },
  { icon: Award,  title: '12-month warranty',   desc: 'On labour and on every part we fit. In writing, on the invoice.', span: 1 },
  { icon: Users,  title: 'Trained technicians', desc: 'Brand-trained hands, not a rotating crew of helpers.', span: 1 },
  { icon: Clock,  title: 'Same-day on most jobs', desc: 'In by 10, out by evening for routine service work.', span: 1 },
];

const HOW_IT_WORKS = [
  { n: '01', icon: Wrench,   title: 'Tell us what it needs',  desc: 'Pick a service, or just describe the noise. Not sure what is wrong? Book a diagnostic and we will find it.' },
  { n: '02', icon: Calendar, title: 'Choose a slot',          desc: 'Pick the date, the time and the address. Evening and Sunday slots are available.' },
  { n: '03', icon: Truck,    title: 'We collect the car',     desc: 'A driver comes to you anywhere in Rohtak, free. You get the estimate on WhatsApp before any work begins.' },
  { n: '04', icon: Navigation, title: 'Back to you, washed',  desc: 'Serviced, road-tested, washed, and delivered with the old parts and a warranty on the invoice.' },
];

/* ⚠ PLACEHOLDER — see the file header. Written to be plausible for a workshop
   of this size and age; replace with real figures before launch. */
const STATS = [
  { to: 12,    suffix: '+',   label: 'Years on Sheela Bypass', icon: Clock },
  { to: 8000,  suffix: '+',   label: 'Cars through the bays',  icon: Car },
  { to: 40,    suffix: '+',   label: 'Brands serviced',        icon: Wrench },
  { to: 100,   suffix: '%',   label: 'Genuine parts fitted',   icon: ShieldCheck },
];

/* ⚠ PLACEHOLDER — see the file header. These are written, not collected, and
   the portraits are stock photographs of people who have never been customers
   here. Added on request so the section reads as finished; both the words and
   the faces must be replaced with real reviewers before this goes live, or the
   photographs dropped and the monograms used throughout. Publishing invented
   quotes under real-looking faces is the one thing on this page that would be
   genuinely dishonest rather than merely unverified.
   Replace every one with a real review from the Google listing (BIZ.mapsUrl)
   before this page goes in front of customers. The shape is deliberately
   specific — a car, a job, a price, an outcome — because that is what a real
   review looks like and what a generic one cannot fake. */
const TESTIMONIALS = [
  {
    name: 'Mahesh Ahlawat', img: '/testimonials/rahul-sharma.jpg', car: 'Swift Dzire', initial: 'M',
    text: 'AC stopped cooling two days before a Delhi trip. They traced it to a leaking condenser, showed me the old part, and had the car back to me the same evening. Charged exactly what was quoted.',
  },
  {
    name: 'Sunita Malik', img: '/testimonials/priya-patel.jpg', car: 'Hyundai i20', initial: 'S',
    text: 'First workshop that did not talk down to me about my own car. Photos of everything on WhatsApp before they touched it, and they waited for my yes.',
  },
  {
    name: 'Rajender Dahiya', img: '/testimonials/suresh-kumar.jpg', car: 'Mahindra Scorpio', initial: 'R',
    text: 'Four years of servicing my Scorpio here. The bill has never once come out higher than the estimate. That is the whole reason I keep going back.',
  },
  {
    name: 'Ankit Sehrawat', img: '/testimonials/aman-singh.jpg', car: 'Hyundai Creta', initial: 'A',
    text: 'Picked the car up from my house in Model Town and dropped it back washed. No extra charge for either. Small thing, but nobody else here does it.',
  },
  {
    name: 'Pooja Rathee', img: '/testimonials/anjali-mehta.jpg', car: 'Maruti Baleno', initial: 'P',
    text: 'Rear door had a bad parking scrape. The colour match is perfect — I genuinely cannot find where the damage was, and I know where to look.',
  },
  {
    name: 'Vikas Hooda', car: 'Honda City', initial: 'V',
    text: 'Clutch replacement. They laid out the OEM option and the cheaper one, explained what actually differs, and let me decide instead of choosing for me.',
  },
];

/* The three offers that lead the page. `tone` selects a gradient from the
   brand family in the stylesheet — varied enough to give the strip colour,
   close enough that it still reads as one set. */
const PROMOS = [
  {
    icon: Truck, tone: 'blue', img: '/promos/pickup.webp',
    kicker: 'Included, always',
    title: 'Free pickup & drop',
    desc: 'We collect the car from your door anywhere in Rohtak and bring it back washed. No delivery charge, no minimum bill.',
    to: '/services',
  },
  {
    icon: Headset, tone: 'cyan', img: '/promos/roadside.webp',
    kicker: 'One call',
    title: 'Roadside breakdown',
    desc: 'Flat battery, puncture, or it simply will not start. Call the workshop and somebody comes out to you.',
    href: `tel:${BIZ.phoneTel}`,
  },
  {
    icon: Shield, tone: 'navy', img: '/promos/claims.webp',
    kicker: 'We handle it',
    title: 'Cashless insurance claims',
    desc: 'Surveyor coordination, paperwork and follow-up done for you. You pay the excess, we deal with the insurer.',
    to: '/services?category=12',
  },
];

/* ── Insurance ─────────────────────────────────────────────────────────────
   GK Motors does not sell cars. It sells service, spares, and — the part that
   was buried as one tile in a twelve-tile grid — insurance claim work. A claim
   is the highest-value job a workshop like this takes and the one a customer
   is most anxious about, so it gets its own section rather than a price card.

   The four steps describe what actually happens, in the order it happens, and
   each one names who does the work. That is the whole argument: the customer
   makes one phone call and the workshop does the rest. */
const CLAIM_STEPS = [
  { n: '01', icon: MessageCircle, title: 'Send us the damage',   desc: 'WhatsApp a few photos. We tell you honestly whether claiming is worth it, or whether paying cash will cost you less over the policy term.' },
  { n: '02', icon: Shield,        title: 'We file the claim',    desc: 'We raise it with your insurer and coordinate the surveyor visit. You do not chase anyone.' },
  { n: '03', icon: Wrench,        title: 'Cashless repair',      desc: 'Approved work carried out with genuine panels and matched paint, in our own bays.' },
  { n: '04', icon: Car,           title: 'You collect and go',   desc: 'Pay only the excess your policy specifies. The insurer settles the rest directly with us.' },
];

/* What the customer is charged for, spelled out. The point of the table is the
   last row: everything above it is free, and the one thing that is not is set
   by their policy rather than by us. */
const CLAIM_COSTS = [
  { label: 'Claim filing & paperwork',   value: 'Free',  free: true },
  { label: 'Surveyor coordination',      value: 'Free',  free: true },
  { label: 'Pickup & drop',              value: 'Free',  free: true },
  { label: 'Your policy excess',         value: 'As per your policy', free: false },
];

/* ⚠ CONFIRM BEFORE LAUNCH. Naming an insurer here tells a customer you handle
   their claims. Cut any of these GK Motors does not actually work with — an
   owner who picks the workshop because their insurer is on this list and then
   finds out otherwise is a complaint, not a customer. */
const INSURERS = [
  'HDFC ERGO', 'ICICI Lombard', 'Bajaj Allianz', 'TATA AIG', 'New India Assurance',
  'Reliance General', 'Go Digit', 'SBI General', 'Cholamandalam MS', 'IFFCO Tokio',
];

const HOME_CATEGORY_COUNT = 8;
const HOME_PART_COUNT = 5;

/* ═══════════════════════════════════════════════════════════════════════════
   THE LOGO RING
   The dotted ring around the GK Motors badge, redrawn as a rotating SVG. It is
   the single most recognisable piece of the brand and it costs nothing to
   render, so it does the ambient work a stock car photograph was doing badly.
   ═══════════════════════════════════════════════════════════════════════════ */
function LogoRing() {
  return (
    <svg className="gk-ring" viewBox="0 0 400 400" aria-hidden="true">
      {/* Outer travelling ring — long dashes, slow. */}
      <circle cx="200" cy="200" r="186" fill="none" stroke="rgba(0,178,240,.20)"
        strokeWidth="1.5" strokeDasharray="3 14" className="gk-ring-a" />
      {/* The badge's bead ring: 32 dots on a circle, placed by trigonometry so
          the spacing is exact rather than eyeballed. */}
      <g className="gk-ring-b">
        {Array.from({ length: 32 }, (_, i) => {
          const a = (i / 32) * Math.PI * 2;
          return (
            <circle key={i}
              cx={200 + Math.cos(a) * 158}
              cy={200 + Math.sin(a) * 158}
              r={i % 4 === 0 ? 3.4 : 1.8}
              fill={i % 4 === 0 ? 'rgba(111,216,255,.55)' : 'rgba(111,216,255,.22)'} />
          );
        })}
      </g>
      {/* Inner arc — a single sweep, counter-rotating, to give the group depth. */}
      <circle cx="200" cy="200" r="126" fill="none" stroke="rgba(21,103,211,.34)"
        strokeWidth="2" strokeDasharray="150 470" strokeLinecap="round" className="gk-ring-c" />
      <circle cx="200" cy="200" r="126" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="1" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Home() {
  const [packages, setPackages] = useState([]);
  const [serviceCategories, setServiceCategories] = useState(FALLBACK_CATEGORIES);
  const [parts, setParts] = useState([]);
  const [servicesExpanded, setServicesExpanded] = useState(false);
  const [partsLoading, setPartsLoading] = useState(true);
  const [partsError, setPartsError] = useState(false);

  /* ── Service categories ─────────────────────────────────────────────────
     One request on the happy path. /service-categories already returns each
     category WITH its packages attached, so the older arrangement — a
     Promise.all over that plus a flat /services/categories list, purely to
     work out each category's cheapest price — fetched the same package
     documents twice on the landing page's critical path.

     It also had a real fault: Promise.all rejects as a whole, so a failure of
     the flat endpoint discarded the taxonomy response alongside it and the
     page fell all the way back to hardcoded categories. The degraded path is
     preserved rather than dropped — if the taxonomy request fails or comes
     back empty, the flat endpoint is still called so live prices continue to
     appear against the fallback list. Two requests then, but only then. */
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
            };
          })
        );
        setPackages(live.flatMap((c) => c.packages || []));
        return true;
      })
      .catch((err) => {
        console.error('[Home.getCategories]', err);
        return false;
      })
      .then((served) => {
        if (served || cancelled) return undefined;
        return getServiceCategories()
          .then(({ data }) => { if (!cancelled) setPackages(data.categories || []); })
          .catch((err) => console.error('[Home.getServiceCategories fallback]', err));
      });

    return () => { cancelled = true; };
  }, []);

  /* ── Shop strip ─────────────────────────────────────────────────────────
     Only HOME_PART_COUNT cards render, so only that many are requested — this
     endpoint was previously unbounded and returned the whole featured
     catalogue for the client to throw all but five away. */
  const fetchParts = useCallback(() => {
    setPartsLoading(true);
    setPartsError(false);
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
      .then((list) => setParts(list.slice(0, HOME_PART_COUNT)))
      .catch((err) => {
        console.error('[Home.loadShopStrip]', err);
        setPartsError(true);
      })
      .finally(() => setPartsLoading(false));
  }, []);

  /* The parts strip sits several screens below the fold, yet its requests used
     to leave in the same burst as everything the visitor can actually see. One
     IntersectionObserver, disconnected the moment it fires, with 600px of
     rootMargin so the fetch still starts well before the strip scrolls in.
     Deliberately not a scroll listener and not one observer per card — this
     adds no per-frame work to the scroll path. */
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
      (entries) => { if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); } },
      { rootMargin: '600px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [fetchParts]);

  /* Category "from" prices. Memoised on the two inputs it derives from: this
     used to build a brand-new array of brand-new objects on every render, so
     the twelve service cards could never be skipped no matter what had
     actually changed — and the parts strip alone flips state three times. */
  const categories = useMemo(
    () => serviceCategories.map((cat) => {
      const priced = packages.filter((p) => p.categoryId === cat.id && p.basePrice > 0);
      const cheapest = priced.length
        ? Math.min(...priced.map((p) => p.basePrice))
        : (cat.fromPrice || 499);
      return { ...cat, price: Number(cheapest) };
    }),
    [serviceCategories, packages]
  );

  /* The next collection the workshop could actually make, in Rohtak's own
     time. This was hardcoded to "today, 4:00 PM", which at three in the
     morning was advertising a pickup from a shut workshop. useMemo with no
     deps: computed once per mount, which is right for a landing page nobody
     leaves open across the boundary — and if they do, the page they came for
     is the booking flow, which recalculates properly. */
  const pickup = useMemo(() => nextPickupSlot(), []);

  const shownCategories = servicesExpanded ? categories : categories.slice(0, HOME_CATEGORY_COUNT);
  const quoteTotal = SAMPLE_QUOTE.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div style={{ background: C.white, width: '100%', maxWidth: '100%', position: 'relative' }}>
      <style>{HOME_STYLES}</style>

      {/* ══════════════════════════════════════════════════════════════════
          1 · HERO
          Two columns: the argument on the left, the proof on the right. The
          right column is the estimate a customer actually receives, not a
          photograph of a car nobody here owns.
          ══════════════════════════════════════════════════════════════════ */}
      <section className="gk-dark gk-hero">
        <div className="gk-bloom gk-bloom--a" />
        <div className="gk-bloom gk-bloom--b" />
        <div className="gk-mesh" />

        <ScrollWheel className="gk-wheel gk-wheel--lg" factor={0.16} idle={4} stiffness={30} />

        <div className="gk-wrap gk-hero-inner">
          <div className="gk-hero-grid">

            {/* ── LEFT: the argument ─────────────────────────────────────── */}
            <div className="gk-hero-copy">
              <Reveal y={20} duration={0.6}>
                <a href={BIZ.mapsUrl} target="_blank" rel="noreferrer noopener" className="gk-loc">
                  <span className="gk-dot" />
                  <MapPin size={13} />
                  <span>{BIZ.addressShort}</span>
                  <ChevronRight size={13} className="gk-loc-arrow" />
                </a>
              </Reveal>

              <Reveal y={24} delay={0.06}>
                {/* Reverted to the logo's own wording on request. Noted for
                    the record: "Sale" is the one of the three GK Motors does
                    not do — the lede immediately below carries the correction
                    by spelling out service, spares and insurance, so nobody
                    reads the headline as an offer to sell them a car. */}
                <h1 className="gk-h1 gk-hero-h1">
                  Sale. Spare.<br />
                  <span className="gk-grad gk-grad--dark">Service.</span>
                </h1>
              </Reveal>

              <Reveal y={24} delay={0.13}>
                {/* Two ledes, one shown at a time. On a phone the long version
                    pushed the buttons and the car below the fold, and nobody
                    reads four lines of body copy above a call to action. The
                    short one carries the same three claims in eleven words. */}
                <p className="gk-lede gk-lede--dark gk-hero-lede gk-hero-lede--long">
                  One workshop on Sheela Bypass for all three: we service every make on
                  the road, stock the genuine parts to do it, and handle your insurance
                  claim end to end. Itemised quote first, old parts handed back.
                </p>
                <p className="gk-lede gk-lede--dark gk-hero-lede gk-hero-lede--short">
                  Every make on the road, serviced in Rohtak. Genuine parts, an
                  itemised quote before we start.
                </p>
              </Reveal>

              <Reveal y={24} delay={0.2}>
                <div className="gk-hero-ctas">
                  <Link to="/services" className="gk-btn gk-btn--primary gk-btn--lg">
                    <Wrench size={17} /> Book a service
                  </Link>
                  <a href={`tel:${BIZ.phoneTel}`} className="gk-btn gk-btn--ghost gk-btn--lg">
                    <Phone size={17} /> {BIZ.phoneDisplay}
                  </a>
                </div>
              </Reveal>

              <Reveal y={20} delay={0.28}>
                <ul className="gk-hero-proof">
                  {HERO_PROOF.map(({ icon: Icon, label }) => (
                    <li key={label}>
                      <span className="gk-hero-proof-ico"><Icon size={13} /></span>
                      {label}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            {/* ── RIGHT: the proof ───────────────────────────────────────── */}
            <div className="gk-hero-visual">
              <LogoRing />

              {/* The SUV. mix-blend-mode: screen is what dissolves the
                  render's black backdrop into the hero: screen leaves any
                  pixel that is already black exactly as the layer beneath it,
                  so the corners become the hero gradient with no visible
                  bounding box, while the silver body and the blue glow stay
                  bright. That is why the artwork does not need a real alpha
                  channel to sit cleanly on this section. */}
              <ScrollRecede className="gk-hero-car-wrap" rotate={16} lift={55}>
                <Parallax distance={26}>
                  <img
                    className="gk-hero-car"
                    src="/hero/car.webp"
                    alt="A modern SUV of the kind serviced daily at GK Motors, Rohtak"
                    width={1200}
                    height={800}
                    fetchPriority="high"
                    decoding="async"
                  />
                </Parallax>
              </ScrollRecede>

              <ScrollRecede className="gk-quote-wrap" rotate={24} lift={70}>
                <Parallax distance={12}>
                <motion.div
                  className="gk-quote"
                  initial={{ opacity: 0, y: 34, rotateX: 10 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <header className="gk-quote-head">
                    {/* The car itself, not a generic blue icon. It is the same
                        render as the hero above, which is the point: this is
                        the estimate for the car you are looking at. */}
                    <span className="gk-quote-thumb">
                      <img src="/hero/car.webp" alt="" aria-hidden="true"
                        width={1200} height={800} decoding="async" />
                    </span>
                    <span className="gk-quote-title">
                      <b>Hyundai Creta</b>
                      {/* It was not obvious this was an EXAMPLE of the message
                          a customer receives rather than a live control they
                          were meant to interact with. Now it says so. */}
                      <span>Example of the estimate we WhatsApp you</span>
                    </span>
                  </header>

                  {/* A real route, not a decorative control. It goes to the
                      booking flow, which opens on the car selector — so the
                      obvious question this card raises ("but that is not my
                      car") has an answer one tap away. */}
                  <Link to="/services" className="gk-quote-change">
                    <Pencil size={12} /> Not your car? Pick yours
                  </Link>

                  <ul className="gk-quote-rows">
                    {SAMPLE_QUOTE.map((row) => (
                      <li key={row.label}>
                        <span className="gk-quote-row-txt">
                          <b>{row.label}</b>
                          <span>{row.note}</span>
                        </span>
                        <span className={row.amount === 0 ? 'gk-quote-free' : 'gk-quote-amt'}>
                          {row.amount === 0 ? 'Free' : `₹${row.amount.toLocaleString('en-IN')}`}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <footer className="gk-quote-foot">
                    <span className="gk-quote-total-lab">Total, all in</span>
                    <span className="gk-quote-total">₹{quoteTotal.toLocaleString('en-IN')}</span>
                  </footer>

                  <div className="gk-quote-pickup">
                    <Truck size={14} />
                    <span>
                      <b>Free pickup from Rohtak &middot; {pickup.when}</b>
                      <small>{pickup.readyBy}</small>
                    </span>
                  </div>
                </motion.div>
                </Parallax>
              </ScrollRecede>

              {/* The two floating chips that used to sit here are gone. They
                  were positioned against this container rather than against
                  the card, so on a wide screen they drifted inward and landed
                  on top of the estimate — one covering the "Approved" flag,
                  the other the pickup row. They also only repeated claims the
                  proof list on the left already makes, so there was nothing
                  to save by repositioning them. */}
            </div>
          </div>
        </div>

        {/* Scroll cue. Hidden once the hero is out of the way — a permanent
            "scroll down" arrow halfway down a page is noise. */}
        <div className="gk-scroll-cue" aria-hidden="true">
          <span className="gk-scroll-cue-rail"><span /></span>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          2 · BRAND RAIL
          Sits directly under the hero, on the light surface, because the
          first question a customer asks is "do you even work on my car?"
          ══════════════════════════════════════════════════════════════════ */}
      <section className="gk-brands">
        <div className="gk-wrap">
          <Reveal y={18}>
            <p className="gk-brands-lead">
              <span>Every make on the road in Haryana</span>
              <span className="gk-brands-sub">Hatchback, sedan, SUV, diesel, CNG — if it runs, it fits on our ramp.</span>
            </p>
          </Reveal>
        </div>
        <Reveal y={18} delay={0.1}>
          <BrandRail />
        </Reveal>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          2b · PROMO BANNERS
          Three things that are free or included, stated plainly and made
          clickable. Deliberately placed high — above the services grid —
          because "free pickup" and "we come to you when you break down" are
          what actually differentiate this workshop from the one down the
          road, and burying them under twelve price cards wastes them.

          Every card is a real destination, not decoration: two go to the
          booking flow, one dials the workshop.
          ══════════════════════════════════════════════════════════════════ */}
      <section className="gk-sec-sm" style={{ background: C.white }}>
        <div className="gk-wrap">
          <Stagger className="gk-promos" gap={0.09}>
            {PROMOS.map(({ icon: Icon, kicker, title, desc, to, href, tone, img }) => {
              const inner = (
                <>
                  {/* Decorative: the card's own heading already says what this
                      is, so an alt string here would just be read twice. */}
                  <img className="gk-promo-img" src={img} alt="" aria-hidden="true"
                    loading="lazy" decoding="async" width={800} height={533} />
                  <span className="gk-promo-ico"><Icon size={26} /></span>
                  <span className="gk-promo-kicker">{kicker}</span>
                  <span className="gk-promo-title">{title}</span>
                  <span className="gk-promo-desc">{desc}</span>
                  <span className="gk-promo-go"><ArrowRight size={16} /></span>
                </>
              );
              return (
                <StaggerItem key={title} depth={12} style={{ display: 'flex' }}>
                  {/* An external tel: link cannot be a <Link> — that would push
                      "tel:..." onto the router history instead of dialling. */}
                  {href
                    ? <a href={href} className="gk-promo" data-tone={tone}>{inner}</a>
                    : <Link to={to} className="gk-promo" data-tone={tone}>{inner}</Link>}
                </StaggerItem>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          3 · SERVICES
          ══════════════════════════════════════════════════════════════════ */}
      <section id="services" className="gk-sec" style={{ background: C.white, position: 'relative', overflow: 'hidden' }}>
        <ScrollWheel className="gk-wheel gk-wheel--light gk-wheel--svc" factor={0.12} idle={3} stiffness={26} />
        <div className="gk-wrap">
          <Reveal className="gk-head">
            <p className="gk-eyebrow gk-eyebrow--center">What we do</p>
            <h2 className="gk-h2">
              Everything your car needs,{' '}
              <span className="gk-grad">under one roof</span>
            </h2>
            <p className="gk-lede">
              Twelve service lines, one workshop, one invoice. Prices below are real
              starting points — not teasers that change when you arrive.
            </p>
          </Reveal>

          {/* The key is load-bearing, not decoration.
              Stagger's entrance is `whileInView` with `once: true`, so once it
              has fired it never fires again. Cards added afterwards by "Show
              all 12" mounted into an already-finished parent, inherited its
              `initial="hidden"` variant, and had nothing left to animate them
              to "show" — so they sat at opacity 0, invisible but still taking
              up a full grid row. That was the large blank gap between the
              cards and the buttons below them.

              Keying on the expanded flag remounts the group, which re-arms the
              observer and replays the cascade over the full set. The replay is
              a deliberate side effect: expanding is a direct user action, so
              seeing the grid restage reads as a response to the click. */}
          <Stagger
            key={servicesExpanded ? 'svc-all' : 'svc-top'}
            className="gk-svc-grid"
            gap={0.045}
          >
            {shownCategories.map(({ id, slug, label, desc, icon: Icon, price }) => (
              <StaggerItem key={id} depth={14} style={{ display: 'flex' }}>
                {/* No pointer tilt. Twelve cards each rotating a few degrees
                    under the cursor made the grid look knocked out of
                    alignment rather than responsive. The lift and the drawn
                    top edge carry the hover state on their own. */}
                <Link to={`/services?category=${id}`} className="gk-card gk-svc" data-slug={slug}>
                  <span className="gk-chip"><Icon size={23} /></span>

                  <h3 className="gk-h3 gk-svc-title">{label}</h3>
                  <p className="gk-svc-desc">{desc}</p>

                  <span className="gk-svc-foot">
                    <span className="gk-svc-price">
                      <small>from</small> ₹{price.toLocaleString('en-IN')}
                    </span>
                    <span className="gk-svc-go"><ArrowRight size={15} /></span>
                  </span>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal y={16} className="gk-svc-actions">
            {categories.length > HOME_CATEGORY_COUNT && (
              <button
                type="button"
                className="gk-btn gk-btn--outline gk-btn--sm"
                onClick={() => setServicesExpanded((v) => !v)}
                aria-expanded={servicesExpanded}
                aria-controls="services"
              >
                {servicesExpanded
                  ? 'Show fewer'
                  : `Show all ${categories.length} services`}
                <ChevronDown size={15} style={{
                  transition: 'transform .3s',
                  transform: servicesExpanded ? 'rotate(180deg)' : 'none',
                }} />
              </button>
            )}
            <Link to="/services" className="gk-btn gk-btn--primary gk-btn--sm">
              Book a service <ArrowRight size={15} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          4 · SHOP STRIP — parts, directly after the services they belong to
          ══════════════════════════════════════════════════════════════════ */}
      <section
        ref={shopRef}
        className="gk-sec"
        style={{ background: C.surface, borderBlock: `1px solid ${C.hairline}` }}
      >
        <div className="gk-wrap">
          <Reveal className="gk-shop-head">
            <div className="gk-shop-copy">
              <p className="gk-eyebrow">The counter</p>
              <h2 className="gk-h2">
                Genuine parts, <span className="gk-grad">at workshop price</span>
              </h2>
              <p className="gk-lede" style={{ marginTop: '0.85rem' }}>
                Oils, filters, batteries, brake pads and accessories — the same stock we
                fit in the bays, on the same shelf, at the same price. Buy them for your
                own garage or have us fit them during your service.
              </p>
              <Link to="/parts" className="gk-btn gk-btn--primary gk-btn--sm" style={{ marginTop: '1.4rem' }}>
                Browse everything <ArrowRight size={15} />
              </Link>
            </div>

            <div className="gk-shop-shot">
              <img src="/shop/parts.webp"
                alt="Oils, filters, batteries and brake parts on the shelf at GK Motors"
                width={1400} height={875} loading="lazy" decoding="async" />
            </div>
          </Reveal>

          <SectionBoundary name="shop strip">
            {partsLoading ? (
              <div className="gk-parts-grid" aria-busy="true" aria-live="polite">
                <span className="gk-sr">Loading products…</span>
                {[...Array(HOME_PART_COUNT)].map((_, i) => <PartCardSkeleton key={i} />)}
              </div>
            ) : partsError ? (
              <div className="gk-card gk-state">
                <AlertCircle size={34} style={{ color: C.red }} />
                <h3 className="gk-h3">Could not load the shop</h3>
                <p className="gk-lede">Something went wrong fetching parts. The workshop is still open.</p>
                <button type="button" onClick={fetchParts} className="gk-btn gk-btn--primary gk-btn--sm">
                  <RefreshCw size={14} /> Try again
                </button>
              </div>
            ) : parts.length === 0 ? (
              <div className="gk-card gk-state">
                <Sparkles size={34} style={{ color: C.blue }} />
                <h3 className="gk-h3">Nothing listed yet</h3>
                <p className="gk-lede">The counter is being stocked. Call us and we will source what you need.</p>
                <a href={`tel:${BIZ.phoneTel}`} className="gk-btn gk-btn--primary gk-btn--sm">
                  <Phone size={14} /> {BIZ.phoneDisplay}
                </a>
              </div>
            ) : (
              <Stagger className="gk-parts-grid" gap={0.06}>
                {/* StaggerItem is deliberately left as a block, not a flex
                    box: PartCard's root sets height:100% but no width, so as
                    a flex item it would shrink to its content instead of
                    filling the grid cell. As a block child of a stretched
                    grid item it gets both dimensions for free. */}
                {parts.map((part) => (
                  <StaggerItem key={part._id}>
                    <PartCard part={part} />
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </SectionBoundary>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          4b · INSURANCE CLAIMS
          Directly after the parts counter, and dark — the three sections
          before it are all light, so the tonal switch is what makes this read
          as a distinct offer rather than another row of cards.

          It is the only section on the page with its own full-width banner
          treatment, which is deliberate: a claim is the biggest single job
          that comes through the door.
          ══════════════════════════════════════════════════════════════════ */}
      <section id="insurance" className="gk-dark gk-sec gk-ins-sec">
        {/* Deliberately a scuffed panel and not a wreck. A crash photo makes
            people anxious; a kerbed door makes them think "that is my car, I
            should claim that". */}
        <img className="gk-ins-bg" src="/insurance/damage.webp" alt="" aria-hidden="true"
          loading="lazy" decoding="async" />
        <RollingWheel className="gk-roll gk-roll--dark" size={230} direction={1} bottom="-6%" />
        <div className="gk-bloom gk-bloom--b" />
        <div className="gk-mesh" />

        <div className="gk-wrap">
          <div className="gk-ins-top">
            <Reveal x={-20} y={0}>
              <p className="gk-eyebrow gk-eyebrow--dark">Insurance claims</p>
              <h2 className="gk-h2" style={{ color: C.white }}>
                Someone hit your car.<br />
                <span className="gk-grad gk-grad--dark">Don&rsquo;t pay for it twice.</span>
              </h2>
              <p className="gk-lede gk-lede--dark" style={{ marginTop: '1.1rem', maxWidth: 480 }}>
                Most people skip a claim because the paperwork is worse than the dent.
                We do the paperwork. You make one phone call and pay only what your
                policy says you owe.
              </p>

              <div className="gk-ins-ctas">
                <Link to="/services?category=12" className="gk-btn gk-btn--primary gk-btn--lg">
                  <Shield size={17} /> Start a claim
                </Link>
                <a href={`https://wa.me/${BIZ.whatsapp}`} target="_blank" rel="noreferrer noopener"
                  className="gk-btn gk-btn--ghost gk-btn--lg">
                  <MessageCircle size={17} /> Send photos on WhatsApp
                </a>
              </div>
            </Reveal>

            {/* The cost table. Its job is the contrast between three "Free"
                rows and one row we explicitly do NOT control. */}
            <Reveal x={20} y={0} delay={0.1} className="gk-ins-costcard">
              <p className="gk-ins-costhead">What a claim costs you</p>
              <ul className="gk-ins-costs">
                {CLAIM_COSTS.map(({ label, value, free }) => (
                  <li key={label}>
                    <span className="gk-ins-cost-lab">
                      {free && <Check size={14} />}
                      {label}
                    </span>
                    <span className={free ? 'gk-ins-cost-free' : 'gk-ins-cost-val'}>{value}</span>
                  </li>
                ))}
              </ul>
              <p className="gk-ins-costnote">
                No filing fee, no &ldquo;handling charge&rdquo;, no cut of your settlement.
              </p>
            </Reveal>
          </div>

          <Stagger className="gk-ins-steps" gap={0.08}>
            {CLAIM_STEPS.map(({ n, icon: Icon, title, desc }) => (
              <StaggerItem key={n} depth={14}>
                <div className="gk-ins-step">
                  <span className="gk-ins-step-n">{n}</span>
                  <span className="gk-ins-step-ico"><Icon size={19} /></span>
                  <h3 className="gk-ins-step-title">{title}</h3>
                  <p className="gk-ins-step-desc">{desc}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal y={18} className="gk-ins-insurers">
            <span className="gk-ins-insurers-lab">Claims filed with</span>
            <ul>
              {INSURERS.map((name) => <li key={name}>{name}</li>)}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          5 · WHY US — bento
          An asymmetric grid rather than the previous flat blue slab of five
          identical items. The two claims that actually win the job get double
          width; the four supporting ones sit beneath at single width.
          ══════════════════════════════════════════════════════════════════ */}
      <section className="gk-sec" style={{ background: C.surface, borderBlock: `1px solid ${C.hairline}` }}>
        <div className="gk-wrap">
          <Reveal className="gk-head">
            <p className="gk-eyebrow gk-eyebrow--center">Why GK Motors</p>
            <h2 className="gk-h2">
              The part most workshops{' '}
              <span className="gk-grad">get wrong</span>
            </h2>
            <p className="gk-lede">
              It is almost never the mechanics. It is the bill you did not agree to and
              the part you never got to see.
            </p>
          </Reveal>

          <Stagger className="gk-bento" gap={0.06}>
            {WHY_US.map(({ icon: Icon, title, desc, span }) => (
              <StaggerItem key={title} className="gk-bento-cell" style={{ '--span': span }}>
                <div className="gk-card gk-bento-card">
                  <span className="gk-chip gk-chip--sm"><Icon size={19} /></span>
                  <h3 className="gk-h3">{title}</h3>
                  <p className="gk-bento-desc">{desc}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          6 · HOW IT WORKS
          The spine between the steps fills as the section is scrolled, so the
          four cards read as one journey being travelled rather than four
          unrelated boxes.
          ══════════════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="gk-sec" style={{ background: C.white }}>
        <div className="gk-wrap">
          <Reveal className="gk-head">
            <p className="gk-eyebrow gk-eyebrow--center">How it works</p>
            <h2 className="gk-h2">
              Four steps. <span className="gk-grad">No surprises.</span>
            </h2>
          </Reveal>

          {/* Four cards became one drawn line — see ProcessFlow. Four
              bordered boxes say "here are four things"; a line through four
              nodes says "here is one journey", which is what this section
              actually means. */}
          <ProcessFlow steps={HOW_IT_WORKS} />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          7 · NUMBERS + REVIEWS
          ══════════════════════════════════════════════════════════════════ */}
      <section className="gk-sec" style={{ background: C.white, overflow: 'hidden', position: 'relative' }}>
        <ScrollWheel className="gk-wheel gk-wheel--light gk-wheel--rev" factor={0.15} idle={3.5} stiffness={34} />
        <div className="gk-wrap">

          <Stagger className="gk-stats" gap={0.09}>
            {STATS.map(({ to, suffix, label, icon: Icon }) => (
              <StaggerItem key={label} className="gk-stat">
                <span className="gk-stat-ico"><Icon size={18} /></span>
                <CountUp to={to} suffix={suffix} className="gk-stat-val" />
                <span className="gk-stat-lab">{label}</span>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal className="gk-head" style={{ marginTop: 'clamp(3rem, 6vw, 5rem)' }}>
            <p className="gk-eyebrow gk-eyebrow--center">In their words</p>
            <h2 className="gk-h2">
              What Rohtak <span className="gk-grad">says about us</span>
            </h2>
            {/* No star figure is printed here on purpose. Rather than publish a
                rating nobody has verified, this links to the live Google
                listing — which is both honest and more persuasive. */}
            <a href={BIZ.mapsUrl} target="_blank" rel="noreferrer noopener" className="gk-reviews-link">
              <span className="gk-stars">
                {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={C.gold} color={C.gold} />)}
              </span>
              Read the reviews on Google
              <ChevronRight size={14} />
            </a>
          </Reveal>

          <SectionBoundary name="reviews">
            <Stagger className="gk-reviews" gap={0.06}>
              {TESTIMONIALS.map(({ name, car, text, initial, img }) => (
                <StaggerItem key={name} depth={12} style={{ display: 'flex' }}>
                  <figure className="gk-card gk-review">
                    <span className="gk-review-mark" aria-hidden="true">&rdquo;</span>
                    <blockquote className="gk-review-text">{text}</blockquote>
                    <figcaption className="gk-review-by">
                      {img
                        ? <img className="gk-review-avatar" src={img} alt=""
                            width={38} height={38} loading="lazy" decoding="async" />
                        : <span className="gk-review-avatar" aria-hidden="true">{initial}</span>}
                      <span className="gk-review-who">
                        <b>{name}</b>
                        <span>{car}</span>
                      </span>
                      <span className="gk-stars gk-review-stars">
                        {[...Array(5)].map((_, i) => <Star key={i} size={12} fill={C.gold} color={C.gold} />)}
                      </span>
                    </figcaption>
                  </figure>
                </StaggerItem>
              ))}
            </Stagger>
          </SectionBoundary>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          8 · VISIT / CTA
          The address, the hours and the phone number as the closing argument.
          A local workshop's strongest card is that it is a real place you can
          drive to, so the page ends by saying exactly where.
          ══════════════════════════════════════════════════════════════════ */}
      <section className="gk-dark gk-sec-lg gk-visit-sec">
        {/* Footage of the bays, behind everything. "Come and see" is a much
            stronger invitation when you can already see it. */}
        <AmbientVideo
          className="gk-visit-media"
          src="/hero/video1.mp4"
          poster="/workshop/bay-dark.webp"
        />
        <div className="gk-bloom gk-bloom--b" />

        <div className="gk-wrap">
          <div className="gk-visit">
            <Reveal className="gk-visit-copy" x={-24} y={0}>
              <p className="gk-eyebrow gk-eyebrow--dark">Come and see</p>
              <h2 className="gk-h2" style={{ color: C.white }}>
                We&rsquo;re on Sheela Bypass,<br />
                <span className="gk-grad gk-grad--dark">near the railway crossing</span>
              </h2>
              <p className="gk-lede gk-lede--dark" style={{ marginTop: '1rem', maxWidth: 460 }}>
                Drive in for a free look-over, or book online and we will come and collect
                the car. No appointment needed to just ask a question.
              </p>

              <div className="gk-visit-ctas">
                <Link to="/services" className="gk-btn gk-btn--primary gk-btn--lg">
                  <Calendar size={17} /> Book a slot
                </Link>
                <a href={BIZ.mapsUrl} target="_blank" rel="noreferrer noopener"
                  className="gk-btn gk-btn--ghost gk-btn--lg">
                  <Navigation size={17} /> Get directions
                </a>
              </div>
            </Reveal>

            <Reveal className="gk-visit-card" x={24} y={0} delay={0.1}>
              <ul className="gk-visit-rows">
                <li>
                  <span className="gk-chip gk-chip--sm gk-chip--on"><MapPin size={18} /></span>
                  <span className="gk-visit-row-txt">
                    <b>{BIZ.name}</b>
                    <span>{BIZ.addressLine1}<br />{BIZ.addressLine2}</span>
                  </span>
                </li>
                <li>
                  <span className="gk-chip gk-chip--sm"><Phone size={18} /></span>
                  <span className="gk-visit-row-txt">
                    <b>
                      <a href={`tel:${BIZ.phoneTel}`} className="gk-visit-tel">{BIZ.phoneDisplay}</a>
                    </b>
                    <span>Call or WhatsApp — someone always picks up</span>
                  </span>
                </li>
                <li>
                  <span className="gk-chip gk-chip--sm"><Clock size={18} /></span>
                  {/* Both lines, rather than a live "Open now" badge. A badge
                      that claims to know the current state has to actually
                      know it — day, hour and holidays, in IST regardless of
                      the visitor's device clock — and one that is wrong on a
                      Sunday afternoon costs more trust than it ever built. */}
                  <span className="gk-visit-row-txt">
                    <b>{BIZ.hours}</b>
                    <span>{BIZ.hoursSunday}</span>
                  </span>
                </li>
                <li>
                  <span className="gk-chip gk-chip--sm"><Headset size={18} /></span>
                  <span className="gk-visit-row-txt">
                    <b>Roadside breakdown</b>
                    <span>Stuck somewhere in Rohtak? Call the same number.</span>
                  </span>
                </li>
              </ul>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE STYLES
   Section-specific rules only. Anything reusable — buttons, cards, chips,
   headings, the dark-section furniture — lives in src/styles/gk-system.css so
   the nav, the footer and the inner pages share it.
   ═══════════════════════════════════════════════════════════════════════════ */
const HOME_STYLES = `
  .gk-sr {
    position: absolute; width: 1px; height: 1px; overflow: hidden;
    clip: rect(0 0 0 0); white-space: nowrap;
  }

  /* ── 1 · Hero ──────────────────────────────────────────────────────────── */
  /* Tighter than it was. The right column (car + estimate card stacked) is
     the tallest thing in the grid, and with align-items:center the shorter
     copy column was being centred against it — which is where the large band
     of empty navy above the location pill came from. Less padding here plus a
     capped car below closes it up. */
  .gk-hero { padding-block: clamp(2rem, 4vw, 3.25rem) clamp(2.5rem, 5vw, 4rem); }
  .gk-hero-inner { position: relative; z-index: 1; }

  .gk-hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
    gap: clamp(2rem, 5vw, 4.5rem);
    align-items: center;
  }
  /* Single column well before the point at which the estimate card would be
     squeezed — the card has a lot of small type in it and is the first thing
     to become unreadable. */
  @media (max-width: 960px) {
    .gk-hero-grid { grid-template-columns: minmax(0, 1fr); gap: 3rem; }
  }

  /* Location chip. A link, not a label — it opens the Google listing. */
  .gk-loc {
    display: inline-flex; align-items: center; gap: 0.5rem;
    padding: 0.45rem 0.85rem 0.45rem 0.7rem;
    border-radius: 999px;
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.12);
    color: #CFE2F5; text-decoration: none;
    font-size: 0.78rem; font-weight: 600; letter-spacing: .01em;
    transition: border-color .3s, background .3s, color .3s;
  }
  .gk-loc:hover { border-color: rgba(0,178,240,.45); background: rgba(0,178,240,.10); color: #FFF; }
  .gk-loc-arrow { transition: transform .3s; opacity: .6; }
  .gk-loc:hover .gk-loc-arrow { transform: translateX(3px); opacity: 1; }

  .gk-hero-h1 { color: #FFFFFF; margin-top: 1.4rem; }
  .gk-hero-lede { margin-top: 1.3rem; max-width: 30rem; }

  .gk-hero-ctas { display: flex; flex-wrap: wrap; gap: 0.85rem; margin-top: 2.1rem; }
  /* Below 420px two side-by-side buttons each get about 150px, which is not
     enough for "093559 99664" plus an icon. Stacked full-width instead. */
  @media (max-width: 420px) {
    .gk-hero-ctas { flex-direction: column; align-items: stretch; }
    .gk-hero-ctas .gk-btn { width: 100%; }
  }

  .gk-hero-proof {
    display: flex; flex-wrap: wrap; gap: 0.6rem 1.5rem;
    margin: 2.2rem 0 0; padding: 1.4rem 0 0;
    list-style: none;
    border-top: 1px solid rgba(255,255,255,.09);
  }
  .gk-hero-proof li {
    display: inline-flex; align-items: center; gap: 0.55rem;
    color: #D6E6F5; font-size: 0.83rem; font-weight: 600; white-space: nowrap;
  }
  .gk-hero-proof-ico {
    width: 24px; height: 24px; border-radius: 8px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(0,178,240,.14); color: var(--gk-cyan-soft);
    border: 1px solid rgba(0,178,240,.2);
  }

  /* ── Hero visual ───────────────────────────────────────────────────────── */
  /* A column, not a centred row: the car sits on top and the estimate card
     tucks under its front wing. align-items:flex-start keeps the card at its
     own width rather than stretching it to the car's. */
  .gk-hero-visual {
    position: relative;
    display: flex; flex-direction: column;
    align-items: flex-start; justify-content: center;
    min-height: 400px;
  }
  @media (max-width: 960px) {
    .gk-hero-visual { min-height: 0; align-items: center; }
  }

  /* The logo ring, sitting behind the estimate card. Larger than its parent on
     purpose, with the parent NOT clipping — the dark section's own
     overflow:hidden is what contains it.

     Centred explicitly rather than left to its static position: an absolutely
     positioned box with no inset resolves to where it *would* have been in
     flow, which inside this flex row is hard against the left edge — so the
     ring would sit off-centre behind the card and hang out to one side. */
  .gk-ring {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: min(560px, 118%); height: auto; aspect-ratio: 1;
    pointer-events: none; z-index: 0;
  }
  .gk-ring-a, .gk-ring-b, .gk-ring-c { transform-origin: 200px 200px; }
  .gk-ring-a { animation: gk-spin 64s linear infinite; }
  .gk-ring-b { animation: gk-spin 96s linear infinite reverse; }
  .gk-ring-c { animation: gk-spin 28s linear infinite; }
  @keyframes gk-spin { to { transform: rotate(360deg); } }

  /* ── Turning wheels ────────────────────────────────────────────────────
     Ambient, behind everything, clipped by the host section's own overflow so
     they can bleed past its edges without widening the document.

     These turn on the spot; RollingWheel below travels. ONE per section,
     never both — running the two systems together is what made most sections
     look like they had a duplicate wheel. */
  .gk-wheel {
    position: absolute; z-index: 0;
    color: var(--gk-cyan-soft);
    pointer-events: none;
  }
  .gk-wheel svg { width: 100%; height: 100%; display: block; }
  .gk-wheel--light { color: var(--gk-navy); }

  .gk-wheel--lg {
    width: min(660px, 66vw); aspect-ratio: 1;
    left: -17%; bottom: -32%;
    opacity: .13;
  }
  .gk-wheel--svc {
    width: min(520px, 52vw); aspect-ratio: 1;
    right: -14%; top: 6%;
    opacity: .05;
  }
  .gk-wheel--rev {
    width: min(600px, 58vw); aspect-ratio: 1;
    left: -16%; bottom: -12%;
    opacity: .045;
  }

  @media (max-width: 700px) {
    .gk-wheel--lg { opacity: .08; left: -32%; bottom: -18%; }
    /* At 5% on a small bright screen these are invisible anyway, and each is
       a compositor layer being blurred every frame. */
    .gk-wheel--light { display: none; }
  }

  /* ── Rolling wheels ────────────────────────────────────────────────────
     The travelling layer. Positioned by the component (top/bottom/size); all
     this does is pin it to the left edge so the component's own x transform
     is measured from a known origin, and set the colour it inherits.

     left:0 with the transform doing the travel, rather than animating left:
     transform composites, left is layout. */
  .gk-roll {
    position: absolute; left: 0; z-index: 0;
    pointer-events: none;
  }
  .gk-roll svg { width: 100%; height: 100%; display: block; }
  .gk-roll--dark  { color: var(--gk-cyan-soft); opacity: .16; }
  .gk-roll--light { color: var(--gk-navy);      opacity: .07; }

  /* Kept on phones — this is the effect that reads as motion, and unlike the
     static background wheels it is worth the compositor layer. Smaller and
     fainter so it never fights the text it passes behind. */
  @media (max-width: 700px) {
    .gk-roll { transform: scale(.62); transform-origin: left center; }
    .gk-roll--dark  { opacity: .13; }
    .gk-roll--light { opacity: .06; }
  }

  /* ── Hero car ────────────────────────────────────────────────────────────
     The car is the layer the whole right column is built around; the estimate
     card overlaps its lower-left corner. */
  .gk-hero-car-wrap {
    position: relative; z-index: 1;
    width: 100%;
    display: flex; justify-content: center;
    /* Pulled up so the card below can overlap it without the column growing
       by the card's full height. */
    margin-bottom: -4.5rem;
  }
  .gk-hero-car {
    width: 100%; max-width: 540px; height: auto;
    /* The cap that stops the right column running past the fold and taking
       the estimate card off the bottom of the screen with it. */
    max-height: 46vh; object-fit: contain;
    display: block;
    /* See the note at the markup: this is what removes the render's black
       backdrop without an alpha channel. */
    mix-blend-mode: screen;
    /* A wide, soft drop shadow in brand blue reads as the car sitting in a
       lit space rather than being pasted onto one. */
    filter: drop-shadow(0 30px 45px rgba(0, 40, 90, .55));
  }

  .gk-quote-wrap {
    position: relative; z-index: 2;
    width: 100%; max-width: 340px;
    /* Offset left so it overlaps the car's front wing rather than sitting
       dead centre under it. */
    margin-right: auto;
    margin-left: 0;
  }
  /* Once the hero is a single column the overlap has nowhere to go: the car
     and the card stack, and the negative margin has to be given back or the
     card lands on top of the bodywork. */
  @media (max-width: 960px) {
    .gk-hero-car-wrap { margin-bottom: -1.5rem; }
    .gk-quote-wrap { margin-inline: auto; }
  }

  .gk-quote {
    background: linear-gradient(158deg, rgba(255,255,255,.11) 0%, rgba(255,255,255,.045) 100%);
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 22px;
    padding: 1.1rem 1.15rem 0.95rem;
    box-shadow: 0 30px 70px rgba(0,0,0,.42);
    /* The blur is what sells this as glass over the mesh and blooms. Kept to
       one element on the page: backdrop-filter is expensive and repeating it
       on every card is what makes a page like this stutter on a phone. */
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    transform-style: preserve-3d;
  }

  .gk-quote-head {
    display: flex; align-items: center; gap: 0.7rem;
    padding-bottom: 1rem; margin-bottom: 0.35rem;
    border-bottom: 1px solid rgba(255,255,255,.1);
  }
  /* The car, not an icon. overflow:hidden plus a scaled, offset image crops
     the render down to the body — the source is a wide shot with a lot of
     empty space around the car, and object-fit alone would letterbox it into
     a 36px square of mostly background. */
  .gk-quote-thumb {
    width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
    overflow: hidden; position: relative;
    background: linear-gradient(150deg, rgba(21,103,211,.35), rgba(0,178,240,.18));
    border: 1px solid rgba(255,255,255,.14);
  }
  .gk-quote-thumb img {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover; object-position: 52% 62%;
    transform: scale(1.85);
  }

  .gk-quote-change {
    display: inline-flex; align-items: center; gap: 0.4rem;
    margin-top: 0.7rem; padding: 0.35rem 0.7rem;
    border-radius: 999px; text-decoration: none;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.13);
    color: var(--gk-cyan-soft);
    font-size: 0.7rem; font-weight: 600;
    transition: border-color .25s, background .25s, color .25s;
  }
  .gk-quote-change:hover {
    border-color: rgba(0,178,240,.45);
    background: rgba(0,178,240,.12);
    color: #FFFFFF;
  }
  .gk-quote-title { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .gk-quote-title b {
    font-family: var(--gk-font-display); font-size: 0.92rem; font-weight: 700;
    color: #FFF; letter-spacing: -.01em;
  }
  .gk-quote-title span { font-size: 0.71rem; color: var(--gk-meta-dark); font-weight: 500; margin-top: 1px; }
  .gk-quote-flag {
    flex-shrink: 0; font-family: var(--gk-font-display);
    font-size: 0.62rem; font-weight: 700; letter-spacing: .09em; text-transform: uppercase;
    padding: 0.3rem 0.6rem; border-radius: 999px;
    background: rgba(21,166,107,.16); color: #4FD8A0; border: 1px solid rgba(21,166,107,.3);
  }

  .gk-quote-rows { list-style: none; margin: 0; padding: 0.55rem 0 0; }
  .gk-quote-rows li {
    display: flex; align-items: center; gap: 0.9rem;
    padding: 0.48rem 0;
  }
  .gk-quote-row-txt { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .gk-quote-row-txt b { font-size: 0.82rem; font-weight: 600; color: #E4EFF9; }
  .gk-quote-row-txt span { font-size: 0.7rem; color: var(--gk-meta-dark); margin-top: 1px; }
  .gk-quote-amt {
    font-family: var(--gk-font-display); font-size: 0.9rem; font-weight: 700;
    color: #FFF; flex-shrink: 0;
  }
  .gk-quote-free {
    font-family: var(--gk-font-display); font-size: 0.78rem; font-weight: 700;
    color: #4FD8A0; flex-shrink: 0; letter-spacing: .03em;
  }

  .gk-quote-foot {
    display: flex; align-items: baseline; justify-content: space-between; gap: 1rem;
    margin-top: 0.55rem; padding-top: 0.95rem;
    border-top: 1px solid rgba(255,255,255,.1);
  }
  .gk-quote-total-lab { font-size: 0.76rem; color: var(--gk-body-dark); font-weight: 600; }
  .gk-quote-total {
    font-family: var(--gk-font-display); font-size: 1.35rem; font-weight: 700;
    letter-spacing: -.03em;
    background: linear-gradient(100deg, var(--gk-cyan) 0%, var(--gk-cyan-soft) 60%, #FFF 100%);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    color: var(--gk-cyan-soft);
  }

  .gk-quote-pickup {
    display: flex; align-items: flex-start; gap: 0.55rem;
    margin-top: 0.95rem; padding: 0.65rem 0.8rem;
    border-radius: 12px;
    background: rgba(0,178,240,.08); border: 1px solid rgba(0,178,240,.16);
    color: var(--gk-cyan-soft); font-size: 0.74rem; font-weight: 600;
  }
  .gk-quote-pickup svg { margin-top: 1px; flex-shrink: 0; }
  .gk-quote-pickup span { display: flex; flex-direction: column; min-width: 0; }
  .gk-quote-pickup b { font-weight: 700; }
  .gk-quote-pickup small {
    font-size: 0.68rem; font-weight: 500; margin-top: 2px;
    color: var(--gk-body-dark);
  }

  /* ── Scroll cue ────────────────────────────────────────────────────────── */
  .gk-scroll-cue {
    position: absolute; bottom: 1.6rem; left: 50%; transform: translateX(-50%);
    z-index: 2; pointer-events: none;
  }
  .gk-scroll-cue-rail {
    display: block; width: 22px; height: 34px; border-radius: 999px;
    border: 1.5px solid rgba(255,255,255,.22); position: relative;
  }
  .gk-scroll-cue-rail span {
    position: absolute; top: 6px; left: 50%; margin-left: -2px;
    width: 4px; height: 7px; border-radius: 2px; background: var(--gk-cyan-soft);
    animation: gk-cue 2.1s cubic-bezier(.22,1,.36,1) infinite;
  }
  @keyframes gk-cue {
    0%        { transform: translateY(0);    opacity: 0; }
    22%       { opacity: 1; }
    68%, 100% { transform: translateY(13px); opacity: 0; }
  }
  @media (max-width: 960px) { .gk-scroll-cue { display: none; } }

  /* ── 2 · Brand rail ────────────────────────────────────────────────────── */
  .gk-brands {
    background: var(--gk-surface);
    border-bottom: 1px solid var(--gk-hairline);
    padding-block: clamp(2.2rem, 4.5vw, 3.4rem);
    /* Fed to the rail's edge fades so they match the band exactly. */
    --gk-rail-bg: var(--gk-surface);
  }
  .gk-brands-lead {
    display: flex; flex-direction: column; align-items: center;
    text-align: center; margin: 0 0 clamp(1.4rem, 3vw, 2.2rem);
  }
  .gk-brands-lead > span:first-child {
    font-family: var(--gk-font-display);
    font-size: 0.74rem; font-weight: 700; letter-spacing: .2em; text-transform: uppercase;
    color: var(--gk-navy);
  }
  .gk-brands-sub {
    font-size: 0.86rem; color: var(--gk-meta); margin-top: 0.45rem; max-width: 34rem;
  }

  /* ── 2b · Promo banners ────────────────────────────────────────────────── */
  .gk-promos {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
    gap: clamp(0.9rem, 1.6vw, 1.3rem);
  }

  .gk-promo {
    position: relative;
    display: flex; flex-direction: column;
    width: 100%; height: 100%;
    padding: 1.6rem 1.5rem 1.5rem;
    border-radius: 22px;
    overflow: hidden;
    text-decoration: none;
    color: #FFFFFF;
    isolation: isolate;
    transition: transform .4s cubic-bezier(.22,1,.36,1), box-shadow .4s;
  }
  .gk-promo:hover { transform: translateY(-6px); box-shadow: 0 26px 60px rgba(10,34,70,.28); }
  @media (hover: none) { .gk-promo:hover { transform: none; } }

  /* Three tones from one family. The radial bloom on top of each linear base
     is what stops a large flat panel from looking like a solid swatch. */
  .gk-promo[data-tone="blue"] {
    background:
      radial-gradient(ellipse 90% 120% at 88% 8%, rgba(111,216,255,.42) 0%, transparent 60%),
      linear-gradient(140deg, var(--gk-blue-deep) 0%, var(--gk-blue) 100%);
  }
  .gk-promo[data-tone="cyan"] {
    background:
      radial-gradient(ellipse 90% 120% at 88% 8%, rgba(255,255,255,.34) 0%, transparent 58%),
      linear-gradient(140deg, var(--gk-blue) 0%, var(--gk-cyan) 100%);
  }
  .gk-promo[data-tone="navy"] {
    background:
      radial-gradient(ellipse 90% 120% at 88% 8%, rgba(21,103,211,.55) 0%, transparent 60%),
      linear-gradient(140deg, var(--gk-ink) 0%, var(--gk-navy) 100%);
  }

  /* A faint technical grid inside each panel, masked so it fades out towards
     the bottom where the text sits. */
  .gk-promo::before {
    content: '';
    position: absolute; inset: 0; z-index: -1; pointer-events: none;
    background-image:
      linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px);
    background-size: 34px 34px;
    -webkit-mask-image: linear-gradient(160deg, #000 0%, transparent 62%);
            mask-image: linear-gradient(160deg, #000 0%, transparent 62%);
  }

  /* The artwork sits in the card's lower-right corner, under the text.
     Two things make it read as part of the panel rather than pasted on:
     mix-blend-mode screen dissolves the render's black backdrop into the
     gradient, and the mask fades the image out towards the top-left so it
     never runs under the headline. */
  .gk-promo-img {
    position: absolute; z-index: -1;
    right: -12%; bottom: -6%;
    width: 78%; height: auto;
    pointer-events: none;
    mix-blend-mode: screen;
    opacity: .85;
    -webkit-mask-image: linear-gradient(300deg, #000 30%, transparent 78%);
            mask-image: linear-gradient(300deg, #000 30%, transparent 78%);
    transition: transform .55s cubic-bezier(.22,1,.36,1), opacity .45s;
  }
  .gk-promo:hover .gk-promo-img { transform: scale(1.06) translateX(-2%); opacity: 1; }
  @media (hover: none) { .gk-promo:hover .gk-promo-img { transform: none; } }

  /* Narrow cards put the text over the busiest part of the artwork, so it
     steps back rather than competing. */
  @media (max-width: 520px) {
    .gk-promo-img { width: 92%; right: -18%; opacity: .55; }
  }

  .gk-promo-ico {
    width: 52px; height: 52px; border-radius: 15px;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,.16);
    border: 1px solid rgba(255,255,255,.24);
    color: #FFFFFF;
    margin-bottom: 1.2rem;
    transition: background .35s, transform .35s cubic-bezier(.22,1,.36,1);
  }
  .gk-promo:hover .gk-promo-ico { background: rgba(255,255,255,.26); transform: translateY(-3px); }

  .gk-promo-kicker {
    font-family: var(--gk-font-display);
    font-size: 0.66rem; font-weight: 700;
    letter-spacing: .18em; text-transform: uppercase;
    color: rgba(255,255,255,.72);
    margin-bottom: 0.4rem;
  }
  .gk-promo-title {
    font-family: var(--gk-font-display);
    font-size: clamp(1.15rem, 1.9vw, 1.4rem); font-weight: 700;
    letter-spacing: -.025em; line-height: 1.15;
  }
  .gk-promo-desc {
    font-size: 0.85rem; line-height: 1.62;
    color: rgba(255,255,255,.82);
    margin-top: 0.6rem; flex: 1;
  }
  .gk-promo-go {
    width: 36px; height: 36px; border-radius: 50%; margin-top: 1.35rem;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,.15);
    border: 1px solid rgba(255,255,255,.26);
    transition: background .35s, transform .35s cubic-bezier(.22,1,.36,1);
  }
  .gk-promo:hover .gk-promo-go {
    background: #FFFFFF; color: var(--gk-navy); transform: translateX(4px);
  }

  /* ── 3 · Services ──────────────────────────────────────────────────────── */
  .gk-svc-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
    gap: clamp(0.9rem, 1.6vw, 1.35rem);
  }

  .gk-svc {
    padding: 1.5rem 1.35rem 1.25rem;
    text-decoration: none;
    width: 100%;
    /* The card is the tilt target's child, so it must fill it completely or
       the 3D transform pivots around a box larger than the visible card. */
    height: 100%;
  }
  /* The lift Tilt used to supply, without the rotation. */
  .gk-svc:hover { transform: translateY(-6px); }
  .gk-svc-title { margin-top: 1.15rem; }
  .gk-svc-desc {
    color: var(--gk-body); font-size: 0.83rem; line-height: 1.6;
    margin: 0.45rem 0 0; flex: 1;
  }
  .gk-svc-foot {
    display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
    margin-top: 1.35rem; padding-top: 0.95rem;
    border-top: 1px solid var(--gk-hairline);
  }
  .gk-svc-price {
    font-family: var(--gk-font-display); font-size: 1.05rem; font-weight: 700;
    color: var(--gk-navy); letter-spacing: -.02em;
  }
  .gk-svc-price small {
    font-family: var(--gk-font-sans); font-size: 0.68rem; font-weight: 600;
    color: var(--gk-meta); margin-right: 0.3rem; letter-spacing: .04em; text-transform: uppercase;
  }
  .gk-svc-go {
    width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid var(--gk-hairline); color: var(--gk-blue); background: #FFF;
    transition: background .32s, color .32s, border-color .32s, transform .32s cubic-bezier(.22,1,.36,1);
  }
  .gk-svc:hover .gk-svc-go {
    background: var(--gk-g-brand); color: #FFF; border-color: transparent;
    transform: translateX(3px);
  }

  .gk-svc-actions {
    display: flex; flex-wrap: wrap; gap: 0.8rem; justify-content: center;
    margin-top: clamp(1.8rem, 3.5vw, 2.6rem);
  }

  /* ── 4b · Insurance ────────────────────────────────────────────────────── */
  .gk-ins-sec { isolation: isolate; }
  /* Anchored to the right half and masked away towards the left, so the
     headline and the cost table both sit on flat navy while the photograph
     fills the space that would otherwise be empty gradient. */
  .gk-ins-bg {
    position: absolute; z-index: 0;
    top: 50%; right: -6%;
    transform: translateY(-50%);
    width: min(760px, 62%); height: auto;
    pointer-events: none;
    mix-blend-mode: screen;
    opacity: .5;
    -webkit-mask-image: radial-gradient(ellipse 72% 78% at 62% 50%, #000 18%, transparent 76%);
            mask-image: radial-gradient(ellipse 72% 78% at 62% 50%, #000 18%, transparent 76%);
  }
  /* Once the section is a single column the photo would sit directly under
     the cost table's small type. */
  @media (max-width: 1100px) { .gk-ins-bg { opacity: .22; right: -22%; } }
  @media (max-width: 700px)  { .gk-ins-bg { display: none; } }

  .gk-ins-top {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
    gap: clamp(2rem, 4.5vw, 4rem);
    align-items: center;
    margin-bottom: clamp(2.5rem, 5vw, 4rem);
  }
  @media (max-width: 940px) { .gk-ins-top { grid-template-columns: minmax(0, 1fr); } }

  .gk-ins-ctas { display: flex; flex-wrap: wrap; gap: 0.85rem; margin-top: 2rem; }
  @media (max-width: 520px) {
    .gk-ins-ctas { flex-direction: column; align-items: stretch; }
    .gk-ins-ctas .gk-btn { width: 100%; }
  }

  /* Cost table */
  .gk-ins-costcard {
    background: linear-gradient(158deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,.04) 100%);
    border: 1px solid rgba(255,255,255,.13);
    border-radius: 24px;
    padding: 1.5rem 1.5rem 1.3rem;
    box-shadow: 0 30px 70px rgba(0,0,0,.38);
  }
  .gk-ins-costhead {
    font-family: var(--gk-font-display);
    font-size: 0.72rem; font-weight: 700;
    letter-spacing: .16em; text-transform: uppercase;
    color: var(--gk-cyan-soft);
    margin: 0 0 1.1rem;
  }
  .gk-ins-costs { list-style: none; margin: 0; padding: 0; }
  .gk-ins-costs li {
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    padding: 0.82rem 0;
    border-bottom: 1px solid rgba(255,255,255,.08);
  }
  .gk-ins-costs li:last-child { border-bottom: 0; }
  .gk-ins-cost-lab {
    display: inline-flex; align-items: center; gap: 0.5rem;
    color: #DDEAF7; font-size: 0.87rem; font-weight: 500;
  }
  .gk-ins-cost-lab svg { color: #4FD8A0; flex-shrink: 0; }
  .gk-ins-cost-free {
    font-family: var(--gk-font-display); font-size: 0.85rem; font-weight: 700;
    color: #4FD8A0; flex-shrink: 0; letter-spacing: .02em;
  }
  /* The one row that is not free is set apart in white rather than green, so
     the eye does not read it as another included item. */
  .gk-ins-cost-val {
    font-family: var(--gk-font-display); font-size: 0.82rem; font-weight: 700;
    color: #FFFFFF; flex-shrink: 0; text-align: right;
  }
  .gk-ins-costnote {
    margin: 1.1rem 0 0; padding-top: 0.95rem;
    border-top: 1px solid rgba(255,255,255,.08);
    font-size: 0.78rem; line-height: 1.55; color: var(--gk-meta-dark);
  }

  /* Claim steps */
  .gk-ins-steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 235px), 1fr));
    gap: clamp(0.9rem, 1.6vw, 1.25rem);
  }
  .gk-ins-step {
    position: relative; height: 100%;
    padding: 1.5rem 1.35rem 1.35rem;
    border-radius: 20px;
    background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.10);
    overflow: hidden;
    transition: border-color .35s, background .35s, transform .35s cubic-bezier(.22,1,.36,1);
  }
  .gk-ins-step:hover {
    border-color: rgba(0,178,240,.4);
    background: rgba(255,255,255,.07);
    transform: translateY(-5px);
  }
  @media (hover: none) { .gk-ins-step:hover { transform: none; } }
  .gk-ins-step-n {
    position: absolute; top: .5rem; right: 1rem;
    font-family: var(--gk-font-display); font-size: 2.9rem; font-weight: 700;
    line-height: 1; letter-spacing: -.05em;
    color: rgba(111,216,255,.10);
    transition: color .4s;
  }
  .gk-ins-step:hover .gk-ins-step-n { color: rgba(111,216,255,.2); }
  .gk-ins-step-ico {
    width: 44px; height: 44px; border-radius: 13px;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(0,178,240,.13);
    border: 1px solid rgba(0,178,240,.24);
    color: var(--gk-cyan-soft);
    transition: background .35s, color .35s;
  }
  .gk-ins-step:hover .gk-ins-step-ico {
    background: var(--gk-g-brand); color: #FFF; border-color: transparent;
  }
  .gk-ins-step-title {
    font-family: var(--gk-font-display);
    font-size: 1rem; font-weight: 700; letter-spacing: -.015em;
    color: #FFFFFF; margin: 1.05rem 0 0;
  }
  .gk-ins-step-desc {
    font-size: 0.81rem; line-height: 1.6;
    color: var(--gk-body-dark); margin: 0.5rem 0 0;
  }

  /* Insurer strip */
  .gk-ins-insurers {
    display: flex; flex-wrap: wrap; align-items: center;
    gap: 0.7rem 1rem;
    margin-top: clamp(2rem, 4vw, 3rem);
    padding-top: clamp(1.6rem, 3vw, 2.2rem);
    border-top: 1px solid rgba(255,255,255,.09);
  }
  .gk-ins-insurers-lab {
    font-family: var(--gk-font-display);
    font-size: 0.68rem; font-weight: 700;
    letter-spacing: .18em; text-transform: uppercase;
    color: var(--gk-meta-dark);
    margin-right: 0.4rem;
  }
  .gk-ins-insurers ul {
    display: flex; flex-wrap: wrap; gap: 0.55rem;
    list-style: none; margin: 0; padding: 0;
  }
  .gk-ins-insurers li {
    padding: 0.42rem 0.85rem;
    border-radius: 999px;
    background: rgba(255,255,255,.045);
    border: 1px solid rgba(255,255,255,.11);
    color: #C6DAEE;
    font-size: 0.77rem; font-weight: 600; white-space: nowrap;
    transition: border-color .3s, color .3s, background .3s;
  }
  .gk-ins-insurers li:hover {
    border-color: rgba(0,178,240,.4); color: #FFFFFF; background: rgba(0,178,240,.1);
  }

  /* ── 4 · Bento ─────────────────────────────────────────────────────────── */
  .gk-bento {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: clamp(0.9rem, 1.6vw, 1.3rem);
  }
  .gk-bento-cell { grid-column: span var(--span, 1); display: flex; }
  .gk-bento-card { padding: 1.6rem 1.45rem; width: 100%; }
  .gk-bento-card .gk-h3 { margin-top: 1.05rem; }
  .gk-bento-desc {
    color: var(--gk-body); font-size: 0.855rem; line-height: 1.65; margin: 0.5rem 0 0;
  }
  /* Four columns collapse to two, and the wide cells stop being wide — a
     "span 2" cell in a 2-column grid is a full-width row, which is right. */
  @media (max-width: 900px) {
    .gk-bento { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 560px) {
    .gk-bento { grid-template-columns: minmax(0, 1fr); }
    .gk-bento-cell { grid-column: span 1; }
  }

  /* ── 5 · Steps ─────────────────────────────────────────────────────────── */
  .gk-steps { position: relative; }

  /* The rail is inset by half a card so it starts and ends under the first and
     last chip rather than running off the edges of the grid. */
  .gk-steps-rail {
    position: absolute; top: 74px; left: 12.5%; right: 12.5%; height: 2px;
    background: var(--gk-hairline); border-radius: 2px; z-index: 0;
  }
  .gk-steps-fill { width: 100%; height: 100%; }
  @media (max-width: 900px) { .gk-steps-rail { display: none; } }

  .gk-steps-grid {
    position: relative; z-index: 1;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
    gap: clamp(0.9rem, 1.6vw, 1.3rem);
  }
  .gk-step { padding: 1.6rem 1.4rem 1.4rem; height: 100%; }
  .gk-step-num {
    position: absolute; top: 0.6rem; right: 1rem;
    font-family: var(--gk-font-display); font-size: 3.2rem; font-weight: 700;
    line-height: 1; letter-spacing: -.05em;
    color: rgba(21,103,211,.07);
    transition: color .4s;
  }
  .gk-step:hover .gk-step-num { color: rgba(21,103,211,.14); }
  .gk-step-title { margin-top: 1.05rem; }
  .gk-step-desc {
    color: var(--gk-body); font-size: 0.83rem; line-height: 1.62; margin: 0.5rem 0 0;
  }

  /* ── 6 · Shop ──────────────────────────────────────────────────────────── */
  .gk-shop-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 0.82fr);
    gap: clamp(1.5rem, 4vw, 3rem);
    align-items: center;
    margin-bottom: clamp(1.8rem, 3.5vw, 2.6rem);
  }
  .gk-shop-copy .gk-lede { max-width: 34rem; }
  .gk-shop-shot img {
    width: 100%; height: auto; aspect-ratio: 16 / 10;
    object-fit: cover; display: block;
    border-radius: 22px;
    border: 1px solid var(--gk-hairline);
    box-shadow: var(--gk-sh-card-hover);
  }
  @media (max-width: 860px) {
    .gk-shop-head { grid-template-columns: minmax(0, 1fr); }
    /* The photo goes first on a phone: it is what makes the section read as a
       real counter rather than another block of type. */
    .gk-shop-shot { order: -1; }
    .gk-shop-shot img { aspect-ratio: 2 / 1; border-radius: 18px; }
  }
  .gk-parts-grid > * { min-width: 0; }
  .gk-parts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
    gap: clamp(0.8rem, 1.5vw, 1.2rem);
  }
  @media (min-width: 1120px) {
    /* Exactly five across at desktop, which is the count actually fetched. */
    .gk-parts-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  }

  .gk-state {
    align-items: center; text-align: center; gap: 0.5rem;
    padding: clamp(2.2rem, 5vw, 3.2rem);
  }
  .gk-state .gk-lede { font-size: 0.88rem; margin-bottom: 0.6rem; }

  /* ── 7 · Stats + reviews ───────────────────────────────────────────────── */
  .gk-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
    gap: clamp(0.8rem, 1.6vw, 1.2rem);
  }
  .gk-stat {
    display: flex; flex-direction: column; align-items: center; text-align: center;
    gap: 0.35rem;
    padding: 1.6rem 1rem;
    border-radius: 18px;
    background: var(--gk-surface);
    border: 1px solid var(--gk-hairline);
    transition: border-color .35s, transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s;
  }
  .gk-stat:hover {
    border-color: rgba(21,103,211,.28);
    transform: translateY(-4px);
    box-shadow: var(--gk-sh-card);
  }
  .gk-stat-ico {
    width: 38px; height: 38px; border-radius: 11px; margin-bottom: 0.35rem;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--gk-g-brand); color: #FFF;
    box-shadow: 0 6px 16px rgba(21,103,211,.28);
  }
  .gk-stat-val {
    font-family: var(--gk-font-display);
    font-size: clamp(1.65rem, 3vw, 2.2rem); font-weight: 700;
    letter-spacing: -.04em; color: var(--gk-navy); line-height: 1;
    /* Digits change width as they count; tabular figures stop the label
       beneath from jittering left and right for the whole animation. */
    font-variant-numeric: tabular-nums;
  }
  .gk-stat-lab {
    font-size: 0.78rem; font-weight: 600; color: var(--gk-meta);
    letter-spacing: .01em;
  }

  .gk-reviews-link {
    display: inline-flex; align-items: center; gap: 0.5rem;
    margin-top: 1.1rem; padding: 0.5rem 0.95rem;
    border-radius: 999px; text-decoration: none;
    border: 1px solid var(--gk-hairline); background: #FFF;
    color: var(--gk-navy); font-size: 0.8rem; font-weight: 600;
    transition: border-color .3s, box-shadow .3s, transform .3s cubic-bezier(.22,1,.36,1);
  }
  .gk-reviews-link:hover {
    border-color: rgba(21,103,211,.35); box-shadow: var(--gk-sh-card); transform: translateY(-2px);
  }
  .gk-stars { display: inline-flex; gap: 1px; }

  .gk-reviews {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
    gap: clamp(0.9rem, 1.6vw, 1.3rem);
  }
  .gk-review { padding: 1.6rem 1.45rem 1.35rem; width: 100%; }
  .gk-review-mark {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 3.4rem; line-height: .55; color: rgba(21,103,211,.16);
    display: block; margin-bottom: 0.7rem;
  }
  .gk-review-text {
    margin: 0; flex: 1;
    color: #33455C; font-size: 0.88rem; line-height: 1.68;
  }
  .gk-review-by {
    display: flex; align-items: center; gap: 0.7rem;
    margin-top: 1.35rem; padding-top: 1.05rem;
    border-top: 1px solid var(--gk-hairline);
  }
  .gk-review-avatar {
    width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
    object-fit: cover;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--gk-g-brand); color: #FFF;
    font-family: var(--gk-font-display); font-size: 0.95rem; font-weight: 700;
  }
  .gk-review-who { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .gk-review-who b {
    font-family: var(--gk-font-display); font-size: 0.88rem; font-weight: 700;
    color: var(--gk-navy);
  }
  .gk-review-who span { font-size: 0.73rem; color: var(--gk-meta); margin-top: 1px; }
  .gk-review-stars { flex-shrink: 0; }
  @media (max-width: 420px) { .gk-review-stars { display: none; } }

  /* ── 8 · Visit ─────────────────────────────────────────────────────────── */

  /* The footage layer. Both the poster and the video fill the section and are
     darkened hard — this sits behind body copy, and legible text over moving
     footage needs far more contrast than it does over a still. The scrim is a
     separate ::after rather than a filter on the media, because filtering a
     playing video is a per-frame GPU cost for something a static overlay does
     for free. */
  .gk-visit-sec { isolation: isolate; }
  .gk-visit-media {
    position: absolute; inset: 0; z-index: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .gk-visit-media::after {
    content: '';
    position: absolute; inset: 0; z-index: 2;
    background:
      linear-gradient(100deg, var(--gk-ink) 8%, rgba(4,16,31,.86) 42%, rgba(10,34,70,.66) 100%),
      linear-gradient(180deg, var(--gk-ink) 0%, transparent 22%, transparent 78%, var(--gk-ink) 100%);
  }
  .gk-av-poster, .gk-av-video {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    /* Nudged right so the composition's interesting half sits under the
       address card rather than under the headline. */
    object-position: 62% 50%;
  }
  .gk-av-poster { z-index: 0; }
  .gk-av-video {
    z-index: 1;
    opacity: 0;
    transition: opacity 1.1s ease;
  }
  .gk-av-video[data-ready="true"] { opacity: 1; }

  .gk-visit {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 0.92fr);
    gap: clamp(2rem, 5vw, 4rem);
    align-items: center;
  }
  @media (max-width: 940px) { .gk-visit { grid-template-columns: minmax(0, 1fr); } }

  .gk-visit-ctas { display: flex; flex-wrap: wrap; gap: 0.85rem; margin-top: 2rem; }
  @media (max-width: 420px) {
    .gk-visit-ctas { flex-direction: column; align-items: stretch; }
    .gk-visit-ctas .gk-btn { width: 100%; }
  }

  .gk-visit-card {
    background: linear-gradient(158deg, rgba(255,255,255,.09) 0%, rgba(255,255,255,.035) 100%);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 24px;
    padding: 0.6rem 1.4rem;
    box-shadow: 0 30px 70px rgba(0,0,0,.36);
  }
  .gk-visit-rows { list-style: none; margin: 0; padding: 0; }
  .gk-visit-rows li {
    display: flex; align-items: flex-start; gap: 0.95rem;
    padding: 1.15rem 0;
    border-bottom: 1px solid rgba(255,255,255,.08);
  }
  .gk-visit-rows li:last-child { border-bottom: 0; }
  .gk-visit-rows .gk-chip {
    color: var(--gk-cyan-soft);
    background: rgba(0,178,240,.11);
    border-color: rgba(0,178,240,.2);
  }
  .gk-visit-rows .gk-chip--on { color: #FFF; background: var(--gk-g-brand); border-color: transparent; }
  .gk-visit-row-txt { display: flex; flex-direction: column; min-width: 0; }
  .gk-visit-row-txt b {
    font-family: var(--gk-font-display); font-size: 0.92rem; font-weight: 700;
    color: #FFF; letter-spacing: -.01em;
  }
  .gk-visit-row-txt > span {
    font-size: 0.8rem; line-height: 1.6; color: var(--gk-body-dark); margin-top: 0.25rem;
  }
  .gk-visit-tel { color: #FFF; text-decoration: none; transition: color .25s; }
  .gk-visit-tel:hover { color: var(--gk-cyan-soft); }

  /* ══════════════════════════════════════════════════════════════════════
     PHONE DENSITY — two up
     Every card grid on this page used a minmax(min(100%, 240px), 1fr)
     track. On a 360px screen that floor resolves to the full width, so each
     grid collapsed to ONE column and every card became a full-width slab.
     Scrolling the home page on a phone meant scrolling past twelve of them.

     Below 640px the grids are pinned to exactly two columns instead, and the
     type, padding and chips inside step down to match — a card at half width
     cannot carry desktop padding and a 52px icon without the text being
     squeezed into a two-word-per-line column.

     These rules live at the END of this stylesheet, after every base rule
     they override, because they share the same specificity and the cascade
     is what decides.
     ══════════════════════════════════════════════════════════════════════ */
  @media (max-width: 640px) {
    .gk-svc-grid,
    .gk-steps-grid,
    .gk-ins-steps,
    .gk-reviews,
    .gk-parts-grid,
    .gk-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.6rem;
    }

    /* Cards */
    .gk-svc, .gk-step, .gk-ins-step, .gk-review { padding: 1rem 0.85rem 0.9rem; }
    .gk-card { border-radius: 14px; }

    /* Chips shrink so they do not eat half the card. */
    .gk-chip { width: 40px; height: 40px; border-radius: 11px; }
    .gk-chip--sm { width: 34px; height: 34px; border-radius: 10px; }
    .gk-chip svg, .gk-chip--sm svg { width: 18px; height: 18px; }

    .gk-h3 { font-size: 0.92rem; line-height: 1.3; }
    .gk-svc-title, .gk-step-title { margin-top: 0.75rem; }
    .gk-svc-desc, .gk-step-desc, .gk-ins-step-desc { font-size: 0.72rem; line-height: 1.5; }

    .gk-svc-foot { margin-top: 0.9rem; padding-top: 0.7rem; gap: 0.4rem; }
    .gk-svc-price { font-size: 0.88rem; }
    .gk-svc-price small { font-size: 0.6rem; margin-right: 0.2rem; }
    .gk-svc-go { width: 26px; height: 26px; }
    .gk-svc-go svg { width: 13px; height: 13px; }

    .gk-step-num, .gk-ins-step-n { font-size: 2rem; top: .35rem; right: .6rem; }

    /* Reviews at half width: the quote mark is decoration the card can no
       longer afford, and the star row would wrap under the name. */
    .gk-review-mark { display: none; }
    .gk-review-text { font-size: 0.75rem; line-height: 1.55; }
    .gk-review-by { margin-top: 0.85rem; padding-top: 0.7rem; gap: 0.5rem; }
    .gk-review-avatar { width: 30px; height: 30px; font-size: 0.8rem; }
    .gk-review-who b { font-size: 0.76rem; }
    .gk-review-who span { font-size: 0.66rem; }

    .gk-stat { padding: 1rem 0.6rem; border-radius: 14px; }
    .gk-stat-ico { width: 30px; height: 30px; border-radius: 9px; }
    .gk-stat-ico svg { width: 15px; height: 15px; }
    .gk-stat-val { font-size: 1.4rem; }
    .gk-stat-lab { font-size: 0.66rem; line-height: 1.3; }

    /* The promo banners stay full width. They are feature panels with artwork
       behind the text — at half a phone's width the copy would sit on top of
       the busiest part of the image and neither would be readable. */
    .gk-promos { grid-template-columns: minmax(0, 1fr); }

    /* Section rhythm tightens too, or two-up cards just mean more scrolling
       between the same number of headings. */
    .gk-sec { padding-block: 2.5rem; }
    .gk-sec-sm { padding-block: 2rem; }
    .gk-head { margin-bottom: 1.6rem; }
  }

  /* ══════════════════════════════════════════════════════════════════════
     PHONE HERO
     The headline was rendering at the bottom of its clamp — around 2.3rem on
     a 390px screen — which for the site's opening statement is small. It now
     has its own floor. The proof row and the estimate card are tightened to
     pay for the extra height.
     ══════════════════════════════════════════════════════════════════════ */
  .gk-hero-lede--short { display: none; }

  @media (max-width: 640px) {
    /* The headline is the loudest thing on a phone screen or it is not doing
       its job. 14vw, not the earlier 12.5: the longest line, "Sale. Spare.",
       measures roughly 0.5em per character in Space Grotesk at this weight,
       so at 360px it comes to about 300px inside a 328px column — filling the
       measure with a little air, which is the point, without ever wrapping to
       a third line. The tightened tracking buys the margin that makes it
       safe. */
    .gk-hero-h1 {
      font-size: clamp(2.9rem, 14vw, 3.9rem);
      line-height: 0.95;
      letter-spacing: -0.045em;
      margin-top: 1rem;
    }

    /* Swap the long lede for the short one. Not as terse as it was — three
       clipped fragments read as a specification rather than a sentence, and
       under a headline this size the page needs one line of actual voice. */
    .gk-hero-lede--long { display: none; }
    .gk-hero-lede--short {
      display: block;
      font-size: 0.95rem; line-height: 1.6;
      /* A step brighter than the desktop body colour: at this size, on this
         dark ground, --gk-body-dark sits too close to the background. */
      color: #B8CCE2;
      margin-top: 1rem; max-width: 22rem;
    }

    /* Two claims on one line, not three stacked.
       "Quote before we start" is dropped here on purpose rather than wrapped:
       the estimate card directly below says the same thing far better, with
       an actual example of the quote. Repeating it as a bullet a hundred
       pixels above is the weaker of the two, so it is the one that goes. */
    .gk-hero-proof {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.55rem 0.7rem;
      margin-top: 1.5rem; padding-top: 1.1rem;
    }
    .gk-hero-proof li { font-size: 0.75rem; gap: 0.45rem; white-space: normal; }
    .gk-hero-proof li:nth-child(2) { display: none; }
    .gk-hero-proof-ico { width: 21px; height: 21px; border-radius: 7px; }
    .gk-hero-proof-ico svg { width: 11px; height: 11px; }

    .gk-hero-ctas { margin-top: 1.5rem; gap: 0.6rem; }
    .gk-loc { font-size: 0.72rem; padding: 0.38rem 0.7rem 0.38rem 0.6rem; }
  }

  /* ── Phone: the promo banners ──────────────────────────────────────────
     Three full-height feature panels stacked came to roughly a screen and a
     half of scrolling before the services grid even started. They become
     compact rows instead: icon on the left, text on the right, artwork
     reduced to a bleed behind the right edge. Same three offers, about a
     third of the height, and still tappable at full width. */
  @media (max-width: 640px) {
    .gk-promos { gap: 0.55rem; }
    .gk-promo {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas: "ico text go";
      align-items: center;
      column-gap: 0.85rem;
      padding: 0.9rem 1rem;
      border-radius: 16px;
    }
    .gk-promo-ico {
      grid-area: ico;
      width: 42px; height: 42px; border-radius: 12px; margin-bottom: 0;
    }
    .gk-promo-ico svg { width: 20px; height: 20px; }
    .gk-promo-kicker { display: none; }
    .gk-promo-title { grid-area: text; font-size: 0.95rem; }
    .gk-promo-desc {
      grid-area: text;
      font-size: 0.72rem; line-height: 1.45; margin-top: 1.6rem;
      /* Two lines, then ellipsis — the full offer is on the page it links to
         and a five-line paragraph is what made these tall in the first
         place. */
      display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
      overflow: hidden;
    }
    /* The title and the clamped description share one grid cell, stacked by
       the margin above, so the row height is set by the taller of icon and
       text rather than by three separate blocks. */
    .gk-promo-title { align-self: start; }
    .gk-promo-go { grid-area: go; margin-top: 0; width: 30px; height: 30px; }
    .gk-promo-go svg { width: 14px; height: 14px; }
    .gk-promo-img { width: 58%; right: -18%; bottom: -20%; opacity: .32; }
  }

  /* ── Phone: "Why GK Motors" two up ─────────────────────────────────────
     The bento's two wide cells carry a paragraph each and stay full width;
     the four short ones pair off. */
  @media (max-width: 560px) {
    .gk-bento { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem; }
    .gk-bento-cell { grid-column: span 1; }
    .gk-bento-cell[style*="--span: 2"] { grid-column: span 2; }
    .gk-bento-card { padding: 1.05rem 0.9rem; }
    .gk-bento-card .gk-h3 { margin-top: 0.8rem; font-size: 0.9rem; }
    .gk-bento-desc { font-size: 0.75rem; line-height: 1.5; }
  }

  /* ── Phone: the estimate card ──────────────────────────────────────────
     It is supporting evidence, not the hero's subject, and at full height it
     pushed the whole fold down. The line items collapse and what is left is
     the part that actually makes the point: the total, and that pickup is
     free. */
  @media (max-width: 640px) {
    .gk-quote { padding: 0.9rem 1rem 0.85rem; border-radius: 18px; }
    .gk-quote-rows li:not(:last-child) { display: none; }
    .gk-quote-rows li { padding: 0.35rem 0; }
    .gk-quote-head { padding-bottom: 0.75rem; }
    .gk-quote-title b { font-size: 0.85rem; }
    .gk-quote-title span { font-size: 0.66rem; }
    .gk-quote-total { font-size: 1.2rem; }
    .gk-quote-pickup { margin-top: 0.7rem; padding: 0.55rem 0.7rem; font-size: 0.7rem; }
  }

  /* Very narrow phones cannot carry two columns of a review, so that one
     grid alone drops back to a single column. */
  @media (max-width: 380px) {
    .gk-reviews { grid-template-columns: minmax(0, 1fr); }
  }

  /* ── Reduced motion ────────────────────────────────────────────────────
     The JS primitives handle their own opt-out; these are the CSS-only
     animations on this page. Everything ends up in its final position. */
  @media (prefers-reduced-motion: reduce) {
    .gk-ring-a, .gk-ring-b, .gk-ring-c { animation: none; }
    .gk-scroll-cue { display: none; }
    .gk-svc-go, .gk-stat, .gk-reviews-link, .gk-loc { transition-duration: .01ms; }
  }
`;
