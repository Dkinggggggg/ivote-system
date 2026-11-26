import React, { useEffect, useState } from 'react';
import apiClient from '../api/apiClient';
import Icon from '../components/Icon';
import LoadingSkeleton from '../components/LoadingSkeleton';
import logo from '../assets/logo.png';

export default function ReportsPage() {

  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState('');
  const [precincts, setPrecincts] = useState([]);
  const [selectedPrecinct, setSelectedPrecinct] = useState('all');
  const [report, setReport] = useState(null);
  const [electionsLoading, setElectionsLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedWinnerCategories, setExpandedWinnerCategories] = useState({});

  useEffect(() => {
    loadElections();
  }, []);

  useEffect(() => {
    let active = true;

    apiClient.get('/precincts')
      .then(({ data }) => {
        const options = (data.data || []).map((precinct) => ({
          id: String(precinct.id),
          label: `Precinct ${precinct.precinct_number || precinct.id} · ${precinct.room}`,
        }));
        if (active) setPrecincts(options);
      })
      .catch(() => {
        if (active) setPrecincts([]);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (selectedElection) {
      loadResults(selectedElection, selectedPrecinct);
    } else {
      setReport(null);
      setReportLoading(false);
    }
  }, [selectedElection, selectedPrecinct]);

  useEffect(() => {
    setExpandedWinnerCategories({});
  }, [selectedElection]);

  async function loadElections() {

    try {
      setElectionsLoading(true);
      setError('');

      const { data } = await apiClient.get('/elections');

      const list = data.data ?? data;

      setElections(list);

    } catch (err) {

      console.error(err);
      setError('Unable to load elections.');

    } finally {
      setElectionsLoading(false);
    }

  }

  async function loadResults(id, precinct) {

    setReportLoading(true);
    setError('');

    try {

      const { data } = await apiClient.get('/reports/winners', {
        params: {
          election_id: id,
          ...(precinct !== 'all' ? { precinct_id: precinct } : {}),
        },
      });

      setReport(data);

    } catch (err) {

      console.error(err);
      setError('Unable to load election results.');
      setReport(null);

    } finally {

      setReportLoading(false);

    }

  }

  const winnerCategoryOrder = ['executive officers', 'senators', 'governors', 'batch representatives'];
  const reportRows = [...(report?.results || [])].sort((first, second) => {
    const firstCategory = (first.category || 'Uncategorized').trim().toLowerCase();
    const secondCategory = (second.category || 'Uncategorized').trim().toLowerCase();
    const firstOrder = winnerCategoryOrder.indexOf(firstCategory);
    const secondOrder = winnerCategoryOrder.indexOf(secondCategory);
    return (firstOrder === -1 ? winnerCategoryOrder.length : firstOrder)
      - (secondOrder === -1 ? winnerCategoryOrder.length : secondOrder);
  });
  const winnerGroups = [];
  reportRows.forEach((item) => {
    const category = item.category || 'Uncategorized';
    let group = winnerGroups[winnerGroups.length - 1];

    if (!group || group.category !== category) {
      group = { category, rows: [] };
      winnerGroups.push(group);
    }

    group.rows.push(item);
  });

  async function downloadCSV() {

    try {

      const { data } = await apiClient.get(
        '/reports/results',
        {
          params: {
            election_id: selectedElection,
            ...(selectedPrecinct !== 'all' ? { precinct: selectedPrecinct } : {}),
          },
          responseType: 'blob',
        }
      );

      const url = window.URL.createObjectURL(
        new Blob([data], { type: 'text/csv' })
      );

      const link = document.createElement('a');

      link.href = url;
      link.download = 'official-election-results.csv';
      link.click();

      window.URL.revokeObjectURL(url);

    } catch {

      setError('Failed to download report.');

    }

  }

  async function downloadPDF() {
    if (!report) return;

    let jsPDF;
    let autoTable;
    try {
      [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
    } catch (err) {
      console.error(err);
      setError('Failed to load PDF export.');
      return;
    }

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const generatedAt = new Date().toLocaleString();
    const pdfRows = [];

    pdf.addImage(logo, 'PNG', 18, 9, 16, 16);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text('Office of the Student Electoral Committee', pageWidth / 2, 18, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.text('Iloilo Science and Technology University Dumangas Campus', pageWidth / 2, 27, { align: 'center' });
    pdf.text('secisatudc2026@gmail.com', pageWidth / 2, 32, { align: 'center' });
    let previousCategory = null;

    (report.results || []).forEach((item) => {
      const category = item.category || 'Uncategorized';
      if (category !== previousCategory) {
        pdfRows.push([{
          content: category,
          colSpan: 5,
          styles: { fillColor: [238, 245, 252], textColor: [22, 67, 126], fontStyle: 'bold' },
        }]);
        previousCategory = category;
      }

      pdfRows.push([
        item.position || '',
        item.standing ? `#${item.standing}` : '-',
        item.winner || 'No winner',
        item.party || 'Independent',
        String(item.votes ?? 0),
      ]);
    });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('OFFICIAL ELECTION RESULTS', pageWidth / 2, 43, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Election: ${report.election}`, 14, 55);
    pdf.text(`Precinct: ${report.precinct || 'All Precincts'}`, 14, 62);
    pdf.text(`Date Generated: ${generatedAt}`, pageWidth - 14, 62, { align: 'right' });

    autoTable(pdf, {
      startY: 52,
      head: [['Position', 'Standing', 'Winner', 'Party', 'Votes']],
      body: pdfRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 76, 129], textColor: 255 },
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 },
      margin: { left: 14, right: 14 },
    });

    let signatureY = pdf.lastAutoTable.finalY + 28;
    if (signatureY + 20 > pageHeight - 14) {
      pdf.addPage();
      signatureY = 45;
    }

    const signatureWidth = 70;
    const leftSignatureX = 18;
    const centerSignatureX = pageWidth / 2 - signatureWidth / 2;
    const rightSignatureX = pageWidth - signatureWidth - 18;
    pdf.setDrawColor(0);
    pdf.line(leftSignatureX, signatureY, leftSignatureX + signatureWidth, signatureY);
    pdf.line(centerSignatureX, signatureY, centerSignatureX + signatureWidth, signatureY);
    pdf.line(rightSignatureX, signatureY, rightSignatureX + signatureWidth, signatureY);
    pdf.setFontSize(8.5);
    pdf.text('SEC CHAIRPERSON', leftSignatureX + signatureWidth / 2, signatureY + 6, { align: 'center' });
    pdf.text('HEAD, OSAS', centerSignatureX + signatureWidth / 2, signatureY + 6, { align: 'center' });
    pdf.text('SEC ADVISER', rightSignatureX + signatureWidth / 2, signatureY + 6, { align: 'center' });

    const fileStem = String(report.election || 'election')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    pdf.save(`${fileStem || 'election'}-official-results.pdf`);
  }

  function printResults() {

    if (!report) return;

    const printWindow = window.open('', '', 'width=1000,height=900');

    let previousCategory = null;
    const rows = report.results.map(item => {
      const category = item.category || 'Uncategorized';
      const heading = category !== previousCategory
        ? `<tr class="category-heading"><td colspan="5">${category}</td></tr>`
        : '';
      previousCategory = category;

      return `${heading}
      <tr>
        <td>${item.position}</td>
        <td style="text-align:center">${item.standing ? `#${item.standing}` : '-'}</td>
        <td>${item.winner}</td>
        <td>${item.party}</td>
        <td style="text-align:center">${item.votes}</td>
      </tr>
    `;
    }).join('');

    printWindow.document.write(`
<html>

<head>

<title>Official Election Results</title>

<style>

@page{
size:A4 portrait;
margin:8mm;
}

body{
font-family:Arial,sans-serif;
padding:0;
margin:0;
color:#000;
font-size:9pt;
}

.print-page{
display:flow-root;
}

.ballot-header {
  text-align: center;
  line-height: 1.15;
  margin-bottom: 5px;
}

.ballot-header img {
  width: 58px;
  height: 58px;
  object-fit: contain;
}

.ballot-header h1 {
  font-size: 15px;
  margin: 2px 0;
}

.ballot-header p {
  font-size: 9px;
  margin: 1px 0;
}

.ballot-header p:first-of-type {
  font-size: 15px;
}

.ballot-header p:not(:first-of-type) {
  font-size: 10px;
}

h1{
text-align:center;
font-size:16pt;
margin:0 0 3px;
}

h2{
text-align:center;
font-size:10pt;
margin:0 0 12px;
font-weight:normal;
}

.info{
display:flex;
justify-content:space-between;
gap:12px;
margin-bottom:8px;
}

.info p{
margin:2px 0;
font-size:9pt;
}

table{
width:100%;
border-collapse:collapse;
margin-top:6px;
font-size:8pt;
}

th{
background:#0f4c81;
color:white;
padding:4px 6px;
border:1px solid #000;
}

td{
padding:3px 6px;
border:1px solid #000;
}

.category-heading td{
background:#eef5fc;
color:#16437e;
font-weight:bold;
text-transform:uppercase;
}

.summary{
display:flex;
gap:24px;
margin-top:10px;
width:auto;
}

.summary p{
margin:2px 0;
}

.signature{
display:flex;
justify-content:space-around;
gap:32px;
margin-top:18px;
}

.sign{
width:220px;
text-align:center;
}

.line{
margin-top:24px;
border-top:1px solid black;
padding-top:4px;
}

.footer{
margin-top:12px;
text-align:center;
font-size:8pt;
}

tr,.summary,.signature{
break-inside:avoid;
}

</style>

</head>

<body>

<main class="print-page">

<div class="ballot-header">
  <img src="${logo}" alt="Electoral Committee" />
  <h1>Office of the Student Electoral Committee</h1>
  <p>Iloilo Science and Technology University Dumangas Campus</p>
  <p>secisatudc2026@gmail.com</p>
</div>

<h1>OFFICIAL ELECTION RESULTS</h1>

<div class="info">

<p><strong>Election:</strong> ${report.election}</p>

<p><strong>Precinct:</strong> ${report.precinct || 'All Precincts'}</p>

<p><strong>Date Generated:</strong> ${new Date().toLocaleString()}</p>

</div>

<table>

<thead>

<tr>

<th>Position</th>

<th>Standing</th>

<th>Winner</th>

<th>Party</th>

<th>Votes</th>

</tr>

</thead>

<tbody>

${rows}
</tbody>

</table>

<div class="signature">

<div class="sign">

<div class="line">
SEC CHAIRPERSON
</div>

</div>

<div class="sign">

<div class="line">
HEAD, OSAS
</div>

</div>

<div class="sign">

<div class="line">
SEC ADVISER
</div>

</div>

</div>

</main>

</body>

</html>
    `);

    printWindow.document.close();

    setTimeout(() => {
      const printPage = printWindow.document.querySelector('.print-page');
      const printableHeight = 281 * 96 / 25.4;
      const contentHeight = printPage.scrollHeight;

      if (contentHeight > printableHeight) {
        const scale = (printableHeight / contentHeight) * 0.98;
        printPage.style.zoom = String(scale);
        printPage.style.width = `${100 / scale}%`;
      }

      printWindow.print();
      printWindow.close();
    }, 500);

  }

  if (electionsLoading) {
    return <LoadingSkeleton variant="report" label="Loading official election results" />;
  }

  return (

    <div className="reports-page">

      <header className="reports-page-header">
        <div>
          <h1>Official Election Results</h1>
        </div>

        <div className="reports-export-actions">

          <button
            className="btn link-button"
            onClick={downloadCSV}
            disabled={!report || reportLoading}
          >
            <Icon name="download" size={16} /> Download CSV
          </button>

          <button
            className="btn link-button"
            onClick={downloadPDF}
            disabled={!report || reportLoading}
          >
            <Icon name="download" size={16} /> Download PDF
          </button>

          <button
            className="btn btn-primary"
            onClick={printResults}
            disabled={!report || reportLoading}
          >
            <Icon name="print" size={16} /> Print Results
          </button>

      </div>
      </header>

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      <section className="reports-filter-panel">

        <div className="reports-filter-heading">
          <strong>Election Report</strong>
        </div>

        <div className="reports-filter-controls">

            <label className="reports-filter-field">
              <select
              className="form-control"
              value={selectedElection}
              onChange={(e) => setSelectedElection(e.target.value)}
              style={{ width: "100%", marginBottom: "12px" }}
            >
              <option value="" disabled>
                {elections.length > 0 ? 'Choose an election…' : 'No elections available'}
              </option>

              {elections.map((election) => (
                <option key={election.id} value={election.id}>
                  {election.title}
                </option>
              ))}
            </select>
            </label>

            <label className="reports-filter-field">
            <select
              className="form-control"
              value={selectedPrecinct}
              onChange={(e) => setSelectedPrecinct(e.target.value)}
              disabled={!selectedElection || precincts.length === 0 || reportLoading}
              aria-label="Filter results by precinct"
              style={{ width: "100%" }}
            >
              <option value="all">All Precincts</option>
              {precincts.map((precinct) => (
                <option key={precinct.id} value={precinct.id}>{precinct.label}</option>
              ))}
            </select>
            </label>

        </div>

      </section>

      {reportLoading && selectedElection && (
        <div className="loading-skeleton loading-skeleton-report-content" role="status" aria-live="polite" aria-busy="true" aria-label="Loading report data">
          <div className="skeleton-summary-grid skeleton-summary-grid-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="skeleton-summary-card" key={index}>
                <div className="skeleton-block skeleton-summary-icon" aria-hidden="true" />
                <div className="skeleton-summary-copy">
                  <div className="skeleton-block skeleton-summary-label" aria-hidden="true" />
                  <div className="skeleton-block skeleton-summary-value" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
          <div className="skeleton-panel skeleton-table-panel">
            <div className="skeleton-block skeleton-section-title" aria-hidden="true" />
            <div className="skeleton-table-head" aria-hidden="true">
              <div className="skeleton-block" /><div className="skeleton-block" /><div className="skeleton-block" /><div className="skeleton-block" /><div className="skeleton-block" />
            </div>
            <div className="skeleton-table-rows">
              {Array.from({ length: 8 }, (_, index) => (
                <div className="skeleton-table-row" key={index}>
                  <div className="skeleton-block skeleton-cell skeleton-cell-sm" aria-hidden="true" />
                  <div className="skeleton-block skeleton-cell skeleton-cell-lg" aria-hidden="true" />
                  <div className="skeleton-block skeleton-cell skeleton-cell-md" aria-hidden="true" />
                  <div className="skeleton-block skeleton-cell skeleton-cell-md" aria-hidden="true" />
                  <div className="skeleton-block skeleton-cell skeleton-cell-sm" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!reportLoading && report && (
        <>
          <div className="reports-summary-grid">

            <ReportMetric label="Ballots" value={report.total_ballots} borderColor="var(--primary-2)" icon="ballots" />
            <ReportMetric
              label="Valid Ballots"
              value={report.valid_ballots}
              valueColor="var(--text)"
              borderColor="var(--warning)"
              icon="check"
            />
            <ReportMetric
              label="Invalid Ballots"
              value={report.invalid_ballots}
              valueColor="var(--text)"
              borderColor="var(--primary-2)"
              icon="review"
            />

          </div>

          <section className="reports-winners-panel">

            <div className="reports-winners-header">

              <h2 className="text-xl font-semibold">
                Official Winners
              </h2>

              <span style={{ color: "var(--muted)", fontSize: "14px" }}>
                {reportRows.length} record{reportRows.length === 1 ? "" : "s"}
              </span>

            </div>

            <div className="table-shell reports-table-shell">

              <table className="data-table" style={{ minWidth: "760px" }}>

                <thead>

                  <tr>

                    <th style={{ textAlign: "left" }}>
                      Position
                    </th>

                    <th style={{ textAlign: "center" }}>
                      Standing
                    </th>

                    <th style={{ textAlign: "left" }}>
                      Winner
                    </th>

                    <th style={{ textAlign: "left" }}>
                      Party
                    </th>

                    <th style={{ textAlign: "center" }}>
                      Votes
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {winnerGroups.flatMap((group) => {
                    const isExpanded = Boolean(expandedWinnerCategories[group.category]);

                    return [
                    <tr key={`${group.category}-heading`}>
                      <td
                        colSpan={5}
                        style={{ padding: 0, background: '#eef5fc', color: '#16437e' }}
                      >
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => setExpandedWinnerCategories((current) => ({
                            ...current,
                            [group.category]: !current[group.category],
                          }))}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', padding: '12px 16px', border: 0, background: 'transparent', color: '#16437e', font: 'inherit', fontWeight: 700, textAlign: 'left', textTransform: 'uppercase', cursor: 'pointer' }}
                        >
                          <span>{group.category}</span>
                          <span aria-hidden="true"><Icon name={isExpanded ? 'chevronDown' : 'chevronRight'} size={15} /></span>
                        </button>
                      </td>
                    </tr>,
                    ...(isExpanded ? group.rows.map((item, index) => (
                      <tr key={`${group.category}-${item.position}-${item.winner}-${index}`} style={{ borderTop: "1px solid #EEF2F5" }}>
                        <td>{item.position}</td>
                        <td style={{ textAlign: "center", fontWeight: 700 }}>
                          {item.standing ? `#${item.standing}` : "-"}
                        </td>
                        <td style={{ fontWeight: 600 }}>{item.winner}</td>
                        <td>{item.party}</td>
                        <td style={{ textAlign: "center", fontWeight: 700 }}>{item.votes}</td>
                      </tr>
                    )) : []),
                  ];
                  })}

                </tbody>

              </table>

            </div>

          </section>

        </>
      )}

    </div>

  );

}

function ReportMetric({ label, value, valueColor, borderColor = "var(--primary-2)", icon }) {
  return (
    <div className="reports-summary-card" style={{ borderLeft: `3px solid ${borderColor}` }}>
      <span className="reports-summary-icon" style={{ color: borderColor }}>
        <Icon name={icon} size={20} />
      </span>
      <div>
        <div style={{ color: "var(--muted)", fontSize: "12px", marginBottom: "2px" }}>
          {label}
        </div>
        <div style={{ fontSize: "24px", lineHeight: "1", fontWeight: 700, color: valueColor || "var(--primary)" }}>
          {value}
        </div>
      </div>
    </div>
  );
}
