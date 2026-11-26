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
  const [isCredentialPasswordVisible, setIsCredentialPasswordVisible] = useState(false);
  const [isCreatePasswordVisible, setIsCreatePasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [resettingUser, setResettingUser] = useState(null);
  const [resetPasswordForm, setResetPasswordForm] = useState({ password: '', password_confirmation: '' });
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isResetPasswordVisible, setIsResetPasswordVisible] = useState(false);
  const [isConfirmResetPasswordVisible, setIsConfirmResetPasswordVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

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
    setCurrentPage(1);
  }, [users.length, searchQuery, roleFilter, statusFilter]);

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

    window.setTimeout(() => {
      setCopiedCredential('');
    }, 2000);
  }

  async function copyBothCredentials() {
    await copyCredential(
      `Username: ${createdCredentials.username}\nPassword: ${createdCredentials.password}`,
      'Credentials'
    );
  }

  function closeCreatedCredentials() {
    setCreatedCredentials(null);
    setCopiedCredential('');
    setCredentialCopyMessage('');
    setIsCredentialPasswordVisible(false);
  }

  async function handleCreate(e) {

    e.preventDefault();

    setCreateError('');

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
      setIsCredentialPasswordVisible(false);
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

  function startPasswordReset(user) {
    setResettingUser(user);
    setResetPasswordForm({ password: '', password_confirmation: '' });
    setResetPasswordError('');
    setIsResetPasswordVisible(false);
    setIsConfirmResetPasswordVisible(false);
  }

  async function handlePasswordReset(e) {
    e.preventDefault();
    setResetPasswordError('');

    if (resetPasswordForm.password !== resetPasswordForm.password_confirmation) {
      setResetPasswordError('Passwords do not match.');
      return;
    }

    setIsResettingPassword(true);
    try {
      await apiClient.post(`/users/${resettingUser.id}/reset-password`, resetPasswordForm);
      setResettingUser(null);
      setResetPasswordForm({ password: '', password_confirmation: '' });
      setIsResetPasswordVisible(false);
      setIsConfirmResetPasswordVisible(false);
      await loadUsers();
    } catch (err) {
      setResetPasswordError(
        err.response?.data?.message
        || Object.values(err.response?.data?.errors || {}).flat()[0]
        || 'Unable to reset password.'
      );
    } finally {
      setIsResettingPassword(false);
    }
  }

  const totalUsers = users.length;
  const admins = users.filter(
    (u) => u.role === 'admin'
  ).length;

  const committee = users.filter(
    (u) => u.role === 'committee_officer'
  ).length;

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || [
      user.name,
      user.username,
      user.email,
    ].some((value) => String(value || '').toLowerCase().includes(query));
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'active' ? user.is_active : !user.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const arrangedUsers = [...filteredUsers].sort((first, second) => {
    const roleOrder = { admin: 0, committee_officer: 1 };
    const roleDifference = (roleOrder[first.role] ?? 2) - (roleOrder[second.role] ?? 2);

    if (roleDifference !== 0) return roleDifference;

    return String(first.name || '').localeCompare(String(second.name || ''), undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  });

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(arrangedUsers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const visibleUsers = arrangedUsers.slice(startIndex, startIndex + pageSize);
  const startItem = arrangedUsers.length === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(startIndex + pageSize, arrangedUsers.length);

  if (isLoading && users.length === 0) {
    return <LoadingSkeleton variant="users" label="Loading users" />;
  }

  return (

    <div className="users-page">

      <header className="users-page-header">
        <div>
          <h1>User Management</h1>
        </div>
        <button
          type="button"
          className="users-create-button users-page-add-button"
          onClick={() => setIsCreateFormOpen(true)}
          aria-expanded={isCreateFormOpen}
        >
          <Icon name="add" size={17} /> Add User
        </button>
      </header>

      <div className="users-summary-grid">
        <div className="users-summary-card">
          <span className="users-summary-icon"><Icon name="users" size={20} /></span>
          <div>
            <p>Total Users</p>
            <strong>{totalUsers}</strong>
          </div>
        </div>

        <div className="users-summary-card">
          <span className="users-summary-icon is-accent"><Icon name="settings" size={20} /></span>
          <div>
            <p>Administrators</p>
            <strong>{admins}</strong>
          </div>
        </div>

        <div className="users-summary-card">
          <span className="users-summary-icon"><Icon name="scan" size={20} /></span>
          <div>
            <p>Electoral Committee</p>
            <strong>{committee}</strong>
          </div>
        </div>
      </div>

      <div className="users-toolbar">
        <label className="users-search-field">
          <Icon name="search" size={17} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search name, username, or email"
            aria-label="Search users"
          />
        </label>
        <label className="users-filter-field">
          <span>Role</span>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">All roles</option>
            <option value="admin">Administrators</option>
            <option value="committee_officer">Committee</option>
          </select>
        </label>
        <label className="users-filter-field">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>

      <div className="table-shell users-table-shell">

      <table className="data-table users-table">

        <thead>

          <tr>

            <th>User</th>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th style={{ width: "250px" }}>
              Actions
            </th>

          </tr>

        </thead>

        <tbody>

          {visibleUsers.length === 0 ? (
            <tr>
              <td colSpan="6" className="users-empty-state">
                <Icon name="users" size={22} />
                <strong>No users found</strong>
                <span>Try changing your search or filters.</span>
              </td>
            </tr>
          ) : visibleUsers.map((u) => (

            <tr key={u.id}>

              <td>
                <strong>{u.name}</strong>
              </td>

              <td>{u.username}</td>

              <td>{u.email || u.username}</td>

              <td className="users-role-cell">
                <span className={`users-role-label ${u.role === 'admin' ? 'is-admin' : 'is-committee'}`}>
                  {u.role === 'admin' ? 'Administrator' : 'Student Electoral Committee'}
                </span>
              </td>

              <td>
                <span className={`users-status ${u.is_active ? 'is-active' : 'is-inactive'}`}>
                  <span className="users-status-dot" aria-hidden="true" />
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>

              <td>

                <div className="users-row-actions">
                  <button
                    className="users-row-icon-button"
                    onClick={() => startPasswordReset(u)}
                    type="button"
                    title="Reset password"
                    aria-label={`Reset password for ${u.name}`}
                  >
                    <Icon name="lock" size={15} />
                  </button>

                  <button
                    className="users-row-icon-button"
                    onClick={() => handleStatusToggle(u)}
                    type="button"
                    title={u.is_active ? 'Deactivate account' : 'Reactivate account'}
                    aria-label={`${u.is_active ? 'Deactivate' : 'Reactivate'} ${u.name}`}
                  >
                    <Icon name={u.is_active ? 'close' : 'check'} size={15} />
                  </button>

                  <button
                    className="users-row-icon-button is-danger"
                    onClick={() => handleDelete(u)}
                    type="button"
                    title="Delete account"
                    aria-label={`Delete ${u.name}`}
                  >
                    <Icon name="delete" size={15} />
                  </button>
                </div>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

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
                onChange={(event) => {
                  setForm({
                    ...form,
                    role: event.target.value,
                    ...(event.target.value === 'admin' ? { program: '', year_level: '' } : {}),
                  });
                }}
              >
                <option value="committee_officer">Student Electoral Committee</option>
                <option value="admin">Administrator</option>
              </select>
            </label>

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
            <div className="users-credentials-success-mark" aria-hidden="true">
              <Icon name="check" size={22} />
            </div>
            <header className="users-credentials-header">
              <p>Account ready</p>
              <h2 id="created-user-title">{createdCredentials.name}</h2>
            </header>
            <p className="users-credentials-notice">
              Send these credentials privately. Only this screen shows the password.
            </p>

            <div className="users-credentials-list">
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
                  <input
                    type={isCredentialPasswordVisible ? 'text' : 'password'}
                    value={createdCredentials.password}
                    readOnly
                  />
                  <button
                    type="button"
                    className="users-credentials-copy-button"
                    onClick={() => setIsCredentialPasswordVisible((visible) => !visible)}
                    aria-label={isCredentialPasswordVisible ? 'Hide password' : 'Show password'}
                    title={isCredentialPasswordVisible ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={isCredentialPasswordVisible ? 'eyeOff' : 'eye'} size={18} />
                  </button>
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
            </div>

            {credentialCopyMessage && <p className="users-credentials-status" role="status">{credentialCopyMessage}</p>}

            <div className="users-create-modal-actions users-credentials-actions">
              <button type="button" className="users-credentials-copy-all" onClick={copyBothCredentials}>
                <Icon name={copiedCredential === 'Credentials' ? 'check' : 'copy'} size={17} />
                {copiedCredential === 'Credentials' ? 'Copied' : 'Copy both'}
              </button>
              <button type="button" className="users-create-button" onClick={closeCreatedCredentials}>
                Done
              </button>
            </div>
          </section>
        </div>
      )}

      {resettingUser && (
        <div className="users-reset-modal-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isResettingPassword) setResettingUser(null);
        }}>
          <section
            className="users-reset-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-password-title"
          >
            <header className="users-reset-modal-header">
              <div className="users-reset-heading">
                <span className="users-reset-icon"><Icon name="lock" size={21} /></span>
                <div>
                  <h2 id="reset-password-title">Reset password</h2>
                </div>
              </div>
              <button
                type="button"
                className="users-reset-close"
                onClick={() => setResettingUser(null)}
                disabled={isResettingPassword}
                aria-label="Close reset password dialog"
                title="Close"
              >
                <Icon name="close" size={18} />
              </button>
            </header>
            <div className="users-reset-account">
              <span className="users-reset-account-avatar"><Icon name="user" size={18} /></span>
              <div>
                <strong>{resettingUser.name}</strong>
                <span>{resettingUser.role === 'admin' ? 'Administrator' : 'Student Electoral Committee'}</span>
              </div>
            </div>
            <form className="users-reset-form" onSubmit={handlePasswordReset}>
              <label className="users-reset-field">
                <span>New password</span>
                <span className="users-reset-password-wrap">
                  <input
                    type={isResetPasswordVisible ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={16}
                    value={resetPasswordForm.password}
                    onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, password: e.target.value })}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    className="users-reset-password-toggle"
                    onClick={() => setIsResetPasswordVisible((visible) => !visible)}
                    aria-label={isResetPasswordVisible ? 'Hide new password' : 'Show new password'}
                    title={isResetPasswordVisible ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={isResetPasswordVisible ? 'eyeOff' : 'eye'} size={17} />
                  </button>
                </span>
                <small>8–16 characters with uppercase, lowercase, a number, and a symbol.</small>
              </label>
              <label className="users-reset-field">
                <span>Confirm password</span>
                <span className="users-reset-password-wrap">
                  <input
                    type={isConfirmResetPasswordVisible ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={resetPasswordForm.password_confirmation}
                    onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, password_confirmation: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="users-reset-password-toggle"
                    onClick={() => setIsConfirmResetPasswordVisible((visible) => !visible)}
                    aria-label={isConfirmResetPasswordVisible ? 'Hide password confirmation' : 'Show password confirmation'}
                    title={isConfirmResetPasswordVisible ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={isConfirmResetPasswordVisible ? 'eyeOff' : 'eye'} size={17} />
                  </button>
                </span>
              </label>
              {resetPasswordError && (
                <p className="users-reset-error" role="alert">
                  {resetPasswordError}
                </p>
              )}
              <div className="users-reset-actions">
                <button type="button" className="users-reset-cancel" onClick={() => setResettingUser(null)} disabled={isResettingPassword}>
                  Cancel
                </button>
                <button type="submit" className="users-create-button" disabled={isResettingPassword}>
                  {isResettingPassword ? 'Resetting…' : 'Reset Password'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <PaginationControls
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={arrangedUsers.length}
        startItem={startItem}
        endItem={endItem}
        onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
        onNext={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
      />

    </div>

  );

}
