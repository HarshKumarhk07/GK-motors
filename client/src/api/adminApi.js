import API from './axios';

export const getStats = () => API.get('/admin/stats');
export const getUsers = (page = 1) => API.get(`/admin/users?page=${page}&limit=20`);
export const updateUser = (id, data) => API.put(`/admin/users/${id}`, data);
export const getMechanics = () => API.get('/admin/mechanics');
export const createMechanic = (data) => API.post('/admin/mechanics', data);

export const getBikes = (page = 1) => API.get(`/bikes?page=${page}&limit=20&isAdmin=true`);
export const createBike = (data) => API.post('/bikes', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateBike = (id, data) => API.put(`/bikes/${id}`, data);
export const updateBikeMultipart = (id, data) => API.put(`/bikes/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const approveBike = (id) => API.put(`/admin/bikes/${id}/approve`);
export const deleteBike = (id) => API.delete(`/bikes/${id}`);
export const getBikeBrands = () => API.get('/bikes/brands');

export const getServices = (page = 1) => API.get(`/services?page=${page}&limit=20`);
export const updateServiceStatus = (id, data) => API.put(`/services/${id}/status`, data);

export const getSells = (page = 1) => API.get(`/sell?page=${page}&limit=20`);
export const updateSellStatus = (id, data) => API.put(`/sell/${id}/status`, data);

export const getOrders = (page = 1) => API.get(`/store/orders?page=${page}&limit=20`);
export const updateOrderStatus = (id, data) => API.put(`/store/orders/${id}/status`, data);

// The admin list, not the storefront one: /store/parts pages at 12 and hides
// inactive parts, so anything past the twelfth newest never reached the panel.
export const getParts = () => API.get('/store/parts/admin');
export const getPartCategories = () => API.get('/store/parts/categories');
export const createPart = (data) => API.post('/store/parts', data);
export const updatePart = (id, data) => API.put(`/store/parts/${id}`, data);
export const updatePartMultipart = (id, data) => API.put(`/store/parts/${id}`, data);
export const deletePart = (id) => API.delete(`/store/parts/${id}`);

// Enquiries
export const getAllEnquiries = () => API.get('/admin/enquiries');
export const updateEnquiry = (id, data) => API.put(`/admin/enquiries/${id}`, data);

// Service Types
export const getServiceTypes = () => API.get('/admin/service-types');
export const createServiceType = (data) => API.post('/admin/service-types', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateServiceType = (id, data) => API.put(`/admin/service-types/${id}`, data);
export const deleteServiceType = (id) => API.delete(`/admin/service-types/${id}`);

// Categories
export const getAdminCategories = () => API.get('/admin/categories');
export const createCategory = (data) => API.post('/admin/categories', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteCategory = (id) => API.delete(`/admin/categories/${id}`);

// Brands
export const getAdminBrands = () => API.get('/admin/brands-list');
export const createBrand = (data) => API.post('/admin/brands', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteBrand = (id) => API.delete(`/admin/brands/${id}`);

// ── GK Motors: service cars ──
export const getAdminServiceCars = () => API.get('/service-cars/admin');
export const createAdminServiceCar = (formData) =>
  API.post('/service-cars', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateAdminServiceCar = (id, formData) =>
  API.put(`/service-cars/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteAdminServiceCar = (id) => API.delete(`/service-cars/${id}`);

// ── GK Motors: service packages (ServiceType docs) ──
// Multipart variant so a category image can be attached.
export const updateServiceTypeMultipart = (id, formData) =>
  API.put(`/admin/service-types/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// One image for a whole category (applied to every package inside it).
// Pass an empty FormData to clear it and fall back to the shipped illustration.
export const setCategoryImage = (categoryId, formData) =>
  API.put(`/admin/service-types/category-image/${categoryId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
