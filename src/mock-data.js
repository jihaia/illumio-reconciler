// Mock CMDB Data for Illumio Reconciliation PoC
// Simulates ServiceNow CMDB records
// ~20 records with variety of applications and data completeness

export const CMDB_RECORDS = {
  // === FINANCE SYSTEMS ===
  'proddb01': {
    ci_id: 'CI0001234',
    hostname: 'proddb01',
    fqdn: 'proddb01.corp.acme.com',
    application: 'Oracle Financials',
    application_id: 'APP-001',
    product: 'Oracle Database 19c',
    product_portfolio: 'Finance Systems',
    business_owner: 'Jane Smith',
    business_owner_email: 'jane.smith@acme.com',
    technical_owner: 'Mike Chen',
    technical_owner_email: 'mike.chen@acme.com',
    cost_center: 'CC-4521',
    criticality: 'tier1',
    environment: 'production',
    compliance_scope: ['SOX', 'PCI'],
    last_updated: '2024-11-15T10:30:00Z',
    last_updated_by: 'jane.smith@acme.com',
  },
  'proddb02': {
    ci_id: 'CI0001235',
    hostname: 'proddb02',
    fqdn: 'proddb02.corp.acme.com',
    application: 'Oracle Financials',
    application_id: 'APP-001',
    product: 'Oracle Database 19c',
    product_portfolio: 'Finance Systems',
    business_owner: 'Jane Smith',
    business_owner_email: 'jane.smith@acme.com',
    technical_owner: 'Mike Chen',
    technical_owner_email: 'mike.chen@acme.com',
    cost_center: 'CC-4521',
    criticality: 'tier1',
    environment: 'production',
    compliance_scope: ['SOX', 'PCI'],
    last_updated: '2024-11-15T10:35:00Z',
    last_updated_by: 'jane.smith@acme.com',
  },
  'fin-app-01': {
    ci_id: 'CI0001236',
    hostname: 'fin-app-01',
    fqdn: 'fin-app-01.corp.acme.com',
    application: 'Oracle Financials',
    application_id: 'APP-001',
    product: 'Oracle Application Server',
    product_portfolio: 'Finance Systems',
    business_owner: 'Jane Smith',
    business_owner_email: 'jane.smith@acme.com',
    technical_owner: 'Mike Chen',
    technical_owner_email: 'mike.chen@acme.com',
    cost_center: 'CC-4521',
    criticality: 'tier1',
    environment: 'production',
    compliance_scope: ['SOX'],
    last_updated: '2024-10-20T14:00:00Z',
    last_updated_by: 'mike.chen@acme.com',
  },

  // === CUSTOMER PORTAL / WEB ===
  'webapi-east-1': {
    ci_id: 'CI0001240',
    hostname: 'webapi-east-1',
    fqdn: 'webapi-east-1.corp.acme.com',
    application: 'Customer Portal',
    application_id: 'APP-010',
    product: 'Customer Portal API',
    product_portfolio: 'Digital Channels',
    business_owner: 'Sarah Johnson',
    business_owner_email: 'sarah.johnson@acme.com',
    technical_owner: 'David Park',
    technical_owner_email: 'david.park@acme.com',
    cost_center: 'CC-3200',
    criticality: 'tier2',
    environment: 'production',
    compliance_scope: ['PCI'],
    last_updated: '2024-10-20T14:15:00Z',
    last_updated_by: 'david.park@acme.com',
  },
  'web-frontend-01': {
    ci_id: 'CI0001242',
    hostname: 'web-frontend-01',
    fqdn: 'web-frontend-01.corp.acme.com',
    application: 'Customer Portal',
    application_id: 'APP-010',
    product: 'React Web Application',
    product_portfolio: 'Digital Channels',
    business_owner: 'Sarah Johnson',
    business_owner_email: 'sarah.johnson@acme.com',
    technical_owner: 'David Park',
    technical_owner_email: 'david.park@acme.com',
    cost_center: 'CC-3200',
    criticality: 'tier2',
    environment: 'production',
    compliance_scope: ['PCI'],
    last_updated: '2024-11-01T09:00:00Z',
    last_updated_by: 'david.park@acme.com',
  },

  // === PAYMENT SYSTEMS ===
  'payment-svc-01': {
    ci_id: 'CI0001250',
    hostname: 'payment-svc-01',
    fqdn: 'payment-svc-01.corp.acme.com',
    application: 'Payment Gateway',
    application_id: 'APP-015',
    product: 'Payment Processing Engine',
    product_portfolio: 'Payment Systems',
    business_owner: 'Robert Kim',
    business_owner_email: 'robert.kim@acme.com',
    technical_owner: 'Lisa Wang',
    technical_owner_email: 'lisa.wang@acme.com',
    cost_center: 'CC-5100',
    criticality: 'tier1',
    environment: 'production',
    compliance_scope: ['PCI', 'SOX'],
    last_updated: '2024-12-01T09:00:00Z',
    last_updated_by: 'lisa.wang@acme.com',
  },
  'payment-svc-02': {
    ci_id: 'CI0001251',
    hostname: 'payment-svc-02',
    fqdn: 'payment-svc-02.corp.acme.com',
    application: 'Payment Gateway',
    application_id: 'APP-015',
    product: 'Payment Processing Engine',
    product_portfolio: 'Payment Systems',
    business_owner: 'Robert Kim',
    business_owner_email: 'robert.kim@acme.com',
    technical_owner: 'Lisa Wang',
    technical_owner_email: 'lisa.wang@acme.com',
    cost_center: 'CC-5100',
    criticality: 'tier1',
    environment: 'production',
    compliance_scope: ['PCI', 'SOX'],
    last_updated: '2024-12-01T09:05:00Z',
    last_updated_by: 'lisa.wang@acme.com',
  },

  // === IDENTITY / AUTH ===
  'auth-server-prod': {
    ci_id: 'CI0001260',
    hostname: 'auth-server-prod',
    fqdn: 'auth-server-prod.corp.acme.com',
    application: 'Identity Management',
    application_id: 'APP-020',
    product: 'Okta Integration Server',
    product_portfolio: 'Security Infrastructure',
    business_owner: 'Amanda Torres',
    business_owner_email: 'amanda.torres@acme.com',
    technical_owner: 'Kevin Brown',
    technical_owner_email: 'kevin.brown@acme.com',
    cost_center: 'CC-6000',
    criticality: 'tier1',
    environment: 'production',
    compliance_scope: ['SOX', 'HIPAA', 'PCI'],
    last_updated: '2024-11-28T16:45:00Z',
    last_updated_by: 'kevin.brown@acme.com',
  },
  'ldap-01': {
    ci_id: 'CI0001261',
    hostname: 'ldap-01',
    fqdn: 'ldap-01.corp.acme.com',
    application: 'Identity Management',
    application_id: 'APP-020',
    product: 'Active Directory',
    product_portfolio: 'Security Infrastructure',
    business_owner: 'Amanda Torres',
    business_owner_email: 'amanda.torres@acme.com',
    technical_owner: 'Kevin Brown',
    technical_owner_email: 'kevin.brown@acme.com',
    cost_center: 'CC-6000',
    criticality: 'tier1',
    environment: 'production',
    compliance_scope: ['SOX'],
    last_updated: '2024-09-10T10:00:00Z',
    last_updated_by: 'kevin.brown@acme.com',
  },

  // === DATA / ANALYTICS ===
  'dw-etl-01': {
    ci_id: 'CI0001270',
    hostname: 'dw-etl-01',
    fqdn: 'dw-etl-01.corp.acme.com',
    application: 'Data Warehouse',
    application_id: 'APP-025',
    product: 'Informatica PowerCenter',
    product_portfolio: 'Data & Analytics',
    business_owner: 'Michael Davis',
    business_owner_email: 'michael.davis@acme.com',
    technical_owner: 'Jennifer Lee',
    technical_owner_email: 'jennifer.lee@acme.com',
    cost_center: 'CC-7500',
    criticality: 'tier2',
    environment: 'production',
    compliance_scope: ['SOX'],
    last_updated: '2024-10-05T11:20:00Z',
    last_updated_by: 'jennifer.lee@acme.com',
  },
  'tableau-server': {
    ci_id: 'CI0001280',
    hostname: 'tableau-server',
    fqdn: 'tableau-server.corp.acme.com',
    application: 'Business Intelligence',
    application_id: 'APP-030',
    product: 'Tableau Server',
    product_portfolio: 'Data & Analytics',
    business_owner: 'Michael Davis',
    business_owner_email: 'michael.davis@acme.com',
    technical_owner: 'Jennifer Lee',
    technical_owner_email: 'jennifer.lee@acme.com',
    cost_center: 'CC-7500',
    criticality: 'tier3',
    environment: 'production',
    compliance_scope: [],
    last_updated: '2024-09-15T08:30:00Z',
    last_updated_by: 'jennifer.lee@acme.com',
  },

  // === HR SYSTEMS ===
  'hr-portal-01': {
    ci_id: 'CI0001290',
    hostname: 'hr-portal-01',
    fqdn: 'hr-portal-01.corp.acme.com',
    application: 'Workday Integration',
    application_id: 'APP-035',
    product: 'Workday Connector',
    product_portfolio: 'HR Systems',
    business_owner: 'Patricia Miller',
    business_owner_email: 'patricia.miller@acme.com',
    technical_owner: 'James Wilson',
    technical_owner_email: 'james.wilson@acme.com',
    cost_center: 'CC-2000',
    criticality: 'tier2',
    environment: 'production',
    compliance_scope: ['HIPAA'],
    last_updated: '2024-11-01T13:00:00Z',
    last_updated_by: 'james.wilson@acme.com',
  },

  // === PLATFORM / INFRASTRUCTURE ===
  'k8s-master-01': {
    ci_id: 'CI0002001',
    hostname: 'k8s-master-01',
    fqdn: 'k8s-master-01.corp.acme.com',
    application: 'Container Platform',
    application_id: 'APP-050',
    product: 'Kubernetes',
    product_portfolio: 'Platform Services',
    business_owner: 'Platform Team',
    business_owner_email: 'platform@acme.com',
    technical_owner: 'Chris Martinez',
    technical_owner_email: 'chris.martinez@acme.com',
    cost_center: 'CC-8000',
    criticality: 'tier2',
    environment: 'production',
    compliance_scope: [],
    last_updated: '2024-06-15T09:00:00Z',
    last_updated_by: 'chris.martinez@acme.com',
  },
  // === MULTI-USE / SHARED INFRASTRUCTURE ===
  // These workloads serve multiple applications across portfolios.
  // The `applications` array lists additional apps beyond the primary.

  'api-gateway-01': {
    ci_id: 'CI0002010',
    hostname: 'api-gateway-01',
    fqdn: 'api-gateway-01.corp.acme.com',
    application: 'API Gateway',
    application_id: 'APP-012',
    product: 'Kong Gateway',
    product_portfolio: 'Platform Services',
    applications: [
      { application: 'Customer Portal', application_id: 'APP-010', product: 'Customer Portal API', product_portfolio: 'Digital Channels' },
      { application: 'Payment Gateway', application_id: 'APP-015', product: 'Payment Processing Engine', product_portfolio: 'Payment Systems' },
      { application: 'Workday Integration', application_id: 'APP-035', product: 'Workday Connector', product_portfolio: 'HR Systems' },
    ],
    business_owner: 'Platform Team',
    business_owner_email: 'platform@acme.com',
    technical_owner: 'David Park',
    technical_owner_email: 'david.park@acme.com',
    cost_center: 'CC-8000',
    criticality: 'tier1',
    environment: 'production',
    compliance_scope: ['PCI'],
    last_updated: '2024-12-05T09:30:00Z',
    last_updated_by: 'david.park@acme.com',
  },
  'redis-cache-01': {
    ci_id: 'CI0002011',
    hostname: 'redis-cache-01',
    fqdn: 'redis-cache-01.corp.acme.com',
    application: 'Caching Layer',
    application_id: 'APP-013',
    product: 'Redis Enterprise',
    product_portfolio: 'Platform Services',
    applications: [
      { application: 'Customer Portal', application_id: 'APP-010', product: 'Customer Portal API', product_portfolio: 'Digital Channels' },
      { application: 'Oracle Financials', application_id: 'APP-001', product: 'Oracle Application Server', product_portfolio: 'Finance Systems' },
      { application: 'Payment Gateway', application_id: 'APP-015', product: 'Payment Processing Engine', product_portfolio: 'Payment Systems' },
    ],
    business_owner: 'Platform Team',
    business_owner_email: 'platform@acme.com',
    technical_owner: 'Lisa Wang',
    technical_owner_email: 'lisa.wang@acme.com',
    cost_center: 'CC-8000',
    criticality: 'tier2',
    environment: 'production',
    compliance_scope: ['PCI'],
    last_updated: '2024-11-25T11:00:00Z',
    last_updated_by: 'lisa.wang@acme.com',
  },
  'msg-broker-01': {
    ci_id: 'CI0002012',
    hostname: 'msg-broker-01',
    fqdn: 'msg-broker-01.corp.acme.com',
    application: 'Message Broker',
    application_id: 'APP-014',
    product: 'RabbitMQ',
    product_portfolio: 'Platform Services',
    applications: [
      { application: 'Payment Gateway', application_id: 'APP-015', product: 'Payment Processing Engine', product_portfolio: 'Payment Systems' },
      { application: 'Oracle Financials', application_id: 'APP-001', product: 'Oracle Application Server', product_portfolio: 'Finance Systems' },
      { application: 'Data Warehouse', application_id: 'APP-025', product: 'Informatica PowerCenter', product_portfolio: 'Data & Analytics' },
    ],
    business_owner: 'Platform Team',
    business_owner_email: 'platform@acme.com',
    technical_owner: 'Chris Martinez',
    technical_owner_email: 'chris.martinez@acme.com',
    cost_center: 'CC-8000',
    criticality: 'tier1',
    environment: 'production',
    compliance_scope: ['SOX', 'PCI'],
    last_updated: '2024-11-20T14:00:00Z',
    last_updated_by: 'chris.martinez@acme.com',
  },
  'shared-db-01': {
    ci_id: 'CI0002013',
    hostname: 'shared-db-01',
    fqdn: 'shared-db-01.corp.acme.com',
    application: 'Shared Database Cluster',
    application_id: 'APP-016',
    product: 'PostgreSQL',
    product_portfolio: 'Platform Services',
    applications: [
      { application: 'Customer Portal', application_id: 'APP-010', product: 'Customer Portal API', product_portfolio: 'Digital Channels' },
      { application: 'Workday Integration', application_id: 'APP-035', product: 'Workday Connector', product_portfolio: 'HR Systems' },
      { application: 'Business Intelligence', application_id: 'APP-030', product: 'Tableau Server', product_portfolio: 'Data & Analytics' },
      { application: 'Identity Management', application_id: 'APP-020', product: 'Okta Integration Server', product_portfolio: 'Security Infrastructure' },
    ],
    business_owner: 'Platform Team',
    business_owner_email: 'platform@acme.com',
    technical_owner: 'Lisa Wang',
    technical_owner_email: 'lisa.wang@acme.com',
    cost_center: 'CC-8000',
    criticality: 'tier1',
    environment: 'production',
    compliance_scope: ['SOX', 'PCI', 'HIPAA'],
    last_updated: '2024-12-08T10:15:00Z',
    last_updated_by: 'lisa.wang@acme.com',
  },
  'log-aggregator-01': {
    ci_id: 'CI0002014',
    hostname: 'log-aggregator-01',
    fqdn: 'log-aggregator-01.corp.acme.com',
    application: 'Log Aggregation',
    application_id: 'APP-017',
    product: 'Elasticsearch',
    product_portfolio: 'Platform Services',
    applications: [
      { application: 'Infrastructure Monitoring', application_id: 'APP-060', product: 'Prometheus/Grafana', product_portfolio: 'Platform Services' },
      { application: 'Identity Management', application_id: 'APP-020', product: 'Okta Integration Server', product_portfolio: 'Security Infrastructure' },
      { application: 'Secrets Management', application_id: 'APP-065', product: 'HashiCorp Vault', product_portfolio: 'Security Infrastructure' },
    ],
    business_owner: 'SRE Team',
    business_owner_email: 'sre@acme.com',
    technical_owner: 'Alex Thompson',
    technical_owner_email: 'alex.thompson@acme.com',
    cost_center: 'CC-8000',
    criticality: 'tier2',
    environment: 'production',
    compliance_scope: ['SOX'],
    last_updated: '2024-11-30T08:45:00Z',
    last_updated_by: 'alex.thompson@acme.com',
  },

  // === PARTIAL DATA (incomplete CMDB records) ===
  'jenkins-master': {
    ci_id: 'CI0002020',
    hostname: 'jenkins-master',
    fqdn: 'jenkins-master.corp.acme.com',
    application: 'CI/CD Pipeline',
    application_id: 'APP-055',
    product: 'Jenkins',
    product_portfolio: '',  // Missing
    business_owner: 'DevOps Team',
    business_owner_email: 'devops@acme.com',
    technical_owner: '',  // Missing
    technical_owner_email: '',
    cost_center: '',  // Missing
    criticality: 'tier3',
    environment: 'production',
    compliance_scope: [],
    last_updated: '2022-12-01T00:00:00Z',  // Stale
    last_updated_by: 'import-script',
  },
  'monitoring-01': {
    ci_id: 'CI0002030',
    hostname: 'monitoring-01',
    fqdn: 'monitoring-01.corp.acme.com',
    application: 'Infrastructure Monitoring',
    application_id: 'APP-060',
    product: 'Prometheus/Grafana',
    product_portfolio: 'Platform Services',
    applications: [
      { application: 'Container Platform', application_id: 'APP-050', product: 'Kubernetes', product_portfolio: 'Platform Services' },
      { application: 'Payment Gateway', application_id: 'APP-015', product: 'Payment Processing Engine', product_portfolio: 'Payment Systems' },
    ],
    business_owner: 'SRE Team',
    business_owner_email: 'sre@acme.com',
    technical_owner: 'Alex Thompson',
    technical_owner_email: 'alex.thompson@acme.com',
    cost_center: 'CC-8000',
    criticality: '',  // Missing
    environment: '',  // Missing
    compliance_scope: [],
    last_updated: '2024-01-10T15:30:00Z',
    last_updated_by: 'alex.thompson@acme.com',
  },
  'vault-server-01': {
    ci_id: 'CI0002040',
    hostname: 'vault-server-01',
    fqdn: 'vault-server-01.corp.acme.com',
    application: 'Secrets Management',
    application_id: 'APP-065',
    product: 'HashiCorp Vault',
    product_portfolio: 'Security Infrastructure',
    applications: [
      { application: 'Payment Gateway', application_id: 'APP-015', product: 'Payment Processing Engine', product_portfolio: 'Payment Systems' },
      { application: 'Oracle Financials', application_id: 'APP-001', product: 'Oracle Database 19c', product_portfolio: 'Finance Systems' },
      { application: 'Identity Management', application_id: 'APP-020', product: 'Okta Integration Server', product_portfolio: 'Security Infrastructure' },
    ],
    business_owner: 'Amanda Torres',
    business_owner_email: 'amanda.torres@acme.com',
    technical_owner: '',  // Missing
    technical_owner_email: '',
    cost_center: 'CC-6000',
    criticality: 'tier1',
    environment: 'production',
    compliance_scope: ['PCI', 'SOX'],
    last_updated: '2024-03-20T12:00:00Z',
    last_updated_by: 'amanda.torres@acme.com',
  },
};

// Mock data pools for generating dynamic CMDB records
export const APPLICATIONS = [
  { name: 'Flight Planning System', portfolio: 'Aviation Operations', id: 'APP-100' },
  { name: 'Navigation Data Service', portfolio: 'Aviation Operations', id: 'APP-101' },
  { name: 'Weather Integration Platform', portfolio: 'Aviation Operations', id: 'APP-102' },
  { name: 'Pilot Portal', portfolio: 'Digital Services', id: 'APP-103' },
  { name: 'Aircraft Performance Calculator', portfolio: 'Aviation Operations', id: 'APP-104' },
  { name: 'Crew Scheduling System', portfolio: 'Operations', id: 'APP-105' },
  { name: 'Maintenance Tracking', portfolio: 'Operations', id: 'APP-106' },
  { name: 'Customer Data Platform', portfolio: 'Digital Services', id: 'APP-107' },
  { name: 'Billing & Invoicing', portfolio: 'Finance Systems', id: 'APP-108' },
  { name: 'Document Management', portfolio: 'Enterprise Services', id: 'APP-109' },
  { name: 'API Gateway Services', portfolio: 'Platform Services', id: 'APP-110' },
  { name: 'Identity Management', portfolio: 'Security Infrastructure', id: 'APP-111' },
];

const OWNERS = [
  { business: 'Sarah Mitchell', businessEmail: 'sarah.mitchell@jeppesen.com', technical: 'David Chen', technicalEmail: 'david.chen@jeppesen.com' },
  { business: 'Michael Roberts', businessEmail: 'michael.roberts@jeppesen.com', technical: 'Emily Watson', technicalEmail: 'emily.watson@jeppesen.com' },
  { business: 'Jennifer Adams', businessEmail: 'jennifer.adams@jeppesen.com', technical: 'James Park', technicalEmail: 'james.park@jeppesen.com' },
  { business: 'Robert Thompson', businessEmail: 'robert.thompson@jeppesen.com', technical: 'Lisa Kim', technicalEmail: 'lisa.kim@jeppesen.com' },
  { business: 'Amanda Garcia', businessEmail: 'amanda.garcia@jeppesen.com', technical: 'Chris Lee', technicalEmail: 'chris.lee@jeppesen.com' },
  { business: 'Platform Team', businessEmail: 'platform@jeppesen.com', technical: 'DevOps Team', technicalEmail: 'devops@jeppesen.com' },
];

const COST_CENTERS = ['CC-1000', 'CC-2000', 'CC-3000', 'CC-4000', 'CC-5000', 'CC-6000'];
const CRITICALITIES = ['tier1', 'tier2', 'tier3', 'tier4'];
const ENVIRONMENTS = ['production', 'staging', 'development', 'test'];
const COMPLIANCE_OPTIONS = [
  ['SOX', 'PCI'],
  ['SOX'],
  ['PCI'],
  ['HIPAA'],
  ['SOX', 'HIPAA'],
  [],
];

/**
 * Simple hash function to get deterministic index from hostname
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a mock CMDB record for any hostname
 */
function generateMockRecord(hostname) {
  const hash = hashString(hostname);

  const app = APPLICATIONS[hash % APPLICATIONS.length];
  const owner = OWNERS[(hash >> 4) % OWNERS.length];
  const criticality = CRITICALITIES[(hash >> 8) % CRITICALITIES.length];
  const environment = hostname.toLowerCase().includes('prod') ? 'production'
    : hostname.toLowerCase().includes('stg') || hostname.toLowerCase().includes('stage') ? 'staging'
    : hostname.toLowerCase().includes('dev') ? 'development'
    : hostname.toLowerCase().includes('tst') || hostname.toLowerCase().includes('test') ? 'test'
    : ENVIRONMENTS[(hash >> 12) % ENVIRONMENTS.length];

  const compliance = COMPLIANCE_OPTIONS[(hash >> 16) % COMPLIANCE_OPTIONS.length];
  const costCenter = COST_CENTERS[(hash >> 20) % COST_CENTERS.length];

  // Generate a recent-ish last updated date
  const daysAgo = (hash % 90) + 1; // 1-90 days ago
  const lastUpdated = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

  return {
    ci_id: `CI${(hash % 9000000 + 1000000).toString()}`,
    hostname: hostname,
    fqdn: hostname.includes('.') ? hostname : `${hostname}.corp.jeppesen.com`,
    application: app.name,
    application_id: app.id,
    product: app.name,
    product_portfolio: app.portfolio,
    business_owner: owner.business,
    business_owner_email: owner.businessEmail,
    technical_owner: owner.technical,
    technical_owner_email: owner.technicalEmail,
    cost_center: costCenter,
    criticality: criticality,
    environment: environment,
    compliance_scope: compliance,
    last_updated: lastUpdated,
    last_updated_by: owner.technicalEmail,
    _generated: true,  // Flag to indicate this was dynamically generated
  };
}

/**
 * Look up a CMDB record by hostname
 * Supports exact match, case-insensitive match, partial match, and dynamic generation
 */
export function lookupCMDB(hostname) {
  if (!hostname) return null;

  // Try exact match first
  if (CMDB_RECORDS[hostname]) {
    return { ...CMDB_RECORDS[hostname], _matchType: 'exact' };
  }

  // Try case-insensitive match
  const lower = hostname.toLowerCase();
  for (const [key, value] of Object.entries(CMDB_RECORDS)) {
    if (key.toLowerCase() === lower) {
      return { ...value, _matchType: 'exact' };
    }
  }

  // Try partial match (hostname contains key or vice versa)
  for (const [key, value] of Object.entries(CMDB_RECORDS)) {
    const keyLower = key.toLowerCase();
    if (lower.includes(keyLower) || keyLower.includes(lower)) {
      return { ...value, _matchType: 'partial', _matchedKey: key };
    }
  }

  // Try pattern-based matching
  const patterns = [
    { pattern: /prod.*db/i, suggest: 'proddb01' },
    { pattern: /web.*api/i, suggest: 'webapi-east-1' },
    { pattern: /payment/i, suggest: 'payment-svc-01' },
    { pattern: /auth/i, suggest: 'auth-server-prod' },
    { pattern: /k8s|kube/i, suggest: 'k8s-master-01' },
    { pattern: /redis|cache/i, suggest: 'redis-cache-01' },
    { pattern: /jenkins|ci.*cd/i, suggest: 'jenkins-master' },
    { pattern: /monitor|grafana|prometheus/i, suggest: 'monitoring-01' },
    { pattern: /vault|secret/i, suggest: 'vault-server-01' },
    { pattern: /etl|data.*warehouse/i, suggest: 'dw-etl-01' },
    { pattern: /tableau|bi|reporting/i, suggest: 'tableau-server' },
    { pattern: /gateway|kong/i, suggest: 'api-gateway-01' },
    { pattern: /ldap|directory/i, suggest: 'ldap-01' },
    { pattern: /hr|workday/i, suggest: 'hr-portal-01' },
    { pattern: /fin.*app|finance.*app/i, suggest: 'fin-app-01' },
  ];

  for (const { pattern, suggest } of patterns) {
    if (pattern.test(hostname) && CMDB_RECORDS[suggest]) {
      return { ...CMDB_RECORDS[suggest], _matchType: 'pattern', _matchedKey: suggest };
    }
  }

  // Generate mock data for any hostname (for demo purposes)
  const generated = generateMockRecord(hostname);
  return { ...generated, _matchType: 'generated' };
}

/**
 * Expand a raw CMDB record into one or more records.
 * Multi-use workloads (those with an `applications` array) are expanded
 * into one record per app mapping, each carrying the shared workload fields
 * plus a `_multiUse` flag and the full list of app names.
 */
function expandRecord(record) {
  const allApps = [
    { application: record.application, application_id: record.application_id, product: record.product, product_portfolio: record.product_portfolio },
    ...(record.applications || []),
  ];
  const isMultiUse = allApps.length > 1;
  const appNames = allApps.map(a => a.application);

  return allApps.map(appMapping => ({
    ...record,
    application: appMapping.application,
    application_id: appMapping.application_id,
    product: appMapping.product,
    product_portfolio: appMapping.product_portfolio,
    _multiUse: isMultiUse,
    _allApplications: isMultiUse ? appNames : undefined,
  }));
}

/**
 * Get all CMDB records as an array.
 * Multi-use workloads are expanded into one record per application mapping.
 */
export function getAllCMDBRecords() {
  return Object.values(CMDB_RECORDS).flatMap(expandRecord);
}

/**
 * Get raw CMDB records without expansion (preserves `applications` array).
 */
export function getRawCMDBRecords() {
  return Object.values(CMDB_RECORDS);
}

/**
 * Search CMDB records by application name
 */
export function searchByApplication(appName) {
  const lower = appName.toLowerCase();
  return getAllCMDBRecords().filter(record =>
    record.application.toLowerCase().includes(lower)
  );
}

/**
 * Get all unique product portfolios
 */
export function getPortfolios() {
  const portfolios = new Set();
  getAllCMDBRecords().forEach(r => {
    if (r.product_portfolio) portfolios.add(r.product_portfolio);
  });
  APPLICATIONS.forEach(a => {
    if (a.portfolio) portfolios.add(a.portfolio);
  });
  return Array.from(portfolios).sort();
}

/**
 * Get applications belonging to a portfolio
 */
export function getApplicationsByPortfolio(portfolio) {
  const apps = new Set();
  getAllCMDBRecords().forEach(r => {
    if (r.product_portfolio === portfolio) apps.add(r.application);
  });
  APPLICATIONS.forEach(a => {
    if (a.portfolio === portfolio) apps.add(a.name);
  });
  return Array.from(apps).sort();
}

/**
 * Get unique products belonging to a portfolio
 */
export function getProductsByPortfolio(portfolio) {
  const products = new Set();
  getAllCMDBRecords().forEach(r => {
    if (r.product_portfolio === portfolio && r.product) products.add(r.product);
  });
  return Array.from(products).sort();
}

/**
 * Get unique applications for a product
 */
export function getApplicationsByProduct(productName) {
  const apps = new Set();
  getAllCMDBRecords().forEach(r => {
    if (r.product === productName && r.application) apps.add(r.application);
  });
  return Array.from(apps).sort();
}

/**
 * Get unique products for an application
 */
export function getProductsByApplication(appName) {
  const products = new Set();
  getAllCMDBRecords().forEach(r => {
    if (r.application === appName && r.product) products.add(r.product);
  });
  return Array.from(products).sort();
}

/**
 * Get CMDB records filtered by portfolio, application, and/or product
 */
export function getRecordsByFilters({ portfolio, application, product } = {}) {
  return getAllCMDBRecords().filter(r => {
    if (portfolio && r.product_portfolio !== portfolio) return false;
    if (application && r.application !== application) return false;
    if (product && r.product !== product) return false;
    return true;
  });
}
