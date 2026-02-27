import { useMemo } from 'react';
import { IllumioClient } from '../api/illumio-client';
import { useAuth } from './useAuth';

export function useIllumio() {
  const { illumioConfig } = useAuth();

  const client = useMemo(() => {
    if (!illumioConfig) return null;
    return new IllumioClient(
      illumioConfig.pceUrl,
      illumioConfig.apiKeyId,
      illumioConfig.apiKeySecret,
      illumioConfig.orgId
    );
  }, [illumioConfig]);

  return {
    client,
    isConfigured: !!illumioConfig,
  };
}
