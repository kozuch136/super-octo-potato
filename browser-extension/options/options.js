const toursContainer = document.getElementById('tours');
const tourTemplate = document.getElementById('tour-template');
const stepTemplate = document.getElementById('step-template');
const statusEl = document.getElementById('status');
const managedNoticeEl = document.getElementById('managed-notice');
const syncUrlInput = document.getElementById('sync-url');
const syncInfoEl = document.getElementById('sync-info');
const syncSaveBtn = document.getElementById('sync-save');
const syncNowBtn = document.getElementById('sync-now');

const msClientIdInput = document.getElementById('ms-client-id');
const msTenantIdInput = document.getElementById('ms-tenant-id');
const atlassianClientIdInput = document.getElementById('atlassian-client-id');
const atlassianExchangeUrlInput = document.getElementById('atlassian-exchange-url');
const reportUrlInput = document.getElementById('report-url');
const authSaveBtn = document.getElementById('auth-save');
const authConfigStatusEl = document.getElementById('auth-config-status');

const AUTH_CONFIG_KEYS = [
  'msClientId',
  'msTenantId',
  'atlassianClientId',
  'atlassianExchangeUrl',
  'reportUrl',
];

let managed = false;
let pickingRow = null;
let nextTempId = 0;

function showStatus(message, kind) {
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.className = `notice notice--${kind}`;
}

function formatSyncInfo(lastSyncAt, extra) {
  const parts = [];
  if (lastSyncAt) {
    parts.push(`Ostatnia synchronizacja: ${new Date(lastSyncAt).toLocaleString('pl-PL')}.`);
  }
  if (extra) {
    parts.push(extra);
  }
  syncInfoEl.textContent = parts.join(' ');
}

function rowFromStep(step, stepsContainer) {
  const node = stepTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector('[data-field="id"]').value = step.id || '';
  node.querySelector('[data-field="selector"]').value = step.selector || '';
  node.querySelector('[data-field="heading"]').value = step.heading || '';
  node.querySelector('[data-field="description"]').value = step.description || '';

  node.querySelector('[data-remove]').addEventListener('click', () => {
    node.remove();
  });
  node.querySelector('[data-up]').addEventListener('click', () => {
    const prev = node.previousElementSibling;
    if (prev) stepsContainer.insertBefore(node, prev);
  });
  node.querySelector('[data-down]').addEventListener('click', () => {
    const next = node.nextElementSibling;
    if (next) stepsContainer.insertBefore(next, node);
  });
  node.querySelector('[data-pick]').addEventListener('click', () => startPicking(node));

  if (managed) {
    node.querySelectorAll('input, textarea, button').forEach((el) => {
      el.disabled = true;
    });
  }

  return node;
}

function rowFromTour(tour) {
  const node = tourTemplate.content.firstElementChild.cloneNode(true);
  const stepsContainer = node.querySelector('[data-steps]');
  const titlePreview = node.querySelector('[data-title-preview]');
  const toggleIcon = node.querySelector('[data-toggle-icon]');
  const body = node.querySelector('[data-body]');

  node.querySelector('[data-field="id"]').value = tour.id || '';
  node.querySelector('[data-field="title"]').value = tour.title || '';
  node.querySelector('[data-field="description"]').value = tour.description || '';
  titlePreview.textContent = tour.title || '(bez tytulu)';

  (tour.steps || []).forEach((step) => {
    stepsContainer.appendChild(rowFromStep(step, stepsContainer));
  });

  node.querySelector('[data-field="title"]').addEventListener('input', (e) => {
    titlePreview.textContent = e.target.value || '(bez tytulu)';
  });

  node.querySelector('[data-toggle]').addEventListener('click', () => {
    const collapsed = body.style.display === 'none';
    body.style.display = collapsed ? '' : 'none';
    toggleIcon.textContent = collapsed ? '▾' : '▸';
  });

  node.querySelector('[data-add-step]').addEventListener('click', () => {
    stepsContainer.appendChild(
      rowFromStep({ id: '', selector: '', heading: '', description: '' }, stepsContainer)
    );
  });

  node.querySelector('[data-remove-tour]').addEventListener('click', () => {
    node.remove();
  });
  node.querySelector('[data-up]').addEventListener('click', () => {
    const prev = node.previousElementSibling;
    if (prev) toursContainer.insertBefore(node, prev);
  });
  node.querySelector('[data-down]').addEventListener('click', () => {
    const next = node.nextElementSibling;
    if (next) toursContainer.insertBefore(next, node);
  });

  if (managed) {
    node.querySelectorAll('input, textarea, button').forEach((el) => {
      el.disabled = true;
    });
  }

  return node;
}

function renderTours(tours) {
  toursContainer.innerHTML = '';
  tours.forEach((tour, index) => {
    const node = rowFromTour(tour);
    if (index > 0) {
      node.querySelector('[data-body]').style.display = 'none';
      node.querySelector('[data-toggle-icon]').textContent = '▸';
    }
    toursContainer.appendChild(node);
  });
}

function collectTours() {
  return Array.from(toursContainer.querySelectorAll('[data-tour]')).map((tourNode) => ({
    id: tourNode.querySelector('[data-field="id"]').value.trim(),
    title: tourNode.querySelector('[data-field="title"]').value.trim(),
    description: tourNode.querySelector('[data-field="description"]').value.trim(),
    steps: Array.from(tourNode.querySelectorAll('[data-step]')).map((node) => ({
      id: node.querySelector('[data-field="id"]').value.trim(),
      selector: node.querySelector('[data-field="selector"]').value.trim(),
      heading: node.querySelector('[data-field="heading"]').value.trim(),
      description: node.querySelector('[data-field="description"]').value.trim(),
    })),
  }));
}

async function findJiraTab() {
  const tabs = await chrome.tabs.query({ url: '*://*.atlassian.net/*' });
  return tabs[0] || null;
}

async function startPicking(row) {
  const tab = await findJiraTab();
  if (!tab) {
    showStatus(
      'Otworz karte z Jira (*.atlassian.net) w tym samym oknie, aby wskazac element.',
      'error'
    );
    return;
  }
  pickingRow = row;
  await chrome.tabs.sendMessage(tab.id, { type: 'JOC_START_PICKER' });
  await chrome.tabs.update(tab.id, { active: true });
  showStatus('Przelacz sie na karte Jiry i kliknij pole do podswietlenia.', 'info');
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'JOC_PICKER_RESULT' && pickingRow) {
    pickingRow.querySelector('[data-field="selector"]').value = message.selector;
    showStatus('Selektor zapisany w formularzu. Pamietaj o kliknieciu „Zapisz”.', 'success');
    pickingRow = null;
  }
});

async function loadSyncSection() {
  const managedResult = await chrome.storage.managed.get('syncUrl').catch(() => ({}));
  const local = await chrome.storage.local.get(['syncUrl', 'lastSyncAt']);

  if (managedResult && managedResult.syncUrl) {
    syncUrlInput.value = managedResult.syncUrl;
    syncUrlInput.disabled = true;
    syncSaveBtn.disabled = true;
    formatSyncInfo(local.lastSyncAt, 'Adres wdrozony centralnie przez IT.');
    return;
  }

  syncUrlInput.value = local.syncUrl || '';
  formatSyncInfo(local.lastSyncAt);
}

async function requestSync(url) {
  syncNowBtn.disabled = true;
  formatSyncInfo(null, 'Synchronizowanie...');
  try {
    const result = await chrome.runtime.sendMessage({ type: 'JOC_SYNC_NOW', url });
    if (result && result.ok) {
      if (!managed) {
        renderTours(result.tours);
      }
      const { lastSyncAt } = await chrome.storage.local.get('lastSyncAt');
      formatSyncInfo(lastSyncAt, 'Zsynchronizowano pomyslnie.');
    } else {
      formatSyncInfo(null, `Synchronizacja nie powiodla sie: ${result?.error || 'nieznany blad'}.`);
    }
  } finally {
    syncNowBtn.disabled = false;
  }
}

syncSaveBtn.addEventListener('click', async () => {
  const url = syncUrlInput.value.trim();
  await chrome.storage.local.set({ syncUrl: url || undefined });
  showStatus('Zapisano adres synchronizacji.', 'success');
});

syncNowBtn.addEventListener('click', async () => {
  const url = syncUrlInput.value.trim();
  if (!url) {
    formatSyncInfo(null, 'Podaj najpierw adres synchronizacji.');
    return;
  }
  await requestSync(url);
});

async function loadAuthConfigSection() {
  const managedResult = await chrome.storage.managed.get(AUTH_CONFIG_KEYS).catch(() => ({}));
  const local = await chrome.storage.local.get(AUTH_CONFIG_KEYS);
  const isManaged = AUTH_CONFIG_KEYS.some((key) => managedResult[key]);

  const values = {};
  for (const key of AUTH_CONFIG_KEYS) {
    values[key] = managedResult[key] || local[key] || '';
  }

  msClientIdInput.value = values.msClientId;
  msTenantIdInput.value = values.msTenantId;
  atlassianClientIdInput.value = values.atlassianClientId;
  atlassianExchangeUrlInput.value = values.atlassianExchangeUrl;
  reportUrlInput.value = values.reportUrl;

  if (isManaged) {
    [
      msClientIdInput,
      msTenantIdInput,
      atlassianClientIdInput,
      atlassianExchangeUrlInput,
      reportUrlInput,
      authSaveBtn,
    ].forEach((el) => {
      el.disabled = true;
    });
    authConfigStatusEl.textContent = 'Konfiguracja logowania wdrozona centralnie przez IT.';
  }
}

authSaveBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({
    msClientId: msClientIdInput.value.trim() || undefined,
    msTenantId: msTenantIdInput.value.trim() || undefined,
    atlassianClientId: atlassianClientIdInput.value.trim() || undefined,
    atlassianExchangeUrl: atlassianExchangeUrlInput.value.trim() || undefined,
    reportUrl: reportUrlInput.value.trim() || undefined,
  });
  authConfigStatusEl.textContent = 'Zapisano konfiguracje logowania.';
});

async function load() {
  await loadSyncSection();
  await loadAuthConfigSection();

  const managedResult = await chrome.storage.managed.get('tours').catch(() => ({}));
  if (managedResult && Array.isArray(managedResult.tours) && managedResult.tours.length) {
    managed = true;
    managedNoticeEl.hidden = false;
    document.getElementById('add-tour').disabled = true;
    document.getElementById('save').disabled = true;
    document.getElementById('import').disabled = true;
    renderTours(managedResult.tours);
    return;
  }
  const local = await chrome.storage.local.get('tours');
  renderTours(Array.isArray(local.tours) ? local.tours : []);
}

document.getElementById('add-tour').addEventListener('click', () => {
  const node = rowFromTour({
    id: `tour-${Date.now()}-${nextTempId++}`,
    title: '',
    description: '',
    steps: [],
  });
  toursContainer.appendChild(node);
});

document.getElementById('save').addEventListener('click', async () => {
  const tours = collectTours();
  await chrome.storage.local.set({ tours });
  showStatus('Zapisano samouczki.', 'success');
});

document.getElementById('export').addEventListener('click', () => {
  const tours = collectTours();
  const blob = new Blob([JSON.stringify({ tours }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jira-onboarding-tours.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById('import').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const tours = Array.isArray(data) ? data : data.tours;
    if (!Array.isArray(tours)) {
      throw new Error('Nieprawidlowy format pliku.');
    }
    renderTours(tours);
    showStatus('Zaimportowano samouczki. Kliknij „Zapisz”, aby je zachowac.', 'success');
  } catch (err) {
    showStatus('Nie udalo sie zaimportowac pliku JSON.', 'error');
  } finally {
    event.target.value = '';
  }
});

load();
