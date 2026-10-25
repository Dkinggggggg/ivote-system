import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/apiClient';
import PaginationControls from '../components/PaginationControls';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { useAuth } from '../context/AuthContext';
import './ElectionsPage.css';

export default function ElectionsPage() {
  const { isAdmin } = useAuth();

  const [elections, setElections] = useState([]);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('draft');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedElection, setSelectedElection] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [finalizingElectionId, setFinalizingElectionId] = useState(null);

  useEffect(() => {
    loadElections();
  }, []);

  async function loadElections() {
    try {
      const { data } = await apiClient.get('/elections');
      setElections(data.data);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();

    setIsSubmitting(true);

    try {

      await apiClient.post('/elections', {
        title,
        status,
      });

      setTitle('');
      setStatus('draft');

      await loadElections();

    } finally {

      setIsSubmitting(false);

    }
  }

  async function handleActivate(id) {

    try {

      await apiClient.patch(`/elections/${id}/activate`);

      await loadElections();

    } catch (error) {

      console.error(error);

      alert('Failed to activate election.');

    }
  }

  async function handleClose(id) {

    if (!window.confirm('Close this election?')) return;

    try {

      await apiClient.patch(`/elections/${id}/close`);

      await loadElections();

    } catch (error) {

      console.error(error);

      alert('Failed to close election.');

    }
  }

  async function handleFinalize(election) {
    const confirmed = window.confirm(
      `Finalize results for "${election.title}"? This will stop ballot scanning, save the official vote totals, and cannot be undone.`
    );
    if (!confirmed) return;

    setFinalizingElectionId(election.id);
    try {
      await apiClient.post(`/elections/${election.id}/finalize`);
      await loadElections();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Failed to finalize election results.');
    } finally {
      setFinalizingElectionId(null);
    }
  }

  async function handleDelete(id) {

    if (!window.confirm('Delete this election?')) return;

    try {

      await apiClient.delete(`/elections/${id}`);

      await loadElections();

    } catch (error) {

      console.error(error);

      alert('Failed to delete election.');

    }
  }

  async function handleViewDetails(id) {
    setSelectedElection(null);
    setIsLoadingDetails(true);
    setDetailsError('');

    try {
      const { data } = await apiClient.get(`/elections/${id}`);
      setSelectedElection(data.data);
    } catch (error) {
      console.error(error);
      setDetailsError('Unable to load election details.');
    } finally {
      setIsLoadingDetails(false);
    }
  }

  const activeElections = elections.filter(
    (e) => e.status === 'draft' || e.status === 'active'
  );

  const historyElections = elections.filter(
    (e) => e.status === 'closed'
  );

  const pageSize = 8;

  useEffect(() => {
    setActivePage(1);
    setHistoryPage(1);
  }, [elections.length]);

  function renderTable(list, currentPage, setCurrentPage) {

    if (list.length === 0) {
      return <p className="muted">No elections found.</p>;
    }

    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const visibleList = list.slice(startIndex, startIndex + pageSize);
    const startItem = list.length === 0 ? 0 : startIndex + 1;
    const endItem = Math.min(startIndex + pageSize, list.length);

    return (

      <>

      <div className="table-shell">

      <table className="data-table">

        <thead>

          <tr>

            <th>Title</th>
            <th>Status</th>
            <th>Actions</th>

          </tr>

        </thead>

        <tbody>

          {visibleList.map((election) => (

            <tr key={election.id}>

              <td>{election.title}</td>

              <td>

                <span className={`badge badge-${election.status}`}>
                  {election.status}
                </span>

              </td>

              <td>

                <div className="section-actions">
                {election.status === 'closed' ? (
                  <button
                    type="button"
                    onClick={() => handleViewDetails(election.id)}
                    className="link-button"
                  >
                    View Details
                  </button>
                ) : (
                  <Link to={`/elections/${election.id}/positions`}>
                    Manage Positions →
                  </Link>
                )}
                {election.status === "draft" && (

                  <button
                    onClick={() => handleActivate(election.id)}
                    className="success-button"
                    style={{
                      marginLeft: 10,
                      padding: "7px 14px",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontWeight: "600"
                    }}
                  >
                    Activate
                  </button>

                )}

                {election.status === "active" && (

                  <button
                    onClick={() => handleClose(election.id)}
                    style={{
                      marginLeft: 10,
                      background: "#fd7e14",
                      color: "#fff",
                      border: "none",
                      padding: "7px 14px",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontWeight: "600"
                    }}
                  >
                    Close
                  </button>

                )}

                {isAdmin && election.status === 'active' && !election.finalized_at && (
                  <button
                    type="button"
                    className="finalize-election-button"
                    onClick={() => handleFinalize(election)}
                    disabled={finalizingElectionId === election.id}
                  >
                    {finalizingElectionId === election.id ? 'Finalizing...' : 'Finalize Results'}
                  </button>
                )}

                {election.status !== 'closed' && (
                  <button
                    onClick={() => handleDelete(election.id)}
                    className="danger-button"
                  >
                    Delete
                  </button>
                )}

                </div>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

      </div>

      <PaginationControls
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={list.length}
        startItem={startItem}
        endItem={endItem}
        onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
        onNext={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
      />

      </>

    );

  }

  if (isLoading && elections.length === 0) {
    return <LoadingSkeleton variant="elections" label="Loading elections" />;
  }

  return (

    <div>

      <h1 style={{ marginBottom: 10 }}>
        Election Management
      </h1>

      <p
        style={{
          color: "#666",
          marginBottom: 30
        }}
      >
        Create, activate and manage elections from one place.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 20,
          marginBottom: 35
        }}
      >

        <div
          style={{
            background: "#fff",
            padding: 22,
            borderRadius: 12,
            borderLeft: "5px solid var(--primary-2)",
            boxShadow: "0 3px 10px rgba(0,0,0,.08)"
          }}
        >
          <h3>Total Elections</h3>
          <h1 style={{ color: "var(--primary-2)" }}>
            {elections.length}
          </h1>
        </div>

        <div
          style={{
            background: "#fff",
            padding: 22,
            borderRadius: 12,
            borderLeft: "5px solid var(--accent)",
            boxShadow: "0 3px 10px rgba(0,0,0,.08)"
          }}
        >
          <h3>Active</h3>
          <h1 style={{ color: "var(--accent)" }}>
            {activeElections.length}
          </h1>
        </div>

        <div
          style={{
            background: "#fff",
            padding: 22,
            borderRadius: 12,
            borderLeft: "5px solid var(--primary-2)",
            boxShadow: "0 3px 10px rgba(0,0,0,.08)"
          }}
        >
          <h3>History</h3>
          <h1 style={{ color: "var(--primary-2)" }}>
            {historyElections.length}
          </h1>
        </div>

      </div>

      <div
        style={{
          background: "#fff",
          padding: 25,
          borderRadius: 12,
          boxShadow: "0 3px 10px rgba(0,0,0,.08)",
          marginBottom: 35,
          maxWidth: "650px",
          width: "100%",
          minWidth: 0,
        }}
      >

        <h2 style={{ marginBottom: 20 }}>
          Create New Election
        </h2>

        <form
          onSubmit={handleCreate}
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap"
          }}
        >
          <input
            type="text"
            placeholder="Election Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{
              flex: 1,
              minWidth: 0,
            }}
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              width: "140px",
            }}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
          </select>

          <button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create Election"}
          </button>

        </form>

      </div>

      <div style={{ marginBottom: 45 }}>

        <h2 style={{ marginBottom: 15 }}>
          Current Elections
        </h2>

        {renderTable(activeElections, activePage, setActivePage)}

      </div>

      <div>

        <h2 style={{ marginBottom: 15 }}>
          Election History
        </h2>

        {renderTable(historyElections, historyPage, setHistoryPage)}

      </div>

      {(selectedElection || isLoadingDetails || detailsError) && (
        <div className="election-details-overlay" role="presentation" onClick={() => setSelectedElection(null)}>
          <section
            className="election-details-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="election-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="election-details-header">
              <div>
                <span className="election-details-eyebrow">Election details</span>
                <h2 id="election-details-title">
                  {isLoadingDetails ? 'Loading election...' : selectedElection?.title}
                </h2>
              </div>
              <button type="button" className="election-details-close" onClick={() => setSelectedElection(null)} aria-label="Close details">
                ×
              </button>
            </div>

            {isLoadingDetails && <LoadingSkeleton variant="election-details" label="Loading election information" />}
            {detailsError && <p className="election-details-message election-details-error">{detailsError}</p>}
            {selectedElection && !isLoadingDetails && (
              <>
                <div className="election-details-summary">
                  <div><span>Status</span><strong>{selectedElection.status}</strong></div>
                  <div><span>Start date</span><strong>{selectedElection.start_date || 'Not set'}</strong></div>
                  <div><span>End date</span><strong>{selectedElection.end_date || 'Not set'}</strong></div>
                </div>

                <div className="election-details-positions">
                  <h3>Participants by Position</h3>
                  {(selectedElection.positions || []).length === 0 ? (
                    <p className="election-details-message">No positions or candidates were recorded.</p>
                  ) : (
                    selectedElection.positions.map((position) => (
                      <div className="election-details-position" key={position.id}>
                        <div className="election-details-position-heading">
                          <strong>{position.name}</strong>
                          <span>Vote for {position.vote_for_count}</span>
                        </div>
                        {(position.candidates || []).length === 0 ? (
                          <p className="election-details-muted">No candidates recorded.</p>
                        ) : (
                          <ul>
                            {position.candidates.map((candidate) => (
                              <li key={candidate.id}>
                                <span>{candidate.name}</span>
                                <small>{candidate.party || 'Independent'}</small>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}

    </div>

  );

}
