import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import apiClient from '../api/apiClient';
import Icon from '../components/Icon';
import LoadingSkeleton from '../components/LoadingSkeleton';
import './CandidatesPage.css';

function getErrorMessage(error, fallback) {
  const validationErrors = error.response?.data?.errors;
  const validationMessage = validationErrors
    ? Object.values(validationErrors).flat().find((message) => typeof message === 'string')
    : null;

  return validationMessage || error.response?.data?.message || fallback;
}

function getDefaultPositionCategoryId(positionName, categories) {
  const normalizedName = positionName.trim().toLowerCase();
  let categoryName = '';

  if (normalizedName === 'president' || normalizedName === 'vice president') {
    categoryName = 'Executive Officers';
  } else if (normalizedName === 'senator' || normalizedName === 'senators') {
    categoryName = 'Senators';
  } else if (normalizedName.startsWith('governor')) {
    categoryName = 'Governors';
  } else if (normalizedName.startsWith('batch representative')) {
    categoryName = 'Batch Representatives';
  }

  const category = categories.find((item) => item.name.toLowerCase() === categoryName.toLowerCase());
  return category ? String(category.id) : '';
}

export default function ElectionCandidatesPage() {
  const { electionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [election, setElection] = useState(null);
  const [availableElections, setAvailableElections] = useState([]);
  const [selectedElectionValue, setSelectedElectionValue] = useState('');
  const [positions, setPositions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [parties, setParties] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('candidates');
  const [partyFilter, setPartyFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [candidateSearch, setCandidateSearch] = useState('');

  const [candidateName, setCandidateName] = useState('');
  const [candidateParty, setCandidateParty] = useState('');
  const [candidatePositionId, setCandidatePositionId] = useState('');
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [isCandidateFormOpen, setIsCandidateFormOpen] = useState(false);
  const [candidateError, setCandidateError] = useState('');
  const [isSavingCandidate, setIsSavingCandidate] = useState(false);

  const [positionName, setPositionName] = useState('');
  const [positionVoteForCount, setPositionVoteForCount] = useState('1');
  const [positionCategoryId, setPositionCategoryId] = useState('');
  const [editingPosition, setEditingPosition] = useState(null);
  const [isPositionFormOpen, setIsPositionFormOpen] = useState(false);
  const [positionError, setPositionError] = useState('');
  const [isSavingPosition, setIsSavingPosition] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const [partyName, setPartyName] = useState('');
  const [editingParty, setEditingParty] = useState(null);
  const [isPartyFormOpen, setIsPartyFormOpen] = useState(false);
  const [partyError, setPartyError] = useState('');
  const [isSavingParty, setIsSavingParty] = useState(false);
  const [expandedPositions, setExpandedPositions] = useState({});
  const [expandedCandidateCategories, setExpandedCandidateCategories] = useState({});

  useEffect(() => {
    setExpandedCandidateCategories({});
    loadData();
  }, [electionId]);

  useEffect(() => {
    if (!isCandidateFormOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function closeOnEscape(event) {
      if (event.key !== 'Escape') return;
      setCandidateName('');
      setCandidateParty('');
      setCandidatePositionId('');
      setEditingCandidate(null);
      setIsCandidateFormOpen(false);
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [isCandidateFormOpen]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    const pathTab = location.pathname.endsWith('/party-list')
      ? 'positions'
      : location.pathname.endsWith('/candidates')
        ? 'candidates'
        : null;

    const nextTab = tab || pathTab || 'candidates';
    if (nextTab === 'positions' || nextTab === 'candidates' || nextTab === 'review') {
      setActiveTab(nextTab);
    }
  }, [searchParams, location.pathname]);

  async function loadData() {
    try {
      const [electionResponse, positionsResponse, candidatesResponse, partiesResponse, categoriesResponse, electionsResponse] = await Promise.all([
        apiClient.get(`/elections/${electionId}`),
        apiClient.get(`/elections/${electionId}/positions`),
        apiClient.get(`/elections/${electionId}/candidates`),
        apiClient.get(`/elections/${electionId}/parties`),
        apiClient.get(`/elections/${electionId}/position-categories`),
        apiClient.get('/elections').catch(() => null),
      ]);

      const loadedPositions = positionsResponse.data.data;
      const loadedCategories = categoriesResponse.data.data.filter(
        (category) => !['Custom Positions', 'Custom Position'].includes(category.name)
      );
      const preferredPositionId = searchParams.get('position');

      setElection(electionResponse.data.data);
      if (electionsResponse) {
        const electionList = electionsResponse.data.data ?? electionsResponse.data;
        setAvailableElections(Array.isArray(electionList) ? electionList : []);
      }
      localStorage.setItem('selectedElectionId', String(electionId));
      setPositions(loadedPositions);
      setCategories(loadedCategories);
      setCandidates(candidatesResponse.data.data);
      setParties(partiesResponse.data.data);
      setPositionCategoryId((currentId) => (
        loadedCategories.some((category) => String(category.id) === currentId)
          ? currentId
          : ''
      ));
      setCandidatePositionId((currentId) => {
        if (loadedPositions.some((position) => String(position.id) === currentId)) {
          return currentId;
        }

        if (loadedPositions.some((position) => String(position.id) === preferredPositionId)) {
          return preferredPositionId;
        }

        return '';
      });
    } catch (error) {
      setCandidateError(getErrorMessage(error, 'Unable to load election candidates.'));
    } finally {
      setIsLoading(false);
    }
  }

  function handleElectionChange(event) {
    const nextElectionId = event.target.value;
    if (!nextElectionId) return;

    setSelectedElectionValue(nextElectionId);
    localStorage.setItem('selectedElectionId', nextElectionId);
    const electionSection = activeTab === 'positions' ? 'party-list' : 'candidates';
    const reviewQuery = activeTab === 'review' ? '?tab=review' : '';
    navigate(`/election-management/${nextElectionId}/${electionSection}${reviewQuery}`);
  }

  function resetCandidateForm() {
    setCandidateName('');
    setCandidateParty('');
    setCandidatePositionId('');
    setEditingCandidate(null);
    setIsCandidateFormOpen(false);
  }

  async function handleSaveCandidate(event) {
    event.preventDefault();
    setCandidateError('');
    setIsSavingCandidate(true);

    const payload = {
      name: candidateName.trim(),
      party: candidateParty,
      position_id: Number(candidatePositionId),
    };

    try {
      if (editingCandidate) {
        await apiClient.put(`/elections/${electionId}/candidates/${editingCandidate.id}`, payload);
      } else {
        await apiClient.post(`/elections/${electionId}/candidates`, payload);
      }

      resetCandidateForm();
      await loadData();
    } catch (error) {
      setCandidateError(getErrorMessage(error, 'Unable to save candidate.'));
    } finally {
      setIsSavingCandidate(false);
    }
  }

  function startEditCandidate(candidate) {
    setEditingCandidate(candidate);
    setIsCandidateFormOpen(true);
    setCandidateName(candidate.name);
    setCandidateParty(candidate.party || '');
    setCandidatePositionId(String(candidate.position_id));
    setCandidateError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDeleteCandidate(candidate) {
    if (!window.confirm(`Delete candidate "${candidate.name}"?`)) return;

    try {
      await apiClient.delete(`/elections/${electionId}/candidates/${candidate.id}`);
      if (editingCandidate?.id === candidate.id) resetCandidateForm();
      await loadData();
    } catch (error) {
      setCandidateError(getErrorMessage(error, 'Unable to delete candidate.'));
    }
  }

  function resetPositionForm() {
    setPositionName('');
    setPositionVoteForCount('1');
    setPositionCategoryId('');
    setEditingPosition(null);
    setIsPositionFormOpen(false);
    setPositionError('');
  }

  async function handleSavePosition(event) {
    event.preventDefault();
    setPositionError('');

    const name = positionName.trim();
    if (!name) return;

    const categoryId = getDefaultPositionCategoryId(name, categories) || positionCategoryId;
    if (!categoryId) {
      setPositionError('Select a category for this position.');
      return;
    }

    const duplicate = positions.some((position) => (
      position.id !== editingPosition?.id
      && position.name.toLowerCase() === name.toLowerCase()
    ));
    if (duplicate) {
      setPositionError('This position already exists for this election.');
      return;
    }

    setIsSavingPosition(true);
    const payload = {
      name,
      vote_for_count: Number(positionVoteForCount),
      category_id: Number(categoryId),
    };

    try {
      if (editingPosition) {
        await apiClient.put(`/elections/${electionId}/positions/${editingPosition.id}`, payload);
      } else {
        await apiClient.post(`/elections/${electionId}/positions`, {
          ...payload,
          display_order: positions.length + 1,
        });
      }

      resetPositionForm();
      await loadData();
    } catch (error) {
      setPositionError(getErrorMessage(error, 'Unable to save position.'));
    } finally {
      setIsSavingPosition(false);
    }
  }

  function startEditPosition(position) {
    setEditingPosition(position);
    setPositionName(position.name);
    setPositionVoteForCount(String(position.vote_for_count || 1));
    setPositionCategoryId(String(position.category_id || ''));
    setIsPositionFormOpen(true);
    setPositionError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDeletePosition(position) {
    if (!window.confirm(`Delete position "${position.name}"?`)) return;

    try {
      await apiClient.delete(`/elections/${electionId}/positions/${position.id}`);
      if (editingPosition?.id === position.id) resetPositionForm();
      await loadData();
    } catch (error) {
      setPositionError(getErrorMessage(error, 'Unable to delete position.'));
    }
  }

  async function handleCreateCategory(event) {
    event.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;

    setCategoryError('');
    setIsSavingCategory(true);

    try {
      await apiClient.post(`/elections/${electionId}/position-categories`, { name });
      setNewCategoryName('');
      setIsCategoryFormOpen(false);
      await loadData();
    } catch (error) {
      setCategoryError(getErrorMessage(error, 'Unable to create category.'));
    } finally {
      setIsSavingCategory(false);
    }
  }

  function startEditCategory(category) {
    setEditingCategory(category);
    setEditingCategoryName(category.name);
    setCategoryError('');
  }

  async function handleSaveCategory(event) {
    event.preventDefault();
    const name = editingCategoryName.trim();
    if (!name || !editingCategory) return;

    setCategoryError('');
    setIsSavingCategory(true);

    try {
      await apiClient.put(
        `/elections/${electionId}/position-categories/${editingCategory.id}`,
        { name }
      );
      setEditingCategory(null);
      setEditingCategoryName('');
      await loadData();
    } catch (error) {
      setCategoryError(getErrorMessage(error, 'Unable to update category.'));
    } finally {
      setIsSavingCategory(false);
    }
  }

  async function handleDeleteCategory(category) {
    if (!window.confirm(`Delete category "${category.name}"?`)) return;

    setCategoryError('');
    try {
      await apiClient.delete(`/elections/${electionId}/position-categories/${category.id}`);
      if (editingCategory?.id === category.id) {
        setEditingCategory(null);
        setEditingCategoryName('');
      }
      await loadData();
    } catch (error) {
      setCategoryError(getErrorMessage(error, 'Unable to delete category.'));
    }
  }

  async function handleSaveParty(event) {
    event.preventDefault();
    setPartyError('');
    setIsSavingParty(true);

    try {
      if (editingParty) {
        await apiClient.put(`/elections/${electionId}/parties/${editingParty.id}`, { name: partyName.trim() });
      } else {
        await apiClient.post(`/elections/${electionId}/parties`, { name: partyName.trim() });
      }

      setPartyName('');
      setEditingParty(null);
      setIsPartyFormOpen(false);
      await loadData();
    } catch (error) {
      setPartyError(getErrorMessage(error, 'Unable to save party.'));
    } finally {
      setIsSavingParty(false);
    }
  }

  function startEditParty(party) {
    setEditingParty(party);
    setPartyName(party.name);
    setPartyError('');
  }

  async function handleDeleteParty(party) {
    if (!window.confirm(`Delete party "${party.name}"?`)) return;

    try {
      await apiClient.delete(`/elections/${electionId}/parties/${party.id}`);
      if (editingParty?.id === party.id) {
        setEditingParty(null);
        setPartyName('');
      }
      if (candidateParty === party.name) setCandidateParty('');
      await loadData();
    } catch (error) {
      setPartyError(getErrorMessage(error, 'Unable to delete party.'));
    }
  }

  function togglePosition(positionId) {
    setExpandedPositions((current) => ({
      ...current,
      [positionId]: !current[positionId],
    }));
  }

  async function handleSaveDraft() {
    try {
      await apiClient.put(`/elections/${electionId}`, {
        title: election.title,
        status: 'draft',
      });
      await loadData();
      navigate('/elections');
    } catch (error) {
      setCandidateError(getErrorMessage(error, 'Unable to save election as draft.'));
    }
  }

  async function handleActivateElection() {
    try {
      await apiClient.patch(`/elections/${electionId}/activate`);
      await loadData();
      navigate('/elections');
    } catch (error) {
      setCandidateError(getErrorMessage(error, 'Unable to activate election.'));
    }
  }

  const filteredCandidates = candidates.filter((candidate) => {
    const matchesParty = partyFilter === 'all' || candidate.party === partyFilter;
    const matchesPosition = positionFilter === 'all' || String(candidate.position_id) === positionFilter;
    const searchText = `${candidate.name || ''} ${candidate.party || ''} ${candidate.position_name || ''}`.toLowerCase();
    return matchesParty && matchesPosition && searchText.includes(candidateSearch.trim().toLowerCase());
  });
  const positionById = new Map(positions.map((position) => [String(position.id), position]));
  const candidateCategoryOrder = ['executive officers', 'senators', 'governors', 'batch representatives'];
  const getCandidateCategoryName = (candidate) => {
    const position = positionById.get(String(candidate.position_id));
    return position?.category_name
      || position?.category?.name
      || categories.find((category) => String(category.id) === String(position?.category_id))?.name
      || 'No category assigned';
  };
  const getCandidateCategoryKey = (candidate) => {
    const position = positionById.get(String(candidate.position_id));
    return position?.category_id == null ? 'uncategorized' : String(position.category_id);
  };
  const orderedCandidates = [...filteredCandidates].sort((first, second) => {
    const firstCategory = getCandidateCategoryName(first).toLowerCase();
    const secondCategory = getCandidateCategoryName(second).toLowerCase();
    const firstOrder = candidateCategoryOrder.indexOf(firstCategory);
    const secondOrder = candidateCategoryOrder.indexOf(secondCategory);
    return (firstOrder === -1 ? candidateCategoryOrder.length : firstOrder)
      - (secondOrder === -1 ? candidateCategoryOrder.length : secondOrder);
  });
  const visibleCandidates = orderedCandidates;

  const candidateNameCounts = candidates.reduce((accumulator, candidate) => {
    const key = (candidate.name || '').trim().toLowerCase();
    if (!key) return accumulator;
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  const reviewCheckItems = [
    {
      label: 'Missing candidates',
      items: positions
        .filter((position) => candidates.filter((candidate) => candidate.position_id === position.id).length === 0)
        .map((position) => `${position.name} has no registered candidates.`),
    },
    {
      label: 'Missing party assignments',
      items: candidates
        .filter((candidate) => !(candidate.party || '').trim())
        .map((candidate) => `${candidate.name} is missing a party.`),
    },
    {
      label: 'Duplicate candidates',
      items: Object.entries(candidateNameCounts)
        .filter(([, count]) => count > 1)
        .map(([name]) => `Duplicate candidate found: ${name}.`),
    },
    {
      label: 'Incomplete position settings',
      items: positions
        .filter((position) => !position.name || !position.vote_for_count || Number(position.vote_for_count) < 1)
        .map((position) => `${position.name || 'Unnamed position'} needs a valid vote-for count.`),
    },
  ].filter((group) => group.items.length > 0);

  let previousCandidateCategory = null;
  const candidateCategoryRowNumbers = {};
  const visibleCandidateRows = visibleCandidates.flatMap((candidate) => {
    const position = positionById.get(String(candidate.position_id));
    const categoryKey = getCandidateCategoryKey(candidate);
    const categoryName = getCandidateCategoryName(candidate);
    const isCategoryExpanded = Boolean(expandedCandidateCategories[categoryKey]);
    candidateCategoryRowNumbers[categoryKey] = (candidateCategoryRowNumbers[categoryKey] || 0) + 1;
    const categoryRowNumber = candidateCategoryRowNumbers[categoryKey];
    const groupRow = categoryKey !== previousCandidateCategory
      ? [(
        <tr className="candidate-category-group-row" key={`category-${categoryKey}`}>
          <td colSpan="5">
            <button
              type="button"
              className="candidate-category-toggle"
              aria-expanded={isCategoryExpanded}
              onClick={() => setExpandedCandidateCategories((current) => ({
                ...current,
                [categoryKey]: !current[categoryKey],
              }))}
            >
              <span className="candidate-category-caret" aria-hidden="true"><Icon name={isCategoryExpanded ? 'chevronDown' : 'chevronRight'} size={14} /></span>
              <strong>{categoryName}</strong>
            </button>
          </td>
        </tr>
      )]
      : [];

    previousCandidateCategory = categoryKey;

    return [
      ...groupRow,
      ...(isCategoryExpanded ? [<tr key={`candidate-${candidate.id}`}>
        <td><span className="candidate-row-number">{categoryRowNumber}</span></td>
        <td><strong>{candidate.name}</strong></td>
        <td>{candidate.party || '—'}</td>
        <td>{candidate.position_name || position?.name || '—'}</td>
        <td>
          <div className="candidate-row-actions reference-row-actions">
            <button type="button" className="candidate-edit-button" onClick={() => startEditCandidate(candidate)}>
              <Icon name="edit" /> Edit
            </button>
            <button type="button" className="danger-button" onClick={() => handleDeleteCandidate(candidate)}>
              <Icon name="delete" /> Delete
            </button>
          </div>
        </td>
      </tr>] : []),
    ];
  });

  function renderPartyManagement() {
    return (
      <section className="party-management-card">
        <div className="reference-panel-heading">
          <Icon name="parties" size={27} />
          <div>
            <h2>Party Management</h2>
            <p>Add, edit, or remove party names.</p>
          </div>
        </div>

        <div className="party-management-body">
          <div className="position-management-list-heading">
            <h3>Available Parties</h3>
          </div>
          <div className="election-category-list party-management-list">
            {parties.length > 0 ? parties.map((party) => (
              <div className="election-category-item" key={party.id}>
                <span>{party.name}</span>
                <div className="management-item-actions">
                  <button
                    type="button"
                    className="icon-action-button"
                    onClick={() => startEditParty(party)}
                    title={`Edit ${party.name}`}
                    aria-label={`Edit ${party.name}`}
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    type="button"
                    className="icon-action-button party-delete-action"
                    onClick={() => handleDeleteParty(party)}
                    title={`Delete ${party.name}`}
                    aria-label={`Delete ${party.name}`}
                  >
                    <Icon name="delete" />
                  </button>
                </div>
              </div>
            )) : (
              <p className="candidate-empty-state">No parties registered.</p>
            )}
          </div>

          {!isPartyFormOpen ? (
            <div className="party-form-toggle-row">
              <button
                type="button"
                className="reference-primary-button"
                onClick={() => {
                  setEditingParty(null);
                  setPartyName('');
                  setIsPartyFormOpen(true);
                }}
              >
                <Icon name="add" />
                Add Party
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveParty} className="party-form">
              <input
                aria-label="Party name"
                value={partyName}
                onChange={(event) => setPartyName(event.target.value)}
                placeholder="Enter party name (e.g. Party A)"
                maxLength={100}
                required
                autoFocus
              />
              <div className="party-form-actions">
                <button type="submit" className="reference-primary-button" disabled={isSavingParty}>
                  <Icon name="add" />
                  {isSavingParty ? 'Saving…' : editingParty ? 'Save Party' : 'Add Party'}
                </button>
                <button
                  type="button"
                  className="reference-secondary-button"
                  onClick={() => {
                    setEditingParty(null);
                    setPartyName('');
                    setIsPartyFormOpen(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
        {partyError && <p className="candidate-feedback candidate-feedback-error" role="alert">{partyError}</p>}
      </section>
    );
  }

  function renderCandidateRegistration() {
    return (
      <section className="candidate-form-card reference-section-card">
        <div className="reference-panel-heading">
          <Icon name="candidates" size={27} />
          <div>
            <h2>{editingCandidate ? 'Edit Candidate' : 'Candidate Registration'}</h2>
            <p>Add a new candidate to the election.</p>
          </div>
          {editingCandidate && <span className="candidate-editing-label">Editing candidate</span>}
        </div>

        {!isCandidateFormOpen && (
          <div className="candidate-form-actions reference-candidate-actions">
            <button
              type="button"
              className="reference-primary-button"
              onClick={() => {
                setEditingCandidate(null);
                setCandidateName('');
                setCandidateParty('');
                setCandidatePositionId('');
                setCandidateError('');
                setIsCandidateFormOpen(true);
              }}
            >
              <Icon name="add" />
              Add Candidate
            </button>
          </div>
        )}
        {isCandidateFormOpen && (
          <div className="candidate-modal-overlay" role="presentation" onClick={resetCandidateForm}>
            <section
              className="candidate-modal-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="candidate-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="candidate-modal-header">
                <div className="candidate-modal-heading">
                  <span className="candidate-modal-icon"><Icon name="candidates" size={21} /></span>
                  <div>
                    <h2 id="candidate-modal-title">{editingCandidate ? 'Edit Candidate' : 'Add Candidate'}</h2>
                    <p>Candidate details</p>
                  </div>
                </div>
                <button type="button" className="candidate-modal-close" onClick={resetCandidateForm} aria-label="Close candidate form">
                  <Icon name="close" size={18} />
                </button>
              </div>
              {candidateError && <p className="candidate-feedback candidate-feedback-error" role="alert">{candidateError}</p>}
              <form onSubmit={handleSaveCandidate} className="candidate-form reference-candidate-form candidate-modal-form">
                <label>
                  <span className="candidate-label-line">Candidate Full Name <b>*</b></span>
                  <input
                    value={candidateName}
                    onChange={(event) => setCandidateName(event.target.value)}
                    placeholder="Enter candidate's full name"
                    maxLength={150}
                    required
                    autoFocus
                  />
                </label>
                <label>
                  <span className="candidate-label-line">Party <b>*</b></span>
                  <select value={candidateParty} onChange={(event) => setCandidateParty(event.target.value)} required>
                    <option value="" disabled>{parties.length ? 'Select Party' : 'Add a party first'}</option>
                    {parties.map((party) => <option key={party.id} value={party.name}>{party.name}</option>)}
                  </select>
                </label>
                <label>
                  <span className="candidate-label-line">Position <b>*</b></span>
                  <select value={candidatePositionId} onChange={(event) => setCandidatePositionId(event.target.value)} required>
                    <option value="" disabled>Select Position</option>
                    {positions.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}
                  </select>
                </label>
                <div className="candidate-form-actions">
                  <button type="submit" className="reference-primary-button" disabled={isSavingCandidate || !parties.length || !positions.length}>
                    <Icon name="add" />
                    {isSavingCandidate ? 'Saving…' : editingCandidate ? 'Save Candidate' : 'Add Candidate'}
                  </button>
                  <button type="button" className="reference-secondary-button" onClick={resetCandidateForm}>Cancel</button>
                </div>
              </form>
            </section>
          </div>
        )}
        {(!parties.length || !positions.length) && (
          <p className="candidate-form-help">
            {!parties.length ? 'Add a party before registering candidates.' : 'Add a position before registering candidates.'}
          </p>
        )}
      </section>
    );
  }

  function renderCandidateDirectory() {
    return (
      <section className="candidate-list-card reference-section-card">
        <div className="reference-panel-heading reference-list-heading">
          <Icon name="list" size={27} />
          <div>
            <h2>Registered Candidates</h2>
            <p>View and manage all candidates for this election.</p>
          </div>
          <div className="candidate-list-tools">
            <label>
              <span>Filter by Party</span>
              <select value={partyFilter} onChange={(event) => setPartyFilter(event.target.value)}>
                <option value="all">All Parties</option>
                {parties.map((party) => <option key={party.id} value={party.name}>{party.name}</option>)}
              </select>
            </label>
            <label>
              <span>Filter by Position</span>
              <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)}>
                <option value="all">All Positions</option>
                {positions.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}
              </select>
            </label>
          </div>
          <label className="candidate-search-field">
            <span className="visually-hidden">Search candidates</span>
            <Icon name="search" size={16} />
            <input
              value={candidateSearch}
              onChange={(event) => setCandidateSearch(event.target.value)}
              placeholder="Search candidate..."
            />
          </label>
        </div>

        <div className="table-shell reference-candidate-table">
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>Candidate Name</th><th>Party</th><th>Position</th><th className="candidate-action-column">Actions</th></tr>
            </thead>
            <tbody>
              {visibleCandidateRows.length > 0 ? visibleCandidateRows : (
                <tr><td colSpan="5" className="candidate-empty-state">No candidates match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  const selectableElections = availableElections.filter(
    (item) => String(item.status || '').toLowerCase() !== 'closed'
  );
  const includeCurrentElection = election && String(election.status || '').toLowerCase() !== 'closed';
  const electionOptions = includeCurrentElection && !selectableElections.some(
    (item) => String(item.id) === String(election.id)
  )
    ? [election, ...selectableElections]
    : selectableElections;
  const backTarget = activeTab === 'review'
    ? { label: 'Back to Candidates', path: `/election-management/${electionId}/candidates` }
    : activeTab === 'candidates'
      ? { label: 'Back to Party List', path: `/election-management/${electionId}/party-list` }
      : { label: 'Back to Election', path: '/elections' };

  if (isLoading) {
    return <LoadingSkeleton variant="candidates" label="Loading candidates" />;
  }

  return (
    <div className="candidate-page">
      <header className="reference-management-header">
        <div className="reference-management-title">
          <div>
            <h1>Election Management</h1>
            <p>Manage parties and candidates for your election.</p>
          </div>
        </div>
        <div className="reference-management-actions">
          <div className="reference-election-field">
            <select
              className="reference-election-select"
              aria-label="Select Election"
              value={selectedElectionValue}
              onChange={handleElectionChange}
            >
              <option value="" disabled>{electionOptions.length ? 'Select election' : 'No elections available'}</option>
              {electionOptions.map((item) => (
                <option key={item.id} value={String(item.id)}>{item.title}</option>
              ))}
            </select>
          </div>
          <button type="button" className="reference-back-button" onClick={() => navigate(backTarget.path)}>
            <Icon name="back" /> {backTarget.label}
          </button>
        </div>
      </header>

      {candidateError && <p className="candidate-feedback candidate-feedback-error" role="alert">{candidateError}</p>}

      {activeTab === 'positions' && (
        <div className="reference-tab-panel">
          {renderPartyManagement()}

          <section className="reference-section-card position-management-panel">
            <div className="reference-panel-heading">
              <Icon name="review" size={27} />
              <div>
                <h2>{editingPosition ? 'Edit Position' : 'Position Management'}</h2>
                <p>{editingPosition ? 'Update this position for the election.' : 'Add a position and set how many choices voters may make.'}</p>
              </div>
              {editingPosition && <span className="candidate-editing-label">Editing position</span>}
            </div>

            <div className="position-management-list-heading">
              <h3>Available Positions</h3>
            </div>
            <div className="election-category-list position-management-list">
              {positions.length > 0 ? positions.map((position) => (
                <div className="election-category-item position-management-item" key={position.id}>
                  <div className="position-management-item-details">
                    <strong>{position.name}</strong>
                    <span>Vote for {position.vote_for_count} · {position.category?.name || 'No category assigned'}</span>
                  </div>
                  <div className="management-item-actions">
                    <button
                      type="button"
                      className="icon-action-button"
                      onClick={() => startEditPosition(position)}
                      title={`Edit ${position.name}`}
                      aria-label={`Edit ${position.name}`}
                    >
                      <Icon name="edit" />
                    </button>
                    <button
                      type="button"
                      className="icon-action-button party-delete-action"
                      onClick={() => handleDeletePosition(position)}
                      title={`Delete ${position.name}`}
                      aria-label={`Delete ${position.name}`}
                    >
                      <Icon name="delete" />
                    </button>
                  </div>
                </div>
              )) : (
                <p className="candidate-empty-state">No positions registered.</p>
              )}
            </div>

            {!isPositionFormOpen ? (
              <div className="position-form-toggle-row">
                <button
                  type="button"
                  className="reference-primary-button"
                  onClick={() => {
                    setEditingPosition(null);
                    setPositionName('');
                    setPositionVoteForCount('1');
                    setPositionCategoryId('');
                    setPositionError('');
                    setIsPositionFormOpen(true);
                  }}
                >
                  <Icon name="add" />
                  Add Position
                </button>
              </div>
            ) : (
              <form onSubmit={handleSavePosition} className="position-management-form">
                <label>
                  <span className="candidate-label-line">Position Name <b>*</b></span>
                  <input
                    value={positionName}
                    onChange={(event) => {
                      const name = event.target.value;
                      setPositionName(name);
                      const inferredCategoryId = getDefaultPositionCategoryId(name, categories);
                      if (inferredCategoryId) setPositionCategoryId(inferredCategoryId);
                    }}
                    placeholder="Enter position name"
                    maxLength={100}
                    required
                    autoFocus
                  />
                </label>
                <label>
                  <span className="candidate-label-line">Vote For <b>*</b></span>
                  <select
                    value={positionVoteForCount}
                    onChange={(event) => setPositionVoteForCount(event.target.value)}
                    required
                  >
                    {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => (
                      <option key={count} value={count}>{count}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="candidate-label-line">Category</span>
                  <select value={positionCategoryId} onChange={(event) => setPositionCategoryId(event.target.value)} required>
                    <option value="" disabled>Select a category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <div className="position-management-actions">
                  <button type="submit" className="reference-primary-button" disabled={isSavingPosition}>
                    <Icon name="add" />
                    {isSavingPosition ? 'Saving…' : editingPosition ? 'Save Position' : 'Add Position'}
                  </button>
                  <button
                    type="button"
                    className="reference-secondary-button"
                    onClick={() => {
                      resetPositionForm();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {positionError && <p className="candidate-feedback candidate-feedback-error" role="alert">{positionError}</p>}
          </section>

          <section className="reference-section-card election-position-categories">
            <div className="reference-panel-heading">
              <Icon name="parties" size={27} />
              <div>
                <h2>Position Categories</h2>
                <p>Create and rename categories used to organize positions.</p>
              </div>
              <strong className="candidate-count">{categories.length} categories</strong>
            </div>

            <div className="election-category-list">
              {categories.length > 0 ? categories.map((category) => (
                <div className="election-category-item" key={category.id}>
                  {editingCategory?.id === category.id ? (
                    <form onSubmit={handleSaveCategory} className="election-category-edit">
                      <input
                        type="text"
                        value={editingCategoryName}
                        onChange={(event) => setEditingCategoryName(event.target.value)}
                        maxLength={100}
                        required
                        autoFocus
                        aria-label={`Edit ${category.name} category name`}
                      />
                      <button type="submit" className="candidate-edit-button" disabled={!editingCategoryName.trim() || isSavingCategory}>Save</button>
                      <button type="button" className="reference-secondary-button" onClick={() => { setEditingCategory(null); setEditingCategoryName(''); }}>Cancel</button>
                    </form>
                  ) : (
                    <>
                      <span>{category.name}</span>
                      <div className="management-item-actions">
                        <button
                          type="button"
                          className="icon-action-button"
                          onClick={() => startEditCategory(category)}
                          title={`Edit ${category.name}`}
                          aria-label={`Edit ${category.name}`}
                        >
                          <Icon name="edit" />
                        </button>
                        <button
                          type="button"
                          className="icon-action-button party-delete-action"
                          onClick={() => handleDeleteCategory(category)}
                          title={`Delete ${category.name}`}
                          aria-label={`Delete ${category.name}`}
                        >
                          <Icon name="delete" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )) : (
                <p className="candidate-empty-state">No position categories yet.</p>
              )}
            </div>

            {!isCategoryFormOpen ? (
              <div className="category-form-toggle-row">
                <button
                  type="button"
                  className="reference-primary-button"
                  onClick={() => {
                    setNewCategoryName('');
                    setIsCategoryFormOpen(true);
                  }}
                >
                  <Icon name="add" />
                  Add Category
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateCategory} className="election-category-create">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="New category name"
                  maxLength={100}
                  required
                  autoFocus
                />
                <button type="submit" className="reference-primary-button" disabled={!newCategoryName.trim() || isSavingCategory}>
                  <Icon name="add" />
                  {isSavingCategory ? 'Adding…' : 'Add Category'}
                </button>
                <button
                  type="button"
                  className="reference-secondary-button"
                  onClick={() => {
                    setNewCategoryName('');
                    setIsCategoryFormOpen(false);
                  }}
                >
                  Cancel
                </button>
              </form>
            )}

            {categoryError && <p className="candidate-feedback candidate-feedback-error" role="alert">{categoryError}</p>}
          </section>

        </div>
      )}

      {activeTab === 'candidates' && (
        <div className="reference-tab-panel">
          {renderCandidateRegistration()}
          {renderCandidateDirectory()}
        </div>
      )}

      {activeTab === 'review' && (
        <section className="review-election-panel">
          <div className="reference-panel-heading">
            <Icon name="review" size={27} />
            <div>
              <h2>Review Election</h2>
              <p>Check the election setup before moving on.</p>
            </div>
          </div>

          <div className="review-election-summary">
            <div><span>Election</span><strong>{election?.title || '—'}</strong></div>
            <div><span>Status</span><strong>{election?.status || '—'}</strong></div>
            <div><span>POSITION</span><strong>{positions.length}</strong></div>
            <div><span>CANDIDATE</span><strong>{candidates.length}</strong></div>
            <div><span>PARTIES</span><strong>{parties.length}</strong></div>
          </div>

          <div className="review-content-grid">
            <div className="review-section-card">
              <h3>Position Review</h3>
              <div className="review-position-list">
                {positions.map((position) => {
                  const positionCandidates = candidates.filter((candidate) => candidate.position_id === position.id);
                  const isExpanded = Boolean(expandedPositions[position.id]);

                  return (
                    <div className="review-position-block" key={position.id}>
                      <button
                        type="button"
                        className="review-position-toggle"
                        onClick={() => togglePosition(position.id)}
                        aria-expanded={isExpanded}
                        aria-controls={`review-position-candidates-${position.id}`}
                      >
                        <span>
                          <strong>{position.name}</strong>
                          <small>Vote for {position.vote_for_count || 0}</small>
                        </span>
                        <span className="review-position-meta">{positionCandidates.length} candidates</span>
                        <span className="review-position-caret" aria-hidden="true"><Icon name={isExpanded ? 'chevronDown' : 'chevronRight'} size={14} /></span>
                      </button>

                      {isExpanded && (
                        <div className="review-position-details" id={`review-position-candidates-${position.id}`}>
                          {positionCandidates.length === 0 ? (
                            <p className="review-empty-state">No candidates registered for this position.</p>
                          ) : (
                            <ul className="review-candidate-list">
                              {positionCandidates.map((candidate) => (
                                <li key={candidate.id}>
                                  <span>{candidate.name}</span>
                                  <small>{candidate.party || 'Missing party'}</small>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {positions.length === 0 && <p className="candidate-empty-state">No positions have been added to this election.</p>}
              </div>
            </div>

            <div className="review-section-card">
              <h3>Setup Checklist</h3>
              {reviewCheckItems.length === 0 ? (
                <p className="review-checklist-ok">Everything looks ready for activation.</p>
              ) : (
                <ul className="review-checklist">
                  {reviewCheckItems.map((group) => (
                    <li key={group.label}>
                      <strong>{group.label}</strong>
                      <ul>
                        {group.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="review-election-actions">
            <button type="button" className="reference-secondary-button" onClick={() => setActiveTab('positions')}>
              Back to Edit
            </button>
            <button type="button" className="reference-secondary-button" onClick={handleSaveDraft}>
              Save as Draft
            </button>
            <button type="button" className="reference-primary-button" onClick={handleActivateElection}>
              Activate Election
            </button>
          </div>
        </section>
      )}
    </div>
  );
}