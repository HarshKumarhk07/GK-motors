/* ═══════════════════════════════════════════════════════════════════════════
   BRAND RAIL — "we service every one of these"
   A continuously scrolling rail of the marques a Rohtak workshop actually sees
   in its bays, from Maruti hatchbacks to the occasional 3-Series.

   WHY THE MARKS ARE INLINE SVG, NOT IMAGE FILES
   Sixteen <img> tags would be sixteen requests on the landing page's critical
   path, sixteen chances of a broken-image icon, and sixteen files in different
   sizes, crops and colours that could never be made to sit at one optical
   weight. Drawn inline they are one monochrome family: every mark inherits
   `currentColor`, so the rail can go grey at rest and full brand-navy on
   hover with a single CSS rule, and the whole set weighs a couple of KB of
   markup that gzips to almost nothing.

   Marques whose wordmark IS the logo (Tata, Mahindra, Maruti Suzuki, Kia)
   are set as type rather than traced badly — a wrong path is more obviously
   wrong than a clean word.

   HOW THE MARQUEE LOOPS
   The track holds the list twice and translates by exactly -50%. At the moment
   the animation resets, copy 2 is sitting precisely where copy 1 started, so
   the seam is unobservable. This is why the duplicate must be an exact copy
   and why the second one is aria-hidden — a screen reader should hear the
   sixteen brands once, not thirty-two.
   ═══════════════════════════════════════════════════════════════════════════ */
import { C, F } from '../../theme';

const sw = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinejoin: 'round', strokeLinecap: 'round' };

/* Each mark draws into a 48×48 box and is scaled by the rail, so they all land
   at the same optical size without per-brand fiddling. */
const MARKS = {
  toyota: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <ellipse cx="24" cy="24" rx="22" ry="13.5" {...sw} />
      <ellipse cx="24" cy="17.6" rx="6.8" ry="5.2" {...sw} />
      <ellipse cx="24" cy="26.6" rx="14.6" ry="5.4" {...sw} />
    </svg>
  ),
  honda: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 11h32l-2.5 26h-27z" {...sw} />
      <path d="M17.5 16.5v15M30.5 16.5v15M17.5 24h13" {...sw} />
    </svg>
  ),
  hyundai: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <ellipse cx="24" cy="24" rx="22" ry="12.5" {...sw} />
      <path d="M16.5 32.5 21 15.5M31.5 32.5 27 15.5M18.6 24h10.8" {...sw} />
    </svg>
  ),
  volkswagen: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" {...sw} />
      <path d="M15.5 10.5 24 25.5 32.5 10.5" {...sw} />
      <path d="M9.5 21.5 16.5 38 24 25.5 31.5 38 38.5 21.5" {...sw} />
    </svg>
  ),
  skoda: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" {...sw} />
      <path d="M12 30.5q6.5-13.5 20-10.5l6-4-2.6 8 2.6 8-6.5-3.8q-11 6.5-19.5 2.3z" fill="currentColor" stroke="none" />
    </svg>
  ),
  nissan: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="17.5" {...sw} />
      <path d="M2.5 18.5h43v11h-43z" {...sw} />
    </svg>
  ),
  renault: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 2.5 41 24 24 45.5 7 24z" {...sw} />
      <path d="M24 13 32.5 24 24 35 15.5 24z" {...sw} />
    </svg>
  ),
  mercedes: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" {...sw} />
      <path d="M24 24V4.5M24 24 7.2 33.8M24 24l16.8 9.8" {...sw} />
    </svg>
  ),
  bmw: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" {...sw} />
      <circle cx="24" cy="24" r="14.5" {...sw} strokeWidth={1.6} />
      <path d="M24 9.5A14.5 14.5 0 0 1 38.5 24H24z" fill="currentColor" stroke="none" />
      <path d="M24 38.5A14.5 14.5 0 0 1 9.5 24H24z" fill="currentColor" stroke="none" />
    </svg>
  ),
  audi: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      {[9.6, 19.2, 28.8, 38.4].map((cx) => (
        <circle key={cx} cx={cx} cy="24" r="8.6" {...sw} strokeWidth={2.4} />
      ))}
    </svg>
  ),
  mg: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M15.5 3.5h17L44.5 15.5v17L32.5 44.5h-17L3.5 32.5v-17z" {...sw} />
      <text x="24" y="30.5" textAnchor="middle" fontFamily={F.display} fontSize="15" fontWeight="700"
        fill="currentColor" stroke="none" letterSpacing="0.5">MG</text>
    </svg>
  ),
  jeep: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="6.5" cy="24" r="5" fill="currentColor" stroke="none" />
      <circle cx="41.5" cy="24" r="5" fill="currentColor" stroke="none" />
      {[15, 20, 25, 30].map((x) => (
        <rect key={x} x={x} y="15" width="3" height="18" rx="1.5" fill="currentColor" stroke="none" />
      ))}
    </svg>
  ),
  ford: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <ellipse cx="24" cy="24" rx="22" ry="13" {...sw} />
      <ellipse cx="24" cy="24" rx="19" ry="10.2" {...sw} strokeWidth={1.2} />
      <text x="24" y="28.6" textAnchor="middle" fontFamily={F.display} fontSize="11.5" fontWeight="700"
        fill="currentColor" stroke="none" letterSpacing="0.5">Ford</text>
    </svg>
  ),
};

/* `mark` names a drawing above; a brand without one is set as type. `w` is the
   rendered width in px — wordmarks need more room than badges, and forcing
   them all to one width is what makes a rail look ragged. */
const BRANDS = [
  { name: 'Maruti Suzuki', w: 116 },
  { name: 'Hyundai', mark: 'hyundai', w: 52 },
  { name: 'Tata', w: 58 },
  { name: 'Mahindra', mark: null, w: 88 },
  { name: 'Toyota', mark: 'toyota', w: 52 },
  { name: 'Honda', mark: 'honda', w: 44 },
  { name: 'Kia', w: 44 },
  { name: 'Volkswagen', mark: 'volkswagen', w: 44 },
  { name: 'Skoda', mark: 'skoda', w: 44 },
  { name: 'MG', mark: 'mg', w: 44 },
  { name: 'Renault', mark: 'renault', w: 44 },
  { name: 'Nissan', mark: 'nissan', w: 48 },
  { name: 'Ford', mark: 'ford', w: 54 },
  { name: 'Jeep', mark: 'jeep', w: 50 },
  { name: 'Mercedes-Benz', mark: 'mercedes', w: 44 },
  { name: 'BMW', mark: 'bmw', w: 44 },
  { name: 'Audi', mark: 'audi', w: 54 },
];

function BrandItem({ brand }) {
  return (
    <li className="gk-brand" style={{ width: brand.w }} title={brand.name}>
      {brand.mark
        ? MARKS[brand.mark]
        : <span className="gk-brand-word">{brand.name}</span>}
    </li>
  );
}

export default function BrandRail() {
  return (
    <div className="gk-rail">
      <style>{RAIL_STYLES}</style>

      {/* The two edge fades are what stop the rail from looking like it is
          being clipped by the viewport: brands dissolve into the background
          instead of vanishing at a hard line. */}
      <div className="gk-rail-fade gk-rail-fade-l" aria-hidden="true" />
      <div className="gk-rail-fade gk-rail-fade-r" aria-hidden="true" />

      <div className="gk-rail-track">
        <ul className="gk-rail-set">
          {BRANDS.map((b) => <BrandItem key={b.name} brand={b} />)}
        </ul>
        <ul className="gk-rail-set" aria-hidden="true">
          {BRANDS.map((b) => <BrandItem key={`${b.name}-dup`} brand={b} />)}
        </ul>
      </div>
    </div>
  );
}

const RAIL_STYLES = `
  .gk-rail { position: relative; overflow: hidden; width: 100%; }

  /* The track is 2x the content and slides exactly one copy's width. Paused on
     hover so a visitor who wants to look at a particular badge can. */
  .gk-rail-track {
    display: flex;
    width: max-content;
    animation: gk-rail-scroll 46s linear infinite;
    will-change: transform;
  }
  .gk-rail:hover .gk-rail-track { animation-play-state: paused; }

  @keyframes gk-rail-scroll {
    from { transform: translate3d(0, 0, 0); }
    to   { transform: translate3d(-50%, 0, 0); }
  }

  /* An endlessly moving strip is a genuine problem for vestibular disorders
     and it carries no information you cannot get by reading the list. Stopped
     outright rather than slowed. */
  @media (prefers-reduced-motion: reduce) {
    .gk-rail-track { animation: none; flex-wrap: wrap; justify-content: center; }
    .gk-rail-set:last-child { display: none; }
  }

  .gk-rail-set {
    display: flex; align-items: center;
    gap: clamp(2.2rem, 5vw, 4rem);
    padding: 0 clamp(1.1rem, 2.5vw, 2rem);
    margin: 0; list-style: none;
    flex-shrink: 0;
  }

  .gk-brand {
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    color: ${C.meta};
    opacity: 0.62;
    transition: color 0.35s ease, opacity 0.35s ease, transform 0.35s ease;
  }
  .gk-brand svg { width: 100%; height: auto; display: block; }

  .gk-brand-word {
    font-family: ${F.display};
    font-size: 1.02rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    white-space: nowrap;
    line-height: 1;
  }

  /* Colour and full opacity are the reward for pointing at one. On the dark
     variant the resting state is a dim slate and the hover is cyan, because
     navy on navy would be invisible. */
  .gk-rail:hover .gk-brand { opacity: 0.4; }
  .gk-rail .gk-brand:hover {
    color: ${C.navy};
    opacity: 1;
    transform: translateY(-3px) scale(1.06);
  }

  .gk-rail-fade {
    position: absolute; top: 0; bottom: 0; width: clamp(48px, 10%, 130px);
    z-index: 2; pointer-events: none;
  }
  .gk-rail-fade-l { left: 0;  background: linear-gradient(90deg, var(--gk-rail-bg, #FFF) 0%, transparent 100%); }
  .gk-rail-fade-r { right: 0; background: linear-gradient(270deg, var(--gk-rail-bg, #FFF) 0%, transparent 100%); }

  /* ── Dark variant ────────────────────────────────────────────────────────
     Set --gk-rail-bg to the surrounding colour so the edge fades match, and
     add .gk-rail--dark for the inverted hover treatment. */
  .gk-rail--dark .gk-brand { color: ${C.metaDark}; opacity: 0.55; }
  .gk-rail--dark .gk-brand:hover { color: ${C.cyanSoft}; opacity: 1; }

  @media (max-width: 640px) {
    .gk-rail-track { animation-duration: 32s; }
    .gk-rail-set { gap: 2rem; }
  }
`;
