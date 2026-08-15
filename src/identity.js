import { fetch } from '@forge/api';
import { jwtVerify, createRemoteJWKSet, SignJWT } from 'jose';

// Wspolna logika weryfikacji tokenu logowania (Microsoft Entra ID / Atlassian),
// uzywana zarowno przez src/webTrigger.js (synchronizacja samouczkow - tylko
// potwierdza, ze token jest wazny), jak i src/onboardingReport.js (musi
// dodatkowo wiedziec KTO wykonal akcje, do raportu w panelu admina).

let msJwks = null;

// Weryfikujemy ID TOKEN (nie access token) Microsoftu - to on jest
// gwarantowanym, samopodpisanym JWT z audience = nasz client_id i niesie
// dane tozsamosci (imie, e-mail). Access token przy samych scope'ach OIDC
// (openid profile email, bez zadnego zasobu API) nie jest gwarantowany jako
// weryfikowalny JWT, wiec extension wysyla tutaj idToken jako Bearer.
async function verifyMicrosoftIdToken(idToken, clientId, tenantId) {
  if (!msJwks) {
    msJwks = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)
    );
  }
  const { payload } = await jwtVerify(idToken, msJwks, {
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    audience: clientId,
  });
  return payload;
}

// --- Atlassian ---
//
// OAuth 2.0 (3LO) Atlassiana wydaje NIEPRZEZROCZYSTE (opaque) tokeny dostepu -
// to nie JWT, wiec nie da sie ich zweryfikowac lokalnie (podpis, aud, iss).
// Atlassian nie udostepnia tez publicznego endpointu introspekcji tokenu dla
// aplikacji trzecich. Jedyny sposob sprawdzenia "czy token jest wazny" to
// zapytanie GET https://api.atlassian.com/me - ktore jednak potwierdza tylko
// TOZSAMOSC (kim jest wlasciciel), a NIE to, ze token zostal wydany akurat
// DLA TEJ aplikacji (kazdy wazny token Atlassiana z podstawowym scope'em
// tozsamosci przejdzie ten test, niezaleznie od tego, ktora integracja o
// niego poprosila).
//
// Dlatego zamiast ufac surowemu tokenowi Atlassiana bezposrednio, appka
// wystawia WLASNY, podpisany JWT (patrz signAppAtlassianToken - wywolywane
// raz, w src/atlassianOAuth.js, zaraz po wymianie kodu na token i pobraniu
// profilu). Rozszerzenie przechowuje i wysyla dalej TEN token, a nie
// surowy token Atlassiana - dzieki temu weryfikacja tutaj jest lokalna
// (bez wywolania sieciowego) i sprawdza `aud`/`iss`, dokladnie tak samo jak
// dla Microsoftu.

const ATLASSIAN_TOKEN_ISSUER = 'urn:jira-onboarding-guide';
const ATLASSIAN_TOKEN_AUDIENCE = 'jira-onboarding-guide-extension';

function getAtlassianSigningKey() {
  const secret = process.env.ATLASSIAN_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'Brak ATLASSIAN_SESSION_SECRET - ustaw: forge variables set --encrypt ATLASSIAN_SESSION_SECRET <losowy-sekret>'
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signAppAtlassianToken({ accountId, name, email }, expiresInSeconds) {
  const key = getAtlassianSigningKey();
  return new SignJWT({ name: name || null, email: email || null })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(accountId)
    .setIssuer(ATLASSIAN_TOKEN_ISSUER)
    .setAudience(ATLASSIAN_TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${Math.max(60, Math.floor(expiresInSeconds))}s`)
    .sign(key);
}

async function verifyAppAtlassianToken(token) {
  const key = getAtlassianSigningKey();
  const { payload } = await jwtVerify(token, key, {
    issuer: ATLASSIAN_TOKEN_ISSUER,
    audience: ATLASSIAN_TOKEN_AUDIENCE,
  });
  return payload;
}

// Uzywana tylko przy logowaniu (src/atlassianOAuth.js), zeby ustalic
// tozsamosc do zaszycia we wlasnym tokenie - patrz komentarz wyzej.
export async function fetchAtlassianProfile(accessToken) {
  const response = await fetch('https://api.atlassian.com/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Nie udalo sie pobrac profilu Atlassian (status ${response.status}).`);
  }
  return response.json();
}

export function getBearerToken(request) {
  const authHeader =
    request.headers?.authorization?.[0] || request.headers?.Authorization?.[0];
  return authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
}

// Uzywane przez webTrigger.js: tylko potwierdza waznosc tokenu (bez
// wyciagania tozsamosci) - wystarcza do prostej autoryzacji GET.
export async function isBearerValid(token) {
  const msClientId = process.env.MS_OAUTH_CLIENT_ID;
  const msTenantId = process.env.MS_OAUTH_TENANT_ID;
  if (msClientId && msTenantId) {
    try {
      await verifyMicrosoftIdToken(token, msClientId, msTenantId);
      return true;
    } catch (err) {
      // nie jest to (poprawny) token Microsoft - sprobuj Atlassian ponizej
    }
  }
  if (process.env.REQUIRE_ATLASSIAN_AUTH === 'true') {
    try {
      await verifyAppAtlassianToken(token);
      return true;
    } catch (err) {
      // niepoprawny token Atlassian
    }
  }
  return false;
}

// Uzywane przez onboardingReport.js: musi wiedziec KTO wykonal akcje, wiec
// zawsze probuje ustalic tozsamosc (niezaleznie od REQUIRE_ATLASSIAN_AUTH,
// ktory dotyczy tylko wlaczania wymogu logowania do samej synchronizacji).
export async function identifyBearer(token) {
  const msClientId = process.env.MS_OAUTH_CLIENT_ID;
  const msTenantId = process.env.MS_OAUTH_TENANT_ID;
  if (msClientId && msTenantId) {
    try {
      const payload = await verifyMicrosoftIdToken(token, msClientId, msTenantId);
      return {
        provider: 'microsoft',
        subjectId: payload.oid || payload.sub,
        name: payload.name || null,
        email: payload.preferred_username || payload.email || null,
      };
    } catch (err) {
      // nie jest to (poprawny) token Microsoft - sprobuj Atlassian ponizej
    }
  }
  try {
    const payload = await verifyAppAtlassianToken(token);
    return {
      provider: 'atlassian',
      subjectId: payload.sub,
      name: payload.name || null,
      email: payload.email || null,
    };
  } catch (err) {
    return null;
  }
}
