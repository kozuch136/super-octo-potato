const statusEl = document.getElementById('status');
const toursListEl = document.getElementById('tours-list');
const tourRowTemplate = document.getElementById('tour-row-template');
const optionsBtn = document.getElementById('options');
const tourSection = document.getElementById('tour-section');

const authSection = document.getElementById('auth-section');
const authStatusEl = document.getElementById('auth-status');
const authErrorEl = document.getElementById('auth-error');
const authSignedOutEl = document.getElementById('auth-signed-out');
const signinMicrosoftBtn = document.getElementById('signin-microsoft');
const signinAtlassianBtn = document.getElementById('signin-atlassian');
const signoutBtn = document.getElementById('signout');

async function getActiveJiraTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !/^https?:\/\/[^/]*\.atlassian\.net\//.test(tab.url)) {
    return null;
  }
  return tab;
}

async function refreshAuth() {
  const { auth, authRequired } = await chrome.runtime.sendMessage({
    type: 'JOC_GET_AUTH_STATE',
  });

  if (!authRequired) {
    authSection.hidden = true;
    tourSection.hidden = false;
    return { signedIn: true };
  }

  authSection.hidden = false;
  if (auth) {
    authStatusEl.textContent = `Zalogowano (${auth.provider === 'microsoft' ? 'Microsoft' : 'Atlassian'}).`;
    authSignedOutEl.hidden = true;
    signoutBtn.hidden = false;
    tourSection.hidden = false;
  } else {
    authStatusEl.textContent = 'Zaloguj sie, aby uruchomic samouczki onboardingowe.';
    authSignedOutEl.hidden = false;
    signoutBtn.hidden = true;
    tourSection.hidden = true;
  }
  return { signedIn: Boolean(auth) };
}

function renderTours(tours, tab) {
  toursListEl.innerHTML = '';
  tours.forEach((tour) => {
    const node = tourRowTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.tour-row__title').textContent = tour.title;
    node.querySelector('.tour-row__status').textContent = tour.seen ? 'obejrzany' : 'nowy';
    const restartBtn = node.querySelector('.tour-row__restart');
    restartBtn.disabled = !tab;
    restartBtn.addEventListener('click', async () => {
      if (!tab) return;
      await chrome.tabs.sendMessage(tab.id, { type: 'JOC_RESTART_TOUR', tourId: tour.id });
      window.close();
    });
    toursListEl.appendChild(node);
  });
}

async function refreshStatus() {
  const tab = await getActiveJiraTab();
  if (!tab) {
    statusEl.textContent = 'Otworz stronę Jiry, aby zobaczyc samouczki.';
    toursListEl.innerHTML = '';
    return;
  }
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'JOC_GET_STATUS' });
    const tours = response?.tours || [];
    if (tours.length === 0) {
      statusEl.textContent = 'Brak skonfigurowanych samouczkow.';
      toursListEl.innerHTML = '';
      return;
    }
    statusEl.textContent = 'Dostepne samouczki:';
    renderTours(tours, tab);
  } catch (err) {
    statusEl.textContent = 'Odswiez strone Jiry, aby wlaczyc rozszerzenie.';
    toursListEl.innerHTML = '';
  }
}

async function signIn(provider) {
  authErrorEl.textContent = 'Logowanie...';
  const response = await chrome.runtime.sendMessage({ type: 'JOC_SIGN_IN', provider });
  if (response.ok) {
    authErrorEl.textContent = '';
    await refreshAuth();
    await refreshStatus();
  } else {
    authErrorEl.textContent = response.error || 'Logowanie nie powiodlo sie.';
  }
}

signinMicrosoftBtn.addEventListener('click', () => signIn('microsoft'));
signinAtlassianBtn.addEventListener('click', () => signIn('atlassian'));

signoutBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'JOC_SIGN_OUT' });
  await refreshAuth();
});

optionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

(async function init() {
  const { signedIn } = await refreshAuth();
  if (signedIn) {
    await refreshStatus();
  }
})();
