import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Calendar, Gauge, MapPin, Star, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toggleWishlist as toggleWishlistApi } from '../../api/authApi';
import toast from 'react-hot-toast';

export default function CarCard({ car, bike, hideBadges = false }) {
  const target = car || bike;
  const navigate = useNavigate();
  const { wishlist = [], toggleWishlist, user } = useAuth();
  const isWishlisted = user && Array.isArray(wishlist) && wishlist.includes(target?._id);
  const [hovered, setHovered] = useState(false);

  const [selectedPincode, setSelectedPincode] = useState(
    () => localStorage.getItem('selectedPincode') || ''
  );

  useEffect(() => {
    const handlePincodeUpdate = () => {
      setSelectedPincode(localStorage.getItem('selectedPincode') || '');
    };
    window.addEventListener('pincode-updated', handlePincodeUpdate);
    return () => window.removeEventListener('pincode-updated', handlePincodeUpdate);
  }, []);

  const pincodeData = useMemo(() => {
    if (!selectedPincode || !Array.isArray(target?.pincodePricing) || target?.pincodePricing.length === 0) return null;
    return target?.pincodePricing.find(p => p.pincode === selectedPincode.trim()) || null;
  }, [target?.pincodePricing, selectedPincode]);

  const effectivePrice = pincodeData ? Number(pincodeData.price) : (target?.discountedPrice || target?.price);
  const effectiveOriginalPrice = pincodeData?.originalPrice ? Number(pincodeData.originalPrice) : target?.price;
  const effectiveLocation = pincodeData?.location || target?.location?.city;

  const discount = effectiveOriginalPrice && effectiveOriginalPrice > effectivePrice
    ? Math.round(((effectiveOriginalPrice - effectivePrice) / effectiveOriginalPrice) * 100)
    : 0;

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error('Please login first to wishlist this item');
      return;
    }
    toggleWishlist(target?._id);
    toast.success(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist');
  };

  return (
    <div
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
      <Link to={`/bikes/${target?._id}`} style={{ textDecoration: 'none', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Top Image Section (Light background) */}
        <div style={{ position: 'relative', height: '180px', background: '#F5F5F5', overflow: 'hidden' }}>
          <img
            src={target?.images?.[0] || 'https://via.placeholder.com/400x300/F8FAFC/2563EB?text=No+Image'}
            alt={target?.title}
            style={{
              width: '100%', height: '100%', objectFit: 'contain', padding: '1.2rem',
              transform: hovered ? 'scale(1.1) translateY(-8px)' : 'scale(1)',
              transition: 'transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          />

          {/* Top-right: Heart (Wishlist) */}
          <button
            onClick={handleWishlist}
            style={{
              position: 'absolute', top: 12, right: 12,
              width: 34, height: 34, borderRadius: '50%',
              background: isWishlisted ? '#EF4444' : 'rgba(15, 23, 42, 0.8)',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', backdropFilter: 'blur(10px)',
              transform: isWishlisted ? 'scale(1.1)' : 'scale(1)',
              transition: 'all 0.25s',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 10
            }}
          >
            <Heart size={14} fill={isWishlisted ? 'white' : 'none'} color="white" />
          </button>

          {/* Top-left: Type Badge */}
          <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: '0.5rem' }}>
            <span className="product-card-badge" style={{
              background: target?.type === 'new' ? '#10B981' : '#0F172A', color: 'white',
              fontSize: '0.65rem', fontWeight: 900,
              padding: '4px 14px', borderRadius: '30px',
              letterSpacing: '0.06em', textTransform: 'uppercase'
            }}>
              {target?.type === 'new' ? 'CERTIFIED NEW' : 'PRE-OWNED'}
            </span>
          </div>

        </div>

        {/* Bottom Content Section */}
        <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderTop: '1px solid #EEE' }}>
          {/* Metadata Row 1 */}
          <div style={{ marginBottom: '0.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <span style={{ color: '#1E3A8A', fontSize: '0.6rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '2px', fontFamily: 'Rajdhani, sans-serif' }}>
                <Calendar size={11} /> {target?.year}
              </span>
              <span style={{ color: '#64748B', fontSize: '0.65rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '2px', fontFamily: 'Rajdhani, sans-serif' }}>
                <Gauge size={11} /> {target?.kmDriven?.toLocaleString()} KM
              </span>
            </div>
          </div>

          {/* Title */}
          <h3 className="product-card-title" style={{
            color: '#111', fontWeight: 900, fontSize: '0.85rem',
            lineHeight: 1.2, marginBottom: '0.3rem',
            fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.02em',
            textTransform: 'uppercase',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {target?.title || `${target?.brand} ${target?.model}`}
          </h3>

          {/* Subtitle/Brand */}
          <p style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.3rem' }}>
            {target?.brand?.toUpperCase()} {target?.engineCC ? `• ${target?.engineCC}CC` : ''}
          </p>

          {/* Ratings Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '0.4rem' }}>
            <div style={{ display: 'flex', gap: '1px' }}>
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} size={9} fill="#FFB400" color="#FFB400" />
              ))}
            </div>
            <span style={{ color: '#AAA', fontSize: '0.65rem', fontWeight: 600, marginLeft: '2px' }}>
              ({target?.numReviews || 24} reviews)
            </span>
          </div>

          {/* Price row + Action */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
            <span className="product-card-price" style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.05rem', fontWeight: 950, color: '#1E3A8A', lineHeight: 1 }}>
              ₹{effectivePrice?.toLocaleString('en-IN')}
            </span>
            <div className="product-card-btn" style={{
              height: '28px', padding: '0 0.75rem',
              background: '#1E3A8A', borderRadius: '6px', color: 'white',
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.65rem', fontWeight: 800, fontFamily: 'Rajdhani, sans-serif',
              letterSpacing: '0.05em', boxShadow: '0 4px 10px rgba(30, 58, 138, 0.15)',
              transition: 'all 0.3s'
            }}>
              DETAILS <ArrowRight size={12} />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

