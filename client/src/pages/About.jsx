/* ═══════════════════════════════════════════════════════════════════════════
   ABOUT — rebuilt on the design system

   What was wrong here went well past styling:

   • FOUR HOTLINKED UNSPLASH IMAGES. The workshop photo and all three "values"
     card backgrounds were loaded straight from images.unsplash.com — a third
     party we do not control, on a paying client's commercial site, with no
     licence on file. If Unsplash changes a URL or rate-limits us the page
     breaks. All four are replaced with the local, optimised workshop renders.

   • "500+ CERTIFIED CARS" on the site of a business that does not sell cars,
     and "REVOLUTIONIZING CAR OWNERSHIP" as the headline of a Rohtak workshop.
     Both came from the national-marketplace template this project started as.

   • THE PAGE CONTRADICTED THE HOME PAGE. This said the workshop started in
     2018; the home page claimed twelve years. Both figures are now derived
     from BIZ.since, so they cannot disagree.

   The claims below are deliberately smaller and checkable. A local workshop's
   advantage over a chain is that it is a real place run by people you can go
   and shout at — the copy leans on that rather than trying to sound national.
   ═══════════════════════════════════════════════════════════════════════════ */
import { Link } from 'react-router-dom';
import {
  Shield, Clock, Users, Wrench, IndianRupee, MapPin, Phone, ArrowRight, Car,
} from 'lucide-react';
import PageHero from '../components/common/PageHero';
import { Reveal, Stagger, StaggerItem, CountUp } from '../components/common/Motion';
import { C, BIZ, yearsOpen } from '../theme';

/* ⚠ PLACEHOLDER FIGURES — same caveat as the home page. Plausible for a
   workshop of this age and size, but not measured. Replace before launch. */
const STATS = [
  { to: yearsOpen(), suffix: '+', label: 'Years on Sheela Bypass', icon: Clock },
  { to: 8000,        suffix: '+', label: 'Cars through the bays',  icon: Car },
  { to: 40,          suffix: '+', label: 'Brands serviced',        icon: Wrench },
  { to: 100,         suffix: '%', label: 'Genuine parts fitted',   icon: Shield },
];

const VALUES = [
  {
    n: '01', icon: IndianRupee, title: 'You see the price first',
    desc: 'Nothing is opened, removed or replaced before you have seen an itemised estimate and said yes to it. If we find something else once the car is on the ramp, work stops and we call you.',
  },
  {
    n: '02', icon: Shield, title: 'You get the old parts back',
    desc: 'Every part we take off is bagged and handed over with the car. It is the simplest possible proof that what you paid for is what was actually fitted, and it costs us nothing to do.',
  },
  {
    n: '03', icon: Users, title: 'You talk to the people doing the work',
    desc: 'No call centre, no ticket number. The person who answers the phone can walk over to your car and look at it while you are still talking.',
  },
];

export default function About() {
  return (
    <div style={{ flex: '1 0 auto', background: C.white, width: '100%' }}>
      <style>{ABOUT_STYLES}</style>

      <PageHero
        crumb={{ label: 'About' }}
        eyebrow="Our story"
        title="A Rohtak workshop."
        highlight="Not a franchise."
        lede={`Open on Sheela Bypass since ${BIZ.since}. Same bays, same people, and a bill that matches the estimate — which turns out to be a harder promise to find than it should be.`}
        image="/workshop/bay-light.webp"
      >
        <Link to="/services" className="gk-btn gk-btn--primary gk-btn--lg">
          <Wrench size={17} /> Book a service
        </Link>
        <a href={`tel:${BIZ.phoneTel}`} className="gk-btn gk-btn--ghost gk-btn--lg">
          <Phone size={17} /> {BIZ.phoneDisplay}
        </a>
      </PageHero>

      {/* ── Numbers ────────────────────────────────────────────────────── */}
      <section className="gk-sec-sm" style={{ background: C.surface, borderBottom: `1px solid ${C.hairline}` }}>
        <div className="gk-wrap">
          <Stagger className="gk-ab-stats" gap={0.08}>
            {STATS.map(({ to, suffix, label, icon: Icon }) => (
              <StaggerItem key={label} className="gk-ab-stat">
                <span className="gk-ab-stat-ico"><Icon size={18} /></span>
                <CountUp to={to} suffix={suffix} className="gk-ab-stat-val" />
                <span className="gk-ab-stat-lab">{label}</span>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ── Story ──────────────────────────────────────────────────────── */}
      <section className="gk-sec">
        <div className="gk-wrap">
          <div className="gk-ab-story">
            <Reveal x={-20} y={0}>
              <p className="gk-eyebrow">How it started</p>
              <h2 className="gk-h2">
                One ramp, one mechanic,{' '}
                <span className="gk-grad">and a lot of Maruti 800s</span>
              </h2>
              <p className="gk-lede" style={{ marginTop: '1.1rem' }}>
                GK Motors opened on Sheela Bypass in {BIZ.since}, near the new railway
                crossing, doing routine service on whatever came through the gate. Most
                of it was hatchbacks. Some of it still is.
              </p>
              <p className="gk-lede" style={{ marginTop: '1rem' }}>
                {yearsOpen()} years later there are more bays, proper diagnostic equipment
                and technicians trained on specific marques — but the thing that actually
                kept people coming back was never the equipment. It was that the bill at
                the end matched the number we gave at the start.
              </p>

              <div className="gk-ab-callout">
                <span className="gk-chip gk-chip--sm gk-chip--on"><MapPin size={18} /></span>
                <span>
                  <b>{BIZ.addressLine1}</b>
                  <span>{BIZ.addressLine2}</span>
                  <a href={BIZ.mapsUrl} target="_blank" rel="noreferrer noopener">
                    Open in Maps <ArrowRight size={13} />
                  </a>
                </span>
              </div>
            </Reveal>

            <Reveal x={20} y={0} delay={0.1} className="gk-ab-shot">
              {/* Local and optimised. This slot used to hotlink Unsplash. */}
              <img src="/workshop/bay-real.webp" alt="Inside the GK Motors workshop in Rohtak"
                width={1600} height={1067} loading="lazy" decoding="async" />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Values ─────────────────────────────────────────────────────── */}
      <section className="gk-sec" style={{ background: C.surface, borderTop: `1px solid ${C.hairline}` }}>
        <div className="gk-wrap">
          <Reveal className="gk-head">
            <p className="gk-eyebrow gk-eyebrow--center">What we hold to</p>
            <h2 className="gk-h2">
              Three things we{' '}
              <span className="gk-grad">will not trade away</span>
            </h2>
            <p className="gk-lede">
              Not values in the poster-on-the-wall sense. Three specific, checkable
              things — you can hold us to every one of them on your next visit.
            </p>
          </Reveal>

          <Stagger className="gk-ab-values" gap={0.07}>
            {VALUES.map(({ n, icon: Icon, title, desc }) => (
              <StaggerItem key={n} depth={14} style={{ display: 'flex' }}>
                <article className="gk-card gk-ab-value">
                  <span className="gk-ab-value-n">{n}</span>
                  <span className="gk-chip"><Icon size={22} /></span>
                  <h3 className="gk-h3" style={{ marginTop: '1.15rem' }}>{title}</h3>
                  <p className="gk-ab-value-desc">{desc}</p>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="gk-dark gk-sec">
        <div className="gk-bloom gk-bloom--a" />
        <div className="gk-mesh" />
        <div className="gk-wrap">
          <Reveal className="gk-ab-cta">
            <div>
              <h2 className="gk-h2" style={{ color: C.white }}>
                Come and see the place
              </h2>
              <p className="gk-lede gk-lede--dark" style={{ marginTop: '0.8rem', maxWidth: '32rem' }}>
                Drive in for a free look-over, or book online and we will come and
                collect the car. No appointment needed just to ask a question.
              </p>
            </div>
            <div className="gk-ab-cta-btns">
              <Link to="/services" className="gk-btn gk-btn--primary gk-btn--lg">
                Book a service <ArrowRight size={16} />
              </Link>
              <Link to="/contact" className="gk-btn gk-btn--ghost gk-btn--lg">
                Contact us
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

const ABOUT_STYLES = `
  /* ── Numbers ───────────────────────────────────────────────────────────── */
  .gk-ab-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
    gap: clamp(0.8rem, 1.6vw, 1.2rem);
  }
  .gk-ab-stat {
    display: flex; flex-direction: column; align-items: center; text-align: center;
    gap: 0.3rem; padding: 1.5rem 1rem;
    border-radius: 18px;
    background: #FFFFFF; border: 1px solid var(--gk-hairline);
    transition: border-color .35s, transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s;
  }
  .gk-ab-stat:hover {
    border-color: rgba(21,103,211,.28); transform: translateY(-4px); box-shadow: var(--gk-sh-card);
  }
  .gk-ab-stat-ico {
    width: 38px; height: 38px; border-radius: 11px; margin-bottom: 0.35rem;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--gk-g-brand); color: #FFF;
    box-shadow: 0 6px 16px rgba(21,103,211,.28);
  }
  .gk-ab-stat-val {
    font-family: var(--gk-font-display);
    font-size: clamp(1.6rem, 3vw, 2.15rem); font-weight: 700;
    letter-spacing: -.04em; color: var(--gk-navy); line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .gk-ab-stat-lab { font-size: 0.77rem; font-weight: 600; color: var(--gk-meta); }

  /* ── Story ─────────────────────────────────────────────────────────────── */
  .gk-ab-story {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
    gap: clamp(2rem, 5vw, 4rem);
    align-items: center;
  }
  @media (max-width: 940px) { .gk-ab-story { grid-template-columns: minmax(0, 1fr); } }

  .gk-ab-callout {
    display: flex; align-items: flex-start; gap: 0.9rem;
    margin-top: 2rem; padding: 1.15rem 1.25rem;
    border-radius: 18px;
    background: var(--gk-surface); border: 1px solid var(--gk-hairline);
  }
  .gk-ab-callout > span:last-child { display: flex; flex-direction: column; min-width: 0; }
  .gk-ab-callout b {
    font-family: var(--gk-font-display); font-size: 0.92rem; font-weight: 700;
    color: var(--gk-navy);
  }
  .gk-ab-callout > span:last-child > span {
    font-size: 0.85rem; color: var(--gk-body); margin-top: 0.2rem; line-height: 1.55;
  }
  .gk-ab-callout a {
    display: inline-flex; align-items: center; gap: 0.35rem;
    margin-top: 0.6rem; text-decoration: none;
    color: var(--gk-blue); font-size: 0.82rem; font-weight: 700;
  }
  .gk-ab-callout a:hover { text-decoration: underline; }

  /* aspect-ratio holds the slot before the file lands, so the two columns do
     not jump as the photo arrives. */
  .gk-ab-shot img {
    width: 100%; height: auto; aspect-ratio: 3 / 2;
    object-fit: cover;
    border-radius: 24px;
    border: 1px solid var(--gk-hairline);
    box-shadow: var(--gk-sh-card-hover);
    display: block;
  }

  /* ── Values ────────────────────────────────────────────────────────────── */
  .gk-ab-values {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 290px), 1fr));
    gap: clamp(0.9rem, 1.6vw, 1.3rem);
  }
  .gk-ab-value { padding: 1.7rem 1.5rem 1.5rem; width: 100%; }
  .gk-ab-value-n {
    position: absolute; top: .5rem; right: 1.1rem;
    font-family: var(--gk-font-display); font-size: 3.1rem; font-weight: 700;
    line-height: 1; letter-spacing: -.05em; color: rgba(21,103,211,.07);
    transition: color .4s;
  }
  .gk-ab-value:hover .gk-ab-value-n { color: rgba(21,103,211,.14); }
  .gk-ab-value-desc {
    color: var(--gk-body); font-size: 0.855rem; line-height: 1.65; margin: 0.55rem 0 0;
  }

  /* ── Phone density ─────────────────────────────────────────────────────
     The stats row is already two-up at this width; what needed shrinking was
     everything inside it. The values cards deliberately stay one column: each
     carries a full paragraph, and at half a phone's width that becomes a
     column of two or three words per line. Two-up is for cards with short
     labels, not prose. */
  @media (max-width: 640px) {
    .gk-ab-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem; }
    .gk-ab-stat { padding: 1rem 0.6rem; border-radius: 14px; }
    .gk-ab-stat-ico { width: 30px; height: 30px; border-radius: 9px; }
    .gk-ab-stat-ico svg { width: 15px; height: 15px; }
    .gk-ab-stat-val { font-size: 1.4rem; }
    .gk-ab-stat-lab { font-size: 0.66rem; line-height: 1.3; }

    .gk-ab-value { padding: 1.15rem 1rem 1rem; }
    .gk-ab-value-n { font-size: 2.2rem; top: .35rem; right: .7rem; }
    .gk-ab-value-desc { font-size: 0.8rem; }

    .gk-ab-shot img { border-radius: 16px; }
    .gk-ab-callout { padding: 0.95rem 1rem; border-radius: 14px; }
  }

  /* ── CTA ───────────────────────────────────────────────────────────────── */
  .gk-ab-cta {
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
    gap: 1.8rem;
  }
  .gk-ab-cta-btns { display: flex; flex-wrap: wrap; gap: 0.8rem; }
  @media (max-width: 520px) {
    .gk-ab-cta-btns { width: 100%; flex-direction: column; }
    .gk-ab-cta-btns .gk-btn { width: 100%; }
  }
`;
