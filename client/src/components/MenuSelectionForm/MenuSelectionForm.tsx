import { useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import styles from '../MenuDisplay/MenuDisplay.module.css';
import { menuData, CATEGORY_LIMITS } from '../MenuDisplay/menuData';

interface MenuSelectionFormProps {
  initialSelections?: Record<string, string[]> | null;
  onSaveMenu?: (selections: Record<string, string[]>) => void;
}

const MenuSelectionForm: React.FC<MenuSelectionFormProps> = ({ initialSelections, onSaveMenu }) => {
  const { t, T } = useTranslation();
  const [selections, setSelections] = useState<Record<string, string[]>>(initialSelections || {});

  const handleToggleItem = (category: string, itemName: string) => {
    setSelections((prev) => {
      const currentCategorySelections = prev[category] || [];
      const isCurrentlySelected = currentCategorySelections.includes(itemName);

      if (isCurrentlySelected) {
        return {
          ...prev,
          [category]: currentCategorySelections.filter((name) => name !== itemName),
        };
      }

      const limit = CATEGORY_LIMITS[category] || Infinity;
      if (currentCategorySelections.length >= limit) {
        alert(t(T.MENU.MAX_ITEMS_ALERT));
        return prev;
      }

      return {
        ...prev,
        [category]: [...currentCategorySelections, itemName],
      };
    });
  };

  const handleFinalizeMenu = () => {
    if (onSaveMenu) {
      onSaveMenu(selections);
    } else {
      console.log('Menu selections:', selections);
      alert(t(T.MENU.SAVED_SUCCESS));
    }
  };

  return (
    <div className={styles.menuWrapper}>
      <div className={styles.header}>
        <div className={styles.logoContainer}>
          <img src="/logo.png" alt="Maple Logo" className={styles.menuLogo} />
        </div>
        <h2 className={styles.mainTitle}>{t(T.MENU.SELECTION_TITLE)}</h2>
        <div className={styles.accentLine}></div>
        <p style={{ textAlign: 'center', marginTop: '10px' }}>{t(T.MENU.SELECTION_INSTRUCTIONS)}</p>
      </div>

      <div className={styles.menuContent}>
        {menuData.map((section, index) => {
          const limit = CATEGORY_LIMITS[section.category];
          const selectedCount = (selections[section.category] || []).length;

          return (
            <div key={index} className={styles.sectionBlock}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  {section.category}
                  {limit && (
                    <span style={{ fontSize: '0.8em', color: '#888', marginRight: '10px' }}>
                      {t(T.MENU.SELECTION_COUNT, { selected: selectedCount, limit })}
                    </span>
                  )}
                </h3>
                {section.subtitle && <p className={styles.sectionSubtitle}>{section.subtitle}</p>}
              </div>

              <div className={styles.subCategoriesWrapper}>
                {section.subCategories.map((sub, subIdx) => (
                  <div key={subIdx} className={styles.subCategoryGroup}>
                    {sub.name && <h4 className={styles.subCategoryName}>{sub.name}</h4>}
                    <ul className={styles.itemsList}>
                      {sub.items.map((item, itemIdx) => {
                        const isChecked = (selections[section.category] || []).includes(item.name);

                        return (
                          <li
                            key={itemIdx}
                            className={styles.itemRow}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              cursor: 'pointer',
                              padding: '5px 0',
                            }}
                            onClick={() => handleToggleItem(section.category, item.name)}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              style={{ marginLeft: '12px', transform: 'scale(1.3)', cursor: 'pointer' }}
                            />
                            <p className={styles.itemText} style={{ margin: 0, userSelect: 'none' }}>
                              {item.name}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '40px 0' }}>
        <button
          onClick={handleFinalizeMenu}
          style={{
            padding: '15px 40px',
            fontSize: '18px',
            backgroundColor: '#d4af37',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          {t(T.MENU.CONFIRM_SAVE)}
        </button>
      </div>

      <div className={styles.footer}>
        <p className={styles.footerInfo}>{t(T.MENU.FOOTER_ADDRESS)}</p>
        <p className={styles.footerNote}>{t(T.MENU.FOOTER_KASHRUT_NOTE)}</p>
      </div>
    </div>
  );
};

export default MenuSelectionForm;
