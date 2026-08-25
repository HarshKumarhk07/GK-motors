import { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import * as authApi from '../api/authApi';

const AuthContext = createContext();

const initialState = {
  user: JSON.parse(localStorage.getItem('bikeservice_user')) || null,
  token: localStorage.getItem('bikeservice_token') || null,
  loading: false,
  error: null,
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING': return { ...state, loading: action.payload };
    case 'LOGIN_SUCCESS':
      localStorage.setItem('bikeservice_token', action.payload.token);
      localStorage.setItem('bikeservice_user', JSON.stringify(action.payload.user));
      return { ...state, user: action.payload.user, token: action.payload.token, error: null, loading: false };
    case 'LOGOUT':
      localStorage.removeItem('bikeservice_token');
      localStorage.removeItem('bikeservice_user');
      return { ...state, user: null, token: null };
    case 'SET_ERROR': return { ...state, error: action.payload, loading: false };
    case 'UPDATE_USER': return { ...state, user: { ...state.user, ...action.payload } };
    default: return state;
  }
};

/* ── Per-identity wishlist storage ───────────────────────────────────────
   The wishlist used to live under one global 'moto_wishlist' key, so every
   profile on a browser shared one list: sign in as someone else and their
   saved items were yours. Same defect the carts had, same shape of fix.

   The key is suffixed with the authenticated user's stable _id -- the same id
   the login response returns and orders are owned by -- never the email.

   NOTE: `scopeOf` is deliberately duplicated from CartContext rather than
   imported. CartContext imports THIS module, so importing it back would form
   a cycle. The two must derive identical scopes; a test asserts they do. */
const WISHLIST_KEY_BASE = 'moto_wishlist';

const scopeOf = (user) => (user && user._id ? `u:${String(user._id)}` : 'guest');
const wishlistKeyFor = (scope) => `${WISHLIST_KEY_BASE}:${scope}`;

/* Reading used to be `JSON.parse(localStorage.getItem(...) || '[]')` inline in
   the render body: it ran on every render, and one corrupt entry threw out of
   AuthProvider -- the root provider -- taking the whole app down. Now it is a
   lazy initialiser that degrades to an empty list, and only a flat array of
   non-empty id strings is trusted. */
const readStoredWishlist = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && id) : [];
  } catch (err) {
    console.error('Wishlist: could not read stored wishlist ->', err.message);
    return [];
  }
};

/* One-time adoption of a pre-isolation wishlist, so the change does not
   silently empty the saved items of an existing customer. Moves once, into
   whichever identity is active on the first load after the update, and the
   legacy key is removed so it can never be adopted twice. */
const adoptLegacyWishlist = (scopedKey) => {
  try {
    if (localStorage.getItem(scopedKey) !== null) return;
    const legacy = localStorage.getItem(WISHLIST_KEY_BASE);
    if (legacy === null) return;
    localStorage.setItem(scopedKey, legacy);
    localStorage.removeItem(WISHLIST_KEY_BASE);
  } catch (err) {
    console.error('Wishlist: legacy adoption skipped ->', err.message);
  }
};

/* Pure -- the persistence that used to happen inside the reducer now lives in
   an effect, so a write can be withheld on the render where the identity has
   changed but the rehydrating dispatch has not landed yet. */
const wishlistReducer = (prev, action) => {
  switch (action.type) {
    case 'HYDRATE':
      return action.payload;
    case 'TOGGLE': {
      const id = action.payload;
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    }
    default:
      return prev;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  /* state.user is rehydrated synchronously in initialState, so the identity is
     already known on the first render -- there is no signed-out frame that
     could persist an empty list over a stored one. */
  const wishlistKey = wishlistKeyFor(scopeOf(state.user));

  const [wishlist, wishlistDispatch] = useReducer(wishlistReducer, wishlistKey, (k) => {
    adoptLegacyWishlist(k);
    return readStoredWishlist(k);
  });

  /* Which identity the list in hand belongs to, and which identity a hydration
     has been dispatched for but not yet applied. */
  const wishlistScopeRef = useRef(wishlistKey);
  const wishlistPendingRef = useRef(null);

  // Identity changed -> load that user's own list. Declared BEFORE the persist
  // effect below, which is what makes the ordering guarantee hold.
  useEffect(() => {
    if (wishlistScopeRef.current === wishlistKey) return;
    wishlistScopeRef.current = wishlistKey;
    wishlistPendingRef.current = wishlistKey;
    adoptLegacyWishlist(wishlistKey);
    wishlistDispatch({ type: 'HYDRATE', payload: readStoredWishlist(wishlistKey) });
  }, [wishlistKey]);

  useEffect(() => {
    // The hydration for this key has not been applied yet, so `wishlist` still
    // belongs to the previous identity -- writing now would copy it into the
    // new user's bucket. Skip exactly this run.
    if (wishlistPendingRef.current === wishlistKey) { wishlistPendingRef.current = null; return; }
    try {
      localStorage.setItem(wishlistKey, JSON.stringify(wishlist));
    } catch (err) {
      console.error('Wishlist: could not persist wishlist ->', err.message);
    }
  }, [wishlist, wishlistKey]);

  const toggleWishlist = (id) => wishlistDispatch({ type: 'TOGGLE', payload: id });

  // Sync latest user details (including saved addresses) on load/token change
  useEffect(() => {
    if (state.token) {
      authApi.getMe().then(({ data }) => {
        if (data.user) {
          dispatch({ type: 'UPDATE_USER', payload: data.user });
          localStorage.setItem('bikeservice_user', JSON.stringify({ ...state.user, ...data.user }));
        }
      }).catch(() => {});
    }
  }, [state.token]);

  const login = async (credentials) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { data } = await authApi.login(credentials);
      if (data.requiresSecretKey) {
        dispatch({ type: 'SET_LOADING', payload: false });
        return data;
      }
      dispatch({ type: 'LOGIN_SUCCESS', payload: data });
      return data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      dispatch({ type: 'SET_ERROR', payload: msg });
      throw new Error(msg);
    }
  };

  const register = async (userData) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { data } = await authApi.register(userData);
      dispatch({ type: 'LOGIN_SUCCESS', payload: data });
      return data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed';
      dispatch({ type: 'SET_ERROR', payload: msg });
      throw new Error(msg);
    }
  };

  const loginWithOTP = async (otpData) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { data } = await authApi.verifyOTP(otpData);
      dispatch({ type: 'LOGIN_SUCCESS', payload: data });
      return data;
    } catch (err) {
      const msg = err.response?.data?.message || 'OTP verification failed';
      dispatch({ type: 'SET_ERROR', payload: msg });
      throw new Error(msg);
    }
  };

  const logout = () => dispatch({ type: 'LOGOUT' });

  const updateUser = (userData) => {
    dispatch({ type: 'UPDATE_USER', payload: userData });
    localStorage.setItem('bikeservice_user', JSON.stringify({ ...state.user, ...userData }));
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, loginWithOTP, logout, updateUser, wishlist, toggleWishlist }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

