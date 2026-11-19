import React, { useEffect, useState } from 'react';
import apiClient from '../api/apiClient';
import Icon from '../components/Icon';
import PaginationControls from '../components/PaginationControls';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function UsersPage() {

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copiedCredential, setCopiedCredential] = useState('');
  const [credentialCopyMessage, setCredentialCopyMessage] = useState('');
  const [isCreatePasswordVisible, setIsCreatePasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState({ program: '', year_level: '' });
  const yearLevelOptions = ['2nd Year', '3rd Year', '4th Year'];

  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    role: 'committee_officer',
    program: '',
    year_level: '',
    password: '',
    password_confirmation: '',
  });

  const passwordChecks = [
    form.password.length >= 8 && form.password.length <= 16,
    /[A-Z]/.test(form.password),
    /[a-z]/.test(form.password),
    /\d/.test(form.password),
    /[^A-Za-z0-9]/.test(form.password),
  ];
  const isPasswordValid = passwordChecks.every(Boolean);
  const passwordStrength = !form.password
    ? 'Weak'
    : !isPasswordValid
      ? 'Weak'
      : form.password.length >= 12
        ? 'Strong'
        : 'Medium';
  const passwordStrengthParts = !form.password ? 0 : passwordStrength === 'Strong' ? 3 : passwordStrength === 'Medium' ? 2 : 1;
  const passwordsMatch = Boolean(form.password_confirmation) && form.password === form.password_confirmation;

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDepartments() {
      try {
        const { data } = await apiClient.get('/elections');
        const elections = (data.data || []).filter((election) => election.status !== 'closed');
        const positionResponses = await Promise.all(
          elections.map((election) => apiClient.get(`/elections/${election.id}/positions`))
        );
        const departments = positionResponses.flatMap(({ data: positionData }) => (
          (positionData.data || [])
            .filter((position) => (
              position.category_name === 'Governors'
              || position.name.startsWith('Governor - ')
            ))
            .map((position) => (
              position.name.startsWith('Governor - ')
                ? position.name.slice('Governor - '.length).trim()
                : position.name.trim()
            ))
        ));

        if (active) setDepartmentOptions([...new Set(departments)].filter(Boolean).sort());
      } catch {
        if (active) setDepartmentOptions([]);
      }
    }

    loadDepartments();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [users.length]);

  async function loadUsers() {
    try {
      const { data } = await apiClient.get('/users');
      setUsers(data.data);
    } finally {
      setIsLoading(false);
    }
  }

  async function copyCredential(value, credentialName) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedCredential(credentialName);
      setCredentialCopyMessage(`${credentialName} copied.`);
    } catch {
      setCopiedCredential('');
      setCredentialCopyMessage(`Could not copy ${credentialName.toLowerCase()}. Select and copy it manually.`);
    }
  }

  async function handleCreate(e) {

    e.preventDefault();

    setCreateError('');

    if (form.role === 'committee_officer' && form.program && getSelectedYearLevels(form.year_level).length === 0) {
      setCreateError('Please select at least one year level for this committee officer.');
      return;
    }

    if (!isPasswordValid) {
      setCreateError('Password must be 8–16 characters and include uppercase and lowercase letters, a number, and a special character.');
      return;
    }

    if (!passwordsMatch) {
      setCreateError('Passwords do not match.');
      return;
    }

    setIsCreating(true);

    try {
      const { data } = await apiClient.post('/users', form);

      setForm({
        name: '',
        username: '',
        email: '',
        role: 'committee_officer',
        program: '',
        year_level: '',
        password: '',
        password_confirmation: '',
      });
      setIsCreatePasswordVisible(false);
      setIsConfirmPasswordVisible(false);

      setIsCreateFormOpen(false);
      setCreatedCredentials({
        name: data.data.name,
        username: data.data.username,
        password: data.temporary_password,
      });
      setCopiedCredential('');
      setCredentialCopyMessage('');
      await loadUsers();
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Unable to create user. Check the details and try again.');
    } finally {
      setIsCreating(false);
    }

  }

  async function handleStatusToggle(user) {
    const isActive = !user.is_active;

    if (!isActive && !window.confirm(`Are you sure you want to deactivate "${user.name}"?`)) {
      return;
    }

    try {
      await apiClient.patch(`/users/${user.id}/status`, { is_active: isActive });
      await loadUsers();
    } catch (err) {
      alert(
        err.response?.data?.message ||
        `Failed to ${isActive ? 'reactivate' : 'deactivate'} user.`
      );
    }
  }

  async function handleDelete(user) {
    if (!window.confirm(`Are you sure you want to delete "${user.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiClient.delete(`/users/${user.id}`);
      await loadUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user.');
    }
  }

  function getSelectedYearLevels(value) {
    return String(value || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function toggleYearLevelSelection(currentValue, nextYear) {
    const selectedValues = getSelectedYearLevels(currentValue);
    const updatedValues = selectedValues.includes(nextYear)
      ? selectedValues.filter((year) => year !== nextYear)
      : [...selectedValues, nextYear];

    return updatedValues.sort((first, second) => {
      const order = yearLevelOptions.indexOf(first);
      const secondOrder = yearLevelOptions.indexOf(second);
      return order - secondOrder;
    }).join(', ');
  }

  function startEditingAssignment(user) {
    setEditingUser(user);
    setAssignmentForm({
      program: user.program || '',
      year_level: user.year_level || '',
    });
  }

  async function handleSaveAssignment(e) {
    e.preventDefault();

    if (editingUser.role === 'committee_officer' && assignmentForm.program && getSelectedYearLevels(assignmentForm.year_level).length === 0) {
      alert('Please select at least one year level for this committee officer.');
      return;
    }

    try {
      await apiClient.put(`/users/${editingUser.id}`, {
        name: editingUser.name,
        username: editingUser.username,
        email: editingUser.email || editingUser.username,
        role: editingUser.role,
        is_active: editingUser.is_active,
        ...assignmentForm,
      });
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update user assignment.');
    }
  }

  const totalUsers = users.length;
  const admins = users.filter(
    (u) => u.role === 'admin'
  ).length;

  const committee = users.filter(
    (u) => u.role === 'committee_officer'
  ).length;

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const visibleUsers = users.slice(startIndex, startIndex + pageSize);
  const startItem = users.length === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(startIndex + pageSize, users.length);

  if (isLoading && users.length === 0) {
    return <LoadingSkeleton variant="users" label="Loading users" />;
  }

  return (

    <div>

      <h1 style={{ marginBottom: '25px' }}>User Management</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          gap: '20px',
          marginBottom: '35px',
        }}
      >
        <div
          style={{
            background: '#fff',
            padding: '22px',
            borderRadius: '12px',
            borderLeft: '5px solid var(--primary-2)',
            boxShadow: '0 3px 10px rgba(0,0,0,.08)',
          }}
        >
          <h3>Total Users</h3>
          <h1 style={{ color: 'var(--primary-2)' }}>
            {totalUsers}
          </h1>
        </div>

        <div
          style={{
            background: '#fff',
            padding: '22px',
            borderRadius: '12px',
            borderLeft: '5px solid var(--accent)',
            boxShadow: '0 3px 10px rgba(0,0,0,.08)',
          }}
        >
          <h3>Administrators</h3>
          <h1 style={{ color: 'var(--accent)' }}>
            {admins}
          </h1>
        </div>

        <div
          style={{
            background: '#fff',
            padding: '22px',
            borderRadius: '12px',
            borderLeft: '5px solid var(--primary-2)',
            boxShadow: '0 3px 10px rgba(0,0,0,.08)',
          }}
        >
          <h3>Student Electoral Committee</h3>
          <h1 style={{ color: 'var(--primary-2)' }}>
            {committee}
          </h1>
        </div>

      </div>

      <div className="table-shell">

      <table className="data-table">

        <thead>

          <tr>

            <th>User</th>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Precinct</th>
            <th>Status</th>
            <th style={{ width: "250px" }}>
              Actions
            </th>

          </tr>

        </thead>

        <tbody>

          {visibleUsers.map((u) => (

            <tr key={u.id}>

              <td>
                <strong>{u.name}</strong>
              </td>

              <td>{u.username}</td>

              <td>{u.email || u.username}</td>

              <td>

                <span
                  className="badge"
                  style={{
                    background:
                      u.role === "admin"
                        ? "#198754"
                        : "#0d6efd",
                    color: "#fff",
                    padding: "5px 10px",
                    borderRadius: "20px",
                    fontSize: "13px",
                  }}
                >
                  {u.role === "admin"
                    ? "Administrator"
                    : "Student Electoral Committee"}
                </span>

              </td>

              <td><strong>{u.precinct || '—'}</strong></td>

              <td>
                <span
                  className="badge"
                  style={{
                    background: u.is_active ? '#198754' : '#6c757d',
                    color: '#fff',
                    padding: '5px 10px',
                    borderRadius: '20px',
                    fontSize: '13px',
                  }}
                >
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>

              <td>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {u.role === 'committee_officer' && (
                    <button
                      className="users-create-button"
                      onClick={() => startEditingAssignment(u)}
                      type="button"
                    >
                      Assign
                    </button>
                  )}

                  <button
                    className={u.is_active ? 'danger-button soft-danger-button' : 'users-create-button'}
                    onClick={() => handleStatusToggle(u)}
                  >
                    {u.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>

                  <button
                    className="danger-button soft-danger-button"
                    onClick={() => handleDelete(u)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

      </div>

      {editingUser && (
        <form
          onSubmit={handleSaveAssignment}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
            gap: '12px',
            alignItems: 'center',
            background: '#fff',
            padding: '18px',
            borderRadius: '8px',
            boxShadow: '0 3px 10px rgba(0,0,0,.08)',
            marginTop: '16px',
          }}
        >
          <strong style={{ gridColumn: '1 / -1' }}>Assignment for {editingUser.name}</strong>
          <select
            value={assignmentForm.program}
            onChange={(e) => setAssignmentForm({ ...assignmentForm, program: e.target.value })}
            required
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc', width: '100%' }}
          >
            <option value="">Select department</option>
            {assignmentForm.program && !departmentOptions.includes(assignmentForm.program) && (
              <option value={assignmentForm.program}>{assignmentForm.program}</option>
            )}
            {departmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}
          </select>
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {yearLevelOptions.map((year) => {
              const selected = getSelectedYearLevels(assignmentForm.year_level).includes(year);

              return (
                <label
                  key={year}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    border: '1px solid #ccc',
                    borderRadius: '8px',
                    background: selected ? 'rgba(61, 108, 153, 0.1)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => setAssignmentForm({
                      ...assignmentForm,
                      year_level: toggleYearLevelSelection(assignmentForm.year_level, year),
                    })}
                  />
                  <span>{year}</span>
                </label>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="users-create-button">Save Assignment</button>
            <button type="button" className="danger-button soft-danger-button" onClick={() => setEditingUser(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
        <button
          type="button"
          className="users-create-button"
          onClick={() => setIsCreateFormOpen((isOpen) => !isOpen)}
          aria-expanded={isCreateFormOpen}
        >
            <Icon name="add" size={17} /> Add User
        </button>
      </div>

      {isCreateFormOpen && (
        <div className="users-create-modal-overlay" role="presentation" onClick={() => setIsCreateFormOpen(false)}>
          <section
            className="users-create-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-create-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="users-create-modal-header">
                <h2 id="users-create-modal-title"><Icon name="add" size={21} /> Add New User</h2>
              <button
                type="button"
                className="users-create-modal-close"
                onClick={() => setIsCreateFormOpen(false)}
                aria-label="Close add user form"
              >
                  <Icon name="close" size={18} />
              </button>
            </header>

          <form className="users-create-modal-form" onSubmit={handleCreate}>
            <h3 className="users-create-form-section-title">Account details</h3>

            <label className="users-create-form-field">
              <span>Full name</span>
              <input
                autoFocus
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>

            <label className="users-create-form-field">
              <span>Username</span>
              <input
                autoComplete="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
            </label>

            <label className="users-create-form-field users-create-form-wide">
              <span>Email address</span>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>

            <h3 className="users-create-form-section-title users-create-form-wide">Password</h3>

            <label className="users-create-form-field users-create-form-wide">
              <span>Password</span>
              <span className="users-create-password-input-wrap">
                <input
                  type={isCreatePasswordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  minLength={8}
                  maxLength={16}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="users-create-password-toggle"
                  onClick={() => setIsCreatePasswordVisible((visible) => !visible)}
                  aria-label={isCreatePasswordVisible ? 'Hide password' : 'Show password'}
                  title={isCreatePasswordVisible ? 'Hide password' : 'Show password'}
                >
                  <Icon name={isCreatePasswordVisible ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </span>
              <span className="users-password-strength" aria-live="polite">
                <span className="users-password-strength-label">Strength: {passwordStrength}</span>
                <span className="users-password-strength-bar" aria-label={`Password strength: ${passwordStrength}`}>
                  {[0, 1, 2].map((part) => (
                    <span
                      key={part}
                      className={`users-password-strength-part${part < passwordStrengthParts ? ` is-${passwordStrength.toLowerCase()}` : ''}`}
                    />
                  ))}
                </span>
              </span>
              <small className="users-create-form-hint">
                Use 8–16 characters with uppercase and lowercase letters, a number, and a special character.
              </small>
            </label>

            <label className="users-create-form-field users-create-form-wide">
              <span>Confirm password</span>
              <span className="users-create-password-input-wrap">
                <input
                  type={isConfirmPasswordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password_confirmation}
                  onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="users-create-password-toggle"
                  onClick={() => setIsConfirmPasswordVisible((visible) => !visible)}
                  aria-label={isConfirmPasswordVisible ? 'Hide confirm password' : 'Show confirm password'}
                  title={isConfirmPasswordVisible ? 'Hide confirm password' : 'Show confirm password'}
                >
                  <Icon name={isConfirmPasswordVisible ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </span>
              {form.password_confirmation && (
                <small className={`users-password-match${passwordsMatch ? ' is-match' : ' is-mismatch'}`} role="status">
                  {passwordsMatch ? 'Passwords match.' : 'Passwords do not match.'}
                </small>
              )}
            </label>

            <label className="users-create-form-field users-create-form-wide">
              <span>Account role</span>
              <select
                value={form.role}
                onChange={(e) => setForm({
                  ...form,
                  role: e.target.value,
                  ...(e.target.value === 'admin' ? { program: '', year_level: '' } : {}),
                })}
              >
                <option value="committee_officer">Student Electoral Committee</option>
                <option value="admin">Administrator</option>
              </select>
            </label>

            {form.role === 'committee_officer' && (
              <>
                <h3 className="users-create-form-section-title users-create-form-assignment-title">Precinct assignment</h3>
                <label className="users-create-form-field">
                  <span>Department</span>
                  <select
                    value={form.program}
                    onChange={(e) => setForm({ ...form, program: e.target.value })}
                    required
                    disabled={departmentOptions.length === 0}
                  >
                    <option value="">Select department</option>
                    {departmentOptions.map((department) => (
                      <option key={department} value={department}>{department}</option>
                    ))}
                  </select>
                  {departmentOptions.length === 0 && (
                    <small className="users-create-form-hint">No departments are available for assignment.</small>
                  )}
                </label>

                <label className="users-create-form-field users-create-form-wide">
                  <span>Year levels</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
                    {yearLevelOptions.map((year) => {
                      const selected = getSelectedYearLevels(form.year_level).includes(year);

                      return (
                        <label
                          key={year}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 10px',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            background: selected ? 'rgba(61, 108, 153, 0.1)' : 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => setForm({
                              ...form,
                              year_level: toggleYearLevelSelection(form.year_level, year),
                            })}
                          />
                          <span>{year}</span>
                        </label>
                      );
                    })}
                  </div>
                </label>

                {form.program && form.year_level && (
                  <p className="users-create-precinct-preview users-create-form-wide">
                    Precinct: <strong>{form.program} - {form.year_level}</strong>
                  </p>
                )}
              </>
            )}

            {createError && <p className="users-create-form-error users-create-form-wide" role="alert">{createError}</p>}

            <div className="users-create-modal-actions users-create-form-wide">
              <button
                type="button"
                className="users-create-cancel-button"
                onClick={() => setIsCreateFormOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button type="submit" className="users-create-button" disabled={isCreating}>
                  {isCreating ? 'Creating…' : <><Icon name="add" size={17} /> Create User</>}
              </button>
            </div>
          </form>

          </section>
        </div>
      )}

      {createdCredentials && (
        <div className="users-create-modal-overlay" role="presentation">
          <section
            className="users-create-modal-dialog users-credentials-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="created-user-title"
          >
            <header className="users-create-modal-header">
              <h2 id="created-user-title">User created</h2>
            </header>
            <p className="users-credentials-notice">
              Copy the username and temporary password to share privately. These credentials are shown only once.
            </p>
            <label className="users-create-form-field">
              <span>Username</span>
              <span className="users-credentials-copy-field">
                <input value={createdCredentials.username} readOnly />
                <button
                  type="button"
                  className="users-credentials-copy-button"
                  onClick={() => copyCredential(createdCredentials.username, 'Username')}
                  aria-label="Copy username"
                  title="Copy username"
                >
                  <Icon name={copiedCredential === 'Username' ? 'check' : 'copy'} size={18} />
                </button>
              </span>
            </label>
            <label className="users-create-form-field">
              <span>Temporary password</span>
              <span className="users-credentials-copy-field">
                <input value={createdCredentials.password} readOnly />
                <button
                  type="button"
                  className="users-credentials-copy-button"
                  onClick={() => copyCredential(createdCredentials.password, 'Password')}
                  aria-label="Copy password"
                  title="Copy password"
                >
                  <Icon name={copiedCredential === 'Password' ? 'check' : 'copy'} size={18} />
                </button>
              </span>
            </label>
            {credentialCopyMessage && <p className="users-create-form-hint" role="status">{credentialCopyMessage}</p>}
            <p className="users-create-form-hint">
              {createdCredentials.name} will be asked to create a permanent password when signing in.
            </p>
            <div className="users-create-modal-actions">
              <button
                type="button"
                className="users-create-button"
                onClick={() => setCreatedCredentials(null)}
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}

      <PaginationControls
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={users.length}
        startItem={startItem}
        endItem={endItem}
        onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
        onNext={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
      />

    </div>

  );

}
