import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, X, Loader, Car as CarIcon, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getServiceCars } from '../../api/serviceApi';
import { reportApiError } from '../../api/apiError';

/**
 * The fuel types a customer can choose. Petrol, Diesel and CNG, as specified.
 *
 * The database enum is deliberately NOT narrowed to match. It still permits
 * 'electric' and 'hybrid', and Mongoose validates on every save() — so
 * removing them would make any pre-existing car or booking carrying one throw
 * a ValidationError the next time an admin touched an unrelated field. The
 * choice is narrowed here, in the UI, where it is safe.
 */
const FUEL_TYPES = [
  { value: 'petrol', label: 'Petrol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'cng', label: 'CNG' },
];

/** Values that exist in older records but are no longer offered. */
const LEGACY_FUEL_LABELS = { electric: 'Electric', hybrid: 'Hybrid' };

const FUEL_VALUES = FUEL_TYPES.map((f) => f.value);

/**
 * Coerce whatever a record carries into something safe to display and submit.
 *
 * Old catalogue rows can be missing `fuelType` entirely, carry a legacy value,
 * or carry stray casing/whitespace. Returns the value unchanged when it is one
 * we still offer, keeps a recognised legacy value as-is (so selecting a car
 * never silently rewrites its fuel), and otherwise falls back to petrol —
 * which is also the schema default, so nothing is invented.
 */
const normaliseFuel = (value) => {
  const v = String(value ?? '').trim().toLowerCase();
  if (FUEL_VALUES.includes(v)) return v;
  if (LEGACY_FUEL_LABELS[v]) return v;
  return 'petrol';
};

/**
 * The options to show for a given car: the three standard ones, plus the car's
 * own legacy value if it has one, so an existing electric/hybrid record stays
 * selectable and is never quietly converted to petrol.
 */
const fuelOptionsFor = (value) => {
  const v = normaliseFuel(value);
  return LEGACY_FUEL_LABELS[v]
    ? [...FUEL_TYPES, { value: v, label: LEGACY_FUEL_LABELS[v], legacy: true }]
    : FUEL_TYPES;
};

const TRANSMISSIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'automatic', label: 'Automatic' },
];

const MIN_YEAR = 1990;
const MAX_YEAR = new Date().getFullYear() + 1;

const initials = (brand = '', model = '') =>
  `${(brand[0] || '').toUpperCase()}${(model[0] || '').toUpperCase()}` || '?';

/** Placeholder shown when a car has no image, or its image fails to load. */
const CarThumb = ({ car }) => {
  const [broken, setBroken] = useState(false);
  if (car.image && !broken) {
    return (
      <img
        src={car.image}
        alt={`${car.brand} ${car.model}`}
        onError={() => setBroken(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  }
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '0.25rem',
      background: 'linear-gradient(135deg, #EBF0FF 0%, #F8FAFC 100%)',
    }}>
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 950, fontSize: '1.5rem', color: '#1567D3', letterSpacing: '0.05em' }}>
        {initials(car.brand, car.model)}
      </span>
      <CarIcon size={16} style={{ color: '#94A3B8' }} />
    </div>
  );
};

export default function CarSelector({ onSelect, selectedCar }) {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [form, setForm] = useState({
    brand: '', model: '', year: '', fuelType: 'petrol', transmission: 'manual',
  });
  const [errors, setErrors] = useState({});

  /* The car the customer has picked but not yet confirmed, and the fuel they
     have chosen for it. Holding it here is what turns "select car" into the
     two explicit steps the flow calls for — pick the vehicle, then state its
     fuel — without a second route or a second component. */
  const [pendingCar, setPendingCar] = useState(null);
  const [pendingFuel, setPendingFuel] = useState('petrol');

  const fetchCars = () => {
    setLoading(true);
    setLoadError('');
    getServiceCars()
      .then(({ data }) => setCars(data.cars || []))
      .catch((err) => setLoadError(reportApiError('CarSelector.getServiceCars', err, 'Could not load cars')))
      .finally(() => setLoading(false));
  };

  useEffect(fetchCars, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cars;
    return cars.filter((c) =>
      `${c.brand} ${c.model} ${c.year}`.toLowerCase().includes(q)
    );
  }, [cars, search]);

  /* Picking a car no longer commits it. It stages the choice and moves to the
     fuel step, so a catalogue vehicle's fuel is something the customer states
     rather than something inherited silently from the admin's record. */
  const chooseCatalogueCar = (car) => {
    setPendingCar({
      carId: car._id,
      brand: car.brand,
      model: car.model,
      year: car.year,
      fuelType: normaliseFuel(car.fuelType),
      transmission: car.transmission || 'manual',
      image: car.image || null,
      isManualEntry: false,
      servicePrices: car.servicePrices || [],
    });
    setPendingFuel(normaliseFuel(car.fuelType));
  };

  /** Commit the staged car with the fuel the customer chose. */
  const confirmPendingCar = () => {
    if (!pendingCar) return;
    onSelect({ ...pendingCar, fuelType: normaliseFuel(pendingFuel) });
    setPendingCar(null);
  };

  const validateManual = () => {
    const next = {};
    const brand = form.brand.trim();
    const model = form.model.trim();
    const year = Number(form.year);

    if (brand.length < 2) next.brand = 'Brand must be at least 2 characters';
    else if (brand.length > 50) next.brand = 'Brand cannot exceed 50 characters';

    if (model.length < 2) next.model = 'Model must be at least 2 characters';
    else if (model.length > 50) next.model = 'Model cannot exceed 50 characters';

    if (!form.year) next.year = 'Year is required';
    else if (Number.isNaN(year) || year < MIN_YEAR || year > MAX_YEAR) {
      next.year = `Year must be between ${MIN_YEAR} and ${MAX_YEAR}`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitManual = (e) => {
    e.preventDefault();
    if (!validateManual()) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    // Normalised on the way out, so a manually entered car and a catalogue car
    // reach the backend in exactly the same shape.
    onSelect({
      carId: 'manual',
      brand: form.brand.trim(),
      model: form.model.trim(),
      year: Number(form.year),
      fuelType: normaliseFuel(form.fuelType),
      transmission: form.transmission || 'manual',
      image: null,
      isManualEntry: true,
      servicePrices: [],
    });
    setManualOpen(false);
  };

  const inputStyle = (hasError) => ({
    width: '100%', padding: '0.55rem 0.75rem', borderRadius: '9px',
    border: `1.5px solid ${hasError ? '#EF4444' : '#E2E8F0'}`,
    fontSize: '0.82rem', fontWeight: 600, color: '#0F172A',
    outline: 'none', background: '#FFF',
  });
  const labelStyle = {
    display: 'block', fontSize: '0.68rem', fontWeight: 800, color: '#64748B',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem',
  };
  const errorStyle = { color: '#EF4444', fontSize: '0.75rem', fontWeight: 700, marginTop: '0.3rem' };

  /* ── Fuel step ────────────────────────────────────────────────────────
     Shown once a vehicle is picked. Kept inside this component so the
     surrounding container never unmounts — see the note on the loading state
     below for why that matters. */
  if (pendingCar) {
    const options = fuelOptionsFor(pendingCar.fuelType);
    return (
      <div className="gk-car-step">
        <style>{CAR_SELECTOR_STYLES}</style>
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 className="gk-car-title">Fuel type</h2>
          <p className="gk-car-sub">
            {pendingCar.brand} {pendingCar.model} · {pendingCar.year}
          </p>
        </div>

        <fieldset className="gk-fuel-set">
          <legend className="gk-fuel-legend">Which fuel does your car run on?</legend>
          <div className="gk-fuel-row" role="radiogroup" aria-label="Fuel type">
            {options.map((f) => {
              const active = normaliseFuel(pendingFuel) === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPendingFuel(f.value)}
                  className={`gk-fuel-chip${active ? ' is-on' : ''}`}
                >
                  {f.label}
                  {f.legacy && <span className="gk-fuel-legacy"> (on record)</span>}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="gk-car-actions">
          <button type="button" onClick={() => setPendingCar(null)} className="gk-car-back">
            Back
          </button>
          <button type="button" onClick={confirmPendingCar} className="gk-car-next">
            <Check size={15} /> Confirm car
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gk-car-step">
      <style>{CAR_SELECTOR_STYLES}</style>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 className="gk-car-title">Select Your Car</h2>
        <p className="gk-car-sub">
          Pricing depends on your car, so pick it first.
        </p>
      </div>

      {/* ── Loading ───────────────────────────────────────────────────────
          Skeleton tiles at the real card's dimensions, NOT a bare spinner.
          Returning a small spinner from the top of this component was the
          cause of the reported scroll jump: choosing "change car" swapped a
          full-height region for a ~100px one, the document shrank, the browser
          clamped scrollTop to the new scrollHeight, and the page appeared to
          jump to the top — then jumped again when the grid arrived. Holding
          the height means there is no collapse to recover from. */}
      {loading && (
        <div className="gk-car-grid" aria-busy="true" aria-live="polite">
          <span className="gk-sr">Loading cars…</span>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="gk-car-skel" />
          ))}
        </div>
      )}

      {loadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '12px', padding: '0.9rem 1.1rem', marginBottom: '1.25rem' }}>
          <AlertCircle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
          <span style={{ color: '#991B1B', fontSize: '0.85rem', fontWeight: 600, flex: 1 }}>{loadError}</span>
          <button onClick={fetchCars} style={{ background: '#EF4444', color: '#FFF', border: 'none', borderRadius: '8px', padding: '0.4rem 0.9rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {/* Search */}
      {!loading && cars.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '0.65rem 1rem', marginBottom: '1.25rem' }}>
          <Search size={16} style={{ color: '#1567D3', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by brand or model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ background: 'none', border: 'none', outline: 'none', flex: 1, fontSize: '0.9rem', fontWeight: 600, color: '#0F172A' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}>
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* No cars at all */}
      {!loading && cars.length === 0 && !loadError && (
        <div style={{ background: '#F8FAFC', border: '1.5px dashed #CBD5E1', borderRadius: '16px', padding: '2rem', textAlign: 'center', marginBottom: '1.25rem' }}>
          <CarIcon size={32} style={{ color: '#94A3B8', marginBottom: '0.75rem' }} />
          <p style={{ color: '#475569', fontWeight: 700, marginBottom: '0.3rem' }}>No cars in our catalogue yet</p>
          <p style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 500 }}>
            Enter your car details below and we'll price your service from our standard rates.
          </p>
        </div>
      )}

      {/* Car grid */}
      {!loading && filtered.length > 0 && (
        <div className="gk-car-grid">
          {filtered.map((car) => {
            const isSelected = selectedCar && !selectedCar.isManualEntry && String(selectedCar.carId) === String(car._id);
            return (
              <button
                key={car._id}
                onClick={() => chooseCatalogueCar(car)}
                style={{
                  background: '#FFF', textAlign: 'left', cursor: 'pointer', padding: 0,
                  border: `2px solid ${isSelected ? '#1567D3' : '#E2E8F0'}`,
                  borderRadius: '14px', overflow: 'hidden',
                  boxShadow: isSelected ? '0 12px 28px rgba(21,103,211,0.16)' : '0 2px 10px rgba(15,23,42,0.03)',
                  transition: 'all 0.25s', position: 'relative',
                }}
                onMouseEnter={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = '#6FD8FF'; e.currentTarget.style.transform = 'translateY(-4px)'; } }}
                onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.transform = 'translateY(0)'; } }}
              >
                {isSelected && (
                  <div style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', background: '#1567D3', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                    <Check size={14} style={{ color: '#FFF' }} />
                  </div>
                )}
                <div style={{ height: '80px', background: '#F1F5F9' }}>
                  <CarThumb car={car} />
                </div>
                <div style={{ padding: '0.6rem 0.7rem' }}>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: '0.88rem', color: '#0F172A', lineHeight: 1.2 }}>
                    {car.brand}
                  </div>
                  <div style={{ color: '#475569', fontSize: '0.74rem', fontWeight: 600 }}>{car.model}</div>
                  <div style={{ color: '#94A3B8', fontSize: '0.64rem', fontWeight: 700, marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {car.year} · {car.fuelType}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Search returned nothing */}
      {!loading && cars.length > 0 && filtered.length === 0 && (
        <div style={{ background: '#F8FAFC', border: '1.5px dashed #CBD5E1', borderRadius: '16px', padding: '1.75rem', textAlign: 'center', marginBottom: '1.5rem' }}>
          <p style={{ color: '#475569', fontWeight: 700 }}>No cars match "{search}"</p>
          <p style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 500, marginTop: '0.3rem' }}>
            Try a different spelling, or enter your car manually below.
          </p>
        </div>
      )}

      {/* Manual entry */}
      {loading ? null : !manualOpen ? (
        <button
          onClick={() => setManualOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            width: '100%', background: '#FFF', border: '1.5px dashed #1567D3',
            color: '#1567D3', borderRadius: '11px', padding: '0.75rem',
            fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#EBF0FF'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#FFF'; }}
        >
          <Plus size={16} /> My car is not listed — enter details manually
        </button>
      ) : (
        <form onSubmit={submitManual} style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '14px', padding: '1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: '1.02rem', color: '#0F172A' }}>
              Enter Your Car Details
            </h3>
            <button type="button" onClick={() => { setManualOpen(false); setErrors({}); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Brand *</label>
              <input type="text" value={form.brand} maxLength={50}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="e.g. Maruti Suzuki" style={inputStyle(errors.brand)} />
              {errors.brand && <p style={errorStyle}>{errors.brand}</p>}
            </div>
            <div>
              <label style={labelStyle}>Model *</label>
              <input type="text" value={form.model} maxLength={50}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="e.g. Swift" style={inputStyle(errors.model)} />
              {errors.model && <p style={errorStyle}>{errors.model}</p>}
            </div>
            <div>
              <label style={labelStyle}>Year *</label>
              <input type="number" value={form.year} min={MIN_YEAR} max={MAX_YEAR}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                placeholder={String(MAX_YEAR - 3)} style={inputStyle(errors.year)} />
              {errors.year && <p style={errorStyle}>{errors.year}</p>}
            </div>
            <div>
              <label style={labelStyle}>Fuel Type</label>
              <select value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })} style={inputStyle(false)}>
                {FUEL_TYPES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Transmission</label>
              <select value={form.transmission} onChange={(e) => setForm({ ...form, transmission: e.target.value })} style={inputStyle(false)}>
                {TRANSMISSIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <p style={{ color: '#64748B', fontSize: '0.78rem', fontWeight: 500, marginTop: '1rem', lineHeight: 1.5 }}>
            Manually-entered cars are priced at our standard rates. Our team will confirm the
            final quote after inspection.
          </p>

          <button type="submit" style={{
            marginTop: '1.25rem', width: '100%',
            background: 'linear-gradient(135deg, #1567D3 0%, #00B2F0 100%)',
            color: '#FFF', border: 'none', borderRadius: '10px', padding: '0.7rem',
            fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: '0.85rem',
            letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
          }}>
            Use This Car
          </button>
        </form>
      )}
    </div>
  );
}

/* Scoped styles for the car step. Static rules only — no animation, no blur,
   no shadow larger than the cards already carried. */
const CAR_SELECTOR_STYLES = `
  .gk-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }

  .gk-car-title { font-family: 'Space Grotesk', sans-serif; font-size: 1.4rem; font-weight: 900; color: #0F172A; margin: 0 0 0.25rem; }
  .gk-car-sub   { color: #64748B; font-size: 0.8rem; font-weight: 500; margin: 0; }
  @media (max-width: 400px) { .gk-car-title { font-size: 1.2rem; } }

  /* Two columns at 320px, growing with the viewport. auto-fill with a 140px
     minimum used to leave a single stretched card on the narrowest phones. */
  .gk-car-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem;
    margin-bottom: 1.25rem;
  }
  @media (min-width: 420px) { .gk-car-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; } }
  @media (min-width: 768px) { .gk-car-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  @media (min-width: 1200px){ .gk-car-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }

  /* Same footprint as a real card, so the region does not resize when the
     data lands. 80px thumb + ~62px of text block. */
  .gk-car-skel {
    min-height: 142px;
    border-radius: 14px;
    border: 2px solid #E2E8F0;
    background: #F1F5F9;
  }

  /* ── Fuel step ── */
  .gk-fuel-set { border: 0; padding: 0; margin: 0 0 1.5rem; min-width: 0; }
  .gk-fuel-legend {
    padding: 0; margin-bottom: 0.6rem;
    font-size: 0.68rem; font-weight: 800; color: #64748B;
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .gk-fuel-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .gk-fuel-chip {
    flex: 1 1 auto; min-width: 96px; min-height: 46px;
    padding: 0.7rem 1rem; border-radius: 11px;
    border: 1.5px solid #E2E8F0; background: #FFF;
    color: #0F172A; font-weight: 800; font-size: 0.86rem;
    cursor: pointer; font-family: inherit;
  }
  .gk-fuel-chip.is-on { border-color: #1567D3; background: #EFF6FF; color: #1567D3; }
  .gk-fuel-chip:focus-visible { outline: 2px solid #1567D3; outline-offset: 2px; }
  .gk-fuel-legacy { font-weight: 600; font-size: 0.72rem; color: #64748B; }

  .gk-car-actions { display: flex; gap: 0.6rem; }
  .gk-car-back {
    background: #F1F5F9; color: #475569; border: none; border-radius: 10px;
    padding: 0.8rem 1.2rem; min-height: 46px; font-weight: 800; font-size: 0.85rem;
    cursor: pointer; font-family: inherit;
  }
  .gk-car-next {
    flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;
    background: linear-gradient(135deg, #1567D3 0%, #00B2F0 100%); color: #FFF;
    border: none; border-radius: 10px; padding: 0.8rem; min-height: 46px;
    font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: 0.88rem;
    letter-spacing: 0.07em; text-transform: uppercase; cursor: pointer;
  }
  .gk-car-back:focus-visible, .gk-car-next:focus-visible { outline: 2px solid #1567D3; outline-offset: 2px; }
`;
