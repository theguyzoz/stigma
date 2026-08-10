/**
 * The 13 free, open-source, already-hosted apps that live under /apps.
 * Each one renders an <iframe> to the upstream service. All upstreams listed
 * here are public, no-key services suitable for embedding.
 *
 * If you self-host any of these, just swap the `url` field.
 */
const APPS = [
  {
    slug: 'live-radio',
    name: 'Live Radio',
    description: 'Tune in to thousands of free radio stations from around the world.',
    url: 'https://radio.garden/',
    color: '#2f8a4f'
  },
  {
    slug: 'weather',
    name: 'Weather Forecast',
    description: 'Real-time conditions, hourly and 7-day forecasts for any city.',
    url: 'https://www.windy.com/-Embed-on-website?embedMenu=false',
    color: '#1d6fb8'
  },
  {
    slug: 'live-tv',
    name: 'Live TV',
    description: 'Free live TV channels from public broadcasters, no sign-up.',
    url: 'https://www.freetv.com/',
    color: '#b3261e'
  },
  {
    slug: 'maps',
    name: 'Maps & Directions',
    description: 'World maps, routing and turn-by-turn directions.',
    url: 'https://www.openstreetmap.org/export/embed.html?bbox=-180%2C-85%2C180%2C85&amp;layer=mapnik',
    color: '#5a3a9a'
  },
  {
    slug: 'translate',
    name: 'Translator',
    description: 'Translate text between 100+ languages — no rate limits for casual use.',
    url: 'https://translate.google.com/',
    color: '#1d6fb8'
  },
  {
    slug: 'calculator',
    name: 'Scientific Calculator',
    description: 'A full scientific calculator with history and graphing.',
    url: 'https://www.desmos.com/scientific',
    color: '#222'
  },
  {
    slug: 'notes',
    name: 'Quick Notes',
    description: 'Markdown notes that auto-save to your browser. Keep it simple.',
    url: 'https://stackedit.io/app',
    color: '#b48a17'
  },
  {
    slug: 'pdf',
    name: 'PDF Reader',
    description: 'View, merge and split PDFs right in the browser.',
    url: 'https://pdfresizer.com/',
    color: '#b3261e'
  },
  {
    slug: 'whiteboard',
    name: 'Whiteboard',
    description: 'Infinite collaborative whiteboard for sketches and diagrams.',
    url: 'https://excalidraw.com/',
    color: '#5a3a9a'
  },
  {
    slug: 'code',
    name: 'Code Playground',
    description: 'Sandboxed HTML/CSS/JS editor that runs as you type.',
    url: 'https://codepen.io/pen/',
    color: '#0a0a0a'
  },
  {
    slug: 'rss',
    name: 'RSS Reader',
    description: 'Follow your favourite sites without an algorithm.',
    url: 'https://www.inoreader.com/',
    color: '#b48a17'
  },
  {
    slug: 'paint',
    name: 'Paint Studio',
    description: 'Layered digital painting and pixel art in the browser.',
    url: 'https://jspaint.app/',
    color: '#1f6a3a'
  },
  {
    slug: 'sounds',
    name: 'Sound Library',
    description: 'Free ambient sounds and royalty-free music for focus and sleep.',
    url: 'https://asoftmurmur.com/',
    color: '#2f8a4f'
  }
];

module.exports = { APPS };
