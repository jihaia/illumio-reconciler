import { useMemo } from 'react';
import { ServiceNowClient } from '../api/servicenow-client';
import { useAuth } from './useAuth';

export function useServiceNow() {
  const { snowConfig } = useAuth();

  const client = useMemo(() => {
    if (!snowConfig) return null;
    return new ServiceNowClient(
      snowConfig.instance,
      snowConfig.username,
      snowConfig.password
    );
  }, [snowConfig]);

  return {
    client,
    isConfigured: !!snowConfig,
  };
}
