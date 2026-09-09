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
  const clean = Object.create(null);
  if (defaults && typeof defaults === 'object') {
    Object.assign(clean, defaults);
  }
  if (options && typeof options === 'object') {
    for (const key of Object.keys(options)) {
      if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
        clean[key] = options[key];
      }
    }
  }
  return { ...clean };
}
