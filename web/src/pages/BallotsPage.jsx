import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import PaginationControls from '../components/PaginationControls';
import LoadingSkeleton from '../components/LoadingSkeleton';
import Icon from '../components/Icon';
import './BallotsPage.css';
import logo from '../assets/logo.png';
import { positionsForBallot } from '../utils/ballotPositions';

const yearLevels = ['2nd Year', '3rd Year', '4th Year'];

export default function BallotsPage() {

  const navigate = useNavigate();

  const [ballots, setBallots] = useState([]);
  const [elections, setElections] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [electionId, setElectionId] = useState('');
  const [batchSize, setBatchSize] = useState(100);
  const [program, setProgram] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [ballotDepartmentFilter, setBallotDepartmentFilter] = useState('');
  const [ballotYearFilter, setBallotYearFilter] = useState('');

  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  

  const [selectedBallots, setSelectedBallots] = useState([]);
  const [pdfMode, setPdfMode] = useState(false);
  const [pdfBallots, setPdfBallots] = useState([]);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);

  const selectAllRef = useRef(null);

  useEffect(() => {
    Promise.all([loadElections(), loadBallots()])
      .finally(() => setIsInitialLoading(false));
  }, []);

  useEffect(() => {
    let active = true;

    if (!electionId) {
      setDepartments([]);
      setProgram('');
      return () => {
        active = false;
      };
    }

    apiClient.get(`/elections/${electionId}/positions`)
      .then(({ data }) => {
        if (!active) return;

        const options = (data.data || [])
          .filter((position) => (
            (position.category_name === 'Governors' || position.name.startsWith('Governor - '))
            && position.department_serial_code
          ))
          .map((position) => ({
            name: position.name.startsWith('Governor - ')
              ? position.name.slice('Governor - '.length).trim()
              : position.name.trim(),
            code: String(position.department_serial_code).padStart(2, '0'),
          }))
          .filter((department) => department.name);

        setDepartments(options);
        setError('');
      })
      .catch((loadError) => {
        console.error(loadError);
        if (active) {
          setDepartments([]);
          setProgram('');
          setError('Unable to load departments for this election.');
        }
      });

    return () => {
      active = false;
    };
  }, [electionId]);

  async function loadElections() {

    const { data } = await apiClient.get('/elections');
    const availableElections = data.data.filter((election) => election.status !== 'closed');

    setElections(availableElections);
    setElectionId((currentElectionId) => (
      availableElections.some((election) => String(election.id) === currentElectionId)
        ? currentElectionId
        : ''
    ));

  }

  async function loadBallots() {

    const { data } = await apiClient.get('/ballots');

    setBallots(data.data);
    setSelectedBallots([]);

  }

  async function handleGenerate(e) {

    e.preventDefault();

    setError('');

    if (!electionId) {
      setError('Please select an election.');
      return;
    }

    if (!departments.some((department) => department.name === program)) {
      setError(program ? 'This election has no available Governor departments.' : 'Please select a department.');
      return;
    }

    if (!yearLevel) {
      setError('Please select the representative year on the ballot.');
      return;
    }

    setLoading(true);

    try {

      await apiClient.post('/ballots/generate', {
        election_id: Number(electionId),
        quantity: Number(batchSize),
        program,
        year_level: yearLevel,
      });

      await loadBallots();

    } catch (err) {

      setError(
        err.response?.data?.message ||
        'Failed to generate ballots.'
      );

    } finally {

      setLoading(false);

    }

  }

  function toggleSelectAll(e) {

    if (e.target.checked) {

      setSelectedBallots((selected) => Array.from(new Set([
        ...selected,
        ...filteredBallots.map((ballot) => ballot.id),
      ])));

    } else {

      const filteredIds = new Set(filteredBallots.map((ballot) => ballot.id));
      setSelectedBallots((selected) => selected.filter((id) => !filteredIds.has(id)));

    }

  }

  function toggleSelectOne(id) {

    setSelectedBallots(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );

  }

  async function handleDeleteSelected() {

    if (selectedBallots.length === 0) return;

    if (!window.confirm(`Delete ${selectedBallots.length} ballot(s)?`))
      return;

    try {

      await apiClient.post('/ballots/delete-multiple', {
        ids: selectedBallots,
      });

      await loadBallots();

    } catch (err) {

      alert(
        err.response?.data?.message ||
        'Delete failed.'
      );

    }

  }

  function handlePrintSelected() {

    if (selectedBallots.length === 0) return;

    navigate(`/ballots/print?ids=${selectedBallots.join(',')}`);

  }

  function handleDownloadPdfSelected() {

    if (selectedBallots.length === 0) return;

    const params = new URLSearchParams({
      ids: selectedBallots.join(','),
      pdf: '1',
    });

    const printUrl = `/ballots/print?${params.toString()}`;

    try {
      const printWindow = window.open(printUrl, '_blank', 'noopener,noreferrer');

      if (printWindow) {
        printWindow.focus();
      } else {
        navigate(printUrl);
      }
    } catch (err) {
      navigate(printUrl);
    }

    setPdfMode(false);
    setPdfBallots([]);
    setIsPreparingPdf(false);

  }

  function handlePrintNextBatch() {
    if (!electionId || loading) return;

    setLoading(true);

    const params = new URLSearchParams({
      next: '1',
      election_id: electionId,
      batch_size: String(batchSize),
      program,
      year_level: yearLevel,
    });

    navigate(`/ballots/print?${params.toString()}`);
  }

  function getStatus(status) {

    switch (status) {

      case 'issued':
        return {
          color: '#b45309',
          bg: '#FEF3C7',
          text: 'Generated'
        };

      case 'counted':
        return {
          color: '#166534',
          bg: '#DCFCE7',
          text: 'Counted'
        };

      case 'manual_review':
        return {
          color: '#c2410c',
          bg: '#FFEDD5',
          text: 'Manual Review'
        };

      case 'duplicate_rejected':
        return {
          color: '#991B1B',
          bg: '#FEE2E2',
          text: 'Rejected'
        };

      default:
        return {
          color: '#444',
          bg: '#eee',
          text: status
        };

    }

  }

  const selectedElectionId = electionId ? Number(electionId) : null;
  const selectedElectionBallots = selectedElectionId === null
    ? ballots
    : ballots.filter((ballot) => Number(ballot.election_id ?? ballot.election?.id) === selectedElectionId);
  const selectedElectionPrintedBallots = selectedElectionBallots.filter((ballot) => ballot.printed_at);
  const remainingBallots = selectedElectionBallots.length - selectedElectionPrintedBallots.length;
  const ballotDepartments = [...new Set(ballots.map((ballot) => ballot.program).filter(Boolean))].sort();
  const ballotYearLevels = [...new Set(ballots
    .filter((ballot) => !ballotDepartmentFilter || ballot.program === ballotDepartmentFilter)
    .map((ballot) => ballot.year_level)
    .filter(Boolean))]
    .sort((first, second) => yearLevels.indexOf(first) - yearLevels.indexOf(second));

  const filteredBallots = ballots.filter(ballot => {
    const matchesDepartment = !ballotDepartmentFilter || ballot.program === ballotDepartmentFilter;
    const matchesYearLevel = !ballotYearFilter || ballot.year_level === ballotYearFilter;

    const matchesSearch = `${ballot.serial_number} ${ballot.election?.title || ''}`
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesDepartment && matchesYearLevel && matchesSearch;

  });

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredBallots.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const visibleBallots = filteredBallots.slice(startIndex, startIndex + pageSize);
  const startItem = filteredBallots.length === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(startIndex + pageSize, filteredBallots.length);

  useEffect(() => {
    if (!selectAllRef.current) return;

    const selectedVisibleCount = filteredBallots.filter((ballot) => (
      selectedBallots.includes(ballot.id)
    )).length;

    selectAllRef.current.indeterminate = selectedVisibleCount > 0
      && selectedVisibleCount < filteredBallots.length;
  }, [filteredBallots, selectedBallots]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedBallots([]);
  }, [ballotDepartmentFilter, ballotYearFilter, search]);

  useEffect(() => {
    if (!pdfMode || selectedBallots.length === 0) return;

    async function loadPdfBallots() {
      try {
        const response = await apiClient.get('/ballots/print-selected', {
          params: { ids: selectedBallots.join(',') },
        });

        setPdfBallots(response.data.data || []);
        setIsPreparingPdf(response.data.data?.length > 0);
      } catch (err) {
        console.error(err);
        setIsPreparingPdf(false);
        setPdfMode(false);
      }
    }

    loadPdfBallots();
  }, [pdfMode, selectedBallots]);

  useEffect(() => {
    if (!pdfMode || pdfBallots.length === 0) return;

    const triggerPrint = () => {
      requestAnimationFrame(() => {
        window.print();
      });
    };

    const timer = setTimeout(() => {
      triggerPrint();
      setIsPreparingPdf(false);
    }, 400);

    const handleAfterPrint = () => {
      setPdfMode(false);
      setPdfBallots([]);
      setIsPreparingPdf(false);
    };

    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [pdfMode, pdfBallots]);

  const pdfPages = [];

  for (let i = 0; i < pdfBallots.length; i += 2) {
    pdfPages.push(pdfBallots.slice(i, i + 2));
  }

  if (pdfMode) {
    return (
      <div className="pdf-export-mode">
        {isPreparingPdf && pdfBallots.length === 0 ? (
          <div className="pdf-preparing-box">
            <h2>Preparing PDF...</h2>
            <p>Please wait while the selected ballots are loaded.</p>
          </div>
        ) : (
          <div className="ballot-container">
            {pdfPages.map((pageBallots, pageIndex) => (
              <div key={`pdf-page-${pageIndex}`} className="ballot-page">
                {pageBallots.map((ballot) => (
                  <div key={ballot.id} className="half-ballot">
                    <div className="registration-markers" aria-hidden="true">
                      <span className="registration-mark top-left" />
                      <span className="registration-mark top-right" />
                      <span className="registration-mark bottom-left" />
                      <span className="registration-mark bottom-right" />
                    </div>
                    <div className="ballot-header">
                      <img src={logo} alt="Electoral Committee" />
                      <h1>Office of the Student Electoral Committee</h1>
                      <p>Iloilo Science and Technology University Dumangas Campus</p>
                      <p>secisatudc2026@gmail.com</p>
                    </div>
                    <h2>{ballot.election.title}</h2>
                    <h3>OFFICIAL BALLOT</h3>

                    <div className="serial-number">
                      <strong>Ballot Serial No.:</strong> {ballot.serial_number}
                    </div>

                    <p className="instruction">Vote wisely!</p>
                    <hr />

                    <div className="ballot-positions">
                    {positionsForBallot(ballot.election.positions, ballot.serial_number).map((position) => (
                      <div key={position.id} className="position-small">
                        <strong>{position.name}</strong>
                        <div>Vote for {position.vote_for_count}</div>

                        {position.candidates?.map((candidate, index) => (
                          <div key={candidate.id} className="candidate-small">
                            <span className="shade-box"></span>
                            {index + 1}. {candidate.name}
                            {candidate.party && <span> ({candidate.party})</span>}
                          </div>
                        ))}
                      </div>
                    ))}
                    </div>

                    <hr />

                    <div className="center">
                      <small>Do not write anything else.</small>
                      <br />
                      <small>{ballot.serial_number}</small>
                      <p className="ballot-quote">
                        "Bad student leaders get elected when good citizens vote blindly."
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isInitialLoading) {
    return <LoadingSkeleton variant="ballots" label="Loading ballots" />;
  }

return (

  <div className="ballots-page">

    <header className="ballots-page-header">
      <div>
        <h1>Ballot Management</h1>
      </div>
    </header>

    {/* SUMMARY CARDS */}

    <div className="ballots-summary-grid ballots-management-summary-grid">

      <div className="ballots-summary-card">
        <span className="ballots-summary-icon"><Icon name="ballots" size={20} /></span>
        <div>
          <p>Total Ballots</p>
          <strong>{selectedElectionBallots.length}</strong>
        </div>
      </div>

      <div className="ballots-summary-card">
        <span className="ballots-summary-icon is-accent"><Icon name="print" size={20} /></span>
        <div>
          <p>Printed</p>
          <strong>{selectedElectionPrintedBallots.length}</strong>
        </div>
      </div>

      <div className="ballots-summary-card">
        <span className="ballots-summary-icon"><Icon name="list" size={20} /></span>
        <div>
          <p>Remaining</p>
          <strong>{remainingBallots}</strong>
        </div>
      </div>

    </div>

    {/* GENERATE */}

    <div className="ballots-generator-panel">

      <h2>Generate Ballots</h2>

      <form
        onSubmit={handleGenerate}
        className="inline-form"
      >

        <select
          value={electionId}
          onChange={(e) => {
            setElectionId(e.target.value);
            setProgram('');
            setYearLevel('');
          }}
          disabled={elections.length === 0}
          required
          style={{
            maxWidth: "420px",
            minWidth: "100px"
          }}
        >
          <option value="" disabled>
            {elections.length === 0 ? 'No open elections available' : 'Select Election'}
          </option>
          {elections.map(election => (
            <option
              key={election.id}
              value={election.id}
            >
              {election.title}
            </option>

          ))}

        </select>

        <label>
          Department
          <select
            value={program}
            onChange={(e) => setProgram(e.target.value)}
            disabled={departments.length === 0}
            required
          >
            <option value="" disabled>Select a department</option>
            {departments.map((department) => (
              <option key={department.code} value={department.name}>{department.name}</option>
            ))}
          </select>
        </label>

        <label>
          Representative Year on Ballot
          <select
            value={yearLevel}
            onChange={(e) => setYearLevel(e.target.value)}
            disabled={!electionId || !program}
            required
          >
            <option value="" disabled>Select a year level</option>
            {yearLevels.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>

        <label>
          Number of Ballots to Generate
          <input
            type="number"
            min="1"
            max="100"
            value={batchSize}
            onChange={(e) => setBatchSize(Math.min(100, Math.max(1, Number(e.target.value))))}
            style={{
              maxWidth: "110px"
            }}
          />
        </label>

        <button
          type="submit"
          className="upload-photo-style-button"
          disabled={loading || !electionId}
        >
          {loading
            ? "Generating..."
            : "Generate Ballot"}
        </button>

        <button
          type="button"
          className="upload-photo-style-button"
          onClick={handlePrintNextBatch}
          disabled={!electionId || loading}
        >
          Print Generated Ballots
        </button>

      </form>

    </div>

    {/* TOOLS */}

    <div className="ballots-toolbar-panel">

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center"
        }}
      >

        <label className="ballot-list-filter">
          <span>Department</span>
          <select
            value={ballotDepartmentFilter}
            onChange={(e) => {
              setBallotDepartmentFilter(e.target.value);
              setBallotYearFilter('');
            }}
          >
            <option value="">All departments</option>
            {ballotDepartments.map((department) => (
              <option key={department} value={department}>{department}</option>
            ))}
          </select>
        </label>

        <label className="ballot-list-filter">
          <span>Year level</span>
          <select
            value={ballotYearFilter}
            onChange={(e) => setBallotYearFilter(e.target.value)}
          >
            <option value="">All year levels</option>
            {ballotYearLevels.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>

        <input
          type="text"
          placeholder="Search for serial number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            maxWidth: "360px"
          }}
        />

      

        <button
          onClick={handlePrintSelected}
          disabled={selectedBallots.length === 0}
        >
          Print Selected
        </button>

        <button
          onClick={handleDeleteSelected}
          disabled={selectedBallots.length === 0}
          className="danger-button"
        >
          Delete Selected
        </button>

      </div>

    </div>

    {/* TABLE */}

    <div className="table-shell">

    <table className="data-table">

      <thead>

        <tr>

          <th>

            {filteredBallots.length > 0 && (
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={filteredBallots.every((ballot) => selectedBallots.includes(ballot.id))}
                onChange={toggleSelectAll}
                aria-label="Select all printed ballots"
              />
            )}

          </th>

          <th>Serial Number</th>
          <th>Election</th>
          <th>Status</th>
          <th>Generated</th>
          <th>Action</th>

        </tr>

      </thead>

      <tbody>

          {visibleBallots.length > 0 ? (

          visibleBallots.map(ballot => {

            const status = getStatus(ballot.status);

            return (

              <tr key={ballot.id}>

                <td>

                  <input
                    type="checkbox"
                    checked={selectedBallots.includes(ballot.id)}
                    onChange={() =>
                      toggleSelectOne(ballot.id)
                    }
                  />

                </td>

                <td>{ballot.serial_number}</td>

                <td>{ballot.election?.title}</td>

                <td>

                  <span
                    className="badge"
                    style={{
                      background: status.bg,
                      color: status.color,
                      padding: "4px 8px",
                      borderRadius: "3px",
                      fontWeight: "600"
                    }}
                  >
                    {status.text}
                  </span>

                </td>

                <td>

                  {ballot.generated_at
                    ? new Date(ballot.generated_at).toLocaleString()
                    : "—"}

                </td>

                <td>

                  <button
                    className="upload-photo-style-button"
                    onClick={() =>
                      navigate(`/ballots/${ballot.id}/print`)
                    }
                  >
                    Print
                  </button>

                </td>

              </tr>

            );

          })

        ) : (

          <tr>

            <td
              colSpan="6"
              style={{
                textAlign: "center",
                padding: "25px"
              }}
            >
              No ballots found.
            </td>

          </tr>

        )}

      </tbody>

    </table>

    </div>

    <PaginationControls
      currentPage={safeCurrentPage}
      totalPages={totalPages}
      totalItems={filteredBallots.length}
      startItem={startItem}
      endItem={endItem}
      onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
      onNext={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
    />

  </div>

);

}
