// ============================================================
// THE PATH — Shared Data Layer
// ============================================================
// Storage: localStorage (primary) + GitHub Gist (sync)
// All pages import this via <script src="data.js">
// ============================================================

const DB_KEY = 'the_path_data';
const GIST_TOKEN_KEY = 'the_path_gist_token';
const GIST_ID_KEY = 'the_path_gist_id';

// ── Default schema ──────────────────────────────────────────
function defaultData() {
  return {
    meta: {
      version: 1,
      created: new Date().toISOString(),
      streakBase: 0,             // public default — set during first-run setup
      streakBaseDate: todayStr(),
      configured: false,         // true once first-run setup is complete
      syncEnabled: false,        // whether the user opted into Gist sync
      suttasReadBase: 0          // seed count for suttas read
    },
    sits: [],          // post-session meditation logs
    dailyChecks: [],   // eightfold path / sila daily records
    journal: [],       // structured journal entries
    pathMarkers: [],   // explicit insight / depth markers
    dreams: [],        // hypnagogic / lucid dream logs
    readSuttas: [],    // UIDs of suttas marked as read
    suttaReflections: {} // { uid: reflection text }
  };
}

// ── Date helpers ────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateLabel(isoStr) {
  // Parse YYYY-MM-DD manually to avoid UTC offset shifting the date
  const [year, month, day] = isoStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysBetween(a, b) {
  const ms = Math.abs(new Date(b) - new Date(a));
  return Math.floor(ms / 86400000);
}

// ── Load / Save ─────────────────────────────────────────────
function loadData() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return defaultData();
    const d = JSON.parse(raw);
    // Merge any missing top-level keys from defaultData
    const def = defaultData();
    for (const k of Object.keys(def)) {
      if (!(k in d)) d[k] = def[k];
    }
    return d;
  } catch (e) {
    console.error('loadData error:', e);
    return defaultData();
  }
}

function saveData(data) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('saveData error:', e);
    return false;
  }
}

// ── Auto-sync after saves ──────────────────────────────────
let _autoSyncTimer = null;

async function autoSync() {
  // Debounce — if called multiple times rapidly, only run once
  if (_autoSyncTimer) clearTimeout(_autoSyncTimer);
  _autoSyncTimer = setTimeout(async () => {
    if (!isAutoSyncEnabled()) return; // honor the user's sync choice, not just token presence

    showSyncIndicator('syncing');
    const result = await syncToGist();
    if (result && result.ok) {
      showSyncIndicator('success');
    } else {
      showSyncIndicator('error', result ? result.msg : 'Sync failed');
    }
  }, 800); // wait 800ms after last save before syncing
}

function showSyncIndicator(state, msg) {
  // Find or create the sync indicator element
  let indicator = document.getElementById('auto-sync-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'auto-sync-indicator';
    indicator.style.cssText = [
      'position:fixed',
      'bottom:1.25rem',
      'right:1.25rem',
      'padding:0.4rem 0.85rem',
      'border-radius:999px',
      'font-size:0.78rem',
      'font-family:var(--font-body)',
      'letter-spacing:0.04em',
      'z-index:9000',
      'transition:opacity 0.3s',
      'pointer-events:none',
      'box-shadow:0 2px 8px rgba(0,0,0,0.12)',
    ].join(';');
    document.body.appendChild(indicator);
  }

  indicator.style.opacity = '1';

  if (state === 'syncing') {
    indicator.style.background = 'var(--paper-dark)';
    indicator.style.color = 'var(--ink-faint)';
    indicator.style.border = '1px solid var(--stone)';
    indicator.textContent = '↑ Syncing…';
  } else if (state === 'success') {
    indicator.style.background = '#e8f5e9';
    indicator.style.color = '#2e7d32';
    indicator.style.border = '1px solid #a5d6a7';
    indicator.textContent = '✓ Synced to Gist';
    // Fade out after 3 seconds
    setTimeout(() => { indicator.style.opacity = '0'; }, 3000);
  } else if (state === 'error') {
    indicator.style.background = '#fff3e0';
    indicator.style.color = '#e65100';
    indicator.style.border = '1px solid #ffcc80';
    indicator.textContent = '⚠ Sync failed — push manually';
    // Stay visible longer for errors
    setTimeout(() => { indicator.style.opacity = '0'; }, 8000);
  }
}

// ── Streak calculation ───────────────────────────────────────
// Streak = streakBase + consecutive days with at least one sit logged here
function calcStreak(data) {
  const sits = data.sits || [];
  if (sits.length === 0) return data.meta.streakBase;

  // Unique sit dates sorted descending
  const sitDates = [...new Set(sits.map(s => s.date))].sort().reverse();
  const today = todayStr();

  // Helper: subtract N days from a YYYY-MM-DD string
  function subtractDay(dateStr) {
    const d = new Date(dateStr + 'T12:00:00'); // noon local avoids DST edge cases
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // Streak starts from today or yesterday (allow logging after midnight)
  let check = today;
  if (sitDates[0] !== today) {
    const yesterday = subtractDay(today);
    if (sitDates[0] !== yesterday) {
      return data.meta.streakBase; // most recent sit is older than yesterday — streak broken
    }
    check = yesterday; // start counting from yesterday
  }

  // Count consecutive days backward from check
  let streak = 0;
  for (const d of sitDates) {
    if (d === check) {
      streak++;
      check = subtractDay(check);
    } else if (d < check) {
      break; // gap in dates — streak ends
    }
    // d > check means multiple sits on same day already counted — skip
  }

  return data.meta.streakBase + streak;
}

// ── CRUD helpers ─────────────────────────────────────────────
function addSit(sit) {
  const data = loadData();
  sit.id = Date.now().toString();
  sit.date = sit.date || todayStr();
  sit.created = new Date().toISOString();
  data.sits.unshift(sit);
  saveData(data);
  return sit;
}

function addDailyCheck(check) {
  const data = loadData();
  check.id = Date.now().toString();
  check.date = check.date || todayStr();
  check.created = new Date().toISOString();
  // Replace existing check for same date if present
  const idx = data.dailyChecks.findIndex(c => c.date === check.date);
  if (idx >= 0) data.dailyChecks[idx] = check;
  else data.dailyChecks.unshift(check);
  saveData(data);
  return check;
}

function addJournalEntry(entry) {
  const data = loadData();
  entry.id = Date.now().toString();
  entry.date = entry.date || todayStr();
  entry.created = new Date().toISOString();
  data.journal.unshift(entry);
  saveData(data);
  return entry;
}

function addPathMarker(marker) {
  const data = loadData();
  marker.id = Date.now().toString();
  marker.date = marker.date || todayStr();
  marker.created = new Date().toISOString();
  data.pathMarkers.unshift(marker);
  saveData(data);
  return marker;
}

function addDream(dream) {
  const data = loadData();
  dream.id = Date.now().toString();
  dream.date = dream.date || todayStr();
  dream.created = new Date().toISOString();
  data.dreams.unshift(dream);
  saveData(data);
  return dream;
}

function getTodayCheck() {
  const data = loadData();
  return data.dailyChecks.find(c => c.date === todayStr()) || null;
}

function getTodaySits() {
  const data = loadData();
  return data.sits.filter(s => s.date === todayStr());
}

function getRecentSits(n) {
  const data = loadData();
  return data.sits.slice(0, n);
}

// ── GitHub Gist Sync ─────────────────────────────────────────
function getGistToken() { return localStorage.getItem(GIST_TOKEN_KEY) || ''; }

// Single source of truth for whether AUTOMATIC sync should run.
// Honors the user's explicit syncEnabled choice — not merely token presence.
// Manual "Push now"/"Pull now" remain available regardless (they don't call this).
function isAutoSyncEnabled() {
  const token = getGistToken();
  const gistId = getGistId();
  if (!token || !gistId) return false;
  try {
    const d = loadData();
    return !!(d.meta && d.meta.syncEnabled);
  } catch (e) { return false; }
}
function getGistId()    { return localStorage.getItem(GIST_ID_KEY) || ''; }
function setGistToken(t) { localStorage.setItem(GIST_TOKEN_KEY, t); }
function setGistId(id)   { localStorage.setItem(GIST_ID_KEY, id); }

async function syncToGist() {
  const token = getGistToken();
  const gistId = getGistId();
  if (!token) return { ok: false, msg: 'No token configured' };

  const data = loadData();
  const body = {
    description: 'The Path — Buddhist Practice Data',
    files: { 'the_path_data.json': { content: JSON.stringify(data, null, 2) } }
  };

  try {
    let url = 'https://api.github.com/gists';
    let method = 'POST';
    if (gistId) { url += '/' + gistId; method = 'PATCH'; }

    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': 'token ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) return { ok: false, msg: 'Gist API error: ' + res.status };
    const json = await res.json();
    if (!gistId) setGistId(json.id);
    if (json.updated_at) localStorage.setItem('the_path_last_sync', json.updated_at);
    return { ok: true, msg: 'Synced at ' + new Date().toLocaleTimeString() };
  } catch (e) {
    return { ok: false, msg: 'Network error: ' + e.message };
  }
}

async function syncFromGist() {
  const token = getGistToken();
  const gistId = getGistId();
  if (!token || !gistId) return { ok: false, msg: 'Token or Gist ID missing' };

  try {
    const res = await fetch('https://api.github.com/gists/' + gistId, {
      headers: { 'Authorization': 'token ' + token }
    });
    if (!res.ok) return { ok: false, msg: 'Gist API error: ' + res.status };
    const json = await res.json();
    const content = json.files['the_path_data.json']?.content;
    if (!content) return { ok: false, msg: 'No data file found in Gist' };
    const remoteData = JSON.parse(content);
    saveData(remoteData);
    if (json.updated_at) localStorage.setItem('the_path_last_sync', json.updated_at);
    return { ok: true, msg: 'Pulled from Gist at ' + new Date().toLocaleTimeString() };
  } catch (e) {
    return { ok: false, msg: 'Network error: ' + e.message };
  }
}

// ── Export / Import ──────────────────────────────────────────
function exportData() {
  const data = loadData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'the_path_backup_' + todayStr() + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        saveData(data);
        resolve(data);
      } catch (err) { reject(err); }
    };
    reader.readAsText(file);
  });
}

// ── Path framework data ──────────────────────────────────────
const SEVEN_PURIFICATIONS = [
  { id: 'sila', name: 'Sīla-visuddhi', label: 'Purification of Virtue', desc: 'Stable observance of the precepts; ethical conduct as foundation.' },
  { id: 'citta', name: 'Citta-visuddhi', label: 'Purification of Mind', desc: 'Access concentration (upacāra-samādhi) or absorption (appanā-samādhi).' },
  { id: 'ditthi', name: 'Diṭṭhi-visuddhi', label: 'Purification of View', desc: 'Clear understanding of nāma-rūpa; dissolution of self-view regarding mind and matter.' },
  { id: 'kankha', name: 'Kaṅkhāvitaraṇa-visuddhi', label: 'Purification by Overcoming Doubt', desc: 'Understanding dependent origination; no residual doubt about the three jewels or the path.' },
  { id: 'maggamagga', name: 'Maggāmagga-visuddhi', label: 'Purification by Knowledge of Path/Non-Path', desc: 'Distinguishing genuine insight from the ten corruptions of insight (upakkilesa).' },
  { id: 'patipada', name: 'Paṭipadā-visuddhi', label: 'Purification by Knowledge of Progress', desc: 'The nine insight knowledges from dissolution through equanimity toward formations.' },
  { id: 'nana', name: 'Ñāṇadassana-visuddhi', label: 'Purification by Knowledge and Vision', desc: 'Path and fruition consciousness; emergence into the supramundane.' }
];

const INSIGHT_KNOWLEDGES = [
  { id: 'ik1', name: 'Nāmarūpa-pariccheda-ñāṇa', short: 'Mind-Body Distinction', purif: 'ditthi' },
  { id: 'ik2', name: 'Paccaya-pariggaha-ñāṇa', short: 'Conditionality', purif: 'kankha' },
  { id: 'ik3', name: 'Sammasana-ñāṇa', short: 'Three Characteristics', purif: 'maggamagga' },
  { id: 'ik4', name: 'Udayabbaya-ñāṇa', short: 'Arising and Passing', purif: 'maggamagga' },
  { id: 'ik5', name: 'Bhaṅga-ñāṇa', short: 'Dissolution', purif: 'patipada' },
  { id: 'ik6', name: 'Bhaya-ñāṇa', short: 'Fear', purif: 'patipada' },
  { id: 'ik7', name: 'Ādīnava-ñāṇa', short: 'Misery', purif: 'patipada' },
  { id: 'ik8', name: 'Nibbidā-ñāṇa', short: 'Disenchantment', purif: 'patipada' },
  { id: 'ik9', name: 'Muñcitukamyatā-ñāṇa', short: 'Desire for Deliverance', purif: 'patipada' },
  { id: 'ik10', name: 'Paṭisaṅkhā-ñāṇa', short: 'Re-observation', purif: 'patipada' },
  { id: 'ik11', name: 'Saṅkhārupekkhā-ñāṇa', short: 'Equanimity toward Formations', purif: 'patipada' },
  { id: 'ik12', name: 'Anuloma-ñāṇa', short: 'Conformity', purif: 'nana' },
  { id: 'ik13', name: 'Gotrabhu-ñāṇa', short: 'Change of Lineage', purif: 'nana' },
  { id: 'ik14', name: 'Magga-ñāṇa', short: 'Path Knowledge', purif: 'nana' },
  { id: 'ik15', name: 'Phala-ñāṇa', short: 'Fruition Knowledge', purif: 'nana' },
  { id: 'ik16', name: 'Paccavekkhaṇa-ñāṇa', short: 'Review Knowledge', purif: 'nana' }
];

const JHANAS = [
  { id: 'j1', name: 'First Jhāna', factors: 'Vitakka, vicāra, pīti, sukha, ekaggatā' },
  { id: 'j2', name: 'Second Jhāna', factors: 'Pīti, sukha, ekaggatā (vitakka/vicāra absent)' },
  { id: 'j3', name: 'Third Jhāna', factors: 'Sukha, ekaggatā (pīti fades to upekkhā)' },
  { id: 'j4', name: 'Fourth Jhāna', factors: 'Upekkhā, ekaggatā (breath may cease)' },
  { id: 'j5', name: 'Ākāsānañcāyatana', factors: 'Infinite space' },
  { id: 'j6', name: 'Viññāṇañcāyatana', factors: 'Infinite consciousness' },
  { id: 'j7', name: 'Ākiñcaññāyatana', factors: 'Nothingness' },
  { id: 'j8', name: 'Nevasaññānāsaññāyatana', factors: 'Neither perception nor non-perception' }
];

const FIVE_HINDRANCES = [
  { id: 'h_sensual', name: 'Kāmacchanda', label: 'Sensual desire' },
  { id: 'h_ill_will', name: 'Byāpāda', label: 'Ill-will / aversion' },
  { id: 'h_sloth', name: 'Thīna-middha', label: 'Sloth-torpor' },
  { id: 'h_restless', name: 'Uddhacca-kukkucca', label: 'Restlessness-worry' },
  { id: 'h_doubt', name: 'Vicikicchā', label: 'Doubt' }
];

const EIGHTFOLD_PATH = [
  { id: 'ep_view', factor: 'Sammā-diṭṭhi', label: 'Right View', group: 'Paññā' },
  { id: 'ep_intention', factor: 'Sammā-saṅkappa', label: 'Right Intention', group: 'Paññā' },
  { id: 'ep_speech', factor: 'Sammā-vācā', label: 'Right Speech', group: 'Sīla' },
  { id: 'ep_action', factor: 'Sammā-kammanta', label: 'Right Action', group: 'Sīla' },
  { id: 'ep_livelihood', factor: 'Sammā-ājīva', label: 'Right Livelihood', group: 'Sīla' },
  { id: 'ep_effort', factor: 'Sammā-vāyāma', label: 'Right Effort', group: 'Samādhi' },
  { id: 'ep_mindfulness', factor: 'Sammā-sati', label: 'Right Mindfulness', group: 'Samādhi' },
  { id: 'ep_concentration', factor: 'Sammā-samādhi', label: 'Right Concentration', group: 'Samādhi' }
];

// ── Shared nav HTML ──────────────────────────────────────────
function renderNav(activePage) {
  const mainPages = [
    { id: 'index',    href: 'index.html',    label: 'Dashboard' },
    { id: 'sit',      href: 'sit.html',      label: 'Sit Log' },
    { id: 'timer',    href: 'timer.html',    label: 'Timer' },
    { id: 'practice', href: 'practice.html', label: 'Practice' },
    { id: 'journal',  href: 'journal.html',  label: 'Journal' },
    { id: 'path',     href: 'path.html',     label: 'The Path' }
  ];
  const resourcePages = [
    { id: 'do',       href: 'do.html',       label: 'Dependent Origination' },
    { id: 'glossary', href: 'glossary.html', label: 'Pāli Glossary' },
    { id: 'suttas',   href: 'suttas.html',   label: 'Sutta Search' },
    { id: 'logs',     href: 'logs.html',     label: 'Full Log' },
    { id: 'tutorial', href: 'theravada_buddhism_interactive_tutorial.html', label: 'Theravāda Tutorial' },
    { id: 'updates',  href: 'updates.html',  label: 'Updates & Notes' },
    { id: 'settings', href: 'settings.html', label: 'Setup & Settings' },
    { id: 'contact',  href: 'contact.html',  label: 'Contact Creator' }
  ];
  const isResource = resourcePages.some(p => p.id === activePage);

  return `<nav class="main-nav" id="main-nav">
    <div class="nav-brand">The Path</div>
    <div class="nav-links" id="nav-links">
      ${mainPages.map(p => `<a href="${p.href}" class="nav-link${p.id === activePage ? ' active' : ''}">${p.label}</a>`).join('')}
      <div class="nav-dropdown" id="nav-dropdown">
        <button class="nav-link nav-dropdown-btn${isResource ? ' active' : ''}" onclick="toggleNavDropdown(event)">
          Resources ▾
        </button>
        <div class="nav-dropdown-menu" id="nav-dropdown-menu">
          ${resourcePages.map(p => `<a href="${p.href}" class="nav-dropdown-item${p.id === activePage ? ' active' : ''}">${p.label}</a>`).join('')}
        </div>
      </div>
    </div>
    <div class="nav-right">
      <button class="nav-sync" onclick="handleNavSync()" title="Sync to Gist">⇅</button>
      <button class="nav-hamburger" id="nav-hamburger" onclick="toggleMobileNav()" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>`;
}

function toggleNavDropdown(e) {
  e.stopPropagation();
  const menu = document.getElementById('nav-dropdown-menu');
  if (menu) menu.classList.toggle('open');
}

function toggleMobileNav() {
  const links = document.getElementById('nav-links');
  const hamburger = document.getElementById('nav-hamburger');
  if (links) links.classList.toggle('mobile-open');
  if (hamburger) hamburger.classList.toggle('open');
}

// Close dropdown when clicking outside
document.addEventListener('click', () => {
  const menu = document.getElementById('nav-dropdown-menu');
  if (menu) menu.classList.remove('open');
});

async function handleNavSync() {
  const btn = document.querySelector('.nav-sync');
  if (!btn) return;
  btn.textContent = '...';
  const result = await syncToGist();
  btn.textContent = result.ok ? '✓' : '✗';
  setTimeout(() => btn.textContent = '⇅', 2000);
}

// ── Glossary tooltip injection ─────────────────────────────
// Maps anchor ID → English translation for hover tooltips
const GLOSS_ENGLISH = {
  'ekaggata':             'Unification of mind / One-pointedness',
  'piti':                 'Rapture / Zest',
  'sukha':                'Pleasure / Ease / Happiness',
  'upekkha':              'Equanimity',
  'vicara':               'Sustained thought / Examination',
  'vitakka':              'Applied thought / Initial thought',
  'byapada':              'Ill-will / Aversion',
  'kamacchanda':          'Sensual desire / Longing',
  'thina-middha':         'Sloth and torpor',
  'uddhacca':             'Restlessness and remorse',
  'vicikiccha':           'Doubt',
  'sila-visuddhi':        'Purification of Virtue (P1)',
  'citta-visuddhi':       'Purification of Mind (P2)',
  'ditthi-visuddhi':      'Purification of View (P3)',
  'kankhavitarana-visuddhi': 'Purification by Overcoming Doubt (P4)',
  'patipadavsd':          'Purification by Knowledge of the Way (P5)',
  'maggamagga-visuddhi':  'Purification by Knowledge of Path & Non-Path (P6)',
  'nanadassana-visuddhi': 'Purification by Knowledge & Vision (P7)',
  'nana1':                'Knowledge of Mind-Body Distinction (ñ.1)',
  'nana2':                'Knowledge of Conditionality (ñ.2)',
  'nana3':                'Knowledge of the Three Characteristics (ñ.3)',
  'udayabbaya':           'Knowledge of Arising & Passing Away (ñ.4)',
  'bhanga-nana':          'Knowledge of Dissolution (ñ.5)',
  'bhaya-nana':           'Knowledge of Fearfulness (ñ.6)',
  'adinava-nana':         'Knowledge of Danger (ñ.7)',
  'nibbida-nana':         'Knowledge of Disenchantment (ñ.8)',
  'muncitu-nana':         'Knowledge of Desire for Deliverance (ñ.9)',
  'patisankha-nana':      'Knowledge of Re-observation (ñ.10)',
  'sankharupekkha-nana':  'Knowledge of Equanimity toward Formations (ñ.11)',
  'anuloma-nana':         'Conformity Knowledge (ñ.12)',
  'gotrabhu-nana':        'Change-of-Lineage Knowledge (ñ.13)',
  'magga-nana':           'Path Knowledge (ñ.14)',
  'phala-nana':           'Fruition Knowledge (ñ.15)',
  'paccavekkhana-nana':   'Reviewing Knowledge (ñ.16)',
  'anicca':               'Impermanence',
  'anatta':               'Non-self',
  'dukkha':               'Suffering / Unsatisfactoriness',
  'nibbana':              'Liberation / The unconditioned',
  'paticca':              'Dependent Origination',
  'metta':                'Loving-kindness / Goodwill',
  'karuna':               'Compassion',
  'mudita':               'Appreciative joy',
  'brahmavihara':         'Divine abodes — mettā, karuṇā, muditā, upekkhā',
  'sati':                 'Mindfulness',
  'sampajanna':           'Clear comprehension',
  'panna':                'Wisdom',
  'samadhi-g':            'Concentration / Collectedness',
  'sila-g':               'Virtue / Moral conduct',
  'vipassana':            'Insight meditation',
  'jhana':                'Meditative absorption',
  'tanha':                'Craving / Thirst',
  'upadana':              'Clinging / Grasping',
  'vedana-g':             'Feeling-tone — pleasant, unpleasant, or neutral',
  'avijja-g':             'Ignorance — root of dependent origination',
  'kamma':                'Intentional action',
  'cetana':               'Volition / Intention',
  'sankhara-g':           'Mental formation / Conditioned thing',
  'nana-g':               'Knowledge / Direct knowing',
  'sotapanna':            'Stream-enterer — first stage of awakening',
  'arahant':              'Fully liberated one — fourth stage of awakening',
  'viriya':               'Energy / Effort',
  'saddha':               'Faith / Confidence',
  'bojjhanga':            'Seven factors of awakening',
  'satipatthana':         'Four foundations of mindfulness',
  'indriya':              'Five spiritual faculties',
  'yoniso':               'Wise attention / Going to the root',
  'papanca':              'Mental proliferation / Conceptual elaboration',
  'samvega':              'Urgency / Spiritual stirring',
  'appamada':             'Heedfulness / Earnest attentiveness',
  'dana':                 'Generosity / Giving',
  'khanti':               'Patience / Forbearance',
  'nekkhamma':            'Renunciation',
  'parami':               'Perfections — ten qualities cultivated to completion',
  'anapana':              'Mindfulness of breathing',
  'upacara-samadhi':      'Access concentration — threshold before absorption',
  'nimitta-parikamma':    'Preparatory sign — initial breath impression',
  'nimitta-uggaha':       'Acquired sign — steadied breath image',
  'nimitta-patibhaga':    'Counterpart sign — luminous, stable image',
  'samatha':              'Calm / Serenity meditation',
  'bhavana':              'Mental cultivation / Meditation',
  'kilesa':               'Defilement / Mental impurity',
  'asava':                'Taint / Deep defilement',
  'lobha':                'Greed / Craving',
  'dosa':                 'Aversion / Hatred',
  'moha':                 'Delusion / Confusion',
  'khandha':              'Five aggregates of clinging',
  'tiratana':             'Three Jewels — Buddha, Dhamma, Saṅgha',
  'dhamma-g':             'The teaching / Law of nature / Phenomenon',
  'sangha':               'Community / Noble community',
  'tipitaka':             'Three Baskets — the Pāli canon',
  'ariya':                'Noble one — at least a stream-enterer',
  'samyojana':            'Ten fetters binding to samsāra',
  'sakkaya-ditthi':       'Identity view / Personality-belief',
  'vimutti':              'Liberation / Release',
  'yathabhuta':           'Seeing things as they are',
  'vipassanupakkilesa':   'Corruptions of insight — 10 misleading experiences',
  'sammaditthi':          'Right View',
  'sammasankappa':        'Right Intention',
  'sammavaca':            'Right Speech',
  'sammakammanta':        'Right Action',
  'sammaajiva':           'Right Livelihood',
  'sammavayama':          'Right Effort',
  'sammasati':            'Right Mindfulness',
  'sammasamadhi':         'Right Concentration',
  'pancha-sila':          'Five Precepts',
  'hiri-ottappa':         'Moral shame and moral dread',
  'indriya-samvara':      'Restraint of the sense faculties',
  'alobha':               'Non-greed / Non-hatred / Non-delusion (wholesome roots)',
  'kamma-g':              'Intentional action generating results',
  'vipaka':               'Karmic result / Ripening',
  'samsara':              'The round of rebirth',
  'nibbuti':              'Cooling / Peace — synonym for nibbāna',
};

function initGlossTooltips() {
  document.querySelectorAll('a.gloss-ref[href*="glossary.html#"]').forEach(link => {
    const href = link.getAttribute('href') || '';
    const anchor = href.split('#')[1];
    if (!anchor) return;

    const english = GLOSS_ENGLISH[anchor];
    if (!english) return;

    // Don't add if tooltip already present
    if (link.querySelector('.gloss-tooltip')) return;

    const tip = document.createElement('span');
    tip.className = 'gloss-tooltip';
    tip.textContent = english;
    link.appendChild(tip);
  });
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGlossTooltips);
} else {
  initGlossTooltips();
}


// ── Pull-on-load freshness check ───────────────────────────
// Compares the Gist's updated_at against our last recorded sync.
// If the Gist is newer, another device has pushed — offer to pull.
async function checkGistFreshness() {
  if (!isAutoSyncEnabled()) return; // honor the user's sync choice
  const gistId = getGistId();

  const lastSync = localStorage.getItem('the_path_last_sync');

  try {
    const res = await fetch('https://api.github.com/gists/' + gistId, {
      headers: { 'Authorization': 'token ' + token }
    });
    if (!res.ok) return;
    const json = await res.json();
    const remoteUpdated = json.updated_at;
    if (!remoteUpdated) return;

    // If we've never synced, or the Gist is newer than our last sync, prompt
    if (!lastSync || new Date(remoteUpdated) > new Date(lastSync)) {
      showFreshnessBanner(remoteUpdated);
    }
  } catch (e) {
    // Silent — offline or error, don't disrupt
  }
}

function showFreshnessBanner(remoteUpdated) {
  if (document.getElementById('freshness-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'freshness-banner';
  banner.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:9500',
    'background:#8a6a2a', 'color:#f5f0e8',
    'padding:0.6rem 1rem', 'font-size:0.9rem',
    'font-family:var(--font-body,serif)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'gap:1rem', 'flex-wrap:wrap',
    'box-shadow:0 2px 8px rgba(0,0,0,0.2)'
  ].join(';');

  const when = new Date(remoteUpdated).toLocaleString();
  const msg = document.createElement('span');
  msg.textContent = 'Newer data is available in your Gist (updated ' + when + '). Another device may have synced.';
  banner.appendChild(msg);

  const pullBtn = document.createElement('button');
  pullBtn.textContent = '↓ Pull now';
  pullBtn.style.cssText = 'background:#f5f0e8;color:#2a2318;border:none;border-radius:999px;padding:0.35rem 0.9rem;font-size:0.85rem;cursor:pointer;font-weight:600';
  pullBtn.onclick = async () => {
    pullBtn.textContent = 'Pulling…';
    pullBtn.disabled = true;
    const r = await syncFromGist();
    if (r.ok) {
      banner.remove();
      // Reload so all rendered views reflect pulled data
      window.location.reload();
    } else {
      pullBtn.textContent = 'Pull failed';
      setTimeout(() => { pullBtn.textContent = '↓ Pull now'; pullBtn.disabled = false; }, 2000);
    }
  };
  banner.appendChild(pullBtn);

  const dismissBtn = document.createElement('button');
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.style.cssText = 'background:transparent;color:#f5f0e8;border:1px solid rgba(245,240,232,0.5);border-radius:999px;padding:0.35rem 0.9rem;font-size:0.85rem;cursor:pointer';
  dismissBtn.onclick = () => banner.remove();
  banner.appendChild(dismissBtn);

  document.body.appendChild(banner);
}

// Run the check shortly after load (once DOM is ready)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(checkGistFreshness, 600));
} else {
  setTimeout(checkGistFreshness, 600);
}

// ═══════════════════════════════════════════════════════════
// FEEDBACK BANNER — TEMPORARY. Remove this whole block to retire it.
//
// A one-time, opt-in prompt. Nothing is sent when the banner is merely
// shown; a submission happens only when a button is pressed, and the
// banner says so before you press anything. The "×" sends nothing at
// all — it snoozes for the browser session only, so anyone who wants no
// part of this is not nagged on every page load.
//
// Self-disables after FEEDBACK_UNTIL even if nobody remembers to delete
// it. That date is the real off switch; deleting the block is tidier.
//
// QUOTA: Web3Forms free is 250 submissions/month across the whole
// account, shared with the contact form. Dismissals will outnumber real
// answers. If this budget is exhausted, genuine contact-form messages
// stop being delivered — use a SEPARATE Web3Forms account key below so
// a flood of banner traffic cannot silence the contact form.
// ═══════════════════════════════════════════════════════════
const FEEDBACK_UNTIL = '2026-08-13';                 // last day it will appear
const FEEDBACK_KEY   = 'the_path_feedback_v1';       // set once answered
const FEEDBACK_SNOOZE = 'the_path_feedback_snooze';  // sessionStorage only
const FEEDBACK_FORM_KEY = 'f4f677f8-c122-43c0-95b0-e6c68055149a'; // ← swap for a separate account key

function feedbackLandingPage() {
  try {
    const f = (location.pathname.split('/').pop() || '').trim();
    return f || 'index.html';
  } catch (e) { return 'unknown'; }
}

function feedbackAlreadyDone() {
  try {
    if (localStorage.getItem(FEEDBACK_KEY)) return true;
    if (sessionStorage.getItem(FEEDBACK_SNOOZE)) return true;
  } catch (e) { return true; }   // storage blocked → do not pester
  return false;
}

function feedbackWindowOpen() {
  try {
    return new Date() <= new Date(FEEDBACK_UNTIL + 'T23:59:59');
  } catch (e) { return false; }
}

// Fire-and-forget. The flag is set before this runs, so a failed send
// never causes a repeat prompt — one lost data point beats nagging.
function sendFeedback(answer) {
  try {
    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        access_key: 0e7e5713-37e8-4ba5-965e-1406483b428f,
        subject: 'The Path — banner feedback: ' + answer,
        from_name: 'The Path (feedback banner)',
        message: 'Answer: ' + answer + '\nLanded on: ' + feedbackLandingPage(),
        reply_to: 'not provided'
      })
    }).catch(() => {});
  } catch (e) { /* never let this break a page */ }
}

function showFeedbackBanner() {
  if (document.getElementById('feedback-banner')) return;
  // The Gist-freshness banner owns the top strip and matters more.
  if (document.getElementById('freshness-banner')) return;

  const style = document.createElement('style');
  style.textContent =
    '#feedback-banner{position:fixed;top:0;left:0;right:0;z-index:9400;' +
    'background:var(--paper-deep,#efe8dc);color:var(--ink,#2a2318);' +
    'border-bottom:1px solid var(--stone,#c9bda6);' +
    'box-shadow:0 2px 10px rgba(0,0,0,0.10);' +
    'font-family:var(--font-body,Georgia,serif);' +
    'transform:translateY(-100%);transition:transform 0.35s ease}' +
    '#feedback-banner.in{transform:translateY(0)}' +
    '#feedback-banner .fb-inner{max-width:680px;margin:0 auto;' +
    'padding:0.85rem 2.4rem 0.9rem 1.1rem;position:relative}' +
    '#feedback-banner .fb-q{font-size:0.95rem;line-height:1.5;margin-bottom:0.2rem}' +
    '#feedback-banner .fb-sub{font-size:0.76rem;line-height:1.5;' +
    'color:var(--ink-faint,#7a6f5d);margin-bottom:0.6rem}' +
    '#feedback-banner .fb-row{display:flex;gap:0.4rem;flex-wrap:wrap}' +
    '#feedback-banner .fb-btn{border:1px solid var(--stone,#c9bda6);' +
    'background:var(--paper,#f5f0e8);color:var(--ink-mid,#4a4030);' +
    'border-radius:999px;padding:0.4rem 0.85rem;font-size:0.85rem;cursor:pointer;' +
    'font-family:inherit}' +
    '#feedback-banner .fb-btn:hover{border-color:var(--gold,#8a6a2a);color:var(--gold,#8a6a2a)}' +
    '#feedback-banner .fb-x{position:absolute;top:0.5rem;right:0.6rem;border:none;' +
    'background:none;cursor:pointer;font-size:1rem;line-height:1;padding:0.3rem;' +
    'color:var(--ink-faint,#7a6f5d);font-family:inherit}' +
    '#feedback-banner .fb-x:hover{color:var(--ink,#2a2318)}';
  document.head.appendChild(style);

  const bar = document.createElement('div');
  bar.id = 'feedback-banner';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Feedback request');

  const inner = document.createElement('div');
  inner.className = 'fb-inner';

  const q = document.createElement('div');
  q.className = 'fb-q';
  q.textContent = 'Thank you for using this tool. Are you finding it useful?';
  inner.appendChild(q);

  const sub = document.createElement('div');
  sub.className = 'fb-sub';
  sub.textContent = 'Any button below emails a one-word answer and the page you landed on to '
    + 'the person who maintains this. Nothing else is sent, and nothing has been sent so far. '
    + 'Asked once.';
  inner.appendChild(sub);

  const row = document.createElement('div');
  row.className = 'fb-row';
  ['Yes', 'In some ways', 'No', 'Rather not say'].forEach(label => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fb-btn';
    b.textContent = label;
    b.onclick = () => respondFeedback(label, bar);
    row.appendChild(b);
  });
  inner.appendChild(row);

  // Sends nothing. Session-only snooze.
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'fb-x';
  x.setAttribute('aria-label', 'Not now');
  x.textContent = '\u2715';
  x.onclick = () => {
    try { sessionStorage.setItem(FEEDBACK_SNOOZE, '1'); } catch (e) {}
    closeFeedbackBanner(bar);
  };
  inner.appendChild(x);

  bar.appendChild(inner);
  document.body.appendChild(bar);
  requestAnimationFrame(() => bar.classList.add('in'));
}

function respondFeedback(answer, bar) {
  // Flag first: a network failure must not turn into a repeat prompt.
  try { localStorage.setItem(FEEDBACK_KEY, answer); } catch (e) {}
  sendFeedback(answer);

  const inner = bar.querySelector('.fb-inner');
  inner.innerHTML = '';

  const msg = document.createElement('div');
  msg.className = 'fb-q';
  msg.textContent = 'Thank you — noted.';
  inner.appendChild(msg);

  const sub = document.createElement('div');
  sub.className = 'fb-sub';
  sub.textContent = 'You will not be asked again.';
  inner.appendChild(sub);

  const row = document.createElement('div');
  row.className = 'fb-row';
  const more = document.createElement('a');
  more.className = 'fb-btn';
  more.href = 'contact.html';
  more.textContent = 'Say more →';
  more.style.textDecoration = 'none';
  row.appendChild(more);

  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'fb-btn';
  done.textContent = 'Close';
  done.onclick = () => closeFeedbackBanner(bar);
  row.appendChild(done);
  inner.appendChild(row);

  setTimeout(() => closeFeedbackBanner(bar), 12000);
}

function closeFeedbackBanner(bar) {
  if (!bar || !bar.parentNode) return;
  bar.classList.remove('in');
  setTimeout(() => { if (bar.parentNode) bar.remove(); }, 400);
}

function maybeShowFeedbackBanner() {
  try {
    if (!feedbackWindowOpen()) return;
    if (feedbackAlreadyDone()) return;
    if (!document.body) return;
    showFeedbackBanner();
  } catch (e) { /* a broken banner must never break the page */ }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(maybeShowFeedbackBanner, 1500));
} else {
  setTimeout(maybeShowFeedbackBanner, 1500);
}
// ═══════════ END FEEDBACK BANNER — delete to here ═══════════
