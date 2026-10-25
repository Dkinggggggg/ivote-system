import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

function UserIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-3.4 3.1-5.2 7-5.2s6.3 1.8 7 5.2" /></svg>;
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></svg>;
}

function EyeIcon({ hidden }) {
  return hidden
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.2 9.5 7-.4 1.1-1.2 2.4-2.4 3.6M6.2 6.2C3.9 7.7 2.8 9.8 2.5 12c.6 1.8 2 3.7 4.3 5.1A9.7 9.7 0 0 0 12 19c1 0 1.9-.1 2.7-.4" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.2-7 9.5-7 9.5 7 9.5 7-3.2 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="3" /></svg>;
}

export default function CenteredLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('administrator');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!isSuccess) return undefined;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const redirectTimer = window.setTimeout(() => navigate('/dashboard'), prefersReducedMotion ? 100 : 1100);

    return () => window.clearTimeout(redirectTimer);
  }, [isSuccess, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(username, password, role === 'administrator' ? 'admin' : 'committee_officer');
      setIsSuccess(true);
    } catch {
      setError('Invalid username or password.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="centered-login-page">
      <div className="centered-login-particles" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="centered-login-content">
        <section className="centered-login-card" aria-labelledby="login-title">
          {isSuccess ? (
            <div className="centered-login-success" role="status" aria-live="polite">
              <div className="centered-login-success-mark" aria-hidden="true">
                <svg viewBox="0 0 52 52">
                  <circle className="centered-login-success-circle" cx="26" cy="26" r="23" />
                  <path className="centered-login-success-check" d="m15 27 7 7 15-16" />
                </svg>
              </div>
              <p className="centered-login-kicker">Secure access confirmed</p>
              <h1 id="login-title">You're signed in</h1>
              <p className="centered-login-intro">Taking you to your dashboard…</p>
            </div>
          ) : <>
          <header className="centered-login-header">
            <span className="centered-login-brand">iVote</span>
            <p className="centered-login-kicker">Secure access</p>
            <h1 id="login-title">Welcome to iVote!</h1>
            <p className="centered-login-intro">Sign in to continue to the iVote system.</p>
          </header>

          <form onSubmit={handleSubmit}>
            <fieldset className="centered-login-roles">
              <legend>Sign in as</legend>
              <div className="centered-login-role-list" role="group" aria-label="Account role">
                <button
                  type="button"
                  className={role === 'administrator' ? 'centered-login-role is-active' : 'centered-login-role'}
                  aria-pressed={role === 'administrator'}
                  onClick={() => setRole('administrator')}
                >
                  Administrator
                </button>
                <button
                  type="button"
                  className={role === 'committee' ? 'centered-login-role is-active' : 'centered-login-role'}
                  aria-pressed={role === 'committee'}
                  onClick={() => setRole('committee')}
                >
                  Student Electoral Committee
                </button>
              </div>
            </fieldset>

            <div className="centered-login-field">
              <label htmlFor="login-username">Username</label>
              <span className="centered-login-input-wrap">
                <span className="centered-login-input-icon"><UserIcon /></span>
                <input
                  id="login-username"
                  type="text"
                  name="username"
                  placeholder="Enter your username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </span>
            </div>

            <div className="centered-login-field">
              <label htmlFor="login-password">Password</label>
              <span className="centered-login-input-wrap">
                <span className="centered-login-input-icon"><LockIcon /></span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  className="centered-login-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon hidden={showPassword} />
                </button>
              </span>
            </div>

            {error && <p className="centered-login-error" role="alert">{error}</p>}
            <button className="centered-login-submit" type="submit" disabled={isLoading}>
              <span>{isLoading ? 'Signing in…' : 'Log In'}</span>
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <blockquote className="centered-login-quote">
            <span>Your Vote. Our Technology. A Fairer Tomorrow.</span>
          </blockquote>
          </>}
        </section>
      </div>
    </main>
  );
}
