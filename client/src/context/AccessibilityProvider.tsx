import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  FONT_SCALE_STEPS,
  applyAccessibilitySettings,
  loadAccessibilitySettings,
  resetAccessibilitySettings,
  saveAccessibilitySettings,
  type AccessibilitySettings,
} from '../accessibility/accessibilitySettings';
import {
  AccessibilityContext,
  type AccessibilityContextValue,
} from './accessibilityContext';

function persistAndApply(next: AccessibilitySettings) {
  saveAccessibilitySettings(next);
  applyAccessibilitySettings(next);
  return next;
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => loadAccessibilitySettings());

  const increaseText = useCallback(() => {
    setSettings((prev) => {
      const nextIndex = Math.min(FONT_SCALE_STEPS.length - 1, prev.fontScaleIndex + 1);
      if (nextIndex === prev.fontScaleIndex) return prev;
      return persistAndApply({ ...prev, fontScaleIndex: nextIndex });
    });
  }, []);

  const decreaseText = useCallback(() => {
    setSettings((prev) => {
      const nextIndex = Math.max(0, prev.fontScaleIndex - 1);
      if (nextIndex === prev.fontScaleIndex) return prev;
      return persistAndApply({ ...prev, fontScaleIndex: nextIndex });
    });
  }, []);

  const toggleGrayscale = useCallback(() => {
    setSettings((prev) =>
      persistAndApply({
        ...prev,
        grayscale: !prev.grayscale,
        negativeContrast: false,
      }),
    );
  }, []);

  const toggleHighContrast = useCallback(() => {
    setSettings((prev) => persistAndApply({ ...prev, highContrast: !prev.highContrast }));
  }, []);

  const toggleNegativeContrast = useCallback(() => {
    setSettings((prev) =>
      persistAndApply({
        ...prev,
        negativeContrast: !prev.negativeContrast,
        grayscale: false,
      }),
    );
  }, []);

  const toggleLightBackground = useCallback(() => {
    setSettings((prev) =>
      persistAndApply({ ...prev, lightBackground: !prev.lightBackground }),
    );
  }, []);

  const toggleHighlightLinks = useCallback(() => {
    setSettings((prev) =>
      persistAndApply({ ...prev, highlightLinks: !prev.highlightLinks }),
    );
  }, []);

  const toggleReadableFont = useCallback(() => {
    setSettings((prev) => persistAndApply({ ...prev, readableFont: !prev.readableFont }));
  }, []);

  const reset = useCallback(() => {
    setSettings(resetAccessibilitySettings());
  }, []);

  const value = useMemo<AccessibilityContextValue>(
    () => ({
      settings,
      increaseText,
      decreaseText,
      toggleGrayscale,
      toggleHighContrast,
      toggleNegativeContrast,
      toggleLightBackground,
      toggleHighlightLinks,
      toggleReadableFont,
      reset,
      canIncreaseText: settings.fontScaleIndex < FONT_SCALE_STEPS.length - 1,
      canDecreaseText: settings.fontScaleIndex > 0,
    }),
    [
      settings,
      increaseText,
      decreaseText,
      toggleGrayscale,
      toggleHighContrast,
      toggleNegativeContrast,
      toggleLightBackground,
      toggleHighlightLinks,
      toggleReadableFont,
      reset,
    ],
  );

  return (
    <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>
  );
}
