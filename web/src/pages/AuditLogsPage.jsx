import React, { useEffect, useState } from 'react';
import apiClient from '../api/apiClient';
import PaginationControls from '../components/PaginationControls';
import LoadingSkeleton from '../components/LoadingSkeleton';
import Icon from '../components/Icon';

export default function AuditLogsPage() {

  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    try {

      const response = await apiClient.get('/audit-logs');

      setLogs(response.data.data || []);

    } catch (error) {

      console.log(error);

      setLogs([]);

    } finally {

      setIsLoading(false);

    }
  }

  const buildSearchText = (log) => {
    const createdAt = log.created_at ? new Date(log.created_at) : null;
    const dateVariants = [];

    if (createdAt && !Number.isNaN(createdAt.getTime())) {
      dateVariants.push(createdAt.toISOString());
      dateVariants.push(createdAt.toLocaleString());
      dateVariants.push(createdAt.toLocaleDateString());
      dateVariants.push(createdAt.toLocaleTimeString());
    }

    return [
      log.action || '',
      log.user_name || '',
      log.description || '',
      log.ip_address || '',
      log.created_at || '',
      ...dateVariants,
    ].join(' ').toLowerCase();
  };

  const filtered = logs.filter((log) => {
    const normalizedSearch = search.trim().toLowerCase();
    const matchesSearch = !normalizedSearch || buildSearchText(log).includes(normalizedSearch);
    const actionValue = String(log.action || '').toLowerCase();

    const matchesAction = actionFilter === 'all'
      || (actionFilter === 'login' && actionValue.includes('login'))
      || (actionFilter === 'create' && actionValue.includes('create'))
      || (actionFilter === 'update' && actionValue.includes('update'))
      || (actionFilter === 'delete' && actionValue.includes('delete'))
      || (actionFilter === 'scan' && actionValue.includes('scan'))
      || (actionFilter === 'other' && !['login', 'create', 'update', 'delete', 'scan'].some((term) => actionValue.includes(term)));

    return matchesSearch && matchesAction;
  });

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const visibleLogs = filtered.slice(startIndex, startIndex + pageSize);
  const startItem = filtered.length === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(startIndex + pageSize, filtered.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, actionFilter]);

  const totalLogs = logs.length;

  const systemLogs = logs.filter(
    (log) => !log.user_name
  ).length;

  const userLogs = logs.filter(
    (log) => log.user_name
  ).length;

  function formatActionLabel(action) {

    return String(action || 'Unknown')
      .replace(/_/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  }

  function actionInfo(action) {

    if (!action) {
      return {
        color: "#6c757d",
        text: "Unknown",
      };
    }

    const value = action.toLowerCase();
    const label = formatActionLabel(action);

    if (value.includes("create")) {
      return {
        color: "#198754",
        text: label,
      };
    }

    if (value.includes("update")) {
      return {
        color: "#fd7e14",
        text: label,
      };
    }

    if (value.includes("delete")) {
      return {
        color: "#dc3545",
        text: label,
      };
    }

    if (value.includes("login")) {
      return {
        color: "#6f42c1",
        text: "User Login",
      };
    }

    if (value.includes("scan")) {
      return {
        color: "#0d6efd",
        text: label,
      };
    }

    if (value.includes("review")) {
      return {
        color: "#ffc107",
        text: label,
      };
    }

    return {
      color: "#0d6efd",
      text: label,
    };
  }

  if (isLoading && logs.length === 0) {
    return <LoadingSkeleton variant="audit" label="Loading audit logs" />;
  }

  return (

    <div className="audit-page">

      <header className="audit-page-header">
        <div>
          <h1>Audit Logs</h1>
        </div>
      </header>

      <div className="audit-summary-grid">

        <div className="audit-summary-card">
          <span className="audit-summary-icon"><Icon name="audit" size={20} /></span>
          <div>
            <p>Total Logs</p>
            <strong>{totalLogs}</strong>
          </div>
        </div>

        <div className="audit-summary-card">
          <span className="audit-summary-icon is-accent"><Icon name="user" size={20} /></span>
          <div>
            <p>User Logs</p>
            <strong>{userLogs}</strong>
          </div>
        </div>

        <div className="audit-summary-card">
          <span className="audit-summary-icon"><Icon name="settings" size={20} /></span>
          <div>
            <p>System Logs</p>
            <strong>{systemLogs}</strong>
          </div>
        </div>

      </div>

      <div className="audit-toolbar">
        <label className="audit-search-field">
          <Icon name="search" size={17} />
          <input
            type="search"
            placeholder="Search user, action, description, IP, date or time"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search audit logs"
          />
        </label>
        <label className="audit-filter-field">
          <span>Action</span>
          <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
            <option value="all">All actions</option>
            <option value="login">Login</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="scan">Scan</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>

      <div className="table-shell audit-table-shell">

      <table className="data-table audit-table">

        <thead>

          <tr>

            <th>User</th>

            <th>Action</th>

            <th>Description</th>

            <th>IP Address</th>

            <th>Time</th>

          </tr>

        </thead>

        <tbody>

          {visibleLogs.length > 0 ? (

            visibleLogs.map((log) => {

              const info = actionInfo(log.action);

              return (

                <tr key={log.id}>

                  <td>

                    {log.user_name ? (
                      <>
                        <div>{log.user_name}</div>
                        {log.user_role && (
                          <small style={{ color: "#6c757d" }}>
                            {log.user_role === "admin"
                              ? "Administrator"
                              : log.user_role === "committee_officer"
                                ? "Student Electoral Committee"
                                : log.user_role}
                          </small>
                        )}
                      </>
                    ) : "System"}

                  </td>

                  <td>

                    <span className="audit-action-label">
                      {info.text}
                    </span>

                  </td>

                  <td>{log.description}</td>

                  <td>{log.ip_address || "-"}</td>

                  <td>{log.created_at || "-"}</td>

                </tr>

              );

            })

          ) : (

            <tr>

              <td colSpan="5" className="audit-empty-state">
                <Icon name="audit" size={22} />
                <strong>No audit logs found</strong>
                <span>Try changing your search or action filter.</span>
              </td>

            </tr>

          )}

        </tbody>

      </table>

      </div>

      <PaginationControls
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={filtered.length}
        startItem={startItem}
        endItem={endItem}
        onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
        onNext={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
      />

    </div>

  );

}
