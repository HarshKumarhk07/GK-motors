import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import CategoryIcon from './CategoryIcon';

/* ═══════════════════════════════════════════════════════════════════════════
   GK Motors service cards.

   Every category renders through ONE card component with ONE set of styles —
   there is deliberately no "featured" variant. A card's size must not depend
   on which category it is or on how much copy that category happens to carry,
   so the layout is built from three rules rather than per-card tweaks:

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

function ServiceCard({ category, onSelect, hrefFor }) {
  const inner = (
    <>
      <span className="gk-sc-icon">
        <CategoryIcon
          slug={category.slug}
          image={category.image}
          icon={category.icon}
          size={54}
          iconSize={25}
        />
      </span>
      <span className="gk-sc-name">{label(category)}</span>
      <span className="gk-sc-desc">{blurb(category)}</span>
      <span className="gk-sc-foot">
        <span className="gk-sc-price">{priceLabel(category)}</span>
        <span className="gk-sc-arrow" aria-hidden="true">
          <ArrowRight size={15} strokeWidth={2.5} />
        </span>
      </span>
    </>
  );

  if (onSelect) {
    return (
      <button type="button" className="gk-sc" onClick={() => onSelect(category)} aria-label={label(category)}>
        {inner}
      </button>
    );
  }
  return (
    <Link to={hrefFor(category)} className="gk-sc" aria-label={label(category)}>
      {inner}
    </Link>
  );
}

export default function ServiceCategoryGrid({
  categories = [],
  onSelect,
  hrefFor = (c) => `/services?category=${c.id}`,
  limit,
  leadIds = LEAD_CATEGORY_IDS,
}) {
  const ordered = orderCategories(categories, leadIds);
  const shown = typeof limit === 'number' ? ordered.slice(0, limit) : ordered;
  if (!shown.length) return null;

  return (
    <>
      <style>{SERVICE_CARD_STYLES}</style>
      <div className="gk-sc-grid">
        {shown.map((c) => (
          <ServiceCard key={c.id} category={c} onSelect={onSelect} hrefFor={hrefFor} />
        ))}
      </div>
    </>
  );
}

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

  /* Below 376px, drop to 1 column so text & pricing remain clean without clipping */
  @media (max-width: 375px) {
    .gk-sc-grid { grid-template-columns: 1fr !important; gap: 0.85rem !important; }
  }

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
    border-top: 3px solid #1D4ED8;
    border-radius: 16px;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
    font: inherit;
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
    transition: transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .22s, border-color .22s;
  }
  .gk-sc:hover { border-color: #BFD4F7; border-top-color: #1D4ED8; box-shadow: 0 14px 28px rgba(30, 58, 138, 0.12); transform: translateY(-3px); }
  .gk-sc:active { transform: translateY(-1px); }
  .gk-sc:focus-visible { outline: 2px solid #2563EB; outline-offset: 2px; }

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
    color: #64748B;
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
    color: #1D4ED8;
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
    flex-shrink: 0; color: #2563EB;
    transition: background .2s, color .2s, border-color .2s;
  }
  .gk-sc:hover .gk-sc-arrow { background: #1D4ED8; border-color: #1D4ED8; color: #FFFFFF; }

  @media (max-width: 640px) {
    .gk-sc { min-height: 190px; padding: 1rem 0.85rem 0.9rem; border-radius: 14px; }
    .gk-sc-name { font-size: 0.9rem; }
    .gk-sc-desc { font-size: 0.75rem; }
    .gk-sc-price { font-size: 0.76rem; }
    .gk-sc-arrow { width: 28px; height: 28px; }
  }

  /* The lift is decoration; hold still for anyone who asked for less motion. */
  @media (prefers-reduced-motion: reduce) {
    .gk-sc, .gk-sc:hover { transition: none; transform: none; }
  }
`;

