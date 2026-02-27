-- Aperture BIA Hierarchy Schema
-- Portfolio → Asset → App Grouping → Application → Component
-- Plus: Workloads (servers) and Component-Workload junction

-- ─── Portfolios (Tier 1) ────────────────────────────────────
CREATE TABLE portfolios (
  portfolio_id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  snow_sys_id TEXT UNIQUE,
  state TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Assets (Tier 2) ────────────────────────────────────────
-- Maps to ServiceNow cmdb_ci_service (products)
CREATE TABLE assets (
  asset_id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(portfolio_id) ON DELETE CASCADE,
  snow_sys_id TEXT UNIQUE,
  full_name TEXT,
  description TEXT,
  criticality TEXT,
  environment TEXT,
  category TEXT,
  infrastructure TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(name, portfolio_id)
);
CREATE INDEX idx_assets_portfolio ON assets(portfolio_id);
CREATE INDEX idx_assets_name ON assets(name);

-- ─── App Groupings (Tier 3) ─────────────────────────────────
CREATE TABLE app_groupings (
  app_grouping_id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  asset_id TEXT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(name, asset_id)
);
CREATE INDEX idx_app_groupings_asset ON app_groupings(asset_id);
CREATE INDEX idx_app_groupings_name ON app_groupings(name);

-- ─── Applications (Tier 4) ──────────────────────────────────
CREATE TABLE applications (
  application_id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  app_grouping_id TEXT NOT NULL REFERENCES app_groupings(app_grouping_id) ON DELETE CASCADE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(name, app_grouping_id)
);
CREATE INDEX idx_applications_grouping ON applications(app_grouping_id);
CREATE INDEX idx_applications_name ON applications(name);

-- ─── Component Types (Lookup / Domain table) ────────────────
CREATE TABLE component_types (
  component_type_id TEXT PRIMARY KEY NOT NULL,
  class_name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_component_types_label ON component_types(label);

-- ─── Components (Tier 5) ────────────────────────────────────
CREATE TABLE components (
  component_id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  application_id TEXT NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  component_type_id TEXT REFERENCES component_types(component_type_id) ON DELETE SET NULL,
  snow_sys_id TEXT UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(name, application_id)
);
CREATE INDEX idx_components_application ON components(application_id);
CREATE INDEX idx_components_type ON components(component_type_id);
CREATE INDEX idx_components_name ON components(name);

-- ─── Workloads (Servers) ────────────────────────────────────
CREATE TABLE workloads (
  workload_id TEXT PRIMARY KEY NOT NULL,
  hostname TEXT NOT NULL UNIQUE,
  snow_sys_id TEXT UNIQUE,
  ip_address TEXT,
  fqdn TEXT,
  os TEXT,
  environment TEXT,
  location TEXT,
  class_type TEXT,
  is_virtual INTEGER DEFAULT 0,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_workloads_ip ON workloads(ip_address);
CREATE INDEX idx_workloads_fqdn ON workloads(fqdn);

-- ─── Component ↔ Workload Junction ──────────────────────────
CREATE TABLE component_workloads (
  component_id TEXT NOT NULL REFERENCES components(component_id) ON DELETE CASCADE,
  workload_id TEXT NOT NULL REFERENCES workloads(workload_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (component_id, workload_id)
);
CREATE INDEX idx_cw_workload ON component_workloads(workload_id);
