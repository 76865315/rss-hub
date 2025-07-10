/* global DOMParser */
const WORKER = 'https://soft-surf-8a2a.peleroy.workers.dev';

const FEEDS = [
  { name: 'BBC World', url: `${WORKER}?url=https://feeds.bbci.co.uk/news/world/rss.xml` },
  { name: 'Reuters Top', url: `${WORKER}?url=https://feeds.reuters.com/reuters/topNews` },
  { name: 'TechCrunch', url: `${WORKER}?url=https://techcrunch.com/feed/` }
];

const POLL_MS = 180_000;          // 3 minutes
const shownIds = new Set();       // dedup across refreshes
const parser = new DOMParser();   // built-in XML → DOM

const tmpl  = document.getElementById('card');
const feed  = document.getElementById('feed');
const btn   = document.getElementById('refreshBtn');
btn.onclick = () => refresh(true);

// Initialize debug logging
console.log('🚀 RSS News Hub starting up...');
console.log(`📡 Worker URL: ${WORKER}`);
console.log(`📰 Configured feeds: ${FEEDS.length}`);
FEEDS.forEach((feedConfig, index) => {
  console.log(`   ${index + 1}. ${feedConfig.name}: ${feedConfig.url}`);
});

refresh();
setInterval(refresh, POLL_MS);

async function refresh(manual = false) {
  console.log(`🔄 Starting refresh cycle (manual: ${manual})`);
  if (manual) btn.classList.add('spin');
  
  try {
    await Promise.all(FEEDS.map(fetchFeed));
    console.log('✅ All feeds processed');
  } catch (error) {
    console.error('💥 Error during refresh cycle:', error);
  }
  
  if (manual) btn.classList.remove('spin');
}

async function fetchFeed({ name, url }) {
  try {
    console.log(`🔄 Attempting to fetch ${name} from: ${url}`);
    showDebugInfo(`Fetching ${name}...`);
    
    const res = await fetch(url, { cache: 'no-store' });
    
    if (!res.ok) {
      console.error(`❌ HTTP Error ${res.status} for ${name}: ${res.statusText}`);
      showDebugInfo(`Error ${res.status}: ${res.statusText} for ${name}`, 'error');
      return;
    }
    
    const xml = await res.text();
    console.log(`✅ Successfully fetched ${name}, XML length: ${xml.length}`);
    
    // Check if we actually got XML
    if (!xml.trim().startsWith('<')) {
      console.error(`❌ Invalid XML response for ${name}. Response starts with: ${xml.substring(0, 100)}`);
      showDebugInfo(`Invalid XML response for ${name}`, 'error');
      return;
    }
    
    const dom = parser.parseFromString(xml, 'application/xml');
    
    // Check for XML parsing errors
    const parseError = dom.querySelector('parsererror');
    if (parseError) {
      console.error(`❌ XML parsing error for ${name}:`, parseError.textContent);
      showDebugInfo(`XML parsing error for ${name}`, 'error');
      return;
    }
    
    const items = dom.querySelectorAll('item, entry');
    console.log(`📰 Found ${items.length} items in ${name} feed`);
    
    if (items.length === 0) {
      console.warn(`⚠️ No items found in ${name} feed. XML structure might be different.`);
      showDebugInfo(`No items found in ${name} feed`, 'warning');
      
      // Debug: show the XML structure
      console.log(`🔍 XML structure for ${name}:`, dom.documentElement.tagName);
      const allElements = dom.querySelectorAll('*');
      const elementNames = Array.from(allElements).map(el => el.tagName).slice(0, 10);
      console.log(`🔍 First 10 element types:`, elementNames);
    }
    
    let itemsProcessed = 0;
    items.forEach(el => {
      const processed = pushItem(el, name);
      if (processed) itemsProcessed++;
    });
    
    console.log(`📝 Processed ${itemsProcessed} new items from ${name}`);
    showDebugInfo(`Loaded ${itemsProcessed} new articles from ${name}`, 'success');
    
  } catch (err) {
    console.error(`💥 Feed error for ${name}:`, err.message);
    console.error(`🔍 Full error details:`, err);
    showDebugInfo(`Failed to load ${name}: ${err.message}`, 'error');
  }
}

function pushItem(el, source) {
  const id = el.querySelector('guid, id, link')?.textContent?.trim();
  if (!id || shownIds.has(id)) {
    return false; // Skip duplicates
  }
  shownIds.add(id);

  const title = el.querySelector('title')?.textContent?.trim() ?? '';
  const link = el.querySelector('link')?.textContent?.trim()
            || el.querySelector('link')?.getAttribute('href') || '#';
  const pub = new Date(el.querySelector('pubDate, updated, published')?.textContent);
  const sum = (el.querySelector('description, summary, content')?.textContent ?? '')
                .replace(/<[^>]+>/g, '').slice(0, 280);

  // Debug individual item processing
  console.log(`📄 Processing item: "${title.substring(0, 50)}..." from ${source}`);

  const node = tmpl.content.cloneNode(true);
  node.querySelector('.headline').textContent = title;
  node.querySelector('.headline').href = link;
  node.querySelector('.meta').textContent = `${source} • ${pub.toLocaleString()}`;
  node.querySelector('.summary').textContent = sum;

  feed.prepend(node);
  
  // Keep only latest 100 DOM nodes
  if (feed.children.length > 100) {
    feed.lastElementChild.remove();
  }
  
  return true; // Successfully processed
}

// Debug info display function
function showDebugInfo(message, type = 'info') {
  const debugDiv = document.createElement('div');
  debugDiv.className = `debug-message debug-${type}`;
  debugDiv.style.cssText = `
    padding: 0.5rem;
    margin: 0.25rem;
    border-radius: 0.25rem;
    font-family: monospace;
    font-size: 0.8rem;
    background: ${getDebugColor(type, 'bg')};
    color: ${getDebugColor(type, 'text')};
    border: 1px solid ${getDebugColor(type, 'border')};
    opacity: 0.9;
  `;
  debugDiv.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  feed.appendChild(debugDiv);
  
  // Auto-remove debug messages after 30 seconds
  setTimeout(() => {
    if (debugDiv.parentNode) {
      debugDiv.parentNode.removeChild(debugDiv);
    }
  }, 30000);
}

function getDebugColor(type, element) {
  const colors = {
    info: { bg: '#e3f2fd', text: '#1565c0', border: '#bbdefb' },
    success: { bg: '#e8f5e8', text: '#2e7d32', border: '#c8e6c8' },
    warning: { bg: '#fff3e0', text: '#ef6c00', border: '#ffcc02' },
    error: { bg: '#ffebee', text: '#c62828', border: '#ffcdd2' }
  };
  return colors[type]?.[element] || colors.info[element];
}

// Additional debugging utilities
window.debugRSS = {
  showFeeds: () => {
    console.log('📋 Current feed configuration:');
    FEEDS.forEach((feed, index) => {
      console.log(`${index + 1}. ${feed.name}: ${feed.url}`);
    });
  },
  testWorker: async () => {
    console.log('🧪 Testing Worker directly...');
    const testUrl = `${WORKER}?url=https://feeds.bbci.co.uk/news/world/rss.xml`;
    try {
      const response = await fetch(testUrl);
      console.log(`Worker response status: ${response.status}`);
      const text = await response.text();
      console.log(`Response length: ${text.length}`);
      console.log(`Response preview: ${text.substring(0, 200)}...`);
    } catch (error) {
      console.error('Worker test failed:', error);
    }
  },
  clearShown: () => {
    shownIds.clear();
    console.log('🗑️ Cleared shown items cache');
  },
  getStats: () => {
    console.log(`📊 RSS Hub Stats:`);
    console.log(`   Shown items: ${shownIds.size}`);
    console.log(`   DOM cards: ${feed.children.length}`);
    console.log(`   Feeds configured: ${FEEDS.length}`);
  }
};

console.log('🛠️ Debug utilities available: window.debugRSS');
console.log('   - debugRSS.showFeeds() - Show feed configuration');
console.log('   - debugRSS.testWorker() - Test Worker directly');
console.log('   - debugRSS.clearShown() - Clear duplicate cache');
console.log('   - debugRSS.getStats() - Show current stats');
