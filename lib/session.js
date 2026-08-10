/**
 * Cookie-based session. We keep it intentionally tiny:
 *   stigma_session  -> signed userId (signed-in person)
 *   stigma_active   -> signed accountId (the "confirmed" / currently active account)
 *
 * Signature is HMAC-SHA256 using SESSION_SECRET.
 */
const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || 'stigma-dev-secret-change-me';

function sign(value) {
  const v = Buffer.from(value).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
  return `${v}.${sig}`;
}

function verify(token) {
  if (!token) return null;
  const [v, sig] = token.split('.');
  if (!v || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
  if (sig !== expected) return null;
  return Buffer.from(v, 'base64url').toString();
}

function getCookie(req, name) {
  return req.cookies?.[name];
}

function setCookie(res, name, value, maxAgeSec) {
  res.cookie(name, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.PUBLIC_URL?.startsWith('https'),
    maxAge: maxAgeSec * 1000,
    path: '/'
  });
}

function clearCookie(res, name) {
  res.clearCookie(name, { path: '/' });
}

const db = require('./db');

function currentUser(req) {
  const tok = getCookie(req, 'stigma_session');
  const id = verify(tok);
  if (!id) return null;
  return db.getUser(id);
}

function signInUser(res, userId) {
  setCookie(res, 'stigma_session', sign(userId), 60 * 60 * 24 * 30);
}

function signOut(res) {
  clearCookie(res, 'stigma_session');
  clearCookie(res, 'stigma_active');
}

function confirmedAccountId(req) {
  const tok = getCookie(req, 'stigma_active');
  return verify(tok);
}

function confirmAccount(res, accountId, maxAgeSec) {
  setCookie(res, 'stigma_active', sign(accountId), maxAgeSec);
}

function confirmedAccount(req) {
  const user = currentUser(req);
  if (!user) return null;
  const accId = confirmedAccountId(req);
  if (!accId) return null;
  return db.getAccount(user.id, accId);
}

module.exports = { currentUser, signInUser, signOut, confirmedAccount, confirmedAccountId, confirmAccount };
