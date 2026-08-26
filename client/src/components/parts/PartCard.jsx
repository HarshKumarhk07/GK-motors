import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { ShoppingCart, Heart, Star } from 'lucide-react';
import toast from 'react-hot-toast';

// Shipped in client/public. The old fallback pointed at via.placeholder.com,
// which is a third party we do not control and which fails closed as a broken
// image icon. This one is ours and always resolves.
const PART_PLACEHOLDER = '/part-images/_placeholder.svg';

export default function PartCard({ part }) {
  const { items, addToCart, updateQty } = useCart();
  const cartItem = items.find(i => i._id === part._id);
  const { wishlist = [], toggleWishlist, user } = useAuth();
  const isWishlisted = user && Array.isArray(wishlist) && wishlist.includes(part._id);
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
    if (!selectedPincode || !Array.isArray(part.pincodePricing) || part.pincodePricing.length === 0) return null;
    return part.pincodePricing.find(p => p.pincode === selectedPincode.trim()) || null;
  }, [part.pincodePricing, selectedPincode]);

  const effectivePrice = pincodeData ? Number(pincodeData.price) : (part.discountedPrice || part.price);
  const effectiveOriginalPrice = pincodeData?.originalPrice
    ? Number(pincodeData.originalPrice)
    : (part.discountedPrice && part.discountedPrice < part.price ? Number(part.price) : null);
  const effectiveStock = pincodeData ? Number(pincodeData.inventory) : part.stock;

  const discount = effectiveOriginalPrice && effectiveOriginalPrice > effectivePrice
    ? Math.round(((effectiveOriginalPrice - effectivePrice) / effectiveOriginalPrice) * 100)
    : 0;

  // A rating is shown only when the catalogue actually has one. Rendering
  // "0.0 ★" on every unrated product would be inventing social proof.
  const rating = Number(part.ratings) > 0 ? Number(part.ratings) : null;
  const hasPrice = Number(effectivePrice) > 0;

  return (
    <>
    <style>{PART_CARD_STYLES}</style>
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        background: '#FFF',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        boxShadow: hovered ? '0 30px 60px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(21, 103, 211, 0.12)' : '0 10px 30px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-12px)' : 'translateY(0)',
        transition: 'all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
        height: '100%',
      }}
    >
      <Link to={`/parts/${part._id}`} style={{ textDecoration: 'none', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Top Image Section (Light background, rounded corners) */}
        <div className="gk-pc-media">
          {/* .gk-pc-media already reserves the box via aspect-ratio: 4/3, so
              there is no layout shift to fix here. What these two attributes
              buy is scroll smoothness: five of these sit below the fold on the
              home page (and a full grid of them on /parts), and decoding a
              remote product photo synchronously while the user is scrolling is
              exactly the kind of main-thread stall that reads as a freeze. */}
          <img
            src={part.images?.[0] || PART_PLACEHOLDER}
            onError={(e) => { if (e.currentTarget.src.indexOf(PART_PLACEHOLDER) === -1) e.currentTarget.src = PART_PLACEHOLDER; }}
            alt={part.name}
            loading="lazy"
            decoding="async"
            style={{
              width: '100%', height: '100%', objectFit: 'contain', padding: '1.2rem',
              transform: hovered ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          />

          {/* Top-left: Discount Badge */}
          {discount > 0 && (
            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 6 }}>
              <span style={{
                background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                color: 'white',
                fontSize: '0.68rem',
                fontWeight: 950,
                padding: '3px 8px',
                borderRadius: '6px',
                letterSpacing: '0.04em',
                fontFamily: "'Space Grotesk', sans-serif",
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.35)'
              }}>
                {discount}% OFF
              </span>
            </div>
          )}
          
          {/* Top-right: Heart (Wishlist) */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!user) {
                toast.error('Please login first to wishlist this item');
                return;
              }
              toggleWishlist(part._id);
              toast.success(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist');
            }}
            className="gk-pc-wish"
            style={{
              position: 'absolute', top: 12, right: 12,
              width: 34, height: 34, borderRadius: '50%',
              background: isWishlisted ? '#EF4444' : 'rgba(15, 23, 42, 0.8)',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transform: isWishlisted ? 'scale(1.1)' : 'scale(1)',
              transition: 'all 0.25s',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 10
            }}
          >
            <Heart size={14} fill={isWishlisted ? 'white' : 'none'} color="white" />
          </button>

          {/* Out of stock overlay */}
          {effectiveStock === 0 && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(255,255,255,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(1px)', zIndex: 5
            }}>
              <span style={{
                color: '#111', fontWeight: 950, fontSize: '0.8rem',
                letterSpacing: '0.15em', textTransform: 'uppercase',
                padding: '0.4rem 1.2rem', border: '2.5px solid #111',
                background: '#FFF', borderRadius: '10px',
              }}>SOLD OUT</span>
            </div>
          )}
        </div>

        {/* Bottom Content Section (White background) */}
        <div style={{ padding: '0.85rem', flex: 1, display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderTop: '1px solid #EEE' }}>
          {/* Category */}
          <div style={{ marginBottom: '0.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontSize: '0.65rem', color: '#1567D3',
              textTransform: 'uppercase', fontWeight: 950,
              letterSpacing: '0.08em', fontFamily: "'Space Grotesk', sans-serif"
            }}>
              {part.category?.replace('_', ' ')}
            </span>
          </div>

          {/* Name */}
          <h3 className="product-card-title gk-pc-name">{part.name}</h3>

          <div className="gk-pc-sub">
            {part.brand && <span className="gk-pc-brand">{part.brand}</span>}
            {rating && (
              <span className="gk-pc-rating">
                <Star size={11} fill="#F59E0B" color="#F59E0B" />
                {rating.toFixed(1)}
                {Number(part.numReviews) > 0 && <span className="gk-pc-reviews">({part.numReviews})</span>}
              </span>
            )}
          </div>

          {/* Price row + CTA */}
          <div className="gk-pc-priceRow">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
              {discount > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ textDecoration: 'line-through', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
                    ₹{effectiveOriginalPrice?.toLocaleString('en-IN')}
                  </span>
                  <span style={{ color: '#16A34A', fontSize: '0.72rem', fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
                    {discount}% OFF
                  </span>
                </div>
              ) : null}
              <span className="product-card-price gk-pc-price">
                {hasPrice ? `₹${Number(effectivePrice).toLocaleString('en-IN')}` : 'Price on request'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
              {cartItem ? (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.6rem', 
                  background: '#F5F5F5', 
                  borderRadius: '6px', 
                  padding: '2px 6px',
                  border: '1px solid #EEE'
                }}>
                  <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateQty(part._id, cartItem.quantity - 1); }}
                    style={{ 
                      width: 24, height: 24, borderRadius: '4px', border: 'none', 
                      background: '#1567D3', color: 'white', display: 'flex', 
                      alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      fontSize: '1rem', fontWeight: 900
                    }}
                  >-</button>
                  <span style={{ fontSize: '0.85rem', fontWeight: 950, color: '#111', fontFamily: "'Space Grotesk', sans-serif", minWidth: '15px', textAlign: 'center' }}>
                    {cartItem.quantity}
                  </span>
                  <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateQty(part._id, cartItem.quantity + 1); }}
                    style={{ 
                      width: 24, height: 24, borderRadius: '4px', border: 'none', 
                      background: '#1567D3', color: 'white', display: 'flex', 
                      alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      fontSize: '1rem', fontWeight: 900
                    }}
                  >+</button>
                </div>
              ) : (
                 <button
                  className="product-card-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!user) {
                      toast.error('Please login first to add items to cart');
                      return;
                    }
                    addToCart({ ...part, effectivePrice });
                  }}
                  disabled={effectiveStock === 0 || !hasPrice}
                  title={!hasPrice ? 'This product has no price set yet' : undefined}
                  style={{
                    height: '32px', minWidth: 0,
                    padding: '0 0.75rem',
                    background: effectiveStock === 0 || !hasPrice ? '#E2E8F0' : '#1567D3',
                    border: 'none', borderRadius: '8px', color: 'white',
                    cursor: effectiveStock === 0 || !hasPrice ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: effectiveStock === 0 || !hasPrice ? 'none' : '0 4px 12px rgba(21, 103, 211, 0.28)',
                    transition: 'all 0.2s',
                    gap: '0.35rem', fontWeight: 950, fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.7rem', letterSpacing: '0.04em'
                  }}
                >
                  <ShoppingCart size={13} /> <span className="gk-pc-addlabel">ADD</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
    </>
  );
}


export function PartCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        background: '#FFF',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
        border: '1px solid #F1F5F9'
      }}
    >
      {/* Style injected inside the card div — NOT as a sibling grid item */}
      <style>{PART_CARD_STYLES}</style>

      {/* Media Placeholder */}
      <div className="gk-pc-media gk-skel" style={{ background: '#F8FAFC' }} />

      {/* Content placeholder — laid out by the real card's own classes
          (.gk-pc-name / .gk-pc-sub / .gk-pc-priceRow) rather than by a second
          set of hand-picked heights. Without that the placeholder sat ~48px
          shorter than the card it stands in for, so the whole shelf jumped
          when the products arrived. */}
      <div className="gk-pc-body-skel">
        {/* Category */}
        <div className="gk-pc-cat-skel">
          <div className="gk-skel" style={{ height: '10px', width: '42%', borderRadius: '4px' }} />
        </div>

        {/* Title — inherits the clamped two-line height */}
        <h3 className="gk-pc-name gk-pc-name-skel">
          <span className="gk-skel" style={{ display: 'block', height: '0.62rem', width: '94%', borderRadius: '4px' }} />
          <span className="gk-skel" style={{ display: 'block', height: '0.62rem', width: '60%', borderRadius: '4px' }} />
        </h3>

        {/* Brand + rating */}
        <div className="gk-pc-sub">
          <span className="gk-skel" style={{ display: 'block', height: '0.5rem', width: '3.2rem', borderRadius: '4px' }} />
          <span className="gk-skel" style={{ display: 'block', height: '0.5rem', width: '2.2rem', borderRadius: '4px' }} />
        </div>

        {/* Price & CTA row */}
        <div className="gk-pc-priceRow">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
            <span className="gk-skel" style={{ display: 'block', height: '0.62rem', width: '6rem', borderRadius: '4px' }} />
            <span className="gk-skel" style={{ display: 'block', height: '1.2rem', width: '4.4rem', borderRadius: '4px' }} />
          </div>
          <span className="gk-skel" style={{ display: 'block', height: '32px', width: '58px', borderRadius: '8px', flexShrink: 0 }} />
        </div>
      </div>
    </div>
  );
}

/* Sized in ratios, not pixels: the media band follows the column width so the
   same card works in a five-across desktop strip and a two-across phone grid
   without a fixed height stretching it or a fixed width overflowing it. */
const PART_CARD_STYLES = `
  /* The wishlist button's frosted background. Five of these scroll past on the
     home page, each one its own compositing layer that the GPU re-blurs as it
     moves. Cheap on a desktop, not free on a phone — so the blur is desktop
     only and mobile gets a slightly more opaque solid instead, which over a
     product photo reads the same. */
  @media (min-width: 1024px) {
    .gk-pc-wish { -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
  }

  /* Skeleton mirrors of the real card's body/category boxes, so the two stay
     the same height. Kept beside the card's own rules for exactly that reason. */
  .gk-pc-body-skel { padding: 0.85rem; flex: 1; display: flex; flex-direction: column; background: #FFFFFF; border-top: 1px solid #EEE; min-width: 0; }
  .gk-pc-cat-skel { margin-bottom: 0.3rem; display: flex; align-items: center; min-height: 1.04rem; }
  .gk-pc-name-skel { display: flex !important; flex-direction: column; justify-content: center; gap: 0.34rem; }
  @keyframes gk-shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .gk-skel {
    background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%) !important;
    background-size: 200% 100% !important;
    animation: gk-shimmer 1.5s infinite linear !important;
  }
  .gk-pc-media { position: relative; width: 100%; aspect-ratio: 4 / 3; background: #F5F5F5; overflow: hidden; }
  .gk-pc-name {
    color: #111; font-weight: 900; font-size: 0.86rem; line-height: 1.25;
    margin: 0 0 0.25rem; font-family: 'Space Grotesk', sans-serif; letter-spacing: 0.02em;
    text-transform: uppercase; overflow-wrap: anywhere;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    min-height: 2.15em;
  }
  .gk-pc-sub { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.5rem; min-height: 1rem; }
  .gk-pc-brand { color: #64748B; font-size: 0.71rem; font-weight: 600; overflow-wrap: anywhere; }
  .gk-pc-rating { display: inline-flex; align-items: center; gap: 0.18rem; color: #B45309; font-size: 0.7rem; font-weight: 800; }
  .gk-pc-reviews { color: #94A3B8; font-weight: 600; }
  /* A price must never break mid-number ('₹3,1 / 99'), so it stays nowrap
     and the row wraps instead when the card is too narrow for both. */
  .gk-pc-price { font-family: 'Space Grotesk', sans-serif; font-size: 1.2rem; font-weight: 950; color: #1567D3; line-height: 1.1; white-space: nowrap; }
  .gk-pc-priceRow { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 0.4rem 0.4rem; margin-top: auto; padding-top: 0.4rem; min-width: 0; }

  @media (max-width: 420px) {
    .gk-pc-name { font-size: 0.78rem; }
    .gk-pc-price { font-size: 1.02rem; }
    .gk-pc-addlabel { display: none; }
  }
`;


