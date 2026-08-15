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
        automatycznie pobieralo te same kroki, ktore konfigurujesz tutaj -
        bez recznego przepisywania tresci w dwoch miejscach.
      </p>
      <CopyableUrl label="Adres synchronizacji krokow" url={info?.url} />
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
    </SectionMessage>
  );
}

export default function App() {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    invoke('getOnboardingSteps')
      .then((loaded) => {
        setSteps(loaded);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const updateStep = (index, field, value) => {
    setSteps((current) =>
      current.map((step, i) => (i === index ? { ...step, [field]: value } : step))
    );
  };

  const removeStep = (index) => {
    setSteps((current) => current.filter((_, i) => i !== index));
  };

  const moveStep = (index, direction) => {
    setSteps((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) {
        return current;
      }
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };

  const addStep = () => {
    setSteps((current) => [...current, newStep()]);
  };

  const save = async () => {
    setStatus(null);
    try {
      await invoke('saveOnboardingSteps', { steps });
      setStatus({ type: 'success', message: 'Zapisano kroki samouczka.' });
    } catch (err) {
      setStatus({ type: 'error', message: 'Nie udalo sie zapisac zmian.' });
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="admin-page">
      <h2>Kroki samouczka onboardingowego</h2>
      <SectionMessage appearance="information">
        <p>
          Zdefiniuj kroki, ktore nowi pracownicy zobacza w panelu na widoku
          zgloszenia przy pierwszym logowaniu. Kazdy krok odpowiada polu
          ticketu i powinien opisywac procedure obowiazujaca w Twojej firmie.
          Pole „Selektor CSS” jest uzywane wylacznie przez rozszerzenie
          przegladarki (patrz sekcja synchronizacji nizej) - panel w Jirze go
          ignoruje.
        </p>
      </SectionMessage>

      <SyncPanel />

      {status && (
        <SectionMessage appearance={status.type === 'success' ? 'success' : 'error'}>
          <p>{status.message}</p>
        </SectionMessage>
      )}

      <div className="steps-list">
        {steps.map((step, index) => (
          <div className="step-editor" key={step.id}>
            <div className="step-editor__row">
              <label>Identyfikator pola (np. priority)</label>
              <Textfield
                value={step.id}
                onChange={(e) => updateStep(index, 'id', e.target.value)}
              />
            </div>
            <div className="step-editor__row">
              <label>Selektor CSS (dla rozszerzenia przegladarki)</label>
              <Textfield
                value={step.selector ?? ''}
                placeholder='np. [data-testid*="priority-field"]'
                onChange={(e) => updateStep(index, 'selector', e.target.value)}
              />
            </div>
            <div className="step-editor__row">
              <label>Naglowek kroku</label>
              <Textfield
                value={step.heading}
                onChange={(e) => updateStep(index, 'heading', e.target.value)}
              />
            </div>
            <div className="step-editor__row">
              <label>Opis / wskazowka</label>
              <TextArea
                value={step.description}
                onChange={(e) => updateStep(index, 'description', e.target.value)}
              />
            </div>
            <div className="step-editor__actions">
              <Button onClick={() => moveStep(index, -1)} isDisabled={index === 0}>
                W gore
              </Button>
              <Button
                onClick={() => moveStep(index, 1)}
                isDisabled={index === steps.length - 1}
              >
                W dol
              </Button>
              <Button appearance="danger" onClick={() => removeStep(index)}>
                Usun krok
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-page__actions">
        <Button onClick={addStep}>Dodaj krok</Button>
        <Button appearance="primary" onClick={save}>
          Zapisz
        </Button>
      </div>
    </div>
  );
}
