(function () {
  const PAD = 6;
  const TOUR_DETECT_TIMEOUT_MS = 2500;
  const STEP_WAIT_TIMEOUT_MS = 4000;

  let tours = [];
  let currentTour = null;
  let currentIndex = -1;
  let backdropEl = null;
  let tooltipEl = null;
  let repositionHandler = null;
  let launcherEl = null;
  let tourMenuEl = null;

  let pickerActive = false;
  let pickerBannerEl = null;
  let pickerHoverEl = null;

  async function loadTours() {
    let managed = {};
    try {
      managed = await chrome.storage.managed.get('tours');
    } catch (err) {
      managed = {};
    }
    if (managed && Array.isArray(managed.tours) && managed.tours.length) {
      return managed.tours;
    }
    const local = await chrome.storage.local.get('tours');
    return Array.isArray(local.tours) ? local.tours : [];
  }

  async function getSeenTourIds() {
    const { seenTourIds } = await chrome.storage.local.get('seenTourIds');
    return Array.isArray(seenTourIds) ? seenTourIds : [];
  }

  async function markTourSeen(tourId) {
    const seen = await getSeenTourIds();
    if (!seen.includes(tourId)) {
      await chrome.storage.local.set({ seenTourIds: [...seen, tourId] });
    }
  }

  async function resetTourSeen(tourId) {
    const seen = await getSeenTourIds();
    await chrome.storage.local.set({ seenTourIds: seen.filter((id) => id !== tourId) });
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
  function reportEvent(event, tourId, stepId) {
    chrome.runtime.sendMessage({ type: 'JOC_REPORT_EVENT', event, tourId, stepId }).catch(() => {});
  }

  function safeQuery(selector) {
    if (!selector) return null;
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
    progress.textContent = `${index + 1} / ${currentTour.steps.length}`;

    const actions = document.createElement('div');
    actions.className = 'joc-tooltip__actions';

    const skipBtn = document.createElement('button');
    skipBtn.className = 'joc-btn joc-btn--subtle';
    skipBtn.type = 'button';
    skipBtn.textContent = 'Pomin';
    skipBtn.onclick = () => {
      reportEvent('tour_skipped', currentTour.id);
      finishTour('skipped');
    };

    const nextBtn = document.createElement('button');
    nextBtn.className = 'joc-btn joc-btn--primary';
    nextBtn.type = 'button';
    nextBtn.textContent = index === currentTour.steps.length - 1 ? 'Zakoncz' : 'Dalej';
    nextBtn.onclick = () => {
      reportEvent('step_completed', currentTour.id, step.id);
      if (index === currentTour.steps.length - 1) {
        reportEvent('tour_completed', currentTour.id);
      }
      goToStep(index + 1);
    };

    actions.append(skipBtn, nextBtn);
    footer.append(progress, actions);
    tooltipEl.append(heading, description, footer);
  }

  async function goToStep(index) {
    if (index >= currentTour.steps.length) {
      finishTour('completed');
      return;
    }
    currentIndex = index;
    const step = currentTour.steps[index];
    const target = await waitForElement(step.selector, STEP_WAIT_TIMEOUT_MS);
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
    const finishedTour = currentTour;
    currentTour = null;
    currentIndex = -1;
    if (finishedTour) {
      await markTourSeen(finishedTour.id);
    }
    showLauncher();
  }

  async function startTour(tourId) {
    const { auth, authRequired } = await getAuthGate();
    if (authRequired && !auth) {
      showLauncher({ locked: true });
      return;
    }
    if (!tours.length) {
      tours = await loadTours();
    }
    const tour = tours.find((t) => t.id === tourId);
    if (!tour || !tour.steps || !tour.steps.length) {
      return;
    }
    currentTour = tour;
    goToStep(0);
  }

  // --- Launcher + menu wyboru samouczka ---

  function closeTourMenu() {
    if (tourMenuEl) {
      tourMenuEl.remove();
      tourMenuEl = null;
    }
    document.removeEventListener('click', onOutsideClickCloseMenu, true);
  }

  function onOutsideClickCloseMenu(e) {
    if (tourMenuEl && !tourMenuEl.contains(e.target) && e.target !== launcherEl) {
      closeTourMenu();
    }
  }

  async function openTourMenu() {
    if (tourMenuEl) {
      closeTourMenu();
      return;
    }
    if (!tours.length) {
      tours = await loadTours();
    }
    if (!tours.length) {
      return;
    }
    const seenTourIds = await getSeenTourIds();

    tourMenuEl = document.createElement('div');
    tourMenuEl.className = 'joc-tour-menu';
    tours.forEach((tour) => {
      const item = document.createElement('button');
      item.type = 'button';
      const available = Boolean(safeQuery(tour.steps[0]?.selector));
      item.className = available
        ? 'joc-tour-menu__item'
        : 'joc-tour-menu__item joc-tour-menu__item--unavailable';
      const seenMark = seenTourIds.includes(tour.id) ? ' ✓' : '';
      item.textContent = `${tour.title}${seenMark}`;
      item.title = available
        ? 'Uruchom ten samouczek'
        : 'Nie znaleziono pol tego samouczka na biezacej stronie - mozna mimo to sprobowac';
      item.onclick = () => {
        closeTourMenu();
        startTour(tour.id);
      };
      tourMenuEl.appendChild(item);
    });
    document.body.appendChild(tourMenuEl);
    document.addEventListener('click', onOutsideClickCloseMenu, true);
  }

  function showLauncher({ locked = false } = {}) {
    if (launcherEl) {
      launcherEl.remove();
      launcherEl = null;
    }
    closeTourMenu();
    launcherEl = document.createElement('button');
    launcherEl.className = 'joc-launcher';
    launcherEl.type = 'button';
    if (locked) {
      launcherEl.textContent = '\u{1F512}';
      launcherEl.title = 'Zaloguj sie, aby uruchomic samouczki onboardingowe';
      launcherEl.onclick = () => {
        chrome.runtime.sendMessage({ type: 'JOC_OPEN_PAGE', page: 'popup/popup.html' });
      };
    } else {
      launcherEl.textContent = '?';
      launcherEl.title = 'Samouczki onboardingowe';
      launcherEl.onclick = () => openTourMenu();
    }
    document.body.appendChild(launcherEl);
  }

  function hideLauncher() {
    closeTourMenu();
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
      startTour(message.tourId);
    } else if (message.type === 'JOC_RESTART_TOUR') {
      resetTourSeen(message.tourId).then(() => startTour(message.tourId));
    } else if (message.type === 'JOC_START_PICKER') {
      startPicker();
    } else if (message.type === 'JOC_STOP_PICKER') {
      stopPicker();
    } else if (message.type === 'JOC_GET_STATUS') {
      (async () => {
        const loadedTours = tours.length ? tours : await loadTours();
        tours = loadedTours;
        const seenTourIds = await getSeenTourIds();
        sendResponse({
          tours: loadedTours.map((t) => ({
            id: t.id,
            title: t.title,
            seen: seenTourIds.includes(t.id),
          })),
        });
      })();
      return true;
    }
    return undefined;
  });

  // --- Autostart przy pierwszej wizycie ---

  async function detectAvailableTour(candidateTours) {
    const results = await Promise.all(
      candidateTours.map((tour) => waitForElement(tour.steps[0]?.selector, TOUR_DETECT_TIMEOUT_MS))
    );
    const index = results.findIndex((el) => el !== null);
    return index >= 0 ? candidateTours[index] : null;
  }

  (async function init() {
    const { auth, authRequired } = await getAuthGate();
    if (authRequired && !auth) {
      showLauncher({ locked: true });
      return;
    }
    showLauncher();

    tours = await loadTours();
    if (!tours.length) {
      return;
    }
    const seenTourIds = await getSeenTourIds();
    const unseenTours = tours.filter((t) => !seenTourIds.includes(t.id) && t.steps?.length);
    if (!unseenTours.length) {
      return;
    }

    const tourToStart = await detectAvailableTour(unseenTours);
    if (tourToStart) {
      currentTour = tourToStart;
      goToStep(0);
    }
  })();
})();
