const stepsContainer = document.getElementById('steps');
const template = document.getElementById('step-template');
const statusEl = document.getElementById('status');
const managedNoticeEl = document.getElementById('managed-notice');
const syncUrlInput = document.getElementById('sync-url');
const syncInfoEl = document.getElementById('sync-info');
const syncSaveBtn = document.getElementById('sync-save');
const syncNowBtn = document.getElementById('sync-now');

let managed = false;
let pickingRow = null;

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

function rowFromStep(step) {
  const node = template.content.firstElementChild.cloneNode(true);
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

function renderSteps(steps) {
  stepsContainer.innerHTML = '';
  steps.forEach((step) => stepsContainer.appendChild(rowFromStep(step)));
}

function collectSteps() {
  return Array.from(stepsContainer.querySelectorAll('[data-step]')).map((node) => ({
    id: node.querySelector('[data-field="id"]').value.trim(),
    selector: node.querySelector('[data-field="selector"]').value.trim(),
    heading: node.querySelector('[data-field="heading"]').value.trim(),
    description: node.querySelector('[data-field="description"]').value.trim(),
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
        renderSteps(result.steps);
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

async function load() {
  await loadSyncSection();

  const managedResult = await chrome.storage.managed.get('steps').catch(() => ({}));
  if (managedResult && Array.isArray(managedResult.steps) && managedResult.steps.length) {
    managed = true;
    managedNoticeEl.hidden = false;
    document.getElementById('add-step').disabled = true;
    document.getElementById('save').disabled = true;
    document.getElementById('import').disabled = true;
    renderSteps(managedResult.steps);
    return;
  }
  const local = await chrome.storage.local.get('steps');
  renderSteps(Array.isArray(local.steps) ? local.steps : []);
}

document.getElementById('add-step').addEventListener('click', () => {
  stepsContainer.appendChild(
    rowFromStep({ id: '', selector: '', heading: '', description: '' })
  );
});

document.getElementById('save').addEventListener('click', async () => {
  const steps = collectSteps();
  await chrome.storage.local.set({ steps });
  showStatus('Zapisano kroki samouczka.', 'success');
});

document.getElementById('export').addEventListener('click', () => {
  const steps = collectSteps();
  const blob = new Blob([JSON.stringify({ steps }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jira-onboarding-steps.json';
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
    const steps = Array.isArray(data) ? data : data.steps;
    if (!Array.isArray(steps)) {
      throw new Error('Nieprawidlowy format pliku.');
    }
    renderSteps(steps);
    showStatus('Zaimportowano kroki. Kliknij „Zapisz”, aby je zachowac.', 'success');
  } catch (err) {
    showStatus('Nie udalo sie zaimportowac pliku JSON.', 'error');
  } finally {
    event.target.value = '';
  }
});

load();
