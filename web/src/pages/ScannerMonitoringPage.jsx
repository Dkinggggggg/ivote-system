import React, { useEffect, useState } from "react";
import apiClient from "../api/apiClient";
import PaginationControls from "../components/PaginationControls";
import LoadingSkeleton from "../components/LoadingSkeleton";

export default function ScannerMonitoringPage() {

  const [scans, setScans] = useState([]);
  const [filteredScans, setFilteredScans] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {

    loadScans();

    const interval = setInterval(loadScans, 5000);

    return () => clearInterval(interval);

  }, []);

  useEffect(() => {

    const keyword = search.toLowerCase();

    setFilteredScans(

      scans.filter(scan =>

        `${scan.officer_name || ""}
         ${scan.serial_number || ""}
         ${scan.election || ""}
         ${scan.status || ""}`
          .toLowerCase()
          .includes(keyword)

      )

    );

  }, [search, scans]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  async function loadScans() {

    try {

      const { data } = await apiClient.get("/scans/recent");

      setScans(data.data || []);

    } catch {

      setScans([]);

    } finally {

      setLoading(false);

    }

  }

  const counted = scans.filter(
    s => s.status === "counted"
  ).length;

  const review = scans.filter(
    s => s.status === "manual_review"
  ).length;

  const duplicate = scans.filter(
    s => s.status === "duplicate_rejected"
  ).length;

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredScans.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const visibleScans = filteredScans.slice(startIndex, startIndex + pageSize);
  const startItem = filteredScans.length === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(startIndex + pageSize, filteredScans.length);

  function badge(status) {

    switch (status) {

      case "counted":
        return "#198754";

      case "manual_review":
        return "#fd7e14";

      case "duplicate_rejected":
        return "#dc3545";

      default:
        return "#6c757d";

    }

  }

  if (loading)
    return <LoadingSkeleton variant="scanner" label="Loading scanner activity" />;

  return (

    <div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          gap: 16,
          flexWrap: "wrap",
        }}
      >

        <div>

          <h1 style={{ marginBottom: 5 }}>
            Scanner Monitoring
          </h1>

          <p style={{ color: "#666" }}>
            Live updates every 5 seconds
          </p>

        </div>

        <button
          className="primary-button"
          onClick={loadScans}
        >
          Refresh
        </button>

      </div>

      {/* Search */}

      <div
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 12,
          boxShadow: "0 3px 10px rgba(0,0,0,.08)",
          marginBottom: 25,
        }}
      >

        <input
          type="text"
          placeholder="Search officer, serial number, election or status"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 450,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
        />

      </div>

      {/* Summary Cards */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 20,
          marginBottom: 30,
        }}
      >

        <div className="dashboard-card" style={{ borderLeft: "5px solid var(--primary-2)" }}>
          <h3>Total Scans</h3>
          <h1 style={{ color: "var(--primary-2)" }}>{scans.length}</h1>
        </div>

        <div className="dashboard-card" style={{ borderLeft: "5px solid var(--accent)" }}>
          <h3>Counted</h3>
          <h1 style={{ color: "var(--accent)" }}>
            {counted}
          </h1>
        </div>

        <div className="dashboard-card" style={{ borderLeft: "5px solid var(--primary-2)" }}>
          <h3>Manual Review</h3>
          <h1 style={{ color: "var(--primary-2)" }}>
            {review}
          </h1>
        </div>

        <div className="dashboard-card" style={{ borderLeft: "5px solid var(--accent)" }}>
          <h3>Duplicate</h3>
          <h1 style={{ color: "var(--accent)" }}>
            {duplicate}
          </h1>
        </div>

      </div>

      {/* Table */}

      <div className="table-shell">

      <table className="data-table">

        <thead>

          <tr>

            <th>Officer</th>

            <th>Election</th>

            <th>Serial Number</th>

            <th>Confidence</th>

            <th>Status</th>

            <th>Time</th>

          </tr>

        </thead>

        <tbody>

          {visibleScans.length > 0 ? (

            visibleScans.map(scan => (

              <tr key={scan.id}>

                <td>{scan.officer_name}</td>

                <td>{scan.election || "-"}</td>

                <td>{scan.serial_number}</td>

                <td>

                  {scan.confidence
                    ? `${Math.round(scan.confidence * 100)}%`
                    : "-"}

                </td>

                <td>

                  <span
                    style={{
                      background: badge(scan.status),
                      color: "#fff",
                      padding: "5px 12px",
                      borderRadius: 20,
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >

                    {scan.status.replaceAll("_", " ")}

                  </span>

                </td>

                <td>

                  {scan.scanned_at
                    ? new Date(scan.scanned_at).toLocaleString()
                    : "-"}

                </td>

              </tr>

            ))

          ) : (

            <tr>

              <td
                colSpan={6}
                style={{
                  textAlign: "center",
                  padding: 25,
                  color: "#777",
                }}
              >

                No scanner activity found.

              </td>

            </tr>

          )}

        </tbody>

      </table>

      </div>

      <PaginationControls
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={filteredScans.length}
        startItem={startItem}
        endItem={endItem}
        onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
        onNext={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
      />

    </div>

  );

}
