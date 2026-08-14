/**
 * Paynow (Zimbabwe) integration — minimal helper.
 * https://www.paynow.co.zw/Developer/Home
 *
 * We only need two operations:
 *   - create a payment (initiate) and return the URL the user is sent to
 *   - verify the status of a payment (not used yet; Paynow polls/redirects)
 *
 * Paynow supports Ecocash, OneMoney, Innbucks and more via the same flow.
 */
const crypto = require('crypto');

function makeHash(values, integrationKey) {
  // Paynow expects: sha512(concat(values) + integrationKey), uppercased
  const str = values.join('') + integrationKey;
  return crypto.createHash('sha512').update(str).digest('hex').toUpperCase();
}

async function createPayment({ amount, authphone, reference, description }) {
  const id = process.env.PAYNOW_INTEGRATION_ID;
  const key = process.env.PAYNOW_INTEGRATION_KEY;
  if (!id || !key) {
    throw new Error('Paynow credentials missing. Set PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY.');
  }
  const returnUrl = `${process.env.PUBLIC_URL || ''}/developers/billing?paid=1`;
  const resultUrl = `${process.env.PUBLIC_URL || ''}/api/paynow/update`;

  // Paynow field order for hash: id, reference, amount, additionalinfo, returnurl, resulturl, status
  // Paynow requires status to be set to "Message" at initiation (empty string produces an invalid hash).
  // Body fields: id, reference, amount, additionalinfo, returnurl, resulturl, status, authphone (optional).
  // Note: Paynow has no "method" field — the payment method is chosen on Paynow's own page.
  const amountStr = parseFloat(amount).toFixed(2);
  const additionalinfo = description || 'Stigma top-up';
  const hashValues = [id, reference || 'ref', amountStr, additionalinfo, returnUrl, resultUrl, 'Message'];
  const hash = makeHash(hashValues, key);

  const body = new URLSearchParams({
    id,
    reference: reference || 'ref',
    amount: amountStr,
    additionalinfo,
    returnurl: returnUrl,
    resulturl: resultUrl,
    status: 'Message',
    ...(authphone ? { authphone } : {}),
    hash
  });

  const res = await fetch('https://www.paynow.co.zw/interface/initiatetransaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const text = await res.text();
  // Paynow responds as form-urlencoded
  const data = Object.fromEntries(
    text.split('&').map((p) => {
      const eq = p.indexOf('=');
      const k = decodeURIComponent(p.slice(0, eq));
      const v = decodeURIComponent(p.slice(eq + 1).replace(/\+/g, ' '));
      return [k, v];
    })
  );
  if ((data.status || '').toLowerCase() !== 'ok') {
    throw new Error(data.error || `Paynow error: ${text.slice(0, 200)}`);
  }
  return { redirectUrl: data.browserurl, pollUrl: data.pollurl };
}

function verifyUpdate(params) {
  // Paynow status-update POST message order:
  //   reference, paynowreference, amount, status, pollurl
  // Hash: sha512(concat(values) + key), uppercased.
  const key = process.env.PAYNOW_INTEGRATION_KEY;
  if (!key) return false;
  const expected = makeHash(
    [
      params.reference || '',
      params.paynowreference || '',
      params.amount || '',
      params.status || '',
      params.pollurl || ''
    ],
    key
  );
  return expected === (params.hash || '').toUpperCase();
}

module.exports = { createPayment, verifyUpdate };
