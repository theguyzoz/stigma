/**
 * Stigma's "tone of voice" for errors. Plant-themed, but professional.
 */
const BRAND = require('./brand');

function html(msg) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${msg} · Stigma</title>
${BRAND.styles()}
</head><body>
<main class="error">
  <div class="logo">${BRAND.svg(56)}</div>
  <h1>${msg}</h1>
  <p class="muted">Stigma — your account, your apps, your way.</p>
  <p><a class="btn" href="/">Go to the garden</a></p>
</main>
</body></html>`;
}

function page(msg) { return html(msg); }

module.exports = { html, page };
