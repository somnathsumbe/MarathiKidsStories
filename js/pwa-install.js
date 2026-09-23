(() => {
  const STORAGE_KEY = 'marathiKidsStoriesInstall';
  let deferredPrompt = null;
  let installBanner = null;

  const storage = {
    get() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
    },
    set(value) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* Storage can be unavailable in private mode. */ }
    }
  };

  function getInstallEnvironment() {
    const userAgent = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    return { isIOS, isSafari, isStandalone, isAndroid: /Android/i.test(userAgent), isDesktop: !isIOS && !/Android/i.test(userAgent) };
  }

  function hideInstallUI() {
    if (!installBanner) return;
    installBanner.classList.remove('is-visible');
    window.setTimeout(() => installBanner?.remove(), 240);
    installBanner = null;
  }

  function remember(patch) { storage.set({ ...storage.get(), ...patch }); }

  function showInstallUI() {
    const environment = getInstallEnvironment();
    const saved = storage.get();
    if (saved.installed || saved.installDismissed || environment.isStandalone || installBanner) return;
    installBanner = document.createElement('aside');
    installBanner.className = 'install-banner';
    installBanner.setAttribute('role', 'dialog');
    installBanner.setAttribute('aria-labelledby', 'install-title');
    const installContent = environment.isIOS
      ? `<p>${environment.isSafari ? 'iPhone वर कथा offline ऐकण्यासाठी Home Screen वर app ठेवा.' : 'Install करण्यासाठी ही लिंक Safari मध्ये उघडा.'}</p><details open><summary>कसे करायचे?</summary><ol><li><span aria-hidden="true">⬆️</span> Safari मधील Share दाबा</li><li><span aria-hidden="true">➕</span> “Add to Home Screen” निवडा</li><li><span aria-hidden="true">✅</span> “Add” दाबा</li></ol></details>`
      : `<p>जलद प्रवेश आणि offline कथा-वाचनासाठी app Home Screen वर ठेवा.</p>${deferredPrompt ? '' : '<details open><summary>Install पर्याय दिसत नसेल</summary><p>Chrome menu मधून “Install app” किंवा “Add to Home screen” निवडा.</p></details>'}`;
    installBanner.innerHTML = `<div class="install-banner-icon" aria-hidden="true">📱</div><div class="install-banner-copy"><h2 id="install-title">अ‍ॅप इन्स्टॉल करा</h2>${installContent}<div class="install-actions"><button type="button" class="install-button" data-install-action>${environment.isIOS ? 'पायऱ्या पहा' : 'अ‍ॅप इन्स्टॉल करा'}</button><button type="button" class="install-later" data-install-dismiss>नंतर</button></div></div><button type="button" class="install-close" data-install-dismiss aria-label="Install सूचना बंद करा">×</button>`;
    document.body.appendChild(installBanner);
    requestAnimationFrame(() => installBanner?.classList.add('is-visible'));
    installBanner.querySelector('[data-install-dismiss]')?.addEventListener('click', () => { remember({ installDismissed: true }); hideInstallUI(); });
    installBanner.querySelector('[data-install-action]')?.addEventListener('click', installApp);
  }

  async function installApp() {
    if (!deferredPrompt) {
      installBanner?.querySelector('details')?.setAttribute('open', '');
      installBanner?.querySelector('[data-install-action]')?.focus();
      return;
    }
    deferredPrompt.prompt();
    try {
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') remember({ installed: true, installDismissed: true });
    } finally {
      deferredPrompt = null;
      hideInstallUI();
    }
  }

  window.getInstallEnvironment = getInstallEnvironment;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallUI();
  });
  window.addEventListener('appinstalled', () => { remember({ installed: true, installDismissed: true }); hideInstallUI(); });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && installBanner) { remember({ installDismissed: true }); hideInstallUI(); } });
  document.addEventListener('DOMContentLoaded', () => {
    const environment = getInstallEnvironment();
    if (!environment.isStandalone) showInstallUI();
  });
})();
