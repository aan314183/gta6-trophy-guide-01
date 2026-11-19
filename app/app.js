// Leonida Legend — GTA 6 trophy guide & tracker.
// Loads app/data/trophies.json, renders the checklist and the roadmap,
// and keeps earned ticks in localStorage. No network at run time: the
// only fetch is the trophy file beside this script.

const STORE_KEY = 'gta6-trophy-guide-01-progress-v1';
const KINDS = [
  ['all', 'All'],
  ['story', 'Story'],
  ['missable', 'Missable'],
  ['collectibles', 'Collectibles'],
  ['activities', 'Activities'],
  ['online', 'Online'],
  ['platinum', 'Platinum'],
];

const params = new URLSearchParams(location.search);
const listEl = document.getElementById('trophy-list');
const emptyEl = document.getElementById('empty');
const resultCountEl = document.getElementById('result-count');
const searchEl = document.getElementById('search');
const gradeEl = document.getElementById('grade');
const spoilerEl = document.getElementById('spoiler');
const hideEarnedEl = document.getElementById('hide-earned');
const kindChipsEl = document.getElementById('kind-chips');
const ioNoteEl = document.getElementById('io-note');
const trackerView = document.getElementById('tracker-view');
const roadmapView = document.getElementById('roadmap-view');
const viewTrackerBtn = document.getElementById('view-tracker');
const viewRoadmapBtn = document.getElementById('view-roadmap');

const doc = await (await fetch('data/trophies.json')).json();
const trophies = doc.trophies;
const byId = new Map(trophies.map((t) => [t.id, t]));

// Earned ticks: an id set, loaded from localStorage, or from a shared
// progress link (#earned=1,2,3) when one is opened.
let earned = new Set(readStoredIds());
applyHashIds();

function readStoredIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((n) => byId.has(n)) : [];
  } catch {
    return [];
  }
}

function applyHashIds() {
  const match = location.hash.match(/earned=([\d,]+)/);
  if (!match) return;
  const ids = match[1].split(',').map(Number).filter((n) => byId.has(n));
  if (ids.length) {
    earned = new Set(ids);
    saveProgress();
  }
}

function saveProgress() {
  localStorage.setItem(STORE_KEY, JSON.stringify([...earned].sort((a, b) => a - b)));
}

function gradeLabel(t) {
  return t.grade[0].toUpperCase() + t.grade.slice(1);
}

function countLabel(t) {
  if (t.count == null) return null;
  if (t.id === 52) return '$250,000 to launder';
  if (t.id === 53) return '$100,000 to spend';
  if (t.id === 48) return '500 choices';
  return `${t.count} needed`;
}

// --- progress summary -------------------------------------------------
function renderProgress() {
  const total = trophies.length;
  const done = earned.size;
  const pct = Math.round((done / total) * 100);
  document.getElementById('earned-count').textContent = done;
  document.getElementById('progress-pct').textContent =
    done === total ? 'Platinum earned — Vice Got a Price!' : `${pct}% to the platinum`;
  const fill = document.getElementById('progress-fill');
  fill.style.width = `${pct}%`;
  document.getElementById('progress-bar').setAttribute('aria-valuenow', String(done));
  const grades = ['platinum', 'gold', 'silver', 'bronze'];
  document.getElementById('grade-counts').innerHTML = grades
    .map((g) => {
      const all = trophies.filter((t) => t.grade === g).length;
      const got = trophies.filter((t) => t.grade === g && earned.has(t.id)).length;
      return `<li><span class="dot ${g}"></span>${gradeLabel({ grade: g })} ${got}/${all}</li>`;
    })
    .join('');
}

// --- kind filter chips ------------------------------------------------
let kind = params.get('kind') && KINDS.some(([k]) => k === params.get('kind')) ? params.get('kind') : 'all';
for (const [key, label] of KINDS) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.textContent = label;
  chip.setAttribute('aria-pressed', String(key === kind));
  chip.addEventListener('click', () => {
    kind = key;
    for (const c of kindChipsEl.children) c.setAttribute('aria-pressed', String(c === chip));
    renderList();
  });
  kindChipsEl.append(chip);
}

// --- spoiler mode -----------------------------------------------------
spoilerEl.checked = params.get('spoiler') === '1';
if (params.get('search')) searchEl.value = params.get('search');
if (params.get('grade')) gradeEl.value = params.get('grade');

function isSpoilered(t) {
  // Spoiler mode hides story trophies that are not earned yet.
  return spoilerEl.checked && t.kind === 'story' && !earned.has(t.id);
}

function matchesFilters(t) {
  if (kind === 'missable' && !t.missable) return false;
  if (kind === 'online') return false; // no online trophies: the list is all single-player
  if (kind !== 'all' && kind !== 'missable' && kind !== 'online' && t.kind !== kind) return false;
  if (gradeEl.value !== 'all' && t.grade !== gradeEl.value) return false;
  if (hideEarnedEl.checked && earned.has(t.id)) return false;
  const q = searchEl.value.trim().toLowerCase();
  if (q && !(t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.guide.toLowerCase().includes(q))) return false;
  return true;
}

// --- checklist --------------------------------------------------------
const openGuides = new Set();
const openParam = Number(params.get('open'));
if (byId.has(openParam)) openGuides.add(openParam);

function trophyCard(t) {
  const li = document.createElement('li');
  li.className = 'trophy' + (earned.has(t.id) ? ' earned' : '') + (isSpoilered(t) ? ' spoilered' : '');
  li.id = `trophy-${t.id}`;

  const head = document.createElement('div');
  head.className = 'trophy-head';

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = earned.has(t.id);
  box.setAttribute('aria-label', `Mark ${t.name} as earned`);
  box.addEventListener('change', () => {
    if (box.checked) earned.add(t.id);
    else earned.delete(t.id);
    saveProgress();
    renderProgress();
    renderList();
  });

  const title = document.createElement('div');
  title.className = 'trophy-title';
  const name = document.createElement('h3');
  name.textContent = isSpoilered(t) ? 'Hidden story trophy' : t.name;
  const official = document.createElement('p');
  official.className = 'official';
  official.textContent = isSpoilered(t) ? 'Earn this trophy to reveal its name and description.' : t.description;
  title.append(name, official);

  const badges = document.createElement('div');
  badges.className = 'badges';
  const badge = (text, cls) => {
    const b = document.createElement('span');
    b.className = `badge ${cls}`;
    b.textContent = text;
    return b;
  };
  badges.append(badge(gradeLabel(t), t.grade));
  if (t.hidden) badges.append(badge('Hidden', 'hidden'));
  if (t.missable) badges.append(badge('Possibly missable', 'missable'));
  badges.append(badge(t.kind, 'kind'));
  const count = countLabel(t);
  if (count) badges.append(badge(count, 'count'));
  title.append(badges);
  if (isSpoilered(t)) {
    const note = document.createElement('p');
    note.className = 'spoiler-note';
    note.textContent = 'Spoiler setting is on — tick it off once you have earned it to see the details.';
    title.append(note);
  }

  const guideBtn = document.createElement('button');
  guideBtn.type = 'button';
  guideBtn.className = 'guide-btn';
  guideBtn.setAttribute('aria-expanded', String(openGuides.has(t.id)));
  guideBtn.textContent = openGuides.has(t.id) ? 'Hide guide' : 'Guide';
  guideBtn.disabled = isSpoilered(t);
  guideBtn.addEventListener('click', () => {
    if (openGuides.has(t.id)) openGuides.delete(t.id);
    else openGuides.add(t.id);
    renderList();
  });

  head.append(box, title, guideBtn);
  li.append(head);

  if (openGuides.has(t.id) && !isSpoilered(t)) {
    const guide = document.createElement('div');
    guide.className = 'guide';
    const text = document.createElement('p');
    text.textContent = t.guide;
    guide.append(text);
    const sources = document.createElement('p');
    sources.className = 'sources';
    const strong = document.createElement('strong');
    strong.textContent = 'Sources: ';
    sources.append(strong);
    t.sources.forEach((s, i) => {
      if (i) sources.append(document.createTextNode(' · '));
      if (s.url) {
        const a = document.createElement('a');
        a.href = s.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = s.name;
        sources.append(a);
      } else {
        sources.append(document.createTextNode(s.name));
      }
    });
    guide.append(sources);
    li.append(guide);
  }
  return li;
}

function renderList() {
  const shown = trophies.filter(matchesFilters);
  listEl.replaceChildren(...shown.map(trophyCard));
  emptyEl.hidden = shown.length > 0;
  const total = trophies.length;
  resultCountEl.textContent =
    kind === 'online'
      ? 'No online trophies — all 55 are single-player, so this filter is empty by design.'
      : `Showing ${shown.length} of ${total} trophies · ${earned.size} earned` +
        (spoilerEl.checked ? ' · story spoilers hidden until earned' : '');
}

searchEl.addEventListener('input', renderList);
gradeEl.addEventListener('change', renderList);
spoilerEl.addEventListener('change', renderList);
hideEarnedEl.addEventListener('change', renderList);

// Open a guide from a link such as the missable banner's.
document.addEventListener('click', (event) => {
  const link = event.target.closest('[data-open]');
  if (!link) return;
  const id = Number(link.dataset.open);
  if (!byId.has(id)) return;
  event.preventDefault();
  openGuides.add(id);
  kind = 'all';
  for (const c of kindChipsEl.children) c.setAttribute('aria-pressed', String(c.textContent === 'All'));
  searchEl.value = '';
  renderList();
  document.getElementById(`trophy-${id}`)?.scrollIntoView({ block: 'center' });
});

// --- export, import, share link, reset -------------------------------
document.getElementById('export').addEventListener('click', () => {
  const payload = {
    app: 'gta6-trophy-guide-01',
    version: 1,
    exportedAt: new Date().toISOString(),
    earned: [...earned].sort((a, b) => a - b),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gta6-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(url);
  ioNoteEl.textContent = `Exported ${earned.size} earned trophies to gta6-trophy-progress.json.`;
});

document.getElementById('copy-link').addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}#earned=${[...earned].sort((a, b) => a - b).join(',')}`;
  try {
    await navigator.clipboard.writeText(url);
    ioNoteEl.textContent = 'Progress link copied — opening it ticks off the same trophies.';
  } catch {
    ioNoteEl.textContent = `Copy this link: ${url}`;
  }
});

document.getElementById('import').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const ids = Array.isArray(data) ? data : data.earned;
    const valid = (Array.isArray(ids) ? ids : []).map(Number).filter((n) => byId.has(n));
    earned = new Set(valid);
    saveProgress();
    renderProgress();
    renderList();
    ioNoteEl.textContent = `Imported ${valid.length} earned trophies from ${file.name}.`;
  } catch {
    ioNoteEl.textContent = 'That file could not be read as a progress export. Try exporting again from this guide.';
  }
  event.target.value = '';
});

document.getElementById('reset').addEventListener('click', () => {
  if (!earned.size) return;
  if (!confirm('Clear all earned ticks? This cannot be undone.')) return;
  earned = new Set();
  saveProgress();
  renderProgress();
  renderList();
  ioNoteEl.textContent = 'Progress cleared.';
});

// --- views: tracker / roadmap -----------------------------------------
function showView(which) {
  const roadmap = which === 'roadmap';
  trackerView.hidden = roadmap;
  roadmapView.hidden = !roadmap;
  viewTrackerBtn.classList.toggle('active', !roadmap);
  viewRoadmapBtn.classList.toggle('active', roadmap);
  viewTrackerBtn.setAttribute('aria-pressed', String(!roadmap));
  viewRoadmapBtn.setAttribute('aria-pressed', String(roadmap));
}
viewTrackerBtn.addEventListener('click', () => showView('tracker'));
viewRoadmapBtn.addEventListener('click', () => showView('roadmap'));

function renderRoadmap() {
  const stagesEl = document.getElementById('stages');
  stagesEl.replaceChildren();
  for (const stage of doc.roadmap) {
    const li = document.createElement('li');
    li.className = 'stage';
    const h = document.createElement('h3');
    h.textContent = `Stage ${stage.stage}: ${stage.title}`;
    const hours = document.createElement('span');
    hours.className = 'hours';
    hours.textContent = stage.hours;
    h.append(hours);
    const p = document.createElement('p');
    p.textContent = stage.summary;
    const chips = document.createElement('ul');
    chips.className = 'stage-trophies';
    for (const t of trophies.filter((x) => x.stage === stage.stage)) {
      const item = document.createElement('li');
      if (t.missable) item.className = 'missable-flag';
      const dot = document.createElement('span');
      dot.className = `gdot`;
      dot.style.background = t.grade === 'platinum' ? '#b8f3ff' : t.grade === 'gold' ? '#ffd23d' : t.grade === 'silver' ? '#cfd6e4' : '#e09a5f';
      item.append(dot, document.createTextNode(t.name + (t.missable ? ' — possibly missable' : '')));
      chips.append(item);
    }
    li.append(h, p, chips);
    stagesEl.append(li);
  }
}

renderProgress();
renderList();
renderRoadmap();
if (params.get('view') === 'roadmap') showView('roadmap');
if (openParam && byId.has(openParam)) {
  document.getElementById(`trophy-${openParam}`)?.scrollIntoView({ block: 'nearest' });
}
