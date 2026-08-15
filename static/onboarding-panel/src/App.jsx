import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';
import Button from '@atlaskit/button/standard-button';
import SectionMessage from '@atlaskit/section-message';
import {
  SpotlightManager,
  SpotlightTarget,
  SpotlightTransition,
  Spotlight,
} from '@atlaskit/onboarding';
import './App.css';

// Panel renderuje uproszczona makiete pol zgloszenia i prowadzi po niej
// samouczek typu spotlight. Rzeczywisty formularz zakladania ticketu
// zyje poza tym iframe'em (ograniczenie Forge Custom UI), wiec makieta
// pelni role "sciagawki" - tresc kazdego kroku konfiguruje admin tak,
// by odzwierciedlala prawdziwa procedure firmy.
const FieldMock = ({ name, label, children }) => (
  <SpotlightTarget name={name}>
    <div className="field-mock">
      <div className="field-mock__label">{label}</div>
      <div className="field-mock__value">{children}</div>
    </div>
  </SpotlightTarget>
);

export default function App() {
  const [steps, setSteps] = useState([]);
  const [seen, setSeen] = useState(true);
  const [activeStep, setActiveStep] = useState(-1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([invoke('getOnboardingSteps'), invoke('getOnboardingState')])
      .then(([loadedSteps, state]) => {
        setSteps(loadedSteps);
        setSeen(state.seen);
        setLoading(false);
        if (!state.seen && loadedSteps.length > 0) {
          setActiveStep(0);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const finishTour = async () => {
    setActiveStep(-1);
    setSeen(true);
    await invoke('markOnboardingSeen');
  };

  const restartTour = async () => {
    await invoke('resetOnboardingState');
    setSeen(false);
    setActiveStep(0);
  };

  const next = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
    } else {
      finishTour();
    }
  };

  if (loading) {
    return null;
  }

  return (
    <SpotlightManager>
      <div className="onboarding-panel">
        <SectionMessage title="Jak poprawnie uzupelnic zgloszenie" appearance="information">
          <p>
            Ten przewodnik pokazuje krok po kroku, jak wypelnic ticket zgodnie z
            procedura firmy. Kliknij pole ponizej, aby zobaczyc wskazowke, albo
            uruchom pelny samouczek.
          </p>
        </SectionMessage>

        <div className="field-mock-list">
          {steps.map((step) => (
            <FieldMock key={step.id} name={step.id} label={step.heading}>
              {step.description}
            </FieldMock>
          ))}
        </div>

        <div className="onboarding-panel__actions">
          <Button appearance="primary" onClick={restartTour}>
            {seen ? 'Uruchom ponownie samouczek' : 'Rozpocznij samouczek'}
          </Button>
        </div>

        <SpotlightTransition>
          {activeStep >= 0 && steps[activeStep] && (
            <Spotlight
              key={steps[activeStep].id}
              target={steps[activeStep].id}
              heading={steps[activeStep].heading}
              actions={[
                {
                  onClick: next,
                  text: activeStep === steps.length - 1 ? 'Zakoncz' : 'Dalej',
                },
              ]}
              actionsBeforeElement={`${activeStep + 1} / ${steps.length}`}
              targetRadius={4}
              dialogPlacement="right top"
            >
              {steps[activeStep].description}
            </Spotlight>
          )}
        </SpotlightTransition>
      </div>
    </SpotlightManager>
  );
}
