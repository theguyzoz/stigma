/**
 * Stigma browser SDK — drop into any frontend.
 * Usage:
 *   <script src="https://your-stigma-host/static/js/stigma.js"></script>
 *   <script>
 *     Stigma.signIn({
 *       clientId: 'cli_...',
 *       redirectUri: window.location.origin + '/auth/stigma/callback'
 *     }).then(user => console.log(user));
 *   </script>
 */
(function (root) {
  const STIGMA_HOST = (document.currentScript && new URL(document.currentScript.src).origin) || '';

  function openPopup(url) {
    return new Promise((resolve, reject) => {
      const w = 520, h = 620;
      const dualScreenLeft = window.screenLeft != null ? window.screenLeft : window.screenX;
      const dualScreenTop  = window.screenTop  != null ? window.screenTop  : window.screenY;
      const left = (window.innerWidth  - w) / 2 + dualScreenLeft;
      const top  = (window.innerHeight - h) / 2 + dualScreenTop;
      const popup = window.open(url, 'stigma_oauth', `width=${w},height=${h},left=${left},top=${top}`);
      if (!popup) return reject(new Error('Popup blocked.'));
      const timer = setInterval(() => {
        if (popup.closed) { clearInterval(timer); reject(new Error('Window closed.')); }
      }, 800);
      window.addEventListener('message', function onMsg(e) {
        if (!e.data || e.data.type !== 'stigma:auth') return;
        window.removeEventListener('message', onMsg);
        clearInterval(timer);
        try { popup.close(); } catch {}
        resolve(e.data.user);
      });
    });
  }

  function signIn({ clientId, redirectUri, scope = 'profile email', state }) {
    const u = new URL(STIGMA_HOST + '/oauth/authorize');
    u.searchParams.set('client_id', clientId);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', scope);
    if (state) u.searchParams.set('state', state);
    return openPopup(u.toString());
  }

  /**
   * For SPAs that already received a `?code=...&state=...` on their callback
   * page. Exchanges it for a user payload.
   */
  async function handleCallback({ clientId, clientSecret, redirectUri, code }) {
    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('code', code);
    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);
    body.set('redirect_uri', redirectUri);
    const r = await fetch(STIGMA_HOST + '/oauth/token', { method: 'POST', body });
    const j = await r.json();
    if (!j.access_token) throw new Error('token_exchange_failed');
    const u = await fetch(STIGMA_HOST + '/oauth/userinfo', { headers: { Authorization: 'Bearer ' + j.access_token } });
    return await u.json();
  }

  root.Stigma = { signIn, handleCallback };
})(typeof window !== 'undefined' ? window : globalThis);
