import { useMemo, useState, type MouseEvent } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useDesignGalleryQuery } from '../../hooks/queries';
import { useToast } from '../ui/Toast/ToastProvider';
import {
  DESIGN_CATEGORY_TO_FORM_FIELD,
  DESIGN_GALLERY_CATEGORIES,
  designItemFullSrc,
  designItemMatchesSearch,
  designItemSelectionLabel,
  designItemThumbSrc,
  designModelDisplay,
  matchesDesignSelection,
  type DesignFormField,
  type DesignGalleryCategory,
  type DesignGalleryItemDto,
} from '@shared/gallery';
import { DesignImageLightbox } from './DesignImageLightbox';
import styles from './DesignGalleryPicker.module.css';

type TabId = DesignGalleryCategory | 'selected';

type Props = {
  selectedValues?: Partial<Record<DesignFormField, string>>;
  onSelect: (field: DesignFormField, value: string, item: DesignGalleryItemDto) => void;
  initialCategory?: DesignGalleryCategory;
  showSelectedTab?: boolean;
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
  initialCategory = 'tablecloths',
  showSelectedTab = true,
}: Props) {
  const { t, T } = useTranslation();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [lightbox, setLightbox] = useState<{ src: string; caption: string } | null>(null);
  const { data: items = [], isLoading, isError, refetch, isFetching } = useDesignGalleryQuery();

  const categoryLabels = useMemo(() => {
    const map = {} as Record<DesignGalleryCategory, string>;
    for (const cat of DESIGN_GALLERY_CATEGORIES) {
      map[cat] = t(T.EVENT_FORM[categoryLabelKey(cat)]);
    }
    return map;
  }, [t, T]);

  const list = items as DesignGalleryItemDto[];

  const switchTab = (tab: TabId) => {
    setActiveTab(tab);
    setSearchQuery('');
  };

  const filtered = useMemo(() => {
    if (activeTab === 'selected') return [];
    return list.filter(
      (item) =>
        item.category === activeTab
        && item.isActive !== false
        && designItemMatchesSearch(item, searchQuery),
    );
  }, [list, activeTab, searchQuery]);

  const selectedDetails = useMemo(() => {
    return DESIGN_GALLERY_CATEGORIES.map((category) => {
      const field = DESIGN_CATEGORY_TO_FORM_FIELD[category];
      const stored = selectedValues?.[field];
      const item = list.find((entry) => matchesDesignSelection(entry, stored));
      return {
        category,
        field,
        label: categoryLabels[category],
        stored: stored?.trim() || '',
        item: item ?? null,
        model: designModelDisplay(item, stored),
      };
    }).filter((row) => {
      if (!row.stored) return false;
      if (!searchQuery.trim()) return true;
      if (row.item) return designItemMatchesSearch(row.item, searchQuery);
      return row.stored.toLowerCase().includes(searchQuery.trim().toLowerCase());
    });
  }, [list, selectedValues, categoryLabels, searchQuery]);

  const selectedForCategory =
    activeTab !== 'selected'
      ? selectedValues?.[DESIGN_CATEGORY_TO_FORM_FIELD[activeTab]]
      : undefined;

  const handleSelect = (item: DesignGalleryItemDto) => {
    const category = item.category as DesignGalleryCategory;
    if (!DESIGN_GALLERY_CATEGORIES.includes(category)) return;
    const field = DESIGN_CATEGORY_TO_FORM_FIELD[category];
    onSelect(field, designItemSelectionLabel(item), item);
    showToast(t(T.EVENT_FORM.DESIGN_TOAST_SELECTED, { name: item.name }), 'success');
  };

  const openLightbox = (item: DesignGalleryItemDto, e?: MouseEvent) => {
    e?.stopPropagation();
    const full = designItemFullSrc(item);
    if (!full) return;
    setLightbox({
      src: full,
      caption: `${designModelDisplay(item) || item.name}${item.name ? ` · ${item.name}` : ''}`,
    });
  };

  const showSearchEmpty =
    !isLoading
    && !isFetching
    && !isError
    && Boolean(searchQuery.trim())
    && ((activeTab === 'selected' && selectedDetails.length === 0)
      || (activeTab !== 'selected' && filtered.length === 0));

  return (
    <div className={styles.picker}>
      <p className={styles.hint}>{t(T.EVENT_FORM.DESIGN_PICKER_HINT)}</p>

      <div className={styles.tabs} role="tablist" aria-label={t(T.EVENT_FORM.SECTION_GALLERY)}>
        {DESIGN_GALLERY_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={activeTab === category}
            className={`${styles.tabBtn} ${activeTab === category ? styles.tabBtnActive : ''}`}
            onClick={() => switchTab(category)}
          >
            {categoryLabels[category]}
          </button>
        ))}
        {showSelectedTab ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'selected'}
            className={`${styles.tabBtn} ${activeTab === 'selected' ? styles.tabBtnActive : ''}`}
            onClick={() => switchTab('selected')}
          >
            {t(T.EVENT_FORM.DESIGN_SELECTED_TAB)}
            {selectedDetails.length > 0 && !searchQuery.trim()
              ? ` (${selectedDetails.length})`
              : ''}
          </button>
        ) : null}
      </div>

      <div className={styles.searchWrap}>
        <label className={styles.searchLabel} htmlFor="design-gallery-search">
          {t(T.EVENT_FORM.DESIGN_SEARCH_LABEL)}
        </label>
        <input
          id="design-gallery-search"
          type="search"
          className={styles.searchInput}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t(T.EVENT_FORM.DESIGN_SEARCH_PLACEHOLDER)}
          autoComplete="off"
        />
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
      ) : showSearchEmpty ? (
        <div className={styles.stateMsg}>{t(T.EVENT_FORM.DESIGN_SEARCH_EMPTY)}</div>
      ) : activeTab === 'selected' ? (
        selectedDetails.length === 0 ? (
          <div className={styles.stateMsg}>{t(T.EVENT_FORM.DESIGN_SELECTED_EMPTY)}</div>
        ) : (
          <div className={styles.selectedGrid}>
            {selectedDetails.map((row) => {
              const thumb = row.item ? designItemThumbSrc(row.item) : '';
              return (
                <div key={row.category} className={styles.selectedCard}>
                  {thumb ? (
                    <button
                      type="button"
                      className={styles.imageButton}
                      onClick={() => row.item && openLightbox(row.item)}
                      aria-label={t(T.EVENT_FORM.DESIGN_ZOOM_ARIA, {
                        name: row.item?.name || row.stored,
                      })}
                    >
                      <img src={thumb} alt="" className={styles.image} loading="lazy" decoding="async" />
                    </button>
                  ) : (
                    <div className={styles.imagePlaceholder} />
                  )}
                  <div className={styles.cardContent}>
                    <div className={styles.categoryTag}>{row.label}</div>
                    {row.model ? <div className={styles.modelBadge}>{row.model}</div> : null}
                    <h3 className={styles.itemName}>{row.item?.name || row.stored}</h3>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className={styles.stateMsg}>{t(T.EVENT_FORM.DESIGN_GALLERY_EMPTY)}</div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((item) => {
            const label = designItemSelectionLabel(item);
            const isSelected =
              matchesDesignSelection(item, selectedForCategory)
              || selectedForCategory === label;
            const thumb = designItemThumbSrc(item);
            return (
              <div
                key={item.id}
                className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
              >
                {thumb ? (
                  <button
                    type="button"
                    className={styles.imageButton}
                    onClick={(e) => openLightbox(item, e)}
                    aria-label={t(T.EVENT_FORM.DESIGN_ZOOM_ARIA, { name: item.name })}
                  >
                    <img src={thumb} alt="" className={styles.image} loading="lazy" decoding="async" />
                  </button>
                ) : (
                  <div className={styles.imagePlaceholder} />
                )}
                <button
                  type="button"
                  className={styles.selectBtn}
                  onClick={() => handleSelect(item)}
                  aria-pressed={isSelected}
                  aria-label={t(T.EVENT_FORM.DESIGN_SELECT_ARIA, { name: item.name })}
                >
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
                    ) : (
                      <span className={styles.chooseBadge}>{t(T.EVENT_FORM.DESIGN_CHOOSE)}</span>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <DesignImageLightbox
        src={lightbox?.src ?? null}
        caption={lightbox?.caption}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}

export default DesignGalleryPicker;
