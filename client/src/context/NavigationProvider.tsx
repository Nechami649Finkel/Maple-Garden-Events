import { useMemo, useState, type ReactNode } from 'react';
import {
  NavigationContext,
  type NavigationOverride,
} from './navigationContext';

export type { NavigationOverride };

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<NavigationOverride | null>(null);
  const value = useMemo(() => ({ override, setOverride }), [override]);
  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}
