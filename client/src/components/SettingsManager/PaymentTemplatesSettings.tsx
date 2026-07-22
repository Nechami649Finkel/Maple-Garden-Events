import { useState } from 'react';
import type { PaymentTermsTemplate } from '../../utils/paymentTerms';
import {
  DEFAULT_PAYMENT_TEMPLATES,
  formatPaymentTemplateForDisplay,
  getLocalizedPaymentTemplateDisplay,
} from '../../utils/paymentTerms';
import { useTranslation } from '../../i18n/useTranslation';

interface PaymentTemplatesSettingsProps {
  templates: PaymentTermsTemplate[];
  defaultTemplateId: string;
  onSave: (templates: PaymentTermsTemplate[], defaultTemplateId: string) => Promise<void>;
}

const emptyTemplate = (bodyTemplate: string): PaymentTermsTemplate => ({
  id: `custom-${Date.now()}`,
  name: '',
  bodyTemplate,
  installments: [
    { percent: 50, dueType: 'WEEK_BEFORE_EVENT' },
    { percent: 50, dueType: 'HOURS_24_AFTER_EVENT' },
  ],
});

export const PaymentTemplatesSettings: React.FC<PaymentTemplatesSettingsProps> = ({
  templates: initialTemplates,
  defaultTemplateId: initialDefaultId,
  onSave,
}) => {
  const { t, T } = useTranslation();
  const [templates, setTemplates] = useState<PaymentTermsTemplate[]>(
    initialTemplates.length ? initialTemplates : DEFAULT_PAYMENT_TEMPLATES,
  );
  const [defaultTemplateId, setDefaultTemplateId] = useState(initialDefaultId);
  const [draft, setDraft] = useState<PaymentTermsTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const displayTemplate = (template: PaymentTermsTemplate) =>
    getLocalizedPaymentTemplateDisplay(t, template);

  const previewTemplate = (template: PaymentTermsTemplate) => {
    const shown = displayTemplate(template);
    return formatPaymentTemplateForDisplay(shown.bodyTemplate, template.installments, t);
  };

  const startAdd = () => setDraft(emptyTemplate(t(T.PAYMENT_TERMS.SPLIT_BODY)));

  const saveAll = async () => {
    setSaving(true);
    try {
      let next = templates;
      if (draft?.name.trim()) {
        next = [...templates.filter((item) => item.id !== draft.id), draft];
        setTemplates(next);
        setDraft(null);
      }
      await onSave(next, defaultTemplateId);
      alert(t(T.SETTINGS.TEMPLATES_SAVED));
    } catch {
      alert(t(T.SETTINGS.TEMPLATES_SAVE_ERROR));
    } finally {
      setSaving(false);
    }
  };

  const removeTemplate = (id: string) => {
    if (!window.confirm(t(T.SETTINGS.TEMPLATE_REMOVE_CONFIRM))) return;
    const next = templates.filter((item) => item.id !== id);
    setTemplates(next.length ? next : DEFAULT_PAYMENT_TEMPLATES);
    if (defaultTemplateId === id) {
      setDefaultTemplateId(next[0]?.id || DEFAULT_PAYMENT_TEMPLATES[0].id);
    }
  };

  return (
    <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
      <h2>{t(T.SETTINGS.PAYMENT_TEMPLATES_TITLE)}</h2>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
        {t(T.SETTINGS.PAYMENT_TEMPLATES_HINT)}
      </p>

      <div className="form-group">
        <label>{t(T.SETTINGS.DEFAULT_TEMPLATE)}</label>
        <select
          value={defaultTemplateId}
          onChange={(e) => setDefaultTemplateId(e.target.value)}
          style={{ width: '100%', maxWidth: '420px', padding: '8px' }}
        >
          {templates.map((item) => (
            <option key={item.id} value={item.id}>{displayTemplate(item).name}</option>
          ))}
        </select>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0' }}>
        {templates.map((item) => {
          const shown = displayTemplate(item);
          return (
            <li
              key={item.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px',
                borderBottom: '1px solid #eee',
              }}
            >
              <div>
                <strong>{shown.name}</strong>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '6px' }}>
                  {t(T.SETTINGS.PREVIEW)}:
                </div>
                <div style={{ fontSize: '13px', color: '#555', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                  {previewTemplate(item)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeTemplate(item.id)}
                style={{
                  background: '#fee2e2',
                  color: '#b91c1c',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {t(T.UI.REMOVE)}
              </button>
            </li>
          );
        })}
      </ul>

      {draft && (
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <div className="form-group">
            <label>{t(T.SETTINGS.TEMPLATE_NAME)}</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={t(T.SETTINGS.TEMPLATE_NAME_PLACEHOLDER)}
            />
          </div>
          <div className="form-group">
            <label>{t(T.SETTINGS.TEMPLATE_BODY)}</label>
            <textarea
              rows={4}
              value={draft.bodyTemplate}
              onChange={(e) => setDraft({ ...draft, bodyTemplate: e.target.value })}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="save-btn" onClick={() => {
              if (!draft.name.trim()) return alert(t(T.SETTINGS.TEMPLATE_NAME_REQUIRED));
              setTemplates((prev) => [...prev.filter((item) => item.id !== draft.id), draft]);
              setDraft(null);
            }}>
              {t(T.SETTINGS.ADD_TEMPLATE)}
            </button>
            <button type="button" onClick={() => setDraft(null)}>{t(T.UI.CANCEL)}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button type="button" className="add-btn" onClick={startAdd}>+ {t(T.SETTINGS.ADD_TEMPLATE)}</button>
        <button type="button" className="save-btn" disabled={saving} onClick={saveAll}>
          {saving ? t(T.SETTINGS.SAVING) : t(T.SETTINGS.SAVE_TEMPLATES)}
        </button>
      </div>
    </div>
  );
};

export default PaymentTemplatesSettings;
