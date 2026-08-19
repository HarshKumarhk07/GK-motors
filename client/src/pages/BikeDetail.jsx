import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBike, enquireBike } from '../api/bikeApi';
import { toggleWishlist } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import { Heart, Phone, MessageCircle, MapPin, Calendar, Gauge, Zap, CheckCircle, ArrowLeft, Eye, Share2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, X as XIcon } from 'lucide-react';

const isVideo = (url = '') => /\.(mp4|mov|webm|ogg|m4v)(\?.*)?$/i.test(url) || url.includes('/video/upload/');

export default function BikeDetail() {
  const { id } = useParams();
  const { user, wishlist = [], toggleWishlist: toggleWishlistCtx } = useAuth();
  const wishlisted = user && Array.isArray(wishlist) && wishlist.includes(id);
  const navigate = useNavigate();
  const [bike, setBike] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [enquiryMsg, setEnquiryMsg] = useState('');
  const [enquiryPhone, setEnquiryPhone] = useState('');
  const [zoomed, setZoomed] = useState(false);
  const [fullScreenZoom, setFullScreenZoom] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const isMobile = typeof window !== 'undefined' && window.matchMedia("(pointer: coarse)").matches;
  const [enquirySending, setEnquirySending] = useState(false);

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

  useEffect(() => {
    getBike(id).then(({ data }) => {
      setBike(data.bike);
    }).catch(() => navigate('/bikes'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleWishlist = async () => {
    if (!user) { toast.error('Please login first to wishlist this item'); return; }
    try {
      toggleWishlistCtx(id);
      toast.success(wishlisted ? 'Removed from wishlist' : 'Added to wishlist');
    } catch { toast.error('Failed'); }
  };

  const handleEnquire = async () => {
    if (!user) { toast.error('Please login first to enquire about this bike'); return; }
    if (!enquiryPhone) { toast.error('Please enter your phone number'); return; }
    setEnquirySending(true);
    try {
      await enquireBike(id, { message: enquiryMsg, phone: enquiryPhone });
      toast.success('Enquiry sent! Seller will contact you.');
      setEnquiryMsg('');
      // Refresh bike data to show status
      const { data } = await getBike(id);
      setBike(data.bike);
    } catch { toast.error('Failed to send enquiry'); }
    finally { setEnquirySending(false); }
  };

  if (loading) return <PageLoader />;
  if (!bike) return null;

  // Media array — images and videos stored together in upload order
  const media = bike.images?.length ? bike.images : ['https://via.placeholder.com/800x500/1A1A1A/E53935?text=Bike+Image'];

  // Pincode pricing logic
  const pincodeData = bike.pincodePricing?.find(p => p.pincode === selectedPincode.trim()) || null;
  const effectivePrice = pincodeData ? Number(pincodeData.price) : (bike.discountedPrice || bike.price);
  const effectiveOriginalPrice = pincodeData?.originalPrice ? Number(pincodeData.originalPrice) : bike.price;
  const effectiveLocation = pincodeData?.location || bike.location?.city;

  const discount = effectiveOriginalPrice && effectiveOriginalPrice > effectivePrice
    ? Math.round(((effectiveOriginalPrice - effectivePrice) / effectiveOriginalPrice) * 100)
    : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      <style>{`
        @media (max-width: 768px) {
          .bike-detail-grid { grid-template-columns: 1fr !important; }
          .bike-detail-grid > div:last-child { position: static !important; }
          .main-detail-img { height: 400px !important; object-fit: contain !important; padding: 1rem !important; width: 100% !important; }
          .bike-specs-grid { grid-template-columns: 1fr 1fr !important; }
          .bike-detail-grid h1 { font-size: 1.4rem !important; }
          .bike-price-text { font-size: 2rem !important; }
          .bike-thumb-row { gap: 0.4rem !important; flex-wrap: wrap !important; }
          .bike-thumb-row button { width: 50px !important; height: 50px !important; border-radius: 8px !important; }
          .bike-nav-right { right: 12px !important; }
        }
      `}</style>
      {/* Breadcrumb */}
      <div style={{ background: '#F9F9F9', borderBottom: '1px solid #EEE', padding: '0.8rem 0' }}>
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-2" style={{ fontSize: '0.9rem', color: '#666', fontWeight: 600 }}>
          <button onClick={() => navigate('/bikes')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#111'}
            onMouseLeave={e => e.currentTarget.style.color = '#666'}>
            <ArrowLeft size={16} /> Back to Showroom
          </button>
          <span>/</span>
          <span style={{ color: '#1E3A8A', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{bike.brand} {bike.model}</span>
        </div>
      </div>
 
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="animate-fadeInUp bike-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
 
          {/* Left: Media & Details */}
          <div>
            {/* Fullscreen Zoom Modal */}
            {fullScreenZoom && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(10px)' }}
                onClick={() => setFullScreenZoom(false)}>
                <img src={media[selectedImage]} alt={bike.title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                <button style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <XIcon size={24} />
                </button>
              </div>
            )}

            {/* Main Image/Video */}
            <div style={{ position: 'relative', background: '#F5F5F5', borderRadius: '20px', overflow: 'hidden', marginBottom: '1rem', border: '1px solid #EEE', boxShadow: '0 8px 30px rgba(0,0,0,0.03)', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isVideo(media[selectedImage]) ? 'default' : 'crosshair' }}
              onMouseMove={e => { if (!zoomed) return; const r = e.currentTarget.getBoundingClientRect(); setMousePos({ x: ((e.pageX - r.left) / r.width) * 100, y: ((e.pageY - r.top) / r.height) * 100 }); }}
              onMouseLeave={() => setZoomed(false)}
              onClick={() => isMobile && !isVideo(media[selectedImage]) && setFullScreenZoom(true)}>
              {/* Wishlist Floating Button */}
              <button onClick={(e) => { e.stopPropagation(); handleWishlist(); }}
                style={{ position: 'absolute', top: '15px', right: '15px', width: '42px', height: '42px', borderRadius: '50%', background: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, boxShadow: '0 4px 15px rgba(0,0,0,0.1)', transition: 'transform 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                <Heart size={20} fill={wishlisted ? '#EF4444' : 'none'} color={wishlisted ? '#EF4444' : '#0F172A'} strokeWidth={2.5} />
              </button>

              {/* Discount badge */}
              {discount > 0 && (
                <div style={{ position: 'absolute', top: 15, left: 15, zIndex: 10 }}>
                  <span style={{ background: '#0F172A', color: 'white', fontSize: '0.65rem', fontWeight: 900, padding: '5px 12px', borderRadius: '10px', letterSpacing: '0.06em' }}>{discount}% OFF</span>
                </div>
              )}

              {isVideo(media[selectedImage]) ? (
                <video
                  key={media[selectedImage]}
                  src={media[selectedImage]}
                  controls autoPlay muted playsInline
                  className="main-detail-img"
                  style={{ width: '100%', height: 420, objectFit: 'contain', background: '#000' }}
                />
              ) : (
                <img src={media[selectedImage]} alt={bike.title}
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
              {!isVideo(media[selectedImage]) && !isMobile && (
                <button onClick={(e) => { e.stopPropagation(); setZoomed(!zoomed); }}
                  style={{ position: 'absolute', bottom: 15, right: 15, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '14px', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', backdropFilter: 'blur(8px)', zIndex: 10 }}>
                  {zoomed ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
                </button>
              )}

              {/* Fullscreen button (mobile) */}
              {isMobile && !isVideo(media[selectedImage]) && (
                <button onClick={() => setFullScreenZoom(true)}
                  style={{ position: 'absolute', bottom: 15, right: 15, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '14px', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', zIndex: 10 }}>
                  <Maximize2 size={18} />
                </button>
              )}

              {/* Navigation Arrows */}
              {media.length > 1 && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); setSelectedImage((selectedImage - 1 + media.length) % media.length); setZoomed(false); }}
                    style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', opacity: 0.6, transition: 'opacity 0.2s', zIndex: 10 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
                    <ChevronLeft size={20} />
                  </button>
                  <button className="bike-nav-right" onClick={(e) => { e.stopPropagation(); setSelectedImage((selectedImage + 1) % media.length); setZoomed(false); }}
                    style={{ position: 'absolute', right: 60, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', opacity: 0.6, transition: 'opacity 0.2s', zIndex: 10 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {media.length > 1 && (
              <div className="hide-scrollbar bike-thumb-row" style={{ display: 'flex', gap: '0.8rem', overflowX: 'auto', paddingBottom: '0.8rem', marginBottom: '2rem' }}>
                {media.map((src, i) => (
                  <button key={i} onClick={() => { setSelectedImage(i); setZoomed(false); }}
                    style={{ flexShrink: 0, width: 85, height: 85, borderRadius: '16px', overflow: 'hidden', border: '3px solid', borderColor: selectedImage === i ? '#1E3A8A' : 'transparent', cursor: 'pointer', padding: 0, position: 'relative', transition: 'all 0.3s', background: '#F5F5F5', opacity: selectedImage === i ? 1 : 0.7, boxShadow: selectedImage === i ? '0 6px 15px rgba(30, 58, 138, 0.2)' : 'none' }}
                    onMouseEnter={e => { if (selectedImage !== i) e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={e => { if (selectedImage !== i) e.currentTarget.style.opacity = '0.6'; }}>
                    {isVideo(src) ? (
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
 
            {/* Specifications */}
            {bike.specifications && Object.keys(bike.specifications).some(k => bike.specifications[k]) && (
              <div style={{ marginTop: '0.8rem', background: '#FFF', border: '1px solid #EEE', borderRadius: '20px', padding: '1.2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                <h3 style={{ color: '#0F172A', fontFamily: 'Rajdhani, sans-serif', fontSize: '1.4rem', fontWeight: 950, marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: 6, height: 24, background: '#1E3A8A', borderRadius: '4px' }} />
                  Technical Specifications
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  {Object.entries(bike.specifications || {}).map(([key, value]) => value && (
                    <div key={key} style={{ padding: '0.6rem 0.8rem', background: '#F9F9F9', borderRadius: '10px', border: '1px solid #EEE' }}>
                      <div style={{ color: '#888', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.2rem' }}>{key}</div>
                      <div style={{ color: '#111', fontWeight: 700, fontSize: '0.85rem' }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
 
            {/* Description */}
            {bike.description && (
              <div style={{ marginTop: '1.2rem', background: '#FFF', border: '1px solid #EEE', borderRadius: '20px', padding: '1.2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                <h3 style={{ color: '#0F172A', fontFamily: 'Rajdhani, sans-serif', fontSize: '1.4rem', fontWeight: 950, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: 6, height: 24, background: '#1E3A8A', borderRadius: '4px' }} />
                  Vehicle Overview
                </h3>
                <p style={{ color: '#555', lineHeight: 1.6, fontSize: '0.95rem', fontWeight: 500 }}>{bike.description}</p>
              </div>
            )}
          </div>
 
          {/* Right: Info & Actions */}
          <div style={{ position: 'sticky', top: 100 }}>
            <div style={{ background: '#FFF', border: '1px solid #EEE', borderRadius: '20px', padding: '1.2rem', marginBottom: '1.2rem', boxShadow: '0 10px 40px rgba(0,0,0,0.03)' }}>
              {/* Status badges */}
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                <span className={`badge ${bike.type === 'new' ? 'badge-green' : 'badge-blue'}`} style={{ fontWeight: 800, fontSize: '0.6rem' }}>{bike.type === 'new' ? 'NEW' : 'CERTIFIED'}</span>
              </div>
 
              <h1 style={{ color: '#0F172A', fontFamily: 'Rajdhani, sans-serif', fontSize: '2.4rem', fontWeight: 950, marginBottom: '0.6rem', lineHeight: 1, letterSpacing: '0.01em' }}>
                {bike.brand} {bike.model}
              </h1>
 
              <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
                  <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.8rem', fontWeight: 950, color: '#1E3A8A', lineHeight: 1 }}>
                    ₹{effectivePrice?.toLocaleString('en-IN')}
                  </div>
                  {discount > 0 && (
                    <div style={{
                      background: 'rgba(30, 58, 138, 0.1)', color: '#1E3A8A',
                      fontSize: '0.8rem', fontWeight: 900,
                      padding: '2px 8px', borderRadius: '6px',
                      fontFamily: 'Rajdhani, sans-serif'
                    }}>
                      {discount}% OFF
                    </div>
                  )}
                </div>
                {discount > 0 && (
                  <div style={{ color: '#AAA', fontSize: '0.9rem', textDecoration: 'line-through', marginTop: '0.2rem', fontWeight: 700 }}>
                    MRP: ₹{effectiveOriginalPrice?.toLocaleString('en-IN')}
                  </div>
                )}
              </div>
 
              {/* Key Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.5rem' }}>
                {[
                  { icon: Calendar, label: 'Year', value: bike.year },
                  { icon: Gauge, label: 'Mileage', value: `${bike.kmDriven?.toLocaleString()} km` },
                  { icon: Zap, label: 'Engine', value: `${bike.engineCC || '-'} cc` },
                  { icon: MapPin, label: 'Location', value: effectiveLocation || 'N/A' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} style={{ padding: '0.6rem 0.8rem', background: '#F9F9F9', borderRadius: '12px', border: '1px solid #EEE' }}>
                    <div style={{ color: '#888', fontSize: '0.65rem', marginBottom: '0.2rem', fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ color: '#0F172A', fontWeight: 900, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'Rajdhani, sans-serif' }}>
                      <Icon size={16} style={{ color: '#1E3A8A' }} /> {value}
                    </div>
                  </div>
                ))}
              </div>
 
              <div style={{ color: '#AAA', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.2rem', paddingLeft: '0.2rem' }}>
                <Eye size={14} /> {bike.views} views
              </div>
 
              {/* Enquiry */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ marginBottom: '0.6rem' }}>
                  <label style={{ color: '#888', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.3rem', display: 'block', paddingLeft: '0.2rem' }}>PHONE NUMBER *</label>
                  <input
                    type="tel"
                    placeholder="Mobile Number"
                    value={enquiryPhone}
                    onChange={e => setEnquiryPhone(e.target.value)}
                    className="input-light"
                    style={{ borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, padding: '0.6rem', height: '42px' }}
                  />
                </div>
                <label style={{ color: '#888', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.3rem', display: 'block', paddingLeft: '0.2rem' }}>MESSAGE</label>
                <textarea
                  placeholder="Ask about availability, price, etc..."
                  value={enquiryMsg}
                  onChange={e => setEnquiryMsg(e.target.value)}
                  rows={2}
                  className="input-light"
                  style={{ borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, padding: '0.6rem' }}
                />
              </div>

              {/* Status if already enquired */}
              {bike.userEnquiry && (
                <div style={{ marginBottom: '1.2rem', padding: '1rem', background: 'rgba(30, 58, 138, 0.05)', border: '1px solid rgba(30, 58, 138, 0.1)', borderRadius: '14px' }}>
                  <div style={{ color: '#1E3A8A', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '0.3rem', letterSpacing: '0.1em' }}>ENQUIRY STATUS</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0F172A', fontWeight: 900, fontSize: '1rem', fontFamily: 'Rajdhani, sans-serif' }}>
                    <CheckCircle size={16} style={{ color: '#10B981' }} /> 
                    {bike.userEnquiry.status?.toUpperCase() || 'REQUESTED'}
                  </div>
                </div>
              )}
 
              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <button onClick={handleEnquire} disabled={enquirySending} className="btn-primary" style={{ height: '56px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 950, background: '#1E3A8A', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.1em' }}>
                  <MessageCircle size={22} /> {enquirySending ? 'SENDING...' : 'ENQUIRE NOW'}
                </button>
                {bike.seller?.phone && (
                  <a href={`tel:${bike.seller.phone}`} className="btn-outline" style={{ height: '56px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 900, background: '#FFF', color: '#0F172A', border: '2px solid #E2E8F0', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Rajdhani, sans-serif' }}>
                    <Phone size={20} /> CALL SELLER
                  </a>
                )}
              </div>
            </div>
 
            {/* Seller Info Card */}
            {bike.seller && (
              <div className="animate-fadeIn" style={{ background: '#F9F9F9', border: '1px solid #EEE', borderRadius: '20px', padding: '1.5rem', animationDelay: '0.3s' }}>
                <p style={{ color: '#888', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.2rem' }}>LISTED BY</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '16px', background: '#1E3A8A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 950, color: 'white', fontSize: '1.5rem', boxShadow: '0 8px 20px rgba(30, 58, 138, 0.2)', fontFamily: 'Rajdhani, sans-serif' }}>
                    {bike.seller.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color: '#111', fontWeight: 800, fontSize: '1.1rem' }}>{bike.seller.name}</div>
                    <div style={{ color: '#2E7D32', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, marginTop: '0.2rem' }}>
                      <CheckCircle size={14} /> CERTIFIED PARTNER
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

