/**
 * Stigma brand helpers. Used by every view so the look is consistent.
 */
const STYLES = `
<link rel="icon" href="/static/img/favicon.svg" type="image/svg+xml">
<style>
  :root {
    --bg: #ffffff;
    --ink: #111418;
    --ink-2: #5a6270;
    --line: #e8eaee;
    --line-2: #f1f3f6;
    --accent: #2f8a4f;       /* stigma-green */
    --accent-2: #1f6a3a;
    --warn: #b48a17;
    --danger: #b3261e;
    --radius: 14px;
    --shadow: 0 1px 2px rgba(15,20,30,.04), 0 6px 24px rgba(15,20,30,.06);
  }
  *,*::before,*::after { box-sizing: border-box; }
  html, body { background: var(--bg); color: var(--ink); }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--accent-2); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .muted { color: var(--ink-2); }
  .container { max-width: 1100px; margin: 0 auto; padding: 32px 20px; }
  .narrow   { max-width: 460px; margin: 0 auto; padding: 48px 20px; }
  .topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 20px; border-bottom: 1px solid var(--line); background: #fff;
    position: sticky; top: 0; z-index: 10;
  }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 600; }
  .brand span { letter-spacing: -0.01em; font-size: 18px; }
  .user-chip { display: flex; align-items: center; gap: 10px; }
  .avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: #eef2f6; color: #1a1f2a; display: grid; place-items: center;
    font-size: 13px; font-weight: 600;
  }
  h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: -0.01em; }
  h2 { font-size: 20px; margin: 0 0 12px; }
  h3 { font-size: 16px; margin: 0 0 8px; }
  p  { margin: 0 0 12px; }
  .card {
    background: #fff; border: 1px solid var(--line); border-radius: var(--radius);
    padding: 18px; box-shadow: var(--shadow);
  }
  .grid { display: grid; gap: 16px; }
  .grid.cols-2 { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .grid.cols-3 { grid-template-columns: repeat(3, minmax(0,1fr)); }
  .grid.cols-4 { grid-template-columns: repeat(4, minmax(0,1fr)); }
  @media (max-width: 800px) {
    .grid.cols-3, .grid.cols-4 { grid-template-columns: repeat(2, minmax(0,1fr)); }
  }
  @media (max-width: 540px) {
    .grid.cols-2, .grid.cols-3, .grid.cols-4 { grid-template-columns: 1fr; }
  }
  .tile {
    display: flex; flex-direction: column; gap: 8px; min-height: 120px;
    transition: transform .12s ease, box-shadow .12s ease;
  }
  .tile:hover { transform: translateY(-1px); box-shadow: 0 1px 2px rgba(15,20,30,.05), 0 12px 30px rgba(15,20,30,.08); }
  .tile .icon {
    width: 40px; height: 40px; border-radius: 10px; background: #f3f7f4;
    display: grid; place-items: center; color: var(--accent-2);
  }
  .tile h3 { font-size: 16px; }
  .tile p  { font-size: 14px; color: var(--ink-2); margin: 0; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center;
    gap: 8px; padding: 10px 16px; border-radius: 10px; border: 1px solid var(--line);
    background: #fff; color: var(--ink); cursor: pointer; font-size: 14px; font-weight: 500;
    transition: background .12s ease, border-color .12s ease;
  }
  .btn:hover { background: #f6f8fa; }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .btn.primary:hover { background: var(--accent-2); border-color: var(--accent-2); }
  .btn.ghost { background: transparent; border-color: transparent; }
  .btn.danger { color: var(--danger); border-color: #f1d4d2; }
  input[type="text"], input[type="email"], input[type="password"], input[type="tel"], select, textarea {
    width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px;
    font: inherit; background: #fff; color: var(--ink); outline: none;
    transition: border-color .12s ease, box-shadow .12s ease;
  }
  input:focus, select:focus, textarea:focus {
    border-color: var(--accent); box-shadow: 0 0 0 3px rgba(47,138,79,.15);
  }
  label { display: block; font-size: 13px; color: var(--ink-2); margin-bottom: 6px; }
  .field + .field { margin-top: 14px; }
  .alert {
    border: 1px solid #f1d4d2; background: #fdf2f1; color: #6f1d18;
    padding: 10px 12px; border-radius: 10px; font-size: 14px; margin-bottom: 12px;
  }
  .notice {
    border: 1px solid #d8e8dd; background: #f1f8f3; color: #1d4a30;
    padding: 10px 12px; border-radius: 10px; font-size: 14px; margin-bottom: 12px;
  }
  .divider { height: 1px; background: var(--line); margin: 20px 0; }
  .row { display: flex; gap: 12px; align-items: center; }
  .row.between { justify-content: space-between; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #eef2f6; font-size: 12px; color: #1a1f2a; }
  .pill.green { background: #e6f3ea; color: #1d4a30; }
  .pill.amber { background: #fbf2dc; color: #6a4d0a; }
  footer.site { padding: 40px 20px; color: var(--ink-2); font-size: 13px; text-align: center; }

  /* Account picker (mimics Google's chooser but white/clean) */
  .picker { max-width: 440px; margin: 60px auto; text-align: center; }
  .picker h1 { font-size: 22px; margin-top: 12px; }
  .account-list { margin: 24px 0; display: flex; flex-direction: column; gap: 6px; }
  .account {
    display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 999px;
    border: 1px solid transparent; cursor: pointer; text-align: left; background: #fff;
    transition: background .12s ease, border-color .12s ease;
  }
  .account:hover { background: #f6f8fa; border-color: var(--line); }
  .account .name { font-weight: 500; }
  .account .sub  { font-size: 12px; color: var(--ink-2); }
  .account .add { color: var(--ink-2); }

  /* OAuth consent */
  .consent { max-width: 480px; margin: 60px auto; }
  .consent .scope { background: #f6f8fa; border: 1px solid var(--line); border-radius: 10px; padding: 12px; }

  /* Big icon for the "use another" button */
  .use-another {
    display: flex; align-items: center; gap: 12px; padding: 10px 12px;
    border-radius: 999px; border: 1px solid var(--line); background: #fff; cursor: pointer;
  }
  .use-another:hover { background: #f6f8fa; }
</style>
`;

function styles() { return STYLES; }

/** Inline SVG so the previews work in the sandboxed iframe. */
function svg(size = 28) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M16 3c-3.5 0-6 2.4-6 5.5 0 2.6 1.6 4.6 4 5.4-2.7.4-4.7 2-4.7 4.2 0 1.2.7 2.2 1.8 2.9C7.6 22 6 24 6 26.5 6 28.4 8 30 11 30c2.4 0 4.2-1 5-2.5C16.8 29 18.6 30 21 30c3 0 5-1.6 5-3.5 0-2.5-1.6-4.5-4.1-5.5 1.1-.7 1.8-1.7 1.8-2.9 0-2.2-2-3.8-4.7-4.2 2.4-.8 4-2.8 4-5.4C22 5.4 19.5 3 16 3Z" stroke="#2f8a4f" stroke-width="1.6"/>
    <circle cx="16" cy="9" r="1.4" fill="#2f8a4f"/>
  </svg>`;
}

module.exports = { styles, svg };
