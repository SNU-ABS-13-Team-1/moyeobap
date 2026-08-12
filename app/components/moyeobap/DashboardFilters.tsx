interface DashboardFiltersProps {
  statusFilter: 'active' | 'closed';
  setStatusFilter: (filter: 'active' | 'closed') => void;
  categoryFilter: 'all' | 'lunch' | 'cafe';
  setCategoryFilter: (filter: 'all' | 'lunch' | 'cafe') => void;
  activeCount: number;
  closedCount: number;
}

export function DashboardFilters({
  statusFilter,
  setStatusFilter,
  categoryFilter,
  setCategoryFilter,
  activeCount,
  closedCount,
}: DashboardFiltersProps) {
  return (
    <div className="dashboard-filters">
      <nav aria-label="모집 상태" className="header__nav header__nav--status">
        <button
          aria-pressed={statusFilter === 'active'}
          className={`header__tab ${statusFilter === 'active' ? 'header__tab--active' : ''}`}
          onClick={() => setStatusFilter('active')}
          type="button"
        >
          모집 중 <span className="header__tab-count">{activeCount}</span>
        </button>
        <button
          aria-pressed={statusFilter === 'closed'}
          className={`header__tab ${statusFilter === 'closed' ? 'header__tab--active' : ''}`}
          onClick={() => setStatusFilter('closed')}
          type="button"
        >
          마감 <span className="header__tab-count">{closedCount}</span>
        </button>
      </nav>

      <nav aria-label="주문 종류" className="header__nav header__nav--category">
        {([
          ['all', '전체'],
          ['lunch', '점심'],
          ['cafe', '카페'],
        ] as const).map(([value, label]) => (
          <button
            aria-pressed={categoryFilter === value}
            className={`header__tab ${categoryFilter === value ? 'header__tab--active' : ''}`}
            key={value}
            onClick={() => setCategoryFilter(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
