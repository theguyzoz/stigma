/**
 * Paynow Zimbabwe integration.
 * Hash algorithm verified against the official Paynow NodeJS SDK source:
 *   github.com/paynow/Paynow-NodeJS-SDK/blob/master/dist/paynow.js
 *
 * Key rules:
 *  - Hash = SHA512( concat(all field values except "hash", in insertion order) + integrationKey.toLowerCase() )
 *  - Result is uppercased hex.
 *  - For initiate: field order is resulturl, returnurl, reference, amount, id, additionalinfo, authemail, status
 *    (and for mobile: same + phone, method before status)
 *  - For webhook verify: hash all fields Paynow POSTed (in the order they arrive) except "hash", same algorithm.
 */

'use strict';

const crypto = require('crypto');

function sha512Upper(str) {
  return crypto.createHash('sha512').update(str, 'utf8').digest('hex').toUpperCase();
}

/**
 * Generate a Paynow hash.
 * @param {Object} fields - ordered plain object of all fields (hash key excluded automatically)
 * @param {string} integrationKey
 */
function generateHash(fields, integrationKey) {
  let str = '';
  for (const key of Object.keys(fields)) {
    if (key.toLowerCase() !== 'hash') {
      str += (fields[key] == null ? '' : String(fields[key]));
    }
  }
  str += integrationKey.toLowerCase();
  return sha512Upper(str);
}

/**
 * Parse Paynow's URL-encoded response string into a plain object.
 */
function parseResponse(text) {
  const obj = {};
  for (const pair of text.split('&')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const k = decodeURIComponent(pair.slice(0, eq));
    const v = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '));
    obj[k] = v;
  }
  return obj;
}

/**
 * Initiate a Paynow payment (mobile express checkout).
 *
 * Field order matches the official SDK buildMobile():
 *   resulturl, returnurl, reference, amount, id, additionalinfo, authemail, phone, method, status
 *
 * @returns {Promise<{ redirectUrl: string|null, pollUrl: string, instructions: string|null }>}
 */
async function createPayment({ amount, method, phone, authemail, reference, description }) {
  const id  = process.env.PAYNOW_INTEGRATION_ID;
  const key = process.env.PAYNOW_INTEGRATION_KEY;
  if (!id || !key) throw new Error('Set PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY in your .env');

  const returnUrl = `${process.env.PUBLIC_URL || ''}/developers/billing?paid=1`;
  const resultUrl = `${process.env.PUBLIC_URL || ''}/api/paynow/update`;
  const amountStr  = parseFloat(amount).toFixed(2);

  // Field order MUST match this exactly — it determines the hash concatenation order.
  const fields = {
    resulturl:      resultUrl,
    returnurl:      returnUrl,
    reference:      reference || 'ref',
    amount:         amountStr,
    id:             id,
    additionalinfo: description || 'Stigma top-up',
    authemail:      authemail  || '',
    phone:          phone      || '',
    method:         method     || 'ecocash',
    status:         'Message',
  };

  fields.hash = generateHash(fields, key);

  const body = new URLSearchParams(fields);

  const res = await fetch('https://www.paynow.co.zw/interface/remotetransaction', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await res.text();
  const data = parseResponse(text);

  if ((data.status || '').toLowerCase() === 'error') {
    throw new Error(data.error || `Paynow error: ${text.slice(0, 300)}`);
  }

  // Verify Paynow's response hash before trusting the URLs
  const expectedHash = generateHash(data, key);
  if (data.hash && data.hash.toUpperCase() !== expectedHash) {
    throw new Error('Paynow response hash mismatch — possible tampering');
  }

  return {
    redirectUrl:  data.browserurl  || null,
    pollUrl:      data.pollurl     || null,
    instructions: data.instructions || null,
  };
}

/**
 * Verify the hash on a Paynow status-update POST (webhook).
 * Paynow sends all fields in a fixed order; we hash them all except "hash", same algorithm.
 *
 * @param {Object} params - req.body from the webhook POST
 * @returns {boolean}
 */
function verifyUpdate(params) {
  const key = process.env.PAYNOW_INTEGRATION_KEY;
  if (!key) return false;
  const received = (params.hash || '').toUpperCase();
  if (!received) return false;
  const expected = generateHash(params, key);
  return received === expected;
}

module.exports = { createPayment, verifyUpdate };
