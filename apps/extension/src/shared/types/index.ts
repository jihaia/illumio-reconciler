// ─────────────────────────────────────────────────────────────
// SERVICENOW TYPES
// ─────────────────────────────────────────────────────────────

export interface Portfolio {
  sysId: string;
  name: string;
  state?: string;
}

export interface Service {
  sysId: string;
  name: string;
  fullName?: string;          // u_business_service_fullname (human-readable name)
  description?: string;
  criticality?: string;
  environment?: string;       // used_for (Production, Development, Test / QA, etc.)
  category?: string;          // category (Hosted-B55, Cloud-Azure, etc.)
  portfolioId?: string;
  infrastructure?: string;
}

export interface Server {
  sysId: string;
  name: string;
  ip?: string;
  hostname?: string;
  fqdn?: string;
  os?: string;
  environment?: string;
  type?: string;
  classType?: string;       // sys_class_name (cmdb_ci_linux_server, cmdb_ci_win_server, etc.)
  virtual?: boolean;
  shortDescription?: string;
  services?: string[];
}

/** Enriched service info returned within ServerContext */
export interface ServiceInfo {
  name: string;
  fullName?: string;        // u_business_service_fullname (human-readable name)
  description?: string;     // short_description
  portfolio?: string;       // resolved portfolio name this service belongs to
  criticality?: string;     // busines_criticality (e.g. "1 - most critical")
  environment?: string;     // used_for (Production, Development, Test / QA, etc.)
  category?: string;        // category (Hosted-B55, Cloud-Azure, Vendor, etc.)
  infrastructure?: string;  // u_infrastructure (e.g. "cloud_azure", "hosted_55")
}

export interface ServerContext {
  server: {
    sysId: string;
    name: string;
    ip?: string;
    os?: string;
    environment?: string;
    fqdn?: string;
    classType?: string;
    virtual?: boolean;
    shortDescription?: string;
  };
  services: string[];
  serviceDetails: ServiceInfo[];
  portfolios: string[];
  isMultiUse: boolean;
  components?: AppComponent[];
}

export interface IPListData {
  portfolio: string;
  portfolioId: string;
  serverCount: number;
  servers: Array<{
    ip?: string;
    name: string;
    services: string[];
    description: string;
  }>;
  ipRanges: Array<{
    from_ip: string;
    description: string;
  }>;
}

/** Full service catalog: every service grouped under its portfolio */
export interface ServiceCatalogEntry {
  name: string;
  fullName?: string;
  description?: string;
  criticality?: string;
  environment?: string;
  category?: string;
  infrastructure?: string;
  serverCount: number;
}

export interface PortfolioCatalogEntry {
  name: string;
  sysId: string;
  state?: string;
  services: ServiceCatalogEntry[];
}

export interface ServiceCatalog {
  portfolios: PortfolioCatalogEntry[];
  unassigned: ServiceCatalogEntry[];
  totalPortfolios: number;
  totalServices: number;
  fetchedAt: string;
}

/** A CMDB application component (Tomcat, WebLogic, JBoss, IIS, Apache, NGINX, etc.) */
export interface AppComponent {
  sysId: string;
  name: string;
  className: string;       // sys_class_name (cmdb_ci_app_server_tomcat, etc.)
  shortDescription?: string;
  serverSysId?: string;    // parent server sys_id from cmdb_rel_ci
  serverName?: string;     // resolved parent server name
}

// ─────────────────────────────────────────────────────────────
// ILLUMIO TYPES
// ─────────────────────────────────────────────────────────────

export interface IllumioIPList {
  href: string;
  name: string;
  description?: string;
  ip_ranges: Array<{
    from_ip: string;
    to_ip?: string;
    description?: string;
    exclusion?: boolean;
  }>;
  created_at: string;
  updated_at: string;
}

export interface IllumioWorkload {
  href: string;
  name: string;
  hostname?: string;
  interfaces: Array<{
    address: string;
    cidr_block?: number;
  }>;
  labels: Array<{
    href: string;
    key: string;
    value: string;
  }>;
}

// ─────────────────────────────────────────────────────────────
// STORAGE TYPES
// ─────────────────────────────────────────────────────────────

export interface ServiceNowConfig {
  instance: string;
  username: string;
  password: string;
}

export interface IllumioConfig {
  pceUrl: string;
  apiKeyId: string;
  apiKeySecret: string;
  orgId: number;
}

export interface ApertureStorage {
  servicenow: ServiceNowConfig | null;
  illumio: IllumioConfig | null;
  savedQueries: Array<{
    id: string;
    name: string;
    type: 'portfolio' | 'service' | 'criticality';
    value: string;
    createdAt: number;
  }>;
  settings: {
    defaultExpiration: number;
    autoOpenInIllumio: boolean;
  };
}

// ─────────────────────────────────────────────────────────────
// QUERY TYPES
// ─────────────────────────────────────────────────────────────

export type QueryType = 'portfolio' | 'service' | 'criticality' | 'server';

export interface Query {
  type: QueryType;
  portfolioId?: string;
  portfolioName?: string;
  serviceName?: string;
  criticality?: string;
  serverIP?: string;
}

export interface QueryResult {
  query: Query;
  servers: Array<{
    ip?: string;
    name: string;
    services: string[];
    description: string;
  }>;
  totalCount: number;
  multiUseCount: number;
  portfolios: string[];
  executedAt: number;
}
