import React, { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import Icon from "../Icon";
import BrandMark from "../BrandMark";
import apiClient from "../../api/apiClient";

const ADMIN_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { label: 'Election Management', group: true },
  { to: '/ballots', label: 'Ballots' },
  { to: '/reports', label: 'Reports' },
  { to: '/audit-logs', label: 'Audit Logs' },
  { to: '/users', label: 'Users' },
  { to: '/precincts', label: 'Manage Precinct' },
  { to: '/settings', label: 'Settings' },
];

const OFFICER_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/scanner', label: 'Scanner' },
  { to: '/settings', label: 'Settings' },
];

export default function Sidebar({ mobileOpen = false, onNavigate = () => {} }) {
  const { isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isElectionMenuOpen, setIsElectionMenuOpen] = useState(true);
  const [draftElectionId, setDraftElectionId] = useState(null);

  useEffect(() => {
    let active = true;

    apiClient.get('/elections')
      .then(({ data }) => {
        if (!active) return;
        const electionList = data.data ?? data;
        const draft = (Array.isArray(electionList) ? electionList : [])
          .find((item) => String(item.status || '').toLowerCase() === 'draft');
        setDraftElectionId(draft ? String(draft.id) : null);
      })
      .catch(() => {
        if (active) setDraftElectionId(null);
      });

    return () => { active = false; };
  }, [location.pathname]);

  const electionManagementChildren = (() => {
    return [
      { label: 'Election', path: '/elections' },
      { label: 'Party List & Positions', path: '/election-management/party-list' },
      { label: 'Candidates', path: '/election-management/candidates' },
      { label: 'Review Election', path: '/election-management/review' },
    ];
  })();

  const handleChildNavigate = (path) => {
    onNavigate();

    if (!draftElectionId && path === '/elections') {
      localStorage.removeItem('selectedElectionId');
    }

    navigate(path);
  };

  const handleElectionMenuMouseEnter = () => setIsElectionMenuOpen(true);
  const handleElectionMenuMouseLeave = () => setIsElectionMenuOpen(false);

  const links = isAdmin ? ADMIN_LINKS.map((link) => (
    link.group ? { ...link, children: electionManagementChildren } : link
  )) : OFFICER_LINKS;

  const isElectionManagementActive =
    location.pathname.startsWith('/election-management') ||
    location.pathname.startsWith('/elections') ||
    location.pathname.startsWith('/positions') ||
    location.pathname.startsWith('/candidates');

  useEffect(() => {
    if (isElectionManagementActive) {
      setIsElectionMenuOpen(true);
    }
  }, [isElectionManagementActive]);

  return (
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>

      <div className="sidebar-brand">
        <BrandMark className="sidebar-brand-mark" />
        <div className="brand-text">
          <span className="brand-name">iVote</span>
          <span className="brand-sub">Election Management</span>
        </div>
      </div>

      <nav className="sidebar-menu" aria-label="Main navigation">
        {links.map((link) => {
          if (link.group) {
            return (
              <div
                key={link.label}
                className={`sidebar-group ${isElectionManagementActive ? 'active' : ''}`}
                onMouseEnter={handleElectionMenuMouseEnter}
                onMouseLeave={handleElectionMenuMouseLeave}
              >
                <div className="sidebar-group-label-wrap">
                  <div className="sidebar-group-label">
                    <span className="menu-icon" aria-hidden>
                      <Icon name={link.label} />
                    </span>
                    <span className="menu-text">{link.label}</span>
                  </div>

                  <button
                    type="button"
                    className="sidebar-group-toggle"
                    aria-expanded={isElectionMenuOpen}
                    aria-label={isElectionMenuOpen ? 'Collapse Election Management submenu' : 'Expand Election Management submenu'}
                    onClick={() => setIsElectionMenuOpen((open) => !open)}
                  >
                    <span className="submenu-caret" aria-hidden>
                      <Icon name={isElectionMenuOpen ? 'chevronDown' : 'chevronRight'} size={14} />
                    </span>
                  </button>
                </div>

                {isElectionMenuOpen && (
                  <div className="sidebar-submenu">
                    {link.children.map((child) => (
                      <button
                        key={`${child.label}-${child.path}`}
                        type="button"
                        className={
                          location.pathname === child.path.split('?')[0] ||
                          (location.pathname.startsWith('/elections/') && child.label === 'Party List & Positions' && location.search.includes('tab=positions'))
                            ? "sidebar-submenu-link active"
                            : "sidebar-submenu-link"
                        }
                        onClick={() => handleChildNavigate(child.path)}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
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
          );
        })}
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
                    <Icon name="moon" />
              </span>
              <span className="label">Dark</span>
              <span className="visually-hidden">Switch to dark mode</span>
            </>
          ) : (
            <>
              <span className="theme-toggle-icon" aria-hidden>
                <Icon name="sun" />
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
