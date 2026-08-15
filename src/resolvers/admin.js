import Resolver from '@forge/resolver';
import { webTrigger, storage, startsWith } from '@forge/api';
import { getTours, setTours } from '../tours.js';

// Resolver uzywany WYLACZNIE przez strone administracyjna
// (jira:adminPage, patrz manifest.yml -> resolver: {function: adminResolver}).
// Rejestrowanie tych funkcji na OSOBNEJ funkcji Forge (nie tej samej co
// panel na widoku zgloszenia) jest tu celowe: sam modul jira:adminPage juz
// blokuje nie-adminom wejscie na strone, ale gdyby admin-owe resolvery
// dzielily backend z panelem widocznym dla kazdego pracownika, kazdy
// pracownik mialby techniczna mozliwosc wywolania ich wprost przez most
// (@forge/bridge) panelu, z pominieciem tej blokady. Osobna funkcja =
// osobny, w ogole nieosiagalny z panelu, kanal wywolan.

const resolver = new Resolver();

resolver.define('getOnboardingTours', async () => {
  return getTours();
});

resolver.define('saveOnboardingTours', async (req) => {
  const { tours } = req.payload;
  if (!Array.isArray(tours)) {
    throw new Error('tours musi byc tablica');
  }
  await setTours(tours);
  return { ok: true };
});

// Adresy, pod ktorymi rozszerzenie przegladarki laczy sie z appka Forge -
// wyswietlane w panelu admina do skopiowania do ustawien rozszerzenia.
resolver.define('getSyncInfo', async () => {
  const [url, atlassianOAuthExchangeUrl, reportUrl] = await Promise.all([
    webTrigger.getUrl('onboarding-steps-webtrigger'),
    webTrigger.getUrl('atlassian-oauth-exchange'),
    webTrigger.getUrl('onboarding-report'),
  ]);
  return { url, atlassianOAuthExchangeUrl, reportUrl };
});

// Raport "kto sie zalogowal / jakie kroki przeszedl" - agreguje wpisy z
// panelu Jiry (report:panel:jira:*, patrz src/resolvers/panel.js) oraz z
// rozszerzenia przegladarki (report:extension:*, patrz
// src/onboardingReport.js). Klucze sa enumerowane po prefiksie - patrz
// @forge/storage query API (storage.query().where('key', startsWith(...))).
// Kazdy rekord niesie zagniezdzony postep per samouczek (`tours: {tourId:
// {completedStepIds, tourOutcome, tourCompletedAt}}`) - definicje
// samouczkow (tytul, liczba krokow) dolaczamy osobno, zeby UI mogl
// wyliczyc "X / Y" bez dodatkowego wywolania.
resolver.define('getOnboardingReport', async () => {
  const records = [];
  let cursor;
  // Zabezpieczenie przed nieskonczona petla / bardzo duza organizacja -
  // do ~1000 rekordow (20 stron po 50). Przy wiekszych organizacjach
  // warto rozwazyc dedykowana encje Forge z prawdziwym query zamiast
  // enumeracji po prefiksie.
  for (let page = 0; page < 20; page += 1) {
    let query = storage.query().where('key', startsWith('report:')).limit(50);
    if (cursor) {
      query = query.cursor(cursor);
    }
    const result = await query.getMany();
    records.push(...result.results);
    if (!result.nextCursor) {
      break;
    }
    cursor = result.nextCursor;
  }

  const tours = await getTours();

  return {
    tours: tours.map((t) => ({ id: t.id, title: t.title, totalSteps: t.steps.length })),
    records: records.map(({ key, value }) => ({ key, ...value })),
  };
});

export const handler = resolver.getDefinitions();
