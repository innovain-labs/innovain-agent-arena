import { useEffect, useState } from 'react';
import { assetUrl } from './site';
interface Board {
  suite: string;
  toolContractVersion: string;
  entries: Array<{ rank: number; entrant: string; model: string; score: number; runs: string[] }>;
}
export function CommunityLeaderboard({ onWatchRun }: { onWatchRun: (reference: string) => void }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch(assetUrl('community/leaderboard.json'), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Community board unavailable.');
        return response.json() as Promise<Board>;
      })
      .then(setBoard)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'Unable to load community board.');
      });
    return () => controller.abort();
  }, []);
  return (
    <section className="leaderboard-panel" aria-label="Community Top 10">
      <div className="leaderboard-heading">
        <div>
          <div className="panel-kicker">COMMUNITY / REPRODUCED ACTIONS</div>
          <h2>
            Community <em>Top 10</em>
          </h2>
          <p>Three Mars emergencies · shared observation tools and emergency controls</p>
        </div>
        <span className="official-badge">COMMUNITY</span>
      </div>
      <p className="benchmark-disclosure">
        Scores are recomputed against canonical scenarios. Entrant and model identity are
        self-reported. Community scores are separate from Innovain's verified model evaluations and
        should not be compared directly.
      </p>
      {error ? (
        <p role="alert">{error}</p>
      ) : !board ? (
        <p>Loading community results...</p>
      ) : (
        <div className="leaderboard-table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>RANK</th>
                <th>ENTRANT</th>
                <th>MODEL / SELF-REPORTED</th>
                <th>MEAN SCORE</th>
                <th>REPLAYS</th>
              </tr>
            </thead>
            <tbody>
              {board.entries.map((entry) => (
                <tr key={`${entry.entrant}/${entry.model}`}>
                  <td>{entry.rank}</td>
                  <td>{entry.entrant}</td>
                  <td>{entry.model}</td>
                  <td>{entry.score.toFixed(1)}</td>
                  <td>
                    {entry.runs.map((reference, index) => (
                      <button
                        className="watch-link"
                        key={reference}
                        onClick={() => onWatchRun(reference)}
                      >
                        INCIDENT {index + 1}
                      </button>
                    ))}
                  </td>
                </tr>
              ))}
              {!board.entries.length && (
                <tr>
                  <td colSpan={5} className="leaderboard-empty">
                    The first community spot is open. Submit one completed replay for each
                    emergency.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="leaderboard-footer">
        <a className="inline-link" href="#/try-your-model">
          Download runner · play the complete suite
        </a>
        <a className="inline-link" href={assetUrl('docs/community-leaderboard.md')}>
          How to submit · keys stay local
        </a>
        <span>REVIEWED SUBMISSIONS · NO AUTOMATIC UPLOAD</span>
      </div>
    </section>
  );
}
