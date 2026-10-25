import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import logo from "../../assets/logo.png";

const ADMIN_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/scanner', label: 'Scanner' },
  { to: '/elections', label: 'Elections' },
  { to: '/ballots', label: 'Ballots' },
  { to: '/scanner-monitoring', label: 'Scanner Monitoring' },
  { to: '/reports', label: 'Reports' },
  { to: '/audit-logs', label: 'Audit Logs' },
  { to: '/users', label: 'Users' },
  { to: '/settings', label: 'Settings' },
];

const OFFICER_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/scanner', label: 'Scanner' },
  { to: '/scanner-monitoring', label: 'Scanner Monitoring' },
  { to: '/settings', label: 'Settings' },
];

export default function Sidebar({ mobileOpen = false, onNavigate = () => {} }) {
  const { isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const links = isAdmin ? ADMIN_LINKS : OFFICER_LINKS;

  const Icon = ({ name }) => {
    // Simple, consistent monochrome icons. Keep these minimal.
    switch (name) {
      case 'Dashboard':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <rect x="3" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="13" y="3" width="8" height="5" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="13" y="10" width="8" height="11" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        );
      case 'Elections':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M3 7h18M6 20V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 20h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'Ballots':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <rect x="3" y="4" width="14" height="16" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M7 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
      case 'Scanner Monitoring':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M3 12h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M12 3v6v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
      case 'Reports':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M3 6h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M6 10h12M6 14h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
      case 'Audit Logs':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 8h8M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
      case 'Users':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 20c1.5-3 4.5-5 7-5s5.5 2 7 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
      case 'Settings':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.8l.06.06a1 1 0 0 1-1.41 1.41l-.06-.06a1.7 1.7 0 0 0-1.8-.34 1.7 1.7 0 0 0-1 1.6V21a1 1 0 0 1-2 0v-.22a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.8.34l-.06.06A1 1 0 0 1 8.27 19.3l.06-.06A1.7 1.7 0 0 0 6.53 17.4 1.7 1.7 0 0 0 6.19 15H4a1 1 0 0 1 0-2h2.19c.1-.6.35-1.16.73-1.65l-.06-.06A1 1 0 0 1 8.27 9.7l.06.06c.53.53 1.2.86 1.95.98V12a1 1 0 0 1 2 0v.22c.75-.12 1.42-.45 1.95-.98l.06-.06a1 1 0 0 1 1.41 1.41l-.06.06c.38.49.63 1.05.73 1.65H20a1 1 0 0 1 0 2h-1.6z" stroke="currentColor" strokeWidth="1"/>
          </svg>
        );
      default:
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        );
    }
  };

  return (
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>

      <div className="sidebar-brand">
        <img src={logo} alt="iVote Logo" className="sidebar-logo-image" />
        <div className="brand-text">
          <span className="brand-name">iVote</span>
          <span className="brand-sub">Election Management</span>
        </div>
      </div>

      <nav className="sidebar-menu" aria-label="Main navigation">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/dashboard"}
            onClick={onNavigate}
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <span className="menu-icon" aria-hidden>
              <Icon name={link.label} />
            </span>
            <span className="menu-text">
              {link.label}
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          title={`${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? (
            <>
              <span className="theme-toggle-icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="label">Dark</span>
              <span className="visually-hidden">Switch to dark mode</span>
            </>
          ) : (
            <>
              <span className="theme-toggle-icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="label">Light</span>
              <span className="visually-hidden">Switch to light mode</span>
            </>
          )}
        </button>

        <div className="system-version">iVote v1.0</div>
      </div>

    </aside>
  );
}
