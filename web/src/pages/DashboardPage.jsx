import React, { useEffect, useState } from "react";
import apiClient from "../api/apiClient";
import Icon from "../components/Icon";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {

  const { user } = useAuth();
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState("");
  const [selectedPrecinct, setSelectedPrecinct] = useState("all");
  const [precinctOptions, setPrecinctOptions] = useState([{ id: "all", label: "All Precincts" }]);
  const [election, setElection] = useState(null);
  const [results, setResults] = useState({});
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompactLaptop, setIsCompactLaptop] = useState(false);

  // Dark mode color mapping
  const colors = {
    pageBackground: "var(--page-bg)",
    cardBackground: "var(--surface)",
    textMuted: "var(--muted)",
    border: "var(--border)",
    shadowSoft: "var(--shadow-soft)",
    surfaceSoft: "var(--surface-soft)",
    primary: "var(--primary-2)",
    accent: "var(--accent)",
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 769px) and (max-width: 1100px) and (max-height: 600px)");

    const updateCompactLaptop = () => setIsCompactLaptop(mediaQuery.matches);

    updateCompactLaptop();
    mediaQuery.addEventListener("change", updateCompactLaptop);

    return () => mediaQuery.removeEventListener("change", updateCompactLaptop);
  }, []);

  useEffect(() => {
    if (!user) return;

    if (user.role !== "committee_officer") setSelectedPrecinct("all");
  }, [user]);

  useEffect(() => {
    if (user?.role !== "admin") {
      if (user?.role !== "committee_officer") {
        setPrecinctOptions([{ id: "all", label: "All Precincts" }]);
        return;
      }

      let active = true;

      apiClient.get("/precincts/assigned")
        .then(({ data }) => {
          if (!active) return;
          const precinct = data.data;
          if (precinct) {
            const option = {
              id: String(precinct.id),
              label: `Precinct ${precinct.precinct_number || precinct.id} · ${precinct.room}`,
            };
            setPrecinctOptions([option]);
            setSelectedPrecinct(option.id);
          } else {
            setPrecinctOptions([{ id: "unassigned", label: "No Precinct Assigned" }]);
            setSelectedPrecinct("unassigned");
          }
        })
        .catch(() => {
          if (!active) return;
          setPrecinctOptions([{ id: "unassigned", label: "No Precinct Assigned" }]);
          setSelectedPrecinct("unassigned");
        });

      return () => { active = false; };
    }

    async function loadPrecinctOptions() {
      try {
        const { data } = await apiClient.get("/precincts");
        const options = (data.data || []).map((precinct) => ({
          id: String(precinct.id),
          label: `Precinct ${precinct.precinct_number || precinct.id} · ${precinct.room}`,
        }));

        setPrecinctOptions([{ id: "all", label: "All Precincts" }, ...options]);
        setSelectedPrecinct((current) => (
          options.some((option) => option.id === current) ? current : "all"
        ));
      } catch {
        setPrecinctOptions([{ id: "all", label: "All Precincts" }]);
        setSelectedPrecinct("all");
      }
    }

    loadPrecinctOptions();
  }, [user?.role]);

  useEffect(() => {

    let interval;

    async function load() {

      try {

        const { data } = await apiClient.get("/elections");
        const electionList = (data.data || []).filter((item) => item.status !== "closed");

        setElections(electionList);

        const selectedElectionExists = electionList.some(
          (item) => String(item.id) === String(selectedElection)
        );

        if (!selectedElection || !selectedElectionExists) {
          if (selectedElection) setSelectedElection("");
          setElection(null);
          setResults({});
          setError(null);
          return;
        }

        const selected = electionList.find(
          (item) => String(item.id) === String(selectedElection)
        );

        setElection(selected || null);

        const params = {};
        if (user?.role === "committee_officer") {
          if (user.precinct && user.precinct !== "all") params.precinct = user.precinct;
        } else if (selectedPrecinct !== "all") {
          params.precinct_id = selectedPrecinct;
        }

        const { data: resultData } =
          await apiClient.get(
            `/elections/${selectedElection}/results`,
            { params }
          );

        setResults(resultData.data);

        setError(null);

      } catch {

        setError(
          "Unable to load election results."
        );

      } finally {

        setIsLoading(false);

      }

    }

    load();

    interval = setInterval(load, 10000);

    return () => clearInterval(interval);

  }, [selectedElection, selectedPrecinct, user]);

  if (error) return <p>{error}</p>;
  function copyPublicLink() {

  if (!selectedElection) {

    alert("Please select an election first.");

    return;

  }

  const url =
    `${window.location.origin}/results?election_id=${selectedElection}`;

  navigator.clipboard.writeText(url);

  alert("Public results link copied.");
}

  if (isLoading && !election) return <LoadingSkeleton variant="dashboard" label="Loading dashboard" />;
  const ballotStats = results.ballotStats || {
    issued: 0,
    counted: 0,
    manualReview: 0,
  };

  const totalCandidates =
    election?.positions?.reduce(
      (total, position) =>
        total + position.candidates.length,
      0
    ) || 0;

  const totalScanned = Number(ballotStats.counted || 0);
  const validBallots = totalScanned;
  const invalidBallots = Math.max(
    0,
    Number(ballotStats.issued || 0) - totalScanned
  );
  const scanningProgress = Number(ballotStats.issued || 0) > 0
    ? Math.min(
        100,
        Math.round((totalScanned / Number(ballotStats.issued || 0)) * 100)
      )
    : 0;
  return (

    <div
      className={isCompactLaptop ? "dashboard-page dashboard-page-compact" : "dashboard-page"}
      style={{
        padding: "0",
        background: colors.pageBackground,
        minHeight: "100vh",
        width: "100%",
        minWidth: 0,
      }}
    >

      <div
        className="dashboard-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: "28px",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >

        <div>
          <h1 style={{ margin: 0, fontSize: "26px" }}>
            Election Dashboard
          </h1>
        </div>

        <div
          className="dashboard-election-selector"
          style={{
            minWidth: "260px",
            maxWidth: "360px",
            flex: "1 1 260px",
            background: colors.cardBackground,
            borderRadius: "4px",
            padding: "12px",
            border: `1px solid ${colors.border}`,
            boxShadow: "none",
          }}
        >

          <select
            className="form-control"
            value={selectedElection}
            disabled={elections.length === 0}
            onChange={(e) => setSelectedElection(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              background: colors.surfaceSoft,
              border: `1px solid ${colors.border}`,
              color: "var(--text)",
              marginBottom: "10px",
            }}
          >
            <option value="" disabled>
              Select Election
            </option>
            {elections.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>

          {user?.role === "admin" ? (
            <select
              className="form-control"
              value={selectedPrecinct}
              disabled={precinctOptions.length <= 1}
              onChange={(e) => setSelectedPrecinct(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                background: colors.surfaceSoft,
                border: `1px solid ${colors.border}`,
                color: "var(--text)",
                marginBottom: "10px",
              }}
            >
              {precinctOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <div
              className="dashboard-assigned-precinct"
              role="status"
              aria-label="Assigned precinct"
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                minHeight: "42px",
                padding: "10px 12px",
                borderRadius: "8px",
                background: colors.surfaceSoft,
                border: `1px solid ${colors.border}`,
                color: "var(--text)",
                marginBottom: "10px",
              }}
            >
              {precinctOptions.find((option) => option.id === selectedPrecinct && option.id !== "all")?.label
                || user?.precinct
                || "No Precinct Assigned"}
            </div>
          )}

        </div>

      </div>

      {election ? (
        <>
      <div
        className="dashboard-stat-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,minmax(0,1fr))",
          gap: "14px",
          marginBottom: "18px",
        }}
      >

        <DashboardCard title="Ballots Generated" value={ballotStats.issued} color={colors.primary} icon="ballots" />
        <DashboardCard title="Ballots Scanned" value={ballotStats.counted} color={colors.accent} icon="scan" />
        <DashboardCard title="Candidates" value={totalCandidates} color={colors.primary} icon="users" />
        <DashboardCard title="Manual Review" value={ballotStats.manualReview} color={colors.accent} icon="review" />

      </div>

      <div
        className="dashboard-main-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: "20px",
          marginBottom: "28px",
          width: "100%",
          maxWidth: "1200px",
          minWidth: 0,
        }}
      >

        <div
          className="dashboard-panel dashboard-overview-panel"
          style={{
            background: colors.cardBackground,
            borderRadius: "4px",
            padding: "16px",
            boxShadow: "none",
            border: `1px solid ${colors.border}`,
          }}
        >

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "18px",
            }}
          >

            <h3 style={{ margin: 0 }}>Election Overview</h3>

          </div>

          <div
            className="dashboard-info-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "14px",
              marginBottom: "20px",
            }}
          >

            <InfoTile label="Turnout" value={`${scanningProgress}%`} color={colors.primary} icon="dashboard" />
            <InfoTile label="Valid Votes" value={validBallots} color={colors.accent} icon="check" />
            <InfoTile label="Invalid" value={invalidBallots} color={colors.primary} icon="review" />

          </div>

          <div
            className="dashboard-progress-panel"
            style={{
              background: colors.surfaceSoft,
              borderRadius: "12px",
              padding: "16px",
            }}
          >

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >

              <span style={{ fontWeight: 700 }}>Scanning Progress</span>

              <span style={{ color: colors.primary, fontWeight: 700 }}>
                {scanningProgress}%
              </span>

            </div>

            <div
              style={{
                height: "12px",
                borderRadius: "999px",
                background: "rgba(124, 141, 151, 0.18)",
                overflow: "hidden",
              }}
            >

              <div
                style={{
                  width: `${scanningProgress}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, var(--primary-2), var(--accent))",
                  borderRadius: "999px",
                }}
              />

            </div>

          </div>

        </div>

      </div>

      <div
        className="dashboard-bottom-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
          gap: "14px",
          width: "100%",
          maxWidth: "1200px",
          marginBottom: "30px",
        }}
      >

        <div
          className="dashboard-panel dashboard-public-panel"
          style={{
            background: colors.cardBackground,
            borderRadius: "4px",
            padding: "16px",
            boxShadow: "none",
            border: `1px solid ${colors.border}`,
          }}
        >

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >

            <h3 style={{ margin: 0 }}>Public Results Portal</h3>

            <button
              className="dashboard-copy-link-button"
              onClick={copyPublicLink}
            >
              <Icon name="copy" size={16} /> Copy Link
            </button>

          </div>

          <input
            type="text"
            readOnly
            value={`${window.location.origin}/results?election_id=${selectedElection}`}
            style={{
              width: "100%",
              minHeight: "42px",
              padding: "9px 12px",
              borderRadius: "4px",
              border: `1px solid ${colors.border}`,
              background: colors.surfaceSoft,
              color: "var(--text)",
            }}
          />

        </div>

        <div
          className="dashboard-panel dashboard-current-panel"
          style={{
            background: colors.cardBackground,
            borderRadius: "4px",
            padding: "16px",
            boxShadow: "none",
            border: `1px solid ${colors.border}`,
          }}
        >

          <h3 style={{ marginTop: 0, marginBottom: "12px", fontSize: "16px" }}>Current Election</h3>

          <div style={{ display: "grid", gap: "8px" }}>
            <div style={{ color: colors.textMuted, fontSize: "12px" }}>Election</div>
            <div style={{ fontSize: "16px", lineHeight: "1.35", fontWeight: 700, overflowWrap: "anywhere" }}>{election.title}</div>
            <div style={{ color: colors.textMuted }}>
              {election.description || "Election in progress"}
            </div>
            <div
              style={{
                display: "inline-flex",
                alignSelf: "flex-start",
                borderRadius: "4px",
                background: "rgba(61, 108, 153, 0.12)",
                color: colors.primary,
                fontSize: "12px",
                fontWeight: 700,
                padding: "8px 12px",
              }}
            >
              {election.status || "Active"}
            </div>
          </div>

        </div>

      </div>

        </>
      ) : (
        <div
          className="dashboard-panel"
          style={{
            maxWidth: "1200px",
            padding: "20px 24px",
            background: colors.cardBackground,
            border: `1px solid ${colors.border}`,
            color: colors.textMuted,
          }}
        >
          {elections.length > 0
            ? "Select an election to view dashboard details."
            : "No elections available."}
        </div>
      )}

    </div>

  );

}

function DashboardCard({
  title,
  value,
  color,
  icon,
}) {

  return (

    <div
      className="dashboard-stat-card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        minHeight: "82px",
        background: "var(--surface)",
        borderRadius: "4px",
        padding: "16px",
        boxShadow: "none",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${color}`,
      }}
    >

      <span
        className="dashboard-summary-icon"
        style={{ color, background: "var(--surface-soft)" }}
      >
        <Icon name={icon} size={20} />
      </span>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            color: "var(--muted)",
            fontSize: "12px",
            marginBottom: "2px",
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: "24px",
            lineHeight: "1",
            fontWeight: "700",
            color: color,
          }}
        >
          {value}
        </div>
      </div>

    </div>

  );

}

function MetricTile({ label, value, color }) {

  return (

    <div
      style={{
        background: "var(--surface-soft)",
        borderRadius: "10px",
        padding: "14px 16px",
        borderLeft: `4px solid ${color}`,
      }}
    >

      <div
        style={{
          color: "var(--muted)",
          fontSize: "12px",
          marginBottom: "8px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "26px",
          fontWeight: "700",
          color: color,
        }}
      >
        {value}
      </div>

    </div>

  );

}

function InfoTile({ label, value, color, icon }) {

  return (

    <div
      className="dashboard-info-tile"
      style={{
        background: "var(--surface)",
        borderRadius: "4px",
        minHeight: "82px",
        padding: "16px",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${color}`,
      }}
    >

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          className="dashboard-summary-icon"
          style={{ width: "32px", height: "32px", color, background: "var(--surface-soft)" }}
        >
          <Icon name={icon} size={16} />
        </span>
        <div>
      <div style={{ color: "var(--muted)", fontSize: "12px", marginBottom: "2px" }}>
        {label}
      </div>

      <div style={{ fontSize: "24px", lineHeight: "1", fontWeight: 700, color: color }}>
        {value}
      </div>
        </div>
      </div>

    </div>

  );

}
