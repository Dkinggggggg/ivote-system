import React from 'react';

function Block({ className = '', style }) {
  return <div className={`skeleton-block ${className}`.trim()} style={style} aria-hidden="true" />;
}

function Rows({ count = 6, className = '' }) {
  return Array.from({ length: count }, (_, index) => (
    <Block className={`skeleton-row ${className}`.trim()} key={index} />
  ));
}

function TableRows({ count = 6 }) {
  return (
    <div className="skeleton-table-rows">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-table-row" key={index}>
          <Block className="skeleton-cell skeleton-cell-sm" />
          <Block className="skeleton-cell skeleton-cell-lg" />
          <Block className="skeleton-cell skeleton-cell-md" />
          <Block className="skeleton-cell skeleton-cell-md" />
          <Block className="skeleton-cell skeleton-cell-sm" />
        </div>
      ))}
    </div>
  );
}

function SummaryCards({ count = 4, className = '' }) {
  return (
    <div className={`skeleton-summary-grid skeleton-summary-grid-${count} ${className}`.trim()}>
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-summary-card" key={index}>
          <Block className="skeleton-summary-icon" />
          <div className="skeleton-summary-copy">
            <Block className="skeleton-summary-label" />
            <Block className="skeleton-summary-value" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PageHeader({ withAction = false, wide = false }) {
  return (
    <div className="skeleton-page-header">
      <Block className={`skeleton-page-title ${wide ? 'is-wide' : ''}`.trim()} />
      {withAction ? <Block className="skeleton-header-action" /> : null}
    </div>
  );
}

function Panel({ title = true, children, className = '' }) {
  return (
    <div className={`skeleton-panel ${className}`.trim()}>
      {title ? <Block className="skeleton-section-title" /> : null}
      {children}
    </div>
  );
}

function ToolbarPanel({ inputs = 2, className = '' }) {
  return (
    <div className={`skeleton-panel skeleton-toolbar-panel ${className}`.trim()}>
      <div className="skeleton-toolbar-controls">
        {Array.from({ length: inputs }, (_, index) => (
          <Block className={`skeleton-input ${index === 0 ? 'is-grow' : ''}`.trim()} key={index} />
        ))}
      </div>
    </div>
  );
}

function FormPanel({ fields = 4, button = true }) {
  return (
    <Panel className="skeleton-form-panel">
      <div className="skeleton-form-grid">
        {Array.from({ length: fields }, (_, index) => (
          <Block className="skeleton-input" key={index} />
        ))}
      </div>
      {button ? <div className="skeleton-form-actions"><Block className="skeleton-button" /></div> : null}
    </Panel>
  );
}

function TablePanel({ rows = 6, toolbar = false }) {
  return (
    <Panel className="skeleton-table-panel">
      {toolbar ? (
        <div className="skeleton-inline-toolbar">
          <Block className="skeleton-input is-grow" />
          <Block className="skeleton-button" />
        </div>
      ) : null}
      <div className="skeleton-table-head">
        <Block /><Block /><Block /><Block /><Block />
      </div>
      <TableRows count={rows} />
    </Panel>
  );
}

function ManagementPageSkeleton({ summaryCount = 4, panels = ['form', 'table'], headerAction = false, tableRows = 6 }) {
  return (
    <>
      <PageHeader withAction={headerAction} wide />
      <SummaryCards count={summaryCount} />
      {panels.map((panel, index) => {
        if (panel === 'form') return <FormPanel key={`panel-${index}`} />;
        if (panel === 'toolbar') return <ToolbarPanel key={`panel-${index}`} />;
        if (panel === 'table-toolbar') return <TablePanel key={`panel-${index}`} rows={tableRows} toolbar />;
        return <TablePanel key={`panel-${index}`} rows={tableRows} />;
      })}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="skeleton-dashboard-header">
        <div className="skeleton-dashboard-title-block">
          <Block className="skeleton-kicker" />
          <Block className="skeleton-page-title is-wide" />
          <Block className="skeleton-page-subtitle" />
        </div>
        <div className="skeleton-dashboard-selector">
          <Block className="skeleton-input" />
          <Block className="skeleton-input" />
        </div>
      </div>
      <SummaryCards count={4} />
      <Panel title={false} className="skeleton-dashboard-overview">
        <Block className="skeleton-section-title skeleton-title-sm" />
        <div className="skeleton-dashboard-info-grid">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="skeleton-info-tile" key={index}>
              <Block className="skeleton-summary-icon" />
              <div className="skeleton-summary-copy">
                <Block className="skeleton-summary-label" />
                <Block className="skeleton-summary-value" />
              </div>
            </div>
          ))}
        </div>
        <div className="skeleton-progress-panel">
          <div className="skeleton-progress-meta"><Block /><Block /></div>
          <Block className="skeleton-progress-bar" />
        </div>
      </Panel>
      <div className="skeleton-dashboard-bottom">
        <Panel><Block className="skeleton-input" /></Panel>
        <Panel><Rows count={3} /></Panel>
      </div>
    </>
  );
}

function BallotsSkeleton() {
  return (
    <>
      <PageHeader wide />
      <SummaryCards count={4} />
      <FormPanel fields={4} />
      <ToolbarPanel inputs={4} />
      <TablePanel rows={8} />
    </>
  );
}

function ElectionsSkeleton() {
  return (
    <>
      <PageHeader wide />
      <SummaryCards count={4} />
      <FormPanel fields={2} />
      <TablePanel rows={4} />
      <TablePanel rows={4} />
    </>
  );
}

function UsersSkeleton() {
  return (
    <>
      <PageHeader withAction wide />
      <SummaryCards count={3} />
      <ToolbarPanel inputs={3} />
      <TablePanel rows={8} />
    </>
  );
}

function AuditSkeleton() {
  return (
    <>
      <PageHeader wide />
      <SummaryCards count={3} />
      <ToolbarPanel inputs={2} />
      <TablePanel rows={8} />
    </>
  );
}

function ReportsSkeleton() {
  return (
    <>
      <div className="skeleton-page-header skeleton-page-header-report">
        <Block className="skeleton-page-title is-wide" />
        <div className="skeleton-header-actions">
          <Block className="skeleton-button" />
          <Block className="skeleton-button" />
        </div>
      </div>
      <ToolbarPanel inputs={2} />
      <SummaryCards count={3} />
      <TablePanel rows={8} />
    </>
  );
}

function PositionsSkeleton() {
  return (
    <>
      <Block className="skeleton-back-link" />
      <div className="skeleton-page-header">
        <div className="skeleton-title-stack">
          <Block className="skeleton-kicker" />
          <Block className="skeleton-page-title is-wide" />
        </div>
        <Block className="skeleton-chip" />
      </div>
      <SummaryCards count={1} className="skeleton-summary-grid-compact" />
      <FormPanel fields={3} />
      <TablePanel rows={6} />
    </>
  );
}

function CandidatesManagementSkeleton() {
  return (
    <>
      <div className="skeleton-page-header">
        <Block className="skeleton-page-title is-wide" />
        <div className="skeleton-header-actions">
          <Block className="skeleton-input skeleton-select" />
          <Block className="skeleton-button" />
        </div>
      </div>
      <Panel className="skeleton-form-panel">
        <Block className="skeleton-section-title" />
        <div className="skeleton-form-actions"><Block className="skeleton-button" /></div>
      </Panel>
      <Panel className="skeleton-table-panel">
        <div className="skeleton-inline-toolbar">
          <Block className="skeleton-input" />
          <Block className="skeleton-input" />
          <Block className="skeleton-input is-grow" />
        </div>
        <TableRows count={7} />
      </Panel>
    </>
  );
}

function PartyListSkeleton() {
  return (
    <>
      <div className="skeleton-page-header">
        <Block className="skeleton-page-title is-wide" />
        <div className="skeleton-header-actions">
          <Block className="skeleton-input skeleton-select" />
          <Block className="skeleton-button" />
        </div>
      </div>
      <Panel><Rows count={4} /></Panel>
      <Panel><Rows count={5} /></Panel>
      <Panel><Rows count={4} /></Panel>
    </>
  );
}

function ReviewSkeleton() {
  return (
    <>
      <div className="skeleton-page-header">
        <Block className="skeleton-page-title is-wide" />
        <div className="skeleton-header-actions">
          <Block className="skeleton-input skeleton-select" />
          <Block className="skeleton-button" />
        </div>
      </div>
      <SummaryCards count={5} />
      <div className="skeleton-review-grid">
        <Panel><Rows count={6} /></Panel>
        <Panel><Rows count={5} /></Panel>
      </div>
      <div className="skeleton-review-actions">
        <Block className="skeleton-button" />
        <Block className="skeleton-button" />
        <Block className="skeleton-button" />
      </div>
    </>
  );
}

function ScannerSkeleton() {
  return (
    <>
      <div className="skeleton-page-header">
        <div className="skeleton-title-stack">
          <Block className="skeleton-page-title is-wide" />
          <Block className="skeleton-page-subtitle" />
        </div>
        <Block className="skeleton-button" />
      </div>
      <ToolbarPanel inputs={1} />
      <SummaryCards count={4} />
      <TablePanel rows={8} />
    </>
  );
}

function ResultsSkeleton() {
  return (
    <>
      <div className="skeleton-results-topbar"><Block /><Block /></div>
      <div className="skeleton-results-hero"><Block className="skeleton-hero-title" /><Block className="skeleton-hero-mark" /></div>
      <SummaryCards count={4} />
      <div className="skeleton-results-grid">
        <Panel><Rows count={6} className="skeleton-result-row" /></Panel>
        <Panel><Rows count={4} /></Panel>
      </div>
    </>
  );
}

function SettingsSkeleton() {
  return (
    <>
      <PageHeader wide />
      <SummaryCards count={3} />
      <Panel><Rows count={5} /></Panel>
      <Panel><Rows count={3} /><div className="skeleton-form-actions"><Block className="skeleton-button" /></div></Panel>
    </>
  );
}

function VerifySkeleton() {
  return (
    <>
      <Block className="skeleton-page-title" />
      <div className="skeleton-status-card">
        <Block className="skeleton-section-title" />
        <Block className="skeleton-status-copy" />
      </div>
      <Panel className="skeleton-detail-panel" title={false}><Rows count={4} /></Panel>
      <Panel><Rows count={3} /></Panel>
    </>
  );
}

function ElectionDetailsSkeleton() {
  return (
    <>
      <div className="skeleton-details-summary"><Block /><Block /><Block /></div>
      <Block className="skeleton-details-heading" />
      <div className="skeleton-details-position">
        <Block className="skeleton-details-position-title" />
        <Rows count={3} />
      </div>
      <div className="skeleton-details-position">
        <Block className="skeleton-details-position-title" />
        <Rows count={2} />
      </div>
    </>
  );
}

function PrintSkeleton({ variant }) {
  const pages = variant === 'print' ? 2 : 1;
  return (
    <>
      <div className="skeleton-print-toolbar">
        <Block className="skeleton-button" />
        <Block className="skeleton-button" />
      </div>
      <div className={`skeleton-ballot-sheets skeleton-ballot-sheets-${pages}`}>
        {Array.from({ length: pages }, (_, index) => (
          <div className="skeleton-ballot-sheet" key={index}>
            <Block className="skeleton-sheet-title" />
            <Block className="skeleton-sheet-meta" />
            <Rows count={variant === 'print' ? 4 : 5} className="skeleton-ballot-row" />
          </div>
        ))}
      </div>
    </>
  );
}

function DefaultSkeleton() {
  return (
    <>
      <PageHeader wide />
      <Panel><Rows count={8} /></Panel>
    </>
  );
}

export default function LoadingSkeleton({ variant = 'table', label = 'Loading' }) {
  let content;

  switch (variant) {
    case 'dashboard':
      content = <DashboardSkeleton />;
      break;
    case 'ballots':
      content = <BallotsSkeleton />;
      break;
    case 'elections':
      content = <ElectionsSkeleton />;
      break;
    case 'users':
      content = <UsersSkeleton />;
      break;
    case 'audit':
      content = <AuditSkeleton />;
      break;
    case 'report':
    case 'reports':
      content = <ReportsSkeleton />;
      break;
    case 'positions':
      content = <PositionsSkeleton />;
      break;
    case 'candidates':
      content = <CandidatesManagementSkeleton />;
      break;
    case 'party-list':
      content = <PartyListSkeleton />;
      break;
    case 'review':
      content = <ReviewSkeleton />;
      break;
    case 'scanner':
      content = <ScannerSkeleton />;
      break;
    case 'results':
      content = <ResultsSkeleton />;
      break;
    case 'settings':
      content = <SettingsSkeleton />;
      break;
    case 'verify':
      content = <VerifySkeleton />;
      break;
    case 'election-details':
      content = <ElectionDetailsSkeleton />;
      break;
    case 'ballot':
    case 'print':
      content = <PrintSkeleton variant={variant} />;
      break;
    case 'table':
    case 'management':
      content = <ManagementPageSkeleton />;
      break;
    default:
      content = <DefaultSkeleton />;
      break;
  }

  return (
    <div className={`loading-skeleton loading-skeleton-${variant}`} role="status" aria-live="polite" aria-busy="true" aria-label={label}>
      {content}
    </div>
  );
}
