import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Calendar, MapPin, CreditCard, ChevronLeft, ChevronRight, Check,
  Crosshair, Loader, Plus, AlertCircle, Car as CarIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useServiceCart } from '../../context/CartContext';
import {
  getAvailability, createServiceBooking, createServicePayment, verifyServicePayment,
} from '../../api/serviceApi';
import { getMe, addAddress } from '../../api/authApi';
import { reportApiError } from '../../api/apiError';

const MAX_DAYS_AHEAD = 30;
const LAST_BOOKABLE_HOUR = 18;   // same-day bookings close once 18:00 passes

const toISODate = (d) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
};

const prettyTime = (hhmm) => {
  const [h] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${suffix}`;
};

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

export default function CheckoutModal({ open, onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { car, services, totalAmount, clearCart } = useServiceCart();

  const [step, setStep] = useState(1);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [locating, setLocating] = useState(false);
  const [addressForm, setAddressForm] = useState({
    label: 'Home', street: '', city: '', state: '', pincode: '', lat: null, lng: null,
  });
  const [addressErrors, setAddressErrors] = useState({});

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [bookingId, setBookingId] = useState(null);   // survives a failed payment so retry reuses it

  // ── date bounds ──
  const { minDate, maxDate } = useMemo(() => {
    const now = new Date();
    const first = new Date(now);
    // Past 18:00 there is no slot left today, so start from tomorrow.
    if (now.getHours() >= LAST_BOOKABLE_HOUR) first.setDate(first.getDate() + 1);
    const last = new Date(now);
    last.setDate(last.getDate() + MAX_DAYS_AHEAD);
    return { minDate: toISODate(first), maxDate: toISODate(last) };
  }, []);

  // Reset to a clean state each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setScheduledDate(minDate);
    setScheduledTime('');
    setPayError('');
    setBookingId(null);
  }, [open, minDate]);

  // ── slots for the chosen day ──
  useEffect(() => {
    if (!open || !scheduledDate) return;
    let cancelled = false;
    setSlotsLoading(true);
    setScheduledTime('');
    getAvailability(scheduledDate)
      .then(({ data }) => { if (!cancelled) setSlots(data.slots || []); })
      .catch((err) => {
        if (cancelled) return;
        reportApiError('CheckoutModal.getAvailability', err);
        // Availability is an enhancement — fall back to every slot open so a
        // failing lookup never blocks a booking.
        setSlots(['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']
          .map((time) => ({ time, available: true })));
      })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [open, scheduledDate]);

  // ── saved addresses ──
  // The login response omits `addresses`, so read the full profile.
  const loadAddresses = useCallback(() => {
    setAddressesLoading(true);
    getMe()
      .then(({ data }) => {
        const list = data.user?.addresses || [];
        setAddresses(list);
        if (list.length) setSelectedAddressId((prev) => prev ?? list[0]._id);
        else setAddingAddress(true);
      })
      .catch((err) => {
        reportApiError('CheckoutModal.getMe', err);
        setAddresses([]);
        setAddingAddress(true);
      })
      .finally(() => setAddressesLoading(false));
  }, []);

  useEffect(() => { if (open && user) loadAddresses(); }, [open, user, loadAddresses]);

  if (!open) return null;

  // ── address helpers ──
  const validateAddress = () => {
    const e = {};
    if (!addressForm.street.trim()) e.street = 'Street address is required';
    if (!addressForm.city.trim()) e.city = 'City is required';
    if (!addressForm.state.trim()) e.state = 'State is required';
    if (!/^[1-9]\d{5}$/.test(addressForm.pincode.trim())) {
      e.pincode = 'Enter a valid 6-digit pincode (cannot start with 0)';
    }
    setAddressErrors(e);
    return Object.keys(e).length === 0;
  };

  const fetchCurrentAddress = () => {
    if (!navigator.geolocation) {
      toast.error('Your browser does not support location lookup');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          const a = data.address || {};
          setAddressForm((prev) => ({
            ...prev,
            street: [a.house_number, a.road, a.neighbourhood, a.suburb].filter(Boolean).join(', ') || prev.street,
            city: a.city || a.town || a.village || a.county || prev.city,
            state: a.state || prev.state,
            pincode: a.postcode || prev.pincode,
            lat, lng,
          }));
          toast.success('Address filled from your location');
        } catch (err) {
          console.error('[CheckoutModal.reverseGeocode]', err);
          setAddressForm((prev) => ({ ...prev, lat, lng }));
          toast.error('Found your location but could not read the address. Please fill it in.');
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        console.error('[CheckoutModal.geolocation]', err);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error('Location permission denied. Please enter your address manually.');
        } else if (err.code === err.TIMEOUT) {
          toast.error('Location lookup timed out. Please enter your address manually.');
        } else {
          toast.error('Could not get your location. Please enter your address manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const saveAddress = async () => {
    if (!validateAddress()) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    setSavingAddress(true);
    try {
      const { data } = await addAddress({
        label: addressForm.label || 'Home',
        street: addressForm.street.trim(),
        city: addressForm.city.trim(),
        state: addressForm.state.trim(),
        pincode: addressForm.pincode.trim(),
        lat: addressForm.lat, lng: addressForm.lng,
      });
      const list = data.addresses || [];
      setAddresses(list);
      setSelectedAddressId(list[list.length - 1]?._id || null);
      setAddingAddress(false);
      setAddressForm({ label: 'Home', street: '', city: '', state: '', pincode: '', lat: null, lng: null });
      toast.success('Address saved');
    } catch (err) {
      toast.error(reportApiError('CheckoutModal.addAddress', err, 'Could not save the address'));
    } finally {
      setSavingAddress(false);
    }
  };

  const selectedAddress = addresses.find((a) => a._id === selectedAddressId) || null;

  // ── payment ──
  const handlePay = async () => {
    if (paying) return;                       // guard against a double click
    setPaying(true);
    setPayError('');

    try {
      // 1. Create (or reuse) the booking
      let id = bookingId;
      if (!id) {
        const { data } = await createServiceBooking({
          selectedCar: {
            carId: car.carId, brand: car.brand, model: car.model, year: car.year,
            fuelType: car.fuelType, transmission: car.transmission,
            image: car.image, isManualEntry: car.isManualEntry,
          },
          services: services.map((s) => ({
            serviceType: s.serviceType || s.serviceId,
            categoryId: s.categoryId,
            category: s.category,
          })),
          scheduledDate, scheduledTime,
          address: {
            street: selectedAddress.street, city: selectedAddress.city,
            state: selectedAddress.state, pincode: selectedAddress.pincode,
            lat: selectedAddress.lat, lng: selectedAddress.lng,
          },
          totalAmount,
        });
        id = data.booking._id;
        setBookingId(id);
      }

      // 2. Razorpay order
      const { data: pay } = await createServicePayment(id);

      const ok = await loadRazorpay();
      if (!ok) throw new Error('Could not load the payment gateway. Check your connection and retry.');

      const key = pay.key || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!key) throw new Error('Payment is not configured. Please contact support.');

      // 3. Checkout
      await new Promise((resolve) => {
        const rzp = new window.Razorpay({
          key,
          amount: pay.order.amount,
          currency: pay.order.currency || 'INR',
          name: 'GK Motors',
          description: services.map((s) => s.name).join(', ').slice(0, 240),
          order_id: pay.order.id,
          prefill: { name: user?.name || '', email: user?.email || '', contact: user?.phone || '' },
          theme: { color: '#1E3A8A' },
          modal: {
            ondismiss: () => {
              // Booking stays in `requested` so the customer can retry.
              setPayError('Payment was cancelled. Your booking is saved — you can pay again below.');
              setPaying(false);
              resolve();
            },
          },
          handler: async (response) => {
            try {
              // 4. Verify signature server-side
              await verifyServicePayment(id, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              clearCart();                    // only ever cleared on success
              toast.success('Booking confirmed. See you soon.');
              onClose();
              navigate('/my-bookings?tab=services');
            } catch (err) {
              setPayError(reportApiError(
                'CheckoutModal.verifyServicePayment', err,
                'We could not confirm your payment. If you were charged, contact support with your booking id.'
              ));
            } finally {
              setPaying(false);
              resolve();
            }
          },
        });
        rzp.on('payment.failed', (resp) => {
          console.error('[CheckoutModal.payment.failed]', resp?.error);
          setPayError(resp?.error?.description || 'Payment failed. Please try again.');
          setPaying(false);
          resolve();
        });
        rzp.open();
      });
    } catch (err) {
      setPayError(err.response ? reportApiError('CheckoutModal.handlePay', err) : err.message);
      setPaying(false);
    }
  };

  // ── step gating ──
  const canContinueFromDate = Boolean(scheduledDate && scheduledTime);
  const canContinueFromAddress = Boolean(selectedAddress);

  const STEPS = [
    { n: 1, label: 'Date & Time', icon: Calendar },
    { n: 2, label: 'Address', icon: MapPin },
    { n: 3, label: 'Payment', icon: CreditCard },
  ];

  const inputStyle = (hasError) => ({
    width: '100%', padding: '0.55rem 0.75rem', borderRadius: '9px',
    border: `1.5px solid ${hasError ? '#EF4444' : '#E2E8F0'}`,
    fontSize: '0.82rem', fontWeight: 600, color: '#0F172A', outline: 'none', background: '#FFF',
  });
  const labelStyle = {
    display: 'block', fontSize: '0.66rem', fontWeight: 800, color: '#64748B',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem',
  };
  const errStyle = { color: '#EF4444', fontSize: '0.72rem', fontWeight: 700, marginTop: '0.25rem' };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !paying) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '1rem', overflowY: 'auto',
      }}
    >
      <div style={{ background: '#FFF', borderRadius: '20px', width: '100%', maxWidth: '560px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: '1.15rem', color: '#0F172A' }}>
            Complete Your Booking
          </h2>
          <button onClick={onClose} disabled={paying} style={{ background: 'none', border: 'none', cursor: paying ? 'not-allowed' : 'pointer', color: '#94A3B8', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem 1.5rem', borderBottom: '1px solid #F1F5F9' }}>
          {STEPS.map(({ n, label, icon: Icon }) => {
            const active = step === n;
            const done = step > n;
            return (
              <div key={n} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: done ? '#DCFCE7' : active ? '#1E3A8A' : '#F1F5F9',
                  color: done ? '#166534' : active ? '#FFF' : '#94A3B8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {done ? <Check size={14} /> : <Icon size={13} />}
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: active ? '#0F172A' : '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div>
              <label style={labelStyle}>Service Date</label>
              <input
                type="date" value={scheduledDate} min={minDate} max={maxDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                style={{ ...inputStyle(false), marginBottom: '1.25rem' }}
              />

              <label style={labelStyle}>Time Slot</label>
              {slotsLoading ? (
                <div style={{ padding: '1.5rem 0' }}><Loader size={20} style={{ color: '#1E3A8A' }} /></div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '0.5rem' }}>
                  {slots.map(({ time, available }) => {
                    const sel = scheduledTime === time;
                    return (
                      <button
                        key={time}
                        onClick={() => available && setScheduledTime(time)}
                        disabled={!available}
                        style={{
                          padding: '0.5rem 0.35rem', borderRadius: '9px',
                          border: `1.5px solid ${sel ? '#1E3A8A' : available ? '#E2E8F0' : '#F1F5F9'}`,
                          background: sel ? '#1E3A8A' : available ? '#FFF' : '#F8FAFC',
                          color: sel ? '#FFF' : available ? '#0F172A' : '#CBD5E1',
                          fontWeight: 800, fontSize: '0.74rem',
                          cursor: available ? 'pointer' : 'not-allowed',
                          textDecoration: available ? 'none' : 'line-through',
                          transition: 'all 0.15s',
                        }}
                      >
                        {prettyTime(time)}
                      </button>
                    );
                  })}
                </div>
              )}
              {!slotsLoading && slots.every((s) => !s.available) && (
                <p style={{ color: '#EF4444', fontSize: '0.8rem', fontWeight: 700, marginTop: '0.9rem' }}>
                  All slots on this date are taken. Please pick another day.
                </p>
              )}
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div>
              {addressesLoading ? (
                <div style={{ padding: '1.5rem 0', textAlign: 'center' }}><Loader size={20} style={{ color: '#1E3A8A' }} /></div>
              ) : (
                <>
                  {addresses.length > 0 && !addingAddress && (
                    <>
                      <label style={labelStyle}>Where should we collect the car?</label>
                      <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1rem' }}>
                        {addresses.map((a) => {
                          const sel = a._id === selectedAddressId;
                          return (
                            <button
                              key={a._id}
                              onClick={() => setSelectedAddressId(a._id)}
                              style={{
                                display: 'flex', alignItems: 'flex-start', gap: '0.7rem', textAlign: 'left',
                                border: `1.5px solid ${sel ? '#1E3A8A' : '#E2E8F0'}`,
                                background: sel ? '#EFF6FF' : '#FFF',
                                borderRadius: '12px', padding: '0.85rem 1rem', cursor: 'pointer',
                              }}
                            >
                              <div style={{
                                width: 18, height: 18, borderRadius: '50%', marginTop: '0.1rem', flexShrink: 0,
                                border: `2px solid ${sel ? '#1E3A8A' : '#CBD5E1'}`,
                                background: sel ? '#1E3A8A' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {sel && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFF' }} />}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 900, fontSize: '0.85rem', color: '#0F172A', marginBottom: '0.15rem' }}>{a.label || 'Address'}</div>
                                <div style={{ color: '#64748B', fontSize: '0.8rem', fontWeight: 500, lineHeight: 1.45 }}>
                                  {[a.street, a.city, a.state, a.pincode].filter(Boolean).join(', ')}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setAddingAddress(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: '1.5px dashed #1E3A8A', color: '#1E3A8A', borderRadius: '10px', padding: '0.65rem 1rem', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', width: '100%', justifyContent: 'center' }}
                      >
                        <Plus size={14} /> Add New Address
                      </button>
                    </>
                  )}

                  {addingAddress && (
                    <div>
                      {addresses.length === 0 && (
                        <p style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>
                          You have no saved addresses yet. Add one to continue.
                        </p>
                      )}

                      <button
                        onClick={fetchCurrentAddress}
                        disabled={locating}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', background: '#EBF0FF', border: 'none', color: '#1E3A8A', borderRadius: '10px', padding: '0.6rem 1rem', fontWeight: 800, fontSize: '0.8rem', cursor: locating ? 'wait' : 'pointer', marginBottom: '1rem' }}
                      >
                        <Crosshair size={14} /> {locating ? 'Locating…' : 'Fetch Current Address'}
                      </button>

                      <div style={{ display: 'grid', gap: '0.85rem' }}>
                        <div>
                          <label style={labelStyle}>Label</label>
                          <input type="text" value={addressForm.label} onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })} placeholder="Home / Office" style={inputStyle(false)} />
                        </div>
                        <div>
                          <label style={labelStyle}>Street Address *</label>
                          <input type="text" value={addressForm.street} onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })} placeholder="House no., street, area" style={inputStyle(addressErrors.street)} />
                          {addressErrors.street && <p style={errStyle}>{addressErrors.street}</p>}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                          <div>
                            <label style={labelStyle}>City *</label>
                            <input type="text" value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} style={inputStyle(addressErrors.city)} />
                            {addressErrors.city && <p style={errStyle}>{addressErrors.city}</p>}
                          </div>
                          <div>
                            <label style={labelStyle}>State *</label>
                            <input type="text" value={addressForm.state} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} style={inputStyle(addressErrors.state)} />
                            {addressErrors.state && <p style={errStyle}>{addressErrors.state}</p>}
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>Pincode *</label>
                          <input type="text" inputMode="numeric" maxLength={6} value={addressForm.pincode}
                            onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                            style={inputStyle(addressErrors.pincode)} />
                          {addressErrors.pincode && <p style={errStyle}>{addressErrors.pincode}</p>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.1rem' }}>
                        <button onClick={saveAddress} disabled={savingAddress}
                          style={{ flex: 1, background: 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)', color: '#FFF', border: 'none', borderRadius: '10px', padding: '0.8rem', fontWeight: 900, fontSize: '0.85rem', cursor: savingAddress ? 'wait' : 'pointer', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          {savingAddress ? 'Saving…' : 'Save Address'}
                        </button>
                        {addresses.length > 0 && (
                          <button onClick={() => { setAddingAddress(false); setAddressErrors({}); }}
                            style={{ background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '10px', padding: '0.8rem 1.2rem', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div>
              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '14px', padding: '1.1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
                  <CarIcon size={16} style={{ color: '#1E3A8A' }} />
                  <span style={{ fontWeight: 900, fontSize: '0.9rem', color: '#0F172A' }}>
                    {car?.brand} {car?.model} · {car?.year}
                  </span>
                </div>
                {services.map((s) => (
                  <div key={s.serviceId} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.4rem 0', fontSize: '0.85rem' }}>
                    <span style={{ color: '#475569', fontWeight: 600 }}>{s.name}</span>
                    <span style={{ color: '#0F172A', fontWeight: 800, whiteSpace: 'nowrap' }}>₹{Number(s.price).toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0F172A', marginTop: '0.7rem', paddingTop: '0.7rem' }}>
                  <span style={{ fontWeight: 900, fontSize: '0.8rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total</span>
                  <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: '1.2rem', color: '#0F172A' }}>
                    ₹{Number(totalAmount).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.82rem', color: '#475569', fontWeight: 600, marginBottom: '1.1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Calendar size={14} style={{ color: '#1E3A8A', flexShrink: 0, marginTop: '0.1rem' }} />
                  <span>{scheduledDate} at {scheduledTime && prettyTime(scheduledTime)}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <MapPin size={14} style={{ color: '#1E3A8A', flexShrink: 0, marginTop: '0.1rem' }} />
                  <span>{selectedAddress && [selectedAddress.street, selectedAddress.city, selectedAddress.pincode].filter(Boolean).join(', ')}</span>
                </div>
              </div>

              {payError && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
                  <AlertCircle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: '0.1rem' }} />
                  <span style={{ color: '#991B1B', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.5 }}>{payError}</span>
                </div>
              )}

              <button
                onClick={handlePay}
                disabled={paying}
                style={{
                  width: '100%',
                  background: paying ? '#94A3B8' : 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)',
                  color: '#FFF', border: 'none', borderRadius: '10px', padding: '0.8rem',
                  fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: '0.85rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  cursor: paying ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                }}
              >
                <CreditCard size={17} />
                {paying ? 'Processing…' : payError ? 'Retry Payment' : `Pay ₹${Number(totalAmount).toLocaleString('en-IN')}`}
              </button>
            </div>
          )}
        </div>

        {/* Footer nav */}
        {step < 3 && (
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '0.7rem' }}>
            {step > 1 && (
              <button onClick={() => setStep(step - 1)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '10px', padding: '0.8rem 1.2rem', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
                <ChevronLeft size={15} /> Back
              </button>
            )}
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 ? !canContinueFromDate : !canContinueFromAddress}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                background: (step === 1 ? canContinueFromDate : canContinueFromAddress)
                  ? 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)' : '#E2E8F0',
                color: (step === 1 ? canContinueFromDate : canContinueFromAddress) ? '#FFF' : '#94A3B8',
                border: 'none', borderRadius: '10px', padding: '0.8rem',
                fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: '0.88rem',
                letterSpacing: '0.07em', textTransform: 'uppercase',
                cursor: (step === 1 ? canContinueFromDate : canContinueFromAddress) ? 'pointer' : 'not-allowed',
              }}
            >
              Continue <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
