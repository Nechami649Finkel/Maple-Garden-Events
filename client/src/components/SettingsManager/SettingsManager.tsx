import { useState, useEffect } from 'react';
import './SettingsManager.css';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../services/api';
import { API_URL } from '../../config/api';
import {
  useGlobalSettingsQuery,
  useExtrasQuery,
  useStaffQuery,
  useKashrutQuery,
} from '../../hooks/queries';
import { AuthorizedUsers } from './AuthorizedUsers';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';
import { PageLoader } from '../PageLoader/PageLoader';
import PaymentTemplatesSettings from './PaymentTemplatesSettings';
import { getPaymentTemplatesFromSettings } from '../../utils/paymentTerms';
import { calendarKeyFromDbDate } from '../../utils/dateLocal';
import {
  getHiddenSystemPriceFields,
  getVisibleSystemPriceFields,
  getPriceFieldLabel,
  NON_REMOVABLE_PRICE_FIELDS,
  parseHiddenPriceFields,
} from '../../utils/pricing';
import { useTranslation } from '../../i18n/useTranslation';
import { Icon } from '../ui/Icon';
import { translateByValue } from '@shared/i18n/bookingLookups';
import { T, type TranslationKey } from '@shared/i18n/keys';

const EXTRA_CATEGORY_KEY_BY_VALUE: Record<string, TranslationKey> = {
  עיצוב: T.SETTINGS.CATEGORY_DESIGN,
  טכני: T.SETTINGS.CATEGORY_TECH,
  צוות: T.SETTINGS.CATEGORY_STAFF,
  אחר: T.SETTINGS.CATEGORY_OTHER,
};

export const SettingsManager = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: globalSettingsData, isLoading: settingsLoading } = useGlobalSettingsQuery();
  const { data: extras = [], isLoading: extrasLoading } = useExtrasQuery();
  const { data: kashrutsData = [], isLoading: kashrutLoading } = useKashrutQuery();
  const { data: staffMembers = [], isLoading: staffLoading } = useStaffQuery();

  const [globalSettings, setGlobalSettings] = useState<any>({});
  const [kashruts, setKashruts] = useState<any[]>([]);
  const [newExtra, setNewExtra] = useState({ name: '', category: 'עיצוב', price: '' });
  const [newStaffName, setNewStaffName] = useState('');

  useEffect(() => {
    if (globalSettingsData) setGlobalSettings(globalSettingsData);
  }, [globalSettingsData]);

  useEffect(() => {
    setKashruts(Array.isArray(kashrutsData) ? kashrutsData : []);
  }, [kashrutsData]);

  const formatExtraCategory = (value: string) =>
    translateByValue(t, EXTRA_CATEGORY_KEY_BY_VALUE, value);

  const loading = settingsLoading || extrasLoading || kashrutLoading || staffLoading;
  const saveGlobalSettings = async () => {
    try {
      await apiFetch(`${API_URL}/settings/global`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globalSettings)
      });
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      alert(t(T.SETTINGS.SAVED));
    } catch (error) {
      alert(t(T.SETTINGS.SAVE_ERROR));
    }
  };

  const updatePriceField = (field: string, value: string) => {
    const num = Number(value);
    setGlobalSettings((prev: Record<string, unknown>) => ({
      ...prev,
      [field]: value === '' ? '' : num,
    }));
  };

  const persistHiddenPriceFields = async (hiddenPriceFields: string[]) => {
    try {
      await apiFetch(`${API_URL}/settings/global`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hiddenPriceFields }),
      });
      setGlobalSettings((prev: Record<string, unknown>) => ({ ...prev, hiddenPriceFields }));
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
    } catch {
      alert(t(T.SETTINGS.PRICING_UPDATE_ERROR));
    }
  };

  const hidePriceField = async (field: string) => {
    if (NON_REMOVABLE_PRICE_FIELDS.has(field)) return;
    if (!window.confirm(t(T.SETTINGS.REMOVE_PRICE_CONFIRM))) return;
    const hidden = [...new Set([...parseHiddenPriceFields(globalSettings), field])];
    await persistHiddenPriceFields(hidden);
  };

  const restorePriceField = async (field: string) => {
    const hidden = parseHiddenPriceFields(globalSettings).filter((item) => item !== field);
    await persistHiddenPriceFields(hidden);
  };

  const updateExtraField = async (id: string, patch: { name?: string; price?: number; category?: string }) => {
    try {
      await apiFetch(`${API_URL}/settings/extras/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await queryClient.invalidateQueries({ queryKey: ['settings', 'extras'] });
    } catch {
      alert(t(T.SETTINGS.ITEM_UPDATE_ERROR));
    }
  };

  const deleteExtra = async (id: string) => {
    if (!window.confirm(t(T.SETTINGS.REMOVE_CATALOG_CONFIRM))) return;
    try {
      await apiFetch(`${API_URL}/settings/extras/${id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['settings', 'extras'] });
    } catch {
      alert(t(T.SETTINGS.ITEM_UPDATE_ERROR));
    }
  };

  const updateKashrut = async (id: string, data: any) => {
    try {
      const response = await apiFetch(`${API_URL}/kashrut/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        alert(`${t(T.SETTINGS.SERVER_REJECT)} (${response.status})`);
        return;
      }
    } catch (error) {
      alert(t(T.SETTINGS.COMM_ERROR));
    }
  };  
  
  const handleImageUpload = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Image = reader.result as string;
      setKashruts(prev => prev.map(k => k.id === id ? { ...k, imageUrl: base64Image } : k));
      updateKashrut(id, { imageUrl: base64Image });
    };
    reader.readAsDataURL(file);
  };

  const handleAddExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExtra.name || !newExtra.price) return alert(t(T.SETTINGS.EXTRA_FILL_REQUIRED));

    try {
      await apiFetch(`${API_URL}/settings/extras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExtra)
      });
      setNewExtra({ name: '', category: 'עיצוב', price: '' });
      await queryClient.invalidateQueries({ queryKey: ['settings', 'extras'] });
    } catch (error) {
      alert(t(T.SETTINGS.EXTRA_ADD_ERROR));
    }
  };

  const toggleExtraStatus = async (id: string, currentStatus: boolean) => {
    try {
      await apiFetch(`${API_URL}/settings/extras/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      await queryClient.invalidateQueries({ queryKey: ['settings', 'extras'] });
    } catch (error) {
      alert(t(T.SETTINGS.STATUS_UPDATE_ERROR));
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newStaffName.trim();
    if (!name) return alert(t(T.SETTINGS.STAFF_NAME_REQUIRED));

    try {
      const res = await apiFetch(`${API_URL}/settings/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.message || t(T.SETTINGS.STAFF_ADD_ERROR));
        return;
      }
      setNewStaffName('');
    } catch {
      alert(t(T.SETTINGS.STAFF_ADD_ERROR));
    }
  };

  const handleDeleteStaff = async (id: string) => {
    if (!window.confirm(t(T.SETTINGS.STAFF_REMOVE_CONFIRM))) return;
    try {
      await apiFetch(`${API_URL}/settings/staff/${id}`, { method: 'DELETE' });
    } catch {
      alert(t(T.SETTINGS.STAFF_REMOVE_ERROR));
    }
  };

  const handleDateChangeLocal = (id: string, newDate: string) => {
    setKashruts(prev => prev.map(k => k.id === id ? { ...k, validUntil: newDate } : k));
  };

  const formatDateForInput = (dateString: any) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? '' : calendarKeyFromDbDate(d);
  };

  if (loading) return <PageLoader />;

  const visiblePriceFields = getVisibleSystemPriceFields(globalSettings);
  const hiddenPriceFields = getHiddenSystemPriceFields(globalSettings);
  const mainKashrut = kashruts[0];

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>
          <span className="settings-title-icon" aria-hidden="true">
            <Icon name="settings" size={24} />
          </span>
          {t(T.SETTINGS.PAGE_TITLE)}
        </h1>
        <p>{t(T.SETTINGS.PAGE_SUBTITLE)}</p>
      </div>

      <div className="settings-grid">
        <div className="settings-card">
          <h2>{t(T.SETTINGS.LANGUAGE_TITLE)}</h2>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px' }}>
            {t(T.SETTINGS.LANGUAGE_HINT)}
          </p>
          <LanguageSwitcher />
        </div>

        <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
          <h2>{t(T.SETTINGS.PRICING_TITLE)}</h2>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px' }}>
            {t(T.SETTINGS.PRICING_HINT)}
          </p>

          <h3 className="price-group-title">{t(T.SETTINGS.BASE_RATES)}</h3>
          <table className="extras-table price-catalog-table">
            <thead>
              <tr>
                <th>{t(T.COMMON.LABELS.NAME)}</th>
                <th>{t(T.UI.PRICE)}</th>
                <th>{t(T.UI.NOTES)}</th>
                <th>{t(T.COMMON.LABELS.ACTIONS)}</th>
              </tr>
            </thead>
            <tbody>
              {visiblePriceFields.filter((f) => f.group === 'system').map((item) => (
                <tr key={item.field}>
                  <td>{getPriceFieldLabel(t, item)}</td>
                  <td>
                    <input
                      type="number"
                      className="price-inline-input"
                      value={globalSettings[item.field] ?? ''}
                      onChange={(e) => updatePriceField(item.field, e.target.value)}
                    />
                    {item.suffix && <span className="price-suffix">{item.suffix}</span>}
                  </td>
                  <td style={{ fontSize: '12px', color: '#666' }}>
                    {item.hintKey ? t(item.hintKey) : t(T.COMMON.LABELS.EM_DASH)}
                  </td>
                  <td>
                    {!item.required && (
                      <button
                        type="button"
                        className="extra-delete-btn"
                        onClick={() => hidePriceField(item.field)}
                      >
                        {t(T.UI.REMOVE)}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="price-group-title">{t(T.SETTINGS.UPGRADES)}</h3>
          <table className="extras-table price-catalog-table">
            <thead>
              <tr>
                <th>{t(T.COMMON.LABELS.NAME)}</th>
                <th>{t(T.UI.PRICE)} (₪)</th>
                <th>{t(T.COMMON.LABELS.ACTIONS)}</th>
              </tr>
            </thead>
            <tbody>
              {visiblePriceFields.filter((f) => f.group === 'upgrades').map((item) => (
                <tr key={item.field}>
                  <td>{getPriceFieldLabel(t, item)}</td>
                  <td>
                    <input
                      type="number"
                      className="price-inline-input"
                      value={globalSettings[item.field] ?? ''}
                      onChange={(e) => updatePriceField(item.field, e.target.value)}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="extra-delete-btn"
                      onClick={() => hidePriceField(item.field)}
                    >
                      {t(T.UI.REMOVE)}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {hiddenPriceFields.length > 0 && (
            <>
              <h3 className="price-group-title">{t(T.SETTINGS.REMOVED_ITEMS)}</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
                {hiddenPriceFields.map((item) => (
                  <li
                    key={item.field}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid #eee',
                    }}
                  >
                    <span style={{ color: '#666' }}>{getPriceFieldLabel(t, item)}</span>
                    <button
                      type="button"
                      className="add-btn"
                      style={{ padding: '6px 12px', fontSize: '13px' }}
                      onClick={() => restorePriceField(item.field)}
                    >
                      {t(T.SETTINGS.RESTORE)}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <button className="save-btn" onClick={saveGlobalSettings}>{t(T.SETTINGS.SAVE_PRICING)}</button>
        </div>

        <div className="settings-card">
          <h2>{t(T.SETTINGS.CATALOG_TITLE)}</h2>
          <form className="add-extra-form" onSubmit={handleAddExtra}>
            <div className="form-group" style={{marginBottom: 0}}>
              <label>{t(T.COMMON.LABELS.NAME)}</label>
              <input 
                placeholder={t(T.COMMON.LABELS.NAME)}
                value={newExtra.name} 
                onChange={e => setNewExtra({...newExtra, name: e.target.value})} 
              />
            </div>
            <div className="form-group" style={{marginBottom: 0}}>
              <label>{t(T.COMMON.LABELS.TYPE)}</label>
              <select value={newExtra.category} onChange={e => setNewExtra({...newExtra, category: e.target.value})}>
                <option value="עיצוב">{t(T.SETTINGS.CATEGORY_DESIGN)}</option>
                <option value="טכני">{t(T.SETTINGS.CATEGORY_TECH)}</option>
                <option value="צוות">{t(T.SETTINGS.CATEGORY_STAFF)}</option>
                <option value="אחר">{t(T.SETTINGS.CATEGORY_OTHER)}</option>
              </select>
            </div>
            <div className="form-group" style={{marginBottom: 0}}>
              <label>{t(T.UI.PRICE)} (₪)</label>
              <input 
                type="number" 
                value={newExtra.price} 
                onChange={e => setNewExtra({...newExtra, price: e.target.value})} 
              />
            </div>
            <button type="submit" className="add-btn">+</button>
          </form>

          <table className="extras-table">
            <thead>
              <tr>
                <th>{t(T.COMMON.LABELS.NAME)}</th>
                <th>{t(T.COMMON.LABELS.TYPE)}</th>
                <th>{t(T.UI.PRICE)} (₪)</th>
                <th>{t(T.COMMON.LABELS.STATUS)}</th>
                <th>{t(T.COMMON.LABELS.ACTIONS)}</th>
              </tr>
            </thead>
            <tbody>
              {extras.map(extra => (
                <tr key={extra.id} className={!extra.isActive ? 'extra-row-inactive' : ''}>
                  <td>
                    <input
                      type="text"
                      className="price-inline-input"
                      defaultValue={extra.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== extra.name) updateExtraField(extra.id, { name: v });
                      }}
                    />
                  </td>
                  <td>{formatExtraCategory(extra.category)}</td>
                  <td>
                    <input
                      type="number"
                      className="price-inline-input"
                      defaultValue={extra.price}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v >= 0 && v !== extra.price) {
                          updateExtraField(extra.id, { price: v });
                        }
                      }}
                    />
                  </td>
                  <td>
                    <button 
                      onClick={() => toggleExtraStatus(extra.id, extra.isActive)}
                      className={`status-toggle ${extra.isActive ? 'status-active' : 'status-inactive'}`}
                    >
                      {extra.isActive ? t(T.SETTINGS.STATUS_ACTIVE) : t(T.SETTINGS.STATUS_HIDDEN)}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="extra-delete-btn"
                      onClick={() => deleteExtra(extra.id)}
                    >
                      {t(T.UI.REMOVE)}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="settings-card">
          <h2>{t(T.SETTINGS.STAFF_TITLE)}</h2>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px' }}>
            {t(T.SETTINGS.STAFF_HINT)}
          </p>
          <form className="add-extra-form" onSubmit={handleAddStaff}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label>{t(T.COMMON.LABELS.NAME)}</label>
              <input
                placeholder={t(T.SETTINGS.STAFF_PLACEHOLDER)}
                value={newStaffName}
                onChange={e => setNewStaffName(e.target.value)}
              />
            </div>
            <button type="submit" className="add-btn" style={{ alignSelf: 'flex-end' }}>+</button>
          </form>
          <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0' }}>
            {staffMembers.map(member => (
              <li
                key={member.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderBottom: '1px solid #eee',
                }}
              >
                <span>{member.name}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteStaff(member.id)}
                  style={{
                    background: '#fee2e2',
                    color: '#b91c1c',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                  }}
                >
                  {t(T.UI.REMOVE)}
                </button>
              </li>
            ))}
            {staffMembers.length === 0 && (
              <li style={{ color: '#888', padding: '12px' }}>{t(T.SETTINGS.NO_STAFF)}</li>
            )}
          </ul>
        </div>

        <div className="settings-card" style={{gridColumn: '1 / -1'}}>
          <h2>{t(T.SETTINGS.KASHRUT_TITLE)}</h2>
          <p style={{color: '#666', fontSize: '14px', marginBottom: '15px'}}>{t(T.SETTINGS.KASHRUT_HINT)}</p>
          
          {mainKashrut ? (
            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#fdfdfd', padding: '20px', borderRadius: '8px', border: '1px solid #eaeaea' }}>
              
              <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
                <label style={{fontWeight: 'bold'}}>{t(T.SETTINGS.CERT_EXPIRY)}</label>
                <input 
                  type="date" 
                  value={formatDateForInput(mainKashrut.validUntil)} 
                  onChange={(e) => handleDateChangeLocal(mainKashrut.id, e.target.value)} 
                  onBlur={(e) => updateKashrut(mainKashrut.id, { validUntil: e.target.value })} 
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div className="form-group" style={{ flex: '1', minWidth: '250px' }}>
                <label style={{fontWeight: 'bold'}}>{t(T.SETTINGS.CERT_UPLOAD)}</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(mainKashrut.id, e.target.files[0])} 
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '120px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#555', marginBottom: '5px' }}>{t(T.SETTINGS.PREVIEW)}</span>
                {mainKashrut.imageUrl ? (
                  <img 
                    src={mainKashrut.imageUrl} 
                    alt={t(T.EVENT_FORM.KASHRUT_ALT)} 
                    style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', backgroundColor: '#fff', padding: '4px' }} 
                  />
                ) : (
                  <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #ccc', borderRadius: '6px', color: '#999', fontSize: '12px' }}>{t(T.UI.NO_IMAGE)}</div>
                )}
              </div>

            </div>
          ) : (
            <div style={{padding: '20px', textAlign: 'center', color: '#666'}}>{t(T.SETTINGS.KASHRUT_LOADING)}</div>
          )}
        </div>

        <PaymentTemplatesSettings
          templates={getPaymentTemplatesFromSettings(globalSettingsData).templates}
          defaultTemplateId={getPaymentTemplatesFromSettings(globalSettingsData).defaultTemplateId}
          onSave={async (paymentTemplates, defaultPaymentTemplateId) => {
            await apiFetch(`${API_URL}/settings/global`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentTemplates, defaultPaymentTemplateId }),
            });
          }}
        />

        <div style={{gridColumn: '1 / -1'}}>
          <AuthorizedUsers />
        </div>

      </div>
    </div>
  );
};
