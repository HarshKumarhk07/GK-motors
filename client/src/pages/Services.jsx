import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Wrench, Wind, Battery, CircleDot, Paintbrush, Sparkles, Droplets,
  Search, Sun, Settings, Cog, Shield, ChevronLeft, ArrowRight, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useServiceCart } from '../context/CartContext';
import { getServiceCategories } from '../api/serviceApi';
import { reportApiError } from '../api/apiError';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CategoryIcon, { categoryImageFrom } from '../components/service/CategoryIcon';
import CarSelector from '../components/service/CarSelector';
import ServiceSelector from '../components/service/ServiceSelector';
import ServiceCart from '../components/service/ServiceCart';
import CheckoutModal from '../components/service/CheckoutModal';

/**
 * The 12 GK Motors service categories.
 * `id` must stay in sync with categoryId in
 * server/src/seeds/seedServicePackages.js — that is the join key between the
 * icons/copy here and the bookable packages in the database.
 */
const serviceCategories = [
  { id: 1, slug: 'car-service', name: 'Car Service', icon: Wrench, description: 'Periodic maintenance & oil change' },
  { id: 2, slug: 'ac-service', name: 'AC Service & Repair', icon: Wind, description: 'AC gas refill, cooling check' },
  { id: 3, slug: 'batteries', name: 'Batteries', icon: Battery, description: 'Battery replacement & testing' },
  { id: 4, slug: 'tyres-wheel-care', name: 'Tyre & Wheel Care', icon: CircleDot, description: 'Tyre rotation, alignment, balancing' },
  { id: 5, slug: 'denting-painting', name: 'Denting & Painting', icon: Paintbrush, description: 'Dent removal & premium painting' },
  { id: 6, slug: 'detailing-service', name: 'Detailing Service', icon: Sparkles, description: 'Interior & exterior deep cleaning' },
  { id: 7, slug: 'car-spa-cleaning', name: 'Car Spa & Cleaning', icon: Droplets, description: 'Washing, waxing & polishing' },
  { id: 8, slug: 'car-inspections', name: 'Car Inspection', icon: Search, description: 'Comprehensive vehicle checkup' },
  { id: 9, slug: 'windshields-lights', name: 'Windshield & Light', icon: Sun, description: 'Glass repair & headlight restoration' },
  { id: 10, slug: 'suspension-fitments', name: 'Suspension & Fitments', icon: Settings, description: 'Suspension repair & accessories' },
  { id: 11, slug: 'clutch-body-parts', name: 'Clutch & Body Parts', icon: Cog, description: 'Clutch replacement & body repair' },
  { id: 12, slug: 'insurance-claims', name: 'Insurance Claims', icon: Shield, description: 'Insurance claim assistance' },
];

export default function Services() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { car, services, setCar } = useServiceCart();

  const [step, setStep] = useState(1);                 // 1 = categories, 2 = car + packages
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [changingCar, setChangingCar] = useState(false);

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const fetchCatalogue = () => {
    setLoading(true);
    setLoadError('');
    getServiceCategories()
      .then(({ data }) => setPackages(data.categories || []))
      .catch((err) => setLoadError(reportApiError('Services.getServiceCategories', err, 'Could not load our services')))
      .finally(() => setLoading(false));
  };

  useEffect(fetchCatalogue, []);

  // Deep link from the home page: /services?category=3
  useEffect(() => {
    const id = Number(searchParams.get('category'));
    if (!id) return;
    const match = serviceCategories.find((c) => c.id === id);
    if (match) {
      setSelectedCategory(match);
      setStep(2);
    }
  }, [searchParams]);

  const packagesByCategory = useMemo(() => {
    const map = new Map();
    packages.forEach((p) => {
      if (p.categoryId == null) return;
      if (!map.has(p.categoryId)) map.set(p.categoryId, []);
      map.get(p.categoryId).push(p);
    });
    return map;
  }, [packages]);

  const openCategory = (category) => {
    setSelectedCategory(category);
    setStep(2);
    setSearchParams({ category: String(category.id) }, { replace: true });
  };

  const backToCategories = () => {
    setStep(1);
    setSelectedCategory(null);
    setChangingCar(false);
    searchParams.delete('category');
    setSearchParams(searchParams, { replace: true });
  };

  const handleCarSelect = (carData) => {
    setCar(carData);
    setChangingCar(false);
    toast.success(`${carData.brand} ${carData.model} selected`);
  };

  const handleCheckout = () => {
    if (!user) {
      toast.error('Please login to book a service');
      navigate('/login?redirect=/services');
      return;
    }
    if (!car) {
      toast.error('Please select your car first');
      return;
    }
    if (!services.length) {
      toast.error('Add at least one service to continue');
      return;
    }
    setShowCheckout(true);
  };

  const needsCar = !car || changingCar;

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      <style>{`
        @media (max-width: 900px) {
          .gk-svc-layout { flex-direction: column !important; }
          .gk-svc-cart { width: 100% !important; }
        }
        @media (max-width: 640px) {
          .gk-svc-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 0.6rem !important; }
          .gk-svc-head h1 { font-size: 1.45rem !important; }
        }
      `}</style>

      {/* Header */}
      <div className="gk-svc-head" style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)', padding: '2rem 0 2.4rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1.5rem' }}>
          <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 'clamp(1.5rem, 3vw, 2.1rem)', fontWeight: 900, color: '#FFF', letterSpacing: '-0.01em', marginBottom: '0.35rem' }}>
            Book a Service
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '0.85rem', fontWeight: 500 }}>
            Pick what your car needs, choose a slot, and we'll take it from there.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 1.5rem 3rem' }}>
        {loadError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '14px', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
            <AlertCircle size={16} style={{ color: '#EF4444', flexShrink: 0 }} />
            <span style={{ color: '#991B1B', fontSize: '0.8rem', fontWeight: 600, flex: 1 }}>{loadError}</span>
            <button onClick={fetchCatalogue} style={{ background: '#EF4444', color: '#FFF', border: 'none', borderRadius: '8px', padding: '0.45rem 1rem', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        )}

        <div className="gk-svc-layout" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          {/* ── main column ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <LoadingSpinner size="lg" text="Loading services..." />
            ) : step === 1 ? (
              <>
                <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.4rem', fontWeight: 900, color: '#0F172A', marginBottom: '0.25rem' }}>
                  What does your car need?
                </h2>
                <p style={{ color: '#64748B', fontSize: '0.8rem', fontWeight: 500, marginBottom: '1.35rem' }}>
                  Choose a category to see packages and transparent pricing.
                </p>

                <div className="gk-svc-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.8rem' }}>
                  {serviceCategories.map((cat) => {
                    const catPackages = packagesByCategory.get(cat.id) || [];
                    const count = catPackages.length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => openCategory(cat)}
                        style={{
                          background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '12px',
                          padding: '1.05rem 0.95rem', textAlign: 'left', cursor: 'pointer',
                          transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                          boxShadow: '0 2px 10px rgba(15,23,42,0.03)',
                          display: 'flex', flexDirection: 'column', gap: '0.6rem',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px)';
                          e.currentTarget.style.borderColor = '#1E3A8A';
                          e.currentTarget.style.boxShadow = '0 18px 36px rgba(30,58,138,0.13)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.borderColor = '#E2E8F0';
                          e.currentTarget.style.boxShadow = '0 2px 10px rgba(15,23,42,0.03)';
                        }}
                      >
                        <CategoryIcon
                          slug={cat.slug}
                          image={categoryImageFrom(catPackages)}
                          icon={cat.icon}
                          size={44}
                          iconSize={19}
                        />
                        <div>
                          <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: '0.95rem', color: '#0F172A', lineHeight: 1.25, marginBottom: '0.2rem' }}>
                            {cat.name}
                          </h3>
                          <p style={{ color: '#64748B', fontSize: '0.72rem', fontWeight: 500, lineHeight: 1.45 }}>
                            {cat.description}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                          <span style={{ color: '#94A3B8', fontSize: '0.64rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {count > 0 ? `${count} package${count > 1 ? 's' : ''}` : 'Coming soon'}
                          </span>
                          <ArrowRight size={13} style={{ color: '#1E3A8A' }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={backToCategories}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '9px', padding: '0.45rem 0.9rem', color: '#0F172A', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', marginBottom: '1.2rem' }}
                >
                  <ChevronLeft size={13} /> Back to Categories
                </button>

                {needsCar ? (
                  <CarSelector onSelect={handleCarSelect} selectedCar={changingCar ? null : car} />
                ) : (
                  <ServiceSelector
                    category={selectedCategory}
                    packages={packagesByCategory.get(selectedCategory?.id) || []}
                    selectedCar={car}
                  />
                )}
              </>
            )}
          </div>

          {/* ── cart sidebar: only once a car is chosen ── */}
          {car && !changingCar && (
            <div className="gk-svc-cart" style={{ width: '300px', flexShrink: 0 }}>
              <ServiceCart
                onCheckout={handleCheckout}
                onChangeCar={() => { setChangingCar(true); setStep(2); }}
              />
            </div>
          )}
        </div>
      </div>

      <CheckoutModal open={showCheckout} onClose={() => setShowCheckout(false)} />
    </div>
  );
}

export { serviceCategories };
