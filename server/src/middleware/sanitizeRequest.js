const { stripUnprintable } = require('../utils/sanitize');

/**
 * Request-wide hardening, applied before any controller runs.
 *
 * Two jobs, both of which have to happen for every route rather than being
 * remembered per handler:
 *
 * 1. NoSQL operator injection.
 *    Mongoose queries in this codebase are built from request values --
 *    `User.findOne({ email })`, `SparePart.find(query)`. If `email` arrives as
 *    the object `{"$ne": null}` instead of a string, that query stops meaning
 *    "this address" and starts meaning "any user at all", which is a login
 *    bypass. Keys beginning with `$` are operators, and keys containing `.`
 *    address nested paths; neither has any business coming from a client, so
 *    both are dropped here once, for everything.
 *
 * 2. Unprintable characters.
 *    Zero-width and bidi-override characters are stripped from every incoming
 *    string. Controllers sanitise the fields they know about; this catches the
 *    ones they pass through untouched.
 *
 * Deliberately NOT done here: trimming, length limits, format checks. Those
 * are field-specific and belong with the controller that understands what the
 * field means -- a global trim would silently corrupt a password.
 */

// A crafted payload should not be able to spend the event loop on traversal.
const MAX_DEPTH = 12;

const clean = (value, depth) => {
  if (depth > MAX_DEPTH) return undefined;

  if (typeof value === 'string') return stripUnprintable(value);
  if (value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => clean(item, depth + 1));
  }

  /* Only genuinely special objects are passed through untouched. An earlier
     version bailed out on anything whose prototype was not Object.prototype,
     which is too strict in the direction that matters: an object carrying a
     tampered prototype would have been handed straight back unscanned. */
  if (value instanceof Date || value instanceof RegExp || Buffer.isBuffer(value)) {
    return value;
  }

  const out = {};
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) continue;
    // __proto__ / constructor / prototype: prototype-pollution vectors that
    // Object.keys will happily hand over on a parsed JSON body.
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const cleaned = clean(value[key], depth + 1);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
};

const sanitizeRequest = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = clean(req.body, 0);
  }

  /* req.query and req.params are getters on some Express versions, so their
     contents are replaced in place rather than reassigned. */
  for (const source of [req.query, req.params]) {
    if (!source || typeof source !== 'object') continue;
    for (const key of Object.keys(source)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete source[key];
        continue;
      }
      const cleaned = clean(source[key], 0);
      if (cleaned === undefined) delete source[key];
      else source[key] = cleaned;
    }
  }

  next();
};

module.exports = sanitizeRequest;
