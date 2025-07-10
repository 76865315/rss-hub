/* global DOMParser */
const WORKER = 'https://soft-surf-8a2a.peleroy.workers.dev';

const FEEDS = [
  { name: 'BBC World',   url: `${WORKER}?url=https://feeds.bbci.co.uk/news/world/rss.xml` },
  { name: 'Reuters Top', url: `${WORKER}?url=https://feeds.reuters.com/reuters/topNews`   },
  { name: 'TechCrunch',  url: `${WORKER}?url=https://techcrunch.com/feed/`                }
];

const POLL_MS = 180_000;          // 3 minutes
const shownIds = new Set();       // dedup across refreshes
const parser = new DOMParser();   // built-in XML → DOM

const tmpl  = document.getElementById('card');
const feed  = document.getElementById('feed');
const btn   = document.getElementById('refreshBtn');
btn.onclick = () => refresh(true);

refresh();
setInterval(refresh, POLL_MS);

async function refresh(manual = false) {
  if (manual) btn.classList.add('spin');
  await Promise.all(FEEDS.map(fetchFeed));
  if (manual) btn.classList.remove('spin');
}

async function fetchFeed({ name, url }) {
  try {
    const res  = await fetch(url, { cache: 'no-store' });   // bypass old cache
    const xml  = await res.text();
    const dom  = parser.parseFromString(xml, 'application/xml');
    const items = dom.querySelectorAll('item, entry');
    items.forEach(el => pushItem(el, name));
  } catch (err) {
    console.error('Feed error', url, err);
  }
}

function pushItem(el, source) {
  const id    = el.querySelector('guid, id, link')?.textContent?.trim();
  if (!id || shownIds.has(id)) return;          // skip duplicates
  shownIds.add(id);

  const title = el.querySelector('title')?.textContent?.trim() ?? '';
  const link  = el.querySelector('link')?.textContent?.trim()
            || el.querySelector('link')?.getAttribute('href') || '#';
  const pub   = new Date(el.querySelector('pubDate, updated, published')?.textContent);
  const sum   = (el.querySelector('description, summary, content')?.textContent ?? '')
                  .replace(/<[^>]+>/g, '').slice(0, 280);

  const node  = tmpl.content.cloneNode(true);
  node.querySelector('.headline').textContent = title;
  node.querySelector('.headline').href        = link;
  node.querySelector('.meta').textContent     =
      `${source} • ${pub.toLocaleString()}`;
  node.querySelector('.summary').textContent  = sum;

  feed.prepend(node);
  // keep only latest 100 dom nodes
  if (feed.children.length > 100) feed.lastElementChild.remove();
}
