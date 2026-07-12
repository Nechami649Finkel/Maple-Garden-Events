import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadUiPrefs, saveUiPrefs } from '../utils/uiPrefs';

interface SidebarContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(() => loadUiPrefs().sidebarOpen ?? false);

  useEffect(() => {
    saveUiPrefs({ sidebarOpen: isOpen });
  }, [isOpen]);

  const value = useMemo(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((prev) => !prev),
    }),
    [isOpen],
  );
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error('useSidebar requires SidebarProvider');
  }
  return ctx;
}
