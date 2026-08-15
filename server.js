/**
 * Stigma — main server
 *
 * Routes:
 *   GET  /                                -> redirect to /accounts (if not signed in) or dashboard
 *   GET  /accounts                        -> account picker
 *   GET  /accounts/signin                 -> sign in / use another
 *   GET  /accounts/create                 -> create account
 *   GET  /accounts/confirm/:id            -> confirm switch to account
 *   GET  /signout                         -> sign out
 *
 *   GET  /dashboard                       -> main app grid (after account confirmed)
 *   GET  /apps                            -> list of apps
 *   GET  /apps/:slug                      -> individual app
 *
 *   GET  /profile                         -> manage profile
 *   POST /profile                         -> save profile
 *
 *   GET  /developers                      -> dev dashboard (requires dev account)
 *   POST /developers/enable               -> upgrade account to dev
 *   GET  /developers/oauth                -> OAuth provider config
 *   GET  /developers/ai                   -> AI API config
 *   POST /developers/ai                   -> update AI key / model
 *   GET  /developers/billing              -> balance, top-up, plan activation
 *   POST /developers/billing/deposit      -> initiate Paynow top-up (any amount)
 *   POST /developers/billing/activate     -> spend balance to activate a plan
 *   POST /api/paynow/update              -> Paynow webhook (credits balance on confirmation)
 *
 *   GET  /oauth/authorize                 -> consent screen for client apps
 *   POST /oauth/authorize                 -> approve
 *   GET  /oauth/token                     -> token exchange (Authorization Code)
 *   GET  /oauth/userinfo                  -> user info endpoint
 *
 *   GET  /drive-setup                     -> secret admin page to paste service account JSON
 *   POST /drive-setup                     -> save it + trigger first backup
 *   GET  /api/backup                      -> force a backup now
 *
 *   /api/ai/chat                          -> chat completion proxy (rate limited)
 *
 * Database: ./data/db.json (auto-uploaded to Google Drive when configured)
 * Errors use Stigma's tone: "No pollens found." / "Something went wrong with another. Try again."
 */

// Optional dotenv — load if installed, otherwise rely on real env vars.
try { require('dotenv').config(); } catch {}
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');

const db = require('./lib/db');
const session = require('./lib/session');
const errors = require('./lib/errors');
const drive = require('./lib/drive');
const paynow = require('./lib/paynow');
const ai = require('./lib/ai');
const oauth = require('./lib/oauth');
const brand = require('./lib/brand');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static assets
app.use('/static', express.static(path.join(__dirname, 'public')));

// Make shared locals available to templates
app.use((req, res, next) => {
  res.locals.user = session.currentUser(req);
  res.locals.confirmedAccountId = session.confirmedAccountId(req);
  res.locals.url = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  res.locals.year = new Date().getFullYear();
  res.locals.error = (msg) => errors.html(msg);
  next();
});

/* ----------------------------- helpers ----------------------------- */

function render(file, res, vars = {}) {
  const filePath = path.join(__dirname, 'views', file + '.html');
  let html = fs.readFileSync(filePath, 'utf8');

  // ---- 1. Compute shared locals ----
  const user = res.locals.user;
  let confirmed = null;
  try { confirmed = session.confirmedAccount(res.req || res); } catch {}
  const shared = {
    styles: brand.styles(),
    svg: brand.svg(28),
    logoLg: brand.svg(56),
    url: res.locals.url,
    publicUrl: res.locals.url,
    year: res.locals.year,
    userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '',
    userEmail: user?.email || '',
    userInitial: user ? ((user.firstName || user.email || '?')[0] || '?').toUpperCase() : '?',
    accInitial: confirmed ? ((confirmed.firstName || '?')[0] || '?').toUpperCase() : '?',
    accName: confirmed ? `${confirmed.firstName} ${confirmed.lastName}` : '',
    accFirstName: confirmed?.firstName || '',
    accLastName: confirmed?.lastName || '',
    accPhone: confirmed?.phone || '',
    accDisplayName: confirmed?.displayName || '',
    accSecondaryEmail: confirmed?.secondaryEmail || '',
    accId: confirmed?.id || '',
    iconApps: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/></svg>',
    iconProfile: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>',
    iconDev: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="8 7 3 12 8 17"/><polyline points="16 7 21 12 16 17"/></svg>',
    iconKey: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="14" r="4"/><path d="m12 14 8 0M17 14v3M21 14v3"/></svg>',
    iconAi: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>',
    iconMoney: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>'
  };
  const merged = { ...shared, ...vars };

  // ---- 2. Pre-render list helpers (so the view can stay declarative) ----
  if (vars.accounts && Array.isArray(vars.accounts) && !merged.accountsList) {
    merged.accountsList = vars.accounts.map((a) => `
      <button class="account" type="button" data-acc-id="${a.id}" data-redirect="${vars.redirect || '/dashboard'}">
        <div class="avatar">${(a.firstName || '?')[0].toUpperCase()}</div>
        <div>
          <div class="name">${a.firstName} ${a.lastName}</div>
          <div class="sub">${a.phone}</div>
        </div>
      </button>`).join('');
  }
  if (vars.apps && Array.isArray(vars.apps) && !merged.appsList) {
    merged.appsList = vars.apps.map((a) => `
      <a class="card tile" href="/apps/${a.slug}">
        <div class="icon" style="background:${a.color}15;color:${a.color};">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16M4 12h16M4 17h10"/></svg>
        </div>
        <h3>${a.name}</h3>
        <p>${a.description}</p>
      </a>`).join('');
  }
  if (vars.all && Array.isArray(vars.all) && !merged.accountsList) {
    merged.accountsList = vars.all.map((a) => `
      <div class="card tile">
        <div class="icon" style="background:#eef2f6;color:#1a1f2a;">${(a.firstName || '?')[0].toUpperCase()}</div>
        <h3>${a.firstName} ${a.lastName}</h3>
        <p>${a.phone}${a.isPrimary ? ' · <span class="pill green">primary</span>' : ''}</p>
      </div>`).join('');
  }
  if (vars.message && !merged.messageBlock) {
    merged.messageBlock = `<div class="notice" style="display:inline-block;padding:6px 10px;font-size:13px;">${vars.message}</div>`;
    // Keep merged.message intact so {{#message}} conditional blocks in views still render
    merged.message = vars.message;
  }
  if (vars.error && !merged.errorBlock) {
    merged.errorBlock = `<div class="alert">${vars.error}</div>`;
  }
  if (vars.saved && !merged.noticeBlock) {
    merged.noticeBlock = `<div class="notice">${vars.saved}</div>`;
  }
  if (vars.dev) {
    const plan = vars.dev.plan || 'free';
    merged.aiModel = vars.dev.aiModel || '';
    merged.devPlan = plan;
    merged.devPlanLabel = ({ free: 'Free', pro: 'Pro', business: 'Business' }[plan] || 'Free');
    merged.planPill = plan === 'free' ? 'muted' : 'green';
    // Plan conditionals for billing view
    merged.isStarter  = plan === 'free'     ? 'yes' : '';
    merged.isPro      = plan === 'pro'      ? 'yes' : '';
    merged.isBusiness = plan === 'business' ? 'yes' : '';
    merged.notPro      = plan !== 'pro'      ? 'yes' : '';
    merged.notBusiness = plan !== 'business' ? 'yes' : '';
  }

  // ---- 3. Tiny template engine ----
  //   {{ key }}            -> value
  //   {{#cond}}...{{/cond}}-> block rendered only if cond is truthy
  html = html.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, k, body) => merged[k] ? body : '');
  html = html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (merged[k] != null ? String(merged[k]) : ''));
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

function requireConfirmedAccount(req, res, next) {
  const acc = session.confirmedAccount(req);
  if (!acc) {
    const redirect = encodeURIComponent(req.originalUrl);
    return res.redirect(`/accounts?redirect=${redirect}`);
  }
  next();
}

/* ----------------------------- main flow ---------------------------- */

app.get('/', (req, res) => {
  const acc = session.confirmedAccount(req);
  if (acc) return res.redirect('/dashboard');
  res.redirect('/accounts?redirect=/dashboard');
});

/* ----------------------------- /accounts ---------------------------- */

app.get('/accounts', (req, res) => {
  const user = res.locals.user;
  const redirect = req.query.redirect || '/dashboard';
  if (!user) {
    return render('accounts_signin_form', res, {
      redirect,
      accounts: [],
      error: 'No pollens found. Sign in to see your accounts.'
    });
  }
  const accounts = db.getAccountsForUser(user.id);
  render('accounts_picker', res, {
    redirect,
    accounts,
    user,
    message: accounts.length === 0 ? 'No accounts yet. Create one to get started.' : ''
  });
});

app.get('/accounts/signin', (req, res) => {
  render('accounts_signin_form', res, {
    redirect: req.query.redirect || '/dashboard',
    error: req.query.error || ''
  });
});

app.get('/accounts/signin/new', (req, res) => {
  render('accounts_signin', res, { redirect: req.query.redirect || '/dashboard' });
});

app.post('/accounts/signin', (req, res) => {
  const { email, password, redirect } = req.body;
  const user = db.findUserByEmail(email);
  if (!user || !db.verifyPassword(user, password)) {
    return res.redirect(`/accounts/signin?redirect=${encodeURIComponent(redirect || '/dashboard')}&error=No+such+pollen+in+our+garden.`);
  }
  session.signInUser(res, user.id);
  const back = redirect || '/dashboard';
  res.redirect(`/accounts?redirect=${encodeURIComponent(back)}`);
});

app.get('/accounts/create', (req, res) => {
  render('accounts_create', res, { redirect: req.query.redirect || '/dashboard', error: '' });
});

app.post('/accounts/create', (req, res) => {
  const { firstName, lastName, phone, password, redirect } = req.body;
  if (!firstName || !lastName || !phone || !password) {
    return render('accounts_create', res, {
      redirect: redirect || '/dashboard',
      error: 'Something went wrong with another. Every field is a petal — fill them all.'
    });
  }
  if (password.length < 8) {
    return render('accounts_create', res, {
      redirect: redirect || '/dashboard',
      error: 'That password is too fragile. Give it at least 8 characters.'
    });
  }
  const user = res.locals.user;
  // Either create a new user (no cookie) or attach a new account to the signed-in user.
  let ownerId = user ? user.id : null;
  if (!ownerId) {
    ownerId = db.createUser({ firstName, lastName, phone, password });
    session.signInUser(res, ownerId);
  } else {
    db.createAccountForUser(ownerId, { firstName, lastName, phone, password });
  }
  res.redirect(`/accounts?redirect=${encodeURIComponent(redirect || '/dashboard')}`);
});

app.get('/accounts/confirm/:id', (req, res) => {
  const user = res.locals.user;
  if (!user) return res.redirect('/accounts/signin?redirect=/dashboard');
  const acc = db.getAccount(user.id, req.params.id);
  if (!acc) {
    return render('accounts_picker', res, {
      user,
      redirect: req.query.redirect || '/dashboard',
      accounts: db.getAccountsForUser(user.id),
      message: 'No pollens found. That account is not in your garden.'
    });
  }
  session.confirmAccount(res, acc.id, parseInt(req.query.expiresIn, 10) || 60 * 60 * 24 * 30);
  res.redirect(req.query.redirect || '/dashboard');
});

app.get('/signout', (req, res) => {
  res.clearCookie('stigma_session');
  res.clearCookie('stigma_active');
  res.redirect('/accounts');
});

/* ----------------------------- /dashboard --------------------------- */

app.get('/dashboard', requireConfirmedAccount, (req, res) => {
  const acc = session.confirmedAccount(req);
  const all = db.getAccountsForUser(acc.userId);
  render('dashboard', res, { acc, all });
});

/* ----------------------------- /apps ------------------------------- */

const APPS = require('./lib/apps').APPS;

app.get('/apps', requireConfirmedAccount, (req, res) => {
  render('apps_index', res, { apps: APPS });
});

app.get('/apps/:slug', requireConfirmedAccount, (req, res) => {
  const appDef = APPS.find((a) => a.slug === req.params.slug);
  if (!appDef) {
    return render('apps_index', res, { apps: APPS, error: 'No pollens found. That app is not in bloom.' });
  }
  render('apps_detail', res, { app: appDef, acc: session.confirmedAccount(req) });
});

/* ----------------------------- /profile ----------------------------- */

app.get('/profile', requireConfirmedAccount, (req, res) => {
  const acc = session.confirmedAccount(req);
  render('profile', res, { acc, saved: req.query.saved || '' });
});

app.post('/profile', requireConfirmedAccount, (req, res) => {
  const acc = session.confirmedAccount(req);
  const { firstName, lastName, phone, secondaryEmail, displayName } = req.body;
  db.updateAccount(acc.id, {
    firstName: firstName?.trim() || acc.firstName,
    lastName: lastName?.trim() || acc.lastName,
    phone: phone?.trim() || acc.phone,
    secondaryEmail: secondaryEmail?.trim() || '',
    displayName: displayName?.trim() || ''
  });
  res.redirect('/profile?saved=Your+profile+has+bloomed+fresh.');
});

/* ----------------------------- /developers -------------------------- */

app.get('/developers', requireConfirmedAccount, (req, res) => {
  const acc = session.confirmedAccount(req);
  const dev = db.getDeveloper(acc.id);
  const balanceDollars = dev ? (db.getBalance(acc.id) / 100).toFixed(2) : '0.00';
  render(dev ? 'dev_dashboard' : 'dev_promo', res, { acc, dev, balanceDollars });
});

app.post('/developers/enable', requireConfirmedAccount, (req, res) => {
  const acc = session.confirmedAccount(req);
  db.enableDeveloper(acc.id);
  res.redirect('/developers');
});

app.get('/developers/oauth', requireConfirmedAccount, (req, res) => {
  const acc = session.confirmedAccount(req);
  const dev = db.getDeveloper(acc.id);
  if (!dev) return res.redirect('/developers');
  const client = db.getOrCreateOAuthClient(dev.id);
  render('dev_oauth', res, {
    acc, dev, client,
    clientId: client.id,
    clientSecret: client.secret
  });
});

app.get('/developers/ai', requireConfirmedAccount, (req, res) => {
  const acc = session.confirmedAccount(req);
  const dev = db.getDeveloper(acc.id);
  if (!dev) return res.redirect('/developers');
  const usage = db.getAiUsage(dev.id);
  render('dev_ai', res, {
    acc, dev, usage,
    usageDay: usage.dayCount,
    usageMinute: usage.minuteCount
  });
});

app.post('/developers/ai', requireConfirmedAccount, (req, res) => {
  const acc = session.confirmedAccount(req);
  const dev = db.getDeveloper(acc.id);
  if (!dev) return res.redirect('/developers');
  db.updateDeveloper(dev.id, { aiModel: req.body.aiModel || dev.aiModel });
  res.redirect('/developers/ai');
});

app.get('/developers/billing', requireConfirmedAccount, (req, res) => {
  const acc = session.confirmedAccount(req);
  const dev = db.getDeveloper(acc.id);
  if (!dev) return res.redirect('/developers');
  const balanceCents = db.getBalance(acc.id);
  const history = db.getDepositHistory(acc.id);
  const historyRows = history.map((t) => {
    const sign = t.amountCents >= 0 ? '+' : '';
    const dollars = (t.amountCents / 100).toFixed(2);
    const label = t.note || (t.type === 'credit' ? 'Deposit' : 'Plan activation');
    const date = new Date(t.createdAt).toLocaleDateString();
    const color = t.amountCents >= 0 ? 'color:#1a7f4b' : 'color:#c0392b';
    return `<tr><td>${date}</td><td>${label}</td><td style="${color}">${sign}$${dollars}</td></tr>`;
  }).join('');
  render('dev_billing', res, {
    acc, dev,
    error: req.query.error || '',
    message: req.query.message || '',
    balanceDollars: (balanceCents / 100).toFixed(2),
    historyRows,
    hasHistory: history.length > 0 ? 'yes' : ''
  });
});

// Step 1: Top up balance via Paynow (any amount)
app.post('/developers/billing/deposit', requireConfirmedAccount, async (req, res) => {
  const acc = session.confirmedAccount(req);
  const dev = db.getDeveloper(acc.id);
  if (!dev) return res.redirect('/developers');
  const { method, phone, amount } = req.body;
  const amountNum = parseFloat(amount);
  if (!amountNum || amountNum < 1 || amountNum > 500) {
    return res.redirect(`/developers/billing?error=${encodeURIComponent('Enter an amount between $1 and $500.')}`);
  }
  const reference = `stigma-dep-${acc.id}-${Date.now()}`;
  // Paynow requires authemail = merchant's registered Paynow email (not the customer's).
  // In test mode it must match exactly. Set PAYNOW_MERCHANT_EMAIL in your .env
  const authemail = process.env.PAYNOW_MERCHANT_EMAIL || '';
  try {
    const pay = await paynow.createPayment({
      amount:      amountNum,
      method:      method || 'ecocash',
      phone:       phone  || '',
      authemail,
      reference,
      description: `Stigma balance top-up ${amountNum.toFixed(2)}`
    });
    db.savePendingDeposit({
      reference,
      devId: acc.id,
      amountCents: Math.round(amountNum * 100),
      pollUrl: pay.pollUrl
    });
    // Mobile flow: Paynow pushes USSD prompt to phone — redirect back with pending flag so JS starts polling
    if (pay.redirectUrl) {
      return res.redirect(pay.redirectUrl);
    }
    const instr = pay.instructions || 'Check your phone for the EcoCash/OneMoney prompt, then wait — your balance will update automatically.';
    return res.redirect(`/developers/billing?pending=1&instr=${encodeURIComponent(instr)}`);
  } catch (e) {
    console.error('[Paynow deposit error]', e.message);
    const safe = e.message && e.message.length < 200 && !e.message.toLowerCase().includes('hash')
      ? e.message : 'Could not initiate payment. Check your number and try again.';
    return res.redirect(`/developers/billing?error=${encodeURIComponent(safe)}`);
  }
});

// Step 2: Paynow webhook — credits balance when payment is confirmed
app.post('/api/paynow/update', express.urlencoded({ extended: true }), (req, res) => {
  const params = req.body;
  // Verify Paynow hash signature
  if (!paynow.verifyUpdate(params)) {
    return res.status(400).send('Invalid hash');
  }
  const status = (params.status || '').toLowerCase();
  const reference = params.reference || '';
  const pending = db.getPendingDeposit(reference);
  if (!pending) {
    // Already processed or unknown — still respond OK so Paynow doesn't retry forever
    return res.send('OK');
  }
  if (status === 'paid' || status === 'awaiting delivery') {
    // Credit the developer's balance
    db.adjustBalance(
      pending.devId,
      pending.amountCents,
      `Paynow deposit — ref ${reference}`
    );
    db.deletePendingDeposit(reference);
  } else if (status === 'cancelled' || status === 'failed' || status === 'disputed') {
    // Remove pending so we don't accidentally credit it later
    db.deletePendingDeposit(reference);
  }
  // For pending/awaiting statuses Paynow will POST again when status changes
  res.send('OK');
});

// Step 3: Activate a plan by deducting from balance
const PLAN_PRICES = { pro: 500, business: 2000 }; // cents
app.post('/developers/billing/activate', requireConfirmedAccount, (req, res) => {
  const acc = session.confirmedAccount(req);
  const dev = db.getDeveloper(acc.id);
  if (!dev) return res.redirect('/developers');
  const { plan } = req.body;
  const cost = PLAN_PRICES[plan];
  if (!cost) {
    return res.redirect(`/developers/billing?error=${encodeURIComponent('Unknown plan selected.')}`);
  }
  if (dev.plan === plan) {
    return res.redirect(`/developers/billing?message=${encodeURIComponent('You are already on that plan.')}`);
  }
  const balance = db.getBalance(acc.id);
  if (balance < cost) {
    const needed = ((cost - balance) / 100).toFixed(2);
    return res.redirect(`/developers/billing?error=${encodeURIComponent(`Not enough balance. Top up at least $${needed} more to activate this plan.`)}`);
  }
  // Deduct from balance and upgrade plan
  db.adjustBalance(acc.id, -cost, `${plan.charAt(0).toUpperCase() + plan.slice(1)} plan activation`);
  db.updateDeveloper(acc.id, { plan });
  res.redirect(`/developers/billing?message=${encodeURIComponent(`You are now on the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan. Let the pollen flow.`)}`);
});

/* ---- Billing status poll (used by billing page JS) ---- */
app.get('/api/billing/status', requireConfirmedAccount, (req, res) => {
  const acc = session.confirmedAccount(req);
  const dev = db.getDeveloper(acc.id);
  if (!dev) return res.status(404).json({ error: 'no dev account' });
  const balanceCents = db.getBalance(acc.id);
  const pending = db.getPendingDepositsForDev(acc.id);
  res.json({
    balanceDollars: (balanceCents / 100).toFixed(2),
    plan: dev.plan,
    pendingCount: pending.length,
  });
});

/* ----------------------------- OAuth provider ----------------------- */

app.get('/oauth/authorize', (req, res) => {
  const user = res.locals.user;
  if (!user) return res.redirect(`/accounts/signin?redirect=${encodeURIComponent(req.originalUrl)}`);
  const acc = session.confirmedAccount(req);
  if (!acc) {
    return res.redirect(`/accounts?redirect=${encodeURIComponent(req.originalUrl)}`);
  }
  const { client_id, redirect_uri, response_type, state, scope } = req.query;
  const client = db.getOAuthClient(client_id);
  if (!client) return res.status(400).send(errors.page('No pollens found. Unknown OAuth client.'));
  if (response_type !== 'code') return res.status(400).send(errors.page('Something went wrong with another. Only `code` response_type is supported.'));

  // Auto-approve if user has already trusted this client
  if (db.hasConsent(user.id, client.id)) {
    return issueAuthCodeAndRedirect(req, res, { client, user, redirect_uri, state, scope });
  }

  render('oauth_consent', res, {
    client, redirect_uri, state, scope, acc,
    clientId: client.id,
    clientName: client.name,
    redirectUri: redirect_uri
  });
});

app.post('/oauth/authorize', (req, res) => {
  const user = res.locals.user;
  const { client_id, redirect_uri, state, scope, approve } = req.body;
  const client = db.getOAuthClient(client_id);
  if (!client) return res.status(400).send(errors.page('Unknown OAuth client.'));
  if (approve !== 'yes') {
    const u = new URL(redirect_uri);
    u.searchParams.set('error', 'access_denied');
    if (state) u.searchParams.set('state', state);
    return res.redirect(u.toString());
  }
  db.grantConsent(user.id, client.id, scope || 'profile email');
  return issueAuthCodeAndRedirect(req, res, { client, user, redirect_uri, state, scope });
});

function issueAuthCodeAndRedirect(req, res, { client, user, redirect_uri, state, scope }) {
  const code = crypto.randomBytes(24).toString('hex');
  db.saveAuthCode({ code, clientId: client.id, userId: user.id, scope, redirectUri: redirect_uri, expiresAt: Date.now() + 5 * 60 * 1000 });
  const u = new URL(redirect_uri);
  u.searchParams.set('code', code);
  if (state) u.searchParams.set('state', state);
  res.redirect(u.toString());
}

app.post('/oauth/token', express.urlencoded({ extended: true }), (req, res) => {
  const { grant_type, code, client_id, client_secret, redirect_uri } = req.body;
  const client = db.getOAuthClient(client_id);
  if (!client || client.secret !== client_secret) {
    return res.status(401).json({ error: 'invalid_client' });
  }
  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }
  const rec = db.consumeAuthCode(code);
  if (!rec || rec.clientId !== client.id || rec.redirectUri !== redirect_uri || rec.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  const accessToken = crypto.randomBytes(32).toString('hex');
  db.saveAccessToken({ token: accessToken, userId: rec.userId, clientId: client.id, scope: rec.scope, expiresAt: Date.now() + 3600 * 1000 });
  res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 3600, scope: rec.scope });
});

app.get('/oauth/userinfo', (req, res) => {
  const auth = req.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: 'invalid_token' });
  const tok = db.getAccessToken(m[1]);
  if (!tok || tok.expiresAt < Date.now()) return res.status(401).json({ error: 'invalid_token' });
  const user = db.getUser(tok.userId);
  const account = db.getPrimaryAccount(user.id);
  res.json({
    sub: user.id,
    name: account ? `${account.firstName} ${account.lastName}` : '',
    given_name: account?.firstName || '',
    family_name: account?.lastName || '',
    email: user.email || account?.secondaryEmail || '',
    phone: account?.phone || ''
  });
});

/* ----------------------------- /api/ai/chat ------------------------- */

app.post('/api/ai/chat', async (req, res) => {
  const auth = req.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: 'invalid_token' });
  const tok = db.getAccessToken(m[1]);
  if (!tok || tok.expiresAt < Date.now()) return res.status(401).json({ error: 'invalid_token' });
  const dev = db.getDeveloperByClient(tok.clientId);
  if (!dev) return res.status(403).json({ error: 'not_a_developer' });
  const usage = db.getAiUsage(dev.id);
  const LIMITS = {
    free:     { day: 5_000,     rpm: 25  },
    pro:      { day: 100_000,   rpm: 250 },
    business: { day: 1_000_000, rpm: 1000 }
  };
  const limits = LIMITS[dev.plan] || LIMITS.free;
  if (usage.dayCount >= limits.day) {
    return res.status(429).json({ error: 'daily_quota_exceeded', limit: limits.day, plan: dev.plan });
  }
  if (usage.minuteCount >= limits.rpm) {
    return res.status(429).json({ error: 'rpm_exceeded', limit: limits.rpm, plan: dev.plan });
  }
  try {
    const out = await ai.chat({ messages: req.body.messages });
    db.recordAiUsage(dev.id);
    res.json(out);
  } catch (e) {
    res.status(502).json({ error: 'upstream_error', message: String(e.message || e) });
  }
});

/* ----------------------------- /drive-setup ------------------------- */

// Dedicated admin secret for Drive/admin routes. Falls back to SESSION_SECRET
// only if ADMIN_SECRET is unset; if neither is set the admin routes are disabled.
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.SESSION_SECRET || '';

app.get('/drive-setup', (req, res) => {
  if (!ADMIN_SECRET || req.query.secret !== ADMIN_SECRET) {
    return res.status(403).send(errors.page('Admin secret missing or incorrect. Set ADMIN_SECRET and visit /drive-setup?secret=...'));
  }
  const configured = !!db.getSetting('drive.serviceAccount');
  const statusBlock = configured
    ? '<div class="notice">Drive backup is <strong>configured</strong>. Daily snapshots are uploaded automatically.</div>'
    : '<div class="alert">Drive backup is not configured yet. Paste your service-account JSON below.</div>';
  render('drive_setup', res, {
    showForm: !configured,
    statusBlock,
    configuredLabel: configured ? 'Yes — auto-backup is on' : 'No — paste a service-account JSON to enable',
    secretToken: ADMIN_SECRET
  });
});

app.post('/drive-setup', async (req, res) => {
  if (!ADMIN_SECRET || req.query.secret !== ADMIN_SECRET) {
    return res.status(403).send(errors.page('Admin secret missing or incorrect.'));
  }
  const { json, folderId } = req.body;
  let parsed;
  try { parsed = JSON.parse(json); }
  catch { return res.send(errors.page('That JSON is not a flower we recognize.')); }
  db.setSetting('drive.serviceAccount', parsed);
  if (folderId) db.setSetting('drive.folderId', folderId);
  try {
    await drive.backupNow();
    res.send(errors.page('Pollen saved. First backup uploaded to Drive.'));
  } catch (e) {
    res.send(errors.page('Saved, but the upload failed: ' + e.message));
  }
});

app.post('/api/backup', async (req, res) => {
  if (!ADMIN_SECRET || req.query.secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    const r = await drive.backupNow();
    res.json({ ok: true, ...r });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ----------------------------- 404 ---------------------------------- */

app.use((req, res) => {
  res.status(404).send(errors.page('No pollens found. That page is not in the garden.'));
});

/* ----------------------------- boot --------------------------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Stigma listening on http://0.0.0.0:${PORT}`);
  // Try an initial Drive backup if creds are already in the DB
  if (db.getSetting('drive.serviceAccount')) {
    drive.backupNow().catch((e) => console.log('Initial backup skipped:', e.message));
  }
});
