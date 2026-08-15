import { fetch } from '@forge/api';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { getSteps } from './steps.js';

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
//    `Authorization: Bearer <token>`:
//    - Microsoft (Entra ID): ustaw MS_OAUTH_CLIENT_ID i MS_OAUTH_TENANT_ID -
//      wtedy token musi byc poprawnym, podpisanym JWT wydanym przez ten
//      tenant dla tej aplikacji (weryfikacja podpisu wzgledem JWKS
//      Microsoftu + sprawdzenie "iss"/"aud"/waznosci).
//    - Atlassian: ustaw REQUIRE_ATLASSIAN_AUTH=true - wtedy token musi byc
//      zywym, wazny tokenem dostepu Atlassiana (sprawdzanym wywolaniem
//      GET https://api.atlassian.com/me). Uwaga: to potwierdza, ze token
//      jest wazny i nalezy do zalogowanego konta Atlassian, ale NIE
//      weryfikuje, ze zostal wydany akurat dla naszej aplikacji OAuth
//      (Atlassian nie udostepnia do tego prostego, publicznego
//      introspection endpointu) - dla wiekszej pewnosci polacz z SYNC_TOKEN.
//
// Jesli skonfigurowano ktorykolwiek z powyzszych mechanizmow, endpoint
// zaczyna wymagac autoryzacji (przestaje byc otwarty).

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ['*'],
  'Access-Control-Allow-Methods': ['GET, OPTIONS'],
  'Access-Control-Allow-Headers': ['Content-Type, Authorization'],
};

let msJwks = null;

async function validateMicrosoftToken(token, clientId, tenantId) {
  if (!msJwks) {
    msJwks = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)
    );
  }
  await jwtVerify(token, msJwks, {
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    audience: clientId,
  });
}

async function validateAtlassianToken(token) {
  const response = await fetch('https://api.atlassian.com/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Token Atlassian odrzucony (status ${response.status}).`);
  }
}

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

  const authHeader =
    request.headers?.authorization?.[0] || request.headers?.Authorization?.[0];
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;

  if (bearerToken && msClientId && msTenantId) {
    try {
      await validateMicrosoftToken(bearerToken, msClientId, msTenantId);
      return true;
    } catch (err) {
      // nie jest to (poprawny) token Microsoft - sprobuj Atlassian ponizej
    }
  }

  if (bearerToken && requireAtlassian) {
    try {
      await validateAtlassianToken(bearerToken);
      return true;
    } catch (err) {
      // niepoprawny token Atlassian
    }
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
