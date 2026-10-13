import type { LeaderboardArtifact } from '@arena/benchmarking';

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
    <section className="leaderboard-panel" aria-label="Official benchmark leaderboard">
      <div className="leaderboard-heading">
        <div>
          <div className="panel-kicker">STANDARD ARENA / VERIFIED RESULTS</div>
          <h2>
            Official <em>Top 10</em>
          </h2>
          <p>
            {leaderboard.benchmarkId} · {leaderboard.benchmarkVersion} · same seeds, tools, and
            evaluator
          </p>
        </div>
        <span className="official-badge">OFFICIAL</span>
      </div>
      <p className="benchmark-disclosure">
        Current entries are scripted baselines that verify the evaluation pipeline. No real LLM
        benchmark results have been published yet. This benchmark covers Incident 001 only.
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
              <th>SCORE</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {leaderboard.entries.map((entry) => (
              <tr key={`${entry.provider}/${entry.modelVersionId}`}>
                <td className="leaderboard-rank">{String(entry.rank).padStart(2, '0')}</td>
                <td>
                  <strong>{entry.modelName}</strong>
                  <small>
                    {entry.provider} · {entry.modelVersionId}
                  </small>
                </td>
                <td>{percent(entry.missionSuccessRate)}</td>
                <td>{entry.safety.toFixed(1)}</td>
                <td>{entry.efficiency.toFixed(0)}</td>
                <td>
                  {entry.costPerSuccessfulMission === undefined
                    ? '—'
                    : `$${entry.costPerSuccessfulMission.toFixed(2)}`}
                </td>
                <td className="leaderboard-score">{entry.overallScore.toFixed(1)}</td>
                <td>
                  {entry.watchRunReference && (
                    <button
                      className="watch-link"
                      onClick={() => onWatchRun(entry.watchRunReference!)}
                    >
                      WATCH RUN
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {leaderboard.entries.length === 0 && (
              <tr>
                <td colSpan={8} className="leaderboard-empty">
                  No verified official results yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="leaderboard-footer">
        <span>
          OFFICIAL RUNS ONLY · COMMUNITY RUNS NEVER CHANGE THIS BOARD · BUDGET $
          {leaderboard.budget.spentUsd.toFixed(2)} / ${leaderboard.budget.maxUsd.toFixed(2)} ·
          REMAINING $
          {Math.max(0, leaderboard.budget.maxUsd - leaderboard.budget.spentUsd).toFixed(2)} · RUNS{' '}
          {leaderboard.budget.runs} / {leaderboard.budget.maxRuns}
        </span>
        <span>
          {leaderboard.budget.inputTokens + leaderboard.budget.outputTokens} TOKENS · INFERENCE COST
          PER VISITOR: $0.00
        </span>
      </div>
    </section>
  );
}
