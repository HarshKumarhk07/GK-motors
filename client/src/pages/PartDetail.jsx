import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getPart, getParts } from '../api/storeApi';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import PartCard from '../components/parts/PartCard';
import {
  Heart, Share2, ChevronLeft, ChevronRight, Star, ShoppingCart,
  MapPin, CheckCircle, AlertCircle, Clock, Maximize2, X,
  Search, ZoomIn, ZoomOut, Phone, Mail, User, Info, Check, Play,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const normalizeSize = (s) => (s ? s.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]/g, '').trim() : '');
const isVideoUrl = (url = '') => /\.(mp4|mov|webm|ogg|m4v)(\?.*)?$/i.test(url) || url.includes('/video/upload/');

export default function PartDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { items, addToCart, updateQty } = useCart();
  const cartItem = items.find(i => i._id === id);
  const { user, wishlist = [], toggleWishlist } = useAuth();

  const [part, setPart] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [fullScreenZoom, setFullScreenZoom] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const [selectedPincode, setSelectedPincode] = useState(() => localStorage.getItem('selectedPincode') || '');
  const [selectedSize, setSelectedSize] = useState(null);
  const userPickedSize = useRef(false);

  const isMobile = window.matchMedia("(pointer: coarse)").matches;
  const isWishlisted = user && Array.isArray(wishlist) && (wishlist.includes(id) || wishlist.some(i => i._id === id));

  useEffect(() => {
    setLoading(true);
    getPart(id)
      .then(({ data }) => {
        setPart(data.part);
        return getParts({ category: data.part.category, limit: 8 });
      })
      .then(({ data }) => setSimilar((data.parts || []).filter(p => (p._id || p.id) !== id).slice(0, 8)))
      .catch(() => toast.error('Failed to load part'))
      .finally(() => {
        setTimeout(() => setLoading(false), 800);
      });
  }, [id]);

  useEffect(() => {
    const handler = () => setSelectedPincode(localStorage.getItem('selectedPincode') || '');
    window.addEventListener('pincode-updated', handler);
    return () => window.removeEventListener('pincode-updated', handler);
  }, []);

  useEffect(() => {
    userPickedSize.current = false;
    setSelectedSize(null);
  }, [selectedPincode]);

  const availableSizes = useMemo(() => {
    if (!part) return [];
    if (selectedPincode.length === 6) {
      const entries = (part.pincodePricing || []).filter(p => p.pincode === selectedPincode.trim() && p.size);
      if (entries.length > 0) {
        const seen = new Map();
        entries.forEach(p => {
          const key = normalizeSize(p.size);
          if (!seen.has(key)) seen.set(key, { 
            size: p.size, 
            price: Number(p.price), 
            originalPrice: p.originalPrice ? Number(p.originalPrice) : null, 
            inventory: Number(p.inventory) 
          });
        });
        return Array.from(seen.values());
      }
      return [];
    }
    return (part.variants || []).map(v => ({ 
      size: v.size, 
      price: Number(v.price || part.discountedPrice || part.price), 
      originalPrice: v.originalPrice ? Number(v.originalPrice) : null, 
      inventory: Number(v.countInStock ?? part.stock ?? 0) 
    }));
  }, [part, selectedPincode]);

  useEffect(() => {
    if (availableSizes.length > 0 && !userPickedSize.current) {
      const best = availableSizes.find(s => s.inventory > 0) || availableSizes[0];
      setSelectedSize(best);
    }
  }, [availableSizes]);

  const pincodeRule = useMemo(() => {
    if (!part || selectedPincode.length !== 6 || !selectedSize) return null;
    return (part.pincodePricing || []).find(p => p.pincode === selectedPincode.trim() && normalizeSize(p.size) === normalizeSize(selectedSize.size)) || null;
  }, [part, selectedPincode, selectedSize]);

  const effectivePrice = selectedSize?.price ?? part?.discountedPrice ?? part?.price ?? 0;
  const effectiveOriginal = selectedSize?.originalPrice ?? part?.price ?? 0;
  const effectiveStock = selectedSize?.inventory ?? part?.stock ?? 0;
  const discount = (effectiveOriginal && effectivePrice && effectiveOriginal > effectivePrice) 
    ? Math.round(((effectiveOriginal - effectivePrice) / effectiveOriginal) * 100) 
    : 0;

  const isUnavailable = selectedPincode.length === 6 && availableSizes.length === 0;
  const isCheckingPincode = selectedPincode.length > 0 && selectedPincode.length < 6;

  const handleAddToCart = () => {
    if (!user) { toast.error('Please login first to add items to cart'); return; }
    if (isUnavailable) { toast.error('Not available at this pincode'); return; }
    if (effectiveStock <= 0) { toast.error('Out of stock'); return; }
    
    addToCart({ 
      ...part, 
      effectivePrice, 
      selectedVariant: selectedSize ? { ...selectedSize, price: effectivePrice, originalPrice: effectiveOriginal, countInStock: effectiveStock } : null
    });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => toast.success('Link copied!'))
      .catch(() => toast.error('Failed to copy link'));
  };

  const handlePincodeChange = (val) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 6);
    setSelectedPincode(cleaned);
    if (cleaned.length === 6) {
      localStorage.setItem('selectedPincode', cleaned);
      window.dispatchEvent(new Event('pincode-updated'));
    }
  };

  const handleMouseMove = (e) => {
    if (!zoomed) return;
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.pageX - left) / width) * 100;
    const y = ((e.pageY - top) / height) * 100;
    setMousePos({ x, y });
  };

  const maskPhone = (phone = "") => {
    const d = String(phone).replace(/\D/g, "");
    if (d.length <= 4) return d;
    return `${"*".repeat(d.length - 4)}${d.slice(-4)}`;
  };

  if (loading) return (
    <div className="min-h-[80vh] flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-gray-100 border-t-blue-600 rounded-full animate-spin" />
        <p className="font-black text-gray-500 tracking-widest uppercase text-sm font-rajdhani">Assembling Quality...</p>
      </div>
    </div>
  );

  if (!part) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center bg-white p-4">
      <AlertCircle size={64} className="text-blue-500 mb-4" />
      <h2 className="text-3xl font-black text-gray-900 mb-2 font-rajdhani">SPARE NOT FOUND</h2>
      <p className="text-gray-500 mb-8 max-w-md text-center">The specific component you're looking for is currently unavailable in our showroom.</p>
      <Link to="/parts" className="btn-primary" style={{ background: '#0F172A', borderRadius: '12px', padding: '1rem 2.5rem' }}>BACK TO SHOWROOM</Link>
    </div>
  );

  const images = part.images?.length ? part.images : ['https://via.placeholder.com/800x800/F9F9F9/E53935?text=No+Preview'];

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      <style>{`
        @media (max-width: 768px) {
          .part-detail-grid { grid-template-columns: 1fr !important; }
          .part-detail-grid > div:last-child { position: static !important; }
          .main-detail-img { height: 400px !important; object-fit: contain !important; padding: 1rem !important; width: 100% !important; }
          .part-thumb-row { gap: 0.5rem !important; }
          .part-thumb-row button { width: 60px !important; height: 60px !important; border-radius: 10px !important; }
          .part-nav-right { right: 12px !important; }
        }
      `}</style>

      {/* Fullscreen Zoom Modal */}
      {fullScreenZoom && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(10px)' }}
          onClick={() => setFullScreenZoom(false)}>
          <img src={images[activeImg]} alt={part.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          <button style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>
      )}

      {/* Breadcrumb */}
      <div style={{ background: '#F9F9F9', borderBottom: '1px solid #EEE', padding: '0.8rem 0' }}>
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-2" style={{ fontSize: '0.9rem', color: '#666', fontWeight: 600 }}>
          <button onClick={() => navigate('/parts')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#111'}
            onMouseLeave={e => e.currentTarget.style.color = '#666'}>
            <ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} /> Back to Spares
          </button>
          <span>/</span>
          <span style={{ color: '#1E3A8A', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{part.name}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="animate-fadeInUp part-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>

          {/* Left: Media & Details */}
          <div>
            {/* Main Image/Video */}
            <div style={{ position: 'relative', background: '#F5F5F5', borderRadius: '20px', overflow: 'hidden', marginBottom: '1rem', border: '1px solid #EEE', boxShadow: '0 8px 30px rgba(0,0,0,0.03)', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isVideoUrl(images[activeImg]) ? 'default' : 'crosshair' }}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setZoomed(false)}
              onClick={() => isMobile && !isVideoUrl(images[activeImg]) && setFullScreenZoom(true)}>

              {/* Wishlist Floating Button */}
              <button onClick={(e) => {
                e.stopPropagation();
                if (!user) {
                  toast.error('Please login first to wishlist this item');
                  return;
                }
                toggleWishlist?.(id);
                toast.success(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist');
              }}
                style={{ position: 'absolute', top: '15px', right: '15px', width: '42px', height: '42px', borderRadius: '50%', background: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, boxShadow: '0 4px 15px rgba(0,0,0,0.1)', transition: 'transform 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                <Heart size={20} fill={isWishlisted ? '#EF4444' : 'none'} color={isWishlisted ? '#EF4444' : '#0F172A'} strokeWidth={2.5} />
              </button>

              {/* Discount badge */}
              {discount > 0 && (
                <div style={{ position: 'absolute', top: 15, left: 15, zIndex: 10 }}>
                  <span style={{ background: '#0F172A', color: 'white', fontSize: '0.65rem', fontWeight: 900, padding: '5px 12px', borderRadius: '10px', letterSpacing: '0.06em' }}>{discount}% OFF</span>
                </div>
              )}

              {isVideoUrl(images[activeImg]) ? (
                <video
                  key={images[activeImg]}
                  src={images[activeImg]}
                  controls autoPlay muted playsInline
                  className="main-detail-img"
                  style={{ width: '100%', height: 420, objectFit: 'contain', background: '#000' }}
                />
              ) : (
                <img src={images[activeImg]} alt={part.name}
                  className="main-detail-img"
                  style={{
                    width: '100%', height: 420, objectFit: 'contain', padding: isMobile ? '1.5rem' : '0.5rem',
                    display: 'block', margin: '0 auto',
                    transition: 'transform 0.5s ease-out',
                    transform: zoomed && !isMobile ? 'scale(2)' : 'scale(1)',
                    transformOrigin: zoomed && !isMobile ? `${mousePos.x}% ${mousePos.y}%` : 'center',
                  }} />
              )}

              {/* Zoom button (desktop) */}
              {!isVideoUrl(images[activeImg]) && !isMobile && (
                <button onClick={(e) => { e.stopPropagation(); setZoomed(!zoomed); }}
                  style={{ position: 'absolute', bottom: 15, right: 15, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '14px', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', backdropFilter: 'blur(8px)', zIndex: 10 }}>
                  {zoomed ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
                </button>
              )}

              {/* Fullscreen button (mobile) */}
              {isMobile && !isVideoUrl(images[activeImg]) && (
                <button onClick={() => setFullScreenZoom(true)}
                  style={{ position: 'absolute', bottom: 15, right: 15, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '14px', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', zIndex: 10 }}>
                  <Maximize2 size={18} />
                </button>
              )}

              {/* Navigation Arrows */}
              {images.length > 1 && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); setActiveImg((activeImg - 1 + images.length) % images.length); setZoomed(false); }}
                    style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', opacity: 0.6, transition: 'opacity 0.2s', zIndex: 10 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
                    <ChevronLeft size={20} />
                  </button>
                  <button className="part-nav-right" onClick={(e) => { e.stopPropagation(); setActiveImg((activeImg + 1) % images.length); setZoomed(false); }}
                    style={{ position: 'absolute', right: 60, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', opacity: 0.6, transition: 'opacity 0.2s', zIndex: 10 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
                    <ChevronRight size={20} />
                  </button>
                </>
              )}

              {/* Sold Out Overlay */}
              {effectiveStock === 0 && !isCheckingPincode && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                  <span style={{ background: '#1E3A8A', color: 'white', fontWeight: 950, padding: '0.7rem 2.5rem', borderRadius: '14px', fontSize: '0.95rem', transform: 'rotate(-8deg)', border: '4px solid white', boxShadow: '0 12px 35px rgba(30, 58, 138, 0.25)', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.1em' }}>
                    {selectedPincode.length === 6 && isUnavailable ? 'NOT AVAILABLE' : 'OUT OF STOCK'}
                  </span>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="hide-scrollbar part-thumb-row" style={{ display: 'flex', gap: '0.8rem', overflowX: 'auto', paddingBottom: '0.8rem', marginBottom: '2rem' }}>
                {images.map((src, i) => (
                  <button key={i} onClick={() => { setActiveImg(i); setZoomed(false); }}
                    style={{ flexShrink: 0, width: 85, height: 85, borderRadius: '18px', overflow: 'hidden', border: '3.5px solid', borderColor: activeImg === i ? '#1E3A8A' : 'transparent', cursor: 'pointer', padding: 0, position: 'relative', transition: 'all 0.3s', background: '#F5F5F5', opacity: activeImg === i ? 1 : 0.7, boxShadow: activeImg === i ? '0 8px 20px rgba(30, 58, 138, 0.2)' : 'none' }}
                    onMouseEnter={e => { if (activeImg !== i) e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={e => { if (activeImg !== i) e.currentTarget.style.opacity = '0.6'; }}>
                    {isVideoUrl(src) ? (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
                        <span style={{ color: 'white', fontSize: '1.5rem' }}>▶</span>
                      </div>
                    ) : (
                      <img src={src} alt={`Thumb ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Description */}
            {part.description && (
              <div style={{ marginTop: '0.8rem', background: '#FFF', border: '1px solid #EEE', borderRadius: '20px', padding: '1.2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                <h3 style={{ color: '#0F172A', fontFamily: 'Rajdhani, sans-serif', fontSize: '1.4rem', fontWeight: 950, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: 6, height: 24, background: '#1E3A8A', borderRadius: '4px' }} />
                  Component Overview
                </h3>
                <p style={{ color: '#555', lineHeight: 1.6, fontSize: '0.95rem', fontWeight: 500 }}>{part.description}</p>
              </div>
            )}
          </div>

          {/* Right: Product Details */}
          <div style={{ position: 'sticky', top: 100 }}>
            <div style={{ background: '#FFF', border: '1px solid #EEE', borderRadius: '20px', padding: '1.2rem', marginBottom: '1.2rem', boxShadow: '0 10px 40px rgba(0,0,0,0.03)' }}>
            
            {/* Header */}
            <div style={{ marginBottom: '0.3rem' }}>
              <h1 className="text-2xl lg:text-3xl font-extrabold font-rajdhani tracking-tight leading-tight" style={{ color: '#1E3A8A', fontWeight: 800 }}>
                {part.name}
              </h1>
            </div>
            <div className="text-blue-600 font-extrabold mb-3 tracking-widest text-xs uppercase">{part.brand || 'GK Motors Genuine'}</div>

            {/* Ratings Section */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={18} className={i < Math.floor(part.ratings || 4.5) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                ))}
              </div>
              <span className="text-sm text-gray-400 font-medium ml-1">({part.numReviews || 12} Reviews)</span>
            </div>

            {/* Pricing Section */}
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-gray-900">
                  ₹{effectivePrice?.toLocaleString('en-IN')}
                </span>
                {effectiveOriginal > effectivePrice && (
                  <span className="text-lg text-gray-400 line-through font-medium">MRP: ₹{effectiveOriginal?.toLocaleString('en-IN')}</span>
                )}
              </div>
              {effectiveOriginal > effectivePrice && (
                 <div className="mt-2 text-right">
                   <span className="text-blue-600 text-xs font-black bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 uppercase tracking-tight">
                     OFFER: SAVE ₹{(effectiveOriginal - effectivePrice).toLocaleString('en-IN')} ({discount}% OFF)
                   </span>
                 </div>
              )}
            </div>

            {/* Pincode Check */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Pincode <span className="text-red-500">*</span>:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={selectedPincode}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  placeholder="Enter Pincode"
                  maxLength={6}
                  className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl px-4 font-bold transition-all focus:outline-none focus:border-blue-600 focus:bg-white"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                   {selectedPincode.length === 6 && (
                     !isUnavailable ? <div className="p-1 bg-blue-600 rounded-full text-white"><Check size={14} /></div> : <AlertCircle size={20} className="text-red-500" />
                   )}
                </div>
              </div>
              
              {/* Feedback messages */}
              <div className="mt-2 text-xs space-y-1">
                {selectedPincode.length === 6 && !isUnavailable && (
                  <>
                    <p className="text-gray-900 font-medium">Location: <span className="text-gray-500">{pincodeRule?.location || 'Your Area'}</span></p>
                    <p className="text-emerald-600 font-bold">Availability: <span className="font-bold">Available (Qty {effectiveStock})</span></p>
                  </>
                )}
                {isUnavailable && <p className="text-red-500 font-bold uppercase tracking-tight">Service unavailable for this Pincode</p>}
                {isCheckingPincode && <p className="text-amber-600 font-medium flex items-center gap-1"><Clock size={12} className="animate-spin" /> Checking service...</p>}
              </div>
            </div>

            {/* Pack Size / Variants */}
            {availableSizes.length > 0 && (
              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-900 mb-3 uppercase tracking-tight">
                  Select Pack Size:
                </label>
                <div className="flex flex-wrap gap-3">
                  {availableSizes.map((variant, index) => {
                    const isSelected = selectedSize && normalizeSize(selectedSize.size) === normalizeSize(variant.size);
                    const oos = variant.inventory <= 0 && !isCheckingPincode;
                    
                    return (
                      <button
                        key={index}
                        disabled={oos}
                        onClick={() => { userPickedSize.current = true; setSelectedSize(variant); }}
                        style={{ height: 36, padding: '0 1rem', borderRadius: '8px', border: '1px solid', fontWeight: 700, fontSize: '0.7rem', transition: 'all 0.2s', cursor: oos ? 'not-allowed' : 'pointer', opacity: oos ? 0.4 : 1, background: isSelected ? '#EFF6FF' : '#FFF', borderColor: isSelected ? '#93C5FD' : '#D1D5DB', color: isSelected ? '#172554' : '#111' }}
                      >
                        {variant.size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CTA Action Bar */}
            <div style={{ marginBottom: '1.5rem' }}>
              {cartItem ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#F8FAFC', padding: '1rem', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                  <button onClick={() => updateQty(id, cartItem.quantity - 1)}
                    style={{ width: 44, height: 44, borderRadius: '12px', border: 'none', background: '#1E3A8A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.4rem', fontWeight: 950 }}>-</button>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: '0.2rem', fontFamily: 'Rajdhani, sans-serif' }}>Qty in Cart</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: 950, color: '#0F172A', fontFamily: 'Rajdhani, sans-serif', lineHeight: 1 }}>{cartItem.quantity}</span>
                  </div>
                  <button onClick={() => updateQty(id, cartItem.quantity + 1)}
                    style={{ width: 44, height: 44, borderRadius: '12px', border: 'none', background: '#1E3A8A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.4rem', fontWeight: 950 }}>+</button>
                </div>
              ) : (
                 <button disabled={isUnavailable || effectiveStock === 0} onClick={handleAddToCart}
                  className="btn-primary" style={{ width: '100%', height: '60px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 950, background: isUnavailable || effectiveStock === 0 ? '#E2E8F0' : '#1E3A8A', color: isUnavailable || effectiveStock === 0 ? '#94A3B8' : 'white', cursor: isUnavailable || effectiveStock === 0 ? 'not-allowed' : 'pointer', justifyContent: 'center', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.1em', boxShadow: isUnavailable || effectiveStock === 0 ? 'none' : '0 12px 30px rgba(30, 58, 138, 0.2)' }}>
                  <ShoppingCart size={22} /> {effectiveStock === 0 ? 'OUT OF STOCK' : 'ADD TO CART'}
                </button>
              )}
            </div>
            </div>{/* close card div */}
          </div>{/* close sticky right div */}
        </div>{/* close grid */}

        {/* Similar Products */}
        {similar.length > 0 && (
          <div style={{ marginTop: '4rem', marginBottom: '4rem', borderTop: '1px solid #EEE', paddingTop: '3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2rem', fontWeight: 950, color: '#0F172A', letterSpacing: '0.02em' }}>RECOMMENDED <span style={{ color: '#1E3A8A' }}>SPARES</span></h3>
              <Link to="/parts" style={{ color: '#1E3A8A', fontWeight: 900, fontSize: '0.95rem', textDecoration: 'none', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.05em' }}>EXPLORE ALL</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {similar.map(p => <PartCard key={p._id || p.id} part={p} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


