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
  const [selectedYearLevel, setSelectedYearLevel] = useState("all");
  const [precinctOptions, setPrecinctOptions] = useState(["all"]);
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

    if (user.role === "committee_officer") {
      setSelectedPrecinct(user.precinct || "all");
      setSelectedYearLevel(user.year_level || "all");
      return;
    }

    setSelectedPrecinct("all");
    setSelectedYearLevel("all");
  }, [user]);

  useEffect(() => {
    if (user?.role !== "admin") {
      setPrecinctOptions([user?.precinct || "all"]);
      return;
    }

    async function loadPrecinctOptions() {
      try {
        const { data } = await apiClient.get("/users");
        const precincts = [...new Set(
          (data.data || [])
            .filter((entry) => entry.role === "committee_officer" && entry.precinct)
            .map((entry) => entry.precinct)
        )].sort();

        setPrecinctOptions(["all", ...precincts]);
      } catch {
        setPrecinctOptions(["all"]);
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
        const effectivePrecinct = user?.role === "committee_officer"
          ? user.precinct || "all"
          : selectedPrecinct;

        if (effectivePrecinct && effectivePrecinct !== "all") {
          params.precinct = effectivePrecinct;
        }

        if (selectedYearLevel && selectedYearLevel !== "all") {
          params.year_level = selectedYearLevel;
        }

        if (user?.role === "committee_officer") {
          if (selectedYearLevel && selectedYearLevel !== "all") {
            params.year_level = selectedYearLevel;
          }
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

  }, [selectedElection, selectedPrecinct, selectedYearLevel, user]);

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
        padding: "30px",
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
          alignItems: "center",
          marginBottom: "28px",
          gap: "18px",
          flexWrap: "wrap",
        }}
      >

        <div>

          <div
            style={{
              display: "inline-block",
              background: "rgba(61, 108, 153, 0.12)",
              color: colors.primary,
              borderRadius: "999px",
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "10px",
            }}
          >
            Officer Overview
          </div>

          <h1 style={{ margin: 0, fontSize: "32px" }}>
            Election Dashboard
          </h1>

          <p style={{ margin: "8px 0 0", color: colors.textMuted }}>
            Live election monitoring and ballot processing
          </p>

        </div>

        <div
          className="dashboard-election-selector"
          style={{
            minWidth: "260px",
            maxWidth: "360px",
            flex: "1 1 260px",
            background: colors.cardBackground,
            borderRadius: "12px",
            padding: "16px 18px",
            boxShadow: colors.shadowSoft,
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

          <select
            className="form-control"
            value={selectedPrecinct}
            disabled={user?.role !== "admin" || precinctOptions.length <= 1}
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
              <option key={option} value={option}>
                {option === "all" ? "All Precincts" : option}
              </option>
            ))}
          </select>

          <select
            className="form-control"
            value={selectedYearLevel}
            onChange={(e) => setSelectedYearLevel(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              background: colors.surfaceSoft,
              border: `1px solid ${colors.border}`,
              color: "var(--text)",
            }}
          >
            <option value="all">All Year Levels</option>
            <option value="2nd Year">2nd Year</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year</option>
          </select>

        </div>

      </div>

      {election ? (
        <>
      <div
        className="dashboard-stat-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "20px",
          marginBottom: "28px",
        }}
      >

        <DashboardCard title="Ballots Generated" value={ballotStats.issued} color={colors.primary} />
        <DashboardCard title="Ballots Scanned" value={ballotStats.counted} color={colors.accent} />
        <DashboardCard title="Candidates" value={totalCandidates} color={colors.primary} />
        <DashboardCard title="Manual Review" value={ballotStats.manualReview} color={colors.accent} />

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
            borderRadius: "16px",
            padding: "24px",
            boxShadow: colors.shadowSoft,
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

            <InfoTile label="Turnout" value={`${scanningProgress}%`} color={colors.primary} />
            <InfoTile label="Valid Votes" value={validBallots} color={colors.accent} />
            <InfoTile label="Invalid" value={invalidBallots} color={colors.primary} />

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
          gap: "20px",
          width: "100%",
          maxWidth: "1200px",
          marginBottom: "30px",
        }}
      >

        <div
          className="dashboard-panel"
          style={{
            background: colors.cardBackground,
            borderRadius: "16px",
            padding: "24px",
            boxShadow: colors.shadowSoft,
            border: `1px solid ${colors.border}`,
          }}
        >

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "18px",
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
              padding: "12px 14px",
              borderRadius: "8px",
              border: `1px solid ${colors.border}`,
              background: colors.surfaceSoft,
              color: "var(--text)",
            }}
          />

        </div>

        <div
          className="dashboard-panel"
          style={{
            background: colors.cardBackground,
            borderRadius: "16px",
            padding: "24px",
            boxShadow: colors.shadowSoft,
            border: `1px solid ${colors.border}`,
          }}
        >

          <h3 style={{ marginTop: 0, marginBottom: "18px" }}>Current Election</h3>

          <div style={{ display: "grid", gap: "12px" }}>
            <div style={{ color: colors.textMuted, fontSize: "13px" }}>Election</div>
            <div style={{ fontSize: "22px", fontWeight: 700 }}>{election.title}</div>
            <div style={{ color: colors.textMuted }}>
              {election.description || "Election in progress"}
            </div>
            <div
              style={{
                display: "inline-flex",
                alignSelf: "flex-start",
                borderRadius: "999px",
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
}) {

  return (

    <div
      className="dashboard-stat-card"
      style={{
        background: "var(--surface)",
        borderRadius: "12px",
        padding: "22px",
        boxShadow: "var(--shadow-soft)",
        borderLeft: `5px solid ${color}`,
      }}
    >

      <div
        style={{
          color: "var(--muted)",
          fontSize: "14px",
          marginBottom: "12px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "30px",
          fontWeight: "700",
          color: color,
        }}
      >
        {value}
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

function InfoTile({ label, value, color }) {

  return (

    <div
      className="dashboard-info-tile"
      style={{
        background: "var(--surface-soft)",
        borderRadius: "12px",
        padding: "14px 16px",
        borderLeft: `4px solid ${color}`,
      }}
    >

      <div style={{ color: "var(--muted)", fontSize: "12px", marginBottom: "8px" }}>
        {label}
      </div>

      <div style={{ fontSize: "26px", fontWeight: 700, color: color }}>
        {value}
      </div>

    </div>

  );

}
