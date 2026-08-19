import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Calendar, Fuel, Users, Settings, MapPin, Shield, Clock, ArrowLeft, CheckCircle, Hash, Palette, Car as CarIcon, DoorOpen, Wind, Navigation, Bluetooth, Music, Gauge } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/common/LoadingSpinner';
import { getRentalCar, createRentalBooking, verifyRentalPayment } from '../api/rentalApi';

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export default function RentalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [form, setForm] = useState({
    pickupDate: today,
    returnDate: tomorrow,
    pickupTime: '10:00',
    returnTime: '10:00',
    contactPhone: '',
    driverLicense: '',
    notes: '',
    paymentMethod: 'online',
    paymentPlan: 'full', // 'full' | 'advance' | 'on_drop'
    rentalUnit: 'day',
    pickupAddress: { street: '', city: '', state: '', pincode: '' },
    fullName: '',
    aadharNumber: '',
    panNumber: '',
  });
  const [aadharImage, setAadharImage] = useState(null);
  const [panImage, setPanImage] = useState(null);
  const [licenseImage, setLicenseImage] = useState(null);
  const [includeSecurityDeposit, setIncludeSecurityDeposit] = useState(true);

  // Auto-derive allowed rental units from prices + any explicit rentalUnits flag.
  // If pricePerHour > 0, hour mode is enabled automatically (same for day).
  const computeAllowedUnits = (c) => {
    const fromPrices = [];
    if (c?.pricePerDay > 0) fromPrices.push('day');
    if (c?.pricePerHour > 0) fromPrices.push('hour');
    const explicit = Array.isArray(c?.rentalUnits) ? c.rentalUnits.filter(u => u === 'day' || u === 'hour') : [];
    const merged = Array.from(new Set([...explicit, ...fromPrices]));
    return merged.length ? merged : ['day'];
  };

  useEffect(() => {
    if (user) {
      setForm(prev => ({ 
        ...prev, 
        contactPhone: user.phone || prev.contactPhone,
        fullName: user.name || prev.fullName
      }));
    }
  }, [user]);

  useEffect(() => {
    getRentalCar(id)
      .then(({ data }) => {
        setCar(data.car);
        const allowedUnits = computeAllowedUnits(data.car);
        setForm(prev => ({ ...prev, rentalUnit: allowedUnits[0] }));
        // If deposit is optional, default to NOT including; if compulsory, force include.
        const compulsory = data.car?.securityDepositCompulsory !== false;
        setIncludeSecurityDeposit(compulsory);
      })
      .catch(() => toast.error('Failed to load rental details'))
      .finally(() => setLoading(false));
  }, [id]);

  const allowedUnits = computeAllowedUnits(car);
  const unit = allowedUnits.includes(form.rentalUnit) ? form.rentalUnit : allowedUnits[0];

  const totalDays = useMemo(() => {
    if (!form.pickupDate || !form.returnDate) return 0;
    const ms = new Date(form.returnDate).getTime() - new Date(form.pickupDate).getTime();
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [form.pickupDate, form.returnDate]);

  const totalHours = useMemo(() => {
    if (!form.pickupDate || !form.returnDate) return 0;
    const s = new Date(`${form.pickupDate}T${form.pickupTime || '00:00'}:00`);
    const e = new Date(`${form.returnDate}T${form.returnTime || '00:00'}:00`);
    return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60)));
  }, [form.pickupDate, form.returnDate, form.pickupTime, form.returnTime]);

  const pickupFull = useMemo(() => car ? [car.location?.address, car.location?.city, car.location?.state, car.location?.pincode].filter(Boolean).join(', ') : '', [car]);
  const dropFull = useMemo(() => car ? [car.dropLocation?.address, car.dropLocation?.city, car.dropLocation?.state, car.dropLocation?.pincode].filter(Boolean).join(', ') : '', [car]);
  const isSameLocation = pickupFull && dropFull && pickupFull === dropFull;

  const subtotal = unit === 'hour'
    ? (car?.pricePerHour || 0) * totalHours
    : (car?.pricePerDay || 0) * totalDays;
  const depositCompulsory = car?.securityDepositCompulsory !== false;
  const effectiveDeposit = (depositCompulsory || includeSecurityDeposit) ? (car?.securityDeposit || 0) : 0;
  const totalAmount = subtotal + effectiveDeposit;

  // Derive what gets charged now vs later based on payment plan.
  const advanceDefault = car?.securityDeposit > 0
    ? car.securityDeposit
    : Math.round(totalAmount * 0.25);
  const payNow = form.paymentPlan === 'full' ? totalAmount
              : form.paymentPlan === 'advance' ? advanceDefault
              : 0;
  const dueAtDrop = Math.max(0, totalAmount - payNow);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login to book a rental');
      return;
    }
    if (!form.contactPhone) return toast.error('Contact phone is required');

    // KYC validation
    const aadhar = (form.aadharNumber || '').replace(/\s/g, '');
    if (!/^\d{12}$/.test(aadhar)) return toast.error('Enter a valid 12-digit Aadhar number');
    const pan = (form.panNumber || '').toUpperCase().trim();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return toast.error('Enter a valid PAN (e.g. ABCDE1234F)');
    if (!aadharImage) return toast.error('Please upload Aadhar card image');
    if (!panImage) return toast.error('Please upload PAN card image');
    if (!licenseImage) return toast.error('Please upload Driving License image');

    if (unit === 'hour') {
      const start = new Date(`${form.pickupDate}T${form.pickupTime || '00:00'}:00`);
      const end = new Date(`${form.returnDate}T${form.returnTime || '00:00'}:00`);
      if (end.getTime() <= start.getTime()) {
        return toast.error('Return time must be after pickup time');
      }
    } else if (new Date(form.returnDate) <= new Date(form.pickupDate)) {
      return toast.error('Return date must be after pickup date');
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('rentalCar', id);
      fd.append('pickupDate', form.pickupDate);
      fd.append('returnDate', form.returnDate);
      fd.append('pickupTime', form.pickupTime);
      fd.append('returnTime', form.returnTime);
      fd.append('contactPhone', form.contactPhone);
      fd.append('fullName', form.fullName);
      fd.append('driverLicense', form.driverLicense || '');
      fd.append('notes', form.notes || '');
      fd.append('paymentMethod', form.paymentMethod);
      fd.append('paymentPlan', form.paymentPlan);
      fd.append('includeSecurityDeposit', includeSecurityDeposit);
      fd.append('rentalUnit', unit);
      fd.append('aadharNumber', aadhar);
      fd.append('panNumber', pan);
      fd.append('pickupAddress', JSON.stringify(form.pickupAddress));
      fd.append('aadharImage', aadharImage);
      fd.append('panImage', panImage);
      fd.append('licenseImage', licenseImage);
      const { data: res } = await createRentalBooking(fd);

      if (!res.order) {
        toast.success('Booking created!');
        navigate('/my-bookings?tab=rentals');
        return;
      }

      const loaded = await loadRazorpay();
      if (!loaded) {
        toast.error('Razorpay SDK failed to load. Are you online?');
        setSubmitting(false);
        return;
      }

      const razorpayKey = res.key || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!razorpayKey) {
        toast.error('Payment is not configured. Please contact support.');
        setSubmitting(false);
        return;
      }

      const order = res.order;
      const options = {
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        name: 'GK Motors',
        description: `${car.brand} ${car.model} Booking`,
        order_id: order.id,
        handler: async (response) => {
          try {
            await verifyRentalPayment({
              ...response,
              bookingId: res.booking._id
            });
            toast.success('Rental booked and paid successfully!');
            navigate('/my-bookings?tab=rentals');
          } catch (err) {
            toast.error('Payment verification failed');
          }
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: form.contactPhone
        },
        theme: { color: '#1E3A8A' },
        readonly: {
          contact: true,
          email: true,
        },
        modal: {
          ondismiss: () => {
            toast.error('Payment cancelled');
            setSubmitting(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        toast.error(resp?.error?.description || 'Payment failed');
        setSubmitting(false);
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed');
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!car) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      <style>{`
        @media (max-width: 992px) {
          .rental-detail-grid { grid-template-columns: 1fr !important; gap: 1.5rem !important; }
          .rental-main-image { height: 300px !important; }
        }
        @media (max-width: 480px) {
          .rental-main-image { height: 160px !important; }
          .rental-detail-card, .rental-form-card { padding: 0.6rem !important; border-radius: 10px !important; }
          .rental-detail-grid { gap: 0.6rem !important; }
          input, select, .input-light { font-size: 0.62rem !important; height: 30px !important; padding: 0.2rem 0.5rem !important; }
          label { font-size: 0.45rem !important; margin-bottom: 0.1rem !important; letter-spacing: 0.01em !important; }
          h1 { font-size: 1.1rem !important; }
          h2 { font-size: 0.9rem !important; }
          h3 { font-size: 0.8rem !important; }
          .rental-price-value { font-size: 1.3rem !important; }
          .rental-price-unit { font-size: 0.65rem !important; }
          .rental-stat-grid { grid-template-columns: 1fr 1fr !important; gap: 0.4rem !important; }
          .rental-stat-grid > div { padding: 0.5rem !important; }
          .rental-stat-grid > div div { font-size: 0.7rem !important; }
          .rental-stat-grid > div span { font-size: 0.45rem !important; }
          button { font-size: 0.68rem !important; padding: 0.4rem 0.6rem !important; }
          p { font-size: 0.72rem !important; line-height: 1.4 !important; }
        }
      `}</style>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <button onClick={() => navigate('/rentals')}
          style={{ background: 'none', border: 'none', color: '#1E3A8A', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontWeight: 700, marginBottom: '1.2rem' }}>
          <ArrowLeft size={16} /> BACK TO RENTALS
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '2rem' }} className="rental-detail-grid">
          {/* LEFT: car details */}
          <div>
            <div style={{ background: 'white', borderRadius: '20px', overflow: 'hidden', border: '1px solid #E2E8F0', marginBottom: '1.5rem' }}>
              <div className="rental-main-image" style={{ height: '380px', background: '#F1F5F9' }}>
                {car.images?.[activeImage] ? (
                  <img src={car.images[activeImage]} alt={car.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CBD5E1' }}>
                    <Calendar size={64} />
                  </div>
                )}
              </div>
              {car.images?.length > 1 && (
                <div style={{ display: 'flex', gap: '0.5rem', padding: '0.8rem', overflowX: 'auto' }}>
                  {car.images.map((img, idx) => (
                    <img key={idx} src={img} alt="" onClick={() => setActiveImage(idx)}
                      style={{ width: '70px', height: '50px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: idx === activeImage ? '2px solid #1E3A8A' : '2px solid transparent' }} />
                  ))}
                </div>
              )}
            </div>

            <div className="rental-detail-card" style={{ background: 'white', borderRadius: '20px', padding: '1.5rem', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.8rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                    <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.1rem', fontWeight: 950, color: '#0F172A', lineHeight: 1, letterSpacing: '-0.01em', margin: 0 }}>
                      {car.brand} {car.model}
                    </h1>
                    {car.isFeatured && (
                      <span style={{ background: '#F59E0B', color: 'white', padding: '3px 10px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>★ Featured</span>
                    )}
                  </div>
                  <p style={{ color: '#64748B', fontSize: '0.9rem', fontWeight: 600 }}>{car.year} • {car.title}</p>
                </div>
                {car.registrationNumber && (
                  <span style={{ background: '#0F172A', color: 'white', padding: '0.5rem 0.9rem', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 900, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'Rajdhani, sans-serif', boxShadow: '0 6px 18px rgba(15,23,42,0.18)' }}>
                    <Hash size={14} /> {car.registrationNumber}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.8rem', flexWrap: 'wrap', margin: '1.2rem 0' }}>
                {allowedUnits.includes('day') && car.pricePerDay > 0 && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                    <span className="rental-price-value" style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.1rem', fontWeight: 950, color: '#1E3A8A' }}>₹{car.pricePerDay?.toLocaleString('en-IN')}</span>
                    <span className="rental-price-unit" style={{ color: '#64748B', fontWeight: 700, fontSize: '0.9rem' }}>/ day</span>
                  </div>
                )}
                {allowedUnits.includes('day') && allowedUnits.includes('hour') && car.pricePerDay > 0 && car.pricePerHour > 0 && (
                  <span style={{ color: '#94A3B8', fontWeight: 700, fontSize: '0.95rem', alignSelf: 'baseline' }}>or</span>
                )}
                {allowedUnits.includes('hour') && car.pricePerHour > 0 && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                    <span className="rental-price-value" style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.1rem', fontWeight: 950, color: '#1E3A8A' }}>₹{car.pricePerHour?.toLocaleString('en-IN')}</span>
                    <span className="rental-price-unit" style={{ color: '#64748B', fontWeight: 700, fontSize: '0.9rem' }}>/ hour</span>
                  </div>
                )}
              </div>

              <div className="rental-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.8rem', marginTop: '1.5rem' }}>
                {[
                  { icon: Settings, label: 'Transmission', value: car.transmission?.toUpperCase() },
                  { icon: Fuel, label: 'Fuel', value: car.fuelType?.toUpperCase() },
                  { icon: Users, label: 'Seats', value: car.seats },
                  car.doors && { icon: DoorOpen, label: 'Doors', value: car.doors },
                  car.bodyType && { icon: CarIcon, label: 'Body', value: car.bodyType?.toUpperCase() },
                  car.color && { icon: Palette, label: 'Color', value: car.color },
                  car.mileage && { icon: Gauge, label: 'Mileage', value: car.mileage },
                  car.airbags > 0 && { icon: Shield, label: 'Airbags', value: car.airbags },
                  {
                    icon: Shield,
                    label: 'Security Deposit',
                    value: `₹${(car.securityDeposit || 0).toLocaleString('en-IN')}`,
                    extra: car.securityDepositRefundable !== false ? 'REFUNDABLE' : 'NON-REFUNDABLE',
                    compulsory: car.securityDepositCompulsory !== false
                  },
                ].filter(Boolean).map(({ icon: Icon, label, value, extra, compulsory }) => (
                  <div key={label} style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748B', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Icon size={14} /> {label}
                    </div>
                    <div style={{ marginTop: '0.4rem', fontWeight: 800, color: '#0F172A', fontSize: '0.9rem' }}>{value}</div>
                    <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                      {extra && (
                        <div style={{ fontSize: '0.6rem', fontWeight: 800, color: extra === 'REFUNDABLE' ? '#16A34A' : '#DC2626', background: extra === 'REFUNDABLE' ? '#DCFCE7' : '#FEE2E2', padding: '2px 8px', borderRadius: '999px', letterSpacing: '0.05em' }}>{extra}</div>
                      )}
                      {label === 'Security Deposit' && (
                        <div style={{ fontSize: '0.6rem', fontWeight: 800, color: compulsory ? '#DC2626' : '#16A34A', background: compulsory ? '#FEE2E2' : '#DCFCE7', padding: '2px 8px', borderRadius: '999px', letterSpacing: '0.05em' }}>{compulsory ? 'COMPULSORY' : 'OPTIONAL'}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Vehicle Documents & Identity */}
              {(car.registrationNumber || car.rcNumber || car.chassisNumber || car.engineNumber || car.insuranceValidTill || car.pucValidTill) && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #F1F5F9' }}>
                  <h3 style={{ fontWeight: 900, color: '#0F172A', marginBottom: '0.8rem', fontSize: '0.95rem' }}>Vehicle Documents & Identity</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
                    {car.registrationNumber && (
                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.7rem 0.9rem', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748B', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <Hash size={12} /> Registration No.
                        </div>
                        <div style={{ marginTop: '0.3rem', fontWeight: 800, color: '#0F172A', fontSize: '0.9rem', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.05em' }}>{car.registrationNumber}</div>
                      </div>
                    )}
                    {car.carNumber && (
                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.7rem 0.9rem', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748B', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <CarIcon size={12} /> Car Number
                        </div>
                        <div style={{ marginTop: '0.3rem', fontWeight: 800, color: '#0F172A', fontSize: '0.9rem', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.05em' }}>{car.carNumber}</div>
                      </div>
                    )}
                    {car.rcNumber && (
                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.7rem 0.9rem', borderRadius: '10px' }}>
                        <div style={{ color: '#64748B', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>RC Number</div>
                        <div style={{ marginTop: '0.3rem', fontWeight: 800, color: '#0F172A', fontSize: '0.85rem' }}>{car.rcNumber}</div>
                      </div>
                    )}
                    {car.chassisNumber && (
                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.7rem 0.9rem', borderRadius: '10px' }}>
                        <div style={{ color: '#64748B', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chassis No.</div>
                        <div style={{ marginTop: '0.3rem', fontWeight: 800, color: '#0F172A', fontSize: '0.85rem', wordBreak: 'break-all' }}>{car.chassisNumber}</div>
                      </div>
                    )}
                    {car.engineNumber && (
                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.7rem 0.9rem', borderRadius: '10px' }}>
                        <div style={{ color: '#64748B', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Engine No.</div>
                        <div style={{ marginTop: '0.3rem', fontWeight: 800, color: '#0F172A', fontSize: '0.85rem', wordBreak: 'break-all' }}>{car.engineNumber}</div>
                      </div>
                    )}
                    {car.insuranceValidTill && (
                      <div style={{ background: '#EFF6FF', border: '1px solid rgba(30,58,138,0.15)', padding: '0.7rem 0.9rem', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#1E3A8A', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <Shield size={12} /> Insurance Valid Till
                        </div>
                        <div style={{ marginTop: '0.3rem', fontWeight: 800, color: '#0F172A', fontSize: '0.85rem' }}>{new Date(car.insuranceValidTill).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      </div>
                    )}
                    {car.pucValidTill && (
                      <div style={{ background: '#ECFDF5', border: '1px solid rgba(22,163,74,0.2)', padding: '0.7rem 0.9rem', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#16A34A', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <CheckCircle size={12} /> PUC Valid Till
                        </div>
                        <div style={{ marginTop: '0.3rem', fontWeight: 800, color: '#0F172A', fontSize: '0.85rem' }}>{new Date(car.pucValidTill).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Rental Policy */}
              {(car.minRentalDays || car.maxRentalDays || car.minRentalHours || car.maxRentalHours) && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #F1F5F9' }}>
                  <h3 style={{ fontWeight: 900, color: '#0F172A', marginBottom: '0.8rem', fontSize: '0.95rem' }}>Rental Policy</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {allowedUnits.includes('day') && (
                      <span style={{ background: '#EFF6FF', color: '#1E3A8A', padding: '0.5rem 0.9rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Calendar size={12} /> {car.minRentalDays || 1}–{car.maxRentalDays || 30} day(s)
                      </span>
                    )}
                    {allowedUnits.includes('hour') && (
                      <span style={{ background: '#EFF6FF', color: '#1E3A8A', padding: '0.5rem 0.9rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Clock size={12} /> {car.minRentalHours || 1}–{car.maxRentalHours || 24} hour(s)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Comfort & convenience */}
              {(car.airConditioning || car.gps || car.bluetooth || car.musicSystem || car.powerWindows || car.powerSteering) && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #F1F5F9' }}>
                  <h3 style={{ fontWeight: 900, color: '#0F172A', marginBottom: '0.8rem', fontSize: '0.95rem' }}>Comfort & Convenience</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {[
                      [car.airConditioning, Wind, 'Air Conditioning'],
                      [car.gps, Navigation, 'GPS / Navigation'],
                      [car.bluetooth, Bluetooth, 'Bluetooth'],
                      [car.musicSystem, Music, 'Music System'],
                      [car.powerWindows, CheckCircle, 'Power Windows'],
                      [car.powerSteering, CheckCircle, 'Power Steering'],
                    ].filter(([on]) => on).map(([, Icon, lbl], i) => (
                      <span key={i} style={{ background: '#EFF6FF', color: '#1E3A8A', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Icon size={12} /> {lbl}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {car.description && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #F1F5F9' }}>
                  <h3 style={{ fontWeight: 900, color: '#0F172A', marginBottom: '0.6rem', fontSize: '0.95rem' }}>About this car</h3>
                  <p style={{ color: '#475569', lineHeight: 1.7, fontWeight: 500 }}>{car.description}</p>
                </div>
              )}

              {car.features?.length > 0 && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #F1F5F9' }}>
                  <h3 style={{ fontWeight: 900, color: '#0F172A', marginBottom: '0.8rem', fontSize: '0.95rem' }}>Features</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {car.features.map((f, i) => (
                      <span key={i} style={{ background: '#EFF6FF', color: '#1E3A8A', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <CheckCircle size={12} /> {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {isSameLocation ? (
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: '#475569', fontWeight: 700 }}>
                    <MapPin size={16} style={{ color: '#1E3A8A', flexShrink: 0, marginTop: '2px' }} />
                    <span><strong style={{ color: '#0F172A' }}>Pickup & Drop:</strong> {pickupFull}</span>
                  </div>
                </div>
              ) : (
                (car.location?.city || car.dropLocation?.city) && (
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                      {car.location?.city && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: '#475569', fontWeight: 700 }}>
                          <MapPin size={16} style={{ color: '#1E3A8A', flexShrink: 0, marginTop: '2px' }} />
                          <span><strong style={{ color: '#0F172A' }}>Pickup:</strong> {pickupFull}</span>
                        </div>
                      )}
                      {car.dropLocation?.city && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: '#475569', fontWeight: 700 }}>
                          <MapPin size={16} style={{ color: '#16A34A', flexShrink: 0, marginTop: '2px' }} />
                          <span><strong style={{ color: '#0F172A' }}>Drop:</strong> {dropFull}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* RIGHT: Booking form */}
          <form onSubmit={handleSubmit} className="rental-form-card" style={{ background: 'white', borderRadius: '20px', padding: '1.5rem', border: '1px solid #E2E8F0', height: 'fit-content' }}>
            <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.3rem', fontWeight: 950, color: '#0F172A', marginBottom: '1rem', letterSpacing: '0.01em' }}>
              BOOK THIS CAR
            </h2>

            {allowedUnits.length > 1 && (
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', background: '#F1F5F9', borderRadius: '10px', padding: '4px' }}>
                {allowedUnits.map(u => (
                  <button key={u} type="button" onClick={() => setForm({ ...form, rentalUnit: u })}
                    style={{
                      flex: 1, padding: '0.5rem 0.6rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
                      background: unit === u ? '#1E3A8A' : 'transparent',
                      color: unit === u ? 'white' : '#475569',
                      fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                      transition: 'all 0.2s'
                    }}>
                    BY {u}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <div>
                <label style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 800, marginBottom: '0.3rem', display: 'block' }}>PICKUP DATE</label>
                <input type="date" required min={today} value={form.pickupDate}
                  onChange={e => setForm({ ...form, pickupDate: e.target.value })}
                  className="input-light" style={{ height: '42px' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 800, marginBottom: '0.3rem', display: 'block' }}>RETURN DATE</label>
                <input type="date" required min={form.pickupDate} value={form.returnDate}
                  onChange={e => setForm({ ...form, returnDate: e.target.value })}
                  className="input-light" style={{ height: '42px' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 800, marginBottom: '0.3rem', display: 'block' }}>PICKUP TIME</label>
                <input type="time" value={form.pickupTime}
                  onChange={e => setForm({ ...form, pickupTime: e.target.value })}
                  className="input-light" style={{ height: '42px' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 800, marginBottom: '0.3rem', display: 'block' }}>RETURN TIME</label>
                <input type="time" value={form.returnTime}
                  onChange={e => setForm({ ...form, returnTime: e.target.value })}
                  className="input-light" style={{ height: '42px' }} />
              </div>
            </div>

            <label style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 800, marginBottom: '0.3rem', display: 'block' }}>FULL NAME *</label>
            <input required placeholder="Your Full Name" value={form.fullName}
              onChange={e => setForm({ ...form, fullName: e.target.value })}
              className="input-light" style={{ height: '42px', marginBottom: '0.8rem' }} />

            <label style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 800, marginTop: '0.4rem', marginBottom: '0.3rem', display: 'block' }}>CONTACT PHONE *</label>
            <input required type="tel" placeholder="10-digit mobile" value={form.contactPhone}
              onChange={e => setForm({ ...form, contactPhone: e.target.value })}
              className="input-light" style={{ height: '42px', marginBottom: '0.8rem' }} />


            {/* KYC Section */}
            <div style={{ background: '#FFFBEB', borderRadius: '12px', padding: '0.9rem', border: '1px solid #FDE68A', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.7rem' }}>
                <Shield size={14} style={{ color: '#B45309' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#92400E', letterSpacing: '0.04em' }}>KYC VERIFICATION (REQUIRED)</span>
              </div>

              <label style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 800, marginBottom: '0.3rem', display: 'block' }}>DRIVING LICENSE NUMBER *</label>
              <input required placeholder="e.g. DL01-20211234567" value={form.driverLicense}
                maxLength={16}
                onChange={e => setForm({ ...form, driverLicense: e.target.value.toUpperCase() })}
                className="input-light" style={{ height: '40px', marginBottom: '0.6rem', textTransform: 'uppercase' }} />

              <label style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 800, marginBottom: '0.3rem', display: 'block' }}>AADHAR NUMBER *</label>
              <input required placeholder="12-digit Aadhar" maxLength={14}
                value={form.aadharNumber}
                onChange={e => setForm({ ...form, aadharNumber: e.target.value.replace(/[^0-9 ]/g, '') })}
                className="input-light" style={{ height: '40px', marginBottom: '0.6rem' }} />

              <label style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 800, marginBottom: '0.3rem', display: 'block' }}>PAN NUMBER *</label>
              <input required placeholder="ABCDE1234F" maxLength={10}
                value={form.panNumber}
                onChange={e => setForm({ ...form, panNumber: e.target.value.toUpperCase() })}
                className="input-light" style={{ height: '40px', marginBottom: '0.7rem', textTransform: 'uppercase' }} />

              {[
                ['AADHAR CARD IMAGE *', aadharImage, setAadharImage],
                ['PAN CARD IMAGE *', panImage, setPanImage],
                ['LICENSE IMAGE *', licenseImage, setLicenseImage],
              ].map(([label, file, setter], i) => (
                <div key={i} style={{ marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 800, marginBottom: '0.25rem', display: 'block' }}>{label}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input type="file" accept="image/*,application/pdf"
                      onChange={e => setter(e.target.files?.[0] || null)}
                      style={{ flex: 1, fontSize: '0.7rem', padding: '0.3rem', background: 'white', border: '1px dashed #FCD34D', borderRadius: '8px' }} />
                    {file && (
                      <span style={{ fontSize: '0.65rem', color: '#16A34A', fontWeight: 800, whiteSpace: 'nowrap' }}>✓ {file.name.length > 14 ? file.name.slice(0, 12) + '…' : file.name}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Payment Plan picker */}
            <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '0.85rem', border: '1px solid #E2E8F0', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                <Shield size={14} style={{ color: '#1E3A8A' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#0F172A', letterSpacing: '0.04em' }}>PAYMENT PLAN</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {[
                  {
                    key: 'full',
                    title: 'Pay Full Amount Now',
                    sub: `₹${totalAmount.toLocaleString('en-IN')} via Razorpay`,
                  },
                  {
                    key: 'advance',
                    title: 'Pay Advance Now, Balance at Pickup',
                    sub: `₹${advanceDefault.toLocaleString('en-IN')} now • ₹${Math.max(0, totalAmount - advanceDefault).toLocaleString('en-IN')} at pickup`,
                  },
                ].map(opt => {
                  const active = form.paymentPlan === opt.key;
                  return (
                    <label key={opt.key}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer',
                        padding: '0.55rem 0.7rem', borderRadius: '10px',
                        background: active ? '#EFF6FF' : 'white',
                        border: active ? '1.5px solid #1E3A8A' : '1px solid #E2E8F0',
                        transition: 'all 0.15s',
                      }}>
                      <input type="radio" name="paymentPlan" value={opt.key}
                        checked={active}
                        onChange={() => setForm({ ...form, paymentPlan: opt.key })}
                        style={{ marginTop: 3, accentColor: '#1E3A8A' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, color: active ? '#1E3A8A' : '#0F172A', fontSize: '0.82rem' }}>{opt.title}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600, marginTop: '2px' }}>{opt.sub}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {form.paymentPlan !== 'on_drop' && (
                <p style={{ fontSize: '0.65rem', color: '#64748B', marginTop: '0.6rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Shield size={11} style={{ color: '#1E3A8A' }} /> Razorpay encrypted checkout
                </p>
              )}
            </div>

            <label style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 800, marginBottom: '0.3rem', display: 'block' }}>NOTES (OPTIONAL)</label>
            <textarea value={form.notes} rows={2}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="input-light" style={{ minHeight: '60px', padding: '0.6rem 0.8rem', marginBottom: '1rem', resize: 'vertical', fontSize: '0.85rem' }} />

            {/* Price Summary */}
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '1rem', marginBottom: '1rem' }}>
              {car.carNumber && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 800, color: '#1E3A8A', marginBottom: '0.8rem', borderBottom: '1px dashed #E2E8F0', paddingBottom: '0.6rem' }}>
                  <span>CAR NUMBER</span>
                  <span>{car.carNumber}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>
                <span>
                  {unit === 'hour'
                    ? `₹${car.pricePerHour?.toLocaleString('en-IN')} × ${totalHours} hour(s)`
                    : `₹${car.pricePerDay?.toLocaleString('en-IN')} × ${totalDays} day(s)`}
                </span>
                <span>₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              {car.securityDeposit > 0 && (
                <>
                  {/* Opt-in toggle when deposit is optional */}
                  {!depositCompulsory && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.7rem', marginBottom: '0.4rem', background: includeSecurityDeposit ? '#EFF6FF' : '#F8FAFC', border: '1.5px solid', borderColor: includeSecurityDeposit ? '#1E3A8A' : '#E2E8F0', borderRadius: '10px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={includeSecurityDeposit}
                        onChange={e => setIncludeSecurityDeposit(e.target.checked)}
                        style={{ accentColor: '#1E3A8A', width: 16, height: 16 }} />
                      <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 800, color: '#0F172A' }}>
                        Add security deposit
                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#16A34A', background: '#DCFCE7', padding: '2px 6px', borderRadius: '999px', letterSpacing: '0.04em', marginLeft: '0.4rem' }}>OPTIONAL</span>
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569' }}>+₹{car.securityDeposit.toLocaleString('en-IN')}</span>
                    </label>
                  )}
                  {(depositCompulsory || includeSecurityDeposit) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        Security Deposit
                        {depositCompulsory && (
                          <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#DC2626', background: '#FEE2E2', padding: '2px 6px', borderRadius: '999px', letterSpacing: '0.04em' }}>COMPULSORY</span>
                        )}
                        {car.securityDepositRefundable !== false && (
                          <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#16A34A', background: '#DCFCE7', padding: '2px 6px', borderRadius: '999px', letterSpacing: '0.04em' }}>REFUNDABLE</span>
                        )}
                      </span>
                      <span>₹{car.securityDeposit.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E2E8F0', paddingTop: '0.6rem', marginTop: '0.4rem' }}>
                <span style={{ fontWeight: 900, color: '#0F172A', fontSize: '0.85rem' }}>TOTAL</span>
                <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.3rem', fontWeight: 950, color: '#1E3A8A' }}>₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
              {form.paymentPlan !== 'full' && (
                <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px dashed #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 800, color: '#1E3A8A' }}>
                    <span>You pay now</span>
                    <span>₹{payNow.toLocaleString('en-IN')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 800, color: '#16A34A', marginTop: '0.2rem' }}>
                    <span>Due at drop</span>
                    <span>₹{dueAtDrop.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" disabled={submitting || (car.status && car.status !== 'available')}
              style={{ width: '100%', background: (!car.status || car.status === 'available') ? '#1E3A8A' : '#94A3B8', color: 'white', border: 'none', borderRadius: '12px', padding: '0.8rem', fontWeight: 900, fontSize: '0.9rem', cursor: (!car.status || car.status === 'available') && !submitting ? 'pointer' : 'not-allowed', letterSpacing: '0.1em', fontFamily: 'Rajdhani, sans-serif' }}>
              {(car.status && car.status !== 'available')
                ? 'CURRENTLY UNAVAILABLE'
                : submitting ? 'PROCESSING...'
                : form.paymentPlan === 'on_drop' ? 'CONFIRM BOOKING'
                : form.paymentPlan === 'advance' ? `PAY ₹${payNow.toLocaleString('en-IN')} ADVANCE`
                : `PAY ₹${payNow.toLocaleString('en-IN')} NOW`}
            </button>

            <p style={{ fontSize: '0.72rem', color: '#94A3B8', textAlign: 'center', marginTop: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'center' }}>
              <Clock size={11} /> Booking is confirmed by admin after payment
            </p>
          </form>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .rental-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
