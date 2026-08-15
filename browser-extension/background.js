import { signInWithMicrosoft } from './auth/microsoft.js';
import { signInWithAtlassian } from './auth/atlassian.js';

const ALARM_NAME = 'joc-sync';
const SYNC_PERIOD_MINUTES = 360; // co 6h

const CONFIG_KEYS = [
  'syncUrl',
  'msClientId',
  'msTenantId',
  'atlassianClientId',
  'atlassianExchangeUrl',
  'reportUrl',
];

async function getManagedConfig() {
  try {
    return await chrome.storage.managed.get(CONFIG_KEYS);
  } catch (err) {
    return {};
  }
}

async function getConfig() {
  const managed = await getManagedConfig();
  const local = await chrome.storage.local.get(CONFIG_KEYS);
  const merged = {};
  for (const key of CONFIG_KEYS) {
    merged[key] = managed[key] || local[key] || null;
  }
  return merged;
}

function isAuthRequired(config) {
  return Boolean(
    (config.msClientId && config.msTenantId) ||
      (config.atlassianClientId && config.atlassianExchangeUrl)
  );
}

// Microsoft: wysylamy idToken (JWT z aud=nasz client_id, weryfikowalny przez
// Forge wzgledem JWKS Microsoftu - patrz src/identity.js). Atlassian: nie ma
// id_token w 3LO, wiec wysylamy accessToken (Forge sprawdza go wywolaniem
// api.atlassian.com/me).
function getBearerToken(auth) {
  if (!auth) return null;
  return auth.provider === 'microsoft' ? auth.idToken : auth.accessToken;
}

// --- Logowanie (Microsoft Entra ID / Atlassian OAuth) ---
// Logowanie jest opcjonalne: jesli admin nie skonfigurowal zadnego z
// dostawcow (patrz isAuthRequired), rozszerzenie dziala jak dotychczas,
// bez logowania. Skonfigurowanie choc jednego wlacza wymog zalogowania
// zarowno do uruchomienia samouczkow (patrz content/content.js), jak i do
// samej synchronizacji z Forge (token dolaczany jako Authorization: Bearer).

async function getAuthState() {
  const { auth } = await chrome.storage.local.get('auth');
  if (!auth) return null;
  if (auth.expiresAt && auth.expiresAt < Date.now()) {
    return null; // token wygasl - traktujemy jak wylogowanego
  }
  return auth;
}

async function signIn(provider) {
  const config = await getConfig();
  let result;
  if (provider === 'microsoft') {
    result = await signInWithMicrosoft({ clientId: config.msClientId, tenantId: config.msTenantId });
  } else if (provider === 'atlassian') {
    result = await signInWithAtlassian({
      clientId: config.atlassianClientId,
      exchangeUrl: config.atlassianExchangeUrl,
    });
  } else {
    throw new Error(`Nieznany dostawca logowania: ${provider}`);
  }
  await chrome.storage.local.set({ auth: result });
  reportEvent('login').catch(() => {});
  return result;
}

async function signOut() {
  await chrome.storage.local.remove('auth');
}

// --- Raportowanie zdarzen (kto sie zalogowal / co przeszedl) ---
// Wysylane "best effort" - brak polaczenia albo brak skonfigurowanego
// reportUrl nie przerywa dzialania samouczkow, tylko nie trafia do raportu
// w panelu admina Jiry.

async function reportEvent(event, tourId, stepId) {
  const [config, auth] = await Promise.all([getConfig(), getAuthState()]);
  if (!config.reportUrl || !auth) {
    return { ok: false, error: 'Brak logowania lub adresu raportowania.' };
  }
  const token = getBearerToken(auth);
  if (!token) {
    return { ok: false, error: 'Brak tokenu.' };
  }
  try {
    const response = await fetch(config.reportUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ event, tourId, stepId }),
    });
    if (!response.ok) {
      return { ok: false, error: `Serwer zwrocil status ${response.status}.` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || 'Blad sieci.' };
  }
}

// --- Synchronizacja samouczkow z Forge ---

async function syncFromForge(explicitUrl) {
  const config = await getConfig();
  const url = explicitUrl || config.syncUrl;
  if (!url) {
    return { ok: false, error: 'Brak skonfigurowanego adresu synchronizacji.' };
  }

  if (isAuthRequired(config) && !(await getAuthState())) {
    return { ok: false, error: 'Wymagane logowanie - zaloguj sie w wyskakujacym okienku rozszerzenia.' };
  }

  try {
    const auth = await getAuthState();
    const token = getBearerToken(auth);
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
      return { ok: false, error: `Serwer zwrocil status ${response.status}.` };
    }
    const data = await response.json();
    if (!Array.isArray(data.tours)) {
      return { ok: false, error: 'Nieoczekiwana odpowiedz serwera (brak "tours").' };
    }
    await chrome.storage.local.set({ tours: data.tours, lastSyncAt: Date.now() });
    return { ok: true, tours: data.tours };
  } catch (err) {
    return { ok: false, error: err.message || 'Blad sieci.' };
  }
}

async function maybeAutoSync() {
  const config = await getConfig();
  if (!config.syncUrl) return;
  if (isAuthRequired(config) && !(await getAuthState())) return;
  const { tours } = await chrome.storage.local.get('tours');
  if (!tours || tours.length === 0) {
    await syncFromForge(config.syncUrl);
  }
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    const existing = await chrome.storage.local.get('tours');
    if (existing.tours === undefined) {
      await chrome.storage.local.set({ tours: [] });
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

// Gdy IT wdrozy/zmieni centralnie konfiguracje przez Chrome Enterprise
// policy, zsynchronizuj od razu zamiast czekac na najblizszy alarm.
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
  if (message.type === 'JOC_SIGN_IN') {
    signIn(message.provider)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (message.type === 'JOC_SIGN_OUT') {
    signOut().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === 'JOC_GET_AUTH_STATE') {
    Promise.all([getAuthState(), getConfig()]).then(([auth, config]) =>
      sendResponse({ auth, authRequired: isAuthRequired(config) })
    );
    return true;
  }
  if (message.type === 'JOC_REPORT_EVENT') {
    reportEvent(message.event, message.tourId, message.stepId).then(sendResponse);
    return true;
  }
  if (message.type === 'JOC_OPEN_PAGE') {
    chrome.tabs.create({ url: chrome.runtime.getURL(message.page) });
  }
  return undefined;
});
