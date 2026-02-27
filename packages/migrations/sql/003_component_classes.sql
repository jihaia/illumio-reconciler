-- Add component_classes table for two-level class→type hierarchy
-- Class = top-level category (e.g., "App Server", "Database", "Web Server")
-- Type = specific implementation within a class (existing component_types rows)

-- ─── Component Classes (lookup table) ────────────────────
CREATE TABLE IF NOT EXISTS component_classes (
  component_class_id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_component_classes_label ON component_classes(label);

-- Add component_class_id FK to component_types
ALTER TABLE component_types ADD COLUMN component_class_id TEXT REFERENCES component_classes(component_class_id) ON DELETE SET NULL;
CREATE INDEX idx_component_types_class ON component_types(component_class_id);

-- Recreate components table: make name optional, add component_class_id
-- SQLite requires table recreation to change NOT NULL constraints
-- Must also recreate component_workloads since it FKs to components

-- Save existing data
CREATE TABLE _components_backup AS SELECT * FROM components;
CREATE TABLE _cw_backup AS SELECT * FROM component_workloads;
DROP TABLE component_workloads;
DROP TABLE components;

CREATE TABLE components (
  component_id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  application_id TEXT NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  component_class_id TEXT REFERENCES component_classes(component_class_id) ON DELETE SET NULL,
  component_type_id TEXT REFERENCES component_types(component_type_id) ON DELETE SET NULL,
  snow_sys_id TEXT UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_components_application ON components(application_id);
CREATE INDEX idx_components_type ON components(component_type_id);
CREATE INDEX idx_components_class ON components(component_class_id);
CREATE INDEX idx_components_name ON components(name);

-- Restore components data
INSERT INTO components (component_id, name, application_id, component_type_id, snow_sys_id, description, created_at, updated_at)
  SELECT component_id, name, application_id, component_type_id, snow_sys_id, description, created_at, updated_at
  FROM _components_backup;
DROP TABLE _components_backup;

-- Recreate junction table
CREATE TABLE component_workloads (
  component_id TEXT NOT NULL REFERENCES components(component_id) ON DELETE CASCADE,
  workload_id TEXT NOT NULL REFERENCES workloads(workload_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (component_id, workload_id)
);
CREATE INDEX idx_cw_workload ON component_workloads(workload_id);

-- Restore junction data
INSERT INTO component_workloads SELECT * FROM _cw_backup;
DROP TABLE _cw_backup;

-- ─── Seed Component Classes ──────────────────────────────
INSERT OR IGNORE INTO component_classes (component_class_id, name, label, color) VALUES
  ('cc-app-server',        'app_server',        'App Server',           '#8b5cf6'),
  ('cc-web-server',        'web_server',        'Web Server',           '#6366f1'),
  ('cc-database',          'database',           'Database',             '#b91c1c'),
  ('cc-container-runtime', 'container_runtime',  'Container & Runtime',  '#0ea5e9'),
  ('cc-load-balancer',     'load_balancer',      'Load Balancer',        '#f59e0b'),
  ('cc-application',       'application',        'Application',          '#6d28d9'),
  ('cc-messaging',         'messaging',          'Messaging / Middleware','#8b5cf6'),
  ('cc-cluster',           'cluster',            'Cluster',              '#f59e0b'),
  ('cc-storage',           'storage',            'Storage',              '#78716c'),
  ('cc-service',           'service',            'Service',              '#10b981'),
  ('cc-hypervisor',        'hypervisor',         'Hypervisor',           '#0891b2'),
  ('cc-network',           'network',            'Network',              '#6b7280'),
  ('cc-server',            'server',             'Server',               '#64748b');

-- ─── Link existing component_types to their classes ──────
-- App Servers
UPDATE component_types SET component_class_id = 'cc-app-server' WHERE class_name IN (
  'cmdb_ci_app_server', 'cmdb_ci_app_server_tomcat', 'cmdb_ci_app_server_weblogic',
  'cmdb_ci_app_server_jboss', 'cmdb_ci_app_server_websphere',
  'cmdb_ci_app_server_java', 'cmdb_ci_app_server_nodejs'
);

-- Web Servers
UPDATE component_types SET component_class_id = 'cc-web-server' WHERE class_name IN (
  'cmdb_ci_web_server', 'cmdb_ci_apache_web_server',
  'cmdb_ci_microsoft_iis_web_server', 'cmdb_ci_nginx_web_server'
);

-- Databases
UPDATE component_types SET component_class_id = 'cc-database' WHERE class_name IN (
  'cmdb_ci_db_instance', 'cmdb_ci_db_mssql_instance', 'cmdb_ci_db_ora_instance',
  'cmdb_ci_db_ora_listener', 'cmdb_ci_db_postgresql_instance',
  'cmdb_ci_db_mysql_instance', 'cmdb_ci_db_mongodb_instance', 'cmdb_ci_db_syb_instance'
);

-- Container & Runtime
UPDATE component_types SET component_class_id = 'cc-container-runtime' WHERE class_name IN (
  'cmdb_ci_docker_engine', 'cmdb_ci_docker_container', 'cmdb_ci_kubernetes_cluster'
);

-- Load Balancers
UPDATE component_types SET component_class_id = 'cc-load-balancer' WHERE class_name IN (
  'cmdb_ci_lb_service', 'cmdb_ci_lb', 'cmdb_ci_lb_bigip'
);

-- Applications
UPDATE component_types SET component_class_id = 'cc-application' WHERE class_name IN (
  'cmdb_ci_appl', 'cmdb_ci_appl_license_server', 'cmdb_ci_appl_sap'
);

-- Messaging / Middleware
UPDATE component_types SET component_class_id = 'cc-messaging' WHERE class_name IN (
  'cmdb_ci_mq_queue_manager', 'cmdb_ci_mq_channel', 'cmdb_ci_mq_queue'
);

-- Clusters
UPDATE component_types SET component_class_id = 'cc-cluster' WHERE class_name IN (
  'cmdb_ci_cluster', 'cmdb_ci_cluster_node', 'cmdb_ci_cluster_resource'
);

-- Storage
UPDATE component_types SET component_class_id = 'cc-storage' WHERE class_name IN (
  'cmdb_ci_storage_device', 'cmdb_ci_storage_volume'
);

-- Services
UPDATE component_types SET component_class_id = 'cc-service' WHERE class_name IN (
  'cmdb_ci_service', 'cmdb_ci_service_discovered',
  'cmdb_ci_service_auto', 'cmdb_ci_service_group'
);

-- Hypervisors
UPDATE component_types SET component_class_id = 'cc-hypervisor' WHERE class_name IN (
  'cmdb_ci_esx_server', 'cmdb_ci_hyper_v_server'
);

-- Network
UPDATE component_types SET component_class_id = 'cc-network' WHERE class_name IN (
  'cmdb_ci_ip_switch', 'cmdb_ci_ip_router', 'cmdb_ci_ip_firewall'
);

-- Servers
UPDATE component_types SET component_class_id = 'cc-server' WHERE class_name IN (
  'cmdb_ci_server', 'cmdb_ci_linux_server', 'cmdb_ci_win_server',
  'cmdb_ci_unix_server', 'cmdb_ci_aix_server', 'cmdb_ci_solaris_server', 'cmdb_ci_hpux_server'
);
