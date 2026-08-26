import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import CategoryIcon from './CategoryIcon';

/* ═══════════════════════════════════════════════════════════════════════════
   GK Motors service cards.

   Every category renders through ONE card component with three SIZES, all
   selected by `variant` swapping a single class (see SIZES):

     featured + compact — the two-tier arrangement, used when `featured` is on:
       four large cards lead and the rest follow as a compact grid. Which group
       a category lands in is decided purely by its position in the ordered
       list (see FEATURED_COUNT), never by which category it is.
     uniform — one flat 4-across grid of equally sized cards, used when
       `featured` is off. This is what the home page renders.

   Within either group a card's size must not depend on which category it is or
   on how much copy that category happens to carry, so the layout is built from
   three rules rather than per-card tweaks:

     1. `grid-auto-rows: 1fr` — every row in the grid is as tall as the
        tallest card, so cards match across rows, not just within one.
     2. `height: 100%` + flex column on the card — the card fills its track.
     3. `margin-top: auto` on the footer — the price and arrow are pushed to
        the bottom edge, so they land on the same baseline in every card
        regardless of how many lines the title or description took.

   The description is clamped to two lines and reserves that height even when
   it is one line (or missing), so a short blurb cannot pull a card in.

   Adding a thirteenth category needs no change here: it inherits the same
   card automatically.

   Used by the home page (as links) and by /services (pass `onSelect` for
   button behaviour).
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Display order only — this list has NO effect on how a card looks.
 * Every card renders identically; these four simply lead the grid because
 * they carry most of the demand. Anything not listed keeps its catalogue
 * order behind them, so a new category still appears without a code change.
 * Ids are categoryId (see seeds/seedServiceCategories.js).
 */
export const LEAD_CATEGORY_IDS = [1, 2, 5, 7];

/** Stable sort: listed ids first in the order given, then everything else. */
export const orderCategories = (categories, leadIds = LEAD_CATEGORY_IDS) => {
  const rank = new Map(leadIds.map((id, i) => [id, i]));
  return [...categories].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id) : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b.id) ? rank.get(b.id) : Number.MAX_SAFE_INTEGER;
    return ra - rb;   // Array#sort is stable, so ties keep catalogue order
  });
};

const label = (c) => c.name || c.label || '';
const blurb = (c) => c.description || c.desc || '';
const priceLabel = (c) => c.price || c.meta || 'View packages';

/**
 * One card, two sizes.
 *
 * `variant` only swaps a class — the markup is identical, so a category can
 * move between the featured and compact groups purely by its position in the
 * ordered list. Nothing about a card depends on *which* category it is.
 */
const SIZES = {
  featured: { cls: 'lg', chip: 64, glyph: 30, arrow: 16 },
  uniform:  { cls: 'md', chip: 48, glyph: 22, arrow: 16 },
  compact:  { cls: 'sm', chip: 44, glyph: 21, arrow: 14 },
};

function ServiceCard({ category, onSelect, hrefFor, variant = 'compact' }) {
  const size = SIZES[variant] || SIZES.compact;
  const inner = (
    <>
      <span className="gk-sc-icon">
        <CategoryIcon
          slug={category.slug}
          image={category.image}
          icon={category.icon}
          size={size.chip}
          iconSize={size.glyph}
        />
      </span>
      <span className="gk-sc-name">{label(category)}</span>
      <span className="gk-sc-desc">{blurb(category)}</span>
      <span className="gk-sc-foot">
        <span className="gk-sc-price">{priceLabel(category)}</span>
        <span className="gk-sc-arrow" aria-hidden="true">
          <ArrowRight size={size.arrow} strokeWidth={2.5} />
        </span>
      </span>
    </>
  );

  const cls = `gk-sc gk-sc--${size.cls}`;

  if (onSelect) {
    return (
      <button type="button" className={cls} onClick={() => onSelect(category)} aria-label={label(category)}>
        {inner}
      </button>
    );
  }
  return (
    <Link to={hrefFor(category)} className={cls} aria-label={label(category)}>
      {inner}
    </Link>
  );
}

/**
 * How many categories lead the grid as large cards.
 *
 * Matches LEAD_CATEGORY_IDS, which already resolves to Car Service, AC Service
 * & Repair, Denting & Painting and Car Spa & Cleaning — exactly the four the
 * reference design gives prominence. Nothing is hardcoded per category and no
 * record is duplicated: the split is positional, so reordering LEAD_CATEGORY_IDS
 * or adding a thirteenth category needs no change here.
 */
const FEATURED_COUNT = 4;

function ServiceCategoryGrid({
  categories = [],
  onSelect,
  hrefFor = (c) => `/services?category=${c.id}`,
  limit,
  leadIds = LEAD_CATEGORY_IDS,
  /** Set false to render one uniform grid (used where hierarchy is not wanted). */
  featured = true,
}) {
  const ordered = orderCategories(categories, leadIds);
  const shown = typeof limit === 'number' ? ordered.slice(0, limit) : ordered;
  if (!shown.length) return null;

  // Only split when there is actually a tail to contrast against, otherwise a
  // short catalogue would render four big cards and nothing else.
  const split = featured && shown.length > FEATURED_COUNT;
  const lead = split ? shown.slice(0, FEATURED_COUNT) : [];
  const rest = split ? shown.slice(FEATURED_COUNT) : shown;

  return (
    <>
      <style>{SERVICE_CARD_STYLES}</style>

      {split && (
        <div className="gk-sc-grid gk-sc-grid--lg">
          {lead.map((c) => (
            <ServiceCard key={c.id} category={c} onSelect={onSelect} hrefFor={hrefFor} variant="featured" />
          ))}
        </div>
      )}

      <div className={split ? 'gk-sc-grid gk-sc-grid--sm gk-sc-grid--after-lg' : 'gk-sc-grid gk-sc-grid--md'}>
        {rest.map((c) => (
          <ServiceCard key={c.id} category={c} onSelect={onSelect} hrefFor={hrefFor} variant={split ? 'compact' : 'uniform'} />
        ))}
      </div>
    </>
  );
}

/* Memoised because this is the biggest subtree on the home page — twelve
   cards, each mounting a CategoryIcon with its own state and effect — and it
   sits under a parent whose state changes several times while the parts strip
   loads. With Home's `categories` array now memoised, the props here are
   reference-stable and React can skip the whole grid on those renders.
   Rendering is unchanged; only the sort/slice/reconcile work is avoided. */
export default memo(ServiceCategoryGrid);

/* Every dimension is relative or grid-derived. `minmax(0, 1fr)` is what lets a
   long, unbreakable service name shrink its track instead of forcing the grid
   wider than the viewport. */
const SERVICE_CARD_STYLES = `
  .gk-sc-grid {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: 1fr;          /* identical height across every row */
    gap: 1rem;
    align-items: stretch;
  }
  @media (min-width: 768px)  { .gk-sc-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; } }
  @media (min-width: 1024px) { .gk-sc-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1.25rem; } }

  /* ── Featured group: four leading services, 2 x 2 ──────────────────────
     Two columns at EVERY width, which is what makes it a 2x2 block rather
     than a row that reflows. Two columns is still comfortable at 320px
     because the compact rules below trade padding and type size for width
     rather than letting the track collapse. */
  .gk-sc-grid--lg {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }
  @media (min-width: 480px)  { .gk-sc-grid--lg { gap: 1rem; } }
  @media (min-width: 768px)  { .gk-sc-grid--lg { gap: 1.25rem; } }
  @media (min-width: 1024px) { .gk-sc-grid--lg { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem; } }

  /* ── Compact group: the remaining eight ───────────────────────────────
     Genuinely smaller cards, never the same size as the featured four. */
  .gk-sc-grid--sm {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem;
  }
  @media (min-width: 480px)  { .gk-sc-grid--sm { gap: 0.85rem; } }
  @media (min-width: 768px)  { .gk-sc-grid--sm { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; } }
  @media (min-width: 1024px) { .gk-sc-grid--sm { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1.1rem; } }

  /* ── Uniform grid ─────────────────────────────────────────────────────
     Four to a row on desktop, three on a tablet, two on a phone. Eight cards
     therefore land as two clean rows of four at the width this was designed
     against, and expanding to twelve adds a third row rather than reflowing
     the first two. */
  .gk-sc-grid--md {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }
  @media (min-width: 480px)  { .gk-sc-grid--md { gap: 1rem; } }
  @media (min-width: 768px)  { .gk-sc-grid--md { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.25rem; } }
  @media (min-width: 1024px) { .gk-sc-grid--md { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1.4rem; } }

  .gk-sc-grid--after-lg { margin-top: 0.75rem; }
  @media (min-width: 768px) { .gk-sc-grid--after-lg { margin-top: 1.25rem; } }

  .gk-sc {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 210px;
    min-width: 0;
    width: 100%;
    text-align: left;
    padding: 1.25rem 1.1rem 1.1rem;
    background: #FFFFFF;
    border: 1px solid #E4EBF7;
    border-radius: 16px;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
    font: inherit;
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
    transition: transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .22s, border-color .22s;
  }
  .gk-sc:hover { border-color: #BFD4F7; box-shadow: 0 14px 28px rgba(21, 103, 211, 0.14); transform: translateY(-3px); }
  .gk-sc:active { transform: translateY(-1px); }
  .gk-sc:focus-visible { outline: 2px solid #1567D3; outline-offset: 2px; }

  /* ── Size variants ────────────────────────────────────────────────────
     Only padding, min-height and type scale differ. Every structural rule —
     flex column, height:100%, margin-top:auto on the footer, the two-line
     clamps — is inherited from .gk-sc, so cards stay equal-height *within*
     each group exactly as before. */
  .gk-sc--lg {
    min-height: 178px;
    padding: 1.1rem 0.9rem 1rem;
  }
  .gk-sc--sm {
    min-height: 132px;
    padding: 0.8rem 0.75rem 0.75rem;
    border-radius: 13px;
    box-shadow: 0 3px 10px rgba(15, 23, 42, 0.05);
  }
  .gk-sc--sm .gk-sc-name  { font-size: 0.82rem; line-height: 1.25; min-height: 2.05em; margin-bottom: 0.15rem; }
  .gk-sc--sm .gk-sc-desc  { display: none; }          /* the blurb is what makes a card tall */
  .gk-sc--sm .gk-sc-icon  { margin-bottom: 0.55rem; }
  .gk-sc--sm .gk-sc-foot  { padding-top: 0.55rem; }
  .gk-sc--sm .gk-sc-price { font-size: 0.7rem; }
  .gk-sc--sm .gk-sc-arrow { width: 24px; height: 24px; }

  /* Between the two older scales: roomy enough to carry the two-line blurb
     the compact card drops, restrained enough that four sit in a desktop row
     without the type ballooning the way the featured card's would. */
  .gk-sc--md {
    min-height: 186px;
    padding: 1.3rem 1.2rem 1.1rem;
  }
  .gk-sc--md .gk-sc-icon  { margin-bottom: 0.9rem; }
  .gk-sc--md .gk-sc-name  { font-size: 0.95rem; }
  .gk-sc--md .gk-sc-desc  { font-size: 0.79rem; }
  .gk-sc--md .gk-sc-price { font-size: 0.83rem; }
  @media (min-width: 768px) {
    .gk-sc--md { min-height: 200px; padding: 1.45rem 1.35rem 1.2rem; }
    .gk-sc--md .gk-sc-name { font-size: 1.02rem; }
    .gk-sc--md .gk-sc-desc { font-size: 0.82rem; }
  }
  @media (min-width: 1024px) {
    .gk-sc--md { min-height: 212px; padding: 1.6rem 1.5rem 1.3rem; }
  }

  @media (min-width: 480px) {
    .gk-sc--lg { min-height: 196px; padding: 1.25rem 1.1rem 1.1rem; }
    .gk-sc--sm { min-height: 142px; padding: 0.9rem 0.85rem 0.85rem; }
    .gk-sc--sm .gk-sc-name { font-size: 0.86rem; }
  }
  @media (min-width: 768px) {
    .gk-sc--lg { min-height: 224px; padding: 1.6rem 1.4rem 1.35rem; }
    .gk-sc--lg .gk-sc-name { font-size: 1.16rem; }
    .gk-sc--lg .gk-sc-desc { font-size: 0.86rem; -webkit-line-clamp: 3; min-height: 3.9em; }
    .gk-sc--lg .gk-sc-price { font-size: 0.9rem; }
    .gk-sc--sm { min-height: 150px; }
    .gk-sc--sm .gk-sc-name { font-size: 0.9rem; }
  }
  @media (min-width: 1024px) {
    .gk-sc--lg { min-height: 244px; padding: 1.9rem 1.7rem 1.5rem; }
    .gk-sc--lg .gk-sc-name { font-size: 1.28rem; }
  }

  .gk-sc-icon { display: block; margin-bottom: 0.85rem; }

  .gk-sc-name {
    font-size: 1rem;
    font-weight: 800;
    color: #0F172A;
    line-height: 1.28;
    letter-spacing: -0.01em;
    margin-bottom: 0.3rem;
    overflow-wrap: anywhere;   /* a long name wraps instead of widening the track */
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    min-height: 2.56em;        /* two lines reserved, so one-line names align too */
  }
  .gk-sc-desc {
    color: #475569;
    font-size: 0.81rem;
    line-height: 1.5;
    font-weight: 500;
    overflow-wrap: anywhere;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    min-height: 2.4em;         /* a short blurb still reserves two lines */
  }

  .gk-sc-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: auto;          /* pins the row to the bottom of every card */
    padding-top: 0.9rem;
    min-width: 0;
  }
  .gk-sc-price {
    color: #1567D3;
    font-weight: 800;
    font-size: 0.83rem;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;       /* never break a price mid-number */
  }
  .gk-sc-arrow {
    width: 32px; height: 32px; border-radius: 50%;
    border: 1.5px solid #BFD4F7;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; color: #1567D3;
    transition: background .2s, color .2s, border-color .2s;
  }
  .gk-sc:hover .gk-sc-arrow { background: #1567D3; border-color: #1567D3; color: #FFFFFF; }

  @media (max-width: 640px) {
    /* Type and chrome only. Sizing belongs to the --lg / --sm variants above:
       setting min-height/padding on the bare .gk-sc here would land later in
       the sheet at equal specificity and flatten both variants back to one
       size on exactly the screens where the hierarchy matters most. */
    .gk-sc { border-radius: 14px; }
    .gk-sc--lg .gk-sc-name { font-size: 0.95rem; }
    .gk-sc--lg .gk-sc-desc { font-size: 0.75rem; }
    .gk-sc--md .gk-sc-name { font-size: 0.86rem; }
    .gk-sc--md .gk-sc-desc { font-size: 0.74rem; }
    .gk-sc-price { font-size: 0.74rem; }
    .gk-sc--lg .gk-sc-arrow { width: 28px; height: 28px; }
    /* Twenty cards scroll past on the home page. A blurred shadow costs the
       rasteriser roughly in proportion to the area its blur covers, so halving
       the radius keeps the same sense of lift for a fraction of the paint.
       (Phase 2B — preserved.) */
    .gk-sc { box-shadow: 0 3px 8px rgba(15, 23, 42, 0.07); }
  }

  /* Very narrow phones: the featured pair stays two-up, but everything gives
     a little so nothing clips. Deliberately NOT a drop to one column — that
     turned the four leading services into a tall stack and lost the 2x2. */
  @media (max-width: 359px) {
    .gk-sc--lg { min-height: 168px; padding: 0.9rem 0.7rem 0.8rem; }
    .gk-sc--lg .gk-sc-name { font-size: 0.88rem; }
    .gk-sc--lg .gk-sc-desc { display: none; }
    .gk-sc--sm { min-height: 124px; padding: 0.7rem 0.6rem 0.65rem; }
    .gk-sc--sm .gk-sc-name { font-size: 0.78rem; }
    /* The blurb is what makes these tall; at 359px two columns need the room
       more than they need the second line of copy. */
    .gk-sc--md { min-height: 158px; padding: 0.85rem 0.75rem 0.8rem; }
    .gk-sc--md .gk-sc-name { font-size: 0.8rem; }
    .gk-sc--md .gk-sc-desc { display: none; }
  }

  /* A tap on a touch screen fires :hover, which re-blurs the bigger shadow,
     re-composites the card and then frequently stays stuck that way. Reserve
     the lift for pointers that can genuinely hover. */
  @media (hover: none) {
    .gk-sc:hover {
      transform: none;
      box-shadow: 0 3px 8px rgba(15, 23, 42, 0.07);
      border-color: #E4EBF7;
    }
    .gk-sc:hover .gk-sc-arrow { background: transparent; border-color: #BFD4F7; color: #1567D3; }
  }

  /* The lift is decoration; hold still for anyone who asked for less motion. */
  @media (prefers-reduced-motion: reduce) {
    .gk-sc, .gk-sc:hover { transition: none; transform: none; }
  }
`;

