const STORAGE_KEY = 'marathiKidsStories';
const DEFAULT_STATE = {
  lastStory: 1,
  savedStories: [],
  readStories: [],
  darkMode: false,
  fontSize: 'medium'
};

const FONT_CLASSES = {
  small: 'text-base leading-8',
  medium: 'text-lg leading-9',
  large: 'text-xl leading-10'
};

let stories = [];
let state = { ...DEFAULT_STATE };
let currentStoryId = 1;
let currentCategory = '';
let currentSearch = '';

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...DEFAULT_STATE, ...saved };
  } catch (error) {
    return { ...DEFAULT_STATE };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getStoryById(storyId) {
  return stories.find((story) => Number(story.id) === Number(storyId)) || stories[0];
}

function isSaved(storyId) {
  return state.savedStories.includes(Number(storyId));
}

function renderHomePage() {
  const lastStory = getStoryById(state.lastStory) || stories[0];
  const readCount = state.readStories.length;
  const progress = stories.length ? Math.round((readCount / stories.length) * 100) : 0;
  const categories = [
    ['पौराणिक कथा', '🕉️'],
    ['श्रीकृष्ण कथा', '🦚'],
    ['रामायण', '🏹'],
    ['महाभारत', '🎯'],
    ['गणपती कथा', '🐘']
  ];

  document.getElementById('app').innerHTML = `
    <main class="max-w-5xl mx-auto px-4 pb-24 pt-4">
      <header class="flex items-center justify-between py-4">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold">📚 गोष्टींचं सुंदर जग</h1>
          <p class="text-sm text-slate-500 dark:text-slate-300 mt-1">वाचा • ऐका • शिका • आनंद घ्या</p>
        </div>
        <button type="button" onclick="toggleTheme()" class="text-2xl p-2 rounded-full bg-white dark:bg-slate-800 shadow-sm touch-target" aria-label="Toggle dark mode">
          ${state.darkMode ? '☀️' : '🌙'}
        </button>
      </header>

      <section class="rounded-3xl bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600 text-white p-6 shadow-lg mb-6">
        <p class="text-sm opacity-90">🌟 आजची खास गोष्ट</p>
        <h2 class="text-2xl sm:text-3xl font-bold mt-2">${lastStory.icon} ${lastStory.title}</h2>
        <p class="mt-3 opacity-90">चला, आज एक सुंदर गोष्ट वाचूया!</p>
        <button type="button" onclick="openStory(${lastStory.id})" class="mt-5 bg-white text-indigo-600 font-bold px-5 py-3 rounded-xl shadow touch-target">
          📖 गोष्ट वाचा
        </button>
      </section>

      <section class="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow mb-6">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm text-slate-500 dark:text-slate-300">▶️ पुढे वाचा</p>
            <h3 class="text-xl font-bold mt-1">${lastStory.icon} ${lastStory.title}</h3>
          </div>
          <button type="button" onclick="openStory(${lastStory.id})" class="bg-indigo-500 text-white px-4 py-3 rounded-xl hover:opacity-90 touch-target">
            वाचन सुरू करा
          </button>
        </div>
      </section>

      <section class="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow mb-6">
        <div class="flex items-center justify-between text-sm mb-3">
          <span class="font-bold">📊 माझा वाचन प्रवास</span>
          <span>${readCount} / ${stories.length}</span>
        </div>
        <div class="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div class="h-full bg-indigo-500 rounded-full transition-all" style="width: ${progress}%"></div>
        </div>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-300">${progress}% गोष्टी वाचल्या</p>
      </section>

      <section>
        <h2 class="text-xl font-bold mb-4">📚 गोष्टींचे प्रकार</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          ${categories.map(([title, icon]) => `
            <button type="button" onclick="showCategory('${title}')" class="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow text-left hover:shadow-lg transition touch-target">
              <div class="text-3xl">${icon}</div>
              <div class="font-semibold mt-2">${title}</div>
            </button>
          `).join('')}
        </div>
      </section>
    </main>
  `;

  updateNetworkStatus();
}

function showCategory(category) {
  currentCategory = category;
  history.pushState({}, '', '#stories');
  renderStoriesPage(category);
}

function renderStoriesPage(selectedCategory = currentCategory) {
  currentCategory = selectedCategory || '';
  const searchTerm = currentSearch.toLowerCase();
  const filteredStories = stories.filter((story) => {
    const matchesCategory = !currentCategory || story.category === currentCategory;
    const searchable = `${story.title} ${story.category} ${story.story.join(' ')}`.toLowerCase();
    const matchesSearch = !searchTerm || searchable.includes(searchTerm);
    return matchesCategory && matchesSearch;
  });

  document.getElementById('app').innerHTML = `
    <main class="max-w-5xl mx-auto px-4 pb-24 pt-4">
      <header class="py-4">
        <h1 class="text-2xl sm:text-3xl font-bold">📖 सर्व गोष्टी</h1>
        <p class="text-sm text-slate-500 dark:text-slate-300">${filteredStories.length} गोष्टी</p>
      </header>

      <div class="mb-4 flex flex-col gap-3 md:flex-row">
        <input id="storySearch" type="search" placeholder="🔎 गोष्ट शोधा..." value="${currentSearch}" class="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm" />
        <select id="categoryFilter" class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
          <option value="">सर्व प्रकार</option>
          ${[...new Set(stories.map((story) => story.category))].map((category) => `
            <option value="${category}" ${currentCategory === category ? 'selected' : ''}>${category}</option>
          `).join('')}
        </select>
      </div>

      <div id="storyList" class="grid gap-4 md:grid-cols-2">
        ${filteredStories.map((story) => storyCard(story)).join('')}
      </div>
    </main>
  `;

  const searchInput = document.getElementById('storySearch');
  searchInput.addEventListener('input', (event) => {
    currentSearch = event.target.value.trim();
    renderStoriesPage(currentCategory);
  });

  const categoryFilter = document.getElementById('categoryFilter');
  categoryFilter.addEventListener('change', (event) => {
    currentCategory = event.target.value;
    renderStoriesPage(currentCategory);
  });

  updateNetworkStatus();
}

function storyCard(story) {
  return `
    <article class="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow hover:shadow-lg transition">
      <div class="flex items-start gap-4">
        <div class="text-4xl">${story.icon}</div>
        <div class="flex-1">
          <div class="text-xs font-semibold text-indigo-500">${story.category}</div>
          <h2 class="text-xl font-bold mt-1">${story.title}</h2>
          <p class="text-sm text-slate-500 dark:text-slate-300 mt-2">${story.readTime} मिनिटे</p>
        </div>
        <button type="button" onclick="toggleSave(${story.id})" class="text-2xl touch-target" aria-label="Save story">
          ${isSaved(story.id) ? '❤️' : '🤍'}
        </button>
      </div>
      <button type="button" onclick="openStory(${story.id})" class="mt-5 w-full bg-indigo-500 text-white font-semibold py-3 rounded-xl hover:bg-indigo-600 touch-target">
        📖 गोष्ट वाचा
      </button>
    </article>
  `;
}

function renderReaderPage(storyId) {
  const story = getStoryById(storyId);
  if (!story) return;

  currentStoryId = Number(story.id);
  markStoryRead(story.id);

  document.getElementById('app').innerHTML = `
    <main class="max-w-3xl mx-auto px-4 pb-24 pt-4">
      <header class="flex items-center justify-between py-4">
        <button type="button" onclick="showPage('stories')" class="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-100 px-4 py-2 rounded-xl touch-target">← मागे</button>
        <span class="font-bold">${story.id} / ${stories.length}</span>
        <button type="button" onclick="toggleSave(${story.id})" class="text-2xl touch-target" aria-label="Save story">
          ${isSaved(story.id) ? '❤️' : '🤍'}
        </button>
      </header>

      <article class="bg-white dark:bg-slate-900 rounded-3xl shadow-lg p-5 sm:p-8">
        <div class="text-center">
          <div class="text-6xl">${story.icon}</div>
          <div class="text-sm font-semibold text-indigo-500 mt-4">${story.category}</div>
          <h1 class="text-3xl font-bold mt-2">${story.title}</h1>
        </div>

        <div class="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onclick="speakStory()" class="bg-indigo-500 text-white px-5 py-3 rounded-xl touch-target">🔊 ऐका</button>
          <button type="button" onclick="pauseSpeech()" class="bg-amber-500 text-white px-5 py-3 rounded-xl touch-target">⏸️ Pause</button>
          <button type="button" onclick="stopSpeech()" class="bg-red-500 text-white px-5 py-3 rounded-xl touch-target">⏹️ Stop</button>
        </div>

        <div class="mt-4 flex justify-center gap-2 flex-wrap">
          <button type="button" onclick="setFontSize('small')" class="bg-slate-200 dark:bg-slate-700 px-3 py-2 rounded-lg text-sm touch-target">A-</button>
          <button type="button" onclick="setFontSize('medium')" class="bg-slate-200 dark:bg-slate-700 px-3 py-2 rounded-lg text-sm touch-target">A</button>
          <button type="button" onclick="setFontSize('large')" class="bg-slate-200 dark:bg-slate-700 px-3 py-2 rounded-lg text-sm touch-target">A+</button>
        </div>

        <div class="reader-text mt-8 ${FONT_CLASSES[state.fontSize]} text-slate-800 dark:text-slate-100">
          ${story.story.map((paragraph) => `<p class="mb-5">${paragraph}</p>`).join('')}
        </div>

        <div class="mt-8 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-2xl p-5">
          <h3 class="text-lg font-bold">🌱 बोध</h3>
          <p class="mt-2">${story.moral}</p>
        </div>

        <div class="mt-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-5">
          <h3 class="text-lg font-bold">⭐ आजची शिकवण</h3>
          <p class="mt-2 font-semibold">“${story.lesson}”</p>
        </div>
      </article>

      <div class="grid grid-cols-2 gap-3 mt-5 mb-6">
        <button type="button" onclick="previousStory()" class="bg-white dark:bg-slate-900 shadow py-4 rounded-2xl font-semibold touch-target">← मागची गोष्ट</button>
        <button type="button" onclick="nextStory()" class="bg-indigo-500 text-white shadow py-4 rounded-2xl font-semibold touch-target">पुढची गोष्ट →</button>
      </div>
    </main>
  `;

  updateNetworkStatus();
}

function renderSavedPage() {
  const savedStories = stories.filter((story) => state.savedStories.includes(story.id));

  document.getElementById('app').innerHTML = `
    <main class="max-w-5xl mx-auto px-4 pb-24 pt-4">
      <header class="py-4">
        <h1 class="text-2xl sm:text-3xl font-bold">❤️ माझ्या आवडत्या गोष्टी</h1>
        <p class="text-sm text-slate-500 dark:text-slate-300">${savedStories.length} गोष्टी सेव्ह केल्या</p>
      </header>

      ${savedStories.length ? `
        <div class="grid gap-4 md:grid-cols-2">
          ${savedStories.map((story) => storyCard(story)).join('')}
        </div>
      ` : `
        <div class="text-center bg-white dark:bg-slate-900 rounded-3xl py-20 px-6 shadow">
          <div class="text-6xl">🤍</div>
          <h2 class="text-xl font-bold mt-4">अजून कोणतीही गोष्ट सेव्ह केलेली नाही.</h2>
          <button type="button" onclick="showPage('stories')" class="mt-5 bg-indigo-500 text-white px-5 py-3 rounded-xl touch-target">गोष्टी पहा</button>
        </div>
      `}
    </main>
  `;

  updateNetworkStatus();
}

function markStoryRead(storyId) {
  const id = Number(storyId);
  if (!state.readStories.includes(id)) {
    state.readStories.push(id);
  }
  state.lastStory = id;
  saveState();
}

function toggleSave(storyId) {
  const id = Number(storyId);
  if (state.savedStories.includes(id)) {
    state.savedStories = state.savedStories.filter((item) => item !== id);
  } else {
    state.savedStories.push(id);
  }
  saveState();

  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash;

  if (params.get('story')) {
    renderReaderPage(Number(params.get('story')));
  } else if (hash === '#saved') {
    renderSavedPage();
  } else if (hash === '#stories') {
    renderStoriesPage(currentCategory);
  } else {
    renderHomePage();
  }
}

let speech;

function speakStory() {
  if (!('speechSynthesis' in window)) {
    alert('आपला ब्राउझर मराठी आवाज सपोर्ट करत नाही.');
    return;
  }

  const story = getStoryById(currentStoryId);
  if (!story) return;

  window.speechSynthesis.cancel();

  const text = [
    story.title,
    ...story.story,
    'बोध.',
    story.moral,
    'आजची शिकवण.',
    story.lesson
  ].join(' ');

  speech = new SpeechSynthesisUtterance(text);
  speech.lang = 'mr-IN';
  speech.rate = 0.78;
  speech.pitch = 1.05;
  speech.volume = 1;
  window.speechSynthesis.speak(speech);
}

function pauseSpeech() {
  if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
  }
}

function stopSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function toggleTheme() {
  state.darkMode = !state.darkMode;
  document.documentElement.classList.toggle('dark', state.darkMode);
  saveState();
  refreshUI();
}

function setFontSize(size) {
  state.fontSize = size;
  saveState();
  refreshUI();
}

function refreshUI() {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  document.documentElement.classList.toggle('dark', state.darkMode);

  if (params.get('story')) {
    renderReaderPage(Number(params.get('story')));
    return;
  }
  if (hash === '#stories') {
    renderStoriesPage(currentCategory);
    return;
  }
  if (hash === '#saved') {
    renderSavedPage();
    return;
  }
  renderHomePage();
}

function showPage(page) {
  stopSpeech();
  if (page === 'home') {
    history.pushState({}, '', './');
    renderHomePage();
    return;
  }
  if (page === 'stories') {
    currentCategory = '';
    history.pushState({}, '', '#stories');
    renderStoriesPage();
    return;
  }
  if (page === 'saved') {
    history.pushState({}, '', '#saved');
    renderSavedPage();
  }
}

function openStory(storyId) {
  currentStoryId = Number(storyId);
  history.pushState({}, '', `?story=${currentStoryId}`);
  renderReaderPage(currentStoryId);
}

function previousStory() {
  const total = stories.length;
  const previousId = ((currentStoryId - 2 + total) % total) + 1;
  openStory(previousId);
}

function nextStory() {
  const total = stories.length;
  const nextId = (currentStoryId % total) + 1;
  openStory(nextId);
}

function updateNetworkStatus() {
  const indicator = document.getElementById('networkStatus');
  if (!indicator) return;
  const online = navigator.onLine;
  indicator.textContent = online ? '🟢 Online' : '🟠 Offline Mode';
  indicator.className = online
    ? 'fixed top-4 right-4 z-50 rounded-full bg-emerald-500 text-white px-3 py-1 text-xs shadow'
    : 'fixed top-4 right-4 z-50 rounded-full bg-amber-500 text-white px-3 py-1 text-xs shadow';
}

async function initializeApp() {
  state = loadState();
  try {
    const res = await fetch('./data/stories.json');
    if (!res.ok) throw new Error('Stories data not found');
    stories = await res.json();
  } catch (error) {
    document.getElementById('app').innerHTML = `
      <main class="max-w-xl mx-auto px-4 py-10 text-center">
        <h1 class="text-2xl font-bold">गोष्टी लोड होत नाहीत.</h1>
        <p class="mt-3 text-slate-500">कृपया फाइल योग्य पद्धतीने सेव्हरवर चालवा.</p>
      </main>
    `;
    return;
  }

  if (!state.lastStory || !getStoryById(state.lastStory)) {
    state.lastStory = stories[0].id;
  }
  currentStoryId = Number(state.lastStory || stories[0].id);
  document.documentElement.classList.toggle('dark', state.darkMode);

  const params = new URLSearchParams(window.location.search);
  const routeStory = params.get('story');
  const hash = window.location.hash;

  if (routeStory) {
    renderReaderPage(Number(routeStory));
  } else if (hash === '#stories') {
    renderStoriesPage();
  } else if (hash === '#saved') {
    renderSavedPage();
  } else {
    renderHomePage();
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  updateNetworkStatus();
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
}

window.showPage = showPage;
window.openStory = openStory;
window.toggleTheme = toggleTheme;
window.toggleSave = toggleSave;
window.showCategory = showCategory;
window.previousStory = previousStory;
window.nextStory = nextStory;
window.speakStory = speakStory;
window.pauseSpeech = pauseSpeech;
window.stopSpeech = stopSpeech;
window.setFontSize = setFontSize;

window.addEventListener('popstate', () => {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  if (params.get('story')) {
    renderReaderPage(Number(params.get('story')));
  } else if (hash === '#stories') {
    renderStoriesPage();
  } else if (hash === '#saved') {
    renderSavedPage();
  } else {
    renderHomePage();
  }
});

document.addEventListener('DOMContentLoaded', initializeApp);
