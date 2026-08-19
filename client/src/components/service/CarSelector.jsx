import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, X, Loader, Car as CarIcon, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getServiceCars } from '../../api/serviceApi';
import { reportApiError } from '../../api/apiError';
import LoadingSpinner from '../common/LoadingSpinner';

const FUEL_TYPES = [
  { value: 'petrol', label: 'Petrol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'electric', label: 'Electric' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'cng', label: 'CNG' },
];
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
      <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 950, fontSize: '1.5rem', color: '#1E3A8A', letterSpacing: '0.05em' }}>
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

  const chooseCatalogueCar = (car) => {
    onSelect({
      carId: car._id,
      brand: car.brand,
      model: car.model,
      year: car.year,
      fuelType: car.fuelType,
      transmission: car.transmission,
      image: car.image || null,
      isManualEntry: false,
      servicePrices: car.servicePrices || [],
    });
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
    onSelect({
      carId: 'manual',
      brand: form.brand.trim(),
      model: form.model.trim(),
      year: Number(form.year),
      fuelType: form.fuelType,
      transmission: form.transmission,
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

  if (loading) return <LoadingSpinner size="lg" text="Loading cars..." />;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.4rem', fontWeight: 900, color: '#0F172A', marginBottom: '0.25rem' }}>
          Select Your Car
        </h2>
        <p style={{ color: '#64748B', fontSize: '0.8rem', fontWeight: 500 }}>
          Pricing depends on your car, so pick it first.
        </p>
      </div>

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
      {cars.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '0.65rem 1rem', marginBottom: '1.25rem' }}>
          <Search size={16} style={{ color: '#1E3A8A', flexShrink: 0 }} />
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
      {cars.length === 0 && !loadError && (
        <div style={{ background: '#F8FAFC', border: '1.5px dashed #CBD5E1', borderRadius: '16px', padding: '2rem', textAlign: 'center', marginBottom: '1.25rem' }}>
          <CarIcon size={32} style={{ color: '#94A3B8', marginBottom: '0.75rem' }} />
          <p style={{ color: '#475569', fontWeight: 700, marginBottom: '0.3rem' }}>No cars in our catalogue yet</p>
          <p style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 500 }}>
            Enter your car details below and we'll price your service from our standard rates.
          </p>
        </div>
      )}

      {/* Car grid */}
      {filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {filtered.map((car) => {
            const isSelected = selectedCar && !selectedCar.isManualEntry && String(selectedCar.carId) === String(car._id);
            return (
              <button
                key={car._id}
                onClick={() => chooseCatalogueCar(car)}
                style={{
                  background: '#FFF', textAlign: 'left', cursor: 'pointer', padding: 0,
                  border: `2px solid ${isSelected ? '#1E3A8A' : '#E2E8F0'}`,
                  borderRadius: '14px', overflow: 'hidden',
                  boxShadow: isSelected ? '0 12px 28px rgba(30,58,138,0.16)' : '0 2px 10px rgba(15,23,42,0.03)',
                  transition: 'all 0.25s', position: 'relative',
                }}
                onMouseEnter={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.transform = 'translateY(-4px)'; } }}
                onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.transform = 'translateY(0)'; } }}
              >
                {isSelected && (
                  <div style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', background: '#1E3A8A', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                    <Check size={14} style={{ color: '#FFF' }} />
                  </div>
                )}
                <div style={{ height: '80px', background: '#F1F5F9' }}>
                  <CarThumb car={car} />
                </div>
                <div style={{ padding: '0.6rem 0.7rem' }}>
                  <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: '0.88rem', color: '#0F172A', lineHeight: 1.2 }}>
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
      {cars.length > 0 && filtered.length === 0 && (
        <div style={{ background: '#F8FAFC', border: '1.5px dashed #CBD5E1', borderRadius: '16px', padding: '1.75rem', textAlign: 'center', marginBottom: '1.5rem' }}>
          <p style={{ color: '#475569', fontWeight: 700 }}>No cars match "{search}"</p>
          <p style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 500, marginTop: '0.3rem' }}>
            Try a different spelling, or enter your car manually below.
          </p>
        </div>
      )}

      {/* Manual entry */}
      {!manualOpen ? (
        <button
          onClick={() => setManualOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            width: '100%', background: '#FFF', border: '1.5px dashed #1E3A8A',
            color: '#1E3A8A', borderRadius: '11px', padding: '0.75rem',
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
            <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: '1.02rem', color: '#0F172A' }}>
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
            background: 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)',
            color: '#FFF', border: 'none', borderRadius: '10px', padding: '0.7rem',
            fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: '0.85rem',
            letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
          }}>
            Use This Car
          </button>
        </form>
      )}
    </div>
  );
}
