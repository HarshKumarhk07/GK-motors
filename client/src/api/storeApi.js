import API from './axios';

// Sell
export const getPriceEstimate = (data) => API.post('/sell/estimate', data);
export const createSellRequest = (data) => API.post('/sell', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getMySellRequests = () => API.get('/sell/my');
export const getSellRequest = (id) => API.get(`/sell/${id}`);
export const getAllSellRequests = (params) => API.get('/sell', { params });
export const updateSellStatus = (id, data) => API.put(`/sell/${id}/status`, data);

// Parts
export const getPartCategories = () => API.get('/store/parts/categories');
export const getParts = (params) => API.get('/store/parts', { params });
export const getPart = (id) => API.get(`/store/parts/${id}`);
export const getFeaturedParts = (params) => API.get('/store/parts/featured', { params });
export const getBestsellerParts = (params) => API.get('/store/parts/bestseller', { params });
export const getUpcomingParts = (params) => API.get('/store/parts/upcoming', { params });
export const getRecentParts = (params) => API.get('/store/parts/recent', { params });
export const searchParts = (params) => API.get('/store/parts/search', { params });
export const createPart = (data) => API.post('/store/parts', data, { headers: { 'Content-Type': 'multipart/form-data' } });

// Orders
export const placeOrder = (data) => API.post('/store/orders', data);
export const getMyOrders = () => API.get('/store/orders/my');
export const getOrder = (id) => API.get(`/store/orders/${id}`);
export const createPartPayment = (id) => API.post(`/store/orders/${id}/payment`);
export const verifyPartPayment = (id, data) => API.post(`/store/orders/${id}/verify-payment`, data);
export const updateOrderStatus = (id, data) => API.put(`/store/orders/${id}/status`, data);
export const getAllOrders = (params) => API.get('/store/orders', { params });
