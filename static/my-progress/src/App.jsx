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
  completed: 'ukonczony',
  skipped: 'pominiety',
};

function ProgressCard({ tour, progress }) {
  const completed = progress.completedStepIds || [];
  const percent = tour.totalSteps ? Math.round((completed.length / tour.totalSteps) * 100) : 0;

  return (
    <div className="progress-card">
      <h4>{tour.title}</h4>
      <div className="progress-card__bar-wrapper">
        <div className="progress-card__bar" style={{ width: `${percent}%` }} />
      </div>
      <p className="progress-card__summary">
        {completed.length} / {tour.totalSteps} krokow ({percent}%)
        {progress.tourOutcome
          ? ` — ${OUTCOME_LABELS[progress.tourOutcome] || progress.tourOutcome}`
          : ''}
      </p>
    </div>
  );
}

function SourceSection({ title, record, tours }) {
  if (!record) {
    return null;
  }
  const entries = tours
    .map((tour) => ({ tour, progress: record.tours?.[tour.id] }))
    .filter((entry) => entry.progress);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="source-section">
      <h3 className="source-section__title">{title}</h3>
      {entries.map(({ tour, progress }) => (
        <ProgressCard key={tour.id} tour={tour} progress={progress} />
      ))}
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

  const tours = data.tours || [];
  const hasAnyProgress = Boolean(
    Object.keys(data.panel?.tours || {}).length || Object.keys(data.extension?.tours || {}).length
  );

  return (
    <div className="my-progress">
      <h2>Moj postep w samouczkach onboardingowych</h2>

      {!hasAnyProgress && (
        <SectionMessage appearance="information">
          <p>
            Jeszcze nie rozpoczales zadnego samouczka. Otworz dowolne zgloszenie w Jirze — panel
            „Przewodnik dla nowych pracownikow” uruchomi pierwszy z nich automatycznie przy
            pierwszej wizycie. Pozostale samouczki (tablica, wyszukiwanie, komentowanie, workflow)
            uruchamiaja sie automatycznie w rozszerzeniu przegladarki, gdy trafisz na wlasciwy
            ekran. Jesli firma wymaga w rozszerzeniu logowania, Twoj postep z niego pojawi sie
            tutaj po zalogowaniu.
          </p>
        </SectionMessage>
      )}

      <SourceSection title="Panel w Jirze" record={data.panel} tours={tours} />
      <SourceSection
        title={data.extension ? PROVIDER_LABELS[data.extension.provider] : ''}
        record={data.extension}
        tours={tours}
      />
    </div>
  );
}
