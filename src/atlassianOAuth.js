import { fetch } from '@forge/api';

// Rozszerzenie przegladarki NIE moze bezpiecznie przechowac client_secret
// (kazdy moze rozpakowac .crx i go odczytac), wiec wymiane kodu autoryzacji
// na token robimy tutaj, po stronie Forge, gdzie sekret siedzi wylacznie w
// zaszyfrowanej zmiennej srodowiskowej:
//   forge variables set --encrypt ATLASSIAN_OAUTH_CLIENT_ID <client id>
//   forge variables set --encrypt ATLASSIAN_OAUTH_CLIENT_SECRET <client secret>
// (client id tez trzymamy jako zmienna, zeby nie musial byc zaszyty w kodzie
// ani po stronie rozszerzenia).
//
// Rozszerzenie samo robi tylko czesc publiczna (przekierowanie na ekran
// logowania Atlassiana z PKCE) i przysyla tu wylacznie `code` + `code_verifier`
// + `redirect_uri` do wymiany.

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

  const tokenBody = await tokenResponse.text();
  if (!tokenResponse.ok) {
    return json(tokenResponse.status, {
      error: 'Wymiana kodu na token Atlassian nie powiodla sie.',
      details: tokenBody,
    });
  }

  // Przekazujemy dalej dokladnie to, co zwrocil Atlassian (access_token,
  // refresh_token, expires_in, ...) - rozszerzenie samo je zapisuje.
  return {
    statusCode: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': ['application/json'] },
    body: tokenBody,
  };
}
