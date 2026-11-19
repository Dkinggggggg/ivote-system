import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isConfirmingLogout, setIsConfirmingLogout] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLogoutComplete, setIsLogoutComplete] = useState(false);

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

    <div>

      <h1 style={{ marginBottom: "25px" }}>
        System Settings
      </h1>

      {/* Summary Cards */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "20px",
          marginBottom: "35px",
        }}
      >

        <div
          style={{
            background: "#fff",
            padding: "22px",
            borderRadius: "12px",
            borderLeft: "5px solid var(--primary-2)",
            boxShadow: "0 3px 10px rgba(0,0,0,.08)",
          }}
        >
          <h3>Logged In</h3>

          <h2 style={{ color: "var(--primary-2)" }}>
            {user?.name}
          </h2>

        </div>

        <div
          style={{
            background: "#fff",
            padding: "22px",
            borderRadius: "12px",
            borderLeft: "5px solid var(--accent)",
            boxShadow: "0 3px 10px rgba(0,0,0,.08)",
          }}
        >
          <h3>Account Role</h3>

          <h2 style={{ color: "var(--accent)" }}>
            {user?.role.replace('_', ' ')}
          </h2>

        </div>

        <div
          style={{
            background: "#fff",
            padding: "22px",
            borderRadius: "12px",
            borderLeft: "5px solid var(--primary-2)",
            boxShadow: "0 3px 10px rgba(0,0,0,.08)",
          }}
        >
          <h3>System Version</h3>

          <h2 style={{ color: "var(--primary-2)" }}>
            v1.0
          </h2>

        </div>

      </div>

      {/* System Information */}

      <div
        style={{
          background: "#fff",
          padding: "25px",
          borderRadius: "12px",
          boxShadow: "0 3px 10px rgba(0,0,0,.08)",
          marginBottom: "25px",
        }}
      >

        <h2 style={{ marginBottom: "20px" }}>
          System Information
        </h2>

        <div className="table-shell">

        <table style={{ width: "100%" }}>

          <tbody>

            {infoRows.map(([label, value]) => (

              <tr key={label}>

                <td style={{ padding: "10px", fontWeight: "600" }}>
                  {label}
                </td>

                <td>{value}</td>

              </tr>

            ))}

          </tbody>

        </table>

        </div>

      </div>

      {/* Account */}

      <div
        style={{
          background: "#fff",
          padding: "25px",
          borderRadius: "12px",
          boxShadow: "0 3px 10px rgba(0,0,0,.08)",
        }}
      >

        <h2 style={{ marginBottom: "20px" }}>
          Account
        </h2>

        <p>
          You are currently signed in as
          <strong> {user?.name}</strong>.
        </p>

        <p style={{ marginBottom: "20px" }}>
          Role:
          <strong> {user?.role.replace('_', ' ')}</strong>
        </p>

        <button
          className="logout-trigger-btn"
          onClick={() => setIsConfirmingLogout(true)}
        >
          Log Out
        </button>

      </div>

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
