import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Wrench, Wind, Battery, CircleDot, Paintbrush, Sparkles, Droplets,
  Search, Sun, Settings, Cog, Shield, ChevronLeft, AlertCircle,
  Car as CarIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useServiceCart } from '../context/CartContext';
import { getServiceCategories, getCategories } from '../api/serviceApi';
import { reportApiError } from '../api/apiError';
import ServiceCategoryGrid from '../components/service/ServiceCategoryGrid';
import CarSelector from '../components/service/CarSelector';
import ServiceSelector from '../components/service/ServiceSelector';
import ServiceCart from '../components/service/ServiceCart';

/* The checkout modal is the single largest module in the eager import graph —
 * larger than Home itself — and nothing on the landing page can reach it.
 * Because Services is (correctly) eager, a static import here dragged the whole
 * modal, its date/slot logic and its Razorpay integration into the bundle every
 * first-time visitor downloads.
 *
 * It is a secondary interaction: opening it needs a category, then a car, then
 * a service, then a click on Proceed to Checkout. Deferring it costs nothing on
 * the path that matters.
 *
 * Deliberately still rendered unconditionally below, inside <Suspense>, exactly
 * as before — the component returns null while `open` is false, so mounting
 * semantics, the `open` prop transitions and Phase 2A's sessionStorage booking
 * handoff all behave identically. Only the moment the code arrives changes.
 *
 * CarSelector and ServiceSelector stay eager: they render immediately on step 2
 * of the funnel. */
const CheckoutModal = lazy(() => import('../components/service/CheckoutModal'));

/**
 * The 12 GK Motors service categories.
 * `id` must stay in sync with categoryId in
 * server/src/seeds/seedServicePackages.js — that is the join key between the
 * icons/copy here and the bookable packages in the database.
 */
// Fallback used only until seedServiceCategories.js has run — keeps the page
// working on a fresh database instead of rendering an empty grid.
const FALLBACK_CATEGORIES = [
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

  /* ── Where the customer is in the funnel ────────────────────────────────
     'car'        pick the vehicle, then its fuel   (ALWAYS first)
     'categories' pick what the car needs
     'packages'   pick a package inside that category

     Previously the car was buried inside step 2 and only appeared when the
     cart happened to be empty, so a first-time visitor chose a service before
     anyone had asked what they drive — even though every price on the packages
     screen is derived from the vehicle. This is the state change, not a
     relabelling: `stage` gates which screen renders, and every entry point
     below routes through 'car' first when the cart has no vehicle. */
  const [stage, setStage] = useState(() => (car ? 'categories' : 'car'));
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const [packages, setPackages] = useState([]);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  /* ── Catalogue ──────────────────────────────────────────────────────────
     One request, and the *right* one.

     This used to Promise.all over both endpoints, which had two problems.
     Promise.all rejects as a whole, so a failure of either took the other's
     successful response down with it. And packages were read from
     /services/categories, whose projection selects only
     `value label price desc image basePrice categoryType categoryId
     categoryName tier order` — it strips `features`, `durationHours`,
     `warranty`, `recommendedInterval*`, `pickupDrop`, `isRecommended` and
     `originalPrice`, every one of which ServicePackageCard renders. The
     package cards could never show their feature lists, warranty or the
     Recommended flag, because the data never arrived.

     /service-categories returns the full ServiceType documents embedded per
     category, so reading packages from there fixes the missing detail and
     removes the duplicate request at the same time. The flat endpoint remains
     as the fallback when the taxonomy is unavailable. */
  const fetchCatalogue = useCallback(() => {
    setLoading(true);
    setLoadError('');

    getCategories()
      .then(({ data }) => {
        const live = data.categories || [];
        if (!live.length) return false;
        setCategories(live.map((c) => {
          const known = FALLBACK_CATEGORIES.find((f) => f.id === c.categoryId);
          return {
            id: c.categoryId,
            slug: c.slug || known?.slug,
            name: c.name || known?.name,
            description: c.description || known?.description || '',
            icon: known?.icon || Wrench,
            image: c.image || null,
          };
        }));
        setPackages(live.flatMap((c) => c.packages || []));
        return true;
      })
      .catch((err) => {
        console.error('[Services.getCategories]', err);
        return false;
      })
      .then((served) => {
        if (served) return undefined;
        // Degraded path: hardcoded categories, live prices.
        return getServiceCategories()
          .then(({ data }) => setPackages(data.categories || []))
          .catch((err) => setLoadError(
            reportApiError('Services.loadCatalogue', err, 'Could not load our services')
          ));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchCatalogue(); }, [fetchCatalogue]);

  /* Deep link from the home page: /services?category=3
     The category is remembered, but it does NOT jump past the car step — with
     no vehicle chosen there is nothing to price the packages against, so the
     customer lands on 'car' and is carried through to the packages once they
     have picked one (see handleCarSelect). */
  useEffect(() => {
    const id = Number(searchParams.get('category'));
    if (!id) return;
    const match = categories.find((c) => c.id === id);
    if (!match) return;
    setSelectedCategory(match);
    setStage(car ? 'packages' : 'car');
  }, [searchParams, categories, car]);

  // Deep link directly to checkout modal: /services?checkout=true
  useEffect(() => {
    if (searchParams.get('checkout') === 'true' && car && services.length) {
      if (!user) {
        toast.error('Please login to complete your booking');
        navigate('/login?redirect=/services?checkout=true');
        return;
      }
      setShowCheckout(true);
    }
  }, [searchParams, car, services, user, navigate]);

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
    setSearchParams({ category: String(category.id) }, { replace: true });
    // Car first, always — even arriving straight at a category.
    setStage(car ? 'packages' : 'car');
  };

  const backToCategories = () => {
    setStage('categories');
    setSelectedCategory(null);
    searchParams.delete('category');
    setSearchParams(searchParams, { replace: true });
  };

  /**
   * Committing a car.
   *
   * `setCar` in CartContext already clears the selected services when the
   * vehicle actually changes — prices are per-model, so a stale selection
   * would be priced against the wrong car. That behaviour is unchanged; what
   * is new is that the customer is warned rather than finding the cart
   * silently empty.
   */
  const handleCarSelect = (carData) => {
    const changedVehicle =
      car && (
        String(car.carId) !== String(carData.carId)
        || car.brand !== carData.brand
        || car.model !== carData.model
        || Number(car.year) !== Number(carData.year)
      );

    setCar(carData);

    if (changedVehicle && services.length) {
      toast(`${carData.brand} ${carData.model} selected — prices differ per car, so please pick your services again.`);
    } else {
      toast.success(`${carData.brand} ${carData.model} selected`);
    }

    // Carry on to whatever they were heading for.
    setStage(selectedCategory ? 'packages' : 'categories');
  };

  /* Changing the car keeps the surrounding layout mounted — see the render
     below, where the cart column no longer disappears. */
  const changeCar = () => setStage('car');

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

  const totalAmount = services.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const canCheckout = Boolean(car) && services.length > 0;

  return (
    <div style={{ flex: '1 0 auto', background: '#F8FAFC', width: '100%' }}>
      <style>{`
        @media (max-width: 900px) {
          .gk-svc-layout { flex-direction: column !important; }
          .gk-svc-cart { width: 100% !important; }
          /* The bar below owns the primary action on mobile, so the cart's own
             button is hidden rather than duplicated. */
          .gk-svc-cart .gk-cart-cta { display: none !important; }
          /* Room for the fixed bar, plus the home-indicator inset. */
          .gk-svc-page { padding-bottom: calc(6.5rem + env(safe-area-inset-bottom, 0px)) !important; }
        }
        @media (max-width: 640px) {
          .gk-svc-head h1 { font-size: 1.45rem !important; }
          .gk-svc-page { padding-left: 1rem !important; padding-right: 1rem !important; padding-top: 1rem !important; }
        }

        /* ── Mobile action bar ──────────────────────────────────────────────
           The total and the primary action used to sit below the whole package
           list, which on a phone meant scrolling past every card to reach them
           and scrolling back to add another. Fixed, single instance, hidden on
           desktop and hidden while the checkout modal is open so it can never
           sit on top of it. Static positioning only — no scroll listener, no
           transform, nothing that runs per frame. */
        .gk-svc-bar { display: none; }
        @media (max-width: 900px) {
          .gk-svc-bar {
            display: flex; align-items: center; gap: 0.75rem;
            position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
            background: #FFFFFF;
            border-top: 1px solid #E2E8F0;
            box-shadow: 0 -2px 10px rgba(15, 23, 42, 0.06);
            padding: 0.7rem 1rem calc(0.7rem + env(safe-area-inset-bottom, 0px));
          }
        }
        .gk-svc-bar-info { min-width: 0; flex: 1; }
        .gk-svc-bar-label {
          display: block; font-size: 0.62rem; font-weight: 800; color: #64748B;
          text-transform: uppercase; letter-spacing: 0.08em;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .gk-svc-bar-total {
          display: block; font-family: Rajdhani, sans-serif;
          font-size: 1.25rem; font-weight: 900; color: #0F172A; line-height: 1.15;
        }
        .gk-svc-bar-cta {
          flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
          background: linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%); color: #FFF;
          border: none; border-radius: 11px; padding: 0.8rem 1.15rem; min-height: 46px;
          font-family: Rajdhani, sans-serif; font-weight: 900; font-size: 0.82rem;
          letter-spacing: 0.07em; text-transform: uppercase; cursor: pointer;
        }
        .gk-svc-bar-cta:disabled { background: #E2E8F0; color: #94A3B8; cursor: not-allowed; }
        .gk-svc-bar-cta:focus-visible { outline: 2px solid #2563EB; outline-offset: 2px; }
        @media (max-width: 359px) {
          .gk-svc-bar-cta { padding: 0.8rem 0.85rem; font-size: 0.76rem; }
        }

        .gk-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }

        .gk-svc-back {
          display: inline-flex; align-items: center; gap: 0.4rem;
          background: #FFF; border: 1px solid #E2E8F0; border-radius: 9px;
          padding: 0.5rem 0.9rem; min-height: 40px; color: #0F172A;
          font-weight: 800; font-size: 0.75rem; cursor: pointer;
          margin-bottom: 1.2rem; font-family: inherit;
        }
        .gk-svc-back:focus-visible { outline: 2px solid #2563EB; outline-offset: 2px; }

        /* Skeletons at the real grid's shape, so the column keeps its height
           while the catalogue loads instead of collapsing to a spinner. */
        .gk-svc-grid-skel {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem;
        }
        @media (min-width: 768px)  { .gk-svc-grid-skel { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; } }
        @media (min-width: 1024px) { .gk-svc-grid-skel { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1.1rem; } }
        .gk-svc-skel { min-height: 178px; border-radius: 16px; background: #EFF3FA; border: 1px solid #E4EBF7; }
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

      <div className="gk-svc-page" style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 1.5rem 3rem' }}>
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
            {stage === 'car' ? (
              /* Step 1 — always. CarSelector holds its own height while it
                 loads, so entering this stage from the cart's "Change car"
                 no longer collapses the document and throws scroll position. */
              <>
                {car && (
                  <button onClick={() => setStage(selectedCategory ? 'packages' : 'categories')} className="gk-svc-back">
                    <ChevronLeft size={13} /> Back
                  </button>
                )}
                <CarSelector onSelect={handleCarSelect} selectedCar={car} />
              </>
            ) : stage === 'categories' ? (
              <>
                <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.4rem', fontWeight: 900, color: '#0F172A', marginBottom: '0.25rem' }}>
                  What does your car need?
                </h2>
                <p style={{ color: '#64748B', fontSize: '0.8rem', fontWeight: 500, marginBottom: '1.35rem' }}>
                  Choose a category to see packages and transparent pricing.
                </p>

                {loading ? (
                  <div className="gk-svc-grid-skel" aria-busy="true" aria-live="polite">
                    <span className="gk-sr">Loading services…</span>
                    {Array.from({ length: 8 }).map((_, i) => <div key={i} className="gk-svc-skel" />)}
                  </div>
                ) : (
                  <ServiceCategoryGrid
                    categories={categories.map((c) => {
                      const count = (packagesByCategory.get(c.id) || []).length;
                      return { ...c, meta: count > 0 ? `${count} package${count > 1 ? 's' : ''}` : 'Coming soon' };
                    })}
                    onSelect={openCategory}
                  />
                )}
              </>
            ) : (
              <>
                <button onClick={backToCategories} className="gk-svc-back">
                  <ChevronLeft size={13} /> Back to Categories
                </button>

                {selectedCategory ? (
                  <ServiceSelector
                    category={selectedCategory}
                    packages={packagesByCategory.get(selectedCategory.id) || []}
                    selectedCar={car}
                  />
                ) : (
                  /* Defensive: 'packages' without a category should be
                     unreachable, but it used to be possible and threw. */
                  <p style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 600 }}>
                    Pick a category to see its packages.
                  </p>
                )}
              </>
            )}
          </div>

          {/* ── cart sidebar ────────────────────────────────────────────────
              Rendered whenever a car exists, INCLUDING while the car is being
              changed. Unmounting it on "change car" was half of the reported
              scroll jump: the column vanished, the document lost its height,
              and the browser clamped scrollTop before the new content mounted.
              It now simply stays put. */}
          {car && (
            <div className="gk-svc-cart" style={{ width: '300px', flexShrink: 0 }}>
              <ServiceCart onCheckout={handleCheckout} onChangeCar={changeCar} />
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile action bar ──────────────────────────────────────────────
          Hidden on desktop by CSS, and never rendered while the checkout modal
          is open so it cannot overlay it. */}
      {!showCheckout && (
        <div className="gk-svc-bar">
          {car ? (
            <>
              <span className="gk-svc-bar-info">
                <span className="gk-svc-bar-label">
                  {car.brand} {car.model}
                  {services.length ? ` · ${services.length} service${services.length > 1 ? 's' : ''}` : ' · no services yet'}
                </span>
                <span className="gk-svc-bar-total">₹{Number(totalAmount).toLocaleString('en-IN')}</span>
              </span>
              <button
                type="button"
                onClick={handleCheckout}
                disabled={!canCheckout}
                className="gk-svc-bar-cta"
              >
                Proceed to Checkout
              </button>
            </>
          ) : (
            <>
              <span className="gk-svc-bar-info">
                <span className="gk-svc-bar-label">Step 1 of 3</span>
                <span className="gk-svc-bar-total" style={{ fontSize: '0.95rem' }}>Tell us your car</span>
              </span>
              <button type="button" onClick={() => setStage('car')} className="gk-svc-bar-cta">
                <CarIcon size={15} /> Select Car
              </button>
            </>
          )}
        </div>
      )}

      {/* fallback={null} matches what CheckoutModal itself renders while closed,
          so nothing flickers on the normal path. */}
      <Suspense fallback={null}>
        <CheckoutModal open={showCheckout} onClose={() => setShowCheckout(false)} />
      </Suspense>
    </div>
  );
}

export { FALLBACK_CATEGORIES };
