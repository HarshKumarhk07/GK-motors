import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNavigate, Link } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2, ArrowLeft, Star, ArrowRight, Calendar } from 'lucide-react';
import { getPart } from '../api/storeApi';
import { getBike } from '../api/bikeApi';
import toast from 'react-hot-toast';

function WishlistItemLoader({ partId, pincode, toggleWishlist, addToCart }) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(false);
 
  useEffect(() => {
    const fetchItem = async () => {
      setLoading(true);
      try {
        // Try spares first
        const pRes = await getPart(partId);
        if (pRes.data.part) {
          setItem({ ...pRes.data.part, itemType: 'spare' });
          return;
        }
      } catch (e) {
        // Spare fetch failed, try cars
        try {
          const bRes = await getBike(partId);
          if (bRes.data.bike) {
            setItem({ ...bRes.data.bike, itemType: 'car' });
            return;
          }
        } catch (err) {
          setItem(null);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [partId]);
 
  if (loading) return (
    <div style={{ background: '#FFF', border: '1px solid rgba(156, 163, 175, 0.15)', borderRadius: '24px', height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.03)' }}>
      <div style={{ width: 44, height: 44, border: '4px solid rgba(156, 163, 175, 0.1)', borderTopColor: '#1567D3', borderRadius: '50%', animation: 'spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
 
  if (!item) return (
    <div style={{ background: '#FFF', border: '1px solid rgba(156, 163, 175, 0.15)', borderRadius: '24px', height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
      <p style={{ color: '#64748B', fontSize: '0.9rem', fontWeight: 700 }}>This item is no longer available</p>
      <button onClick={() => toggleWishlist(partId)} style={{ background: '#1567D3', border: 'none', borderRadius: '12px', color: '#FFF', cursor: 'pointer', fontSize: '0.8rem', padding: '0.6rem 1.2rem', fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif" }}>
        REMOVE FROM LIST
      </button>
    </div>
  );

  const isCar = item.itemType === 'car';
  const detailUrl = isCar ? `/bikes/${item._id}` : `/parts/${item._id}`;
  const title = isCar ? (item.title || `${item.brand} ${item.model}`) : item.name;
  const brand = item.brand;
  const images = item.images || [];

  // Pincode logic only for parts
  let price = item.price;
  let originalPrice = item.price;
  let discount = 0;
  let effectiveStock = isCar ? 1 : item.stock;

  if (!isCar) {
    const hasPincodePricing = Array.isArray(item.pincodePricing) && item.pincodePricing.length > 0;
    const pincodeEntry = pincode.length === 6 && hasPincodePricing
      ? item.pincodePricing.find(p => p.pincode === pincode) : null;
    price = pincodeEntry ? Number(pincodeEntry.price) : (item.discountedPrice || item.price);
    originalPrice = pincodeEntry?.originalPrice ? Number(pincodeEntry.originalPrice) : item.price;
    effectiveStock = pincodeEntry ? Number(pincodeEntry.inventory) : item.stock;
    discount = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  }

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '20px',
        overflow: 'hidden',
        background: '#FFF',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: hovered ? '0 30px 60px rgba(0,0,0,0.4)' : '0 8px 25px rgba(0,0,0,0.1)',
        transition: 'all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
        height: '100%',
        border: '1px solid rgba(156, 163, 175, 0.1)'
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link to={detailUrl} style={{ textDecoration: 'none', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Top Image Section */}
        <div style={{ position: 'relative', height: '180px', background: '#F5F5F5', overflow: 'hidden' }}>
          {/* ... images ... */}
          <img
            src={images[0] || '/part-images/_placeholder.svg'}
            alt={title}
            style={{
              width: '100%', height: '100%', objectFit: 'contain', padding: '1rem',
              transition: 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              transform: hovered ? 'scale(1.08)' : 'scale(1)'
            }}
          />
          
          {/* Top-right: Trash (Remove) */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(item._id); }}
            style={{
              position: 'absolute', top: 12, right: 12,
              width: 34, height: 34, borderRadius: '50%',
              background: 'rgba(15, 23, 42, 0.85)',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', backdropFilter: 'blur(10px)',
              transition: 'all 0.25s',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 10
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#EF4444'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.85)'}
          >
            <Trash2 size={14} color="white" />
          </button>

          {/* Top-left: Type Badge */}
          <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: '0.5rem' }}>
            <span style={{
              background: isCar ? '#0F172A' : '#1567D3', color: 'white',
              fontSize: '0.65rem', fontWeight: 950,
              padding: '3px 12px', borderRadius: '30px',
              letterSpacing: '0.04em', textTransform: 'uppercase'
            }}>
              {isCar ? 'CAR' : 'SPARE'}
            </span>
            {discount > 0 && (
              <span style={{ background: '#0F172A', color: 'white', fontSize: '0.65rem', fontWeight: 950, padding: '3px 10px', borderRadius: '30px' }}>
                {discount}% OFF
              </span>
            )}
          </div>
        </div>

        {/* Bottom Content Section */}
        <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderTop: '1px solid #EEE' }}>
          {/* Metadata Row */}
          <div style={{ marginBottom: '0.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <span style={{ color: '#64748B', fontSize: '0.65rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '3px', fontFamily: "'Space Grotesk', sans-serif" }}>
                 {isCar ? <Calendar size={11} /> : <div style={{width: 5, height: 5, background: '#1567D3', borderRadius: '50%'}} />} 
                 {isCar ? item.year : brand?.toUpperCase()}
              </span>
            </div>
            {!isCar && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <Star size={9} fill="#FFB400" color="#FFB400" />
                <span style={{ color: '#AAA', fontSize: '0.65rem', fontWeight: 600 }}>{item.ratings || '5.0'}</span>
              </div>
            )}
          </div>

          {/* Title */}
          <h3 style={{
            color: '#111', fontWeight: 900, fontSize: '0.85rem',
            lineHeight: 1.2, marginBottom: '0.3rem',
            fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.02em',
            textTransform: 'uppercase',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {title}
          </h3>

          {/* Price row + Action */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.25rem', fontWeight: 950, color: '#1567D3', lineHeight: 1 }}>
                ₹{price?.toLocaleString('en-IN')}
              </span>
              {discount > 0 && (
                <span style={{ color: '#AAA', fontSize: '0.75rem', textDecoration: 'line-through', fontWeight: 600 }}>₹{originalPrice?.toLocaleString('en-IN')}</span>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '4px' }}>
              <div style={{
                height: '28px', padding: '0 0.7rem',
                background: '#1567D3', borderRadius: '8px', color: 'white',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                fontSize: '0.65rem', fontWeight: 950, fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: '0.04em', boxShadow: '0 4px 10px rgba(21, 103, 211, 0.2)'
              }}>
                VIEW <ArrowRight size={12} />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
 
export default function Wishlist() {
  const { user, wishlist = [], toggleWishlist } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [pincode, setPincode] = useState(() => localStorage.getItem('selectedPincode') || '');
 
  useEffect(() => {
    const handler = () => setPincode(localStorage.getItem('selectedPincode') || '');
    window.addEventListener('pincode-updated', handler);
    return () => window.removeEventListener('pincode-updated', handler);
  }, []);
 
  if (!user) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', gap: '2rem', padding: '2rem' }}>
        <div style={{ background: '#FFF', width: 140, height: 140, borderRadius: '40px', border: '1px solid rgba(156, 163, 175, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.03)', transform: 'rotate(-5deg)' }}>
          <Heart size={60} style={{ color: '#0F172A', opacity: 0.15 }} />
        </div>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <h2 style={{ color: '#0F172A', fontFamily: "'Space Grotesk', sans-serif", fontSize: '2.5rem', fontWeight: 950, margin: 0, lineHeight: 1.1 }}>READY TO SAVE <span style={{ color: '#1567D3' }}>YOUR WISHLIST?</span></h2>
          <p style={{ color: '#64748B', marginTop: '1rem', fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.5 }}>Login to your GK Motors account to view and manage your personalized wishlist.</p>
        </div>
        <Link to="/login" style={{ background: '#1567D3', color: 'white', padding: '1.2rem 3.5rem', borderRadius: '20px', fontWeight: 950, textDecoration: 'none', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.15em', fontSize: '1.1rem', boxShadow: '0 15px 40px rgba(21, 103, 211, 0.3)', transition: 'all 0.4s' }}>
          MEMBER LOGIN
        </Link>
      </div>
    );
  }
 
  if (wishlist.length === 0) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', gap: '2rem', padding: '2rem' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ background: '#FFF', width: 140, height: 140, borderRadius: '40px', border: '1px solid rgba(156, 163, 175, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.03)' }}>
            <Heart size={60} style={{ color: '#0F172A', opacity: 0.15 }} />
          </div>
          <div style={{ position: 'absolute', top: -10, right: -10, width: 44, height: 44, background: '#0F172A', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: 'white', fontWeight: 950, boxShadow: '0 8px 25px rgba(0,0,0,0.1)', border: '4px solid #FFFFFF', fontFamily: "'Space Grotesk', sans-serif" }}>0</div>
        </div>
        <div style={{ textAlign: 'center', maxWidth: '480px' }}>
          <h2 style={{ color: '#0F172A', fontFamily: "'Space Grotesk', sans-serif", fontSize: '2.8rem', fontWeight: 950, margin: 0, letterSpacing: '0.04em', lineHeight: 1.1 }}>YOUR WISHLIST <span style={{ color: '#1567D3' }}>IS EMPTY</span></h2>
          <p style={{ color: '#64748B', marginTop: '1rem', fontSize: '1.1rem', fontWeight: 700 }}>Explore our catalog of certified spare parts and car services to save what you love!</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/parts" style={{ background: '#1567D3', color: 'white', padding: '1rem 2.5rem', borderRadius: '18px', fontWeight: 950, textDecoration: 'none', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.1em', fontSize: '1rem', boxShadow: '0 12px 35px rgba(21, 103, 211, 0.25)', transition: 'all 0.4s' }}>
            EXPLORE SPARE PARTS
          </Link>
          <Link to="/services" style={{ background: '#0F172A', color: 'white', padding: '1rem 2.5rem', borderRadius: '18px', fontWeight: 950, textDecoration: 'none', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.1em', fontSize: '1rem', boxShadow: '0 12px 35px rgba(15, 23, 42, 0.25)', transition: 'all 0.4s' }}>
            BOOK CAR SERVICE
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: '1 0 auto', width: '100%', background: '#FFFFFF' }}>
      <style>{`
        .wishlist-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)) !important;
          gap: 1.5rem !important;
        }
        @media (max-width: 768px) {
          .wishlist-grid { 
            grid-template-columns: repeat(2, 1fr) !important; 
            gap: 0.8rem !important;
          }
          .wishlist-grid > div h3 { font-size: 0.85rem !important; }
          .wishlist-grid > div p { font-size: 0.7rem !important; }
          .wishlist-grid > div .font-size-price { font-size: 1rem !important; }
        }
        @media (max-width: 400px) {
          .wishlist-grid { gap: 0.5rem !important; }
        }
      `}</style>
      <div style={{ height: '5px', background: 'linear-gradient(90deg, #1567D3, #6FD8FF, transparent)' }} />
 
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: '3rem', paddingBottom: '4rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '3rem' }}>
          <button onClick={() => navigate('/')}
            style={{ 
              background: '#1567D3', border: 'none', borderRadius: '10px', 
              padding: '0.6rem 1.2rem', color: 'white', cursor: 'pointer', 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              fontSize: '0.8rem', fontWeight: 900, transition: 'all 0.3s', 
              boxShadow: '0 4px 12px rgba(21, 103, 211, 0.2)', fontFamily: "'Space Grotesk', sans-serif", 
              letterSpacing: '0.08em', textTransform: 'uppercase'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#6FD8FF'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = '#1567D3'; }}>
            <ArrowLeft size={14} /> BACK
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{ width: 5, height: 36, background: '#1567D3', borderRadius: '4px' }} />
            <h1 style={{ color: '#0F172A', fontFamily: "'Space Grotesk', sans-serif", fontSize: '2.8rem', fontWeight: 950, margin: 0, letterSpacing: '0.04em' }}>
              YOUR <span style={{ color: '#1567D3' }}>WISHLIST</span>
            </h1>
          </div>
        </div>
 
        {pincode.length === 6 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#FFF', borderRadius: '10px', border: '1px solid rgba(156, 163, 175, 0.1)', width: 'fit-content', marginBottom: '2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
            <span style={{ fontSize: '1.1rem' }}>📍</span>
            <span style={{ color: '#475569', fontSize: '0.9rem', fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.04em' }}>
              CHECKING AVAILABILITY FOR <span style={{ color: '#1567D3' }}>{pincode}</span>
            </span>
          </div>
        )}
 
        <div className="animate-fadeInUp wishlist-grid">
          {wishlist.map((id) => (
            <WishlistItemLoader key={id} partId={id} pincode={pincode} toggleWishlist={toggleWishlist} addToCart={addToCart} />
          ))}
        </div>
      </div>
    </div>
  );
}

