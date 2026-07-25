import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../services/api';
import { API_BASE } from '../config/api';

interface TenantBranding {
  venueName: string;
  logoUrl: string;
}

const DEFAULT_BRANDING: TenantBranding = {
  venueName: 'Maple Garden Events',
  logoUrl: '/assets/maple-default-logo.png',
};

const TenantBrandingContext = createContext<TenantBranding>(DEFAULT_BRANDING);

interface ProviderProps {
  children: ReactNode;
  isAuthenticated: boolean | null;
}

export const TenantBrandingProvider = ({ children, isAuthenticated }: ProviderProps) => {
  const { data: branding } = useQuery({
    queryKey: ['tenantBranding'],
    queryFn: async () => {
      const response = await apiFetch(`${API_BASE}/api/settings/branding`);
      if (!response.ok) throw new Error('Failed to fetch branding');
      const data = await response.json();
      return data as TenantBranding;
    },
    staleTime: 1000 * 60 * 60 * 24, // Cache for 24 hours
    retry: 1, // Only retry once to fail fast if it doesn't exist
    enabled: isAuthenticated === true,
  });

  const currentBranding: TenantBranding = {
    venueName: branding?.venueName || DEFAULT_BRANDING.venueName,
    logoUrl: branding?.logoUrl || DEFAULT_BRANDING.logoUrl,
  };

  return (
    <TenantBrandingContext.Provider value={currentBranding}>
      {children}
    </TenantBrandingContext.Provider>
  );
};

export const useTenantBranding = () => {
  return useContext(TenantBrandingContext);
};
