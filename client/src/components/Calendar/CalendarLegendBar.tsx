import { useId, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import {
  TIME_SLOTS,
  SLOT_COLORS,
  formatSlotLabel,
  type TimeSlot,
} from '../../utils/timeSlot';
import styles from './CalendarLegendBar.module.css';

const FORBIDDEN_COLOR = '#E53E3E';
const PARTIAL_COLOR = '#D69E2E';

type LegendMarker = 'triangle' | 'dot';

interface LegendItem {
  id: string;
  marker: LegendMarker;
  color: string;
  label: string;
}

interface CalendarLegendBarProps {
  showWeddingRestrictions?: boolean;
}

function LegendSwatch({ marker, color }: { marker: LegendMarker; color: string }) {
  if (marker === 'triangle') {
    return (
      <span
        className={styles.triangle}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className={styles.dot}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

export function CalendarLegendBar({ showWeddingRestrictions = false }: CalendarLegendBarProps) {
  const { t, T } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  const items: LegendItem[] = [
    ...(showWeddingRestrictions
      ? [
          {
            id: 'forbidden',
            marker: 'triangle' as const,
            color: FORBIDDEN_COLOR,
            label: t(T.CALENDAR.LEGEND_FORBIDDEN),
          },
          {
            id: 'partial',
            marker: 'triangle' as const,
            color: PARTIAL_COLOR,
            label: t(T.CALENDAR.LEGEND_PARTIAL),
          },
        ]
      : []),
    ...TIME_SLOTS.map((slot: TimeSlot) => ({
      id: slot,
      marker: 'dot' as const,
      color: SLOT_COLORS[slot],
      label: formatSlotLabel(t, slot),
    })),
  ];

  return (
    <div className={styles.root} dir="rtl">
      <div
        id={panelId}
        className={`${styles.panel} ${expanded ? styles.panelOpen : ''}`}
        aria-hidden={!expanded}
      >
        <div className={styles.legendRow} role="list">
          {items.map((item) => (
            <div key={item.id} className={styles.legendItem} role="listitem">
              <LegendSwatch marker={item.marker} color={item.color} />
              <span className={styles.legendLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((open) => !open)}
      >
        <span>{expanded ? t(T.CALENDAR.HIDE_LEGEND) : t(T.CALENDAR.VIEW_LEGEND)}</span>
        <svg
          className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3.5 5.25L7 8.75L10.5 5.25"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
