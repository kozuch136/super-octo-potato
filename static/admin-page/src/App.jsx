import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';
import Button from '@atlaskit/button/standard-button';
import SectionMessage from '@atlaskit/section-message';
import Textfield from '@atlaskit/textfield';
import TextArea from '@atlaskit/textarea';
import './App.css';

let nextTempId = 0;
const newStep = () => ({
  id: `step-${Date.now()}-${nextTempId++}`,
  selector: '',
  heading: '',
  description: '',
});
const newTour = () => ({
  id: `tour-${Date.now()}-${nextTempId++}`,
  title: '',
  description: '',
  audience: 'employee',
  steps: [],
});

function CopyableUrl({ label, url }) {
  const [copyStatus, setCopyStatus] = useState(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus('Skopiowano.');
    } catch (err) {
      setCopyStatus('Nie udalo sie skopiowac - zaznacz i skopiuj recznie.');
    }
  };

  return (
    <div className="sync-panel__field">
      <label>{label}</label>
      <div className="sync-panel__row">
        <Textfield value={url ?? 'Wczytywanie...'} isReadOnly isDisabled={!url} />
        <Button onClick={copy} isDisabled={!url}>
          Kopiuj
        </Button>
      </div>
      {copyStatus && <p className="sync-panel__status">{copyStatus}</p>}
    </div>
  );
}

function SyncPanel() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    invoke('getSyncInfo')
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  return (
    <SectionMessage title="Synchronizacja z rozszerzeniem przegladarki" appearance="discovery">
      <p>
        Wklej pierwszy adres w Ustawieniach rozszerzenia przegladarki
        (sekcja „Synchronizacja z aplikacja Forge”), aby rozszerzenie
        automatycznie pobieralo te same samouczki, ktore konfigurujesz tutaj -
        bez recznego przepisywania tresci w dwoch miejscach.
      </p>
      <CopyableUrl label="Adres synchronizacji samouczkow" url={info?.url} />
      <p>
        Drugi adres jest potrzebny tylko, jesli w rozszerzeniu wlaczysz
        opcjonalne logowanie przez Atlassian (sekcja „Logowanie” w
        Ustawieniach rozszerzenia) - patrz{' '}
        <code>browser-extension/auth/README.md</code>.
      </p>
      <CopyableUrl
        label="Adres wymiany tokenu logowania Atlassian"
        url={info?.atlassianOAuthExchangeUrl}
      />
      <p>
        Trzeci adres tez dziala tylko przy wlaczonym logowaniu - to on odbiera
        zdarzenia „kto sie zalogowal / co przeszedl” pokazywane w raporcie
        ponizej.
      </p>
      <CopyableUrl label="Adres raportowania (logowanie + postep)" url={info?.reportUrl} />
    </SectionMessage>
  );
}

function sourceLabel(record) {
  if (record.source === 'jira-panel') return 'Panel w Jirze (pracownik)';
  if (record.source === 'portal') return 'Portal klienta';
  if (record.source === 'extension') {
    return record.provider === 'microsoft'
      ? 'Rozszerzenie (Microsoft)'
      : 'Rozszerzenie (Atlassian)';
  }
  return record.source || record.provider || '—';
}

const OUTCOME_LABELS = {
  completed: 'ukonczony',
  skipped: 'pominiety',
};

function formatDate(timestamp) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString('pl-PL');
}

function ReportPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    invoke('getOnboardingReport')
      .then(setData)
      .catch(() => setError('Nie udalo sie wczytac raportu.'));
  };

  useEffect(load, []);

  const tours = data?.tours || [];
  const records = data?.records || [];

  return (
    <SectionMessage title="Kto sie zalogowal i co przeszedl" appearance="information">
      <p>
        Dane pochodza z panelu na widoku zgloszenia (kazdy pracownik Jiry - bez
        logowania, identyfikowany po koncie Jira), z panelu na portalu klienta JSM
        (pracownicy bez licencji Jira, ktorzy zgloszaja prosby przez portal) oraz
        z rozszerzenia przegladarki (tylko jesli wlaczono w nim logowanie
        Microsoft/Atlassian - patrz sekcja powyzej). To sa dane osobowe (imie,
        e-mail) - upewnij sie, ze pracownicy wiedza, ze postep w samouczkach jest
        sledzony.
      </p>
      <div className="report-panel__actions">
        <Button onClick={load}>Odswiez</Button>
      </div>
      {error && <p className="sync-panel__status">{error}</p>}
      {data && records.length === 0 && <p>Jeszcze nikt nie uruchomil zadnego samouczka.</p>}
      {data && records.length > 0 && (
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th>Osoba</th>
                <th>Zrodlo</th>
                {tours.map((t) => (
                  <th key={t.id}>{t.title}</th>
                ))}
                <th>Ostatnia aktywnosc</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.key}>
                  <td>
                    <div>{record.name || '(brak nazwy)'}</div>
                    <div className="report-table__muted">{record.email || record.key}</div>
                  </td>
                  <td>{sourceLabel(record)}</td>
                  {tours.map((t) => {
                    const progress = record.tours?.[t.id];
                    if (!progress) {
                      return (
                        <td key={t.id} className="report-table__muted">
                          —
                        </td>
                      );
                    }
                    const completed = (progress.completedStepIds || []).length;
                    return (
                      <td key={t.id}>
                        {completed} / {t.totalSteps}
                        {progress.tourOutcome
                          ? ` (${OUTCOME_LABELS[progress.tourOutcome] || progress.tourOutcome})`
                          : ''}
                      </td>
                    );
                  })}
                  <td>{formatDate(record.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionMessage>
  );
}

function TourEditor({ tour, index, tourCount, onChange, onRemove, onMove }) {
  const [expanded, setExpanded] = useState(index === 0);

  const updateField = (field, value) => onChange({ ...tour, [field]: value });

  const updateStep = (stepIndex, field, value) => {
    const steps = tour.steps.map((s, i) => (i === stepIndex ? { ...s, [field]: value } : s));
    onChange({ ...tour, steps });
  };

  const removeStep = (stepIndex) => {
    onChange({ ...tour, steps: tour.steps.filter((_, i) => i !== stepIndex) });
  };

  const moveStep = (stepIndex, direction) => {
    const target = stepIndex + direction;
    if (target < 0 || target >= tour.steps.length) return;
    const steps = [...tour.steps];
    [steps[stepIndex], steps[target]] = [steps[target], steps[stepIndex]];
    onChange({ ...tour, steps });
  };

  const addStep = () => {
    onChange({ ...tour, steps: [...tour.steps, newStep()] });
  };

  return (
    <div className="tour-editor">
      <div className="tour-editor__header">
        <button
          type="button"
          className="tour-editor__toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? '▾' : '▸'} {tour.title || '(bez tytulu)'} ({tour.steps.length}{' '}
          {tour.steps.length === 1 ? 'krok' : 'krokow'})
        </button>
        <div className="row">
          <Button onClick={() => onMove(-1)} isDisabled={index === 0}>
            W gore
          </Button>
          <Button onClick={() => onMove(1)} isDisabled={index === tourCount - 1}>
            W dol
          </Button>
          <Button appearance="danger" onClick={onRemove}>
            Usun samouczek
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="tour-editor__body">
          <div className="step-editor__row">
            <label>Identyfikator samouczka</label>
            <Textfield value={tour.id} onChange={(e) => updateField('id', e.target.value)} />
          </div>
          <div className="step-editor__row">
            <label>Tytul</label>
            <Textfield value={tour.title} onChange={(e) => updateField('title', e.target.value)} />
          </div>
          <div className="step-editor__row">
            <label>Opis (widoczny w rozszerzeniu i raporcie)</label>
            <Textfield
              value={tour.description ?? ''}
              onChange={(e) => updateField('description', e.target.value)}
            />
          </div>
          <div className="step-editor__row">
            <label>Odbiorcy (ktory panel Forge domyslnie pokazuje ten samouczek)</label>
            <select
              className="tour-editor__audience-select"
              value={tour.audience || 'employee'}
              onChange={(e) => updateField('audience', e.target.value)}
            >
              <option value="employee">Pracownicy (panel na zgloszeniu)</option>
              <option value="customer">Portal klienta (zgloszenie w JSM)</option>
            </select>
          </div>

          <div className="steps-list">
            {tour.steps.map((step, stepIndex) => (
              <div className="step-editor" key={step.id}>
                <div className="step-editor__row">
                  <label>Identyfikator pola (np. priority)</label>
                  <Textfield
                    value={step.id}
                    onChange={(e) => updateStep(stepIndex, 'id', e.target.value)}
                  />
                </div>
                <div className="step-editor__row">
                  <label>Selektor CSS (dla rozszerzenia przegladarki)</label>
                  <Textfield
                    value={step.selector ?? ''}
                    placeholder='np. [data-testid*="priority-field"]'
                    onChange={(e) => updateStep(stepIndex, 'selector', e.target.value)}
                  />
                </div>
                <div className="step-editor__row">
                  <label>Naglowek kroku</label>
                  <Textfield
                    value={step.heading}
                    onChange={(e) => updateStep(stepIndex, 'heading', e.target.value)}
                  />
                </div>
                <div className="step-editor__row">
                  <label>Opis / wskazowka</label>
                  <TextArea
                    value={step.description}
                    onChange={(e) => updateStep(stepIndex, 'description', e.target.value)}
                  />
                </div>
                <div className="step-editor__actions">
                  <Button onClick={() => moveStep(stepIndex, -1)} isDisabled={stepIndex === 0}>
                    W gore
                  </Button>
                  <Button
                    onClick={() => moveStep(stepIndex, 1)}
                    isDisabled={stepIndex === tour.steps.length - 1}
                  >
                    W dol
                  </Button>
                  <Button appearance="danger" onClick={() => removeStep(stepIndex)}>
                    Usun krok
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="row">
            <Button onClick={addStep}>Dodaj krok</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    invoke('getOnboardingTours')
      .then((loaded) => {
        setTours(loaded);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const updateTour = (index, updatedTour) => {
    setTours((current) => current.map((t, i) => (i === index ? updatedTour : t)));
  };

  const removeTour = (index) => {
    setTours((current) => current.filter((_, i) => i !== index));
  };

  const moveTour = (index, direction) => {
    setTours((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };

  const addTour = () => {
    setTours((current) => [...current, newTour()]);
  };

  const save = async () => {
    setStatus(null);
    try {
      await invoke('saveOnboardingTours', { tours });
      setStatus({ type: 'success', message: 'Zapisano samouczki.' });
    } catch (err) {
      setStatus({ type: 'error', message: 'Nie udalo sie zapisac zmian.' });
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="admin-page">
      <h2>Samouczki onboardingowe</h2>
      <SectionMessage appearance="information">
        <p>
          Zdefiniuj samouczki, ktore pracownicy zobacza przy pierwszej wizycie na danym
          ekranie Jiry. Pierwszy samouczek („ticket-creation”) pokazuje sie tez w panelu
          na widoku zgloszenia (jego mock-up pol) — pozostale dzialaja wylacznie w
          rozszerzeniu przegladarki, ktore realnie podswietla pola na danym ekranie.
          Pole „Selektor CSS” kazdego kroku jest uzywane wylacznie przez rozszerzenie.
        </p>
      </SectionMessage>

      <SyncPanel />

      <ReportPanel />

      {status && (
        <SectionMessage appearance={status.type === 'success' ? 'success' : 'error'}>
          <p>{status.message}</p>
        </SectionMessage>
      )}

      <div className="tours-list">
        {tours.map((tour, index) => (
          <TourEditor
            key={tour.id}
            tour={tour}
            index={index}
            tourCount={tours.length}
            onChange={(t) => updateTour(index, t)}
            onRemove={() => removeTour(index)}
            onMove={(dir) => moveTour(index, dir)}
          />
        ))}
      </div>

      <div className="admin-page__actions">
        <Button onClick={addTour}>Dodaj samouczek</Button>
        <Button appearance="primary" onClick={save}>
          Zapisz
        </Button>
      </div>
    </div>
  );
}
