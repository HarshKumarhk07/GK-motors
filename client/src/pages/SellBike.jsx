import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { createSellRequest, getPriceEstimate } from '../api/storeApi';
import toast from 'react-hot-toast';
import { Upload, Camera, Loader, IndianRupee, CheckCircle, Clock, Truck, ArrowRight } from 'lucide-react';

const BRANDS = ['Mercedes-Benz', 'BMW', 'Audi', 'Porsche', 'Toyota', 'Honda', 'Hyundai', 'Tata', 'Mahindra', 'Kia', 'Volkswagen', 'Skoda', 'Other'];
const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'];
const TRANSMISSIONS = ['Manual', 'Automatic'];
const OWNER_NUMBERS = ['1st', '2nd', '3rd', '4th', '4th+'];
const BODY_TYPES = ['Sedan', 'SUV', 'Hatchback', 'MPV', 'Coupe', 'Convertible', 'Luxury'];
const STATES = ['Delhi', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Haryana', 'Uttar Pradesh', 'Rajasthan', 'Other'];

export default function SellBike() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [estimatedPrice, setEstimatedPrice] = useState(null);
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm();



  const handleEstimate = async () => {
    if (!user) {
      toast.error('Please login first to appraise your car');
      return;
    }
    const formData = watch();
    if (!formData.brand || !formData.model || !formData.year || !formData.kmDriven || !formData.fuelType || !formData.transmission || !formData.variant || !formData.ownerNumber) {
      toast.error('Fill all required technical fields first');
      return;
    }
    try {
      const { data } = await getPriceEstimate({
        brand: formData.brand, model: formData.model, year: formData.year,
        kmDriven: formData.kmDriven, fuelType: formData.fuelType, transmission: formData.transmission,
        variant: formData.variant, ownerNumber: formData.ownerNumber
      });
      setEstimatedPrice(data.estimatedPrice);
    } catch { toast.error('Estimation failed'); }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const newImages = [...images, ...files].slice(0, 10);
    setImages(newImages);

    const previews = newImages.map(file => URL.createObjectURL(file));
    setImagePreviews(previews);
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImages(newImages);
    setImagePreviews(newPreviews);
  };

  const onSubmit = async (data) => {
    if (!user) {
      toast.error('Please login first to sell your car');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      // Build pickup address object
      const pickupAddress = { street: data.pickupStreet, city: data.pickupCity, state: data.pickupState, pincode: data.pickupPincode };
      // Append standard fields
      Object.keys(data).forEach(key => {
        if (['pickupStreet', 'pickupCity', 'pickupState', 'pickupPincode', 'features'].includes(key)) return;
        if (data[key] !== undefined && data[key] !== null) {
          formData.append(key, data[key]);
        }
      });

      formData.append('pickupAddress', JSON.stringify(pickupAddress));
      if (data.features) formData.append('features', JSON.stringify(data.features));
      
      images.forEach((img) => formData.append('images', img));
      await createSellRequest(formData);
      setStep(3);
      toast.success('Sell request submitted!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      <style>{`
        @media (max-width: 640px) {
          .sell-form-grid { grid-template-columns: 1fr !important; }
          .sell-pickup-grid { grid-template-columns: 1fr !important; }
          .sell-header h1 { font-size: 1.8rem !important; }
          .sell-header p { font-size: 0.9rem !important; }
        }
      `}</style>
      <div style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', padding: '3.5rem 0' }}>
        <div className="max-w-3xl mx-auto px-4">
          <div className="animate-fadeInUp sell-header" style={{ textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 'clamp(2rem, 5vw, 3.8rem)', fontWeight: 900, color: '#0F172A', lineHeight: 1.1, marginBottom: '0.8rem' }}>
              SELL YOUR <span style={{ color: '#1E3A8A' }}>CAR INSTANTLY</span>
            </h1>
            <p style={{ color: '#64748B', fontSize: '1.15rem', fontWeight: 600, letterSpacing: '0.02em', maxWidth: '550px', margin: '0 auto' }}>Get a premium market appraisal and sell your vehicle in under 60 minutes.</p>
          </div>
        </div>
      </div>
 
      <div className="max-w-3xl mx-auto px-4 py-6">
        {step === 1 && (
          <div className="animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
            {/* USPs */}
            <div className="sell-usp-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                { title: 'Premium Valuation', desc: 'Precision market-driven pricing' },
                { title: 'Secure Home Pickup', desc: 'We handle everything at your doorstep' },
                { title: 'Instant Settlement', desc: 'Funds cleared within 60 minutes' },
              ].map(({ title, desc }) => (
                <div key={title} style={{ textAlign: 'center', padding: '1.2rem 1rem', background: '#FFF', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', transition: 'all 0.3s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.borderColor = '#1E3A8A'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(30, 58, 138, 0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.02)'; }}>
                  <div style={{ color: '#111', fontWeight: 800, fontSize: '0.85rem', fontFamily: 'Rajdhani, sans-serif', marginBottom: '0.1rem' }}>{title.toUpperCase()}</div>
                  <div style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600 }}>{desc}</div>
                </div>
              ))}
            </div>
 
            <form onSubmit={handleSubmit(onSubmit)} style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '2rem', boxShadow: '0 20px 60px rgba(15, 23, 42, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '2rem' }}>
                <div style={{ width: 5, height: 26, background: '#1E3A8A', borderRadius: '4px' }} />
                <h3 style={{ color: '#0F172A', fontFamily: 'Rajdhani, sans-serif', fontSize: '1.6rem', fontWeight: 900, margin: 0, letterSpacing: '0.05em' }}>VEHICLE SPECIFICATIONS</h3>
              </div>
 
              <div className="sell-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ color: '#666', fontSize: '0.65rem', fontWeight: 800, display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Brand *</label>
                  <select className="input-light" style={{ borderRadius: '10px', fontWeight: 600, height: '42px', fontSize: '0.8rem', padding: '0 0.8rem' }} {...register('brand', { required: 'Required' })}>
                    <option value="">Select Brand</option>
                    {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color: '#666', fontSize: '0.65rem', fontWeight: 800, display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Model *</label>
                  <input className="input-light" style={{ borderRadius: '10px', fontWeight: 600, height: '42px', fontSize: '0.8rem', padding: '0 0.8rem' }} placeholder="e.g. C-Class" {...register('model', { required: 'Required' })} />
                </div>
                <div>
                  <label style={{ color: '#666', fontSize: '0.65rem', fontWeight: 800, display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Variant *</label>
                  <input className="input-light" style={{ borderRadius: '10px', fontWeight: 600, height: '42px', fontSize: '0.8rem', padding: '0 0.8rem' }} placeholder="e.g. C200" {...register('variant', { required: 'Required' })} />
                </div>
                <div>
                  <label style={{ color: '#666', fontSize: '0.65rem', fontWeight: 800, display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fuel Type *</label>
                  <select className="input-light" style={{ borderRadius: '10px', fontWeight: 600, height: '42px', fontSize: '0.8rem', padding: '0 0.8rem' }} {...register('fuelType', { required: 'Required' })}>
                    <option value="">Select Fuel</option>
                    {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color: '#666', fontSize: '0.65rem', fontWeight: 800, display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transmission *</label>
                  <select className="input-light" style={{ borderRadius: '10px', fontWeight: 600, height: '42px', fontSize: '0.8rem', padding: '0 0.8rem' }} {...register('transmission', { required: 'Required' })}>
                    <option value="">Select Gearbox</option>
                    {TRANSMISSIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color: '#666', fontSize: '0.65rem', fontWeight: 800, display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reg. Year *</label>
                  <input type="number" className="input-light" style={{ borderRadius: '10px', fontWeight: 600, height: '42px', fontSize: '0.8rem', padding: '0 0.8rem' }} placeholder="Year" {...register('year', { required: 'Required' })} />
                </div>
                <div>
                  <label style={{ color: '#666', fontSize: '0.65rem', fontWeight: 800, display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>KM Driven *</label>
                  <input type="number" className="input-light" style={{ borderRadius: '10px', fontWeight: 600, height: '42px', fontSize: '0.8rem', padding: '0 0.8rem' }} placeholder="KM" {...register('kmDriven', { required: 'Required' })} />
                </div>
                <div>
                  <label style={{ color: '#666', fontSize: '0.65rem', fontWeight: 800, display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Owner Number *</label>
                  <select className="input-light" style={{ borderRadius: '10px', fontWeight: 600, height: '42px', fontSize: '0.8rem', padding: '0 0.8rem' }} {...register('ownerNumber', { required: 'Required' })}>
                    <option value="">Select Owners</option>
                    {OWNER_NUMBERS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color: '#666', fontSize: '0.65rem', fontWeight: 800, display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registration State *</label>
                  <select className="input-light" style={{ borderRadius: '10px', fontWeight: 600, height: '42px', fontSize: '0.8rem', padding: '0 0.8rem' }} {...register('registrationState', { required: 'Required' })}>
                    <option value="">Select State</option>
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color: '#666', fontSize: '0.65rem', fontWeight: 800, display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seating Capacity *</label>
                  <input type="number" className="input-light" style={{ borderRadius: '10px', fontWeight: 600, height: '42px', fontSize: '0.8rem', padding: '0 0.8rem' }} placeholder="e.g. 5" {...register('seatingCapacity', { required: 'Required' })} />
                </div>
                <div>
                  <label style={{ color: '#666', fontSize: '0.65rem', fontWeight: 800, display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Body Type *</label>
                  <select className="input-light" style={{ borderRadius: '10px', fontWeight: 600, height: '42px', fontSize: '0.8rem', padding: '0 0.8rem' }} {...register('bodyType', { required: 'Required' })}>
                    <option value="">Select Body</option>
                    {BODY_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color: '#666', fontSize: '0.65rem', fontWeight: 800, display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Color *</label>
                  <input className="input-light" style={{ borderRadius: '10px', fontWeight: 600, height: '42px', fontSize: '0.8rem', padding: '0 0.8rem' }} placeholder="e.g. Silver" {...register('color', { required: 'Required' })} />
                </div>
              </div>

              <div style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.2rem' }}>
                  <div style={{ width: 5, height: 26, background: '#1E3A8A', borderRadius: '4px' }} />
                  <h3 style={{ color: '#0F172A', fontFamily: 'Rajdhani, sans-serif', fontSize: '1.4rem', fontWeight: 900, margin: 0, letterSpacing: '0.05em' }}>PREMIUM FEATURES</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', background: '#F8FAFC', padding: '1.2rem', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                  {['Airbags', 'ABS', 'Sunroof', 'Touchscreen', 'Parking Camera', 'Alloy Wheels'].map(feature => (
                    <label key={feature} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                      <input type="checkbox" {...register(`features.${feature.toLowerCase().replace(' ', '')}`)} style={{ accentColor: '#1E3A8A', width: 18, height: 18 }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>{feature}</span>
                    </label>
                  ))}
                </div>
                <div className="sell-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div>
                    <label style={{ color: '#666', fontSize: '0.65rem', fontWeight: 800, display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Insurance Valid Till</label>
                    <input type="date" className="input-light" style={{ borderRadius: '10px', fontWeight: 600, height: '42px', fontSize: '0.8rem', padding: '0 0.8rem' }} {...register('insuranceTill')} />
                  </div>
                  <div>
                    <label style={{ color: '#666', fontSize: '0.65rem', fontWeight: 800, display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Service History *</label>
                    <select className="input-light" style={{ borderRadius: '10px', fontWeight: 600, height: '42px', fontSize: '0.8rem', padding: '0 0.8rem' }} {...register('serviceHistory', { required: 'Required' })}>
                      <option value="available">Full Service History</option>
                      <option value="partial">Partial History</option>
                      <option value="not_available">Not Available</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '0.8rem' }}>
                <label style={{ color: '#666', fontSize: '0.65rem', fontWeight: 800, display: 'block', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</label>
                <textarea className="input-light" style={{ borderRadius: '12px', fontWeight: 600, padding: '0.5rem 0.75rem', minHeight: '50px', fontSize: '0.75rem' }} rows={2} placeholder="History..." {...register('description')} />
              </div>

              {/* Instant Estimate */}
              <div style={{ marginTop: '1rem', padding: '0.8rem', background: '#F9F9F9', borderRadius: '14px', border: '1.5px solid #EEE' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
                  <div>
                    <div style={{ color: '#888', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.1rem' }}>VALUATION</div>
                    {estimatedPrice ? (
                      <div className="animate-fadeIn" style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2rem', fontWeight: 950, color: '#10B981', lineHeight: 1 }}>
                        ₹{estimatedPrice.toLocaleString('en-IN')}
                      </div>
                    ) : (
                      <div style={{ color: '#AAA', fontSize: '0.8rem', fontWeight: 600 }}>Calculating...</div>
                    )}
                  </div>
                  <button type="button" onClick={handleEstimate}
                    style={{ height: '44px', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1.2rem', background: '#1E3A8A', borderRadius: '10px', color: 'white', cursor: 'pointer', fontWeight: 800, border: 'none', transition: 'all 0.3s', fontSize: '0.8rem', boxShadow: '0 6px 12px rgba(30, 58, 138, 0.15)' }}>
                    <IndianRupee size={14} /> GET ESTIMATE
                  </button>
                </div>
              </div>

              {/* Image Upload */}
              <div style={{ marginTop: '1rem' }}>
                <label style={{ color: '#666', fontSize: '0.65rem', fontWeight: 800, display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Photos (max 10)
                </label>
                <label style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '1rem 0.8rem', border: '2px dashed #EEE', borderRadius: '14px', cursor: 'pointer',
                  background: '#F9F9F9', transition: 'all 0.3s',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1E3A8A'; e.currentTarget.style.background = '#FFF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#F8FAFC'; }}>
                  <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'rgba(30, 58, 138, 0.1)', color: '#1E3A8A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                    <Camera size={22} />
                  </div>
                  <span style={{ color: '#111', fontSize: '0.85rem', fontWeight: 800 }}>Browse Photos</span>
                  <input type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
                </label>

                {/* Previews Display */}
                {imagePreviews.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.6rem', marginTop: '1rem' }}>
                    {imagePreviews.map((src, idx) => (
                      <div key={idx} style={{ position: 'relative', width: '100%', paddingBottom: '100%', borderRadius: '12px', overflow: 'hidden', border: '1.5px solid #EEE' }}>
                        <img src={src} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button type="button" onClick={() => removeImage(idx)}
                          style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px' }}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pickup Address */}
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#FFF', borderRadius: '16px', border: '1.5px solid #EEE' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                  <Truck size={14} style={{ color: '#1E3A8A' }} />
                  <span style={{ color: '#111', fontWeight: 800, fontSize: '0.85rem', fontFamily: 'Rajdhani, sans-serif' }}>PICKUP DETAILS</span>
                </div>
                <div className="sell-pickup-grid" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.5fr 0.8fr', gap: '0.5rem' }}>
                  <input className="input-light" style={{ borderRadius: '8px', fontWeight: 600, height: '36px', fontSize: '0.75rem' }} placeholder="Address" {...register('pickupStreet')} />
                  <input className="input-light" style={{ borderRadius: '8px', fontWeight: 600, height: '36px', fontSize: '0.75rem' }} placeholder="City" {...register('pickupCity')} />
                  <input className="input-light" style={{ borderRadius: '8px', fontWeight: 600, height: '36px', fontSize: '0.75rem' }} placeholder="Pin" {...register('pickupPincode')} />
                </div>
              </div>

              <div style={{ marginTop: '1rem', padding: '0.8rem 1rem', background: '#F8FAFC', borderRadius: '14px', border: '1px solid rgba(30, 58, 138, 0.1)', display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', width: '100%' }}>
                  <input type="checkbox" {...register('isOneHourSell')} style={{ accentColor: '#1E3A8A', width: 20, height: 20, cursor: 'pointer' }} />
                  <div>
                    <div style={{ color: '#0F172A', fontWeight: 900, fontSize: '0.85rem', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.05em' }}>ACTIVATE EXPRESS SALE</div>
                    <div style={{ color: '#64748B', fontSize: '0.65rem', fontWeight: 600 }}>Get priority appraisal within 15 minutes</div>
                  </div>
                </label>
              </div>

              <button type="submit" className="btn-primary" style={{ height: '48px', width: '100%', justifyContent: 'center', padding: '0.4rem', marginTop: '1.2rem', fontSize: '1.05rem', fontWeight: 900, borderRadius: '12px', letterSpacing: '0.05em', background: 'linear-gradient(135deg, #1E3A8A, #172554)', border: 'none', boxShadow: '0 6px 15px rgba(30, 58, 138, 0.2)', fontFamily: 'Rajdhani, sans-serif' }} disabled={submitting}>
                {submitting ? <Loader size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : <><Upload size={16} /> SUBMIT REQUEST</>}
              </button>
            </form>
          </div>
        )}
 
        {step === 3 && (
          <div className="animate-scaleIn" style={{ textAlign: 'center', padding: '5rem 2rem', background: '#FFF', borderRadius: '24px', border: '1px solid #E2E8F0', boxShadow: '0 25px 80px rgba(0,0,0,0.05)', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(30, 58, 138, 0.08)', color: '#1E3A8A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <CheckCircle size={48} />
            </div>
            <h2 style={{ color: '#0F172A', fontFamily: 'Rajdhani, sans-serif', fontSize: '2.2rem', fontWeight: 950, marginBottom: '0.6rem', lineHeight: 1, letterSpacing: '0.02em' }}>SUCCESSFULLY LISTED!</h2>
            <p style={{ color: '#64748B', fontSize: '1rem', fontWeight: 600, maxWidth: '440px', margin: '0 auto 2rem', lineHeight: 1.5 }}>Our experts are reviewing your submission. You will receive a premium offer within <span style={{ color: '#1E3A8A', fontWeight: 900 }}>30 minutes</span>.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/my-bookings')} className="btn-primary" style={{ height: '52px', padding: '0 2rem', borderRadius: '12px', fontWeight: 900, background: '#1E3A8A', border: 'none', boxShadow: '0 6px 15px rgba(30, 58, 138, 0.15)', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.9rem', letterSpacing: '0.05em' }}>MY SELL REQUESTS</button>
              <button onClick={() => navigate('/')} className="btn-outline" style={{ height: '52px', padding: '0 2rem', borderRadius: '12px', fontWeight: 900, border: '2px solid #1E3A8A', color: '#1E3A8A', background: 'transparent', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.9rem', letterSpacing: '0.05em' }}>BACK TO HOME</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

