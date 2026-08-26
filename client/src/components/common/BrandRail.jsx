/* ═══════════════════════════════════════════════════════════════════════════
   BRAND RAIL — "we service every one of these"
   A continuously scrolling rail of the marques a Rohtak workshop actually sees
   in its bays, from Maruti hatchbacks to the occasional 3-Series.

   THE LOGOS ARE REAL
   An earlier version traced each badge by hand as inline SVG. Hand-traced
   logos are *approximately* right, and approximately right is worse than
   absent: a Hyundai H at the wrong slant or a Suzuki S with the wrong
   counter-shape reads as a knock-off and undermines the exact claim the rail
   is making. These are the genuine marks, from Simple Icons (the icon files
   are CC0; the trademarks remain each manufacturer's, and showing them to say
   "we service this brand" is ordinary nominative use).

   WHY THEY ARE CSS MASKS AND NOT <img>
   Each file is a single-colour glyph in that brand's own colour — Toyota red,
   Ford blue, Kia black. Sixteen of those in a row is a fruit salad, and an
   <img> cannot be recoloured from CSS. Loading each SVG as a `mask-image` over
   a `currentColor` background keeps the real shape but hands colour back to
   the stylesheet, so the whole rail sits in one calm navy at rest and lights
   up brand-cyan under the pointer. It also means the dark variant needs no
   second set of files.

   HOW THE MARQUEE LOOPS
   The track holds the list twice and translates by exactly -50%. At the moment
   the animation resets, copy 2 sits precisely where copy 1 started, so the
   seam is unobservable. This is why the duplicate must be an exact copy, and
   why the second one is aria-hidden — a screen reader should hear sixteen
   brands once, not thirty-two.
   ═══════════════════════════════════════════════════════════════════════════ */

/* `file` is the basename in /public/brands. `w` is the rendered width in px:
   a wordmark (Kia, Tata, Mahindra) needs more room than a round badge, and
   forcing every mark to one width is exactly what makes a logo rail look
   ragged. These are tuned per-glyph by eye so they land at the same OPTICAL
   weight, which is not the same as the same measured size. */
const BRANDS = [
  { name: 'Maruti Suzuki', file: 'maruti-suzuki', w: 46 },
  { name: 'Hyundai',       file: 'hyundai',       w: 60 },
  { name: 'Tata',          file: 'tata',          w: 54 },
  { name: 'Mahindra',      file: 'mahindra',      w: 58 },
  { name: 'Toyota',        file: 'toyota',        w: 58 },
  { name: 'Honda',         file: 'honda',         w: 52 },
  { name: 'Kia',           file: 'kia',           w: 62 },
  { name: 'Volkswagen',    file: 'volkswagen',    w: 44 },
  { name: 'Škoda',         file: 'skoda',         w: 46 },
  { name: 'MG',            file: 'mg',            w: 56 },
  { name: 'Renault',       file: 'renault',       w: 34 },
  { name: 'Nissan',        file: 'nissan',        w: 52 },
  { name: 'Ford',          file: 'ford',          w: 58 },
  { name: 'Jeep',          file: 'jeep',          w: 60 },
  { name: 'BMW',           file: 'bmw',           w: 44 },
  { name: 'Audi',          file: 'audi',          w: 62 },
];

function BrandItem({ brand }) {
  return (
    <li
      className="gk-brand"
      style={{
        width: brand.w,
        /* Consumed by the mask-image declarations in the stylesheet. Set here
           rather than generating sixteen CSS rules for what is one rule with
           one changing URL. */
        '--gk-brand-src': `url(/brands/${brand.file}.svg)`,
      }}
    >
      {/* The glyph is decorative; the name is the accessible content and is
          visually hidden rather than dropped, so the rail is a readable list
          of brands to a screen reader and to search engines. */}
      <span className="gk-brand-mark" aria-hidden="true" />
      <span className="gk-brand-name">{brand.name}</span>
    </li>
  );
}

export default function BrandRail() {
  return (
    <div className="gk-rail">
      <style>{RAIL_STYLES}</style>

      {/* The edge fades stop the rail looking like it is being clipped by the
          viewport: brands dissolve into the background instead of vanishing at
          a hard vertical line. */}
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
     hover so somebody who wants to check a particular badge can. */
  .gk-rail-track {
    display: flex;
    width: max-content;
    animation: gk-rail-scroll 48s linear infinite;
    will-change: transform;
  }
  .gk-rail:hover .gk-rail-track { animation-play-state: paused; }

  @keyframes gk-rail-scroll {
    from { transform: translate3d(0, 0, 0); }
    to   { transform: translate3d(-50%, 0, 0); }
  }

  /* An endlessly moving strip is a real problem for vestibular disorders and
     it carries no information you cannot get by reading the list. Stopped
     outright rather than slowed, and wrapped so every brand is still shown. */
  @media (prefers-reduced-motion: reduce) {
    .gk-rail-track { animation: none; flex-wrap: wrap; justify-content: center; }
    .gk-rail-set:last-child { display: none; }
  }

  .gk-rail-set {
    display: flex; align-items: center;
    gap: clamp(2.4rem, 5vw, 4.2rem);
    padding: 0 clamp(1.2rem, 2.5vw, 2.1rem);
    margin: 0; list-style: none;
    flex-shrink: 0;
  }

  .gk-brand {
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    height: 34px;
    color: var(--gk-navy);
    transition: color .35s ease, opacity .35s ease, transform .35s cubic-bezier(.22,1,.36,1);
    opacity: .42;
  }

  /* The mask is what lets a red Toyota glyph render in our navy: the SVG
     supplies the shape, currentColor supplies the paint. mask-size:contain
     keeps every glyph inside its box whatever its intrinsic aspect ratio. */
  .gk-brand-mark {
    display: block;
    width: 100%; height: 100%;
    background-color: currentColor;
    -webkit-mask-image: var(--gk-brand-src);
            mask-image: var(--gk-brand-src);
    -webkit-mask-size: contain;
            mask-size: contain;
    -webkit-mask-repeat: no-repeat;
            mask-repeat: no-repeat;
    -webkit-mask-position: center;
            mask-position: center;
  }

  /* Visually hidden, not display:none — the brand names are the accessible
     content of this list and must stay in the accessibility tree. */
  .gk-brand-name {
    position: absolute; width: 1px; height: 1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
  }

  /* Dim the rest of the rail when one is pointed at, so the hovered mark reads
     as selected rather than merely brighter. */
  .gk-rail:hover .gk-brand { opacity: .22; }
  .gk-rail .gk-brand:hover {
    color: var(--gk-blue);
    opacity: 1;
    transform: scale(1.12);
  }

  .gk-rail-fade {
    position: absolute; top: 0; bottom: 0; width: clamp(48px, 10%, 140px);
    z-index: 2; pointer-events: none;
  }
  .gk-rail-fade-l { left: 0;  background: linear-gradient(90deg,  var(--gk-rail-bg, #FFF) 0%, transparent 100%); }
  .gk-rail-fade-r { right: 0; background: linear-gradient(270deg, var(--gk-rail-bg, #FFF) 0%, transparent 100%); }

  /* Dark variant: set --gk-rail-bg to the surrounding colour so the fades
     match, and add .gk-rail--dark for the inverted treatment. */
  .gk-rail--dark .gk-brand { color: #FFFFFF; opacity: .34; }
  .gk-rail--dark .gk-brand:hover { color: var(--gk-cyan-soft); opacity: 1; }

  @media (max-width: 640px) {
    .gk-rail-track { animation-duration: 34s; }
    .gk-rail-set { gap: 2.1rem; }
    .gk-brand { height: 28px; }
  }
`;
