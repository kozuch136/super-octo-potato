import { getSteps } from './steps.js';
import { getBearerToken, isBearerValid } from './identity.js';

// Publiczny endpoint odczytywany przez rozszerzenie przegladarki, zeby
// trzymac te sama tresc samouczka co appka Forge (jedno zrodlo prawdy,
// konfigurowane w panelu admina Jiry). Adres URL generuje Forge - patrz
// resolver `getSyncInfo`.
//
// Domyslnie (bez skonfigurowanych zmiennych srodowiskowych) endpoint jest
// otwarty - zwraca wylacznie tresc samouczka (nazwy pol, podpowiedzi), nic
// wrazliwego. Mozna go zabezpieczyc na dwa sposoby, niezaleznie od siebie:
//
// 1. Staly token w adresie:
//    forge variables set --encrypt SYNC_TOKEN <sekret>
//    -> rozszerzenie musi wtedy wolac ?token=<sekret>
//
// 2. Prawdziwe logowanie uzytkownika (OAuth), token wysylany jako
//    `Authorization: Bearer <token>` - patrz src/identity.js:
//    - Microsoft (Entra ID): ustaw MS_OAUTH_CLIENT_ID i MS_OAUTH_TENANT_ID.
//    - Atlassian: ustaw REQUIRE_ATLASSIAN_AUTH=true.
//
// Jesli skonfigurowano ktorykolwiek z powyzszych mechanizmow, endpoint
// zaczyna wymagac autoryzacji (przestaje byc otwarty).

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ['*'],
  'Access-Control-Allow-Methods': ['GET, OPTIONS'],
  'Access-Control-Allow-Headers': ['Content-Type, Authorization'],
};

async function isAuthorized(request) {
  const syncToken = process.env.SYNC_TOKEN;
  const msClientId = process.env.MS_OAUTH_CLIENT_ID;
  const msTenantId = process.env.MS_OAUTH_TENANT_ID;
  const requireAtlassian = process.env.REQUIRE_ATLASSIAN_AUTH === 'true';

  const anyAuthConfigured = Boolean(
    syncToken || (msClientId && msTenantId) || requireAtlassian
  );
  if (!anyAuthConfigured) {
    return true; // domyslny, otwarty tryb - patrz komentarz na gorze pliku
  }

  if (syncToken) {
    const providedToken = request.queryParameters?.token?.[0];
    if (providedToken === syncToken) {
      return true;
    }
  }

  const bearerToken = getBearerToken(request);
  if (bearerToken && (await isBearerValid(bearerToken))) {
    return true;
  }

  return false;
}

export async function handler(request) {
  if (request.method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const authorized = await isAuthorized(request);
  if (!authorized) {
    return {
      statusCode: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': ['application/json'] },
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const steps = await getSteps();
  return {
    statusCode: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': ['application/json'] },
    body: JSON.stringify({ steps }),
  };
}
