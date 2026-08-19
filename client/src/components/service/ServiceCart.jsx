import { Trash2, ShoppingCart, Car as CarIcon, Pencil } from 'lucide-react';
import { useServiceCart } from '../../context/CartContext';

export default function ServiceCart({ onCheckout, onChangeCar, checkoutDisabled }) {
  const { car, services, totalAmount, removeService } = useServiceCart();

  if (!car) return null;

  const empty = services.length === 0;

  return (
    <aside
      style={{
        background: '#FFF', border: '1.5px solid #E2E8F0', borderRadius: '14px',
        padding: '1rem', position: 'sticky', top: '5rem',
        boxShadow: '0 8px 28px rgba(15, 23, 42, 0.05)', alignSelf: 'flex-start',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <ShoppingCart size={17} style={{ color: '#1E3A8A' }} />
        <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: '1rem', color: '#0F172A', letterSpacing: '0.02em' }}>
          Your Booking
        </h3>
      </div>

      {/* Selected car */}
      <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '0.85rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#EBF0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            {car.image
              ? <img src={car.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <CarIcon size={18} style={{ color: '#1E3A8A' }} />}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {car.brand} {car.model}
            </div>
            <div style={{ color: '#64748B', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {car.year} · {car.fuelType}{car.isManualEntry ? ' · manual entry' : ''}
            </div>
          </div>
          <button
            onClick={onChangeCar}
            title="Change car"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E3A8A', display: 'flex', padding: '0.25rem' }}
          >
            <Pencil size={14} />
          </button>
        </div>
      </div>

      {/* Services */}
      {empty ? (
        <div style={{ background: '#F8FAFC', border: '1.5px dashed #CBD5E1', borderRadius: '12px', padding: '1.5rem 1rem', textAlign: 'center', marginBottom: '1rem' }}>
          <p style={{ color: '#64748B', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.5 }}>
            No services added yet. Pick a category to see packages and pricing.
          </p>
        </div>
      ) : (
        <div style={{ marginBottom: '1rem' }}>
          {services.map((s) => (
            <div key={s.serviceId} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.7rem 0', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.78rem', color: '#0F172A', lineHeight: 1.3 }}>{s.name}</div>
                <div style={{ color: '#94A3B8', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.15rem' }}>
                  {s.category}
                </div>
              </div>
              <div style={{ fontWeight: 900, fontSize: '0.8rem', color: '#0F172A', whiteSpace: 'nowrap', fontFamily: 'Rajdhani, sans-serif' }}>
                ₹{Number(s.price).toLocaleString('en-IN')}
              </div>
              <button
                onClick={() => removeService(s.serviceId)}
                title={`Remove ${s.name}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', display: 'flex', padding: '0.15rem', flexShrink: 0 }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: '0.85rem', borderTop: '2px solid #0F172A', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
          Total
        </span>
        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
          ₹{Number(totalAmount).toLocaleString('en-IN')}
        </span>
      </div>

      <button
        onClick={onCheckout}
        disabled={empty || checkoutDisabled}
        style={{
          width: '100%',
          background: empty || checkoutDisabled ? '#E2E8F0' : 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)',
          color: empty || checkoutDisabled ? '#94A3B8' : '#FFF',
          border: 'none', borderRadius: '10px', padding: '0.72rem',
          fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: '0.82rem',
          letterSpacing: '0.09em', textTransform: 'uppercase',
          cursor: empty || checkoutDisabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
        }}
      >
        Proceed to Checkout
      </button>

      <p style={{ color: '#94A3B8', fontSize: '0.7rem', fontWeight: 600, textAlign: 'center', marginTop: '0.7rem', lineHeight: 1.5 }}>
        Final price confirmed after inspection. Free pickup and drop included.
      </p>
    </aside>
  );
}
