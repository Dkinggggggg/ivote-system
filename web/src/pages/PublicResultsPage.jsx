import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../api/apiClient';
import Icon from '../components/Icon';
import LoadingSkeleton from '../components/LoadingSkeleton';
import logo from '../assets/logo.png';
import './PublicResultsPage.css';
import './PublicResultsTheme.css';

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

export default function PublicResultsPage() {
  const [searchParams] = useSearchParams();

  const [election, setElection] = useState(null);
  const [voterTurnout, setVoterTurnout] = useState({
    total_eligible_voters: 0,
    total_participating_voters: 0,
    turnout_percentage: 0,
    departments: [],
  });
  const [loading, setLoading] = useState(true);
  const [expandedPositions, setExpandedPositions] = useState({});

  const electionId = searchParams.get('election_id');

  useEffect(() => {
    loadResults();

    const interval = setInterval(loadResults, 5000);

    return () => clearInterval(interval);
  }, [electionId]);

  async function loadResults() {
    try {
      setLoading(true);

      const response = await apiClient.get(
        electionId
          ? `/elections/${electionId}/public-results`
          : '/elections/current/public-results'
      );

      setElection(response.data.data);
      setVoterTurnout(response.data.meta?.voter_turnout ?? {
        total_eligible_voters: 0,
        total_participating_voters: 0,
        turnout_percentage: 0,
        departments: [],
      });
    } catch (error) {
      console.error(
        'Failed to load election results:',
        error
      );

      setElection(null);

    } finally {
      setLoading(false);
    }
  }

  if (loading && !election) return <LoadingSkeleton variant="results" label="Loading election results" />;

  if (!election) {
    return <div className="results-empty"><div className="results-empty-card"><h2>Election Not Found</h2><p>There is currently no election available.</p></div></div>;
  }

  const positions = (election.positions || []).filter(
    (position) => Array.isArray(position.candidates) && position.candidates.length > 0
  );
  const isOngoing = election.status === 'active';
  const isFinalized = !isOngoing && Boolean(election.finalized_at && election.final_results);
  const displayedPositions = isFinalized && Array.isArray(election.final_results.positions)
    ? election.final_results.positions.filter(
      (position) => Array.isArray(position.candidates) && position.candidates.length > 0
    )
    : positions;
  const positionGroupsByName = new Map();
  displayedPositions.forEach((position) => {
    const governorMatch = position.name.match(/^Governor(?:\s*-\s*(.+))?$/i);
    const groupName = governorMatch ? 'Governor' : position.name;
    if (!positionGroupsByName.has(groupName)) {
      positionGroupsByName.set(groupName, { name: groupName, positions: [] });
    }
    positionGroupsByName.get(groupName).positions.push({
      position,
      area: governorMatch?.[1] || null,
    });
  });
  const positionGroups = [...positionGroupsByName.values()];
  const candidates = displayedPositions.flatMap((position) => position.candidates || []);
  const electionStatus = isOngoing
    ? 'Election is Ongoing'
    : isFinalized
    ? 'Election Finalized'
    : 'Awaiting Finalization';
  const electionStatusClass = isFinalized ? 'completed' : 'ongoing';

  function togglePosition(positionId) {
    setExpandedPositions((current) => ({
      ...current,
      [positionId]: !current[positionId],
    }));
  }

  return (
    <div className="results-portal">
      <header className="public-results-header">
        <a className="public-results-brand" href="#results" aria-label="iVote Public Results">
          <img src={logo} alt="" />
          <span><strong>iVote</strong><small>PUBLIC ELECTION RESULTS</small></span>
        </a>
      </header>
      <main className="results-main" id="top">
        <header className="results-topbar">
          <div className="results-election-meta"><Icon name="calendar" size={16} /><div><strong>{election.title}</strong><small>A.Y. 2026 - 2027</small><span className={`election-status ${electionStatusClass}`}>{electionStatus}</span></div></div>
        </header>
        {!isOngoing && <section className="department-turnout" aria-labelledby="department-turnout-title">
          <div className="department-turnout-heading">
            <div>
              <p>Participation</p>
              <h2 id="department-turnout-title">Voter Turnout by Department</h2>
            </div>
            <strong className="department-turnout-overall">{Number(voterTurnout.turnout_percentage || 0).toFixed(1)}% overall</strong>
          </div>
          <div className="department-turnout-summary">
            <div><span>Total Eligible Voters</span><strong>{Number(voterTurnout.total_eligible_voters || 0).toLocaleString()}</strong></div>
            <div><span>Total Participating Voters</span><strong>{Number(voterTurnout.total_participating_voters || 0).toLocaleString()}</strong></div>
            <div><span>Overall Turnout</span><strong>{Number(voterTurnout.turnout_percentage || 0).toFixed(1)}%</strong></div>
          </div>
          {voterTurnout.departments.length > 0 ? (
            <div className="department-turnout-grid">
              {voterTurnout.departments.map((department) => {
                const percentage = Number(department.turnout_percentage || 0);
                return (
                  <article className="department-turnout-card" key={department.department}>
                    <div className="department-turnout-card-heading">
                      <h3>{department.department}</h3>
                      <strong>{percentage.toFixed(1)}%</strong>
                    </div>
                    <div
                      className="department-turnout-progress"
                      role="progressbar"
                      aria-label={`${department.department} voter turnout`}
                      aria-valuemin="0"
                      aria-valuemax="100"
                      aria-valuenow={percentage}
                    >
                      <span style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} />
                    </div>
                    <p>
                      <strong>{Number(department.participating_voters || 0).toLocaleString()}</strong>
                      {' '}of {Number(department.eligible_voters || 0).toLocaleString()} participating
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="department-turnout-empty">No eligible voters have been recorded for this election.</p>
          )}
        </section>}
        {isOngoing ? (
          <section className="results-pending" id="results" aria-labelledby="results-pending-title">
            <h1 id="results-pending-title">Election is Ongoing</h1>
          </section>
        ) : !isFinalized ? (
          <section className="results-pending" id="results" aria-labelledby="results-pending-title">
            <div className="results-pending-mark" aria-hidden="true">…</div>
            <p className="final-results-eyebrow">Official Results</p>
            <h1 id="results-pending-title">Counting is Ongoing</h1>
            <p>Final official vote totals and elected candidates will appear here after an administrator finalizes the results.</p>
          </section>
        ) : (
          <>
            <section className="results-hero final-results-hero">
              <div>
                <p className="final-results-eyebrow">Official Election Results</p>
                <h1>Election Winners</h1>
                <p>{election.title}</p>
                <p className="winner-finalized-at">Finalized {new Date(election.finalized_at).toLocaleString()}</p>
              </div>
              <div className="hero-ballot-mark" aria-hidden="true"><Icon name="check" size={34} strokeWidth={2.2} /></div>
            </section>

            <section className="winner-grid" id="results" aria-label="Election winners grouped by position">
              {positionGroups.map((group) => (
                <article className="winner-card" key={group.name}>
                    <div className="winner-card-heading">
                      <span aria-hidden="true"><Icon name="star" size={15} /></span>
                      <h2>{group.name}</h2>
                    </div>
                    <div className="winner-card-body">
                      {group.positions.map(({ position, area }) => {
                        const sortedCandidates = [...position.candidates].sort(
                          (first, second) => Number(second.vote_count || 0) - Number(first.vote_count || 0)
                        );
                        const positiveCandidates = sortedCandidates.filter(
                          (candidate) => Number(candidate.vote_count || 0) > 0
                        );
                        const winningPlaces = Math.min(
                          Math.max(1, Number(position.vote_for_count) || 1),
                          positiveCandidates.length
                        );
                        const cutoffVoteCount = Number(positiveCandidates[winningPlaces - 1]?.vote_count || 0);
                        const winners = cutoffVoteCount > 0
                          ? positiveCandidates.filter((candidate) => Number(candidate.vote_count || 0) >= cutoffVoteCount)
                          : [];

                        return (
                          <section className="winner-position" key={position.id} aria-label={position.name}>
                            {area && <p className="winner-subheading">{area}</p>}
                            {winners.length > 0 ? (
                              <div className="winner-list">
                                {winners.map((candidate) => {
                                  const candidateVoteCount = Number(candidate.vote_count || 0);
                                  const standing = sortedCandidates.findIndex(
                                    (item) => Number(item.vote_count || 0) === candidateVoteCount
                                  ) + 1;
                                  const isTied = sortedCandidates.filter(
                                    (item) => Number(item.vote_count || 0) === candidateVoteCount
                                  ).length > 1;

                                  return (
                                    <div className="winner-profile" key={candidate.id}>
                                      <div className="winner-photo">
                                        {candidate.photo_url
                                          ? <img src={candidate.photo_url} alt={`${candidate.name} portrait`} />
                                          : <span>{initials(candidate.name)}</span>}
                                      </div>
                                      <h3>{candidate.name}</h3>
                                      <span className="winner-standing">Final standing #{standing}</span>
                                      {isTied && <span className="winner-tie-label">Tied</span>}
                                      <span className="winner-votes">
                                        {candidateVoteCount.toLocaleString()} {candidateVoteCount === 1 ? 'vote' : 'votes'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="winner-no-votes">No votes recorded</p>
                            )}
                          </section>
                        );
                      })}
                    </div>
                </article>
              ))}
            </section>
            <footer className="winner-board-footer">
              <p>Congratulations to our election winners!</p>
            </footer>
          </>
        )}

      </main>
    </div>
  );
}
