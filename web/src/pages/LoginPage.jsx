import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import BrandMark from '../components/BrandMark';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export default function CenteredLoginPage() {
  const { login, changePassword, logout, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('administrator');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(
    Boolean(user?.role === 'admin' && user?.must_change_password)
  );
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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
      const authenticatedUser = await login(email, password, role === 'administrator' ? 'admin' : 'committee_officer');
      if (authenticatedUser.must_change_password) {
        setCurrentPassword(password);
        setPassword('');
        setMustChangePassword(true);
        return;
      }
      setIsSuccess(true);
    } catch (loginError) {
      const response = loginError.response;
      const validationMessage = Object.values(response?.data?.errors || {})
        .flat()
        .find((message) => typeof message === 'string');

      if (validationMessage) {
        setError(validationMessage);
      } else if (!response) {
        setError('Unable to reach the sign-in service. Check the server and try again.');
      } else if (response.status >= 500) {
        setError('Sign-in service error. Please try again later.');
      } else {
        setError('Invalid sign-in credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFirstPasswordChange(event) {
    event.preventDefault();
    setPasswordChangeError(null);

    if (newPassword.length < 12) {
      setPasswordChangeError('Choose a password with at least 12 characters.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError('The new passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword, confirmNewPassword);
      setMustChangePassword(false);
      setIsSuccess(true);
    } catch (changeError) {
      const response = changeError.response;
      const validationMessage = Object.values(response?.data?.errors || {})
        .flat()
        .find((message) => typeof message === 'string');
      setPasswordChangeError(
        validationMessage
          || response?.data?.message
          || 'Unable to change your password. Please try again.'
      );
    } finally {
      setIsChangingPassword(false);
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
          ) : mustChangePassword ? <>
          <header className="centered-login-header">
            <span className="centered-login-brand"><BrandMark className="centered-login-brand-mark" /></span>
            <p className="centered-login-kicker">Account security</p>
            <h1 id="login-title">Create a new password</h1>
            <p className="centered-login-intro">Your temporary password must be replaced before you continue.</p>
          </header>

          <form onSubmit={handleFirstPasswordChange}>
            <div className="centered-login-field">
              <label htmlFor="temporary-password">Temporary password</label>
              <span className="centered-login-input-wrap">
                <span className="centered-login-input-icon"><Icon name="lock" size={17} /></span>
                <input
                  id="temporary-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                />
              </span>
            </div>

            <div className="centered-login-field">
              <label htmlFor="new-password">New password</label>
              <span className="centered-login-input-wrap">
                <span className="centered-login-input-icon"><Icon name="lock" size={17} /></span>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  minLength={12}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              </span>
            </div>

            <div className="centered-login-field">
              <label htmlFor="confirm-new-password">Confirm new password</label>
              <span className="centered-login-input-wrap">
                <span className="centered-login-input-icon"><Icon name="lock" size={17} /></span>
                <input
                  id="confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(event) => setConfirmNewPassword(event.target.value)}
                  required
                />
              </span>
            </div>

            {passwordChangeError && <p className="centered-login-error" role="alert">{passwordChangeError}</p>}
            <button className="centered-login-submit" type="submit" disabled={isChangingPassword}>
              <span>{isChangingPassword ? 'Updating password…' : 'Set new password'}</span>
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <button className="centered-login-secondary" type="button" onClick={logout}>Sign out</button>
          </> : <>
          <header className="centered-login-header">
            <span className="centered-login-brand"><BrandMark className="centered-login-brand-mark" /></span>
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
              <label htmlFor="login-email">Email or Username</label>
              <span className="centered-login-input-wrap">
                <span className="centered-login-input-icon"><Icon name="user" size={17} /></span>
                <input
                  id="login-email"
                  type="text"
                  name="email"
                  placeholder="Enter your email or username"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </span>
            </div>

            <div className="centered-login-field">
              <label htmlFor="login-password">Password</label>
              <span className="centered-login-input-wrap">
                <span className="centered-login-input-icon"><Icon name="lock" size={17} /></span>
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
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </span>
            </div>

            {error && <p className="centered-login-error" role="alert">{error}</p>}
            <button className="centered-login-submit" type="submit" disabled={isLoading} aria-busy={isLoading}>
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
