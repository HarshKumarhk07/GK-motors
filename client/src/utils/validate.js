/**
 * Form validation and input sanitisation.
 *
 * The mirror of server/src/utils/sanitize.js, with the same rules so a field
 * the browser accepts is one the API accepts. Two differences, both
 * deliberate:
 *
 *   - Nothing here throws. Form code wants a message to show next to a field,
 *     not an exception, so every check returns an error string or ''.
 *
 *   - This is NOT a security boundary. Anyone can skip it with curl. It exists
 *     so a customer finds out about a typo while they are still looking at the
 *     field, instead of after a round trip. The server enforces every rule
 *     again, and it is the server's copy that protects the data.
 */

/* Only strip a tag when a letter follows the bracket, so "<b>" goes and
   ordinary prose like "5 < 6" survives. */
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

/** Matches server/src/utils/sanitize.js: controls except tab and newline,
 *  plus zero-width and bidi-override characters. */
const isUnprintable = (code) =>
  code <= 8
  || code === 11
  || code === 12
  || (code >= 14 && code <= 31)
  || (code >= 127 && code <= 159)
  || (code >= 0x200b && code <= 0x200f)
  || (code >= 0x202a && code <= 0x202e)
  || (code >= 0x2060 && code <= 0x2064)
  || code === 0xfeff;

export const stripTags = (value) => {
  const withoutMarkup = String(value ?? '').replace(HTML_COMMENT, '').replace(HTML_TAG, '');
  let out = '';
  for (const ch of withoutMarkup) {
    if (!isUnprintable(ch.codePointAt(0))) out += ch;
  }
  return out;
};

/** Sanitised single-line value: markup out, whitespace collapsed, trimmed. */
export const cleanText = (value) => stripTags(value).replace(/\s+/g, ' ').trim();

/** Sanitised multi-line value: paragraphs preserved. */
export const cleanMultiline = (value) =>
  stripTags(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* Checks. Each returns an error message, or '' when the value is fine. */

export const textError = (value, { label = 'This field', min = 0, max = 500, required = false } = {}) => {
  const v = cleanText(value);
  if (!v) return required ? `${label} is required` : '';
  if (v.length < min) return `${label} must be at least ${min} characters`;
  if (v.length > max) return `${label} cannot exceed ${max} characters`;
  return '';
};

export const multilineError = (value, { label = 'This field', min = 0, max = 2000, required = false } = {}) => {
  const v = cleanMultiline(value);
  if (!v) return required ? `${label} is required` : '';
  if (v.length < min) return `${label} must be at least ${min} characters`;
  if (v.length > max) return `${label} cannot exceed ${max} characters`;
  return '';
};

export const emailError = (value, { required = false } = {}) => {
  const v = cleanText(value).toLowerCase();
  if (!v) return required ? 'Email address is required' : '';
  if (v.length > 254 || !EMAIL_RE.test(v)) return 'That email address does not look right';
  return '';
};

export const phoneError = (value, { required = false } = {}) => {
  const v = stripTags(value).replace(/[\s()-]/g, '').trim();
  if (!v) return required ? 'Phone number is required' : '';
  if (!/^\+?\d{7,15}$/.test(v)) return 'That phone number does not look right';
  return '';
};

export const pincodeError = (value, { required = true } = {}) => {
  const v = stripTags(value).replace(/\s/g, '').trim();
  if (!v) return required ? 'Pincode is required' : '';
  if (!/^[1-9]\d{5}$/.test(v)) return 'Enter a valid 6-digit pincode (cannot start with 0)';
  return '';
};

export const numberError = (value, { label = 'This field', min, max, integer = false, required = false } = {}) => {
  if (value === '' || value === null || value === undefined) {
    return required ? `${label} is required` : '';
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return `${label} must be a number`;
  if (integer && !Number.isInteger(n)) return `${label} must be a whole number`;
  if (min !== undefined && n < min) return `${label} must be at least ${min}`;
  if (max !== undefined && n > max) return `${label} cannot be more than ${max}`;
  return '';
};

/**
 * bcrypt only reads the first 72 bytes, so anything longer is not the password
 * the customer thinks they set. The server rejects it for the same reason.
 */
export const passwordError = (value, { min = 6, required = true } = {}) => {
  const v = String(value ?? '');
  if (!v) return required ? 'Password is required' : '';
  if (v.length < min) return `Password must be at least ${min} characters`;
  if (v.length > 72) return 'Password cannot exceed 72 characters';
  return '';
};

/**
 * Run a set of checks and collect the failures.
 *
 *   const errors = validateAll({
 *     name:  () => textError(form.name, { label: 'Name', min: 2, required: true }),
 *     email: () => emailError(form.email, { required: true }),
 *   });
 *   if (Object.keys(errors).length) { setErrors(errors); return; }
 *
 * Returns an object keyed by field name, empty when everything passed.
 */
export const validateAll = (checks) => {
  const errors = {};
  for (const [field, check] of Object.entries(checks)) {
    const message = check();
    if (message) errors[field] = message;
  }
  return errors;
};

/**
 * Keystroke filters, for fields where the wrong character should simply never
 * appear rather than produce an error after the fact.
 */
export const digitsOnly = (value, max = 10) => String(value ?? '').replace(/\D/g, '').slice(0, max);
export const phoneChars = (value) => String(value ?? '').replace(/[^\d+\s()-]/g, '').slice(0, 20);
