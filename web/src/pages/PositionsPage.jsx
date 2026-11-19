import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import LoadingSkeleton from '../components/LoadingSkeleton';
import './PositionsPage.css';

export default function PositionsPage() {

  const { electionId } = useParams();
  const navigate = useNavigate();

  const [positions, setPositions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newPositionName, setNewPositionName] = useState('');
  const [newVoteForCount, setNewVoteForCount] = useState(1);
  const [newPositionCategoryId, setNewPositionCategoryId] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingPosition, setEditingPosition] = useState(null);
  const [isCreatingPosition, setIsCreatingPosition] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const positionFormRef = useRef(null);
  const positionNameInputRef = useRef(null);

  useEffect(() => {
    loadPositions();
  }, [electionId]);

  async function loadPositions() {

    try {

      const { data } = await apiClient.get(
        `/elections/${electionId}/positions`
      );

      setPositions(data.data);

      const categoryResponse = await apiClient.get(
        `/elections/${electionId}/position-categories`
      );
      const loadedCategories = categoryResponse.data.data.filter(
        (category) => !['Custom Positions', 'Custom Position'].includes(category.name)
      );
      setCategories(loadedCategories);
      setNewPositionCategoryId((currentId) => (
        loadedCategories.some((category) => String(category.id) === currentId)
          ? currentId
          : String(loadedCategories[0]?.id ?? '')
      ));

    } catch (error) {

      console.error(error);
      alert('Failed to load positions');

    } finally {

      setIsLoading(false);

    }

  }

  function resetPositionForm() {
    setNewPositionName('');
    setNewVoteForCount(1);
    setNewPositionCategoryId(String(
      categories.filter(
        (category) => !['Custom Positions', 'Custom Position'].includes(category.name)
      )[0]?.id ?? categories[0]?.id ?? ''
    ));
    setEditingPosition(null);
  }

  async function handleCreatePosition(event) {
    event.preventDefault();

    const name = newPositionName.trim();

    if (!name) {
      alert('Please enter a position name.');
      return;
    }

    if (
      !editingPosition &&
      positions.some((position) => position.name.toLowerCase() === name.toLowerCase())
    ) {
      alert('This position already exists for this election.');
      return;
    }

    try {
      setIsCreatingPosition(true);

      if (editingPosition) {
        await apiClient.put(
          `/elections/${electionId}/positions/${editingPosition.id}`,
          {
            name,
            vote_for_count: Number(newVoteForCount) || 1,
            category_id: Number(newPositionCategoryId),
          }
        );
      } else {
        await apiClient.post(`/elections/${electionId}/positions`, {
          name,
          vote_for_count: Number(newVoteForCount) || 1,
          category_id: Number(newPositionCategoryId),
          display_order: positions.length + 1,
        });
      }

      resetPositionForm();
      await loadPositions();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || `Failed to ${editingPosition ? 'update' : 'create'} position.`);
    } finally {
      setIsCreatingPosition(false);
    }
  }

  function startEditPosition(position) {
    setEditingPosition(position);
    setNewPositionName(position.name);
    setNewVoteForCount(position.vote_for_count || 1);
    setNewPositionCategoryId(String(position.category_id || ''));
    positionFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    positionNameInputRef.current?.focus({ preventScroll: true });
  }

  async function handleDeletePosition(positionId) {
    const position = positions.find((item) => item.id === positionId);

    if (!position) return;

    if (!window.confirm(`Delete position "${position.name}"?`)) {
      return;
    }

    try {
      await apiClient.delete(`/elections/${electionId}/positions/${positionId}`);

      if (editingPosition?.id === positionId) {
        resetPositionForm();
      }

      await loadPositions();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || 'Failed to delete position.');
    }
  }

  async function handleCreateCategory(event) {
    event.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;

    try {
      await apiClient.post(`/elections/${electionId}/position-categories`, { name });
      setNewCategoryName('');
      await loadPositions();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create category.');
    }
  }

  function startEditCategory(category) {
    setEditingCategory(category);
    setEditingCategoryName(category.name);
  }

  async function handleSaveCategory(event) {
    event.preventDefault();
    const name = editingCategoryName.trim();
    if (!name || !editingCategory) return;

    try {
      await apiClient.put(
        `/elections/${electionId}/position-categories/${editingCategory.id}`,
        { name }
      );
      setEditingCategory(null);
      setEditingCategoryName('');
      await loadPositions();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update category.');
    }
  }

  async function handleDeleteCategory(category) {
    if (!window.confirm(`Delete category "${category.name}"?`)) return;

    try {
      await apiClient.delete(
        `/elections/${electionId}/position-categories/${category.id}`
      );
      if (editingCategory?.id === category.id) {
        setEditingCategory(null);
        setEditingCategoryName('');
      }
      await loadPositions();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete category.');
    }
  }

  const positionGroups = categories.map((category) => ({
    id: category.id,
    label: category.name,
    positions: positions.filter((position) => position.category_id === category.id),
  })).filter((group) => group.positions.length > 0);
  const uncategorizedPositions = positions.filter(
    (position) => !categories.some((category) => category.id === position.category_id)
  );
  if (uncategorizedPositions.length > 0) {
    positionGroups.push({ id: 'uncategorized', label: 'Uncategorized', positions: uncategorizedPositions });
  }

  if (isLoading && positions.length === 0) {
    return <LoadingSkeleton variant="positions" label="Loading positions" />;
  }

    return (

    <div className="page-container position-page">

      <button
        className="back-button"
        onClick={() => navigate('/elections')}
      >
        ← Back to Elections
      </button>

      <div className="position-page-heading">
        <div>
          <p className="position-eyebrow">Election setup</p>
          <h1>Position Management</h1>
        </div>
        <span className="position-election-count">{positions.length} positions</span>
      </div>

      {/* SUMMARY */}

      <div
        className="position-summary"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: "20px",
          marginBottom: "30px",
        }}
      >

        <div
          className="position-summary-card"
          style={{
            background: "#fff",
            padding: "22px",
            borderRadius: "12px",
            borderLeft: "5px solid var(--primary-2)",
            boxShadow: "0 3px 10px rgba(0,0,0,.08)",
          }}
        >
          <h3>Total Positions</h3>

          <h1 className="position-summary-number" style={{ color: "var(--primary-2)" }}>
            {positions.length}
          </h1>

        </div>

      </div>

      <div
        ref={positionFormRef}
        style={{
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 3px 10px rgba(0,0,0,.08)',
          padding: '20px 22px',
          marginBottom: '24px',
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: '20px' }}>
            {editingPosition ? 'Edit Position' : 'Create Position'}
          </h2>
        </div>

        <form
          onSubmit={handleCreatePosition}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <label style={{ display: 'grid', gap: '6px', minWidth: '260px', flex: 1 }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Position Name</span>
            <input
              ref={positionNameInputRef}
              type="text"
              value={newPositionName}
              onChange={(event) => setNewPositionName(event.target.value)}
              placeholder="Enter position name"
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
              }}
              required
            />
          </label>

          <label style={{ display: 'grid', gap: '6px', minWidth: '150px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Vote For</span>
            <input
              type="number"
              min="1"
              max="20"
              value={newVoteForCount}
              onChange={(event) => setNewVoteForCount(event.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: '6px', minWidth: '190px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Category</span>
            <select
              value={newPositionCategoryId}
              onChange={(event) => setNewPositionCategoryId(event.target.value)}
              required
              disabled={categories.length === 0}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
              }}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={isCreatingPosition}
          >
            {isCreatingPosition ? (editingPosition ? 'Saving...' : 'Creating...') : (editingPosition ? 'Save Changes' : 'Create Position')}
          </button>

          {editingPosition && (
            <button
              type="button"
              onClick={resetPositionForm}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#334155',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
        </form>
      </div>

      <section className="position-category-manager" aria-labelledby="position-category-heading">
        <div className="position-category-manager-heading">
          <div>
            <h2 id="position-category-heading">Position Categories</h2>
            <p>Create and rename categories used to organize positions.</p>
          </div>
          <form onSubmit={handleCreateCategory} className="position-category-create">
            <input
              type="text"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="New category name"
              maxLength={100}
              required
            />
            <button type="submit" disabled={!newCategoryName.trim()}>Add Category</button>
          </form>
        </div>
        <div className="position-category-list">
          {categories.map((category) => (
            <div className="position-category-item" key={category.id}>
              {editingCategory?.id === category.id ? (
                <form onSubmit={handleSaveCategory} className="position-category-edit">
                  <input
                    type="text"
                    value={editingCategoryName}
                    onChange={(event) => setEditingCategoryName(event.target.value)}
                    maxLength={100}
                    required
                    autoFocus
                  />
                  <button type="submit" disabled={!editingCategoryName.trim()}>Save</button>
                  <button type="button" className="position-category-cancel" onClick={() => setEditingCategory(null)}>Cancel</button>
                </form>
              ) : (
                <>
                  <span>{category.name}</span>
                  <div className="position-category-actions">
                    <button type="button" onClick={() => startEditCategory(category)}>Edit</button>
                    <button
                      type="button"
                      className="danger-button soft-danger-button"
                      onClick={() => handleDeleteCategory(category)}
                      aria-label={`Delete ${category.name} category`}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="position-directory-note">
        <strong>Standard election positions</strong>
        <span>These positions are prepared automatically. Select “Manage Candidates” to add the names of students running for each position.</span>
      </div>

      {/* POSITION TABLE */}

      <section
        className="position-list-card"
        style={{
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 3px 10px rgba(0,0,0,.08)",
          overflow: "hidden",
        }}
      >

        <div className="table-shell">

        <table className="data-table position-table">

          <thead>

            <tr>

              <th>Position</th>
              <th>Vote For</th>
              <th>Candidates</th>
              <th>Actions</th>

            </tr>

          </thead>

          <tbody>

            {positionGroups.length > 0 ? (

              positionGroups.flatMap((group) => [
                <tr className="position-group-row" key={`${group.id}-heading`}>
                  <td colSpan="4">{group.label}<span>{group.positions.length} {group.positions.length === 1 ? 'position' : 'positions'}</span></td>
                </tr>,
                ...group.positions.map((p) => (

                <tr key={p.id}>

                  <td>{p.name}</td>

                  <td>{p.vote_for_count}</td>

                  <td>{p.candidates?.length || 0}</td>

                  <td>

                    <div className="section-actions">

                    <Link
                      to={`/elections/${electionId}/candidates?position=${p.id}`}
                    >
                      Manage Candidates →
                    </Link>

                    <button
                      type="button"
                      onClick={() => startEditPosition(p)}
                      className="secondary-button"
                      style={{
                        marginLeft: '8px',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        border: '1px solid #c7cfd8',
                        background: '#f8fafc',
                        color: '#1c2430',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeletePosition(p.id)}
                      className="danger-button"
                    >
                      Delete
                    </button>

                    </div>

                  </td>

                </tr>

                ))
              ])

            ) : (

              <tr>

                <td
                  colSpan="4"
                  style={{
                    textAlign: "center",
                    padding: "30px",
                    color: "#777",
                  }}
                >
                  No positions created yet.
                </td>

              </tr>

            )}

          </tbody>

        </table>

        </div>

      </section>

    </div>

  );

}
