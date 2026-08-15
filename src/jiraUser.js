import { requestJira, route } from '@forge/api';

// Wspolny helper - pobiera wyswietlana nazwe/e-mail uzytkownika Jiry po
// accountId, "as app" (nie wymaga dodatkowej zgody uzytkownika, ale wymaga
// scope'u read:jira-user w manifest.yml). Uzywane przez panel na widoku
// zgloszenia i panel na portalu klienta - dla kont typu "customer" (portal
// JSM, np. pracownicy bez licencji Jira) ten endpoint moze nie zwrocic
// pelnych danych zaleznie od uprawnien konta; w takim wypadku po prostu
// nie pokazujemy nazwy w raporcie (accountId wystarczy jako identyfikator).
export async function fetchUserProfile(accountId) {
  try {
    const response = await requestJira(route`/rest/api/3/user?accountId=${accountId}`);
    if (response.ok) {
      const user = await response.json();
      return { name: user.displayName || null, email: user.emailAddress || null };
    }
  } catch (err) {
    // brak profilu nie jest krytyczny - wywolujacy pokaze accountId zamiast nazwy
  }
  return { name: null, email: null };
}
