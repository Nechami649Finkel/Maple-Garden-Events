export const FONT_SCALE_STEPS = [0.875, 1, 1.125, 1.25, 1.375] as const;

export const DEFAULT_FONT_SCALE_INDEX = 1;

export interface AccessibilitySettings {
  fontScaleIndex: number;
  grayscale: boolean;
  highContrast: boolean;
  negativeContrast: boolean;
  lightBackground: boolean;
  highlightLinks: boolean;
  readableFont: boolean;
}

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  fontScaleIndex: DEFAULT_FONT_SCALE_INDEX,
  grayscale: false,
  highContrast: false,
  negativeContrast: false,
  lightBackground: false,
  highlightLinks: false,
  readableFont: false,
};

const STORAGE_KEY = 'maple-a11y-settings';

const A11Y_CLASSES = {
  grayscale: 'a11y-grayscale',
  highContrast: 'a11y-high-contrast',
  negativeContrast: 'a11y-negative-contrast',
  lightBackground: 'a11y-light-bg',
  highlightLinks: 'a11y-highlight-links',
  readableFont: 'a11y-readable-font',
} as const;

function clampFontScaleIndex(index: number): number {
  return Math.max(0, Math.min(FONT_SCALE_STEPS.length - 1, index));
}

export function loadAccessibilitySettings(): AccessibilitySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ACCESSIBILITY_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AccessibilitySettings>;
    return {
      ...DEFAULT_ACCESSIBILITY_SETTINGS,
      ...parsed,
      fontScaleIndex: clampFontScaleIndex(
        parsed.fontScaleIndex ?? DEFAULT_FONT_SCALE_INDEX,
      ),
    };
  } catch {
    return { ...DEFAULT_ACCESSIBILITY_SETTINGS };
  }
}

export function saveAccessibilitySettings(settings: AccessibilitySettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function applyAccessibilitySettings(settings: AccessibilitySettings): void {
  const html = document.documentElement;
  const scale = FONT_SCALE_STEPS[clampFontScaleIndex(settings.fontScaleIndex)];

  html.style.fontSize = `${scale * 100}%`;

  (Object.keys(A11Y_CLASSES) as Array<keyof typeof A11Y_CLASSES>).forEach((key) => {
    html.classList.toggle(A11Y_CLASSES[key], settings[key]);
  });
}

export function initAccessibilitySettings(): AccessibilitySettings {
  const settings = loadAccessibilitySettings();
  applyAccessibilitySettings(settings);
  return settings;
}

export function resetAccessibilitySettings(): AccessibilitySettings {
  const settings = { ...DEFAULT_ACCESSIBILITY_SETTINGS };
  saveAccessibilitySettings(settings);
  applyAccessibilitySettings(settings);
  return settings;
}
