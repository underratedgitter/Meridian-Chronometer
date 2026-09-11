/**
 * Meridian Chronometer — Security Sanitization & Safe Object Utilities
 * Provides XSS prevention and prototype pollution immunity.
 * Zero external dependencies.
 */

/**
 * Escapes HTML characters in a string or value to prevent Cross-Site Scripting (XSS).
 * Handles null, undefined, numbers, and strings safely.
 * @param {unknown} val
 * @returns {string}
 */
export function escapeHTML(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Safely merges user options into default options, protecting against prototype pollution.
 * Creates an object with a clean fallback, explicitly rejecting __proto__, constructor,
 * and prototype properties.
 * @param {Record<string, any>} defaults
 * @param {Record<string, any>} options
 * @returns {Record<string, any>}
 */
export function safeMerge(defaults = {}, options = {}) {
  const BLOCKED = new Set(['__proto__', 'constructor', 'prototype']);

  function sanitizeValue(value, seen = new WeakMap(), depth = 0) {
    if (depth > 20) return value;
    if (Array.isArray(value)) {
      if (seen.has(value)) return seen.get(value);
      const arr = [];
      seen.set(value, arr);
      for (const item of value) arr.push(sanitizeValue(item, seen, depth + 1));
      return arr;
    }
    if (value && typeof value === 'object') {
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) return value;
      if (seen.has(value)) return seen.get(value);
      const out = {};
      seen.set(value, out);
      for (const key of Object.keys(value)) {
        if (!BLOCKED.has(key)) {
          out[key] = sanitizeValue(value[key], seen, depth + 1);
        }
      }
      for (const sym of Object.getOwnPropertySymbols(value)) {
        if (Object.prototype.propertyIsEnumerable.call(value, sym)) {
          out[sym] = sanitizeValue(value[sym], seen, depth + 1);
        }
      }
      return out;
    }
    return value;
  }

  const a = defaults && typeof defaults === 'object' ? sanitizeValue(defaults) : {};
  const b = options && typeof options === 'object' ? sanitizeValue(options) : {};
  const cleanA = a && typeof a === 'object' && !Array.isArray(a) ? a : {};
  const cleanB = b && typeof b === 'object' && !Array.isArray(b) ? b : {};
  return { ...cleanA, ...cleanB };
}
