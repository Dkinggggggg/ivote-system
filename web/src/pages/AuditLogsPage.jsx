import React, { useEffect, useState } from 'react';
import apiClient from '../api/apiClient';
import PaginationControls from '../components/PaginationControls';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function AuditLogsPage() {

  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

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

    if (!normalizedSearch) {
      return true;
    }

    return buildSearchText(log).includes(normalizedSearch);
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
  }, [search]);

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

    <div>

      <h1 style={{ marginBottom: "25px" }}>
        Audit Logs
      </h1>

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
          <h3>Total Logs</h3>

          <h1 style={{ color: "var(--primary-2)" }}>
            {totalLogs}
          </h1>

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

          <h3>User Logs</h3>

          <h1 style={{ color: "var(--accent)" }}>
            {userLogs}
          </h1>

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

          <h3>System Logs</h3>

          <h1 style={{ color: "var(--primary-2)" }}>
            {systemLogs}
          </h1>

        </div>

      </div>

      <div
        style={{
          background: "#fff",
          padding: "25px",
          borderRadius: "12px",
          boxShadow: "0 3px 10px rgba(0,0,0,.08)",
          marginBottom: "25px",
        }}
      >

        <input
          type="text"
          placeholder="Search by user, action, description, IP, date or time"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "420px",
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px solid #ccc",
          }}
        />

      </div>

      <div className="table-shell">

      <table className="data-table">

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

                    <span
                      className="audit-action-badge"
                      style={{
                        background: info.color,
                        color: "#fff",
                        padding: "6px 12px",
                        borderRadius: "20px",
                        fontSize: "13px",
                        fontWeight: "600",
                        display: "inline-block",
                        whiteSpace: "nowrap",
                      }}
                    >
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

              <td
                colSpan="5"
                style={{
                  textAlign: "center",
                  padding: "30px",
                  color: "#777",
                }}
              >
                No audit logs found.
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
