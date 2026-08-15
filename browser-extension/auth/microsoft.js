import { generatePkcePair, generateRandomString } from './pkce.js';

// Logowanie Microsoft (Entra ID / Azure AD) jako "public client" - PKCE bez
// client_secret (rozszerzenie nie moze bezpiecznie przechowac sekretu).
// Wymaga zarejestrowania aplikacji w Entra admin center z redirect URI
// rownym `chrome.identity.getRedirectURL()` (dla tego rozszerzenia:
// https://eamneljpkombhcofgdkmgehjnefhodko.chromiumapp.org/) i wlaczonym
// "Allow public client flows".
export async function signInWithMicrosoft({ clientId, tenantId }) {
  if (!clientId || !tenantId) {
    throw new Error(
      'Brak konfiguracji Microsoft (Client ID / Tenant ID) - ustaw w Ustawieniach rozszerzenia.'
    );
  }

  const redirectUri = chrome.identity.getRedirectURL();
  const { verifier, challenge } = await generatePkcePair();
  const state = generateRandomString(16);

  const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('scope', 'openid profile email offline_access');
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);

  const redirectResult = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });
  if (!redirectResult) {
    throw new Error('Logowanie Microsoft zostalo anulowane.');
  }

  const resultUrl = new URL(redirectResult);
  const authError = resultUrl.searchParams.get('error');
  if (authError) {
    const description = resultUrl.searchParams.get('error_description') || authError;
    throw new Error(`Logowanie Microsoft nie powiodlo sie: ${description}`);
  }
  const code = resultUrl.searchParams.get('code');
  const returnedState = resultUrl.searchParams.get('state');
  if (!code || returnedState !== state) {
    throw new Error('Logowanie Microsoft nie powiodlo sie (brak kodu lub niezgodny "state").');
  }

  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
        scope: 'openid profile email offline_access',
      }),
    }
  );

  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    throw new Error(
      `Wymiana kodu na token Microsoft nie powiodla sie (status ${tokenResponse.status}): ${details}`
    );
  }

  const tokens = await tokenResponse.json();
  return {
    provider: 'microsoft',
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
}
