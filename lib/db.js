/**
 * JSON-file database. Simple but persistent.
 * On every write we mark the file "dirty" so the Drive backup knows to upload.
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
const STALE_MS = 30 * 60 * 1000; // auto-backup at most every 30 min

let cache = null;
let lastWrite = 0;
let backupScheduled = false;

function empty() {
  return {
    users: {},            // userId -> { id, email, passwordHash, createdAt }
    accounts: {},         // accountId -> { id, userId, firstName, lastName, phone, passwordHash, secondaryEmail, displayName, isPrimary, createdAt }
    developers: {},       // accountId -> { id, plan, aiModel, balance, createdAt }
    oauthClients: {},     // clientId -> { id, secret, name, ownerAccountId, redirectUris, createdAt }
    authCodes: {},        // code -> { code, clientId, userId, scope, redirectUri, expiresAt }
    accessTokens: {},     // token -> { token, userId, clientId, scope, expiresAt }
    consents: {},         // `${userId}:${clientId}` -> { scope, grantedAt }
    aiUsage: {},          // `${accountId}:${YYYY-MM-DD}` -> { dayCount, minuteCount, minuteStart }
    pendingDeposits: {},  // reference -> { reference, devId, amount, pollUrl, createdAt }
    depositHistory: {},   // txId -> { id, devId, amount, type, note, createdAt }
    settings: {}          // free-form
  };
}

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    cache = empty();
  }
  return cache;
}

function save() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
  lastWrite = Date.now();
  scheduleBackup();
}

function scheduleBackup() {
  if (backupScheduled) return;
  backupScheduled = true;
  setTimeout(() => {
    backupScheduled = false;
    const since = Date.now() - lastWrite;
    if (since < 5000) return; // batch writes within 5s
    try {
      require('./drive').backupNow().catch(() => {});
    } catch {}
  }, STALE_MS);
}

/* ----------------- users ----------------- */

function createUser({ firstName, lastName, phone, password }) {
  const id = 'usr_' + crypto.randomBytes(8).toString('hex');
  const email = `${firstName}.${lastName}.${id.slice(-6)}@stigma.local`.toLowerCase();
  cache = load();
  cache.users[id] = {
    id,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    createdAt: Date.now()
  };
  const accountId = createAccountForUser(id, { firstName, lastName, phone, password }, true);
  save();
  return id;
}

function findUserByEmail(email) {
  cache = load();
  return Object.values(cache.users).find((u) => u.email === (email || '').toLowerCase()) || null;
}

function getUser(id) {
  cache = load();
  return cache.users[id] || null;
}

function verifyPassword(user, password) {
  return user && bcrypt.compareSync(password, user.passwordHash);
}

/* ----------------- accounts ----------------- */

function createAccountForUser(userId, { firstName, lastName, phone, password }, primary = false) {
  cache = load();
  const id = 'acc_' + crypto.randomBytes(8).toString('hex');
  cache.accounts[id] = {
    id,
    userId,
    firstName,
    lastName,
    phone,
    passwordHash: bcrypt.hashSync(password, 10),
    secondaryEmail: '',
    displayName: '',
    isPrimary: primary,
    createdAt: Date.now()
  };
  save();
  return id;
}

function getAccount(userId, accountId) {
  cache = load();
  const a = cache.accounts[accountId];
  if (!a || a.userId !== userId) return null;
  return a;
}

function getPrimaryAccount(userId) {
  cache = load();
  return Object.values(cache.accounts).find((a) => a.userId === userId && a.isPrimary) || null;
}

function getAccountsForUser(userId) {
  cache = load();
  return Object.values(cache.accounts).filter((a) => a.userId === userId);
}

function updateAccount(id, patch) {
  cache = load();
  if (!cache.accounts[id]) return null;
  cache.accounts[id] = { ...cache.accounts[id], ...patch };
  save();
  return cache.accounts[id];
}

/* ----------------- developers ----------------- */

function enableDeveloper(accountId) {
  cache = load();
  cache.developers[accountId] = {
    id: accountId,
    plan: 'free',
    aiModel: 'gpt-template',
    balance: 0,       // USD cents (e.g. 500 = $5.00)
    createdAt: Date.now()
  };
  save();
}

function getDeveloper(accountId) {
  cache = load();
  const dev = cache.developers[accountId];
  if (!dev) return null;
  // Back-fill balance for records created before the virtual balance feature
  if (typeof dev.balance === 'undefined') {
    dev.balance = 0;
    save();
  }
  return dev;
}

function getDeveloperByClient(clientId) {
  cache = load();
  const c = cache.oauthClients[clientId];
  if (!c) return null;
  return cache.developers[c.ownerAccountId] || null;
}

function updateDeveloper(id, patch) {
  cache = load();
  if (!cache.developers[id]) return null;
  cache.developers[id] = { ...cache.developers[id], ...patch };
  save();
  return cache.developers[id];
}

/* ----------------- OAuth clients ----------------- */

function getOrCreateOAuthClient(devAccountId) {
  cache = load();
  const existing = Object.values(cache.oauthClients).find((c) => c.ownerAccountId === devAccountId);
  if (existing) return existing;
  const id = 'cli_' + crypto.randomBytes(8).toString('hex');
  const secret = 'sec_' + crypto.randomBytes(16).toString('hex');
  const c = { id, secret, name: 'My Stigma App', ownerAccountId: devAccountId, redirectUris: [], createdAt: Date.now() };
  cache.oauthClients[id] = c;
  save();
  return c;
}

function getOAuthClient(id) {
  cache = load();
  return cache.oauthClients[id] || null;
}

function saveAuthCode(rec) { cache = load(); cache.authCodes[rec.code] = rec; save(); }
function consumeAuthCode(code) {
  cache = load();
  const r = cache.authCodes[code];
  if (r) { delete cache.authCodes[code]; save(); }
  return r || null;
}
function saveAccessToken(rec) { cache = load(); cache.accessTokens[rec.token] = rec; save(); }
function getAccessToken(token) { cache = load(); return cache.accessTokens[token] || null; }

function hasConsent(userId, clientId) { cache = load(); return !!cache.consents[`${userId}:${clientId}`]; }
function grantConsent(userId, clientId, scope) {
  cache = load();
  cache.consents[`${userId}:${clientId}`] = { scope, grantedAt: Date.now() };
  save();
}

/* ----------------- AI usage ----------------- */

function getAiUsage(devId) {
  cache = load();
  const day = new Date().toISOString().slice(0, 10);
  const key = `${devId}:${day}`;
  let u = cache.aiUsage[key];
  if (!u) {
    u = { dayCount: 0, minuteCount: 0, minuteStart: Date.now() };
    cache.aiUsage[key] = u;
    save();
  }
  // reset per-minute counter
  if (Date.now() - u.minuteStart > 60_000) {
    u.minuteCount = 0;
    u.minuteStart = Date.now();
    save();
  }
  return u;
}

function recordAiUsage(devId) {
  const u = getAiUsage(devId);
  u.dayCount += 1;
  u.minuteCount += 1;
  save();
}

/* ----------------- virtual balance ----------------- */

/**
 * Credit or debit the developer balance (amountCents: positive=credit, negative=debit).
 * Returns the new balance in cents.
 */
function adjustBalance(devId, amountCents, note = '') {
  cache = load();
  const dev = cache.developers[devId];
  if (!dev) throw new Error('Developer not found');
  dev.balance = (dev.balance || 0) + amountCents;
  // record ledger entry
  const txId = 'tx_' + require('crypto').randomBytes(8).toString('hex');
  if (!cache.depositHistory) cache.depositHistory = {};
  cache.depositHistory[txId] = {
    id: txId,
    devId,
    amountCents,
    type: amountCents >= 0 ? 'credit' : 'debit',
    note,
    createdAt: Date.now()
  };
  save();
  return dev.balance;
}

function getBalance(devId) {
  cache = load();
  const dev = cache.developers[devId];
  return dev ? (dev.balance || 0) : 0;
}

function getDepositHistory(devId) {
  cache = load();
  if (!cache.depositHistory) return [];
  return Object.values(cache.depositHistory)
    .filter((t) => t.devId === devId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50);
}

/* ----------------- pending deposits (Paynow top-ups) ----------------- */

function savePendingDeposit({ reference, devId, amountCents, pollUrl }) {
  cache = load();
  if (!cache.pendingDeposits) cache.pendingDeposits = {};
  cache.pendingDeposits[reference] = { reference, devId, amountCents, pollUrl, createdAt: Date.now() };
  save();
}

function getPendingDeposit(reference) {
  cache = load();
  return (cache.pendingDeposits || {})[reference] || null;
}

function deletePendingDeposit(reference) {
  cache = load();
  if (cache.pendingDeposits) delete cache.pendingDeposits[reference];
  save();
}

/* ----------------- settings ----------------- */

function getSetting(k) { cache = load(); return cache.settings[k]; }
function setSetting(k, v) { cache = load(); cache.settings[k] = v; save(); }

module.exports = {
  // users
  createUser, findUserByEmail, getUser, verifyPassword,
  // accounts
  createAccountForUser, getAccount, getPrimaryAccount, getAccountsForUser, updateAccount,
  // developers
  enableDeveloper, getDeveloper, getDeveloperByClient, updateDeveloper,
  // oauth
  getOrCreateOAuthClient, getOAuthClient, saveAuthCode, consumeAuthCode, saveAccessToken, getAccessToken, hasConsent, grantConsent,
  // ai
  getAiUsage, recordAiUsage,
  // virtual balance
  adjustBalance, getBalance, getDepositHistory,
  // pending deposits
  savePendingDeposit, getPendingDeposit, deletePendingDeposit,
  // settings
  getSetting, setSetting
};
