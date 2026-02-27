import { useState, useEffect } from 'react';
import type { GraphFilters } from '../types';

interface FilterBarProps {
  portfolios: string[];
  services: string[];
  filters: GraphFilters;
  onFilterChange: (key: keyof GraphFilters, value: string) => void;
  onReset: () => void;
  stats: {
    portfolios: number;
    services: number;
    workloads: number;
    multiUse: number;
  };
}

export function FilterBar({
  portfolios,
  services,
  filters,
  onFilterChange,
  onReset,
  stats,
}: FilterBarProps) {
  const [searchValue, setSearchValue] = useState(filters.search);

  useEffect(() => {
    const timer = setTimeout(() => {
      onFilterChange('search', searchValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const hasFilters = filters.portfolio || filters.service || filters.search;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Portfolio</label>
        <select
          value={filters.portfolio}
          onChange={(e) => onFilterChange('portfolio', e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
        >
          <option value="">All Portfolios</option>
          {portfolios.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Product</label>
        <select
          value={filters.service}
          onChange={(e) => onFilterChange('service', e.target.value)}
          disabled={services.length === 0}
          className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none disabled:opacity-50"
        >
          <option value="">All Products</option>
          {services.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="flex-1" />

      <input
        type="text"
        placeholder="Search nodes..."
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        className="text-sm border border-gray-200 rounded-md px-3 py-1 w-48 bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
      />

      <button
        onClick={onReset}
        disabled={!hasFilters}
        className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30 font-medium"
      >
        Reset
      </button>

      <div className="h-4 w-px bg-gray-200" />

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span><strong className="text-gray-700">{stats.portfolios}</strong> portfolios</span>
        <span><strong className="text-gray-700">{stats.services}</strong> products</span>
        <span>
          <strong className="text-gray-700">{stats.workloads}</strong> workloads
          {stats.multiUse > 0 && (
            <span className="text-amber-600 ml-1">({stats.multiUse} multi-use)</span>
          )}
        </span>
      </div>
    </div>
  );
}
