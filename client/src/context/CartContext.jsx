import { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

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

/* ── Per-identity storage ────────────────────────────────────────────────
   Both carts used to live under a single global key, so every profile on a
   browser shared one basket: sign in as someone else and their cart was
   yours. There is no server-side cart in this project (no Cart model, route
   or controller), so localStorage IS the cart, and the isolation has to
   happen here.

   The key is suffixed with the authenticated user's stable _id -- the same
   id the login response returns and orders are owned by -- never the email.
   Signed out, the bucket is 'guest'. Each identity therefore keeps its own
   basket across sessions instead of the carts being wiped on switch. */
const CART_KEY_BASE = 'gkmotors_service_cart';

const scopeOf = (user) => (user && user._id ? `u:${String(user._id)}` : 'guest');
const serviceKeyFor = (scope) => `${CART_KEY_BASE}:${scope}`;

/* One-time adoption of a pre-isolation cart. Before this fix everything sat
   under the bare base key; without this the change would silently empty the
   basket of every customer mid-shop. It moves once, into whichever identity
   is active on the first load after the update, and the legacy key is then
   removed so it can never be adopted twice. */
const adoptLegacy = (baseKey, scopedKey) => {
  try {
    if (localStorage.getItem(scopedKey) !== null) return;
    const legacy = localStorage.getItem(baseKey);
    if (legacy === null) return;
    localStorage.setItem(scopedKey, legacy);
    localStorage.removeItem(baseKey);
  } catch (err) {
    console.error('Cart: legacy adoption skipped ->', err.message);
  }
};

/* Guest basket carried into the account the shopper signs into, and only
   when that account's own basket is empty -- so nothing an authenticated
   user owns is ever overwritten, and data never moves between two accounts.
   This preserves the pre-existing "add while signed out, then log in to pay"
   flow, which a straight scope switch would otherwise break. */
const adoptGuest = (guestKey, scopedKey, isEmpty) => {
  try {
    const guest = localStorage.getItem(guestKey);
    if (guest === null) return null;
    const existing = localStorage.getItem(scopedKey);
    if (existing !== null && !isEmpty(existing)) return null;
    localStorage.setItem(scopedKey, guest);
    localStorage.removeItem(guestKey);
    return guest;
  } catch (err) {
    console.error('Cart: guest adoption skipped ->', err.message);
    return null;
  }
};
// The parts cart used to live in memory only, so a refresh or a full page
// navigation emptied it and the customer lost their basket. It is persisted
// under its own key (the service cart above is a different shape and must not
// be mixed into it) and synchronised across tabs the same way.
const PARTS_CART_KEY_BASE = 'gkmotors_parts_cart';
const partsKeyFor = (scope) => `${PARTS_CART_KEY_BASE}:${scope}`;

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

const readStoredPartsCart = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    if (!isValidPartsCart(parsed)) {
      localStorage.removeItem(key);
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

const readStoredCart = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return emptyServiceCart;
    const parsed = JSON.parse(raw);
    if (!isValidServiceCart(parsed)) {
      console.error('ServiceCart: stored cart failed validation, resetting');
      localStorage.removeItem(key);
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
  /* AuthProvider wraps CartProvider in App.jsx, and its user is rehydrated
     synchronously from localStorage in the reducer's initial state -- so the
     identity is already known on the very first render and there is no
     "logged out for one frame" window that could persist an empty cart over
     a stored one. */
  const { user } = useAuth();
  const scope = scopeOf(user);
  const partsKey = partsKeyFor(scope);
  const serviceKey = serviceKeyFor(scope);

  const [state, dispatch] = useReducer(cartReducer, partsKey, (k) => {
    adoptLegacy(PARTS_CART_KEY_BASE, k);
    return readStoredPartsCart(k);
  });
  const [service, serviceDispatch] = useReducer(serviceReducer, serviceKey, (k) => {
    adoptLegacy(CART_KEY_BASE, k);
    return readStoredCart(k);
  });

  /* Which identity the state in hand belongs to, and which identity a
     hydration has been dispatched for but not yet applied. The pending ref is
     what stops the persist effects below writing the OUTGOING user's items
     into the INCOMING user's key on the render where the key has changed but
     the hydrating dispatch has not landed yet. */
  const partsScopeRef = useRef(partsKey);
  const serviceScopeRef = useRef(serviceKey);
  const partsPendingRef = useRef(null);
  const servicePendingRef = useRef(null);

  // Identity changed: rehydrate both carts from the new owner's buckets.
  useEffect(() => {
    if (partsScopeRef.current === partsKey) return;
    partsScopeRef.current = partsKey;
    partsPendingRef.current = partsKey;
    adoptLegacy(PARTS_CART_KEY_BASE, partsKey);
    if (scope !== 'guest') {
      adoptGuest(partsKeyFor('guest'), partsKey, (raw) => {
        try { const p = JSON.parse(raw); return !Array.isArray(p) || p.length === 0; }
        catch { return true; }
      });
    }
    dispatch({ type: 'HYDRATE_ITEMS', payload: readStoredPartsCart(partsKey).items });
  }, [partsKey, scope]);

  useEffect(() => {
    if (serviceScopeRef.current === serviceKey) return;
    serviceScopeRef.current = serviceKey;
    servicePendingRef.current = serviceKey;
    adoptLegacy(CART_KEY_BASE, serviceKey);
    if (scope !== 'guest') {
      adoptGuest(serviceKeyFor('guest'), serviceKey, (raw) => {
        try { const p = JSON.parse(raw); return !p || (!p.car && (!p.services || p.services.length === 0)); }
        catch { return true; }
      });
    }
    serviceDispatch({ type: 'HYDRATE', payload: readStoredCart(serviceKey) });
  }, [serviceKey, scope]);

  // Marks writes this tab made, so the storage listener can ignore its own echo.
  const writingRef = useRef(false);
  const partsWritingRef = useRef(false);

  // Persist the parts cart on every change, so a refresh or a navigation that
  // remounts the provider does not empty the basket.
  useEffect(() => {
    // The hydration for this key has not been applied yet, so `state.items`
    // still belongs to the previous identity -- writing now would copy it
    // into the new user's bucket. Skip exactly this run.
    if (partsPendingRef.current === partsKey) { partsPendingRef.current = null; return; }
    try {
      partsWritingRef.current = true;
      localStorage.setItem(partsKey, JSON.stringify(state.items));
    } catch (err) {
      console.error('PartsCart: could not persist cart ->', err.message);
    } finally {
      setTimeout(() => { partsWritingRef.current = false; }, 0);
    }
  }, [state.items, partsKey]);

  // Keep other tabs in step with the parts cart too.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== partsKey || partsWritingRef.current) return;
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
  }, [partsKey]);

  // Persist on every change. A failure here is non-fatal: the cart keeps
  // working in memory for the rest of the session.
  useEffect(() => {
    if (servicePendingRef.current === serviceKey) { servicePendingRef.current = null; return; }
    try {
      writingRef.current = true;
      localStorage.setItem(serviceKey, JSON.stringify(service));
    } catch (err) {
      console.error('ServiceCart: could not persist cart ->', err.message);
    } finally {
      // Release on the next tick — the storage event fires asynchronously.
      setTimeout(() => { writingRef.current = false; }, 0);
    }
  }, [service, serviceKey]);

  // Keep other tabs in step.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== serviceKey || writingRef.current) return;
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
  }, [serviceKey]);

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
      localStorage.removeItem(partsKey);
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
      localStorage.removeItem(serviceKey);
    } catch (err) {
      console.error('ServiceCart: could not clear stored cart ->', err.message);
    }
  }, [serviceKey]);

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

/* The bare bases are no longer usable as storage keys on their own -- a cart
   only exists inside an identity's bucket. The builders are exported so any
   future caller derives the same scoped key rather than reinventing it. */
export { CART_KEY_BASE, PARTS_CART_KEY_BASE, scopeOf, serviceKeyFor, partsKeyFor };
