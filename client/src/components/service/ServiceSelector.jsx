import { useMemo } from 'react';
import { Check, Plus, Info, AlertCircle } from 'lucide-react';
import { useServiceCart } from '../../context/CartContext';

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

      <div style={{ display: 'grid', gap: '0.7rem' }}>
        {sorted.map((pkg) => {
          const price = getServicePrice(pkg, selectedCar);
          const unavailable = price === null;
          const inCart = hasService(String(pkg._id));
          const tierLabel = TIER_LABEL[pkg.tier] || '';

          return (
            <div
              key={pkg._id}
              style={{
                background: unavailable ? '#F8FAFC' : '#FFF',
                border: `1.5px solid ${inCart ? '#1E3A8A' : '#E2E8F0'}`,
                borderRadius: '13px', padding: '0.95rem 1.1rem',
                display: 'flex', flexWrap: 'wrap', gap: '1rem',
                alignItems: 'center', justifyContent: 'space-between',
                opacity: unavailable ? 0.72 : 1,
                boxShadow: inCart ? '0 10px 24px rgba(30,58,138,0.12)' : '0 2px 10px rgba(15,23,42,0.03)',
                transition: 'all 0.25s',
              }}
            >
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                  <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: '1rem', color: '#0F172A' }}>
                    {pkg.label}
                  </h3>
                  {tierLabel && (
                    <span style={{
                      background: '#EBF0FF', color: '#1E3A8A', borderRadius: '999px',
                      padding: '0.1rem 0.5rem', fontSize: '0.6rem', fontWeight: 900,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>
                      {tierLabel}
                    </span>
                  )}
                </div>
                <p style={{ color: '#64748B', fontSize: '0.76rem', lineHeight: 1.5, fontWeight: 500 }}>
                  {pkg.desc}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  {unavailable ? (
                    <span style={{ color: '#94A3B8', fontSize: '0.85rem', fontWeight: 800 }}>
                      Price on request
                    </span>
                  ) : (
                    <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.2rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.01em' }}>
                      ₹{price.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleAdd(pkg)}
                  disabled={unavailable || inCart}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    background: inCart ? '#DCFCE7' : unavailable ? '#E2E8F0' : 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)',
                    color: inCart ? '#166534' : unavailable ? '#94A3B8' : '#FFF',
                    border: 'none', borderRadius: '9px', padding: '0.5rem 0.9rem',
                    fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: '0.74rem',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    cursor: unavailable || inCart ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap', transition: 'all 0.2s',
                  }}
                >
                  {inCart ? <><Check size={14} /> Added</> : unavailable ? 'Unavailable' : <><Plus size={14} /> Add</>}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
