import { storage } from '@forge/api';
import { getBearerToken, identifyBearer } from './identity.js';

// Endpoint, do ktorego rozszerzenie przegladarki zglasza zdarzenia
// logowania i postepu w samouczku (patrz browser-extension/background.js
// -> reportEvent). W przeciwienstwie do src/webTrigger.js (odczyt, moze
// zostac otwarty) ten endpoint ZAWSZE wymaga poprawnego tokenu logowania,
// bo bez niego nie ma czego raportowac - i tak wlasnie chce admin: "kto
// sie zalogowal i co przeszedl".

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ['*'],
  'Access-Control-Allow-Methods': ['POST, OPTIONS'],
  'Access-Control-Allow-Headers': ['Content-Type, Authorization'],
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': ['application/json'] },
    body: JSON.stringify(body),
  };
}

function reportKey(provider, subjectId) {
  return `report:extension:${provider}:${subjectId}`;
}

async function upsertReport(key, patch) {
  const existing = (await storage.get(key)) || {
    firstSeenAt: Date.now(),
    completedStepIds: [],
    tourCompletedAt: null,
    tourOutcome: null,
  };
  const stepIds = new Set([
    ...(existing.completedStepIds || []),
    ...(patch.completedStepIds || []),
  ]);
  const merged = {
    ...existing,
    ...patch,
    completedStepIds: Array.from(stepIds),
    lastActivityAt: Date.now(),
  };
  await storage.set(key, merged);
  return merged;
}

export async function handler(request) {
  if (request.method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const token = getBearerToken(request);
  if (!token) {
    return json(401, { error: 'Brak tokenu logowania.' });
  }
  const identity = await identifyBearer(token);
  if (!identity) {
    return json(401, { error: 'Nieprawidlowy lub wygasly token logowania.' });
  }

  let payload;
  try {
    payload = JSON.parse(request.body || '{}');
  } catch (err) {
    return json(400, { error: 'Nieprawidlowy JSON w zapytaniu.' });
  }

  const { event, stepId } = payload;
  const key = reportKey(identity.provider, identity.subjectId);

  const patch = {
    source: 'extension',
    provider: identity.provider,
    name: identity.name,
    email: identity.email,
  };
  if (event === 'step_completed' && stepId) {
    patch.completedStepIds = [stepId];
  }
  if (event === 'tour_completed' || event === 'tour_skipped') {
    patch.tourCompletedAt = Date.now();
    patch.tourOutcome = event === 'tour_completed' ? 'completed' : 'skipped';
  }

  const record = await upsertReport(key, patch);
  return json(200, { ok: true, record });
}
