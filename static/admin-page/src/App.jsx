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
  heading: '',
  description: '',
});

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
        </p>
      </SectionMessage>

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
