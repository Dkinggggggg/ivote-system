import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import PaginationControls from '../components/PaginationControls';
import LoadingSkeleton from '../components/LoadingSkeleton';
import './CandidatesPage.css';

export default function CandidatesPage() {

  const { positionId } = useParams();
  const navigate = useNavigate();

  const [candidates, setCandidates] = useState([]);
  const [position, setPosition] = useState(null);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const [name, setName] = useState('');
  const [party, setParty] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const photoInputRef = useRef(null);

  useEffect(() => {
    loadCandidates();
  }, [positionId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [positionId, candidates.length]);

  async function loadCandidates() {

    try {
      const { data } = await apiClient.get(
        `/positions/${positionId}/candidates`
      );

      setCandidates(data.data);
      setPosition(data.position);
      setTotalCandidates(data.total_candidates);
    } finally {
      setIsLoading(false);
    }

  }

  async function handleCreate(e) {

    e.preventDefault();

    const formData = new FormData();
    formData.append('name', name);
    formData.append('party', party);

    if (photoFile) {
      formData.append('photo_url', photoFile);
    }

    if (editingCandidate) {
      formData.append('_method', 'PUT');

      await apiClient.post(
        `/positions/${positionId}/candidates/${editingCandidate.id}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
    } else {
      await apiClient.post(
        `/positions/${positionId}/candidates`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
    }

    setName('');
    setParty('');
    setPhotoFile(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
    setEditingCandidate(null);

    await loadCandidates();

  }

  function startEdit(candidate) {
    setEditingCandidate(candidate);
    setName(candidate.name);
    setParty(candidate.party || '');
    setPhotoFile(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  }

  function cancelEdit() {
    setEditingCandidate(null);
    setName('');
    setParty('');
    setPhotoFile(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  }

  function selectPhoto(file) {
    if (!file) return;

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      alert('Please choose a JPG or PNG image.');
      return;
    }

    setPhotoFile(file);
  }

  function handlePhotoDrop(event) {
    event.preventDefault();
    setIsDraggingPhoto(false);
    selectPhoto(event.dataTransfer.files?.[0]);
  }

  async function handleDelete(id) {

    if (!window.confirm('Remove this candidate?')) return;

    await apiClient.delete(
      `/positions/${positionId}/candidates/${id}`
    );

    if (editingCandidate?.id === id) {
      cancelEdit();
    }

    await loadCandidates();

  }

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(candidates.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const visibleCandidates = candidates.slice(startIndex, startIndex + pageSize);
  const startItem = candidates.length === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(startIndex + pageSize, candidates.length);

  if (isLoading && candidates.length === 0) {
    return <LoadingSkeleton variant="candidates" label="Loading candidates" />;
  }

  return (
    <div className="candidate-page">
      <div className="candidate-page-header">
        <div>
          <button type="button" className="back-button" onClick={() => navigate(-1)}>
            ← Back to Positions
          </button>
          <h1>Candidate Management</h1>
          <p className="candidate-page-subtitle">Manage the candidates assigned to this position.</p>
        </div>
        {position && <div className="candidate-position-badge">{position.name}</div>}
      </div>

      {position && (
        <div className="candidate-context" aria-label="Position information">
          <div><span>Position</span><strong>{position.name}</strong></div>
          <div><span>Vote for</span><strong>{position.vote_for_count}</strong></div>
          <div><span>Total candidates</span><strong>{totalCandidates}</strong></div>
        </div>
      )}

      <section className="candidate-form-card">
        <div className="candidate-section-heading">
          <div>
            <span className="candidate-eyebrow">Candidate directory</span>
            <h2>{editingCandidate ? 'Edit Candidate' : 'Add New Candidate'}</h2>
          </div>
          {editingCandidate && <span className="candidate-editing-label">Editing candidate</span>}
        </div>

        <form onSubmit={handleCreate} className="candidate-form">
          <label className="candidate-name-field">
            <span className="candidate-label-line">Full Name <b>*</b></span>
            <input placeholder="Enter full name" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="candidate-party-field">
            <span className="candidate-label-line">Party / Group <em>(Optional)</em></span>
            <input placeholder="Enter party or group name" value={party} onChange={(e) => setParty(e.target.value)} />
          </label>
          <div className="candidate-photo-field">
            <span className="candidate-field-label">Photo <em>(Optional)</em></span>
            <label
              className={`candidate-upload-zone${isDraggingPhoto ? ' is-dragging' : ''}`}
              onDragEnter={(event) => { event.preventDefault(); setIsDraggingPhoto(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDraggingPhoto(false); }}
              onDrop={handlePhotoDrop}
            >
              <span className="candidate-upload-icon" aria-hidden="true">↑</span>
              <strong>{photoFile ? photoFile.name : 'Click to upload or drag and drop'}</strong>
              <small>JPG or PNG only</small>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => selectPhoto(e.target.files?.[0])}
                tabIndex="-1"
              />
            </label>
          </div>
          <div className="candidate-form-actions">
            <button type="submit"><span className="candidate-add-icon" aria-hidden="true">+</span>{editingCandidate ? 'Update Candidate' : 'Add Candidate'}</button>
            {editingCandidate && <button type="button" className="candidate-secondary-button" onClick={cancelEdit}>Cancel</button>}
          </div>
        </form>
        <p className="candidate-form-help">Adding a photo is optional. Use a JPG or PNG image; leave it blank to continue without a photo.</p>
      </section>

      <section className="candidate-list-card">
        <div className="candidate-list-heading">
          <div>
            <span className="candidate-eyebrow">Registered candidates</span>
            <h2>Candidate List</h2>
          </div>
          <strong className="candidate-count">{totalCandidates} total</strong>
        </div>

        <div className="table-shell">

        <table className="data-table">

          <thead>

            <tr>

              <th>Name</th>
              <th>Party</th>
              <th className="candidate-action-column">Actions</th>

            </tr>

          </thead>

          <tbody>

            {visibleCandidates.length > 0 ? (

              visibleCandidates.map((c) => (

                <tr key={c.id}>

                  <td><strong>{c.name}</strong></td>

                  <td>{c.party || "—"}</td>

                  <td>
                    <div className="candidate-row-actions">
                      <button className="candidate-edit-button" onClick={() => startEdit(c)}>Edit</button>
                      <button className="danger-button" onClick={() => handleDelete(c.id)}>Remove</button>
                    </div>
                  </td>

                </tr>

              ))

            ) : (

              <tr>

                <td
                  colSpan="3"
                  className="candidate-empty-state"
                >
                  No candidates added yet.
                </td>

              </tr>

            )}

          </tbody>

        </table>

        </div>

      </section>

      <PaginationControls
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={candidates.length}
        startItem={startItem}
        endItem={endItem}
        onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
        onNext={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
      />

    </div>

  );

}
