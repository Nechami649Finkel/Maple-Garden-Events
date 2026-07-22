import { createContext, useContext, useEffect } from 'react';

export interface NavigationOverride {
  onBack: () => void;
}

export interface NavigationContextValue {
  override: NavigationOverride | null;
  setOverride: (override: NavigationOverride | null) => void;
}

export const NavigationContext = createContext<NavigationContextValue | null>(null);

export function useNavigationContext(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useNavigationContext requires NavigationProvider');
  }
  return ctx;
}

/** מאפשר לעמוד להחליף את פעולת "חזרה" בכותרת (למשל חזרה לרשימה בתוך אותו עמוד). */
export function useNavigationOverride(override: NavigationOverride | null | undefined) {
  const { setOverride } = useNavigationContext();

  useEffect(() => {
    if (!override) {
      setOverride(null);
      return;
    }
    setOverride(override);
    return () => setOverride(null);
  }, [override, setOverride]);
}
