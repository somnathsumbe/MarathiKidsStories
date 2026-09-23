const STORAGE_KEY = 'marathiKidsStories';
const SPEEDS = { slow: 0.75, medium: 0.9, normal: 1, fast: 1.1, turbo: 1.25 };
const DEFAULT_STATE = {
  lastStory: 1, savedStories: [], readStories: [], darkMode: false, theme: 'reading', fontSize: 'medium', readAlong: true,
  audio: { voice: '', speed: 'medium', volume: 1 }, audioProgress: {}
};
const COLLECTIONS = {
  shivaji: { label: 'शिवाजी महाराज', file: './data/stories.json', filters: [['all', 'सर्व कथा'], ['बालपण', 'बालपण'], ['स्वराज्य', 'स्वराज्य'], ['किल्ले', 'किल्ले'], ['पराक्रम', 'पराक्रम'], ['नियोजन', 'नियोजन'], ['प्रशासन', 'प्रशासन'], ['प्रेरणा', 'प्रेरणा']] },
  mahabharat: { label: 'महाभारत', file: './data/mahabharat.json', filters: [['all', 'सर्व कथा'], ['महाभारत', 'महाभारत'], ['पांडव', 'पांडव'], ['कौरव', 'कौरव'], ['कुरुवंश', 'कुरुवंश'], ['कुरुक्षेत्र युद्ध', 'कुरुक्षेत्र युद्ध'], ['श्रीकृष्ण', 'श्रीकृष्ण'], ['उपकथा', 'उपकथा']] },
  ramayan: { label: 'रामायण', file: './data/ramayan.json', filters: [['all', 'सर्व कथा'], ['बालकांड', 'बालकांड'], ['अयोध्याकांड', 'अयोध्याकांड'], ['अरण्यकांड', 'अरण्यकांड'], ['किष्किंधाकांड', 'किष्किंधाकांड'], ['सुंदरकांड', 'सुंदरकांड'], ['युद्धकांड', 'युद्धकांड'], ['उत्तरकांड', 'उत्तरकांड']] },
  gita: { label: 'भगवद्गीता अध्याय', file: './data/gita.json', filters: [['all', 'सर्व अध्याय'], ['अध्याय १', 'अध्याय १'], ['अध्याय २', 'अध्याय २'], ['अध्याय ३', 'अध्याय ३'], ['अध्याय ४', 'अध्याय ४'], ['अध्याय ५', 'अध्याय ५'], ['अध्याय ६', 'अध्याय ६'], ['अध्याय ७', 'अध्याय ७'], ['अध्याय ८', 'अध्याय ८'], ['अध्याय ९', 'अध्याय ९'], ['अध्याय १०', 'अध्याय १०'], ['अध्याय ११', 'अध्याय ११'], ['अध्याय १२', 'अध्याय १२'], ['अध्याय १३', 'अध्याय १३'], ['अध्याय १४', 'अध्याय १४'], ['अध्याय १५', 'अध्याय १५'], ['अध्याय १६', 'अध्याय १६'], ['अध्याय १७', 'अध्याय १७'], ['अध्याय १८', 'अध्याय १८']] }
};
const FONT_CLASSES = { small: 'reader-small', medium: 'reader-medium', large: 'reader-large' };

let stories = [];
let activeCollection = 'shivaji';
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
function collectionConfig() { return COLLECTIONS[activeCollection]; }
function isSaved(id) { return state.savedStories.includes(Number(id)); }
function isRead(id) { return state.readStories.includes(Number(id)); }
function categoryMatches(story, filter) {
  if (filter === 'all') return true;
  const text = `${story.title} ${story.category}`;
  const words = { बालपण: 'बालपण|जिजामाता', स्वराज्य: 'स्वराज्य|राज्याभिषेक', किल्ले: 'किल्ले|गड|रायगड|राजगड|सिंहगड|प्रतापगड|सिंधुदुर्ग', पराक्रम: 'पराक्रम|सरदार|मावळे|धैर्य|लढाई', नियोजन: 'नियोजन|रणनीती|बुद्धिमत्ता|आरमार', प्रशासन: 'प्रशासन|न्याय|प्रजा|शिस्त', प्रेरणा: 'प्रेरणा|गुण|मुलांसाठी', महाभारत: 'महाभारत', पांडव: 'पांडव', कौरव: 'कौरव', कुरुवंश: 'कुरुवंश', 'कुरुक्षेत्र युद्ध': 'कुरुक्षेत्र युद्ध', श्रीकृष्ण: 'श्रीकृष्ण', उपकथा: 'उपकथा' };
  return new RegExp(words[filter] || filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(text);
}
function filteredStories() { const term = currentSearch.toLowerCase(); return stories.filter((story) => categoryMatches(story, currentFilter) && (!term || `${story.title} ${story.category}`.toLowerCase().includes(term))); }
function loadVoices() {
  voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  const selection = window.MarathiSpeechEngine?.findVoice(voices, state.audio.voice) || { voice: voices[0] || null, hasMarathiVoice: false };
  selectedVoice = selection.voice;
  hasMarathiVoice = selection.hasMarathiVoice;
  voiceMessage = selectedVoice && !hasMarathiVoice ? 'या device/browser मध्ये थेट मराठी आवाज उपलब्ध नाही; उपलब्ध Indian voice वापरला जात आहे.' : (!selectedVoice ? 'या device/browser मध्ये आवाज उपलब्ध नाही.' : '');
  if (selectedVoice && state.audio.voice !== selectedVoice.name) { state.audio.voice = selectedVoice.name; saveState(); }
}
function splitStory(text) { return window.MarathiSpeechEngine?.split(text) || [String(text).trim()]; }
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
function syncNavigation() {
  const page = new URLSearchParams(location.search).has('story') ? 'reader' : location.hash === '#saved' ? 'saved' : location.hash === '#stories' ? 'stories' : 'home';
  document.querySelectorAll('.nav-button').forEach((button, index) => button.classList.toggle('active', page === ['home', 'stories', 'saved', 'more'][index]));
}

function storyCard(story) {
  return `<div class="col-12 col-sm-6 col-lg-4"><article class="story-card h-100"><div class="story-card-icon">${story.icon}</div><span class="story-category">${story.category}</span><h2>${story.title}</h2><p class="story-meta">📖 ${story.readTime} मिनिटे</p>${isRead(story.id) ? '<span class="complete-badge">✓ कथा पूर्ण</span>' : ''}<div class="story-card-actions"><button type="button" onclick="toggleSave(${story.id})" class="icon-button" aria-label="कथा आवडती करा">${isSaved(story.id) ? '♥' : '♡'}</button><button type="button" onclick="openStory(${story.id})" class="button button-primary">📖 वाचा</button><button type="button" onclick="openStory(${story.id}, true)" class="button button-secondary">🔊 ऐका</button></div></article></div>`;
}
function renderHome() {
  if (!stories.length) { document.getElementById('app').innerHTML = '<main class="page-shell"><section class="empty-state"><h1>या संग्रहात कथा उपलब्ध नाहीत.</h1><button type="button" class="button button-primary" onclick="showCollection(\'shivaji\')">शिवाजी महाराज कथा उघडा</button></section></main>'; return; }
  const last = getStory(state.lastStory) || stories[0]; const progress = stories.length ? Math.round(state.readStories.length / stories.length * 100) : 0; const config = collectionConfig();
  document.getElementById('app').innerHTML = `<main class="page-shell home-page"><section class="hero"><div class="hero-copy"><span class="eyebrow">📖 मराठी कथा संग्रह</span><h1>${config.label}च्या<br><em>प्रेरणादायी कथा</em></h1><p>वाचा 📖 • ऐका 🔊 • शिका 🌟</p><div class="hero-stats"><span><strong>${stories.length}</strong> कथा</span><span><strong>🔊</strong> ऐकण्याची सुविधा</span><span><strong>🌟</strong> प्रेरणादायी शिकवण</span></div><button type="button" onclick="showPage('stories')" class="button button-light">कथा निवडा <span>→</span></button></div><div class="hero-emblem" aria-hidden="true">📖</div></section><section class="continue-section"><div><span class="section-kicker">📖 पुढे वाचा</span><h2>${last.title}</h2><p>कथा ${last.id} / ${stories.length} · तुमचा वाचन प्रवास ${progress}% पूर्ण</p></div><button type="button" onclick="openStory(${last.id})" class="button button-primary">पुढे वाचा →</button></section><section class="progress-panel"><div><span>माझा वाचन प्रवास</span><strong>${state.readStories.length} / ${stories.length} कथा</strong></div><div class="progress-track"><span style="width:${progress}%"></span></div></section></main>`;
}
function enhanceHome() {
  const home = document.querySelector('.home-page');
  if (!home || home.querySelector('.home-greeting')) return;
  const greeting = document.createElement('section');
  greeting.className = 'home-greeting';
  greeting.innerHTML = '<span class="section-kicker">नमस्कार 👋</span><h2>आजची गोष्ट ऐकूया का? 🎧</h2><p>तुमच्या मनाला धैर्य देणारी एक कथा निवडा.</p>';
  home.prepend(greeting);
  const categories = document.createElement('section');
  categories.className = 'home-categories';
  const filters = collectionConfig().filters;
  categories.innerHTML = `<span class="section-kicker">कथा प्रकार</span><div class="home-category-grid">${filters.slice(1, 7).map(([id, label], index) => `<button type="button" class="home-category" onclick="setFilter('${id}'); showPage('stories')">${['🌟', '🚩', '🦁', '📚', '👧', '🏰'][index]} ${label}<span>कथा पाहा →</span></button>`).join('')}</div>`;
  home.insertBefore(categories, home.querySelector('.continue-section'));
}
function renderStories() {
  const visible = currentFilter === 'favorites' ? stories.filter((story) => isSaved(story.id)) : filteredStories();
  const config = collectionConfig();
  document.getElementById('app').innerHTML = `<main class="page-shell stories-page"><header class="page-heading"><div><span class="eyebrow">📚 कथा निवडा</span><h1>${config.label} कथा</h1><p>कथेच्या title वरून कथा ओळखा, उघडा आणि ऐका.</p></div><button type="button" onclick="toggleTheme()" class="theme-button" aria-label="थीम बदला">${state.theme === 'dark' ? '☀️' : '🌙'}</button></header><div class="collection-tabs">${Object.entries(COLLECTIONS).map(([id, item]) => `<button type="button" onclick="showCollection('${id}')" class="filter-button ${activeCollection === id ? 'active' : ''}">${item.label}</button>`).join('')}</div><div class="story-tools"><label class="search-box">🔎<input id="storySearch" placeholder="कथा title शोधा..." value="${currentSearch}" aria-label="कथा title शोधा"></label><div class="filter-row">${config.filters.map(([id, label]) => `<button type="button" onclick="setFilter('${id}')" class="filter-button ${currentFilter === id ? 'active' : ''}">${label}</button>`).join('')}<button type="button" onclick="setFilter('favorites')" class="filter-button ${currentFilter === 'favorites' ? 'active' : ''}">♥ आवडत्या</button></div></div><div class="row g-4">${visible.map(storyCard).join('')}</div>${!visible.length ? '<div class="empty-state">या संग्रहात कथा उपलब्ध नाहीत. JSON फाइलमध्ये कथा जोडा.</div>' : ''}</main>`;
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
async function showCollection(collection) {
  if (!COLLECTIONS[collection] || collection === activeCollection && stories.length) { renderStories(); return; }
  stopSpeech(); activeCollection = collection; currentFilter = 'all'; currentSearch = ''; stories = [];
  try {
    const response = await fetch(COLLECTIONS[collection].file); if (!response.ok) throw new Error('collection unavailable');
    const loaded = await response.json(); if (!Array.isArray(loaded)) throw new Error('invalid collection');
    stories = loaded.filter((story, index, list) => list.findIndex((item) => Number(item.id) === Number(story.id)) === index);
    renderStories();
  } catch { renderStories(); }
}
function renderCurrentView() { const params = new URLSearchParams(location.search); if (params.get('story')) renderReader(Number(params.get('story')), true); else if (location.hash === '#stories') renderStories(); else if (location.hash === '#saved') { currentFilter = 'favorites'; renderStories(); } else { renderHome(); enhanceHome(); } }
function showPage(page) { stopSpeech(); history.pushState({}, '', page === 'home' ? './' : `#${page}`); if (page === 'home') { renderHome(); enhanceHome(); } else { if (page === 'saved') currentFilter = 'favorites'; renderStories(); } syncNavigation(); }
function openStory(id, listen = false) { stopSpeech(); currentStoryId = Number(id); segments = []; segmentIndex = 0; history.pushState({}, '', `?story=${currentStoryId}`); markRead(currentStoryId); renderReader(currentStoryId); if (listen) window.setTimeout(playStory, 100); }
function toggleTheme() { setTheme(state.theme === 'dark' ? 'reading' : 'dark'); }
async function initializeApp() {
  state = loadState(); state.theme = state.theme || (state.darkMode ? 'dark' : 'reading'); document.documentElement.dataset.theme = state.theme;
  try {
    const response = await fetch('./data/stories.json'); if (!response.ok) throw new Error('stories unavailable');
    const loaded = await response.json(); if (!Array.isArray(loaded)) throw new Error('invalid stories');
    stories = loaded.filter((story, index, list) => list.findIndex((item) => Number(item.id) === Number(story.id)) === index);
    if (!stories.length) throw new Error('empty stories');
    if (!getStory(state.lastStory)) state.lastStory = stories[0].id;
    loadVoices(); renderCurrentView(); syncNavigation();
  } catch {
    document.getElementById('app').innerHTML = '<main class="page-shell"><section class="empty-state"><h1>कथा उघडता आली नाही</h1><p>कृपया internet connection तपासा आणि page पुन्हा उघडा.</p><button type="button" class="button button-primary" onclick="location.reload()">पुन्हा प्रयत्न करा</button></section></main>';
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
window.showPage = showPage; window.openStory = openStory; window.toggleSave = toggleSave; window.toggleTheme = toggleTheme; window.setFilter = setFilter; window.showCollection = showCollection; window.playStory = playStory; window.pauseSpeech = pauseSpeech; window.resumeSpeech = resumeSpeech; window.stopSpeech = stopSpeech; window.previousSegment = previousSegment; window.nextSegment = nextSegment; window.setVolume = setVolume; window.setReadAlong = setReadAlong; window.setSpeed = setSpeed; window.setFontSize = setFontSize; window.setTheme = setTheme;
window.addEventListener('popstate', () => { renderCurrentView(); syncNavigation(); }); window.addEventListener('beforeunload', saveAudioProgress); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveAudioProgress(); });
document.addEventListener('click', (event) => {
  const button = event.target.closest?.('.audio-main-controls .round-control');
  if (!button) return;
  const controls = button.parentElement.querySelectorAll('.round-control');
  if (button !== controls[1]) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (speechStopped) openStory(currentStoryId, true); else { stopSpeech(); renderReader(currentStoryId, true); }
}, true);
if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = loadVoices;
/* Collection-aware application layer. */
const COLLECTION_ORDER = Object.keys(COLLECTIONS);
let collectionData = {};
let playbackMode = 'single';
let continuousStartChoice = 'current';
let collectionComplete = false;

function scopedKey(collectionId, storyId) { return `${collectionId}:${Number(storyId)}`; }
function migrateStateV2() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch {}
  const migrated = { ...DEFAULT_STATE, ...saved, savedStories: [], readStories: [], audioProgress: {}, collection: saved.collection || 'shivaji', story: saved.story || saved.lastStory || 1, playbackMode: saved.playbackMode || 'single', audio: { ...DEFAULT_STATE.audio, ...(saved.audio || {}) } };
  const fallbackCollection = 'shivaji';
  const toScoped = (items, collectionId = fallbackCollection) => (items || []).map((item) => String(item).includes(':') ? String(item) : scopedKey(collectionId, item));
  migrated.savedStories = toScoped(saved.savedStories);
  migrated.readStories = toScoped(saved.readStories);
  Object.entries(saved.audioProgress || {}).forEach(([key, value]) => { migrated.audioProgress[key.includes(':') ? key : scopedKey(fallbackCollection, key)] = value; });
  saveStateV2(migrated);
  return migrated;
}
function saveStateV2(next = state) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {} }
function activeStoryKey(id = currentStoryId) { return scopedKey(activeCollection, id); }
function isSavedV2(id) { return state.savedStories.includes(activeStoryKey(id)); }
function isReadV2(id) { return state.readStories.includes(activeStoryKey(id)); }
function progressFor(id = currentStoryId) { return state.audioProgress[scopedKey(activeCollection, id)] || { segmentIndex: 0, completed: false }; }
function markReadV2(id) { const key = activeStoryKey(id); if (!state.readStories.includes(key)) state.readStories.push(key); state.collection = activeCollection; state.story = Number(id); saveStateV2(); }
function toggleSaveV2(id) { const key = activeStoryKey(id); state.savedStories = isSavedV2(id) ? state.savedStories.filter((item) => item !== key) : [...state.savedStories, key]; saveStateV2(); renderCurrentV2(); }
function loadCollectionV2(collectionId) { stories = collectionData[collectionId] || []; activeCollection = collectionId; currentFilter = 'all'; currentSearch = ''; }
function collectionStories(collectionId) { return collectionData[collectionId] || []; }

function renderHomeV2() {
  const cards = COLLECTION_ORDER.map((id) => { const config = COLLECTIONS[id]; const count = collectionStories(id).length; return `<button type="button" class="collection-card" onclick="showCollection('${id}')"><span class="collection-card-icon">${id === 'shivaji' ? '🚩' : id === 'mahabharat' ? '⚔️' : id === 'ramayan' ? '🏹' : '🕉️'}</span><span class="collection-card-copy"><strong>${config.label}</strong><small>${count} ${id === 'gita' ? 'अध्याय' : 'कथा'}</small></span><span class="collection-card-action">कथा पाहा →</span></button>`; }).join('');
  document.getElementById('app').innerHTML = `<main class="page-shell home-page"><section class="hero"><div class="hero-copy"><span class="eyebrow">📚 मराठी कथा संग्रह</span><h1>तुमच्या आवडत्या<br><em>कथा आणि अध्याय</em></h1><p>वाचा 📖 • ऐका 🔊 • शिका 🌟</p><div class="hero-stats"><span><strong>${Object.values(collectionData).reduce((total, list) => total + list.length, 0)}</strong> कथा</span><span><strong>🔊</strong> ऐकण्याची सुविधा</span><span><strong>🌟</strong> शिकवण</span></div></div><div class="hero-emblem" aria-hidden="true">📖</div></section><section class="collection-section"><span class="section-kicker">कथा संग्रह निवडा</span><h2>आज काय वाचूया?</h2><div class="collection-grid">${cards}</div></section></main>`;
}
function storyCardV2(story) { return `<div class="story-card-wrap"><article class="story-card h-100"><div class="story-card-icon">${story.icon}</div><span class="story-category">${story.category}</span><h2>${story.title}</h2><p class="story-meta">📖 ${story.readTime} मिनिटे</p>${isReadV2(story.id) ? '<span class="complete-badge">✓ कथा पूर्ण</span>' : ''}<div class="story-card-actions"><button type="button" onclick="toggleSaveV2(${story.id})" class="icon-button" aria-label="कथा आवडती करा">${isSavedV2(story.id) ? '♥' : '♡'}</button><button type="button" onclick="openStoryV2(${story.id})" class="button button-primary">📖 वाचा</button><button type="button" onclick="openStoryV2(${story.id}, true)" class="button button-secondary">🔊 ऐका</button></div></article></div>`; }
function renderStoriesV2() {
  const config = COLLECTIONS[activeCollection]; const list = currentFilter === 'favorites' ? stories.filter((story) => isSavedV2(story.id)) : stories.filter((story) => categoryMatches(story, currentFilter) && (!currentSearch || `${story.title} ${story.category}`.toLowerCase().includes(currentSearch.toLowerCase())));
  document.getElementById('app').innerHTML = `<main class="page-shell stories-page"><header class="page-heading"><div><span class="eyebrow">📚 ${config.label}</span><h1>${config.label}</h1><p>${stories.length} ${activeCollection === 'gita' ? 'अध्याय' : 'कथा'} • title वरून शोधा</p></div><button type="button" onclick="toggleTheme()" class="theme-button" aria-label="थीम बदला">${state.theme === 'dark' ? '☀️' : '🌙'}</button></header><div class="collection-tabs">${COLLECTION_ORDER.map((id) => `<button type="button" onclick="showCollection('${id}')" class="filter-button ${activeCollection === id ? 'active' : ''}">${COLLECTIONS[id].label}</button>`).join('')}</div><div class="story-tools"><label class="search-box">🔎<input id="storySearch" placeholder="कथा किंवा अध्याय शोधा..." value="${currentSearch}" aria-label="कथा किंवा अध्याय शोधा"></label><div class="filter-row">${config.filters.map(([id, label]) => `<button type="button" onclick="setFilterV2('${id}')" class="filter-button ${currentFilter === id ? 'active' : ''}">${label}</button>`).join('')}<button type="button" onclick="setFilterV2('favorites')" class="filter-button ${currentFilter === 'favorites' ? 'active' : ''}">♥ आवडत्या</button></div></div><div class="row g-4">${list.map(storyCardV2).join('')}</div>${!list.length ? '<div class="empty-state">या संग्रहात जुळणाऱ्या कथा नाहीत.</div>' : ''}</main>`;
  document.getElementById('storySearch')?.addEventListener('input', (event) => { currentSearch = event.target.value; renderStoriesV2(); });
}
function setFilterV2(filter) { currentFilter = filter; currentSearch = ''; renderStoriesV2(); }
function prepareSpeechV2() { const story = getStoryV2(currentStoryId); segments = [{ text: story.title, type: 'title', paragraphIndex: -1, sentenceIndex: -1 }]; story.story.forEach((paragraph, paragraphIndex) => splitStory(paragraph).forEach((text, sentenceIndex) => segments.push({ text, type: 'story', paragraphIndex, sentenceIndex }))); segments.push({ text: `बोध. ${story.moral}`, type: 'moral', paragraphIndex: -1, sentenceIndex: -1 }); segments.push({ text: `आजची शिकवण. ${story.lesson}`, type: 'lesson', paragraphIndex: -1, sentenceIndex: -1 }); segmentIndex = Math.min(progressFor().segmentIndex || 0, segments.length - 1); }
function getStoryV2(id) { return stories.find((story) => Number(story.id) === Number(id)) || stories[0]; }
function saveProgressV2(completed = false) { state.audioProgress[activeStoryKey()] = { segmentIndex, completed }; state.collection = activeCollection; state.story = currentStoryId; state.playbackMode = playbackMode; saveStateV2(); }
function stopSpeechV2(reset = false) { speechRequestId += 1; if (window.speechSynthesis) window.speechSynthesis.cancel(); speechStopped = true; speechPaused = false; utterance = null; if (reset) { segmentIndex = 0; saveProgressV2(false); } }
function completeStoryV2() { saveProgressV2(true); if (!isReadV2(currentStoryId)) state.readStories.push(activeStoryKey()); saveStateV2(); if (playbackMode === 'collection' && currentStoryIndexV2() < stories.length - 1) { openStoryV2(stories[currentStoryIndexV2() + 1].id, true); } else { speechStopped = true; collectionComplete = playbackMode === 'collection'; renderReaderV2(currentStoryId, true); } }
function currentStoryIndexV2() { return stories.findIndex((story) => Number(story.id) === Number(currentStoryId)); }
function speakSegmentV2(index) { if (index >= segments.length) { completeStoryV2(); return; } segmentIndex = index; speechStopped = false; speechPaused = false; saveProgressV2(false); renderReaderV2(currentStoryId, true); const requestId = ++speechRequestId; const start = () => { if (requestId !== speechRequestId || speechStopped) return; utterance = new SpeechSynthesisUtterance(segments[index].text); utterance.lang = 'mr-IN'; if (selectedVoice) utterance.voice = selectedVoice; utterance.rate = SPEEDS[state.audio.speed] || .9; utterance.volume = Number(state.audio.volume ?? 1); utterance.onend = () => { if (requestId === speechRequestId && !speechStopped) speakSegmentV2(index + 1); }; utterance.onerror = (event) => { if (requestId !== speechRequestId || event.error === 'canceled' || event.error === 'interrupted') return; speechStopped = true; voiceMessage = 'आवाज थांबला आहे. पुन्हा ऐका बटण दाबा.'; renderReaderV2(currentStoryId, true); }; window.speechSynthesis.speak(utterance); window.setTimeout(scrollActiveParagraph, 80); }; if (window.speechSynthesis.speaking || window.speechSynthesis.pending) { window.speechSynthesis.cancel(); window.setTimeout(start, 60); } else start(); }
function playStoryV2() { if (!('speechSynthesis' in window)) { voiceMessage = 'या browser मध्ये आवाज सुविधा उपलब्ध नाही.'; renderReaderV2(currentStoryId, true); return; } loadVoices(); if (!segments.length) prepareSpeechV2(); speakSegmentV2(segmentIndex); }
function pauseSpeechV2() { if (window.speechSynthesis?.speaking) { window.speechSynthesis.pause(); speechPaused = true; saveProgressV2(false); renderReaderV2(currentStoryId, true); } }
function resumeSpeechV2() { if (window.speechSynthesis?.paused) { speechStopped = false; speechPaused = false; window.speechSynthesis.resume(); renderReaderV2(currentStoryId, true); } else playStoryV2(); }
function togglePlaybackModeV2(mode) { playbackMode = mode; state.playbackMode = mode; saveStateV2(); renderReaderV2(currentStoryId, true); }
function startCollectionV2(start) { playbackMode = 'collection'; state.playbackMode = 'collection'; const story = start === 'first' ? stories[0] : getStoryV2(currentStoryId); if (story) { saveStateV2(); openStoryV2(story.id, true); } }
function ensureCollectionStartActionsV2() { const modes = document.querySelector('.playback-modes'); if (!modes || playbackMode !== 'collection' || modes.querySelector('.collection-start-actions')) return; const actions = document.createElement('div'); actions.className = 'collection-start-actions'; actions.innerHTML = '<button type="button" class="button button-outline">सध्याच्या कथेपासून</button><button type="button" class="button button-primary">पहिल्या कथेपासून</button>'; actions.children[0].addEventListener('click', () => startCollectionV2('current')); actions.children[1].addEventListener('click', () => startCollectionV2('first')); modes.appendChild(actions); }
function renderReaderV2(id, preserve = false) { const story = getStoryV2(id); if (!story) return; currentStoryId = Number(story.id); markReadV2(story.id); if (!preserve) { stopSpeechV2(true); segments = []; prepareSpeechV2(); collectionComplete = false; } else if (!segments.length) prepareSpeechV2(); const position = currentStoryIndexV2(); const active = segments[segmentIndex]; const progress = segments.length ? Math.round(Math.min(segmentIndex, segments.length - 1) / Math.max(1, segments.length - 1) * 100) : 0; const paragraphs = story.story.map((text, index) => `<p id="story-paragraph-${index}" class="story-paragraph">${splitStory(text).map((sentence, sentenceIndex) => `<span class="story-sentence ${state.readAlong && active?.paragraphIndex === index && active?.sentenceIndex === sentenceIndex ? 'active-story-sentence' : ''}">${sentence} </span>`).join('')}</p>`).join(''); document.getElementById('app').innerHTML = `<main class="reader-page"><div class="reader-top"><button type="button" onclick="showPageV2('stories')" class="back-button">← <span>मागे</span></button><span class="story-count">${COLLECTIONS[activeCollection].label} · ${position + 1} / ${stories.length}</span><button type="button" onclick="toggleSaveV2(${story.id})" class="reader-favorite" aria-label="कथा आवडती करा">${isSavedV2(story.id) ? '♥' : '♡'}</button></div><article class="reader-content"><header class="reader-header"><div class="reader-icon">${story.icon}</div><h1>${story.title}</h1><span class="story-category">${story.category}</span><p>📖 ${story.readTime} मिनिटे</p></header><section class="audio-panel"><div class="audio-heading"><div><span class="section-kicker">🔊 ऐकण्याची स्थिती</span><h2>${collectionComplete ? 'संपूर्ण संग्रह पूर्ण झाला' : speechPaused ? 'कथा थांबवली आहे' : speechStopped ? 'पुढे ऐकण्यासाठी तयार' : 'कथा सुरू आहे...'}</h2></div><span class="voice-label">${selectedVoice ? (hasMarathiVoice ? 'मराठी आवाज' : 'fallback voice') : 'आवाज उपलब्ध नाही'}</span></div>${voiceMessage ? `<div class="voice-warning" role="status">${voiceMessage}</div>` : ''}<div class="audio-progress"><span style="width:${progress}%"></span></div><div class="audio-times"><span>कथा ${position + 1} / ${stories.length}</span><span>${progress}%</span></div><div class="playback-modes"><label><input type="radio" name="playbackMode" value="single" ${playbackMode === 'single' ? 'checked' : ''} onchange="togglePlaybackModeV2(this.value)"> फक्त ही कथा ऐका</label><label><input type="radio" name="playbackMode" value="collection" ${playbackMode === 'collection' ? 'checked' : ''} onchange="togglePlaybackModeV2(this.value)"> संपूर्ण संग्रह सलग ऐका</label></div><div class="audio-main-controls"><button type="button" onclick="previousStoryV2()" class="round-control" aria-label="मागील कथा">⏮</button><button type="button" onclick="${speechPaused ? 'resumeSpeechV2()' : speechStopped ? 'playStoryV2()' : 'pauseSpeechV2()'}" class="play-control" aria-label="कथा ऐका">${speechPaused || speechStopped ? '▶' : '⏸'}</button><button type="button" onclick="stopSpeechV2(true); renderReaderV2(currentStoryId, true)" class="round-control" aria-label="कथा थांबवा">■</button><button type="button" onclick="nextStoryV2()" class="round-control" aria-label="पुढील कथा">⏭</button></div><div class="audio-options"><label>🔉 <input type="range" min="0" max="1" step="0.1" value="${state.audio.volume}" onchange="setVolumeV2(this.value)" aria-label="आवाजाची पातळी"></label><div class="speed-options">${Object.entries({ slow: '0.75x', medium: '0.9x', normal: '1.0x', fast: '1.1x', turbo: '1.25x' }).map(([key, label]) => `<button type="button" onclick="setSpeedV2('${key}')" class="speed-button ${state.audio.speed === key ? 'active' : ''}">${label}</button>`).join('')}</div></div></section><section class="story-text ${FONT_CLASSES[state.fontSize] || FONT_CLASSES.medium}">${paragraphs}</section><div class="story-navigation"><button type="button" class="button button-outline" onclick="previousStoryV2()" ${position <= 0 ? 'disabled' : ''}>← मागील कथा</button><button type="button" class="button button-primary" onclick="nextStoryV2()" ${position >= stories.length - 1 ? 'disabled' : ''}>पुढील कथा →</button></div></article></main>`; if (!speechStopped && state.readAlong) window.setTimeout(scrollActiveParagraph, 30); }
function setVolumeV2(value) { state.audio.volume = Number(value); saveStateV2(); renderReaderV2(currentStoryId, true); }
function setSpeedV2(speed) { state.audio.speed = speed; saveStateV2(); if (!speechStopped) { const current = segmentIndex; stopSpeechV2(false); segmentIndex = current; speakSegmentV2(segmentIndex); } else renderReaderV2(currentStoryId, true); }
function toggleThemeV2() { state.theme = state.theme === 'dark' ? 'reading' : 'dark'; state.darkMode = state.theme === 'dark'; document.documentElement.dataset.theme = state.theme; saveStateV2(); renderCurrentV2(); }
function showPageV2(page) { stopSpeechV2(false); history.pushState({}, '', page === 'home' ? './' : `#${page}`); if (page === 'home') renderHomeV2(); else renderStoriesV2(); syncNavigation(); }
function openStoryV2(id, listen = false) { stopSpeechV2(true); collectionComplete = false; currentStoryId = Number(id); state.collection = activeCollection; state.story = currentStoryId; state.playbackMode = playbackMode; saveStateV2(); history.pushState({}, '', `?collection=${activeCollection}&story=${currentStoryId}`); segments = []; renderReaderV2(currentStoryId); if (listen) window.setTimeout(playStoryV2, 120); }
function previousStoryV2() { const index = currentStoryIndexV2(); if (index > 0) openStoryV2(stories[index - 1].id); }
function nextStoryV2() { const index = currentStoryIndexV2(); if (index < stories.length - 1) openStoryV2(stories[index + 1].id); }
async function showCollectionV2(collection) { if (!COLLECTIONS[collection]) return; stopSpeechV2(false); activeCollection = collection; loadCollectionV2(collection); state.collection = collection; state.story = stories[0]?.id || 1; saveStateV2(); history.pushState({}, '', '#stories'); renderStoriesV2(); syncNavigation(); }
function renderCurrentV2() { const params = new URLSearchParams(location.search); if (params.get('story')) { activeCollection = params.get('collection') || state.collection || 'shivaji'; loadCollectionV2(activeCollection); renderReaderV2(Number(params.get('story'))); } else if (location.hash === '#stories') renderStoriesV2(); else if (location.hash === '#saved') { currentFilter = 'favorites'; renderStoriesV2(); } else renderHomeV2(); }
async function initializeV2() { state = migrateStateV2(); activeCollection = state.collection || 'shivaji'; playbackMode = state.playbackMode || 'single'; const results = await Promise.all(COLLECTION_ORDER.map(async (id) => { try { const response = await fetch(COLLECTIONS[id].file); const list = await response.json(); return [id, Array.isArray(list) ? list : []]; } catch { return [id, []]; } })); collectionData = Object.fromEntries(results); loadCollectionV2(activeCollection); loadVoices(); renderCurrentV2(); ensureCollectionStartActionsV2(); syncNavigation(); }
window.showPageV2 = showPageV2; window.showPage = showPageV2; window.openStoryV2 = openStoryV2; window.openStory = openStoryV2; window.showCollection = showCollectionV2; window.toggleSaveV2 = toggleSaveV2; window.toggleSave = toggleSaveV2; window.setFilterV2 = setFilterV2; window.playStoryV2 = playStoryV2; window.playStory = playStoryV2; window.pauseSpeechV2 = pauseSpeechV2; window.pauseSpeech = pauseSpeechV2; window.resumeSpeechV2 = resumeSpeechV2; window.resumeSpeech = resumeSpeechV2; window.stopSpeechV2 = stopSpeechV2; window.stopSpeech = stopSpeechV2; window.previousStoryV2 = previousStoryV2; window.nextStoryV2 = nextStoryV2; window.setVolumeV2 = setVolumeV2; window.setSpeedV2 = setSpeedV2; window.togglePlaybackModeV2 = togglePlaybackModeV2; window.toggleTheme = toggleThemeV2;
document.addEventListener('DOMContentLoaded', initializeV2);
document.addEventListener('change', (event) => { if (event.target.matches?.('input[name="playbackMode"]')) window.setTimeout(ensureCollectionStartActionsV2, 0); });
