import { fetch } from '@forge/api';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// Wspolna logika weryfikacji tokenu logowania (Microsoft Entra ID / Atlassian),
// uzywana zarowno przez src/webTrigger.js (synchronizacja krokow - tylko
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

async function fetchAtlassianProfile(accessToken) {
  const response = await fetch('https://api.atlassian.com/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Token Atlassian odrzucony (status ${response.status}).`);
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
      await fetchAtlassianProfile(token);
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
    const profile = await fetchAtlassianProfile(token);
    return {
      provider: 'atlassian',
      subjectId: profile.account_id,
      name: profile.name || null,
      email: profile.email || null,
    };
  } catch (err) {
    return null;
  }
}
