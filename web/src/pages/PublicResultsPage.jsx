import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../api/apiClient';
import LoadingSkeleton from '../components/LoadingSkeleton';
import logo from '../assets/logo.png';
import './PublicResultsPage.css';

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

function formatTime(value) {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function PublicResultsPage() {
  const [searchParams] = useSearchParams();

  const [election, setElection] = useState(null);
  const [ballotsCounted, setBallotsCounted] = useState(0);
  const [lastUpdated, setLastUpdated] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedPositions, setExpandedPositions] = useState({});
  const [activeView, setActiveView] = useState('live');

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
      setBallotsCounted(response.data.meta?.ballots_counted ?? 0);
      setLastUpdated(new Date().toISOString());

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
  const isFinalized = Boolean(election.finalized_at && election.final_results);
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
  const totalVotes = candidates.reduce((sum, candidate) => sum + Number(candidate.vote_count || 0), 0);
  const totalBallots = election.ballots_count || election.ballot_count || 0;
  const ballotsCast = isFinalized
    ? Number(election.final_results.ballots_counted || 0)
    : ballotsCounted;
  const turnout = totalBallots ? Math.min(100, ballotsCast / totalBallots * 100) : 0;
  const electionStatus = isFinalized
    ? 'Election Finalized'
    : election.status === 'active' ? 'Election Ongoing' : 'Awaiting Finalization';
  const electionStatusClass = isFinalized
    ? 'completed'
    : election.status === 'active' ? 'ongoing' : 'awaiting';

  function togglePosition(positionId) {
    setExpandedPositions((current) => ({
      ...current,
      [positionId]: !current[positionId],
    }));
  }

  return (
    <div className="results-portal">
      <header className="public-results-header">
        <a className="public-results-brand" href="#live-election" aria-label="iVote Live Election">
          <img src={logo} alt="" />
          <span><strong>iVote</strong><small>STUDENT ELECTIONS</small></span>
        </a>
        <nav className="public-results-nav" aria-label="Main navigation">
          <a className={activeView === 'live' ? 'is-active' : ''} href="#live-election" onClick={() => setActiveView('live')}>Live Election</a>
          <a className={activeView === 'results' ? 'is-active' : ''} href="#results" onClick={() => setActiveView('results')}>Result</a>
        </nav>
      </header>
      <main className="results-main" id="top">
        <header className="results-topbar"><div className="results-breadcrumb"><span>⌂</span><b>›</b><strong>Election Results</strong></div><div className="results-election-meta"><span>▣</span><div><strong>{election.title}</strong><small>A.Y. 2026 - 2027</small><span className={`election-status ${electionStatusClass}`}>{electionStatus}</span></div></div></header>
        {activeView === 'results' && !isFinalized ? (
          <section className="results-pending" id="results" aria-labelledby="results-pending-title">
            <div className="results-pending-mark" aria-hidden="true">…</div>
            <p className="final-results-eyebrow">Official Results</p>
            <h1 id="results-pending-title">Counting is Ongoing</h1>
            <p>Final official vote totals and elected candidates will appear here after an administrator finalizes the results.</p>
          </section>
        ) : isFinalized && activeView === 'results' ? (
          <>
            <section className="results-hero final-results-hero" id="live-election">
              <div>
                <p className="final-results-eyebrow">Official Election Results</p>
                <h1>Election Winners</h1>
                <p>{election.title}</p>
                <p className="winner-finalized-at">Finalized {new Date(election.finalized_at).toLocaleString()}</p>
              </div>
              <div className="hero-ballot-mark" aria-hidden="true">✓</div>
            </section>

            <section className="winner-grid" id="results" aria-label="Election winners grouped by position">
              {positionGroups.map((group) => (
                <article className="winner-card" key={group.name}>
                    <div className="winner-card-heading">
                      <span aria-hidden="true">★</span>
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
        ) : (
          <>
            <section className="results-hero" id="live-election"><div><p className="provisional-results-label">{isFinalized ? 'Final Official Results' : 'Provisional Results'}</p><h1>{isFinalized ? 'Election Results' : 'Live Election Results'}</h1><p>Here are the {isFinalized ? 'final official' : 'current provisional'} results of the {election.title}.</p><small>Thank you for your participation!</small></div><div className="hero-ballot-mark">✓</div></section>

            <div className="results-layout">
              <div className="results-content">
                <section className="results-stat-grid" aria-label="Election statistics">
                  <div className="result-stat"><span className="stat-icon people">♟</span><div><small>Total Voters</small><strong>{totalVotes.toLocaleString()}</strong></div></div>
                  <div className="result-stat"><span className="stat-icon check">✓</span><div><small>Ballots Counted</small><strong>{ballotsCast.toLocaleString()}</strong></div></div>
                  <div className="result-stat"><span className="stat-icon clock">♟</span><div><small>Total Candidates</small><strong>{candidates.length.toLocaleString()}</strong></div></div>
                  <div className="result-stat"><span className="stat-icon calendar">▣</span><div><small>Last Updated</small><strong>{lastUpdated ? new Date(lastUpdated).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}</strong><em>{formatTime(lastUpdated)}</em></div></div>
                </section>

                <section className="candidate-grid" id="results">
                  {displayedPositions.map((position) => {
                    const positionCandidates = position.candidates || [];
                    const positionTotal = positionCandidates.reduce((sum, candidate) => sum + Number(candidate.vote_count || 0), 0);
                    const isExpanded = expandedPositions[position.id];
                    const visibleCandidates = isExpanded ? positionCandidates : positionCandidates.slice(0, 3);
                    return <article className="candidate-panel" key={position.id}><div className="candidate-panel-heading"><h2><span>★</span>{position.name}</h2>{positionCandidates.length > 3 && <button type="button" onClick={() => togglePosition(position.id)} aria-expanded={isExpanded}>{isExpanded ? 'Show Less' : 'View All'} <b>{isExpanded ? '‹' : '›'}</b></button>}</div><div className="candidate-list">{visibleCandidates.map((candidate) => { const votes = Number(candidate.vote_count || 0); const percentage = positionTotal ? votes / positionTotal * 100 : 0; return <div className="candidate-row" key={candidate.id}><div className="candidate-photo">{candidate.photo_url ? <img src={candidate.photo_url} alt={`${candidate.name} portrait`} /> : <span>{initials(candidate.name)}</span>}</div><div className="candidate-detail"><strong>{candidate.name}</strong><div className="candidate-progress"><span style={{ width: `${percentage}%` }} /></div></div><div className="candidate-score"><strong>{percentage.toFixed(1)}%</strong><small>{votes.toLocaleString()} votes</small></div></div>; })}</div></article>;
                  })}
                </section>
              </div>

              <aside className="results-right-rail">
                <section className="overall-card"><h2>Overall Results</h2><div className="turnout-chart" style={{ '--turnout-degrees': `${turnout * 3.6}deg` }}><div><strong>{turnout.toFixed(1)}%</strong><span>Turnout Rate</span></div></div><div className="chart-legend"><span><i className="legend-blue" /> Valid Votes <b>{totalVotes.toLocaleString()} &nbsp; {turnout.toFixed(1)}%</b></span><span><i className="legend-gray" /> Blank / Invalid <b>{Math.max(0, ballotsCast - totalVotes).toLocaleString()}</b></span></div></section>
                <section className="live-card"><div className="live-icon">◉</div><div><h2>Live Results</h2><p>The results are updated in real time.</p><span><i /> Online</span><div className="about-results"><h2>About These Results</h2><p>Results are updated as ballots are processed. The displayed totals are based on recorded ballots and may change while counting is ongoing.</p></div></div></section>
              </aside>
            </div>
          </>
        )}

      </main>
    </div>
  );
}
