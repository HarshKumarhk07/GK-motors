import API from './axios';

export const getBikes = (params) => API.get('/bikes', { params });
export const getBike = (id) => API.get(`/bikes/${id}`);
export const getFeaturedBikes = () => API.get('/bikes/featured');
export const getBestsellerBikes = () => API.get('/bikes/bestseller');
export const createBike = (data) => API.post('/bikes', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateBike = (id, data) => API.put(`/bikes/${id}`, data);
export const deleteBike = (id) => API.delete(`/bikes/${id}`);
export const enquireBike = (id, data) => API.post(`/bikes/${id}/enquire`, data);
export const getMyEnquiries = () => API.get('/bikes/my-enquiries');
export const approveBike = (id) => API.put(`/admin/bikes/${id}/approve`);
