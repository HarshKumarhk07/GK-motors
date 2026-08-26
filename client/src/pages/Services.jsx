import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Wrench, Wind, Battery, CircleDot, Paintbrush, Sparkles, Droplets,
  Search, Sun, Settings, Cog, Shield, ChevronLeft, AlertCircle,
  Car as CarIcon, Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useServiceCart } from '../context/CartContext';
import { getServiceCategories, getCategories } from '../api/serviceApi';
import { reportApiError } from '../api/apiError';
import PageHero from '../components/common/PageHero';
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
  /* A saved car and a car chosen for THIS booking are two different facts.
     `car` (from the persisted service cart) is the former: it survives leaving
     the page, and treating it as the latter is what let a new booking start
     already past the vehicle decision. `carConfirmed` is the latter -- it is
     component state with no persistence, so every fresh mount is a fresh
     booking that has to be confirmed. `stage` therefore always starts at
     'car'; what differs is which of the two vehicle screens renders. */
  const [stage, setStage] = useState('car');
  const [carConfirmed, setCarConfirmed] = useState(false);
  /* Within the 'car' stage: false = confirm the saved car, true = CarSelector.
     With no saved car there is nothing to confirm, so CarSelector shows. */
  const [changingCar, setChangingCar] = useState(false);
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
     customer lands on 'car' and is carried through to the packages once the
     vehicle is confirmed -- by Continue, or by picking one in CarSelector. */
  useEffect(() => {
    const id = Number(searchParams.get('category'));
    if (!id) return;
    const match = categories.find((c) => c.id === id);
    if (!match) return;
    setSelectedCategory(match);
    setStage(carConfirmed ? 'packages' : 'car');
  }, [searchParams, categories, carConfirmed]);

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
    setStage(carConfirmed ? 'packages' : 'car');
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

    // Choosing a car in the selector IS the explicit choice for this booking.
    setChangingCar(false);
    setCarConfirmed(true);
    setStage(selectedCategory ? 'packages' : 'categories');
  };

  /* Changing the car keeps the surrounding layout mounted — see the render
     below, where the cart column no longer disappears. Reachable from any
     stage, so it has to pull the funnel back to 'car' as well as open the
     selector. */
  const changeCar = () => { setChangingCar(true); setStage('car'); };

  /* Backing out of the selector. Where that lands depends on whether a
     vehicle has already been confirmed for this booking: if it has, return to
     the funnel; if it has not, fall back to the confirm screen rather than
     leaking the customer into the categories with an unconfirmed car. */
  const cancelChangeCar = () => {
    setChangingCar(false);
    if (carConfirmed) setStage(selectedCategory ? 'packages' : 'categories');
  };

  /* Accepting the saved car as-is. This is the only other way to set
     carConfirmed, and it changes no vehicle state -- the saved car is already
     the right one, it just had not been chosen for this booking yet. */
  const continueWithCar = () => {
    setCarConfirmed(true);
    setStage(selectedCategory ? 'packages' : 'categories');
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
          display: block; font-family: 'Space Grotesk', sans-serif;
          font-size: 1.25rem; font-weight: 900; color: #0F172A; line-height: 1.15;
        }
        .gk-svc-bar-cta {
          flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
          background: linear-gradient(135deg, #1567D3 0%, #00B2F0 100%); color: #FFF;
          border: none; border-radius: 11px; padding: 0.8rem 1.15rem; min-height: 46px;
          font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: 0.82rem;
          letter-spacing: 0.07em; text-transform: uppercase; cursor: pointer;
        }
        .gk-svc-bar-cta:disabled { background: #E2E8F0; color: #94A3B8; cursor: not-allowed; }
        .gk-svc-bar-cta:focus-visible { outline: 2px solid #1567D3; outline-offset: 2px; }
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
        .gk-svc-back:focus-visible { outline: 2px solid #1567D3; outline-offset: 2px; }

        /* Selected-car strip. Sits at the top of the main column in every
           stage so the vehicle is always changeable before a service is
           picked, on any width. */
        .gk-svc-carbar {
          display: flex; align-items: center; gap: 0.8rem;
          background: #FFF; border: 1.5px solid #E2E8F0; border-radius: 14px;
          padding: 0.7rem 0.85rem; margin-bottom: 1.1rem;
          box-shadow: 0 6px 20px rgba(15, 23, 42, 0.04);
        }
        .gk-svc-carbar-thumb {
          width: 42px; height: 42px; border-radius: 10px; background: #EBF0FF;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; overflow: hidden;
        }
        .gk-svc-carbar-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .gk-svc-carbar-text { min-width: 0; flex: 1; display: flex; flex-direction: column; }
        .gk-svc-carbar-label {
          font-size: 0.62rem; font-weight: 900; color: #94A3B8;
          text-transform: uppercase; letter-spacing: 0.1em;
        }
        .gk-svc-carbar-name {
          font-size: 0.92rem; font-weight: 800; color: #0F172A; line-height: 1.25;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .gk-svc-carbar-meta {
          font-size: 0.7rem; font-weight: 700; color: #64748B;
          text-transform: uppercase; letter-spacing: 0.05em;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .gk-svc-carbar-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;
          flex-shrink: 0; min-height: 44px; padding: 0.6rem 0.95rem;
          background: #EFF6FF; border: 1.5px solid #BFDBFE; border-radius: 10px;
          color: #1567D3; font-family: inherit; font-weight: 800; font-size: 0.76rem;
          cursor: pointer; white-space: nowrap;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .gk-svc-carbar-btn:hover { background: #DBEAFE; border-color: #6FD8FF; }
        .gk-svc-carbar-btn:focus-visible { outline: 2px solid #1567D3; outline-offset: 2px; }

        /* Confirm-the-saved-car screen. The vehicle itself is already shown in
           the strip directly above, which also carries the Change car control,
           so this panel only has to own the Continue action. */
        .gk-svc-confirm {
          background: #FFF; border: 1.5px solid #E2E8F0; border-radius: 14px;
          padding: 1.35rem 1.25rem; box-shadow: 0 6px 20px rgba(15, 23, 42, 0.04);
        }
        .gk-svc-confirm-title {
          font-family: 'Space Grotesk', sans-serif; font-size: 1.4rem; font-weight: 900;
          color: #0F172A; letter-spacing: -0.01em; margin-bottom: 0.3rem;
        }
        .gk-svc-confirm-copy {
          color: #64748B; font-size: 0.82rem; font-weight: 500;
          line-height: 1.6; margin-bottom: 1.15rem; max-width: 46ch;
        }
        .gk-svc-confirm-cta {
          display: inline-flex; align-items: center; justify-content: center;
          min-height: 48px; padding: 0.8rem 2.2rem;
          background: linear-gradient(135deg, #1567D3 0%, #00B2F0 100%);
          color: #FFF; border: none; border-radius: 10px;
          font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: 0.85rem;
          letter-spacing: 0.09em; text-transform: uppercase; cursor: pointer;
        }
        .gk-svc-confirm-cta:focus-visible { outline: 2px solid #1567D3; outline-offset: 2px; }
        @media (max-width: 640px) {
          .gk-svc-confirm-cta { width: 100%; }
        }
        @media (max-width: 420px) {
          .gk-svc-carbar { gap: 0.6rem; padding: 0.65rem 0.7rem; }
          .gk-svc-carbar-thumb { width: 36px; height: 36px; }
          .gk-svc-carbar-btn { padding: 0.6rem 0.7rem; font-size: 0.72rem; }
        }

        /* Skeletons at the real grid's shape, so the column keeps its height
           while the catalogue loads instead of collapsing to a spinner. */
        .gk-svc-grid-skel {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem;
        }
        @media (min-width: 768px)  { .gk-svc-grid-skel { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; } }
        @media (min-width: 1024px) { .gk-svc-grid-skel { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1.1rem; } }
        .gk-svc-skel { min-height: 178px; border-radius: 16px; background: #EFF3FA; border: 1px solid #E4EBF7; }
      `}</style>

      {/* The shared banner, so this page opens the way Shop, About and
          Contact do. The previous header was a flat blue-to-navy bar with its
          own type scale, and the muted slate it used for the subheading was
          barely legible against it. */}
      <PageHero
        crumb={{ label: 'Services' }}
        eyebrow="Book a service"
        title="Tell us what it needs."
        highlight="We do the rest."
        lede="Pick a service, choose a slot, and we collect the car from your door anywhere in Rohtak. You approve an itemised quote before anything is opened."
        image="/workshop/bay-dark.webp"
      />

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
            {/* -- Selected car strip -------------------------------------
                The vehicle lives in the service cart, which persists to
                localStorage, so returning to /services restores it and the
                `stage` initialiser starts at 'categories' rather than 'car'.
                That is intended: a saved car is a convenience. The defect was
                that the ONLY control bound to changeCar lived inside
                <ServiceCart>, and at <=900px .gk-svc-layout becomes a column,
                so that sidebar is laid out AFTER the main column -- below the
                entire category grid. A returning customer saw their old car
                and had no reachable way to change it.

                The strip renders in every stage at a constant height (only the
                button's label changes), so entering the 'car' stage neither
                adds nor removes layout. That is what holds scroll position
                while CarSelector loads -- no window.scrollTo() involved. */}
            {car && (
              <div className="gk-svc-carbar">
                <div className="gk-svc-carbar-thumb">
                  {car.image
                    ? <img src={car.image} alt="" />
                    : <CarIcon size={18} style={{ color: '#1567D3' }} />}
                </div>
                <div className="gk-svc-carbar-text">
                  <span className="gk-svc-carbar-label">Selected car</span>
                  <strong className="gk-svc-carbar-name">{car.brand} {car.model}</strong>
                  {/* Legacy rows may carry no fuelType, or an older value the
                      current CarSelector no longer offers. Render whatever is
                      actually present rather than assuming the full triple. */}
                  <span className="gk-svc-carbar-meta">
                    {[car.year, car.fuelType, car.isManualEntry ? 'manual entry' : null]
                      .filter(Boolean).join(' \u00b7 ')}
                  </span>
                </div>
                {changingCar ? (
                  <button type="button" onClick={cancelChangeCar} className="gk-svc-carbar-btn">
                    <ChevronLeft size={13} /> Cancel
                  </button>
                ) : (
                  <button type="button" onClick={changeCar} className="gk-svc-carbar-btn">
                    <Pencil size={13} /> Change car
                  </button>
                )}
              </div>
            )}

            {stage === 'car' ? (
              /* Two screens share this stage. With a saved car that has not
                 been confirmed for this booking, the customer gets the choice
                 FIRST -- before any service exists to be mispriced. With no
                 saved car there is nothing to confirm and CarSelector is the
                 first screen, exactly as before. */
              car && !changingCar ? (
                <div className="gk-svc-confirm">
                  <h2 className="gk-svc-confirm-title">Your car</h2>
                  <p className="gk-svc-confirm-copy">
                    Every price on the next screen is worked out for this vehicle.
                    Continue with it, or change it first.
                  </p>
                  <button type="button" onClick={continueWithCar} className="gk-svc-confirm-cta">
                    Continue
                  </button>
                </div>
              ) : (
                <CarSelector onSelect={handleCarSelect} selectedCar={car} />
              )
            ) : stage === 'categories' ? (
              <>
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.4rem', fontWeight: 900, color: '#0F172A', marginBottom: '0.25rem' }}>
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
