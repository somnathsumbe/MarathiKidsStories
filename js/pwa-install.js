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
    installBanner.innerHTML = environment.isIOS
      ? `<div class="install-banner-icon">📱</div><div class="install-banner-copy"><h2 id="install-title">iPhone वर app ठेवा</h2><p>${environment.isSafari ? 'Share ⬆️ वर टॅप करा, मग “Add to Home Screen” निवडा.' : 'सर्वोत्तम install अनुभवासाठी ही page Safari मध्ये उघडा.'}</p><details><summary>कसे करायचे?</summary><ol><li>Safari मधील Share ⬆️ दाबा</li><li>“Add to Home Screen” निवडा</li><li>“Add” दाबा</li></ol></details></div><button type="button" class="install-close" data-install-dismiss aria-label="Install सूचना बंद करा">×</button>`
      : `<div class="install-banner-icon">📱</div><div class="install-banner-copy"><h2 id="install-title">App install करा</h2><p>जलद प्रवेश आणि offline कथा-वाचनासाठी app Home Screen वर ठेवा.</p><div class="install-actions"><button type="button" class="install-button" data-install-action>Install App</button><button type="button" class="install-later" data-install-dismiss>नंतर</button></div></div><button type="button" class="install-close" data-install-dismiss aria-label="Install सूचना बंद करा">×</button>`;
    document.body.appendChild(installBanner);
    requestAnimationFrame(() => installBanner?.classList.add('is-visible'));
    installBanner.querySelector('[data-install-dismiss]')?.addEventListener('click', () => { remember({ installDismissed: true }); hideInstallUI(); });
    installBanner.querySelector('[data-install-action]')?.addEventListener('click', installApp);
  }

  async function installApp() {
    if (!deferredPrompt) return;
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
    if (environment.isIOS && !environment.isStandalone) showInstallUI();
  });
})();
