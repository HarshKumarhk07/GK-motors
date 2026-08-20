import { useCart, useServiceCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, CreditCard, Truck, Shield, ChevronRight, User, Phone, MapPin, X, Check, Home as HomeIcon, Briefcase, Wrench, ArrowRight } from 'lucide-react';
import { placeOrder, createPartPayment, verifyPartPayment } from '../api/storeApi';
import { addAddress } from '../api/authApi';
import CheckoutModal from '../components/service/CheckoutModal';
import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default leaflet marker icon
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const isDeliverableAtPincode = (items, pincode) => {
  if (!pincode || pincode.length !== 6) return true; // no pincode set — allow
  return items.every(item =>
    !Array.isArray(item.pincodePricing) ||
    item.pincodePricing.length === 0 ||
    item.pincodePricing.some(p => p.pincode === pincode)
  );
};

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const StepIndicator = ({ step }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: '2.5rem' }}>
    {[{ n: 1, label: 'Cart' }, { n: 2, label: 'Delivery' }].map(({ n, label }, idx) => (
      <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: step >= n ? '#1E3A8A' : '#1E293B',
            border: `2px solid ${step >= n ? '#1E3A8A' : '#334155'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '0.9rem', color: step >= n ? 'white' : '#64748B',
            fontFamily: 'Rajdhani, sans-serif',
            boxShadow: step === n ? '0 0 25px rgba(30, 58, 138, 0.4)' : 'none',
            transition: 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}>{n}</div>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: step >= n ? '#1E3A8A' : '#64748B', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif' }}>{label}</span>
        </div>
        {idx === 0 && (
          <div style={{ width: 80, height: 2, background: step >= 2 ? '#1E3A8A' : '#F1F5F9', margin: '0 0.5rem', marginBottom: '1.4rem', transition: 'background 0.4s' }} />
        )}
      </div>
    ))}
  </div>
);

export default function Cart() {
  const { items, removeFromCart, updateQty, clearCart, total, totalOriginal, itemCount } = useCart();
  const { car, services, totalAmount: serviceTotal, serviceCount } = useServiceCart();
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [placing, setPlacing] = useState(false);
  const [showServiceCheckout, setShowServiceCheckout] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showAddressMenu, setShowAddressMenu] = useState(false);
  const [markerPos, setMarkerPos] = useState({ lat: 12.8966, lng: 77.7061 });
  const [resolvedAddress, setResolvedAddress] = useState('');
  const savedPincode = localStorage.getItem('selectedPincode') || '';
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: { paymentMethod: 'cod', pincode: savedPincode }
  });
  const paymentMethod = watch('paymentMethod');
  const watchedPincode = watch('pincode', savedPincode);

  useEffect(() => {
    if (user?.addresses?.length && !watch('street')) {
      const first = user.addresses[0];
      setValue('name', user.name || '');
      setValue('phone', user.phone || '');
      setValue('street', first.street || '');
      setValue('city', first.city || '');
      if (first.pincode) setValue('pincode', first.pincode);
    } else if (user && !watch('name')) {
      setValue('name', user.name || '');
      setValue('phone', user.phone || '');
    }
  }, [user, setValue, watch]);

  const handleOrder = async (data) => {
    if (!user) { toast.error('Login to place order'); return; }
    if (!isDeliverableAtPincode(items, data.pincode)) {
      toast.error('One or more items are not deliverable to this pincode');
      return;
    }
    setPlacing(true);
    try {
      const shippingCharge = total > 500 ? 0 : 50;
      const orderRes = await placeOrder({
        items: items.map(i => ({ product: i._id, quantity: i.quantity, price: i.effectivePrice ?? i.discountedPrice ?? i.price })),
        deliveryAddress: { street: data.street, city: data.city, state: data.state || data.city || 'State', pincode: data.pincode },
        payment: { method: data.paymentMethod },
        totalAmount: total + shippingCharge,
      });

      // Auto-save address to user profile if user has no saved addresses
      if (user && (!user.addresses || user.addresses.length === 0)) {
        addAddress({
          label: 'Home',
          street: data.street,
          city: data.city,
          state: data.state || data.city || 'State',
          pincode: data.pincode,
        }).then(({ data: addrData }) => {
          if (addrData?.addresses && updateUser) {
            updateUser({ addresses: addrData.addresses });
          }
        }).catch(() => {});
      }

      if (data.paymentMethod === 'online') {
        const loaded = await loadRazorpay();
        if (!loaded) { toast.error('Payment gateway failed to load'); setPlacing(false); return; }

        const payRes = await createPartPayment(orderRes.data.order._id);
        const rzpOrder = payRes.data.order;
        const rzpKey = import.meta.env.VITE_RAZORPAY_KEY_ID || payRes.data.key || payRes.data.keyId;

        await new Promise((resolve, reject) => {
          const rzp = new window.Razorpay({
            key: rzpKey,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency || 'INR',
            name: 'GK Motors', description: 'Premium Showroom Order',
            order_id: rzpOrder.id,
            prefill: { name: user.name, email: user.email, contact: user.phone || '' },
            theme: { color: '#1E3A8A' },
            handler: async (response) => {
              try {
                await verifyPartPayment(orderRes.data.order._id, {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                });
                resolve();
              } catch (err) { reject(err); }
            },
            modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
          });
          rzp.open();
        });
      }

      clearCart();
      toast.success('Order placed successfully!');
      navigate('/my-orders');
    } catch (err) {
      toast.error(err.message === 'Payment cancelled' ? 'Payment cancelled' : err.response?.data?.message || 'Order failed');
    } finally { setPlacing(false); }
  };

  if (items.length === 0) {
    if (serviceCount > 0) {
      return (
        <div style={{ minHeight: '80vh', background: '#FFFFFF', padding: '3rem 1rem' }}>
          <div className="max-w-3xl mx-auto">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
              <button onClick={() => navigate('/services')}
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0.6rem 1.2rem', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'Rajdhani, sans-serif' }}>
                <ArrowLeft size={16} /> Services
              </button>
              <h1 style={{ color: '#0F172A', fontFamily: 'Rajdhani, sans-serif', fontSize: '2.2rem', fontWeight: 900, margin: 0, letterSpacing: '0.04em' }}>
                SERVICE <span style={{ color: '#1E3A8A' }}>BOOKING CART</span>
              </h1>
            </div>

            <div style={{ background: '#FFF', border: '1.5px solid #E2E8F0', borderRadius: '24px', padding: '2rem', boxShadow: '0 10px 40px rgba(0,0,0,0.04)' }}>
              {car && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1.5rem', borderBottom: '1px solid #F1F5F9', marginBottom: '1.5rem' }}>
                  <div style={{ width: 50, height: 50, borderRadius: '14px', background: 'rgba(30, 58, 138, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E3A8A' }}>
                    <Wrench size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'Rajdhani, sans-serif' }}>Selected Vehicle</span>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#0F172A', fontFamily: 'Rajdhani, sans-serif' }}>
                      {car.brand} {car.model} {car.year && `(${car.year})`} {car.fuelType && `• ${car.fuelType.toUpperCase()}`}
                    </h3>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'Rajdhani, sans-serif', display: 'block', marginBottom: '0.8rem' }}>Selected Packages ({serviceCount})</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {services.map((s) => (
                    <div key={s.serviceId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.2rem', background: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0F172A', fontFamily: 'Rajdhani, sans-serif' }}>{s.name}</h4>
                        {s.categoryName && <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>{s.categoryName}</p>}
                      </div>
                      <span style={{ fontSize: '1.2rem', fontWeight: 950, color: '#1E3A8A', fontFamily: 'Rajdhani, sans-serif' }}>
                        ₹{Number(s.price).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.2rem', background: 'linear-gradient(135deg, rgba(30,58,138,0.06) 0%, rgba(15,23,42,0.02) 100%)', borderRadius: '16px', border: '1px solid rgba(30,58,138,0.15)', marginBottom: '2rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'Rajdhani, sans-serif' }}>Total Estimate</span>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>Doorstep pickup & inspection included</p>
                </div>
                <span style={{ fontSize: '1.8rem', fontWeight: 950, color: '#1E3A8A', fontFamily: 'Rajdhani, sans-serif' }}>
                  ₹{Number(serviceTotal).toLocaleString('en-IN')}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    if (!user) {
                      toast.error('Please login to complete your booking');
                      navigate('/login?redirect=/cart');
                      return;
                    }
                    setShowServiceCheckout(true);
                  }}
                  style={{ flex: 1, minWidth: '220px', background: 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)', color: 'white', border: 'none', padding: '1rem 2rem', borderRadius: '14px', fontWeight: 900, cursor: 'pointer', textAlign: 'center', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.08em', fontSize: '1rem', boxShadow: '0 8px 25px rgba(30, 58, 138, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.3s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <Wrench size={18} /> PROCEED TO CHECKOUT & SCHEDULE SLOT
                </button>
                <Link to="/parts"
                  style={{ background: '#FFF', color: '#0F172A', border: '1.5px solid #E2E8F0', padding: '1rem 1.8rem', borderRadius: '14px', fontWeight: 800, textDecoration: 'none', textAlign: 'center', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.95rem' }}>
                  BROWSE SPARE PARTS
                </Link>
              </div>
            </div>
          </div>
          <CheckoutModal open={showServiceCheckout} onClose={() => setShowServiceCheckout(false)} />
        </div>
      );
    }

    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', gap: '2rem', padding: '2rem' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ width: 140, height: 140, borderRadius: '40px', background: '#F9F9F9', border: '1.5px solid #EEE', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-5deg)' }}>
            <ShoppingBag size={56} style={{ color: '#DDD' }} />
          </div>
          <div style={{ position: 'absolute', top: -10, right: -10, width: 44, height: 44, background: '#111', color: 'white', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 900, fontFamily: 'Rajdhani, sans-serif', boxShadow: '0 8px 25px rgba(0,0,0,0.15)' }}>0</div>
        </div>
        <div style={{ textAlign: 'center', maxWidth: '420px' }}>
          <h2 style={{ color: '#111', fontSize: '2.5rem', fontWeight: 950, fontFamily: 'Rajdhani, sans-serif', letterSpacing: '-0.02em', margin: 0, textTransform: 'uppercase' }}>YOUR CART IS EMPTY</h2>
          <p style={{ color: '#666', marginTop: '0.6rem', fontSize: '1.05rem', fontWeight: 600 }}>Explore our certified car services or premium spare parts to get started.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/services" style={{ background: '#1E3A8A', color: 'white', padding: '1rem 2.2rem', borderRadius: '16px', fontWeight: 950, textDecoration: 'none', fontSize: '0.95rem', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.08em', boxShadow: '0 12px 30px rgba(30, 58, 138, 0.25)', transition: 'all 0.4s' }}>
            BOOK A SERVICE
          </Link>
          <Link to="/parts" style={{ background: '#0F172A', color: 'white', padding: '1rem 2.2rem', borderRadius: '16px', fontWeight: 950, textDecoration: 'none', fontSize: '0.95rem', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.08em', boxShadow: '0 12px 30px rgba(15, 23, 42, 0.2)', transition: 'all 0.4s' }}>
            SHOP SPARE PARTS
          </Link>
        </div>
      </div>
    );
  }

  const shippingCharge = total > 500 ? 0 : 50;
  const grandTotal = total + shippingCharge;

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      <style>{`
        @media (max-width: 768px) {
          .cart-layout { grid-template-columns: 1fr !important; gap: 1.5rem !important; }
          .cart-item-grid { grid-template-columns: 80px 1fr !important; gap: 0.75rem !important; }
          .cart-item-grid > div:last-child { grid-column: 1 / -1; }
          .cart-addr-grid { grid-template-columns: 1fr !important; }
          .cart-addr-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
      {/* Top blue accent line */}
      <div style={{ height: '5px', background: 'linear-gradient(90deg, #1E3A8A, #93C5FD, transparent)' }} />
 
      <div className="max-w-[1220px] mx-auto px-4" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
 
        {/* Back + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', marginBottom: '2.5rem' }}>
          <button onClick={() => navigate('/')}
            style={{ background: '#F9F9F9', border: '1.5px solid #EEE', borderRadius: '10px', padding: '0.6rem 1.2rem', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 700, transition: 'all 0.25s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#111'; e.currentTarget.style.color = '#111'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#EEE'; e.currentTarget.style.color = '#666'; }}>
            <ArrowLeft size={16} /> Back to Store
          </button>
          <div>
            <h1 style={{ color: '#0F172A', fontFamily: 'Rajdhani, sans-serif', fontSize: '2.2rem', fontWeight: 900, margin: 0, letterSpacing: '0.04em' }}>
              YOUR <span style={{ color: '#1E3A8A' }}>CART</span>
            </h1>
            <p style={{ color: '#888', margin: 0, fontSize: '0.95rem', fontWeight: 500 }}>{itemCount} items ready for checkout</p>
          </div>
        </div>
 
        {/* Step indicator */}
        <StepIndicator step={step} />
 
        <div className="animate-fadeIn cart-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 520px', gap: '3rem', alignItems: 'start' }}>
 
          {/* ── Cart Items ── */}
          <div className="animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
            {serviceCount > 0 && (
              <div style={{ background: 'rgba(30, 58, 138, 0.05)', border: '1.5px solid rgba(30, 58, 138, 0.15)', borderRadius: '16px', padding: '1rem 1.4rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#1E3A8A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wrench size={18} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', fontFamily: 'Rajdhani, sans-serif' }}>
                      Active Service Booking ({serviceCount} package{serviceCount > 1 ? 's' : ''})
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                      {car ? `${car.brand} ${car.model}` : 'Vehicle Service'} • ₹{Number(serviceTotal).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!user) {
                      toast.error('Please login to complete your booking');
                      navigate('/login?redirect=/cart');
                      return;
                    }
                    setShowServiceCheckout(true);
                  }}
                  style={{ background: '#1E3A8A', color: 'white', border: 'none', cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 800, fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  CHECKOUT SERVICE <ArrowRight size={14} />
                </button>
              </div>
            )}
            {items.map((item) => {
              const itemPrice = item.effectivePrice ?? item.discountedPrice ?? item.price;
              const saved = item.price > itemPrice ? item.price - itemPrice : 0;
              return (
                <div key={item._id} className="cart-item-grid" style={{
                  display: 'grid', gridTemplateColumns: '110px 1fr auto',
                  gap: '1.5rem', background: '#FFF',
                  border: '1px solid #EEE', borderRadius: '20px',
                  padding: '1.2rem', marginBottom: '1rem',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
                  transition: 'all 0.3s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#111'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#EEE'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.02)'; }}>
 
                  {/* Thumbnail */}
                  <Link to={item.type === 'bike' ? `/bikes/${item._id}` : `/parts/${item._id}`} style={{ display: 'block', borderRadius: '14px', overflow: 'hidden', height: 110, flexShrink: 0, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <img src={item.images?.[0] || 'https://via.placeholder.com/110x110/F1F5F9/2563EB?text=Item'}
                      alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  </Link>
 
                  {/* Info */}
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Link to={item.type === 'bike' ? `/bikes/${item._id}` : `/parts/${item._id}`} style={{ textDecoration: 'none' }}>
                      <h3 style={{ color: '#111', fontWeight: 800, fontSize: '1.1rem', margin: '0 0 0.3rem', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.02em', textTransform: 'uppercase' }}>{item.name}</h3>
                    </Link>
                    {item.brand && <p style={{ color: '#888', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.6rem' }}>{item.brand}</p>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.4rem', fontWeight: 950, color: '#1E3A8A' }}>
                        ₹{itemPrice?.toLocaleString('en-IN')}
                      </span>
                      {item.price > itemPrice && (
                        <span style={{ color: '#AAA', fontSize: '0.85rem', textDecoration: 'line-through', fontWeight: 700, marginLeft: '0.4rem' }}>
                          ₹{item.price?.toLocaleString('en-IN')}
                        </span>
                      )}
                      {saved > 0 && (
                        <span style={{ background: 'rgba(46,125,50,0.06)', color: '#2E7D32', fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '6px', letterSpacing: '0.04em' }}>
                          SAVE ₹{saved?.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
 
                  {/* Controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                    <button onClick={() => removeFromCart(item._id)}
                      style={{ background: '#F8FAFC', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '10px', borderRadius: '50%', transition: 'all 0.3s', display: 'flex' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#1E3A8A'; e.currentTarget.style.background = 'rgba(30, 58, 138, 0.05)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = '#F8FAFC'; }}>
                      <Trash2 size={16} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#FFF', borderRadius: '12px', border: '1.5px solid #EEE', padding: '3px' }}>
                      <button onClick={() => updateQty(item._id, item.quantity - 1)}
                        style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: '#666', cursor: 'pointer', borderRadius: '10px', transition: 'all 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#F5F5F5'; e.currentTarget.style.color = '#111'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#666'; }}>
                        <Minus size={14} />
                      </button>
                      <span style={{ color: '#111', fontWeight: 900, minWidth: 24, textAlign: 'center', fontSize: '1rem', fontFamily: 'Rajdhani, sans-serif' }}>{item.quantity}</span>
                      <button onClick={() => updateQty(item._id, item.quantity + 1)}
                        style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: '#666', cursor: 'pointer', borderRadius: '10px', transition: 'all 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#F5F5F5'; e.currentTarget.style.color = '#111'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#666'; }}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
 
            {/* Pincode deliverability warning */}
            {savedPincode.length === 6 && !isDeliverableAtPincode(items, savedPincode) && (
              <div style={{ marginTop: '1.5rem', background: 'rgba(229,57,53,0.04)', border: '1px solid rgba(229,57,53,0.15)', borderRadius: '16px', padding: '1.2rem', display: 'flex', alignItems: 'flex-start', gap: '0.8rem' }}>
                <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>⚠️</span>
                <p style={{ color: '#1E3A8A', fontSize: '0.9rem', margin: 0, lineHeight: 1.5, fontWeight: 600 }}>
                  <strong>NOTICE:</strong> Standard delivery for some items may be impacted at pincode <strong>{savedPincode}</strong>. Please check before selecting payment method.
                </p>
              </div>
            )}
 
            {/* Trust badges */}
            <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', flexWrap: 'wrap', paddingLeft: '0.5rem' }}>
              {[
                { icon: <Truck size={16} />, text: 'FREE DELIVERY ABOVE ₹500', color: '#2E7D32' },
                { icon: <Shield size={16} />, text: 'SECURE ENCRYPTED CHECKOUT', color: '#111' },
              ].map(({ icon, text, color }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: color, fontSize: '0.85rem', fontWeight: 950, fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.04em' }}>
                  <span style={{ color: '#1E3A8A' }}>{icon}</span> {text}
                </div>
              ))}
            </div>
          </div>
 
          {/* ── Right Panel ── */}
          <div className="animate-fadeInUp" style={{ position: 'sticky', top: 100, animationDelay: '0.2s' }}>
            {step === 1 ? (
              <div style={{ background: '#FFF', border: '1px solid #EEE', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 15px 50px rgba(0,0,0,0.03)' }}>
                {/* Header */}
                <div style={{ padding: '1.5rem 1.8rem', borderBottom: '1px solid #EEE', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F9F9F9' }}>
                  <span style={{ color: '#111', fontWeight: 900, fontFamily: 'Rajdhani, sans-serif', fontSize: '1.1rem', letterSpacing: '0.08em' }}>SUMMARY</span>
                  <span style={{ color: '#666', fontSize: '0.85rem', fontWeight: 700 }}>{itemCount} ITEMS</span>
                </div>
 
                <div style={{ padding: '2rem 1.8rem' }}>
                  {/* Item breakdown */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    {items.map((item) => {
                      const p = item.effectivePrice ?? item.discountedPrice ?? item.price;
                      return (
                        <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                          <span style={{ color: '#666', fontSize: '0.9rem', flex: 1, marginRight: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                            {item.name} <span style={{ color: '#AAA' }}>× {item.quantity}</span>
                          </span>
                          <span style={{ color: '#111', fontSize: '0.9rem', flexShrink: 0, fontWeight: 700 }}>₹{(p * item.quantity)?.toLocaleString('en-IN')}</span>
                        </div>
                      );
                    })}
                  </div>
 
                  {/* Totals */}
                  <div style={{ borderTop: '1.5px dashed #EEE', paddingTop: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                      <span style={{ color: '#888', fontSize: '0.95rem', fontWeight: 500 }}>SUBTOTAL (MRP)</span>
                      <span style={{ color: '#111', fontSize: '0.95rem', fontWeight: 800 }}>₹{totalOriginal?.toLocaleString('en-IN')}</span>
                    </div>
                    {totalOriginal > total && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                        <span style={{ color: '#888', fontSize: '0.95rem', fontWeight: 500 }}>TOTAL DISCOUNT</span>
                        <span style={{ color: '#2E7D32', fontSize: '0.95rem', fontWeight: 800 }}>-₹{(totalOriginal - total)?.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.8rem' }}>
                      <span style={{ color: '#888', fontSize: '0.95rem', fontWeight: 500 }}>DELIVERY FEE</span>
                      <span style={{ color: shippingCharge === 0 ? '#2E7D32' : '#111', fontSize: '0.95rem', fontWeight: 800 }}>
                        {shippingCharge === 0 ? 'FREE' : `₹${shippingCharge}`}
                      </span>
                    </div>
                    {/* Grand total */}
                    <div style={{ background: '#EFF6FF', borderRadius: '18px', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(30, 58, 138, 0.15)', boxShadow: 'inset 0 2px 10px rgba(30, 58, 138, 0.05)' }}>
                      <span style={{ color: '#1E3A8A', fontWeight: 950, fontSize: '1.1rem', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.04em' }}>GRAND TOTAL</span>
                      <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.5rem', fontWeight: 950, color: '#1E3A8A', lineHeight: 1 }}>
                        ₹{grandTotal?.toLocaleString('en-IN')}
                      </span>
                    </div>
                    {shippingCharge > 0 && (
                      <p style={{ color: '#2E7D32', fontSize: '0.8rem', marginTop: '1rem', textAlign: 'center', fontWeight: 700 }}>
                        <span style={{ opacity: 0.7 }}>Add ₹{(500 - total)?.toLocaleString('en-IN')} more for</span> FREE SHIPPING
                      </p>
                    )}
                  </div>
 
                  <button onClick={() => setStep(2)}
                    style={{ width: '100%', marginTop: '2rem', padding: '1.2rem', background: '#0F172A', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 950, fontSize: '1.1rem', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem', transition: 'all 0.3s', boxShadow: '0 12px 30px rgba(15, 23, 42, 0.2)' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    PROCEED TO DELIVERY <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ background: '#FFF', border: '1px solid #EEE', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 15px 50px rgba(0,0,0,0.03)' }}>
                {/* Red Header */}
                <div style={{ background: '#0F172A', padding: '1.8rem 2rem', color: '#FFF' }}>
                  <h3 style={{ fontSize: '1.6rem', fontWeight: 950, marginBottom: '0.3rem', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Delivery Location</h3>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, opacity: 0.8, letterSpacing: '0.02em' }}>Complimentary shipping for our elite members</p>
                </div>

                <div style={{ padding: '0.8rem 1.2rem' }}>
                  {user && (
                    <div style={{ position: 'relative', marginBottom: '1rem' }}>
                      <button 
                        type="button" 
                        onClick={() => {
                          const addrs = user.addresses || [];
                          if (addrs.length > 1) {
                            setShowAddressMenu(!showAddressMenu);
                          } else if (addrs.length === 1) {
                            const first = addrs[0];
                            setValue('name', user.name || '');
                            setValue('phone', user.phone || '');
                            setValue('street', first.street || '');
                            setValue('city', first.city || '');
                            if (first.pincode) {
                                setValue('pincode', first.pincode);
                                localStorage.setItem('selectedPincode', first.pincode);
                            }
                            toast.success(`Loaded ${first.label || 'Home'} address!`);
                          } else {
                            toast.error('No saved addresses found');
                          }
                        }}
                        style={{ width: '100%', border: '2px solid #1E3A8A', background: 'transparent', color: '#1E3A8A', borderRadius: '14px', padding: '0.8rem', fontSize: '0.85rem', fontWeight: 950, cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', transition: 'all 0.3s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#1E3A8A'; e.currentTarget.style.color = '#FFF'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#1E3A8A'; }}
                      >
                        {showAddressMenu ? 'Close Selection' : 'Load Saved Address Profiles'}
                      </button>

                      {/* Address Selection Dropdown */}
                      {showAddressMenu && (
                        <div style={{ 
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                          background: '#FFF', border: '1px solid #EEE', borderRadius: '14px',
                          marginTop: '0.5rem', padding: '0.6rem', boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                        }}>
                          {(user.addresses || []).map((addr, i) => (
                            <div key={i}
                              onClick={() => {
                                setValue('name', user.name || '');
                                setValue('phone', user.phone || '');
                                setValue('street', addr.street || '');
                                setValue('city', addr.city || '');
                                if (addr.pincode) {
                                    setValue('pincode', addr.pincode);
                                    localStorage.setItem('selectedPincode', addr.pincode);
                                }
                                setShowAddressMenu(false);
                                toast.success(`Selected ${addr.label}!`);
                              }}
                              style={{ 
                                padding: '0.8rem', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s',
                                display: 'flex', alignItems: 'center', gap: '0.8rem', borderBottom: i === user.addresses.length-1 ? 'none' : '1px solid #F5F5F5'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#F9F9F9'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{ background: '#FFF1F0', padding: '10px', borderRadius: '10px', color: '#E53935' }}>
                                 {addr.label?.toLowerCase() === 'work' ? <Briefcase size={16} /> : <HomeIcon size={16} />}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#111' }}>{addr.label}</p>
                                <p style={{ margin: 0, fontSize: '0.7rem', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{addr.street}, {addr.city}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <form onSubmit={handleSubmit(handleOrder)}>
                    
                    {/* Contact Details Section */}
                    <div style={{ marginBottom: '1rem' }}>
                      <p style={{ color: '#888', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.6rem' }}>CONTACT DETAILS</p>
                      <div className="cart-addr-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#BBB' }}><User size={16} /></div>
                          <input
                            placeholder="Full Name"
                            {...register('name', { required: 'Name is required' })}
                            className="input-light"
                            style={{ height: '48px', paddingLeft: '2.5rem', fontWeight: 600, background: '#F9F9F9', border: '1px solid #EEE', fontSize: '0.85rem' }}
                          />
                          {errors.name && <p style={{ color: '#E53935', fontSize: '0.7rem', marginTop: '0.3rem' }}>{errors.name.message}</p>}
                        </div>
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#BBB' }}><Phone size={16} /></div>
                          <input
                            placeholder="Phone Number"
                            {...register('phone', { required: 'Phone is required', pattern: { value: /^\d{10}$/, message: '10 digits' } })}
                            className="input-light"
                            style={{ height: '48px', paddingLeft: '2.5rem', fontWeight: 600, background: '#F9F9F9', border: '1px solid #EEE', fontSize: '0.85rem' }}
                          />
                          {errors.phone && <p style={{ color: '#E53935', fontSize: '0.7rem', marginTop: '0.3rem' }}>{errors.phone.message}</p>}
                        </div>
                      </div>
                    </div>

                    {/* Shipping Address Section */}
                    <div style={{ marginBottom: '1rem' }}>
                      <p style={{ color: '#888', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.6rem' }}>SHIPPING ADDRESS</p>
                      <div className="cart-addr-row" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.5fr 0.8fr', gap: '0.6rem' }}>
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#BBB' }}><MapPin size={14} /></div>
                          <input
                            placeholder="Street Address"
                            {...register('street', { required: 'Required' })}
                            className="input-light"
                            style={{ height: '48px', paddingLeft: '2.2rem', fontWeight: 600, background: '#F9F9F9', border: '1px solid #EEE', fontSize: '0.8rem' }}
                          />
                        </div>
                        <div>
                          <input
                            placeholder="City"
                            {...register('city', { required: 'Required' })}
                            className="input-light"
                            style={{ height: '48px', fontWeight: 600, background: '#F9F9F9', border: '1px solid #EEE', fontSize: '0.8rem', padding: '0 0.5rem' }}
                          />
                        </div>
                        <div>
                          <input
                            placeholder="Pincode"
                            {...register('pincode', { required: 'Required', pattern: { value: /^\d{6}$/, message: '6 digits' } })}
                            className="input-light"
                            style={{ height: '48px', fontWeight: 600, background: '#F9F9F9', border: '1px solid #EEE', fontSize: '0.8rem', padding: '0 0.5rem', textAlign: 'center' }}
                          />
                        </div>
                      </div>
                      {(errors.street || errors.city) && <p style={{ color: '#E53935', fontSize: '0.7rem', marginTop: '0.3rem' }}>Address and City are required</p>}
                    </div>

                    {/* Delivery Pin Section */}
                    <div style={{ marginBottom: '1rem' }}>
                      <p style={{ color: '#888', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.6rem' }}>DELIVERY PIN</p>
                      <div
                        onClick={() => setShowMap(true)}
                        style={{ border: '2px dashed #EEE', borderRadius: '16px', padding: '1rem', textAlign: 'center', cursor: 'pointer', background: '#F9F9F9', transition: 'all 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = '#1E3A8A'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = '#EEE'}
                      >
                         <div style={{ color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', fontWeight: 700, fontSize: '0.85rem' }}>
                           <MapPin size={18} style={{ color: '#1E3A8A' }} /> Pin location on maps
                         </div>
                      </div>
                    </div>

                    {/* Payment Method Section */}
                    <div style={{ marginTop: '1rem', marginBottom: '1.2rem' }}>
                      <p style={{ color: '#888', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.6rem' }}>PAYMENT METHOD</p>
                      <div style={{ display: 'flex', gap: '0.8rem' }}>
                        {[
                          { value: 'cod', label: 'CASH ON DELIVERY' },
                          { value: 'online', label: 'ONLINE PREPAY' },
                        ].map(({ value, label }) => (
                          <label key={value} style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                            background: paymentMethod === value ? '#111' : '#F9F9F9',
                            border: `2px solid ${paymentMethod === value ? '#111' : '#EEE'}`,
                            borderRadius: '12px', padding: '0.9rem 0.5rem',
                            cursor: 'pointer', fontSize: '0.82rem',
                            color: paymentMethod === value ? '#FFF' : '#666',
                            fontWeight: 800,
                            transition: 'all 0.25s',
                            fontFamily: 'Rajdhani, sans-serif',
                            letterSpacing: '0.04em'
                          }}>
                            <input type="radio" value={value} {...register('paymentMethod')} style={{ display: 'none' }} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #EEE', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                         <span style={{ color: '#666', fontWeight: 700, fontSize: '0.9rem' }}>Total Amount</span>
                         <span style={{ color: '#111', fontSize: '1.8rem', fontWeight: 900, fontFamily: 'Rajdhani, sans-serif' }}>₹{grandTotal?.toLocaleString('en-IN')}</span>
                       </div>

                       <div style={{ display: 'flex', gap: '1rem' }}>
                        <button type="button" onClick={() => setStep(1)}
                          style={{ flex: 1, height: '54px', background: '#FFF', border: '2px solid #EEE', borderRadius: '14px', color: '#666', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', fontFamily: 'Rajdhani, sans-serif' }}>
                          BACK
                        </button>
                        <button type="submit" disabled={placing}
                          style={{ flex: 2, height: '54px', background: placing ? '#E2E8F0' : '#1E3A8A', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 950, cursor: placing ? 'not-allowed' : 'pointer', fontSize: '1.1rem', transition: 'all 0.3s', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.1em', boxShadow: placing ? 'none' : '0 12px 30px rgba(30, 58, 138, 0.25)' }}>
                          {placing ? 'PROVISING...' : 'FINALIZE BOOKING'}
                        </button>
                      </div>
                      <p style={{ textAlign: 'center', color: '#AAA', fontSize: '0.7rem', marginTop: '1rem', fontWeight: 500 }}>Secure Payment via Razorpay</p>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Location Picker Modal */}
      {showMap && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="animate-scaleIn" style={{ background: '#FFF', width: '90%', maxWidth: '500px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #EEE' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, fontFamily: 'Rajdhani, sans-serif' }}>Select Location</h3>
                <p style={{ fontSize: '0.75rem', color: '#888', fontWeight: 600 }}>Please pin your service address</p>
              </div>
              <button onClick={() => setShowMap(false)} style={{ background: 'none', border: 'none', color: '#BBB', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div style={{ height: '300px', width: '100%', position: 'relative' }}>
              <MapContainer center={[markerPos.lat, markerPos.lng]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <LocationMarker markerPos={markerPos} setMarkerPos={setMarkerPos} setResolvedAddress={setResolvedAddress} />
              </MapContainer>
              <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 900 }}>
                 <button 
                  onClick={() => {
                    navigator.geolocation.getCurrentPosition((pos) => {
                      const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                      setMarkerPos(newPos);
                    });
                  }}
                  style={{ background: '#FFF', border: 'none', borderRadius: '10px', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.8rem', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', cursor: 'pointer' }}>
                   <MapPin size={16} /> Locate Me
                 </button>
              </div>
            </div>

            <div style={{ padding: '1.5rem' }}>
               <div style={{ background: '#F9F9F9', borderRadius: '12px', padding: '1rem', marginBottom: '1.2rem' }}>
                  <p style={{ color: '#E53935', fontSize: '0.65rem', fontWeight: 900, marginBottom: '0.4rem', textTransform: 'uppercase' }}>FINAL ADDRESS:</p>
                  <p style={{ color: '#111', fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.4 }}>{resolvedAddress || 'Picking location...'}</p>
               </div>
               
               <button 
                onClick={async () => {
                  if (resolvedAddress) {
                    try {
                      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${markerPos.lat}&lon=${markerPos.lng}`);
                      const data = await res.json();
                      const addr = data.address;
                      const street = addr.road || addr.suburb || addr.neighbourhood || '';
                      const city = addr.city || addr.town || addr.village || addr.county || '';
                      const state = addr.state || addr.province || '';
                      const pincode = addr.postcode || '';
                      
                      setValue('street', data.display_name?.split(',')?.slice(0, 2).join(','));
                      setValue('city', city);
                      setValue('state', state);
                      setValue('pincode', pincode);
                      setShowMap(false);
                      toast.success('Location updated!');
                    } catch (e) {
                      toast.error('Failed to resolve address');
                    }
                  }
                }}
                style={{ width: '100%', background: '#0F172A', color: '#FFF', border: 'none', borderRadius: '14px', padding: '1.2rem', fontWeight: 950, cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', boxShadow: '0 12px 30px rgba(15, 23, 42, 0.2)' }}>
                 Lock This Location
               </button>
            </div>
          </div>
        </div>
      )}
      <CheckoutModal open={showServiceCheckout} onClose={() => setShowServiceCheckout(false)} />
    </div>
  );
}

function LocationMarker({ markerPos, setMarkerPos, setResolvedAddress }) {
  const map = useMapEvents({
    click(e) {
      setMarkerPos(e.latlng);
    },
  });

  useEffect(() => {
    map.flyTo(markerPos, map.getZoom());
    const fetchAddr = async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${markerPos.lat}&lon=${markerPos.lng}`);
        const data = await res.json();
        setResolvedAddress(data.display_name);
      } catch (e) {}
    };
    fetchAddr();
  }, [markerPos, map, setResolvedAddress]);

  return <Marker position={markerPos} />;
}



