import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import './SettingsPage.css';

export default function SettingsPage() {

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isConfirmingLogout, setIsConfirmingLogout] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLogoutComplete, setIsLogoutComplete] = useState(false);

  if (!user) {
    return <LoadingSkeleton variant="settings" label="Loading settings" />;
  }

  const roleLabel = user.role ? user.role.replace(/_/g, ' ') : '—';

  const infoRows = [
    ['System Name', 'iVote'],
    ['Organization', 'Student Republic'],
    ['Campus', 'ISAT U Dumangas Campus'],
    ['Developed By', 'Melchor Dato-on'],
    ['Last Updated', 'August 2026'],
  ];

  async function confirmLogout() {
    setIsConfirmingLogout(false);
    setIsConfirmingLogout(false);
    setIsLoggingOut(true);
    setIsLogoutComplete(true);

    await logout(900);
    navigate('/login', { replace: true });
  }

  return (
    <div className="settings-page">
      <header className="settings-page-header">
        <h1>System Settings</h1>
      </header>

      <div className="settings-overview" aria-label="Account and system overview">
        <div className="settings-overview-item">
          <span className="settings-overview-icon"><Icon name="user" size={18} /></span>
          <div>
            <span>Logged In</span>
            <strong>{user.name || '—'}</strong>
          </div>
        </div>
        <div className="settings-overview-item is-accent">
          <span className="settings-overview-icon"><Icon name="settings" size={18} /></span>
          <div>
            <span>Account Role</span>
            <strong>{roleLabel}</strong>
          </div>
        </div>
        <div className="settings-overview-item">
          <span className="settings-overview-icon"><Icon name="clipboard" size={18} /></span>
          <div>
            <span>System Version</span>
            <strong>v1.0</strong>
          </div>
        </div>
      </div>

      <section className="settings-section" aria-labelledby="settings-information-title">
        <header className="settings-section-header">
          <div>
            <h2 id="settings-information-title">System Information</h2>
          </div>
        </header>
        <dl className="settings-information-list">
          {infoRows.map(([label, value]) => (
            <div className="settings-information-row" key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="settings-section settings-account-section" aria-labelledby="settings-account-title">
        <header className="settings-section-header">
          <div>
            <h2 id="settings-account-title">Account</h2>
            <p>Signed in as <strong>{user.name || '—'}</strong> · {roleLabel}</p>
          </div>
        </header>
        <div className="settings-account-actions">
          <button
            className="logout-trigger-btn"
            onClick={() => setIsConfirmingLogout(true)}
          >
            Log Out
          </button>
        </div>
      </section>

      {isLogoutComplete && (
        <div className="logout-success-overlay" role="status" aria-live="polite">
          <div className="logout-success-content">
            <div className="logout-success-mark" aria-hidden="true">
              <svg viewBox="0 0 52 52">
                <circle className="logout-success-circle" cx="26" cy="26" r="23" />
                <path className="logout-success-check" d="m15 27 7 7 15-16" />
              </svg>
            </div>
            <p className="logout-success-kicker">Session closed</p>
            <h2>Signed out securely</h2>
            <p>Returning you to sign in…</p>
          </div>
        </div>
      )}

      {isConfirmingLogout && (
        <div className="logout-modal-backdrop" onClick={() => setIsConfirmingLogout(false)}>
          <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="logout-modal-header">
              <div className="logout-modal-icon">!</div>
              <div className="logout-modal-label">Session</div>
            </div>
            <h3>Secure sign out</h3>
            <p>
              You are about to end your current iVote session. You will need to sign in again before continuing.
            </p>
            <div className="logout-modal-actions">
              <button
                type="button"
                className="logout-cancel-btn"
                onClick={() => setIsConfirmingLogout(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="logout-confirm-btn"
                onClick={confirmLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>

  );

}
