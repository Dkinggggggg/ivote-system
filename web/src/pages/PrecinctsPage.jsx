import React, { useEffect, useState } from 'react';
import apiClient from '../api/apiClient';
import Icon from '../components/Icon';
import './PrecinctsPage.css';

const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year'];
const EMPTY_FORM = {
  room: '',
  program: '',
  year_levels: [],
};

function collectionFrom(response) {
  const body = response?.data;
  return Array.isArray(body?.data) ? body.data : (Array.isArray(body) ? body : []);
}

function getErrorMessage(error, fallback) {
  const messages = error.response?.data?.errors;
  return (messages && Object.values(messages).flat().find((message) => typeof message === 'string'))
    || error.response?.data?.message
    || fallback;
}

export default function PrecinctsPage() {
  const [precincts, setPrecincts] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [commissioners, setCommissioners] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingPrecinct, setEditingPrecinct] = useState(null);
  const [precinctForCommissioner, setPrecinctForCommissioner] = useState(null);
  const [commissionerUserId, setCommissionerUserId] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingCommissioner, setIsSavingCommissioner] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPrecincts();
    loadPrograms();
  }, []);

  useEffect(() => {
    if (!isFormOpen && !precinctForCommissioner) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function closeOnEscape(event) {
      if (event.key !== 'Escape') return;
      if (isFormOpen && !isSaving) resetForm();
      if (precinctForCommissioner && !isSavingCommissioner) setPrecinctForCommissioner(null);
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [isFormOpen, isSaving, precinctForCommissioner, isSavingCommissioner]);

  async function loadPrecincts() {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/precincts');
      setPrecincts(collectionFrom(response));
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load precincts.'));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPrograms() {
    try {
      const [electionsResponse, usersResponse] = await Promise.all([
        apiClient.get('/elections'),
        apiClient.get('/users').catch(() => null),
      ]);
      const users = collectionFrom(usersResponse);
      setCommissioners(users.filter((user) => user.role === 'committee_officer'));
      const elections = collectionFrom(electionsResponse)
        .filter((election) => String(election.status || '').toLowerCase() !== 'closed');
      const positionResponses = await Promise.all(
        elections.map((election) => apiClient.get(`/elections/${election.id}/positions`).catch(() => null))
      );
      const governorPrograms = positionResponses.flatMap((response) => (
        collectionFrom(response)
          .filter((position) => (
            position.category_name === 'Governors'
            || position.category?.name === 'Governors'
            || position.name?.startsWith('Governor - ')
          ))
          .map((position) => (
            position.name?.startsWith('Governor - ')
              ? position.name.slice('Governor - '.length).trim()
              : position.name?.trim()
          ))
      ));
      const userPrograms = users.map((user) => user.program);
      setPrograms([...new Set([...governorPrograms, ...userPrograms].filter(Boolean))].sort());
    } catch {
      setPrograms([]);
    }
  }

  const filteredPrecincts = precincts.filter((precinct) => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return true;

    const searchableText = [
      precinct.precinct_number,
      precinct.room,
      precinct.program,
      ...(Array.isArray(precinct.year_levels) ? precinct.year_levels : [precinct.year_level]),
      precinct.commissioner_user?.name,
      precinct.commissioner,
    ].filter(Boolean).join(' ').toLowerCase();

    return searchableText.includes(keyword);
  });

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingPrecinct(null);
    setIsFormOpen(false);
    setError('');
  }

  function startEditing(precinct) {
    setEditingPrecinct(precinct);
    setForm({
      room: precinct.room || '',
      program: precinct.program || '',
      year_levels: Array.isArray(precinct.year_levels)
        ? precinct.year_levels.filter((year) => YEAR_LEVELS.includes(year))
        : (precinct.year_level && YEAR_LEVELS.includes(precinct.year_level) ? [precinct.year_level] : []),
    });
    setError('');
    setIsFormOpen(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (form.year_levels.length === 0) {
      setError('Select at least one year level.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      if (editingPrecinct) {
        await apiClient.put(`/precincts/${editingPrecinct.id}`, form);
      } else {
        await apiClient.post('/precincts', form);
      }
      resetForm();
      await loadPrecincts();
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Unable to save precinct.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(precinct) {
    if (!window.confirm(`Delete Precinct ${precinct.precinct_number}?`)) return;
    setError('');
    try {
      await apiClient.delete(`/precincts/${precinct.id}`);
      await loadPrecincts();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Unable to delete precinct.'));
    }
  }

  function startAssigningCommissioner(precinct) {
    setPrecinctForCommissioner(precinct);
    setCommissionerUserId(precinct.commissioner_user_id ? String(precinct.commissioner_user_id) : '');
    setError('');
  }

  async function handleSaveCommissioner(event) {
    event.preventDefault();
    setIsSavingCommissioner(true);
    setError('');
    try {
      await apiClient.patch(`/precincts/${precinctForCommissioner.id}/commissioner`, {
        commissioner_user_id: commissionerUserId || null,
      });
      setPrecinctForCommissioner(null);
      await loadPrecincts();
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Unable to update commissioner.'));
    } finally {
      setIsSavingCommissioner(false);
    }
  }

  return (
    <div className="precincts-page">
      <header className="users-page-header">
        <div>
          <h1>Manage Precinct</h1>
        </div>
        <button
          type="button"
          className="users-create-button users-page-add-button"
          onClick={() => {
            setEditingPrecinct(null);
            setForm(EMPTY_FORM);
            setError('');
            setIsFormOpen(true);
          }}
          aria-expanded={isFormOpen}
        >
          <Icon name="add" size={17} /> Add Precinct
        </button>
      </header>

      <div className="users-summary-grid">
        <div className="users-summary-card">
          <span className="users-summary-icon"><Icon name="flag" size={20} /></span>
          <div>
            <p>Total Precincts</p>
            <strong>{precincts.length}</strong>
          </div>
        </div>

        <div className="users-summary-card">
          <span className="users-summary-icon is-accent"><Icon name="user" size={20} /></span>
          <div>
            <p>Assigned Commissioners</p>
            <strong>{precincts.filter((precinct) => precinct.commissioner_user_id).length}</strong>
          </div>
        </div>

        <div className="users-summary-card">
          <span className="users-summary-icon"><Icon name="close" size={20} /></span>
          <div>
            <p>Unassigned Precincts</p>
            <strong>{precincts.filter((precinct) => !precinct.commissioner_user_id).length}</strong>
          </div>
        </div>
      </div>

      {error && <p className="precincts-feedback" role="alert">{error}</p>}

      {isFormOpen && (
        <div className="precinct-modal-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isSaving) resetForm();
        }}>
          <section className="precinct-form-panel" role="dialog" aria-modal="true" aria-labelledby="precinct-form-title">
            <header className="precinct-modal-header">
              <div className="precinct-dialog-heading">
                <span className="precinct-dialog-icon"><Icon name="flag" size={20} /></span>
                <div>
                  <h2 id="precinct-form-title">{editingPrecinct ? 'Edit Precinct' : 'Add Precinct'}</h2>
                </div>
              </div>
              <button
                type="button"
                className="precinct-modal-close"
                onClick={resetForm}
                disabled={isSaving}
                aria-label="Close precinct form"
                title="Close"
              >
                <Icon name="close" size={18} />
              </button>
            </header>
            <form className="precinct-form" onSubmit={handleSubmit}>
            <label>
              <span>Room</span>
              <input
                value={form.room}
                onChange={(event) => setForm({ ...form, room: event.target.value })}
                placeholder="Enter your campus building and room"
                maxLength={150}
                required
              />
            </label>
            <label>
              <span>Program</span>
              <select
                value={form.program}
                onChange={(event) => setForm({ ...form, program: event.target.value })}
                required
              >
                <option value="" disabled>Select program</option>
                {form.program && !programs.includes(form.program) && (
                  <option value={form.program}>{form.program}</option>
                )}
                {programs.map((program) => <option key={program} value={program}>{program}</option>)}
              </select>
              {programs.length === 0 && <small>No programs available from election positions or officer assignments.</small>}
            </label>
            <fieldset className="precinct-year-field" aria-required="true">
              <legend>Year Level</legend>
              <div className="precinct-year-options">
                {YEAR_LEVELS.map((year) => (
                  <label
                    key={year}
                    className={`precinct-year-option${form.year_levels.includes(year) ? ' is-selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={form.year_levels.includes(year)}
                      onChange={() => setForm((current) => ({
                        ...current,
                        year_levels: current.year_levels.includes(year)
                          ? current.year_levels.filter((selectedYear) => selectedYear !== year)
                          : [...current.year_levels, year],
                      }))}
                    />
                    <span>{year}</span>
                  </label>
                ))}
              </div>
              <small>Select one or more year levels.</small>
            </fieldset>
            <div className="precinct-form-actions">
              <button type="submit" className="users-create-button" disabled={isSaving}>
                <Icon name={editingPrecinct ? 'save' : 'add'} size={16} />
                {isSaving ? 'Saving...' : editingPrecinct ? 'Save Changes' : 'Save Precinct'}
              </button>
              <button type="button" className="precinct-cancel-button" onClick={resetForm}>Cancel</button>
            </div>
            </form>
          </section>
        </div>
      )}

      <section className="precinct-list-section" aria-labelledby="precinct-list-title">
        <div className="precinct-list-heading">
          <h2 id="precinct-list-title">Precincts</h2>
          <span>{searchQuery.trim() ? `${filteredPrecincts.length} of ${precincts.length}` : `${precincts.length}`} {precincts.length === 1 ? 'precinct' : 'precincts'}</span>
        </div>
        <div className="precincts-toolbar">
          <label className="precincts-search-field">
            <Icon name="search" size={17} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search precinct, room, program, year, or commissioner"
              aria-label="Search precincts"
            />
          </label>
        </div>
        <div className="table-shell">
          <table className="data-table precincts-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Program &amp; Year</th>
                <th>Commissioner</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="4" className="precincts-empty">Loading precincts...</td></tr>
              ) : precincts.length === 0 ? (
                <tr><td colSpan="4" className="precincts-empty">No precincts added yet.</td></tr>
              ) : filteredPrecincts.length === 0 ? (
                <tr><td colSpan="4" className="precincts-empty">No precincts match your search.</td></tr>
              ) : filteredPrecincts.map((precinct) => (
                <tr key={precinct.id}>
                  <td>
                    <strong>{precinct.room}</strong>
                    <small>Precinct {precinct.precinct_number}</small>
                  </td>
                  <td>{precinct.program} · {(precinct.year_levels || [precinct.year_level]).filter(Boolean).join(', ')}</td>
                  <td>{precinct.commissioner_user?.name || precinct.commissioner || '—'}</td>
                  <td>
                    <div className="precinct-row-actions">
                      <button type="button" className={`precinct-assign-button${precinct.commissioner_user_id ? ' is-assigned' : ''}`} onClick={() => startAssigningCommissioner(precinct)}>
                        <Icon name="user" size={15} />
                        {precinct.commissioner_user_id ? 'Change Commissioner' : 'Assign Commissioner'}
                      </button>
                      <button type="button" className="users-row-icon-button" onClick={() => startEditing(precinct)} title="Edit precinct" aria-label={`Edit Precinct ${precinct.precinct_number}`}>
                        <Icon name="edit" size={15} />
                      </button>
                      <button type="button" className="users-row-icon-button is-danger" onClick={() => handleDelete(precinct)} title="Delete precinct" aria-label={`Delete Precinct ${precinct.precinct_number}`}>
                        <Icon name="delete" size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {precinctForCommissioner && (
        <div className="precinct-modal-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isSavingCommissioner) setPrecinctForCommissioner(null);
        }}>
          <section className="precinct-form-panel precinct-commissioner-dialog" role="dialog" aria-modal="true" aria-labelledby="commissioner-dialog-title">
            <header className="precinct-modal-header">
              <h2 id="commissioner-dialog-title">Assign Commissioner</h2>
              <button
                type="button"
                className="precinct-modal-close"
                onClick={() => setPrecinctForCommissioner(null)}
                disabled={isSavingCommissioner}
                aria-label="Close commissioner assignment"
              >
                <Icon name="close" size={18} />
              </button>
            </header>
            <p className="precinct-commissioner-context">
              Precinct {precinctForCommissioner.precinct_number} · {precinctForCommissioner.room}
            </p>
            <form className="precinct-commissioner-form" onSubmit={handleSaveCommissioner}>
              <label>
                <span>Committee officer</span>
                <select
                  value={commissionerUserId}
                  onChange={(event) => setCommissionerUserId(event.target.value)}
                  disabled={commissioners.length === 0}
                >
                  <option value="">Unassigned</option>
                  {commissioners.map((commissioner) => (
                    <option key={commissioner.id} value={String(commissioner.id)}>{commissioner.name}</option>
                  ))}
                </select>
                {commissioners.length === 0 && <small>Create a committee officer account first.</small>}
              </label>
              <div className="precinct-form-actions">
                <button type="submit" className="users-create-button" disabled={isSavingCommissioner || commissioners.length === 0}>
                  <Icon name="save" size={16} /> {isSavingCommissioner ? 'Saving...' : 'Save Assignment'}
                </button>
                <button type="button" className="precinct-cancel-button" onClick={() => setPrecinctForCommissioner(null)} disabled={isSavingCommissioner}>Cancel</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}