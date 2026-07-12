import {
  buildAvailableLineItems,
  buildSelectedLineItems,
  formatMoneyLine,
  paymentNoteText,
  type ExtrasLineItem,
} from '../../utils/contractSections';
import type { UpgradeKey } from '../../utils/pricing';
import styles from './UpgradeTablesPanel.module.css';

interface UpgradeTablesPanelProps {
  upgrades: Record<string, boolean>;
  onAddUpgrade: (key: UpgradeKey) => void | Promise<void>;
  upgradesPricing: Record<string, number>;
  kosherType: string;
  guestCount: number;
  isHallOnly: boolean;
  isFoodRelevant: boolean;
  upgradeDisplayOrder?: readonly UpgradeKey[];
  addingKey?: string | null;
}

function renderTable(
  title: string,
  items: ExtrasLineItem[],
  emptyMessage: string,
  showActions: boolean,
  onAdd?: (key: UpgradeKey) => void,
  addingKey?: string | null,
) {
  return (
    <div className={styles.tableBlock}>
      <h4 className={styles.tableTitle}>{title}</h4>
      <div className="table-responsive">
        <table className={`table table-bordered table-sm ${styles.table}`}>
          <thead>
            <tr>
              <th>שירות</th>
              <th>מחיר</th>
              <th>הערת תשלום</th>
              {showActions && <th>פעולה</th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={showActions ? 4 : 3} className={styles.emptyCell}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.key ?? item.label}>
                  <td>{item.label}</td>
                  <td>{formatMoneyLine(item.price)}</td>
                  <td>{paymentNoteText(item.paidTo)}</td>
                  {showActions && item.key && (
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        disabled={addingKey === item.key}
                        onClick={() => onAdd?.(item.key as UpgradeKey)}
                      >
                        {addingKey === item.key ? 'מוסיף...' : 'הוסף לחוזה'}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const UpgradeTablesPanel = ({
  upgrades,
  onAddUpgrade,
  upgradesPricing,
  kosherType,
  guestCount,
  isHallOnly,
  isFoodRelevant,
  upgradeDisplayOrder,
  addingKey,
}: UpgradeTablesPanelProps) => {
  const lineItemOptions = {
    upgrades,
    kosherType,
    guestCount,
    isHallOnly,
    isFoodRelevant,
    upgradesPricing,
    upgradeKeys: upgradeDisplayOrder,
  };

  const selectedItems = buildSelectedLineItems(lineItemOptions);
  const availableItems = buildAvailableLineItems(lineItemOptions);

  return (
    <div className={`card mb-3 ${styles.panel}`}>
      <div className="card-header maple-section-header">טבלאות תוספות לחוזה</div>
      <div className="card-body">
        {renderTable(
          'תוספות ושדרוגים שנבחרו',
          selectedItems,
          'לא נבחרו תוספות או שדרוגים בנוסף לתנאי הבסיס בחוזה.',
          false,
        )}
        {renderTable(
          'אפשרויות לשדרוג נוסף',
          availableItems,
          'כל שירותי השדרוג הזמינים נכללו בהזמנה.',
          true,
          onAddUpgrade,
          addingKey,
        )}
        <p className={styles.marketingNote}>
          שירותים בטבלה השנייה יופיעו גם ב-PDF החוזה כהצעה ללקוח. לחיצה על &quot;הוסף לחוזה&quot; מעדכנת את
          החוזה והמחיר.
        </p>
      </div>
    </div>
  );
};

export default UpgradeTablesPanel;
