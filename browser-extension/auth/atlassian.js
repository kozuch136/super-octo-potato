import { generatePkcePair, generateRandomString } from './pkce.js';

// Logowanie Atlassian (OAuth 2.0 3LO). Czesc publiczna (ekran logowania)
// dzieje sie tutaj z PKCE, ale wymiane "code" na token robi appka Forge
// (`exchangeUrl` - patrz src/atlassianOAuth.js w katalogu glownym repo),
// bo tylko Forge moze bezpiecznie przechowac client_secret tej aplikacji
// OAuth. Rozszerzenie nigdy nie widzi ani nie przechowuje tego sekretu.
export async function signInWithAtlassian({ clientId, exchangeUrl }) {
  if (!clientId || !exchangeUrl) {
    throw new Error(
      'Brak konfiguracji Atlassian (Client ID / adres wymiany) - ustaw w Ustawieniach rozszerzenia.'
    );
  }

  const redirectUri = chrome.identity.getRedirectURL();
  const { verifier, challenge } = await generatePkcePair();
  const state = generateRandomString(16);

  const authUrl = new URL('https://auth.atlassian.com/authorize');
  authUrl.searchParams.set('audience', 'api.atlassian.com');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('scope', 'read:me offline_access');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);

  const redirectResult = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });
  if (!redirectResult) {
    throw new Error('Logowanie Atlassian zostalo anulowane.');
  }

  const resultUrl = new URL(redirectResult);
  const authError = resultUrl.searchParams.get('error');
  if (authError) {
    throw new Error(`Logowanie Atlassian nie powiodlo sie: ${authError}`);
  }
  const code = resultUrl.searchParams.get('code');
  const returnedState = resultUrl.searchParams.get('state');
  if (!code || returnedState !== state) {
    throw new Error('Logowanie Atlassian nie powiodlo sie (brak kodu lub niezgodny "state").');
  }

  const tokenResponse = await fetch(exchangeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri, codeVerifier: verifier }),
  });

  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    throw new Error(
      `Wymiana kodu na token Atlassian nie powiodla sie (status ${tokenResponse.status}): ${details}`
    );
  }

  const tokens = await tokenResponse.json();
  return {
    provider: 'atlassian',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
}
