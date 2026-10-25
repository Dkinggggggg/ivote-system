import React from 'react';

function Block({ className = '' }) {
  return <div className={`skeleton-block ${className}`} />;
}

function Rows({ count = 6, className = '' }) {
  return Array.from({ length: count }, (_, index) => (
    <Block className={`skeleton-content-row ${className}`} key={index} />
  ));
}

function StatCards({ count = 3 }) {
  return (
    <div className="skeleton-stat-grid">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-stat-card" key={index}>
          <Block className="skeleton-stat-label" />
          <Block className="skeleton-stat-value" />
        </div>
      ))}
    </div>
  );
}

function ManagementSkeleton({ variant }) {
  const stats = variant === 'ballot-management' ? 4 : 3;

  return (
    <>
      <Block className="skeleton-page-title" />
      <Block className="skeleton-page-subtitle" />
      <StatCards count={stats} />
      <div className="skeleton-panel skeleton-form-panel">
        <Block className="skeleton-section-title" />
        <div className="skeleton-form-grid"><Block /><Block /><Block /><Block className="skeleton-button" /></div>
      </div>
      <div className="skeleton-panel skeleton-table-panel">
        <Block className="skeleton-section-title" />
        <Rows count={variant === 'audit' ? 7 : 6} />
      </div>
    </>
  );
}

function LoadingLayout({ variant }) {
  if (['elections', 'positions', 'candidates', 'users', 'audit', 'ballots'].includes(variant)) {
    return <ManagementSkeleton variant={variant === 'ballots' ? 'ballot-management' : variant} />;
  }

  if (variant === 'dashboard') {
    return <><Block className="skeleton-page-title" /><Block className="skeleton-page-subtitle" /><StatCards count={4} /><div className="skeleton-dashboard-grid"><div className="skeleton-panel"><Block className="skeleton-section-title" /><Rows count={4} /></div><div className="skeleton-panel"><Block className="skeleton-section-title" /><Rows count={3} /></div></div></>;
  }

  if (variant === 'scanner') {
    return <><Block className="skeleton-page-title" /><Block className="skeleton-page-subtitle" /><div className="skeleton-panel skeleton-filter-panel"><Block className="skeleton-input" /></div><StatCards count={3} /><div className="skeleton-panel skeleton-table-panel"><Block className="skeleton-section-title" /><Rows count={8} /></div></>;
  }

  if (variant === 'report') {
    return <><div className="skeleton-heading-row"><div><Block className="skeleton-page-title" /><Block className="skeleton-page-subtitle" /></div><Block className="skeleton-action-group" /></div><div className="skeleton-panel skeleton-filter-panel"><Block className="skeleton-input" /><Block className="skeleton-button" /></div><StatCards count={3} /><div className="skeleton-panel skeleton-table-panel"><Block className="skeleton-section-title" /><Rows count={6} /></div></>;
  }

  if (variant === 'results') {
    return <><div className="skeleton-results-topbar"><Block /><Block /></div><div className="skeleton-results-hero"><Block className="skeleton-hero-title" /><Block className="skeleton-hero-mark" /></div><StatCards count={4} /><div className="skeleton-results-grid"><div className="skeleton-panel"><Block className="skeleton-section-title" /><Rows count={6} className="skeleton-result-row" /></div><div className="skeleton-panel"><Block className="skeleton-section-title" /><Rows count={4} /></div></div></>;
  }

  if (variant === 'verify') {
    return <><Block className="skeleton-page-title" /><div className="skeleton-status-card"><Block className="skeleton-section-title" /><Block className="skeleton-status-copy" /></div><div className="skeleton-panel skeleton-detail-panel"><Rows count={4} /></div><div className="skeleton-panel"><Block className="skeleton-section-title" /><Rows count={3} /></div></>;
  }

  if (variant === 'election-details') {
    return <><div className="skeleton-details-summary"><Block /><Block /><Block /></div><Block className="skeleton-details-heading" /><div className="skeleton-details-position"><Block className="skeleton-details-position-title" /><Rows count={3} /></div><div className="skeleton-details-position"><Block className="skeleton-details-position-title" /><Rows count={2} /></div></>;
  }

  if (variant === 'ballot' || variant === 'print') {
    const pages = variant === 'print' ? 2 : 1;
    return <><div className="skeleton-print-toolbar"><Block className="skeleton-button" /><Block className="skeleton-button" /></div><div className={`skeleton-ballot-sheets skeleton-ballot-sheets-${pages}`}>{Array.from({ length: pages }, (_, index) => <div className="skeleton-ballot-sheet" key={index}><Block className="skeleton-sheet-title" /><Block className="skeleton-sheet-meta" /><Rows count={variant === 'print' ? 4 : 5} className="skeleton-ballot-row" /></div>)}</div></>;
  }

  return <><Block className="skeleton-page-title" /><Block className="skeleton-page-subtitle" /><div className="skeleton-panel skeleton-table-panel"><Block className="skeleton-section-title" /><Rows /></div></>;
}

export default function LoadingSkeleton({ variant = 'table', label = 'Loading' }) {
  return <div className={`loading-skeleton loading-skeleton-${variant}`} aria-busy="true" aria-label={label}><LoadingLayout variant={variant} /></div>;
}
