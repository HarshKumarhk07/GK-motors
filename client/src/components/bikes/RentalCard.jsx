import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Settings, MapPin, ArrowRight } from 'lucide-react';

export default function RentalCard({ car, onClick }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const handleClick = onClick || (() => navigate(`/rentals/${car._id}`));

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        borderRadius: '20px',
        overflow: 'hidden',
        background: '#FFF',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        boxShadow: hovered ? '0 30px 60px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(30, 58, 138, 0.1)' : '0 10px 30px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-12px)' : 'translateY(0)',
        transition: 'all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
        height: '100%',
      }}
    >
      {/* Image Section */}
      <div style={{ position: 'relative', height: '180px', background: '#F5F5F5', overflow: 'hidden' }}>
        {car.images?.[0] ? (
          <img
            src={car.images[0]}
            alt={car.title}
            style={{
              width: '100%', height: '100%', objectFit: 'contain', padding: '1.2rem',
              transform: hovered ? 'scale(1.1) translateY(-8px)' : 'scale(1)',
              transition: 'transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CBD5E1' }}>
            <Calendar size={40} />
          </div>
        )}

        {car.status === 'rented' && (
          <div style={{ position: 'absolute', top: 12, right: 12, background: '#EF4444', color: 'white', padding: '4px 14px', borderRadius: '30px', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase' }}>BOOKED</div>
        )}
        {car.isFeatured && car.status === 'available' && (
          <div style={{ position: 'absolute', top: 12, left: 12, background: '#F59E0B', color: 'white', padding: '4px 14px', borderRadius: '30px', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase' }}>FEATURED</div>
        )}
      </div>

      {/* Content Section */}
      <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderTop: '1px solid #EEE' }}>
        <div style={{ marginBottom: '0.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <span style={{ color: '#1E3A8A', fontSize: '0.6rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '2px', fontFamily: 'Rajdhani, sans-serif' }}>
              <Calendar size={11} /> {car.year}
            </span>
            <span style={{ color: '#64748B', fontSize: '0.65rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '2px', fontFamily: 'Rajdhani, sans-serif' }}>
              <Settings size={11} /> {car.transmission?.toUpperCase()}
            </span>
          </div>
        </div>

        <h3 className="product-card-title" style={{
          color: '#111', fontWeight: 900, fontSize: '0.85rem',
          lineHeight: 1.2, marginBottom: '0.3rem',
          fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.02em',
          textTransform: 'uppercase',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {car.brand} {car.model}
        </h3>

        <p style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.3rem' }}>
          {car.fuelType?.toUpperCase()} • {car.seats} SEATS
        </p>

        {car.location?.city && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '0.4rem', color: '#94A3B8', fontSize: '0.65rem', fontWeight: 600 }}>
            <MapPin size={10} /> {car.location.city}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
              <span className="product-card-price" style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.05rem', fontWeight: 950, color: '#1E3A8A' }}>
                ₹{car.pricePerDay?.toLocaleString('en-IN')}
              </span>
              <span style={{ color: '#64748B', fontSize: '0.6rem', fontWeight: 800 }}>/day</span>
            </div>
            {car.pricePerHour > 0 && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginTop: '2px' }}>
                <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', fontWeight: 800, color: '#475569' }}>
                  ₹{car.pricePerHour?.toLocaleString('en-IN')}
                </span>
                <span style={{ color: '#94A3B8', fontSize: '0.55rem', fontWeight: 800 }}>/hour</span>
              </div>
            )}
          </div>
          <div className="product-card-btn" style={{
            height: '28px', padding: '0 0.75rem',
            background: '#1E3A8A', borderRadius: '6px', color: 'white',
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            fontSize: '0.65rem', fontWeight: 800, fontFamily: 'Rajdhani, sans-serif',
            letterSpacing: '0.05em', boxShadow: '0 4px 10px rgba(30, 58, 138, 0.15)',
            transition: 'all 0.3s'
          }}>
            RENT NOW <ArrowRight size={12} />
          </div>
        </div>
      </div>
    </div>
  );
}
