import { getPaginationItems, paginationRange } from '../utils/paginationPages';

export default function CompactPagination({
  page = 1,
  totalPages = 1,
  total = 0,
  limit = 25,
  onPageChange,
  className = '',
  compact = false,
}) {
  if (total <= 0) return null;

  const { start, end } = paginationRange(page, limit, total);
  const summary = `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`;

  const go = (p) => {
    if (p < 1 || p > totalPages || p === page) return;
    onPageChange(p);
  };

  const items = totalPages > 1 ? getPaginationItems(page, totalPages) : [];

  return (
    <div
      className={`pagination-bar${compact ? ' pagination-bar--compact' : ''}${className ? ` ${className}` : ''}`}
    >
      <p className="pagination-summary">{summary}</p>
      {totalPages > 1 && (
        <div className="pagination-controls" role="navigation" aria-label="Pagination">
          <button
            type="button"
            className="page-btn page-btn-nav"
            disabled={page <= 1}
            onClick={() => go(1)}
            aria-label="First page"
          >
            «
          </button>
          <button
            type="button"
            className="page-btn page-btn-nav"
            disabled={page <= 1}
            onClick={() => go(page - 1)}
            aria-label="Previous page"
          >
            ‹
          </button>
          {items.map((item, idx) =>
            item === 'ellipsis' ? (
              <span key={`ellipsis-${idx}`} className="page-ellipsis" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={`page-btn${page === item ? ' active' : ''}`}
                onClick={() => go(item)}
                aria-label={`Page ${item}`}
                aria-current={page === item ? 'page' : undefined}
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            className="page-btn page-btn-nav"
            disabled={page >= totalPages}
            onClick={() => go(page + 1)}
            aria-label="Next page"
          >
            ›
          </button>
          <button
            type="button"
            className="page-btn page-btn-nav"
            disabled={page >= totalPages}
            onClick={() => go(totalPages)}
            aria-label="Last page"
          >
            »
          </button>
        </div>
      )}
    </div>
  );
}