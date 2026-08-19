import API from './axios';

// Cars
export const getRentalCars = (params) => API.get('/rentals/cars', { params });
export const getRentalCar = (id) => API.get(`/rentals/cars/${id}`);
export const createRentalCar = (data) =>
  API.post('/rentals/cars', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateRentalCar = (id, data) =>
  API.put(`/rentals/cars/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteRentalCar = (id) => API.delete(`/rentals/cars/${id}`);

// Bookings
export const createRentalBooking = (data) =>
  API.post('/rentals/bookings', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const verifyRentalPayment = (data) => API.post('/rentals/bookings/verify', data);
export const getMyRentalBookings = () => API.get('/rentals/bookings/my');
export const getAllRentalBookings = (params) => API.get('/rentals/bookings', { params });
export const updateRentalBookingStatus = (id, data) =>
  API.put(`/rentals/bookings/${id}/status`, data);
export const cancelMyRentalBooking = (id) => API.put(`/rentals/bookings/${id}/cancel`);
export const collectRentalBalance = (id, data) => API.put(`/rentals/bookings/${id}/collect-balance`, data);
export const createRentalBalanceOrder = (id) => API.post(`/rentals/bookings/pay-balance/${id}`);
export const verifyRentalBalancePayment = (id, data) => API.post(`/rentals/bookings/verify-balance/${id}`, data);


// Location tracking
export const getBookingLocation = (id) => API.get(`/rentals/bookings/${id}/location`);
export const getActiveLocations = () => API.get('/rentals/bookings/active-locations');