import { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

/* ═══════════════════════════════════════════════════════════════════════════
   This module exposes TWO carts:

   • useCart()        — the legacy spare-parts cart. Unchanged behaviour, kept
                        so the disabled marketplace pages (Cart, PartDetail,
                        SpareParts, Wishlist, PartCard) still work if their
                        routes are re-enabled in App.jsx.

   • useServiceCart() — the GK Motors service cart: one selected car plus one
                        or more service packages, persisted to localStorage and
                        synchronised across browser tabs.
   ═══════════════════════════════════════════════════════════════════════════ */

const CART_STORAGE_KEY = 'gkmotors_service_cart';
// The parts cart used to live in memory only, so a refresh or a full page
// navigation emptied it and the customer lost their basket. It is persisted
// under its own key (the service cart above is a different shape and must not
// be mixed into it) and synchronised across tabs the same way.
const PARTS_CART_STORAGE_KEY = 'gkmotors_parts_cart';

/** Only the fields the cart and checkout actually read are kept. Storing the
 *  whole product document would blow the 5MB localStorage budget and would
 *  also go stale; price is re-read from the database at order time anyway. */
const slimPart = (item) => ({
  _id: item._id,
  name: item.name,
  brand: item.brand ?? null,
  category: item.category ?? null,
  images: Array.isArray(item.images) ? item.images.slice(0, 1) : [],
  price: Number(item.price) || 0,
  discountedPrice: item.discountedPrice != null ? Number(item.discountedPrice) : undefined,
  effectivePrice: item.effectivePrice != null ? Number(item.effectivePrice) : undefined,
  selectedVariant: item.selectedVariant ?? undefined,
  pincodePricing: Array.isArray(item.pincodePricing) ? item.pincodePricing : undefined,
  stock: Number.isFinite(Number(item.stock)) ? Number(item.stock) : undefined,
  type: item.type ?? 'part',
  quantity: Math.max(1, Number(item.quantity) || 1),
});

const isValidPartsCart = (data) =>
  Array.isArray(data) &&
  data.every(
    (i) =>
      i &&
      typeof i._id === 'string' &&
      typeof i.name === 'string' &&
      Number.isFinite(Number(i.price)) &&
      Number.isInteger(Number(i.quantity)) &&
      Number(i.quantity) > 0
  );

const readStoredPartsCart = () => {
  try {
    const raw = localStorage.getItem(PARTS_CART_STORAGE_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    if (!isValidPartsCart(parsed)) {
      localStorage.removeItem(PARTS_CART_STORAGE_KEY);
      return { items: [] };
    }
    return { items: parsed.map(slimPart) };
  } catch (err) {
    // Private browsing, quota, or corrupt JSON — start empty rather than crash.
    console.error('PartsCart: could not read stored cart ->', err.message);
    return { items: [] };
  }
};

// ─────────────────────────── legacy parts cart ───────────────────────────
const CartContext = createContext();

const cartReducer = (state, action) => {
  switch (action.type) {
    case 'HYDRATE_ITEMS':
      return { ...state, items: action.payload };

    case 'ADD_ITEM': {
      const incoming = slimPart(action.payload);
      const exists = state.items.find((i) => i._id === incoming._id);
      if (exists) {
        return {
          ...state,
          items: state.items.map((i) =>
            i._id === incoming._id
              ? { ...i, ...incoming, quantity: i.quantity + incoming.quantity }
              : i
          ),
        };
      }
      return { ...state, items: [...state.items, incoming] };
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((i) => i._id !== action.payload) };
    case 'UPDATE_QTY': {
      const qty = Math.floor(Number(action.payload.qty));
      if (!Number.isFinite(qty)) return state;
      return {
        ...state,
        items: state.items
          .map((i) => (i._id === action.payload.id ? { ...i, quantity: qty } : i))
          .filter((i) => i.quantity > 0),
      };
    }
    case 'CLEAR_CART':
      return { ...state, items: [] };
    default:
      return state;
  }
};

// ─────────────────────────── service cart ───────────────────────────
const emptyServiceCart = { car: null, services: [] };

/** Shape-check anything coming out of localStorage before trusting it. */
const isValidServiceCart = (data) => {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.services)) return false;
  if (data.car !== null && (typeof data.car !== 'object' || !data.car.brand || !data.car.model)) {
    return false;
  }
  return data.services.every(
    (s) => s && typeof s.serviceId === 'string' && typeof s.price === 'number' && !Number.isNaN(s.price)
  );
};

const readStoredCart = () => {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return emptyServiceCart;
    const parsed = JSON.parse(raw);
    if (!isValidServiceCart(parsed)) {
      console.error('ServiceCart: stored cart failed validation, resetting');
      localStorage.removeItem(CART_STORAGE_KEY);
      return emptyServiceCart;
    }
    return { car: parsed.car ?? null, services: parsed.services };
  } catch (err) {
    // Private browsing, quota, or corrupt JSON — fall back to an empty cart.
    console.error('ServiceCart: could not read stored cart ->', err.message);
    return emptyServiceCart;
  }
};

// Money is held in whole rupees. Totals are summed with a paise-integer
// intermediate so repeated float addition cannot drift.
const sumServices = (services) =>
  Math.round(services.reduce((paise, s) => paise + Math.round(Number(s.price) * 100), 0)) / 100;

const serviceReducer = (state, action) => {
  switch (action.type) {
    case 'HYDRATE':
      return action.payload;

    case 'SET_CAR': {
      const next = action.payload;
      const sameCar =
        state.car &&
        state.car.carId === next.carId &&
        state.car.brand === next.brand &&
        state.car.model === next.model &&
        Number(state.car.year) === Number(next.year);
      // Prices are per-model, so switching cars invalidates every selection.
      return { car: next, services: sameCar ? state.services : [] };
    }

    case 'CLEAR_CAR':
      return emptyServiceCart;

    case 'ADD_SERVICE': {
      const svc = action.payload;
      const withoutConflict = state.services.filter((s) => !(
        String(s.categoryId) === String(svc.categoryId) &&
        s.tier !== 'single' && svc.tier !== 'single' &&
        s.tier !== svc.tier
      ));
      return { ...state, services: [...withoutConflict, svc] };
    }

    case 'REMOVE_SERVICE':
      return { ...state, services: state.services.filter((s) => s.serviceId !== action.payload) };

    case 'CLEAR_SERVICES':
      return { ...state, services: [] };

    case 'CLEAR_ALL':
      return emptyServiceCart;

    default:
      return state;
  }
};

const ServiceCartContext = createContext();

export const CartProvider = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, { items: [] }, readStoredPartsCart);
  const [service, serviceDispatch] = useReducer(serviceReducer, emptyServiceCart, readStoredCart);

  // Marks writes this tab made, so the storage listener can ignore its own echo.
  const writingRef = useRef(false);
  const partsWritingRef = useRef(false);

  // Persist the parts cart on every change, so a refresh or a navigation that
  // remounts the provider does not empty the basket.
  useEffect(() => {
    try {
      partsWritingRef.current = true;
      localStorage.setItem(PARTS_CART_STORAGE_KEY, JSON.stringify(state.items));
    } catch (err) {
      console.error('PartsCart: could not persist cart ->', err.message);
    } finally {
      setTimeout(() => { partsWritingRef.current = false; }, 0);
    }
  }, [state.items]);

  // Keep other tabs in step with the parts cart too.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== PARTS_CART_STORAGE_KEY || partsWritingRef.current) return;
      if (e.newValue === null) {
        dispatch({ type: 'HYDRATE_ITEMS', payload: [] });
        return;
      }
      try {
        const parsed = JSON.parse(e.newValue);
        if (isValidPartsCart(parsed)) {
          dispatch({ type: 'HYDRATE_ITEMS', payload: parsed.map(slimPart) });
        }
      } catch (err) {
        console.error('PartsCart: bad payload from another tab ->', err.message);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Persist on every change. A failure here is non-fatal: the cart keeps
  // working in memory for the rest of the session.
  useEffect(() => {
    try {
      writingRef.current = true;
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(service));
    } catch (err) {
      console.error('ServiceCart: could not persist cart ->', err.message);
    } finally {
      // Release on the next tick — the storage event fires asynchronously.
      setTimeout(() => { writingRef.current = false; }, 0);
    }
  }, [service]);

  // Keep other tabs in step.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== CART_STORAGE_KEY || writingRef.current) return;
      if (e.newValue === null) {
        serviceDispatch({ type: 'HYDRATE', payload: emptyServiceCart });
        return;
      }
      try {
        const parsed = JSON.parse(e.newValue);
        if (isValidServiceCart(parsed)) {
          serviceDispatch({ type: 'HYDRATE', payload: { car: parsed.car ?? null, services: parsed.services } });
        }
      } catch (err) {
        console.error('ServiceCart: bad payload from another tab ->', err.message);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ── legacy parts cart api ──
  const addToCart = (item, quantity = 1) => {
    if (!item?._id) {
      toast.error('That product could not be added');
      return false;
    }
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    dispatch({ type: 'ADD_ITEM', payload: { ...item, quantity: qty } });
    toast.success(`${item.name} added to cart`);
    return true;
  };
  const removeFromCart = (id) => dispatch({ type: 'REMOVE_ITEM', payload: id });
  const updateQty = (id, qty) => dispatch({ type: 'UPDATE_QTY', payload: { id, qty } });
  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
    try {
      localStorage.removeItem(PARTS_CART_STORAGE_KEY);
    } catch (err) {
      console.error('PartsCart: could not clear stored cart ->', err.message);
    }
  };

  // Prices can legitimately be missing on a badly-seeded product; treat those
  // as 0 here rather than letting NaN spread through the whole summary.
  const unitPrice = (i) => Number(i.effectivePrice ?? i.discountedPrice ?? i.price) || 0;
  const total = state.items.reduce((sum, i) => sum + unitPrice(i) * i.quantity, 0);
  const totalOriginal = state.items.reduce((sum, i) => {
    const op = Number(i.selectedVariant?.originalPrice ?? i.price ?? 0) || 0;
    return sum + op * i.quantity;
  }, 0);
  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);

  // ── service cart api ──
  const setCar = useCallback((carData) => {
    if (!carData) return;
    serviceDispatch({ type: 'SET_CAR', payload: carData });
  }, []);

  const clearCar = useCallback(() => serviceDispatch({ type: 'CLEAR_CAR' }), []);

  const addService = useCallback((newService) => {
    if (!newService?.serviceId) {
      toast.error('That service could not be added');
      return false;
    }
    if (!Number.isFinite(Number(newService.price)) || Number(newService.price) <= 0) {
      toast.error('This service has no price set yet');
      return false;
    }

    // The reducer cannot raise toasts, so the decision is made here against
    // the current snapshot and the reducer just applies it.
    if (service.services.some((s) => s.serviceId === newService.serviceId)) {
      toast.error('Service already in cart');
      return false;
    }

    // Within one category, basic/standard/comprehensive are mutually
    // exclusive; `single` packages stack alongside anything.
    const conflicting = service.services.find(
      (s) =>
        String(s.categoryId) === String(newService.categoryId) &&
        s.tier !== 'single' && newService.tier !== 'single' &&
        s.tier !== newService.tier
    );

    serviceDispatch({
      type: 'ADD_SERVICE',
      payload: { ...newService, price: Number(newService.price) },
    });

    if (conflicting) {
      toast.success(`Replaced ${conflicting.name} with ${newService.name}`);
      return 'replaced';
    }
    toast.success(`${newService.name} added`);
    return 'added';
  }, [service.services]);

  const removeService = useCallback((serviceId) => {
    serviceDispatch({ type: 'REMOVE_SERVICE', payload: serviceId });
  }, []);

  const clearServiceCart = useCallback(() => {
    serviceDispatch({ type: 'CLEAR_ALL' });
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch (err) {
      console.error('ServiceCart: could not clear stored cart ->', err.message);
    }
  }, []);

  const serviceTotal = sumServices(service.services);
  const getCartTotal = useCallback(() => sumServices(service.services), [service.services]);

  return (
    <CartContext.Provider value={{ items: state.items, total, totalOriginal, itemCount, addToCart, removeFromCart, updateQty, clearCart }}>
      <ServiceCartContext.Provider
        value={{
          car: service.car,
          services: service.services,
          totalAmount: serviceTotal,
          serviceCount: service.services.length,
          setCar,
          clearCar,
          addService,
          removeService,
          clearCart: clearServiceCart,
          getCartTotal,
          hasService: (serviceId) => service.services.some((s) => s.serviceId === serviceId),
        }}
      >
        {children}
      </ServiceCartContext.Provider>
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};

export const useServiceCart = () => {
  const ctx = useContext(ServiceCartContext);
  if (!ctx) throw new Error('useServiceCart must be used within CartProvider');
  return ctx;
};

export { CART_STORAGE_KEY, PARTS_CART_STORAGE_KEY };
