import { useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useDesignGalleryQuery } from '../../hooks/queries';
import {
  DESIGN_CATEGORY_TO_FORM_FIELD,
  DESIGN_GALLERY_CATEGORIES,
  designModelDisplay,
  matchesDesignSelection,
  type DesignFormField,
  type DesignGalleryCategory,
  type DesignGalleryItemDto,
} from '@shared/gallery';
import styles from './DesignSelectionSummary.module.css';

type Props = {
  selectedValues: Partial<Record<DesignFormField, string>>;
  onOpenGallery: () => void;
};

function categoryLabelKey(category: DesignGalleryCategory) {
  switch (category) {
    case 'tablecloths':
      return 'LABEL_TABLECLOTHS' as const;
    case 'napkins':
      return 'LABEL_NAPKINS' as const;
    case 'centerpieces':
      return 'LABEL_CENTERPIECES' as const;
    case 'bridgeChair':
      return 'LABEL_BRIDE_CHAIR' as const;
  }
}

export function DesignSelectionSummary({ selectedValues, onOpenGallery }: Props) {
  const { t, T } = useTranslation();
  const { data: items = [] } = useDesignGalleryQuery();

  const rows = useMemo(() => {
    const list = items as DesignGalleryItemDto[];
    return DESIGN_GALLERY_CATEGORIES.map((category) => {
      const field = DESIGN_CATEGORY_TO_FORM_FIELD[category];
      const stored = selectedValues[field]?.trim() || '';
      const matched = list.find((item) => matchesDesignSelection(item, stored));
      const model = designModelDisplay(matched, stored);
      return {
        category,
        field,
        label: t(T.EVENT_FORM[categoryLabelKey(category)]),
        model: model || t(T.EVENT_FORM.DESIGN_NOT_SELECTED),
        hasSelection: Boolean(stored),
      };
    });
  }, [items, selectedValues, t, T]);

  return (
    <div className={styles.summary}>
      <div className={styles.headerRow}>
        <p className={styles.hint}>{t(T.EVENT_FORM.DESIGN_SUMMARY_HINT)}</p>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onOpenGallery}>
          {t(T.EVENT_FORM.DESIGN_OPEN_GALLERY)}
        </button>
      </div>
      <div className={styles.grid} role="list">
        {rows.map((row) => (
          <div
            key={row.category}
            className={`${styles.chip} ${row.hasSelection ? styles.chipSelected : ''}`}
            role="listitem"
          >
            <span className={styles.chipLabel}>{row.label}</span>
            <span className={styles.chipModel}>{row.model}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DesignSelectionSummary;
