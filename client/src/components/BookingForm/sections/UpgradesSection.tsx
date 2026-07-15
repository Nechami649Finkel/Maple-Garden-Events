import {
  UPGRADE_DISPLAY_ORDER,
  UPGRADE_LABELS,
  HALL_UPGRADE_KEYS,
  type UpgradeKey,
} from '../../../utils/pricing';
import { EXTERNAL_SUPPLIER_LINKS } from '../bookingFormConstants';

interface UpgradesSectionProps {
  upgrades: Record<string, boolean>;
  handleUpgradeChange: (key: UpgradeKey) => void;
  upgradesPricing: Record<string, number>;
  upgradeDisplayOrder?: readonly UpgradeKey[];
  isHallOnly: boolean;
}

const UpgradesSection = ({
  upgrades,
  handleUpgradeChange,
  upgradesPricing,
  upgradeDisplayOrder = UPGRADE_DISPLAY_ORDER,
  isHallOnly,
}: UpgradesSectionProps) => {
  const isHallUpgrade = (key: string) => (HALL_UPGRADE_KEYS as readonly string[]).includes(key);

  const renderUpgrade = (key: UpgradeKey) => {
    const disabled = key === 'baseDesign' && isHallOnly;
    const checked = disabled ? false : upgrades[key];
    const isExternal = !isHallUpgrade(key);

    return (
      <div key={key} className={`maple-upgrade-row ${disabled ? 'maple-upgrade-disabled' : ''}`}>
        <div className="form-check">
          <input
            type="checkbox"
            className="form-check-input"
            id={`upgrade-${key}`}
            checked={checked}
            readOnly={key === 'baseDesign'}
            disabled={disabled}
            onChange={() => !disabled && handleUpgradeChange(key)}
          />
          <label className="form-check-label" htmlFor={`upgrade-${key}`}>
            {UPGRADE_LABELS[key]}
            {key === 'baseDesign' && !isHallOnly ? ' (חובה)' : ''}
            {' - '}{(upgradesPricing[key] ?? 0).toLocaleString()} ₪
            {isExternal && checked && !disabled && (
              <a
                href={EXTERNAL_SUPPLIER_LINKS[key]}
                target="_blank"
                rel="noopener noreferrer"
                className="maple-external-link"
                onClick={(e) => e.stopPropagation()}
              >
                תשלום לספק ↗
              </a>
            )}
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="card mb-3">
      <div className="card-header maple-section-header">חבילת תוספות ושדרוגים</div>
      <div className="card-body">
        {upgradeDisplayOrder.map(renderUpgrade)}
      </div>
    </div>
  );
};

export default UpgradesSection;
