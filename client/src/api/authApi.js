import API from './axios';

export const register = (data) => API.post('/auth/register', data);
export const login = (data) => API.post('/auth/login', data);
export const sendOTP = (data) => API.post('/auth/send-otp', data);
export const verifyOTP = (data) => API.post('/auth/verify-otp', data);
export const getMe = () => API.get('/auth/me');
export const updateProfile = (data) => API.put('/auth/profile', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const addAddress = (data) => API.post('/auth/address', data);
export const updateAddress = (addressId, data) => API.put(`/auth/address/${addressId}`, data);
export const deleteAddress = (addressId) => API.delete(`/auth/address/${addressId}`);
export const toggleWishlist = (bikeId) => API.post(`/auth/wishlist/${bikeId}`);
