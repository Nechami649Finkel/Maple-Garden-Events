import { useEffect, useId, useRef, useState } from 'react';
import type { AccessibilitySettings } from '../../accessibility/accessibilitySettings';
import { useAccessibility } from '../../context/accessibilityContext';
import { useTranslation } from '../../i18n/useTranslation';
import { T, type TranslationKey } from '@shared/i18n';
import styles from './AccessibilityWidget.module.css';

type ToolAction =
  | 'increaseText'
  | 'decreaseText'
  | 'grayscale'
  | 'highContrast'
  | 'negativeContrast'
  | 'lightBackground'
  | 'highlightLinks'
  | 'readableFont'
  | 'reset';

const TOOL_KEYS: Record<ToolAction, TranslationKey> = {
  increaseText: T.ACCESSIBILITY.INCREASE_TEXT,
  decreaseText: T.ACCESSIBILITY.DECREASE_TEXT,
  grayscale: T.ACCESSIBILITY.GRAYSCALE,
  highContrast: T.ACCESSIBILITY.HIGH_CONTRAST,
  negativeContrast: T.ACCESSIBILITY.NEGATIVE_CONTRAST,
  lightBackground: T.ACCESSIBILITY.LIGHT_BACKGROUND,
  highlightLinks: T.ACCESSIBILITY.HIGHLIGHT_LINKS,
  readableFont: T.ACCESSIBILITY.READABLE_FONT,
  reset: T.ACCESSIBILITY.RESET,
};

const TOOLS: Array<{
  id: ToolAction;
  icon: string;
  activeKey?: keyof AccessibilitySettings;
}> = [
  { id: 'increaseText', icon: 'A+' },
  { id: 'decreaseText', icon: 'A−' },
  { id: 'grayscale', icon: '◐', activeKey: 'grayscale' },
  { id: 'highContrast', icon: '◑', activeKey: 'highContrast' },
  { id: 'negativeContrast', icon: '◎', activeKey: 'negativeContrast' },
  { id: 'lightBackground', icon: '☀', activeKey: 'lightBackground' },
  { id: 'highlightLinks', icon: '🔗', activeKey: 'highlightLinks' },
  { id: 'readableFont', icon: 'Aa', activeKey: 'readableFont' },
  { id: 'reset', icon: '↺' },
];

export function AccessibilityWidget() {
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const {
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
    canIncreaseText,
    canDecreaseText,
  } = useAccessibility();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  const runAction = (action: ToolAction) => {
    switch (action) {
      case 'increaseText':
        if (canIncreaseText) increaseText();
        break;
      case 'decreaseText':
        if (canDecreaseText) decreaseText();
        break;
      case 'grayscale':
        toggleGrayscale();
        break;
      case 'highContrast':
        toggleHighContrast();
        break;
      case 'negativeContrast':
        toggleNegativeContrast();
        break;
      case 'lightBackground':
        toggleLightBackground();
        break;
      case 'highlightLinks':
        toggleHighlightLinks();
        break;
      case 'readableFont':
        toggleReadableFont();
        break;
      case 'reset':
        reset();
        break;
      default:
        break;
    }
  };

  const isActive = (action: ToolAction) => {
    if (action === 'reset') return false;
    const tool = TOOLS.find((item) => item.id === action);
    if (!tool?.activeKey) return false;
    return Boolean(settings[tool.activeKey]);
  };

  const isDisabled = (action: ToolAction) => {
    if (action === 'increaseText') return !canIncreaseText;
    if (action === 'decreaseText') return !canDecreaseText;
    return false;
  };

  return (
    <div className={`${styles.root} a11y-widget`} ref={panelRef}>
      {open && (
        <section
          id={panelId}
          className={`${styles.panel} a11y-widget-panel`}
          aria-label={t(T.ACCESSIBILITY.PANEL_ARIA)}
        >
          <header className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>{t(T.ACCESSIBILITY.PANEL_TITLE)}</h2>
          </header>
          <ul className={styles.toolList}>
            {TOOLS.map((tool) => (
              <li key={tool.id}>
                <button
                  type="button"
                  className={[
                    styles.toolBtn,
                    isActive(tool.id) ? styles.toolBtnActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => runAction(tool.id)}
                  disabled={isDisabled(tool.id)}
                  aria-pressed={tool.activeKey ? isActive(tool.id) : undefined}
                >
                  <span className={styles.toolIcon} aria-hidden="true">
                    {tool.icon}
                  </span>
                  <span>{t(TOOL_KEYS[tool.id])}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        className={`${styles.toggle} a11y-widget-toggle`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t(T.ACCESSIBILITY.TOGGLE_CLOSE) : t(T.ACCESSIBILITY.TOGGLE_OPEN)}
        onClick={() => setOpen((prev) => !prev)}
      >
        <img
          src="/accessibility-wheelchair.svg?v=3"
          alt=""
          className={styles.toggleIcon}
          width={52}
          height={52}
          draggable={false}
        />
      </button>
    </div>
  );
}
