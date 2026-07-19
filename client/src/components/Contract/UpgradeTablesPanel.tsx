import {
  buildAvailableLineItems,
  buildSelectedLineItems,
  formatMoneyLine,
  paymentNoteText,
  type ExtrasLineItem,
} from '../../utils/contractSections';
import type { UpgradeKey } from '../../utils/pricing';
import { useTranslation } from '../../i18n/useTranslation';
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
  labels: {
    service: string;
    price: string;
    paymentNote: string;
    action: string;
    adding: string;
    addToContract: string;
  },
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
              <th>{labels.service}</th>
              <th>{labels.price}</th>
              <th>{labels.paymentNote}</th>
              {showActions && <th>{labels.action}</th>}
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
                        {addingKey === item.key ? labels.adding : labels.addToContract}
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
  const { t, T } = useTranslation();

  const tableLabels = {
    service: t(T.BOOKINGS.UPGRADES_COL_SERVICE),
    price: t(T.UI.PRICE),
    paymentNote: t(T.BOOKINGS.UPGRADES_COL_PAYMENT_NOTE),
    action: t(T.COMMON.LABELS.ACTIONS),
    adding: t(T.UI.ADDING),
    addToContract: t(T.BOOKINGS.ADD_TO_CONTRACT),
  };

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
      <div className="card-header maple-section-header">{t(T.BOOKINGS.UPGRADE_TABLES_TITLE)}</div>
      <div className="card-body">
        {renderTable(
          t(T.BOOKINGS.SELECTED_UPGRADES),
          selectedItems,
          t(T.BOOKINGS.NO_SELECTED_UPGRADES),
          false,
          tableLabels,
        )}
        {renderTable(
          t(T.BOOKINGS.AVAILABLE_UPGRADES),
          availableItems,
          t(T.BOOKINGS.ALL_UPGRADES_INCLUDED),
          true,
          tableLabels,
          onAddUpgrade,
          addingKey,
        )}
        <p className={styles.marketingNote}>
          {t(T.BOOKINGS.UPGRADE_TABLES_HELP)}
        </p>
      </div>
    </div>
  );
};

export default UpgradeTablesPanel;
