import type { ExperimentSummary, Reflection } from '@arena/experiments';

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function ExperimentPanel({
  summary,
  baseline,
  selectedAttempt,
  onModeChange,
  onOpenAttempt,
}: {
  summary: ExperimentSummary;
  baseline: ExperimentSummary | null;
  selectedAttempt: number;
  onModeChange: (mode: 'adaptive' | 'baseline') => void;
  onOpenAttempt: (attempt: number) => void;
}) {
  const selected = summary.attempts.find((attempt) => attempt.attempt === selectedAttempt);
  const latest = summary.strategyHistory.at(-1);
  const training = summary.trainingMetrics;
  const baselineTraining = baseline?.trainingMetrics;
  return (
    <section className="experiment-panel" aria-label="Adaptive experiment">
      <div className="experiment-heading">
        <div>
          <div className="panel-kicker">RESEARCH / LEARNING LAB</div>
          <h2>
            Mars Learning Experiment <em>#001</em>
          </h2>
          <p>Can an agent stabilize Habitat B more reliably after previous attempts?</p>
        </div>
        <div className="experiment-toggle" role="group" aria-label="Experiment mode">
          <button
            className={summary.learningMode === 'adaptive' ? 'selected' : ''}
            onClick={() => onModeChange('adaptive')}
          >
            ADAPTIVE
          </button>
          <button
            className={summary.learningMode === 'baseline' ? 'selected' : ''}
            onClick={() => onModeChange('baseline')}
          >
            BASELINE
          </button>
        </div>
      </div>
      <div className="experiment-metrics">
        <div>
          <span>TRAINING SUCCESS</span>
          <strong>{percent(training.missionSuccessRate)}</strong>
          {baselineTraining && (
            <small>Baseline {percent(baselineTraining.missionSuccessRate)}</small>
          )}
        </div>
        <div>
          <span>CREW SURVIVAL</span>
          <strong>{percent(training.crewSurvivalRate)}</strong>
          {baselineTraining && <small>Baseline {percent(baselineTraining.crewSurvivalRate)}</small>}
        </div>
        <div>
          <span>DANGEROUS ACTIONS</span>
          <strong>{training.dangerousActions}</strong>
          {baselineTraining && <small>Baseline {baselineTraining.dangerousActions}</small>}
        </div>
        <div>
          <span>HOLDOUT SUCCESS</span>
          <strong>{percent(summary.holdoutMetrics.missionSuccessRate)}</strong>
          <small>{summary.holdoutMetrics.attempts} unseen seeds</small>
        </div>
      </div>
      <div className="experiment-cost" aria-label="Adaptive experiment cost">
        <div>
          <span>EXPERIMENT COST</span>
          <strong>${(summary.cost.actualUsd ?? summary.cost.estimatedUsd).toFixed(2)}</strong>
          <small>{summary.cost.status.replace('_', ' ').toUpperCase()}</small>
        </div>
        <div>
          <span>TOKENS USED</span>
          <strong>{summary.cost.usage.totalTokens.toLocaleString('en-US')}</strong>
          <small>INPUT + OUTPUT</small>
        </div>
        <div>
          <span>ATTEMPTS</span>
          <strong>{summary.cost.attempts}</strong>
          <small>BOUNDED RUNS</small>
        </div>
      </div>
      <div className="experiment-grid">
        <div className="attempt-track">
          <div className="panel-kicker">ATTEMPT TRAJECTORY / SCORE</div>
          <div className="attempts">
            {summary.attempts.map((attempt) => (
              <button
                key={attempt.attempt}
                className={`attempt-card ${selectedAttempt === attempt.attempt ? 'selected' : ''} ${attempt.outcome}`}
                onClick={() => onOpenAttempt(attempt.attempt)}
                style={
                  {
                    '--score-width': `${Math.max(4, Math.min(100, attempt.score))}%`,
                  } as React.CSSProperties
                }
              >
                <span className="attempt-number">{String(attempt.attempt).padStart(2, '0')}</span>
                <span className="attempt-state">
                  <b>{attempt.outcome === 'success' ? 'COLONY STABILIZED' : 'MISSION FAILED'}</b>
                  <small>
                    {attempt.split.toUpperCase()} · SEED {attempt.seed}
                  </small>
                </span>
                <strong>{attempt.score.toFixed(1)}</strong>
                <i />
              </button>
            ))}
          </div>
        </div>
        <div className="strategy-card">
          <div className="panel-kicker">STRATEGY EVOLUTION</div>
          {latest && (
            <>
              <div className="strategy-version">VERSION {latest.version}</div>
              <ul>
                {latest.principles.slice(-3).map((principle) => (
                  <li key={principle}>{principle}</li>
                ))}
              </ul>
              {latest.hypotheses.length > 0 && (
                <div className="hypothesis">
                  <span>HYPOTHESIS</span>
                  {latest.hypotheses.at(-1)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {selected?.reflection && <ReflectionCard reflection={selected.reflection} />}
      <div className="experiment-footer">
        <span>
          TRAINING {summary.trainingSeeds.join(' · ')} / HOLDOUT {summary.holdoutSeeds.join(' · ')}
        </span>
        <span>EXTERNAL MEMORY · DETERMINISTIC WORLD · MCP</span>
      </div>
    </section>
  );
}

function ReflectionCard({ reflection }: { reflection: Reflection }) {
  return (
    <div className="reflection-card">
      <div className="panel-kicker">
        REFLECTION / ATTEMPT {String(reflection.attempt).padStart(2, '0')}
      </div>
      <div className="reflection-columns">
        <div>
          <span>WHAT FAILED</span>
          <p>{reflection.whatFailed[0] ?? 'No failure recorded.'}</p>
        </div>
        <div>
          <span>STRATEGY CHANGE</span>
          <p>
            {reflection.strategyChanges[0] ?? 'Keep the current strategy and test a new variant.'}
          </p>
        </div>
        <div>
          <span>DANGEROUS ACTIONS</span>
          <p>{reflection.dangerousActions[0] ?? 'None recorded.'}</p>
        </div>
      </div>
    </div>
  );
}
