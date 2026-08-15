const ALARM_NAME = 'joc-sync';
const SYNC_PERIOD_MINUTES = 360; // co 6h

async function getSyncUrl() {
  let managed = {};
  try {
    managed = await chrome.storage.managed.get('syncUrl');
  } catch (err) {
    managed = {};
  }
  if (managed && managed.syncUrl) {
    return managed.syncUrl;
  }
  const local = await chrome.storage.local.get('syncUrl');
  return local.syncUrl || null;
}

// Pobiera kroki z web triggera aplikacji Forge (patrz manifest.yml ->
// modules.webtrigger oraz src/webTrigger.js w katalogu glownym repo) i
// zapisuje je jako lokalny cache, z ktorego korzysta content script.
async function syncFromForge(explicitUrl) {
  const url = explicitUrl || (await getSyncUrl());
  if (!url) {
    return { ok: false, error: 'Brak skonfigurowanego adresu synchronizacji.' };
  }
  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      return { ok: false, error: `Serwer zwrocil status ${response.status}.` };
    }
    const data = await response.json();
    if (!Array.isArray(data.steps)) {
      return { ok: false, error: 'Nieoczekiwana odpowiedz serwera (brak "steps").' };
    }
    await chrome.storage.local.set({ steps: data.steps, lastSyncAt: Date.now() });
    return { ok: true, steps: data.steps };
  } catch (err) {
    return { ok: false, error: err.message || 'Blad sieci.' };
  }
}

async function maybeAutoSync() {
  const url = await getSyncUrl();
  if (!url) return;
  const { steps } = await chrome.storage.local.get('steps');
  if (!steps || steps.length === 0) {
    await syncFromForge(url);
  }
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    const existing = await chrome.storage.local.get('steps');
    if (existing.steps === undefined) {
      await chrome.storage.local.set({ steps: [] });
    }
  }
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: SYNC_PERIOD_MINUTES });
  await maybeAutoSync();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: SYNC_PERIOD_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    syncFromForge().catch((err) =>
      console.warn('[Jira Onboarding Guide] Synchronizacja w tle nie powiodla sie', err)
    );
  }
});

// Gdy IT wdrozy/zmieni centralnie syncUrl przez Chrome Enterprise policy,
// zsynchronizuj od razu zamiast czekac na najblizszy alarm.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'managed' && changes.syncUrl) {
    syncFromForge(changes.syncUrl.newValue).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'JOC_SYNC_NOW') {
    syncFromForge(message.url).then(sendResponse);
    return true;
  }
  return undefined;
});
