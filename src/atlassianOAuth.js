import { fetch } from '@forge/api';
import { fetchAtlassianProfile, signAppAtlassianToken } from './identity.js';

// Rozszerzenie przegladarki NIE moze bezpiecznie przechowac client_secret
// (kazdy moze rozpakowac .crx i go odczytac), wiec wymiane kodu autoryzacji
// na token robimy tutaj, po stronie Forge, gdzie sekret siedzi wylacznie w
// zaszyfrowanej zmiennej srodowiskowej:
//   forge variables set --encrypt ATLASSIAN_OAUTH_CLIENT_ID <client id>
//   forge variables set --encrypt ATLASSIAN_OAUTH_CLIENT_SECRET <client secret>
//   forge variables set --encrypt ATLASSIAN_SESSION_SECRET <losowy sekret>
// (client id tez trzymamy jako zmienna, zeby nie musial byc zaszyty w kodzie
// ani po stronie rozszerzenia).
//
// Rozszerzenie samo robi tylko czesc publiczna (przekierowanie na ekran
// logowania Atlassiana z PKCE) i przysyla tu wylacznie `code` + `code_verifier`
// + `redirect_uri` do wymiany.
//
// Po udanej wymianie NIE zwracamy rozszerzeniu surowego tokenu Atlassiana -
// to nieprzezroczysty (opaque) token, ktorego nie da sie pozniej zweryfikowac
// lokalnie (patrz src/identity.js). Zamiast tego pobieramy tozsamosc
// (account_id/name/email) i wystawiamy WLASNY, podpisany JWT z audience
// specyficznym dla tej appki - to on trafia do rozszerzenia i jest pozniej
// wysylany jako Bearer do webTrigger.js / onboardingReport.js, gdzie mozna
// go zweryfikowac w pelni lokalnie (podpis + aud + iss), tak samo jak token
// Microsoftu.

const TOKEN_URL = 'https://auth.atlassian.com/oauth/token';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ['*'],
  'Access-Control-Allow-Methods': ['POST, OPTIONS'],
  'Access-Control-Allow-Headers': ['Content-Type'],
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': ['application/json'] },
    body: JSON.stringify(body),
  };
}

export async function handler(request) {
  if (request.method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const clientId = process.env.ATLASSIAN_OAUTH_CLIENT_ID;
  const clientSecret = process.env.ATLASSIAN_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return json(500, {
      error:
        'OAuth Atlassian nie jest skonfigurowany po stronie Forge (brak ATLASSIAN_OAUTH_CLIENT_ID / ATLASSIAN_OAUTH_CLIENT_SECRET).',
    });
  }

  let payload;
  try {
    payload = JSON.parse(request.body || '{}');
  } catch (err) {
    return json(400, { error: 'Nieprawidlowy JSON w zapytaniu.' });
  }

  const { code, redirectUri, codeVerifier } = payload;
  if (!code || !redirectUri) {
    return json(400, { error: 'Brakuje "code" lub "redirectUri".' });
  }

  const tokenResponse = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    return json(tokenResponse.status, {
      error: 'Wymiana kodu na token Atlassian nie powiodla sie.',
      details,
    });
  }

  const atlassianTokens = await tokenResponse.json();

  let profile;
  try {
    profile = await fetchAtlassianProfile(atlassianTokens.access_token);
  } catch (err) {
    return json(502, { error: 'Nie udalo sie pobrac profilu z Atlassiana po zalogowaniu.' });
  }

  const expiresIn = atlassianTokens.expires_in || 3600;
  let appToken;
  try {
    appToken = await signAppAtlassianToken(
      { accountId: profile.account_id, name: profile.name, email: profile.email },
      expiresIn
    );
  } catch (err) {
    return json(500, { error: err.message || 'Nie udalo sie wystawic tokenu aplikacji.' });
  }

  return json(200, {
    access_token: appToken,
    expires_in: expiresIn,
  });
}
