import { useMemo } from 'react';
import { Info, AlertCircle } from 'lucide-react';
import { useServiceCart } from '../../context/CartContext';
import ServicePackageCard from './ServicePackageCard';

const TIER_LABEL = {
  basic: 'Basic',
  standard: 'Standard',
  comprehensive: 'Comprehensive',
  single: '',
};

const TIER_ORDER = { basic: 0, standard: 1, comprehensive: 2, single: 3 };

/**
 * Resolve what this customer pays for a package.
 *
 * Order of precedence: the admin's per-car override, then the package's
 * basePrice. Manually-entered cars always fall through to basePrice because
 * we have no per-model row for them.
 *
 * Returns null when no price is configured — the caller renders
 * "Price on request" rather than a misleading ₹0.
 */
export function getServicePrice(pkg, selectedCar) {
  const base = Number(pkg.basePrice);
  const fallback = Number.isFinite(base) && base > 0 ? base : null;

  if (!selectedCar || selectedCar.isManualEntry) return fallback;

  const overrides = Array.isArray(selectedCar.servicePrices) ? selectedCar.servicePrices : [];
  const match = overrides.find((sp) => {
    // servicePrices.serviceType is populated server-side, but tolerate a raw id.
    const id = sp?.serviceType?._id ?? sp?.serviceType;
    return String(id) === String(pkg._id);
  });

  if (match && Number.isFinite(Number(match.price)) && Number(match.price) > 0) {
    return Number(match.price);
  }
  return fallback;
}

const CARD_STYLES = `
  .gk-pkg {
    position: relative; background: #FFFFFF;
    border: 1.5px solid #E2E8F0; border-radius: 16px;
    box-shadow: 0 2px 10px rgba(15,23,42,0.03);
    transition: border-color .22s, box-shadow .22s, transform .22s;
    overflow: hidden;
  }
  .gk-pkg:hover { transform: translateY(-3px); box-shadow: 0 16px 34px rgba(15,23,42,0.09); }
  .gk-pkg--in { border-color: #1E3A8A; box-shadow: 0 10px 24px rgba(30,58,138,0.12); }
  .gk-pkg--off { background: #F8FAFC; opacity: .72; }
  .gk-pkg--off:hover { transform: none; box-shadow: 0 2px 10px rgba(15,23,42,0.03); }

  .gk-pkg-flag {
    position: absolute; top: 0; left: 0; z-index: 1;
    background: #16A34A; color: #FFF;
    font-size: .58rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase;
    padding: .3rem .65rem; border-radius: 16px 0 12px 0;
  }

  .gk-pkg-body { display: flex; gap: 1.15rem; padding: 1.15rem 1.25rem 0; }

  .gk-pkg-media {
    flex: 0 0 200px; width: 200px; height: 148px;
    border-radius: 12px; overflow: hidden; background: #EEF3FB;
    display: flex; align-items: center; justify-content: center;
  }
  .gk-pkg-media img {
    width: 100%; height: 100%; object-fit: cover; display: block;
    transition: transform .35s ease;
  }
  .gk-pkg:hover .gk-pkg-media img { transform: scale(1.04); }
  .gk-pkg-media-empty { color: #94A3B8; }

  .gk-pkg-main { flex: 1 1 auto; min-width: 0; }
  .gk-pkg-head { display: flex; align-items: center; gap: .55rem; flex-wrap: wrap; margin-bottom: .3rem; }
  .gk-pkg-title {
    font-family: Rajdhani, sans-serif; font-weight: 900; font-size: 1.15rem;
    color: #0F172A; margin: 0; line-height: 1.2;
  }
  .gk-pkg-tier {
    background: #EBF0FF; color: #1E3A8A; border-radius: 999px;
    padding: .12rem .55rem; font-size: .58rem; font-weight: 900;
    text-transform: uppercase; letter-spacing: .08em;
  }
  .gk-pkg-desc { color: #64748B; font-size: .79rem; line-height: 1.55; font-weight: 500; margin: 0 0 .7rem; }

  .gk-pkg-meta { list-style: none; display: flex; flex-wrap: wrap; gap: .35rem .95rem; margin: 0 0 .8rem; padding: 0; }
  .gk-pkg-meta li {
    display: inline-flex; align-items: center; gap: .3rem;
    color: #475569; font-size: .72rem; font-weight: 600;
  }
  .gk-pkg-meta svg { color: #1E3A8A; flex: none; }

  .gk-pkg-feats {
    list-style: none; margin: 0; padding: 0;
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .35rem .9rem;
  }
  .gk-pkg-feats li {
    display: flex; align-items: flex-start; gap: .4rem;
    color: #334155; font-size: .76rem; font-weight: 600; line-height: 1.45;
  }
  .gk-pkg-feats svg { color: #16A34A; flex: none; margin-top: 2px; }

  .gk-pkg-more {
    display: inline-flex; align-items: center; gap: .25rem;
    background: none; border: none; padding: .5rem 0 0; margin: 0;
    color: #1E3A8A; font-size: .74rem; font-weight: 800; cursor: pointer;
    text-decoration: underline; text-underline-offset: 3px;
  }
  .gk-pkg-more:hover { color: #2563EB; }
  .gk-pkg-more:focus-visible, .gk-pkg-cta:focus-visible {
    outline: 2px solid #2563EB; outline-offset: 2px; border-radius: 6px;
  }

  .gk-pkg-foot {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: .8rem;
    margin-top: 1.1rem; padding: .9rem 1.25rem 1.1rem;
    border-top: 1px solid #F1F5F9;
  }
  .gk-pkg-price { display: flex; align-items: baseline; gap: .5rem; flex-wrap: wrap; }
  .gk-pkg-was { color: #94A3B8; font-size: .82rem; font-weight: 600; text-decoration: line-through; }
  .gk-pkg-now {
    font-family: Rajdhani, sans-serif; font-size: 1.5rem; font-weight: 900;
    color: #0F172A; letter-spacing: -.01em; line-height: 1;
  }
  .gk-pkg-save {
    background: #DCFCE7; color: #166534; border-radius: 999px;
    padding: .15rem .5rem; font-size: .64rem; font-weight: 900;
    text-transform: uppercase; letter-spacing: .05em;
  }
  .gk-pkg-onreq { color: #94A3B8; font-size: .9rem; font-weight: 800; }

  .gk-pkg-cta {
    display: inline-flex; align-items: center; gap: .4rem;
    background: linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%); color: #FFF;
    border: none; border-radius: 10px; padding: .7rem 1.3rem;
    font-family: Rajdhani, sans-serif; font-weight: 900; font-size: .8rem;
    letter-spacing: .07em; text-transform: uppercase; cursor: pointer;
    white-space: nowrap; transition: transform .18s, box-shadow .18s, filter .18s;
    min-height: 44px;
  }
  .gk-pkg-cta:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(30,58,138,.28); }
  .gk-pkg--in .gk-pkg-cta { background: #DCFCE7; color: #166534; }
  .gk-pkg-cta:disabled { cursor: not-allowed; }
  .gk-pkg--off .gk-pkg-cta { background: #E2E8F0; color: #94A3B8; }

  /* Tablet: the image gives ground first, then the feature list goes single
     column so long feature names stop wrapping awkwardly. */
  @media (max-width: 900px) {
    .gk-pkg-media { flex-basis: 150px; width: 150px; height: 118px; }
    .gk-pkg-title { font-size: 1.05rem; }
  }
  @media (max-width: 720px) {
    .gk-pkg-feats { grid-template-columns: 1fr; }
  }
  /* Phone: stack, and let the image run the full width of the card. */
  @media (max-width: 560px) {
    .gk-pkg-body { flex-direction: column; gap: .9rem; padding: 1rem 1rem 0; }
    .gk-pkg-media { flex-basis: auto; width: 100%; height: 168px; }
    .gk-pkg-foot { padding: .9rem 1rem 1rem; }
    .gk-pkg-cta { width: 100%; justify-content: center; }
    .gk-pkg-price { width: 100%; }
  }

  @media (prefers-reduced-motion: reduce) {
    .gk-pkg, .gk-pkg-media img, .gk-pkg-cta { transition: none !important; }
    .gk-pkg:hover { transform: none; }
    .gk-pkg:hover .gk-pkg-media img { transform: none; }
  }
`;

export default function ServiceSelector({ category, packages = [], selectedCar }) {
  const { addService, hasService, services } = useServiceCart();

  const sorted = useMemo(
    () => [...packages].sort((a, b) => {
      const t = (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9);
      return t !== 0 ? t : (a.order || 0) - (b.order || 0);
    }),
    [packages]
  );

  // What is already chosen in this category, so we can label the swap.
  const currentInCategory = services.find(
    (s) => String(s.categoryId) === String(category.id) && s.tier !== 'single'
  );

  const handleAdd = (pkg) => {
    const price = getServicePrice(pkg, selectedCar);
    if (price === null) return;
    addService({
      serviceId: String(pkg._id),
      serviceType: String(pkg._id),
      name: pkg.label,
      price,
      category: category.name,
      categoryId: String(category.id),
      tier: pkg.tier || 'single',
      description: pkg.desc || '',
    });
  };

  if (!packages.length) {
    return (
      <div style={{ background: '#F8FAFC', border: '1.5px dashed #CBD5E1', borderRadius: '16px', padding: '2.5rem 2rem', textAlign: 'center' }}>
        <AlertCircle size={30} style={{ color: '#94A3B8', marginBottom: '0.75rem' }} />
        <p style={{ color: '#475569', fontWeight: 800, marginBottom: '0.3rem' }}>
          No services available in this category
        </p>
        <p style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 500 }}>
          We're adding packages here soon. Try another category, or call us on
          {' '}<a href="tel:+919253625099" style={{ color: '#1E3A8A', fontWeight: 700 }}>+91 92536 25099</a>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <style>{CARD_STYLES}</style>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.4rem', fontWeight: 900, color: '#0F172A', marginBottom: '0.25rem' }}>
          {category.name}
        </h2>
        <p style={{ color: '#64748B', fontSize: '0.8rem', fontWeight: 500 }}>
          Prices shown for your {selectedCar?.brand} {selectedCar?.model} ({selectedCar?.year}).
        </p>
      </div>

      {currentInCategory && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: '12px', padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
          <Info size={16} style={{ color: '#1E3A8A', flexShrink: 0 }} />
          <span style={{ color: '#1E40AF', fontSize: '0.82rem', fontWeight: 600 }}>
            <strong>{currentInCategory.name}</strong> is in your cart. Picking another
            package here will replace it.
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.9rem' }}>
        {sorted.map((pkg) => (
          <ServicePackageCard
            key={pkg._id}
            pkg={pkg}
            price={getServicePrice(pkg, selectedCar)}
            inCart={hasService(String(pkg._id))}
            onAdd={handleAdd}
          />
        ))}
      </div>
    </div>
  );
}
