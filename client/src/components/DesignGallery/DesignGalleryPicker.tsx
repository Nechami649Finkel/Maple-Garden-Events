import { useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useDesignGalleryQuery } from '../../hooks/queries';
import {
  DESIGN_CATEGORY_TO_FORM_FIELD,
  DESIGN_GALLERY_CATEGORIES,
  designItemSelectionLabel,
  type DesignFormField,
  type DesignGalleryCategory,
  type DesignGalleryItemDto,
} from '@shared/gallery';
import styles from './DesignGalleryPicker.module.css';

type Props = {
  /** Current form field values — used to highlight selected cards. */
  selectedValues?: Partial<Record<DesignFormField, string>>;
  onSelect: (field: DesignFormField, value: string, item: DesignGalleryItemDto) => void;
  /** Compact layout for embedding inside the event form. */
  compact?: boolean;
  initialCategory?: DesignGalleryCategory;
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

export function DesignGalleryPicker({
  selectedValues,
  onSelect,
  compact = false,
  initialCategory = 'tablecloths',
}: Props) {
  const { t, T } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<DesignGalleryCategory>(initialCategory);
  const { data: items = [], isLoading, isError, refetch, isFetching } = useDesignGalleryQuery();

  const categoryLabels = useMemo(() => {
    const map = {} as Record<DesignGalleryCategory, string>;
    for (const cat of DESIGN_GALLERY_CATEGORIES) {
      map[cat] = t(T.EVENT_FORM[categoryLabelKey(cat)]);
    }
    return map;
  }, [t, T]);

  const filtered = useMemo(
    () =>
      (items as DesignGalleryItemDto[]).filter(
        (item) => item.category === activeCategory && item.isActive !== false,
      ),
    [items, activeCategory],
  );

  const selectedForCategory = selectedValues?.[DESIGN_CATEGORY_TO_FORM_FIELD[activeCategory]];

  const handleSelect = (item: DesignGalleryItemDto) => {
    const category = item.category as DesignGalleryCategory;
    if (!DESIGN_GALLERY_CATEGORIES.includes(category)) return;
    const field = DESIGN_CATEGORY_TO_FORM_FIELD[category];
    onSelect(field, designItemSelectionLabel(item), item);
  };

  return (
    <div className={`${styles.picker} ${compact ? styles.compact : ''}`}>
      {!compact && (
        <p className={styles.hint}>{t(T.EVENT_FORM.DESIGN_PICKER_HINT)}</p>
      )}

      <div className={styles.tabs} role="tablist" aria-label={t(T.EVENT_FORM.SECTION_GALLERY)}>
        {DESIGN_GALLERY_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={activeCategory === category}
            className={`${styles.tabBtn} ${activeCategory === category ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveCategory(category)}
          >
            {categoryLabels[category]}
          </button>
        ))}
      </div>

      {isLoading || isFetching ? (
        <div className={styles.stateMsg}>{t(T.EVENT_FORM.DESIGN_GALLERY_LOADING)}</div>
      ) : isError ? (
        <div className={styles.stateMsg}>
          <p>{t(T.EVENT_FORM.DESIGN_GALLERY_ERROR)}</p>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => refetch()}>
            {t(T.GREETING.REFRESH)}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.stateMsg}>{t(T.EVENT_FORM.DESIGN_GALLERY_EMPTY)}</div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((item) => {
            const label = designItemSelectionLabel(item);
            const isSelected = selectedForCategory === label || selectedForCategory === item.name;
            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                onClick={() => handleSelect(item)}
                aria-pressed={isSelected}
                aria-label={t(T.EVENT_FORM.DESIGN_SELECT_ARIA, { name: item.name })}
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className={styles.image} loading="lazy" />
                ) : (
                  <div className={styles.imagePlaceholder} />
                )}
                <div className={styles.cardContent}>
                  {item.modelCode ? (
                    <div className={styles.modelBadge}>{item.modelCode}</div>
                  ) : null}
                  <h3 className={styles.itemName}>{item.name}</h3>
                  {item.description ? (
                    <p className={styles.itemDesc}>{item.description}</p>
                  ) : null}
                  {isSelected ? (
                    <span className={styles.selectedBadge}>{t(T.EVENT_FORM.DESIGN_SELECTED)}</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DesignGalleryPicker;
