import type { LeaderboardArtifact } from '@arena/benchmarking';
import { assetUrl } from './site';

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function LeaderboardPanel({
  leaderboard,
  onWatchRun,
}: {
  leaderboard: LeaderboardArtifact;
  onWatchRun: (reference: string) => void;
}) {
  return (
    <section className="leaderboard-panel" aria-label="Innovain model leaderboard">
      <div className="leaderboard-heading">
        <div>
          <div className="panel-kicker">
            {leaderboard.developmentFixtures
              ? 'DEVELOPMENT / SCRIPTED EXAMPLES'
              : 'REAL MODEL EVALUATIONS'}
          </div>
          <h2>
            Innovain <em>Top 10</em>
          </h2>
          <p>Three Mars emergencies · shared tools and scoring rules</p>
        </div>
        <span className="official-badge">INNOVAIN</span>
      </div>
      <p className="benchmark-disclosure">
        {leaderboard.developmentFixtures
          ? 'Temporary scripted examples generated through real MCP. Their scores are demonstrations, not LLM evaluations, and they will be removed before public launch.'
          : 'SUITE SCORE combines all completed attempts across the emergency set; it is not a single mission. Expand SAVED RUNS to see each attempt’s own score and outcome, then replay that exact recording. Replay does not call the model again. Provider model identity is recorded but not independently attested. Community submissions never enter this board.'}
      </p>
      <div className="leaderboard-table-wrap">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>RANK</th>
              <th>MODEL</th>
              <th>SUCCESS</th>
              <th>SAFETY</th>
              <th>EFFICIENCY</th>
              <th>COST / SUCCESS</th>
              <th>SUITE SCORE</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {leaderboard.entries.map((entry) => {
              return (
                <tr key={`${entry.provider}/${entry.modelVersionId}`}>
                  <td className="leaderboard-rank">{String(entry.rank).padStart(2, '0')}</td>
                  <td>
                    <strong>{entry.modelName}</strong>
                    <small>
                      {entry.runsCompleted} runs · {entry.provider} · {entry.modelVersionId}
                    </small>
                  </td>
                  <td>{percent(entry.missionSuccessRate)}</td>
                  <td>{entry.safety.toFixed(1)}</td>
                  <td>{entry.efficiency.toFixed(0)}</td>
                  <td>
                    {entry.costPerSuccessfulMission === undefined
                      ? '—'
                      : `${entry.costStatus === 'estimated' ? '≈' : ''}$${entry.costPerSuccessfulMission.toFixed(4)}`}
                  </td>
                  <td
                    className="leaderboard-score"
                    title={`Weighted suite score across ${entry.runsCompleted} completed runs`}
                  >
                    {entry.overallScore.toFixed(1)}
                  </td>
                  <td>
                    {entry.recordedRuns && entry.recordedRuns.length > 0 ? (
                      <details className="leaderboard-runs">
                        <summary>{entry.recordedRuns.length} SAVED RUNS</summary>
                        <ol>
                          {entry.recordedRuns.map((run) => (
                            <li key={`${run.scenarioSlug}-${run.attempt}`}>
                              <div>
                                <strong>{run.scenarioName}</strong>
                                <small>
                                  ATTEMPT {run.attempt} · {run.score.toFixed(1)} ·{' '}
                                  {run.outcome.toUpperCase()}
                                </small>
                              </div>
                              <button
                                className="watch-link"
                                title={`Replay this saved ${run.scenarioName} run (${run.score.toFixed(1)} points, ${run.outcome}). No model call is made.`}
                                aria-label={`Replay ${run.scenarioName}, attempt ${run.attempt}, score ${run.score.toFixed(1)}, ${run.outcome}`}
                                onClick={() => onWatchRun(run.reference)}
                              >
                                REPLAY
                              </button>
                            </li>
                          ))}
                        </ol>
                      </details>
                    ) : entry.watchRunReference ? (
                      <button
                        className="watch-link"
                        title={`Replay one saved ${entry.modelName} run. No new model call is made; the run score differs from the ${entry.overallScore.toFixed(1)} suite score.`}
                        aria-label={`Replay saved ${entry.modelName} run`}
                        onClick={() => onWatchRun(entry.watchRunReference!)}
                      >
                        REPLAY RUN
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {leaderboard.entries.length === 0 && (
              <tr>
                <td colSpan={8} className="leaderboard-empty">
                  Real model evaluations are being prepared. This board is open for the first
                  verified run.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="leaderboard-footer">
        <span>
          {leaderboard.developmentFixtures
            ? 'SCRIPTED DEVELOPMENT FIXTURES · NO MODEL API WAS CALLED'
            : 'VERIFIED INNOVAIN MODEL RUNS · COMMUNITY RUNS ARE LISTED SEPARATELY'}
        </span>
        <span>PRACTICE IN THIS BROWSER DOES NOT CALL A MODEL OR USE AN API KEY</span>
        <a className="inline-link" href={assetUrl('docs/innovain-top-10.md')}>
          METHODOLOGY &amp; REPRODUCIBILITY
        </a>
      </div>
    </section>
  );
}
