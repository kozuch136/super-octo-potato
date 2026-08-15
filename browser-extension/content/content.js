(function () {
  const PAD = 6;

  let steps = [];
  let currentIndex = -1;
  let backdropEl = null;
  let tooltipEl = null;
  let repositionHandler = null;
  let launcherEl = null;

  let pickerActive = false;
  let pickerBannerEl = null;
  let pickerHoverEl = null;

  async function loadSteps() {
    let managed = {};
    try {
      managed = await chrome.storage.managed.get('steps');
    } catch (err) {
      managed = {};
    }
    if (managed && Array.isArray(managed.steps) && managed.steps.length) {
      return managed.steps;
    }
    const local = await chrome.storage.local.get('steps');
    return Array.isArray(local.steps) ? local.steps : [];
  }

  async function isSeen() {
    const { tourSeen } = await chrome.storage.local.get('tourSeen');
    return Boolean(tourSeen);
  }

  async function getAuthGate() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'JOC_GET_AUTH_STATE' });
      return response || { auth: null, authRequired: false };
    } catch (err) {
      return { auth: null, authRequired: false };
    }
  }

  // Best-effort: brak logowania/adresu raportowania po prostu nic nie
  // wysyla (patrz background.js -> reportEvent) - nie przerywa samouczka.
  function reportEvent(event, stepId) {
    chrome.runtime.sendMessage({ type: 'JOC_REPORT_EVENT', event, stepId }).catch(() => {});
  }

  async function markSeen() {
    await chrome.storage.local.set({ tourSeen: true });
  }

  function safeQuery(selector) {
    try {
      return document.querySelector(selector);
    } catch (err) {
      console.warn(`[Jira Onboarding Guide] Nieprawidlowy selektor CSS: "${selector}".`, err);
      return null;
    }
  }

  function waitForElement(selector, timeoutMs) {
    return new Promise((resolve) => {
      const existing = safeQuery(selector);
      if (existing) {
        resolve(existing);
        return;
      }
      const observer = new MutationObserver(() => {
        const el = safeQuery(selector);
        if (el) {
          observer.disconnect();
          clearTimeout(timer);
          resolve(el);
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      const timer = setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeoutMs);
    });
  }

  function ensureOverlayNodes() {
    if (!backdropEl) {
      backdropEl = document.createElement('div');
      backdropEl.className = 'joc-backdrop';
      document.body.appendChild(backdropEl);
    }
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'joc-tooltip';
      document.body.appendChild(tooltipEl);
    }
  }

  function positionOverlay(target) {
    const rect = target.getBoundingClientRect();
    backdropEl.style.top = `${rect.top - PAD}px`;
    backdropEl.style.left = `${rect.left - PAD}px`;
    backdropEl.style.width = `${rect.width + PAD * 2}px`;
    backdropEl.style.height = `${rect.height + PAD * 2}px`;

    const spaceBelow = window.innerHeight - rect.bottom;
    let top;
    if (spaceBelow > 160) {
      top = rect.bottom + 12;
    } else {
      top = Math.max(12, rect.top - 12 - tooltipEl.offsetHeight);
    }
    const left = Math.min(
      Math.max(12, rect.left),
      window.innerWidth - tooltipEl.offsetWidth - 12
    );
    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.left = `${left}px`;
  }

  function renderTooltip(step, index) {
    tooltipEl.innerHTML = '';

    const heading = document.createElement('div');
    heading.className = 'joc-tooltip__heading';
    heading.textContent = step.heading;

    const description = document.createElement('p');
    description.className = 'joc-tooltip__description';
    description.textContent = step.description;

    const footer = document.createElement('div');
    footer.className = 'joc-tooltip__footer';

    const progress = document.createElement('span');
    progress.className = 'joc-tooltip__progress';
    progress.textContent = `${index + 1} / ${steps.length}`;

    const actions = document.createElement('div');
    actions.className = 'joc-tooltip__actions';

    const skipBtn = document.createElement('button');
    skipBtn.className = 'joc-btn joc-btn--subtle';
    skipBtn.type = 'button';
    skipBtn.textContent = 'Pomin';
    skipBtn.onclick = () => {
      reportEvent('tour_skipped');
      finishTour();
    };

    const nextBtn = document.createElement('button');
    nextBtn.className = 'joc-btn joc-btn--primary';
    nextBtn.type = 'button';
    nextBtn.textContent = index === steps.length - 1 ? 'Zakoncz' : 'Dalej';
    nextBtn.onclick = () => {
      reportEvent('step_completed', step.id);
      if (index === steps.length - 1) {
        reportEvent('tour_completed');
      }
      goToStep(index + 1);
    };

    actions.append(skipBtn, nextBtn);
    footer.append(progress, actions);
    tooltipEl.append(heading, description, footer);
  }

  async function goToStep(index) {
    if (index >= steps.length) {
      finishTour();
      return;
    }
    currentIndex = index;
    const step = steps[index];
    const target = await waitForElement(step.selector, 4000);
    if (!target) {
      console.warn(
        `[Jira Onboarding Guide] Nie znaleziono elementu dla kroku "${step.id}" ` +
          `(selector: ${step.selector}). Pomijam krok - zweryfikuj selektor w Ustawieniach.`
      );
      goToStep(index + 1);
      return;
    }

    ensureOverlayNodes();
    hideLauncher();
    renderTooltip(step, index);
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => positionOverlay(target), 300);

    if (repositionHandler) {
      window.removeEventListener('scroll', repositionHandler, true);
      window.removeEventListener('resize', repositionHandler);
    }
    repositionHandler = () => positionOverlay(target);
    window.addEventListener('scroll', repositionHandler, true);
    window.addEventListener('resize', repositionHandler);
  }

  function removeOverlay() {
    if (backdropEl) {
      backdropEl.remove();
      backdropEl = null;
    }
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
    if (repositionHandler) {
      window.removeEventListener('scroll', repositionHandler, true);
      window.removeEventListener('resize', repositionHandler);
      repositionHandler = null;
    }
  }

  async function finishTour() {
    removeOverlay();
    currentIndex = -1;
    await markSeen();
    showLauncher();
  }

  async function startTour() {
    const { auth, authRequired } = await getAuthGate();
    if (authRequired && !auth) {
      showLauncher({ locked: true });
      return;
    }
    steps = await loadSteps();
    if (!steps.length) {
      return;
    }
    goToStep(0);
  }

  function showLauncher({ locked = false } = {}) {
    if (launcherEl) {
      launcherEl.remove();
      launcherEl = null;
    }
    launcherEl = document.createElement('button');
    launcherEl.className = 'joc-launcher';
    launcherEl.type = 'button';
    if (locked) {
      launcherEl.textContent = '\u{1F512}';
      launcherEl.title = 'Zaloguj sie, aby uruchomic samouczek onboardingowy';
      launcherEl.onclick = () => {
        chrome.runtime.sendMessage({ type: 'JOC_OPEN_PAGE', page: 'popup/popup.html' });
      };
    } else {
      launcherEl.textContent = '?';
      launcherEl.title = 'Uruchom samouczek onboardingowy';
      launcherEl.onclick = () => startTour();
    }
    document.body.appendChild(launcherEl);
  }

  function hideLauncher() {
    if (launcherEl) {
      launcherEl.style.display = 'none';
    }
  }

  // --- Tryb wskazywania elementu (uzywany ze strony ustawien) ---

  function cssPath(el) {
    if (!(el instanceof Element)) return '';
    const testId = el.getAttribute('data-testid');
    if (testId) return `[data-testid="${testId}"]`;
    if (el.id) return `#${CSS.escape(el.id)}`;
    const path = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === Node.ELEMENT_NODE && depth < 6) {
      const nodeTestId = node.getAttribute('data-testid');
      if (nodeTestId) {
        path.unshift(`[data-testid="${nodeTestId}"]`);
        break;
      }
      if (node.id) {
        path.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      let selector = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (c) => c.tagName === node.tagName
        );
        if (siblings.length > 1) {
          selector += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      }
      path.unshift(selector);
      node = node.parentElement;
      depth += 1;
    }
    return path.join(' > ');
  }

  function onPickerMouseOver(e) {
    if (pickerHoverEl) {
      pickerHoverEl.classList.remove('joc-picker-highlight');
    }
    pickerHoverEl = e.target;
    pickerHoverEl.classList.add('joc-picker-highlight');
  }

  function onPickerClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const selector = cssPath(e.target);
    chrome.runtime.sendMessage({ type: 'JOC_PICKER_RESULT', selector });
    stopPicker();
  }

  function onPickerEscape(e) {
    if (e.key === 'Escape') {
      stopPicker();
    }
  }

  function startPicker() {
    if (pickerActive) return;
    pickerActive = true;
    document.addEventListener('mouseover', onPickerMouseOver, true);
    document.addEventListener('click', onPickerClick, true);
    document.addEventListener('keydown', onPickerEscape);
    pickerBannerEl = document.createElement('div');
    pickerBannerEl.className = 'joc-picker-banner';
    pickerBannerEl.textContent =
      'Kliknij pole, ktore ma zostac podswietlone w samouczku (Esc, aby anulowac).';
    document.body.appendChild(pickerBannerEl);
  }

  function stopPicker() {
    pickerActive = false;
    document.removeEventListener('mouseover', onPickerMouseOver, true);
    document.removeEventListener('click', onPickerClick, true);
    document.removeEventListener('keydown', onPickerEscape);
    if (pickerHoverEl) {
      pickerHoverEl.classList.remove('joc-picker-highlight');
      pickerHoverEl = null;
    }
    if (pickerBannerEl) {
      pickerBannerEl.remove();
      pickerBannerEl = null;
    }
  }

  // --- Komunikacja z popupem / strona ustawien ---

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'JOC_START_TOUR') {
      startTour();
    } else if (message.type === 'JOC_RESTART_TOUR') {
      chrome.storage.local.set({ tourSeen: false }).then(() => startTour());
    } else if (message.type === 'JOC_START_PICKER') {
      startPicker();
    } else if (message.type === 'JOC_STOP_PICKER') {
      stopPicker();
    } else if (message.type === 'JOC_GET_STATUS') {
      isSeen().then((seen) => sendResponse({ seen }));
      return true;
    }
    return undefined;
  });

  // --- Autostart przy pierwszej wizycie ---

  (async function init() {
    const { auth, authRequired } = await getAuthGate();
    if (authRequired && !auth) {
      showLauncher({ locked: true });
      return;
    }
    showLauncher();
    const seen = await isSeen();
    if (seen) {
      return;
    }
    steps = await loadSteps();
    if (!steps.length) {
      return;
    }
    const firstTarget = await waitForElement(steps[0].selector, 8000);
    if (firstTarget) {
      goToStep(0);
    }
  })();
})();
