import { createContext, useContext } from 'react';
import type { AccessibilitySettings } from '../accessibility/accessibilitySettings';

export interface AccessibilityContextValue {
  settings: AccessibilitySettings;
  increaseText: () => void;
  decreaseText: () => void;
  toggleGrayscale: () => void;
  toggleHighContrast: () => void;
  toggleNegativeContrast: () => void;
  toggleLightBackground: () => void;
  toggleHighlightLinks: () => void;
  toggleReadableFont: () => void;
  reset: () => void;
  canIncreaseText: boolean;
  canDecreaseText: boolean;
}

export const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export function useAccessibility(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return ctx;
}
