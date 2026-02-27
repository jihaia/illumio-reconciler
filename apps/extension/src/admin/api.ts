import type {
  Portfolio, Asset, AppGrouping, Application, Component,
  ComponentClass, ComponentType, Workload, ListResponse,
} from './types';

const BASE = 'http://localhost:8080/v1/cmdb';

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  if (opts?.method === 'DELETE') return { deleted: true } as T;
  return res.json();
}

function qs(params: Record<string, string | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

// ─── Portfolios ────────────────────────────────────────

export const listPortfolios = (q?: string) =>
  request<ListResponse<Portfolio>>(`/portfolios${qs({ q })}`);

export const getPortfolio = (id: string) =>
  request<Portfolio>(`/portfolios/${id}`);

export const createPortfolio = (data: { name: string; description?: string; state?: string }) =>
  request<Portfolio>('/portfolios', { method: 'POST', body: JSON.stringify(data) });

export const updatePortfolio = (id: string, data: Record<string, any>) =>
  request<Portfolio>(`/portfolios/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deletePortfolio = (id: string) =>
  request<{ deleted: boolean }>(`/portfolios/${id}`, { method: 'DELETE' });

// ─── Assets ────────────────────────────────────────────

export const listAssets = (portfolioId?: string, q?: string, name?: string) =>
  request<ListResponse<Asset>>(`/assets${qs({ portfolio_id: portfolioId, q, name })}`);

export const getAsset = (id: string) =>
  request<Asset>(`/assets/${id}`);

export const createAsset = (data: { name: string; portfolio_id: string; [k: string]: any }) =>
  request<Asset>('/assets', { method: 'POST', body: JSON.stringify(data) });

export const updateAsset = (id: string, data: Record<string, any>) =>
  request<Asset>(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteAsset = (id: string) =>
  request<{ deleted: boolean }>(`/assets/${id}`, { method: 'DELETE' });

// ─── App Groupings ─────────────────────────────────────

export const listAppGroupings = (assetId?: string, q?: string, name?: string) =>
  request<ListResponse<AppGrouping>>(`/app-groupings${qs({ asset_id: assetId, q, name })}`);

export const getAppGrouping = (id: string) =>
  request<AppGrouping>(`/app-groupings/${id}`);

export const createAppGrouping = (data: { name: string; asset_id: string; description?: string }) =>
  request<AppGrouping>('/app-groupings', { method: 'POST', body: JSON.stringify(data) });

export const updateAppGrouping = (id: string, data: Record<string, any>) =>
  request<AppGrouping>(`/app-groupings/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteAppGrouping = (id: string) =>
  request<{ deleted: boolean }>(`/app-groupings/${id}`, { method: 'DELETE' });

// ─── Applications ──────────────────────────────────────

export const listApplications = (appGroupingId?: string, q?: string, name?: string) =>
  request<ListResponse<Application>>(`/applications${qs({ app_grouping_id: appGroupingId, q, name })}`);

export const getApplication = (id: string) =>
  request<Application>(`/applications/${id}`);

export const createApplication = (data: { name: string; app_grouping_id: string; description?: string }) =>
  request<Application>('/applications', { method: 'POST', body: JSON.stringify(data) });

export const updateApplication = (id: string, data: Record<string, any>) =>
  request<Application>(`/applications/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteApplication = (id: string) =>
  request<{ deleted: boolean }>(`/applications/${id}`, { method: 'DELETE' });

// ─── Components ────────────────────────────────────────

export const listComponents = (applicationId?: string, q?: string, name?: string) =>
  request<ListResponse<Component>>(`/components${qs({ application_id: applicationId, q, name })}`);

export const getComponent = (id: string) =>
  request<Component>(`/components/${id}`);

export const createComponent = (data: { application_id: string; component_class_id?: string; component_type_id?: string; name?: string; description?: string }) =>
  request<Component>('/components', { method: 'POST', body: JSON.stringify(data) });

export const updateComponent = (id: string, data: Record<string, any>) =>
  request<Component>(`/components/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteComponent = (id: string) =>
  request<{ deleted: boolean }>(`/components/${id}`, { method: 'DELETE' });

// ─── Component Classes (read-only) ────────────────────

export const listComponentClasses = () =>
  request<ListResponse<ComponentClass>>('/component-classes?limit=100');

// ─── Component Types (read-only, filterable by class) ─

export const listComponentTypes = (classId?: string) =>
  request<ListResponse<ComponentType>>(`/component-types${qs({ class_id: classId, limit: '200' })}`);

// ─── Workloads (for linking) ──────────────────────────

export const searchWorkloads = (q: string) =>
  request<ListResponse<Workload>>(`/workloads${qs({ q, limit: '20' })}`);

// ─── Component-Workload Junction ──────────────────────

export const listComponentWorkloads = (componentId: string) =>
  request<ListResponse<Workload>>(`/components/${componentId}/workloads`);

export const linkWorkload = (componentId: string, workloadId: string) =>
  request<{ linked: boolean }>(`/components/${componentId}/workloads`, {
    method: 'POST',
    body: JSON.stringify({ workload_id: workloadId }),
  });

export const unlinkWorkload = (componentId: string, workloadId: string) =>
  request<{ deleted: boolean }>(`/components/${componentId}/workloads/${workloadId}`, {
    method: 'DELETE',
  });

// ─── Health ───────────────────────────────────────────

export const checkHealth = () =>
  request<{ status: string }>('/health');
