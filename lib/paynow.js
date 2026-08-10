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

async function createPayment({ amount, method, phone, reference, description }) {
  const id = process.env.PAYNOW_INTEGRATION_ID;
  const key = process.env.PAYNOW_INTEGRATION_KEY;
  if (!id || !key) {
    throw new Error('Paynow credentials missing. Set PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY.');
  }
  const returnUrl = `${process.env.PUBLIC_URL || ''}/developers/billing?paid=1`;
  const resultUrl  = `${process.env.PUBLIC_URL || ''}/api/paynow/update`;

  const values = [id, reference || 'ref', String(amount), 'USD', phone || '', description || 'Stigma', returnUrl, resultUrl, method || 'ecocash'];
  const hash = makeHash(values, key);
  const body = new URLSearchParams();
  values.forEach((v, i) => body.append(['id','reference','amount','additionalinfo','phone','description','returnurl','resulturl','method'][i], v));
  body.append('hash', hash);

  const res = await fetch('https://www.paynow.co.zw/interface/initiatetransaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const text = await res.text();
  // Paynow responds as form-urlencoded by default but also as JSON if Accept is set.
  // Quick parse: look for "status=ok" and the browserurl=... field.
  const data = Object.fromEntries(text.split('&').map((p) => {
    const [k, v = ''] = p.split('=');
    return [decodeURIComponent(k), decodeURIComponent(v.replace(/\+/g, ' '))];
  }));
  if ((data.status || '').toLowerCase() !== 'ok') {
    throw new Error(data.error || 'Paynow declined the pollen.');
  }
  return { redirectUrl: data.browserurl, pollUrl: data.pollurl };
}

function verifyUpdate(params) {
  const key = process.env.PAYNOW_INTEGRATION_KEY;
  const hash = makeHash([params.id, params.reference, params.amount, params.additionalinfo, params.status, params.phone], key);
  return hash === (params.hash || '').toUpperCase();
}

module.exports = { createPayment, verifyUpdate };
