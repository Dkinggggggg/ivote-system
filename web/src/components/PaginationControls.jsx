import React from "react";

export default function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  startItem,
  endItem,
  onPrevious,
  onNext,
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination-controls">
      <small>
        Showing {startItem}-{endItem} of {totalItems}
      </small>

      <div className="pagination-actions">
        <button
          type="button"
          onClick={onPrevious}
          disabled={currentPage <= 1}
        >
          Previous
        </button>

        <span className="pagination-current">
          Page {currentPage} of {totalPages}
        </span>

        <button
          type="button"
          onClick={onNext}
          disabled={currentPage >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}