import { getSteps } from './steps.js';

// Publiczny endpoint odczytywany przez rozszerzenie przegladarki, zeby
// trzymac te sama tresc samouczka co appka Forge (jedno zrodlo prawdy,
// konfigurowane w panelu admina Jiry). Adres URL generuje Forge - patrz
// resolver `getSyncInfo`.
//
// Zwraca CORS `Access-Control-Allow-Origin: *`, bo endpoint udostepnia
// wylacznie tresc samouczka (nazwy pol i podpowiedzi tekstowe) - nic
// wrazliwego. Jesli potrzebna jest dodatkowa ochrona przed przypadkowym
// wyciekiem adresu, ustaw zmienna srodowiskowa SYNC_TOKEN
// (`forge variables set --encrypt SYNC_TOKEN <wartosc>`) - wowczas
// endpoint zacznie wymagac `?token=<wartosc>` w adresie.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ['*'],
  'Access-Control-Allow-Methods': ['GET, OPTIONS'],
  'Access-Control-Allow-Headers': ['Content-Type'],
};

export async function handler(request) {
  if (request.method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const requiredToken = process.env.SYNC_TOKEN;
  if (requiredToken) {
    const providedToken = request.queryParameters?.token?.[0];
    if (providedToken !== requiredToken) {
      return {
        statusCode: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': ['application/json'] },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }
  }

  const steps = await getSteps();
  return {
    statusCode: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': ['application/json'] },
    body: JSON.stringify({ steps }),
  };
}
