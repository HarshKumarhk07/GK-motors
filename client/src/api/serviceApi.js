import API from './axios';

/* ── Service catalogue ─────────────────────────────────────────────────── */

// Flat list of active packages + a `grouped` view keyed by categoryId
export const getServiceCategories = () => API.get('/services/categories');

// Legacy: active service types for the old single-service screen
export const getActiveServiceTypes = () => API.get('/admin/service-types/active');

/* ── Service cars (the catalogue customers pick from) ──────────────────── */

export const getServiceCars = (params) => API.get('/service-cars', { params });
export const getServiceCar = (id) => API.get(`/service-cars/${id}`);
export const getAllServiceCars = () => API.get('/service-cars/admin');

export const createServiceCar = (formData) =>
  API.post('/service-cars', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const updateServiceCar = (id, formData) =>
  API.put(`/service-cars/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const deleteServiceCar = (id) => API.delete(`/service-cars/${id}`);

/* ── Booking ───────────────────────────────────────────────────────────── */

// Which of the 09:00-18:00 slots are still open on a given YYYY-MM-DD
export const getAvailability = (date) => API.get('/services/availability', { params: { date } });

// GK Motors booking: one car + one or more service packages
export const createServiceBooking = (data) => API.post('/services/book', data);

// Legacy single-service booking
export const createBooking = (data) => API.post('/services', data);

export const getMyBookings = () => API.get('/services/my');
export const getBooking = (id) => API.get(`/services/${id}`);
export const getAllBookings = (params) => API.get('/services', { params });
export const updateBookingStatus = (id, data) => API.put(`/services/${id}/status`, data);

/* ── Payment (Razorpay: create order → verify signature) ───────────────── */

export const createServicePayment = (id, data) => API.post(`/services/${id}/payment`, data);
export const verifyServicePayment = (id, data) => API.post(`/services/${id}/verify-payment`, data);
