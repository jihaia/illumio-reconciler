import { useState, useEffect, useCallback } from 'react';
import { storage } from '../storage';
import type { ServiceNowConfig, IllumioConfig } from '../types';

export function useAuth() {
  const [snowConfig, setSnowConfig] = useState<ServiceNowConfig | null>(null);
  const [illumioConfig, setIllumioConfig] = useState<IllumioConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfigs();

    // Listen for storage changes
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.servicenow) {
        setSnowConfig(changes.servicenow.newValue ?? null);
      }
      if (changes.illumio) {
        setIllumioConfig(changes.illumio.newValue ?? null);
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, []);

  async function loadConfigs() {
    try {
      const [snow, illumio] = await Promise.all([
        storage.get('servicenow'),
        storage.get('illumio'),
      ]);
      setSnowConfig(snow);
      setIllumioConfig(illumio);
    } finally {
      setLoading(false);
    }
  }

  const saveSnowConfig = useCallback(async (config: ServiceNowConfig) => {
    await storage.set('servicenow', config);
    setSnowConfig(config);
  }, []);

  const saveIllumioConfig = useCallback(async (config: IllumioConfig) => {
    await storage.set('illumio', config);
    setIllumioConfig(config);
  }, []);

  const clearSnowConfig = useCallback(async () => {
    await storage.set('servicenow', null);
    setSnowConfig(null);
  }, []);

  const clearIllumioConfig = useCallback(async () => {
    await storage.set('illumio', null);
    setIllumioConfig(null);
  }, []);

  return {
    snowConfig,
    illumioConfig,
    loading,
    saveSnowConfig,
    saveIllumioConfig,
    clearSnowConfig,
    clearIllumioConfig,
  };
}
