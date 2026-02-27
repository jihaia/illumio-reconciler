import type { Node, Edge } from '@xyflow/react';
import type { ServiceInfo, AppComponent } from '@/shared/types';

// Raw record from background service worker
export interface GraphRecord {
  hostname: string;
  ip?: string;
  os?: string;
  environment?: string;
  classType?: string;       // sys_class_name
  fqdn?: string;
  virtual?: boolean;
  shortDescription?: string;
  services: string[];
  serviceDetails: ServiceInfo[];
  portfolios: string[];
  isMultiUse: boolean;
  components?: AppComponent[];  // app components running on this server
}

// Node data payloads
export interface PortfolioNodeData {
  label: string;
  name: string;
  productCount: number;
  workloadCount: number;
  [key: string]: unknown;
}

export interface ServiceNodeData {
  label: string;
  name: string;
  fullName?: string;
  description?: string;
  portfolio: string;
  workloadCount: number;
  criticality?: string;
  environment?: string;
  category?: string;
  infrastructure?: string;
  [key: string]: unknown;
}

export interface ComponentNodeData {
  label: string;
  name: string;
  className: string;         // sys_class_name
  componentType: string;     // human-readable type (Tomcat, WebLogic, etc.)
  shortDescription?: string;
  serverName: string;        // parent server hostname
  [key: string]: unknown;
}

export interface WorkloadNodeData {
  label: string;
  hostname: string;
  ip?: string;
  os?: string;
  environment?: string;
  classType?: string;
  fqdn?: string;
  virtual?: boolean;
  shortDescription?: string;
  services: string[];
  portfolios: string[];
  isMultiUse: boolean;
  isFocused?: boolean;
  envMismatches?: Array<{ service: string; serviceEnv: string }>;
  components?: string[];     // component names running on this server
  [key: string]: unknown;
}

export interface SwimlaneNodeData {
  label: string;
  color: string;
  laneWidth: number;
  laneHeight: number;
  [key: string]: unknown;
}

export type AppNode =
  | Node<PortfolioNodeData, 'portfolio'>
  | Node<ServiceNodeData, 'service'>
  | Node<ComponentNodeData, 'component'>
  | Node<WorkloadNodeData, 'workload'>
  | Node<SwimlaneNodeData, 'swimlane'>;

export type AppEdge = Edge;

// Filter state
export interface GraphFilters {
  portfolio: string;
  service: string;
  search: string;
}

// Detail panel
export type SelectedNodeType = 'portfolio' | 'service' | 'component' | 'workload';

export interface SelectedNodeInfo {
  type: SelectedNodeType;
  id: string;
  data: PortfolioNodeData | ServiceNodeData | ComponentNodeData | WorkloadNodeData;
}
