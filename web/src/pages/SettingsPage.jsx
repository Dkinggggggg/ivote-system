import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {

  const { user, logout } = useAuth();
  const [isConfirmingLogout, setIsConfirmingLogout] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const infoRows = [
    ['System Name', 'iVote'],
    ['Organization', 'Student Republic'],
    ['Campus', 'ISAT U Dumangas Campus'],
    ['Developed By', 'Melchor Dato-on'],
    ['Last Updated', 'August 2026'],
  ];

  async function confirmLogout() {
    setIsLoggingOut(true);

    try {
      await logout();
      window.dispatchEvent(
        new CustomEvent('ivote-toast', {
          detail: { message: 'Logged out successfully.', type: 'success' },
        })
      );
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent('ivote-toast', {
          detail: { message: 'Logout failed. Please try again.', type: 'error' },
        })
      );
    } finally {
      setIsLoggingOut(false);
      setIsConfirmingLogout(false);
    }
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
