import { storage } from '@forge/api';
import { getBearerToken, identifyBearer } from './identity.js';

// Endpoint, do ktorego rozszerzenie przegladarki zglasza zdarzenia
// logowania i postepu w samouczkach (patrz browser-extension/background.js
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

function emptyTourProgress() {
  return { completedStepIds: [], tourOutcome: null, tourCompletedAt: null };
}

async function upsertReport(key, identity, { event, tourId, stepId }) {
  const existing = (await storage.get(key)) || {
    firstSeenAt: Date.now(),
    tours: {},
  };

  const tours = { ...(existing.tours || {}) };
  if (tourId) {
    const tourProgress = tours[tourId] || emptyTourProgress();
    if (event === 'step_completed' && stepId) {
      tourProgress.completedStepIds = Array.from(
        new Set([...(tourProgress.completedStepIds || []), stepId])
      );
    }
    if (event === 'tour_completed' || event === 'tour_skipped') {
      tourProgress.tourCompletedAt = Date.now();
      tourProgress.tourOutcome = event === 'tour_completed' ? 'completed' : 'skipped';
    }
    tours[tourId] = tourProgress;
  }

  const merged = {
    ...existing,
    source: 'extension',
    provider: identity.provider,
    name: identity.name,
    email: identity.email,
    tours,
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

  const { event, tourId, stepId } = payload;
  const key = reportKey(identity.provider, identity.subjectId);
  const record = await upsertReport(key, identity, { event, tourId, stepId });
  return json(200, { ok: true, record });
}
