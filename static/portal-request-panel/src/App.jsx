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

// Panel na portalu klienta JSM - analogiczny do static/onboarding-panel/,
// ale dla samouczkow oznaczonych audience: 'customer' (patrz src/tours.js).
// Tak samo jak tam: to makieta pol formularza requestu, nie prawdziwy
// formularz (Forge Custom UI nie ma dostepu do DOM poza wlasnym iframe).
// Uzytkownicy tego portalu to zwykle pracownicy bez licencji Jira, ktorzy
// maja tez rozszerzenie przegladarki na firmowym komputerze - ono realnie
// podswietla prawdziwe pola tego samego formularza (patrz
// browser-extension/content/content.js), wiec ten panel jest uzupelnieniem
// (dziala zawsze, bez wzgledu na to, czy rozszerzenie jest zainstalowane),
// a nie jedynym mechanizmem.
const FieldMock = ({ name, label, children }) => (
  <SpotlightTarget name={name}>
    <div className="field-mock">
      <div className="field-mock__label">{label}</div>
      <div className="field-mock__value">{children}</div>
    </div>
  </SpotlightTarget>
);

export default function App() {
  const [tour, setTour] = useState(null);
  const [seen, setSeen] = useState(true);
  const [activeStep, setActiveStep] = useState(-1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke('getPortalTours')
      .then(async (tours) => {
        const requestTour = tours.find((t) => t.id === 'portal-request') || tours[0] || null;
        setTour(requestTour);
        if (!requestTour) {
          setLoading(false);
          return;
        }
        const state = await invoke('getPortalOnboardingState', { tourId: requestTour.id });
        setSeen(state.seen);
        setLoading(false);
        if (!state.seen && requestTour.steps.length > 0) {
          setActiveStep(0);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const finishTour = async (outcome = 'completed') => {
    setActiveStep(-1);
    setSeen(true);
    await Promise.all([
      invoke('markPortalOnboardingSeen', { tourId: tour.id }),
      invoke('recordPortalTourFinished', { tourId: tour.id, outcome }),
    ]);
  };

  const restartTour = async () => {
    await invoke('resetPortalOnboardingState', { tourId: tour.id });
    setSeen(false);
    setActiveStep(0);
  };

  const next = () => {
    const currentStep = tour.steps[activeStep];
    if (currentStep) {
      invoke('recordPortalStepSeen', { tourId: tour.id, stepId: currentStep.id }).catch(() => {});
    }
    if (activeStep < tour.steps.length - 1) {
      setActiveStep(activeStep + 1);
    } else {
      finishTour('completed');
    }
  };

  if (loading || !tour) {
    return null;
  }

  const steps = tour.steps;

  return (
    <SpotlightManager>
      <div className="onboarding-panel">
        <SectionMessage title="Jak poprawnie zglosic prosbe" appearance="information">
          <p>
            Ten przewodnik pokazuje krok po kroku, jak wypelnic formularz zgloszenia, zeby
            zespol jak najszybciej mogl pomoc. Kliknij pole ponizej, aby zobaczyc wskazowke,
            albo uruchom pelny samouczek.
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
