const STORAGE_KEY = 'marathiKidsStories';
const SPEEDS = { slow: 0.75, medium: 0.9, normal: 1, fast: 1.1, turbo: 1.25 };
const DEFAULT_STATE = {
  lastStory: 1, savedStories: [], readStories: [], darkMode: false, theme: 'reading', fontSize: 'medium', readAlong: true,
  audio: { voice: '', speed: 'medium', volume: 1 }, audioProgress: {}
};
const FILTERS = [['all', 'सर्व कथा'], ['बालपण', 'बालपण'], ['स्वराज्य', 'स्वराज्य'], ['किल्ले', 'किल्ले'], ['पराक्रम', 'पराक्रम'], ['नियोजन', 'नियोजन'], ['प्रशासन', 'प्रशासन'], ['प्रेरणा', 'प्रेरणा']];
const FONT_CLASSES = { small: 'reader-small', medium: 'reader-medium', large: 'reader-large' };

let stories = [];
let state = { ...DEFAULT_STATE, audio: { ...DEFAULT_STATE.audio }, audioProgress: {} };
let currentStoryId = 1;
let currentFilter = 'all';
let currentSearch = '';
let voices = [];
let selectedVoice = null;
let segments = [];
let segmentIndex = 0;
let utterance = null;
let speechStopped = true;
let speechPaused = false;
let voiceMessage = '';
let hasMarathiVoice = false;
let speechRequestId = 0;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...DEFAULT_STATE, ...saved, audio: { ...DEFAULT_STATE.audio, ...(saved.audio || {}) }, audioProgress: { ...(saved.audioProgress || {}) } };
  } catch { return { ...DEFAULT_STATE, audio: { ...DEFAULT_STATE.audio }, audioProgress: {} }; }
}
function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Continue without persistence when storage is blocked. */ } }
function getStory(id) { return stories.find((story) => Number(story.id) === Number(id)) || stories[0]; }
function isSaved(id) { return state.savedStories.includes(Number(id)); }
function isRead(id) { return state.readStories.includes(Number(id)); }
function categoryMatches(story, filter) {
  if (filter === 'all') return true;
  const text = `${story.title} ${story.category}`;
  const words = { बालपण: 'बालपण|जिजामाता', स्वराज्य: 'स्वराज्य|राज्याभिषेक', किल्ले: 'किल्ले|गड|रायगड|राजगड|सिंहगड|प्रतापगड|सिंधुदुर्ग', पराक्रम: 'पराक्रम|सरदार|मावळे|धैर्य|लढाई', नियोजन: 'नियोजन|रणनीती|बुद्धिमत्ता|आरमार', प्रशासन: 'प्रशासन|न्याय|प्रजा|शिस्त', प्रेरणा: 'प्रेरणा|गुण|मुलांसाठी' };
  return new RegExp(words[filter] || filter).test(text);
}
function filteredStories() { const term = currentSearch.toLowerCase(); return stories.filter((story) => categoryMatches(story, currentFilter) && (!term || `${story.title} ${story.category}`.toLowerCase().includes(term))); }
function loadVoices() {
  voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  const marathi = voices.filter((voice) => (voice.lang || '').toLowerCase().startsWith('mr'));
  const maleMarathi = marathi.filter((voice) => /male|man|पुरुष|वक्ता/i.test(`${voice.name} ${voice.voiceURI}`));
  const indian = voices.filter((voice) => /^(hi|en|gu|kn|ta|te)-in/i.test(voice.lang || ''));
  selectedVoice = voices.find((voice) => voice.name === state.audio.voice) || maleMarathi[0] || marathi[0] || indian[0] || voices[0] || null;
  hasMarathiVoice = Boolean(marathi.length);
  voiceMessage = selectedVoice && !hasMarathiVoice ? 'या device/browser मध्ये थेट मराठी आवाज उपलब्ध नाही; उपलब्ध Indian voice वापरला जात आहे.' : (!selectedVoice ? 'या device/browser मध्ये आवाज उपलब्ध नाही.' : '');
  if (selectedVoice && state.audio.voice !== selectedVoice.name) { state.audio.voice = selectedVoice.name; saveState(); }
}
function splitStory(text) { return (text.match(/[^।!?]+[।!?]?/g) || [text]).map((sentence) => sentence.trim()).filter(Boolean); }
function prepareSpeech() {
  const story = getStory(currentStoryId);
  segments = [{ text: story.title, type: 'title', paragraphIndex: -1, sentenceIndex: -1 }];
  story.story.forEach((paragraph, paragraphIndex) => splitStory(paragraph).forEach((text, sentenceIndex) => segments.push({ text, type: 'story', paragraphIndex, sentenceIndex })));
  segments.push({ text: `बोध. ${story.moral}`, type: 'moral', paragraphIndex: -1, sentenceIndex: -1 });
  segments.push({ text: `आजची शिकवण. ${story.lesson}`, type: 'lesson', paragraphIndex: -1, sentenceIndex: -1 });
  segmentIndex = Math.min(state.audioProgress[String(currentStoryId)]?.segmentIndex || 0, segments.length - 1);
}
function saveAudioProgress() { state.audioProgress[String(currentStoryId)] = { segmentIndex, completed: state.audioProgress[String(currentStoryId)]?.completed || false }; saveState(); }
function storyStatus() { if (speechPaused) return '⏸ कथा थांबवली आहे'; if (!speechStopped) return '🔊 कथा सुरू आहे...'; return '▶ कथा ऐकण्यासाठी तयार'; }
function speakSegment(index) {
  if (index >= segments.length) {
    utterance = null; speechStopped = true; speechPaused = false;
    state.audioProgress[String(currentStoryId)] = { segmentIndex: segments.length, completed: true };
    if (!isRead(currentStoryId)) state.readStories.push(currentStoryId);
    saveState(); renderReader(currentStoryId, true); return;
  }
  segmentIndex = index; speechStopped = false; speechPaused = false; state.audioProgress[String(currentStoryId)] = { segmentIndex, completed: false }; saveAudioProgress(); renderReader(currentStoryId, true);
  const requestId = ++speechRequestId;
  const start = () => {
    if (requestId !== speechRequestId || speechStopped) return;
    utterance = new SpeechSynthesisUtterance(segments[index].text); utterance.lang = 'mr-IN';
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = SPEEDS[state.audio.speed] || 0.9; utterance.pitch = 1; utterance.volume = Number(state.audio.volume ?? 1);
    utterance.onend = () => { if (!speechStopped && requestId === speechRequestId) speakSegment(index + 1); };
    utterance.onerror = (event) => { if (event.error === 'canceled' || event.error === 'interrupted') return; utterance = null; speechStopped = true; speechPaused = false; saveAudioProgress(); renderReader(currentStoryId, true); };
    window.speechSynthesis.speak(utterance); window.setTimeout(scrollActiveParagraph, 80);
  };
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) { window.speechSynthesis.cancel(); window.setTimeout(start, 60); } else start();
}
function playStory() {
  if (!('speechSynthesis' in window)) { voiceMessage = 'या browser मध्ये आवाज सुविधा उपलब्ध नाही.'; renderReader(currentStoryId, true); return; }
  loadVoices();
  if (!selectedVoice) voiceMessage = 'Voice list अजून load होत आहे; browser चा default आवाज वापरला जाईल.';
  if (!segments.length) prepareSpeech(); speakSegment(segmentIndex);
}
function pauseSpeech() { if (window.speechSynthesis?.speaking) { window.speechSynthesis.pause(); speechPaused = true; saveAudioProgress(); renderReader(currentStoryId, true); } }
function resumeSpeech() {
  if (!('speechSynthesis' in window) || !selectedVoice) { playStory(); return; }
  speechStopped = false; speechPaused = false;
  if (window.speechSynthesis.paused) { window.speechSynthesis.resume(); renderReader(currentStoryId, true); return; }
  if (!window.speechSynthesis.speaking) speakSegment(segmentIndex);
}
function stopSpeech() { speechRequestId += 1; if (window.speechSynthesis) window.speechSynthesis.cancel(); speechStopped = true; speechPaused = false; utterance = null; segmentIndex = 0; if (segments.length) { state.audioProgress[String(currentStoryId)] = { segmentIndex: 0, completed: false }; saveState(); } }
function previousSegment() { const current = segmentIndex; if (current > 0) { stopSpeech(); segmentIndex = current - 1; saveAudioProgress(); renderReader(currentStoryId, true); } }
function nextSegment() { const current = segmentIndex; if (current < segments.length - 1) { stopSpeech(); segmentIndex = current + 1; saveAudioProgress(); renderReader(currentStoryId, true); } }
function setVolume(value) { state.audio.volume = Number(value); saveState(); renderReader(currentStoryId, true); }
function setReadAlong(enabled) { state.readAlong = enabled; saveState(); renderReader(currentStoryId, true); }
function scrollActiveParagraph() {
  const active = segments[segmentIndex];
  if (!state.readAlong || !active || active.paragraphIndex < 0) return;
  document.getElementById(`story-paragraph-${active.paragraphIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function setSpeed(speed) { const current = segmentIndex; state.audio.speed = speed; saveState(); if (!speechStopped) { stopSpeech(); segmentIndex = current; speakSegment(segmentIndex); } else renderReader(currentStoryId, true); }
function setFontSize(size) { state.fontSize = size; saveState(); renderReader(currentStoryId, true); }
function setTheme(theme) { state.theme = theme; state.darkMode = theme === 'dark'; document.documentElement.dataset.theme = theme; saveState(); renderCurrentView(); }

function storyCard(story) {
  return `<div class="col-12 col-sm-6 col-lg-4"><article class="story-card h-100"><div class="story-card-icon">${story.icon}</div><span class="story-category">${story.category}</span><h2>${story.title}</h2><p class="story-meta">📖 ${story.readTime} मिनिटे</p>${isRead(story.id) ? '<span class="complete-badge">✓ कथा पूर्ण</span>' : ''}<div class="story-card-actions"><button type="button" onclick="toggleSave(${story.id})" class="icon-button" aria-label="कथा आवडती करा">${isSaved(story.id) ? '♥' : '♡'}</button><button type="button" onclick="openStory(${story.id})" class="button button-primary">📖 वाचा</button><button type="button" onclick="openStory(${story.id}, true)" class="button button-secondary">🔊 ऐका</button></div></article></div>`;
}
function renderHome() {
  const last = getStory(state.lastStory) || stories[0]; const progress = stories.length ? Math.round(state.readStories.length / stories.length * 100) : 0;
  document.getElementById('app').innerHTML = `<main class="page-shell home-page"><section class="hero"><div class="hero-copy"><span class="eyebrow">🚩 मराठी कथा संग्रह</span><h1>शिवाजी महाराजांच्या<br><em>प्रेरणादायी कथा</em></h1><p>वाचा 📖 • ऐका 🔊 • शिका 🌟</p><div class="hero-stats"><span><strong>${stories.length}</strong> कथा</span><span><strong>🔊</strong> ऐकण्याची सुविधा</span><span><strong>🌟</strong> प्रेरणादायी शिकवण</span></div><button type="button" onclick="showPage('stories')" class="button button-light">कथा निवडा <span>→</span></button></div><div class="hero-emblem" aria-hidden="true">🚩</div></section><section class="continue-section"><div><span class="section-kicker">📖 पुढे वाचा</span><h2>${last.title}</h2><p>कथा ${last.id} / ${stories.length} · तुमचा वाचन प्रवास ${progress}% पूर्ण</p></div><button type="button" onclick="openStory(${last.id})" class="button button-primary">पुढे वाचा →</button></section><section class="progress-panel"><div><span>माझा वाचन प्रवास</span><strong>${state.readStories.length} / ${stories.length} कथा</strong></div><div class="progress-track"><span style="width:${progress}%"></span></div></section></main>`;
}
function renderStories() {
  const visible = currentFilter === 'favorites' ? stories.filter((story) => isSaved(story.id)) : filteredStories();
  document.getElementById('app').innerHTML = `<main class="page-shell stories-page"><header class="page-heading"><div><span class="eyebrow">📚 कथा निवडा</span><h1>शिवाजी महाराजांच्या कथा</h1><p>प्रत्येक कथेत एक सुंदर विचार आणि एक नवे स्वप्न.</p></div><button type="button" onclick="toggleTheme()" class="theme-button" aria-label="थीम बदला">${state.theme === 'dark' ? '☀️' : '🌙'}</button></header><div class="story-tools"><label class="search-box">🔎<input id="storySearch" placeholder="कथा शोधा..." value="${currentSearch}" aria-label="कथा शोधा"></label><div class="filter-row">${FILTERS.map(([id, label]) => `<button type="button" onclick="setFilter('${id}')" class="filter-button ${currentFilter === id ? 'active' : ''}">${label}</button>`).join('')}<button type="button" onclick="setFilter('favorites')" class="filter-button ${currentFilter === 'favorites' ? 'active' : ''}">♥ आवडत्या</button></div></div><div class="row g-4">${visible.map(storyCard).join('')}</div>${!visible.length ? '<div class="empty-state">ही कथा यादी अजून रिकामी आहे.</div>' : ''}</main>`;
  document.getElementById('storySearch').addEventListener('input', (event) => { currentSearch = event.target.value; renderStories(); });
}
function renderReader(id, preserve = false) {
  const story = getStory(id); if (!story) return;
  currentStoryId = Number(story.id); markRead(story.id); if (!preserve) { stopSpeech(); prepareSpeech(); } if (!segments.length || !preserve) prepareSpeech();
  const position = stories.findIndex((item) => Number(item.id) === currentStoryId); const previous = position > 0 ? stories[position - 1] : null; const next = position < stories.length - 1 ? stories[position + 1] : null;
  const activeChunk = segments[segmentIndex]; const activeParagraph = activeChunk?.paragraphIndex ?? -1; const activeSentence = activeChunk?.sentenceIndex ?? -1; const complete = state.audioProgress[String(story.id)]?.completed; const storyProgress = segments.length ? Math.round(Math.min(segmentIndex, segments.length - 1) / (segments.length - 1) * 100) : 0;
  const paragraphs = story.story.map((text, index) => `<p id="story-paragraph-${index}" class="story-paragraph">${splitStory(text).map((sentence, sentenceIndex) => `<span class="story-sentence ${state.readAlong && activeParagraph === index && activeSentence === sentenceIndex ? 'active-story-sentence' : ''}">${sentence} </span>`).join('')}</p>`).join('');
  document.getElementById('app').innerHTML = `<main class="reader-page"><div class="reader-top"><button type="button" onclick="showPage('stories')" class="back-button">← <span>मागे</span></button><span class="story-count">कथा ${position + 1} / ${stories.length}</span><button type="button" onclick="toggleSave(${story.id})" class="reader-favorite" aria-label="कथा आवडती करा">${isSaved(story.id) ? '♥' : '♡'}</button></div><article class="reader-content"><header class="reader-header"><div class="reader-icon">${story.icon}</div><h1>${story.title}</h1><span class="story-category">${story.category}</span><p>📖 ${story.readTime} मिनिटे</p></header><section class="audio-panel"><div class="audio-heading"><div><span class="section-kicker">🔊 कथा ऐका</span><h2>${storyStatus()}</h2></div><span class="voice-label">${selectedVoice ? 'मराठी आवाज' : 'आवाज तपासत आहे...'}</span></div>${voiceMessage ? `<div class="voice-warning" role="status">${voiceMessage}</div>` : ''}<div class="audio-progress"><span style="width:${storyProgress}%"></span></div><div class="audio-times"><span>${activeParagraph >= 0 ? `भाग ${activeParagraph + 1}` : 'सुरुवात'}</span><span>${storyProgress}%</span></div><div class="audio-main-controls"><button type="button" onclick="previousSegment()" class="round-control" aria-label="मागील परिच्छेद">⏮</button><button type="button" onclick="${speechPaused ? 'resumeSpeech()' : speechStopped ? 'playStory()' : 'pauseSpeech()'}" class="play-control" aria-label="कथा सुरू करा">${speechPaused || speechStopped ? '▶' : '⏸'}</button><button type="button" onclick="${speechStopped ? 'playStory()' : 'pauseSpeech()'}" class="round-control" aria-label="कथा थांबवा">${speechStopped ? '↻' : '⏸'}</button><button type="button" onclick="nextSegment()" class="round-control" aria-label="पुढील परिच्छेद">⏭</button></div><div class="audio-options"><label>🔉 <input type="range" min="0" max="1" step="0.1" value="${state.audio.volume}" onchange="setVolume(this.value)" aria-label="आवाजाची पातळी"></label><div class="speed-options">${Object.entries({ slow: '🐢 0.75x', medium: '🙂 1.0x', fast: '🚀 1.25x' }).map(([key, label]) => `<button type="button" onclick="setSpeed('${key}')" class="speed-button ${state.audio.speed === key ? 'active' : ''}">${label}</button>`).join('')}</div></div></section><div class="reader-controls"><label class="toggle-control"><input type="checkbox" ${state.readAlong ? 'checked' : ''} onchange="setReadAlong(this.checked)"><span>📖 वाचा सोबत</span></label><div class="font-controls"><span>अक्षर</span><button type="button" onclick="setFontSize('small')" class="font-button">A−</button><button type="button" onclick="setFontSize('medium')" class="font-button">A</button><button type="button" onclick="setFontSize('large')" class="font-button">A+</button></div><div class="theme-controls">${[['light','☀️'],['reading','📖'],['dark','🌙']].map(([key, icon]) => `<button type="button" onclick="setTheme('${key}')" class="theme-option ${state.theme === key ? 'active' : ''}" aria-label="${key} theme">${icon}</button>`).join('')}</div></div><div class="story-text ${FONT_CLASSES[state.fontSize] || FONT_CLASSES.medium}">${paragraphs}</div><section class="insight-card moral-card"><span>🌟</span><div><span class="section-kicker">आजचा बोध</span><p>${story.moral}</p></div></section><section class="insight-card lesson-card"><span>📚</span><div><span class="section-kicker">आजची शिकवण</span><p>${story.lesson}</p></div></section>${complete ? '<section class="completion-card"><span>🎉</span><h2>शाब्बास!</h2><p>तुम्ही ही कथा पूर्ण केली.</p><button type="button" onclick="playStory()" class="button button-light">↻ पुन्हा ऐका</button></section>' : ''}<nav class="story-navigation"><button type="button" onclick="${previous ? `openStory(${previous.id})` : 'showPage(\'stories\')'}" class="button button-outline">← मागची कथा</button><button type="button" onclick="${next ? `openStory(${next.id})` : 'showPage(\'stories\')'}" class="button button-primary">${next ? 'पुढची कथा →' : 'कथा यादी →'}</button></nav></article></main>`;
  syncAudioControls();
  if (!speechStopped && state.readAlong) window.setTimeout(scrollActiveParagraph, 30);
}
function syncAudioControls() {
  const controls = document.querySelectorAll('.audio-main-controls .round-control');
  const playButton = document.querySelector('.audio-main-controls .play-control');
  if (playButton) {
    playButton.innerHTML = `<i class="bi ${speechStopped || speechPaused ? 'bi-play-fill' : 'bi-pause-fill'}" aria-hidden="true"></i>`;
    playButton.setAttribute('aria-label', speechStopped ? 'कथा ऐका' : speechPaused ? 'कथा पुन्हा सुरू करा' : 'कथा थांबवा');
  }
  if (controls[0]) { controls[0].innerHTML = '<i class="bi bi-skip-backward-fill" aria-hidden="true"></i>'; controls[0].setAttribute('aria-label', 'मागील वाक्य'); }
  if (controls[1]) {
    controls[1].innerHTML = `<i class="bi ${speechStopped ? 'bi-arrow-repeat' : 'bi-stop-fill'}" aria-hidden="true"></i>`;
    controls[1].setAttribute('aria-label', speechStopped ? 'कथा पुन्हा ऐका' : 'कथा पूर्णपणे थांबवा');
  }
  if (controls[2]) { controls[2].innerHTML = '<i class="bi bi-skip-forward-fill" aria-hidden="true"></i>'; controls[2].setAttribute('aria-label', 'पुढील वाक्य'); }
  const speedOptions = document.querySelector('.speed-options');
  if (speedOptions) speedOptions.innerHTML = Object.entries({ slow: '🐢 0.75x', medium: '🙂 0.9x', normal: '1.0x', fast: '🚀 1.1x', turbo: '⚡ 1.25x' }).map(([key, label]) => `<button type="button" onclick="setSpeed('${key}')" class="speed-button ${state.audio.speed === key ? 'active' : ''}">${label}</button>`).join('');
}
function markRead(id) { if (!state.readStories.includes(Number(id))) state.readStories.push(Number(id)); state.lastStory = Number(id); saveState(); }
function toggleSave(id) { const value = Number(id); state.savedStories = isSaved(value) ? state.savedStories.filter((item) => item !== value) : [...state.savedStories, value]; saveState(); renderCurrentView(); }
function setFilter(filter) { currentFilter = filter; currentSearch = ''; renderStories(); }
function renderCurrentView() { const params = new URLSearchParams(location.search); if (params.get('story')) renderReader(Number(params.get('story')), true); else if (location.hash === '#stories') renderStories(); else if (location.hash === '#saved') { currentFilter = 'favorites'; renderStories(); } else renderHome(); }
function showPage(page) { stopSpeech(); history.pushState({}, '', page === 'home' ? './' : `#${page}`); if (page === 'home') renderHome(); else renderStories(); }
function openStory(id, listen = false) { stopSpeech(); currentStoryId = Number(id); segments = []; segmentIndex = 0; history.pushState({}, '', `?story=${currentStoryId}`); markRead(currentStoryId); renderReader(currentStoryId); if (listen) window.setTimeout(playStory, 100); }
function toggleTheme() { setTheme(state.theme === 'dark' ? 'reading' : 'dark'); }
async function initializeApp() {
  state = loadState(); state.theme = state.theme || (state.darkMode ? 'dark' : 'reading'); document.documentElement.dataset.theme = state.theme;
  try {
    const response = await fetch('./data/stories.json'); if (!response.ok) throw new Error('stories unavailable');
    const loaded = await response.json(); if (!Array.isArray(loaded)) throw new Error('invalid stories');
    stories = loaded.filter((story, index, list) => list.findIndex((item) => Number(item.id) === Number(story.id)) === index).slice(0, 150);
    if (!stories.length) throw new Error('empty stories');
    if (!getStory(state.lastStory)) state.lastStory = stories[0].id;
    loadVoices(); renderCurrentView();
  } catch {
    document.getElementById('app').innerHTML = '<main class="page-shell"><section class="empty-state"><h1>कथा उघडता आली नाही</h1><p>कृपया internet connection तपासा आणि page पुन्हा उघडा.</p><button type="button" class="button button-primary" onclick="location.reload()">पुन्हा प्रयत्न करा</button></section></main>';
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
window.showPage = showPage; window.openStory = openStory; window.toggleSave = toggleSave; window.toggleTheme = toggleTheme; window.setFilter = setFilter; window.playStory = playStory; window.pauseSpeech = pauseSpeech; window.resumeSpeech = resumeSpeech; window.stopSpeech = stopSpeech; window.previousSegment = previousSegment; window.nextSegment = nextSegment; window.setVolume = setVolume; window.setReadAlong = setReadAlong; window.setSpeed = setSpeed; window.setFontSize = setFontSize; window.setTheme = setTheme;
window.addEventListener('popstate', renderCurrentView); window.addEventListener('beforeunload', saveAudioProgress); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveAudioProgress(); });
document.addEventListener('click', (event) => {
  const button = event.target.closest?.('.audio-main-controls .round-control');
  if (!button) return;
  const controls = button.parentElement.querySelectorAll('.round-control');
  if (button !== controls[1]) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (speechStopped) openStory(currentStoryId, true); else { stopSpeech(); renderReader(currentStoryId, true); }
}, true);
if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = loadVoices;
document.addEventListener('DOMContentLoaded', initializeApp);
