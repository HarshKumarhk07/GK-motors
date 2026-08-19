import API from './axios';

// Public — send a message from the /contact form.
export const sendContactMessage = (data) => API.post('/contact', data);

// Admin.
export const getContactMessages = (params) => API.get('/contact', { params });
export const updateContactMessage = (id, data) => API.put(`/contact/${id}`, data);
