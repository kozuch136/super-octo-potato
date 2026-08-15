import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';
import SectionMessage from '@atlaskit/section-message';
import './App.css';

const PROVIDER_LABELS = {
  jira: 'Panel w Jirze',
  microsoft: 'Rozszerzenie przegladarki (Microsoft)',
  atlassian: 'Rozszerzenie przegladarki (Atlassian)',
};

const OUTCOME_LABELS = {
  completed: 'Ukonczony',
  skipped: 'Pominiety',
};

function formatDate(timestamp) {
  if (!timestamp) return null;
  return new Date(timestamp).toLocaleString('pl-PL');
}

function ProgressCard({ title, record, totalSteps, stepHeadings }) {
  if (!record) {
    return null;
  }
  const completed = record.completedStepIds || [];
  const percent = totalSteps ? Math.round((completed.length / totalSteps) * 100) : 0;

  return (
    <div className="progress-card">
      <h3>{title}</h3>
      <div className="progress-card__bar-wrapper">
        <div className="progress-card__bar" style={{ width: `${percent}%` }} />
      </div>
      <p className="progress-card__summary">
        {completed.length} / {totalSteps} krokow ({percent}%)
        {record.tourOutcome ? ` — ${OUTCOME_LABELS[record.tourOutcome] || record.tourOutcome}` : ''}
      </p>
      {completed.length > 0 && (
        <ul className="progress-card__steps">
          {completed.map((stepId) => (
            <li key={stepId}>{stepHeadings[stepId] || stepId}</li>
          ))}
        </ul>
      )}
      <p className="progress-card__muted">
        Ostatnia aktywnosc: {formatDate(record.lastActivityAt) || '—'}
      </p>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    invoke('getMyProgress')
      .then(setData)
      .catch(() => setError('Nie udalo sie wczytac Twojego postepu.'));
  }, []);

  if (error) {
    return (
      <div className="my-progress">
        <SectionMessage appearance="error">
          <p>{error}</p>
        </SectionMessage>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const hasAnyProgress = Boolean(data.panel || data.extension);

  return (
    <div className="my-progress">
      <h2>Moj postep w samouczku onboardingowym</h2>

      {!hasAnyProgress && (
        <SectionMessage appearance="information">
          <p>
            Jeszcze nie rozpoczales samouczka. Otworz dowolne zgloszenie w Jirze — panel
            „Przewodnik dla nowych pracownikow” uruchomi go automatycznie przy pierwszej wizycie.
            Jesli firma korzysta tez z rozszerzenia przegladarki i wymaga w nim logowania, Twoj
            postep z niego pojawi sie tutaj po zalogowaniu.
          </p>
        </SectionMessage>
      )}

      <ProgressCard
        title="Panel w Jirze"
        record={data.panel}
        totalSteps={data.totalSteps}
        stepHeadings={data.stepHeadings}
      />
      <ProgressCard
        title={data.extension ? PROVIDER_LABELS[data.extension.provider] : ''}
        record={data.extension}
        totalSteps={data.totalSteps}
        stepHeadings={data.stepHeadings}
      />
    </div>
  );
}
