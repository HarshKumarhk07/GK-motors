/**
 * Turn an axios error into a message worth showing a customer.
 *
 * The backend answers with { success:false, message } via errorHandler.js, so
 * that message wins when present. Everything else maps to a plain-language
 * fallback rather than leaking a status code.
 */
export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again') {
  if (!error) return fallback;

  // Request never reached the server
  if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
    return 'Request timed out. Please retry';
  }
  if (!error.response) {
    return 'Network error. Please check your connection';
  }

  const { status, data } = error.response;
  const serverMessage = typeof data?.message === 'string' ? data.message.trim() : '';

  switch (status) {
    case 400:
      return serverMessage || 'Please check the details you entered';
    case 401:
      return serverMessage || 'Your session has expired. Please log in again';
    case 403:
      return serverMessage || "You don't have permission to do that";
    case 404:
      return serverMessage || 'Resource not found';
    case 409:
      return serverMessage || 'That conflicts with something that already exists';
    case 413:
      return 'That file is too large. Please use one under 5MB';
    case 429:
      return 'Too many requests. Please wait a moment and try again';
    default:
      if (status >= 500) return serverMessage || 'Something went wrong. Please try again';
      return serverMessage || fallback;
  }
}

/** Log with context, then hand back the customer-facing message. */
export function reportApiError(context, error, fallback) {
  console.error(`[${context}]`, error?.response?.data || error);
  return getApiErrorMessage(error, fallback);
}
