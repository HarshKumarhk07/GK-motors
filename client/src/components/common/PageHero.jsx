/* ═══════════════════════════════════════════════════════════════════════════
   PAGE HERO
   The dark banner every inner page opens with.

   Before this existed, each page hand-rolled its own header: About had a
   gradient it defined inline, Contact had a light grey band, Services had
   nothing at all. They used different type scales, different paddings and, in
   two cases, the old blue-600 accent — so moving between pages felt like
   moving between sites.

   One component, so a change to the page-opening rhythm happens once. It
   reuses the home page's own furniture (.gk-dark, .gk-bloom, .gk-mesh, the
   .gk-h1 scale) rather than reimplementing it, which is what keeps the inner
   pages and the landing page recognisably the same design.

   `image` is optional. When given it sits behind the copy, screen-blended and
   masked to the right, exactly as the artwork does on the home page — so a
   page with a picture and a page without still share a silhouette.
   ═══════════════════════════════════════════════════════════════════════════ */
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function PageHero({
  eyebrow,
  title,
  highlight,
  lede,
  image,
  children,        // CTAs or any extra controls
  crumb,           // e.g. { label: 'Services', to: '/services' }
  align = 'left',
}) {
  return (
    <section className="gk-dark gk-phero" data-align={align}>
      <style>{PAGE_HERO_STYLES}</style>

      {image && (
        <img className="gk-phero-bg" src={image} alt="" aria-hidden="true"
          decoding="async" />
      )}
      <div className="gk-bloom gk-bloom--a" />
      <div className="gk-bloom gk-bloom--b" />
      <div className="gk-mesh" />

      <div className="gk-wrap">
        <div className="gk-phero-inner">
          {/* A real breadcrumb trail, not decoration: on a deep page the back
              route is otherwise only reachable through the browser. */}
          {crumb && (
            <nav className="gk-phero-crumb" aria-label="Breadcrumb">
              <Link to="/">Home</Link>
              <ChevronRight size={13} aria-hidden="true" />
              {crumb.to
                ? <Link to={crumb.to}>{crumb.label}</Link>
                : <span aria-current="page">{crumb.label}</span>}
            </nav>
          )}

          {eyebrow && (
            <p className={`gk-eyebrow gk-eyebrow--dark${align === 'center' ? ' gk-eyebrow--center' : ''}`}>
              {eyebrow}
            </p>
          )}

          <h1 className="gk-h1 gk-phero-title">
            {title}
            {highlight && <><br /><span className="gk-grad gk-grad--dark">{highlight}</span></>}
          </h1>

          {lede && <p className="gk-lede gk-lede--dark gk-phero-lede">{lede}</p>}

          {children && <div className="gk-phero-actions">{children}</div>}
        </div>
      </div>
    </section>
  );
}

const PAGE_HERO_STYLES = `
  .gk-phero {
    padding-block: clamp(2.75rem, 6vw, 4.75rem) clamp(3rem, 6.5vw, 5rem);
    isolation: isolate;
  }
  .gk-phero-inner { position: relative; z-index: 2; max-width: 46rem; }
  .gk-phero[data-align="center"] .gk-phero-inner {
    max-width: 44rem; margin-inline: auto; text-align: center;
  }

  .gk-phero-bg {
    position: absolute; z-index: 0;
    top: 50%; right: -8%;
    transform: translateY(-50%);
    width: min(720px, 58%); height: auto;
    pointer-events: none;
    mix-blend-mode: screen;
    opacity: .45;
    -webkit-mask-image: radial-gradient(ellipse 70% 76% at 60% 50%, #000 16%, transparent 74%);
            mask-image: radial-gradient(ellipse 70% 76% at 60% 50%, #000 16%, transparent 74%);
  }
  /* Once the copy column spans the full width the artwork would sit directly
     under the lede. */
  @media (max-width: 1024px) { .gk-phero-bg { opacity: .2; } }
  @media (max-width: 700px)  { .gk-phero-bg { display: none; } }

  .gk-phero-crumb {
    display: flex; align-items: center; gap: 0.4rem;
    margin-bottom: 1.1rem;
    font-size: 0.78rem; font-weight: 600;
    color: var(--gk-meta-dark);
  }
  .gk-phero[data-align="center"] .gk-phero-crumb { justify-content: center; }
  .gk-phero-crumb a { color: var(--gk-body-dark); text-decoration: none; transition: color .25s; }
  .gk-phero-crumb a:hover { color: var(--gk-cyan-soft); }
  .gk-phero-crumb svg { opacity: .5; flex-shrink: 0; }

  /* The h1 is a touch smaller than the home page's — an inner page's title is
     a label for what follows, not the site's opening statement. */
  .gk-phero-title {
    color: #FFFFFF;
    font-size: clamp(2rem, 4.6vw, 3.3rem);
  }
  .gk-phero-lede { margin-top: 1.05rem; max-width: 34rem; }
  .gk-phero[data-align="center"] .gk-phero-lede { margin-inline: auto; }

  .gk-phero-actions { display: flex; flex-wrap: wrap; gap: 0.8rem; margin-top: 1.9rem; }
  .gk-phero[data-align="center"] .gk-phero-actions { justify-content: center; }
  @media (max-width: 460px) {
    .gk-phero-actions { flex-direction: column; align-items: stretch; }
    .gk-phero-actions .gk-btn { width: 100%; }
  }
`;
