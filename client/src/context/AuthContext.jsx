import { createContext, useContext, useReducer, useEffect } from 'react';
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

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const [wishlist, setWishlist] = useReducer((prev, id) => {
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    localStorage.setItem('moto_wishlist', JSON.stringify(next));
    return next;
  }, JSON.parse(localStorage.getItem('moto_wishlist') || '[]'));

  const toggleWishlist = (id) => setWishlist(id);

  const login = async (credentials) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { data } = await authApi.login(credentials);
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

