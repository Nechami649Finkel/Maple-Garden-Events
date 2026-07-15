import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadUiPrefs, saveUiPrefs } from '../utils/uiPrefs';
import { SidebarContext } from './sidebarContext';

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
