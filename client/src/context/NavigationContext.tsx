import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface NavigationOverride {
  onBack: () => void;
}

interface NavigationContextValue {
  override: NavigationOverride | null;
  setOverride: (override: NavigationOverride | null) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<NavigationOverride | null>(null);
  const value = useMemo(() => ({ override, setOverride }), [override]);
  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

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
