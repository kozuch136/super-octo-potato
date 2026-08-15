const statusEl = document.getElementById('status');
const hintEl = document.getElementById('hint');
const startBtn = document.getElementById('start');
const optionsBtn = document.getElementById('options');

async function getActiveJiraTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !/^https?:\/\/[^/]*\.atlassian\.net\//.test(tab.url)) {
    return null;
  }
  return tab;
}

async function refreshStatus() {
  const tab = await getActiveJiraTab();
  if (!tab) {
    statusEl.textContent = 'Otworz stronę Jiry, aby zobaczyc status.';
    startBtn.disabled = true;
    return;
  }
  startBtn.disabled = false;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'JOC_GET_STATUS' });
    statusEl.textContent = response?.seen
      ? 'Samouczek zostal juz obejrzany.'
      : 'Samouczek pojawi sie automatycznie przy nastepnej okazji.';
  } catch (err) {
    statusEl.textContent = 'Odswiez strone Jiry, aby wlaczyc rozszerzenie.';
  }
}

startBtn.addEventListener('click', async () => {
  const tab = await getActiveJiraTab();
  if (!tab) {
    hintEl.textContent = 'To dziala tylko na stronach Jiry.';
    return;
  }
  await chrome.tabs.sendMessage(tab.id, { type: 'JOC_RESTART_TOUR' });
  window.close();
});

optionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

refreshStatus();
