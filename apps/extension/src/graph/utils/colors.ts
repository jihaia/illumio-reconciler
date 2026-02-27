export const ENV_COLORS: Record<string, string> = {
  production: '#10b981',
  staging: '#3b82f6',
  development: '#f59e0b',
  test: '#8b5cf6',
  dr: '#ec4899',
};

export const DEFAULT_ENV_COLOR = '#94a3b8';

export function getEnvColor(environment?: string): string {
  if (!environment) return DEFAULT_ENV_COLOR;
  return ENV_COLORS[environment.toLowerCase()] ?? DEFAULT_ENV_COLOR;
}
