export interface Portfolio {
  portfolio_id: string;
  name: string;
  snow_sys_id: string | null;
  state: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  asset_id: string;
  name: string;
  portfolio_id: string;
  snow_sys_id: string | null;
  full_name: string | null;
  description: string | null;
  criticality: string | null;
  environment: string | null;
  category: string | null;
  infrastructure: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppGrouping {
  app_grouping_id: string;
  name: string;
  asset_id: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Application {
  application_id: string;
  name: string;
  app_grouping_id: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComponentClass {
  component_class_id: string;
  name: string;
  label: string;
  color: string;
}

export interface ComponentType {
  component_type_id: string;
  class_name: string;
  label: string;
  color: string;
  component_class_id: string | null;
}

export interface Component {
  component_id: string;
  name: string | null;
  application_id: string;
  component_class_id: string | null;
  component_type_id: string | null;
  snow_sys_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workload {
  workload_id: string;
  hostname: string;
  ip_address: string | null;
  fqdn: string | null;
  os: string | null;
  environment: string | null;
  location: string | null;
  class_type: string | null;
  is_virtual: number | null;
  description: string | null;
}

export type EntityType = 'portfolio' | 'asset' | 'app_grouping' | 'application' | 'component';

export interface SelectedNode {
  type: EntityType;
  id: string;
  name: string;
  parentId?: string;
}

export interface ListResponse<T> {
  data: T[];
  count: number;
}
