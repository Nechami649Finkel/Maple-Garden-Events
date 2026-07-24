import { useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { useDesignGalleryQuery } from '../../hooks/queries';
import { apiFetch } from '../../services/api';
import { API_URL } from '../../config/api';
import {
  DESIGN_GALLERY_CATEGORIES,
  type DesignGalleryCategory,
  type DesignGalleryItemDto,
} from '@shared/gallery';
import './DesignGalleryAdmin.css';

function categoryLabel(
  t: (key: any) => string,
  T: any,
  category: string,
): string {
  switch (category) {
    case 'tablecloths':
      return t(T.EVENT_FORM.LABEL_TABLECLOTHS);
    case 'napkins':
      return t(T.EVENT_FORM.LABEL_NAPKINS);
    case 'centerpieces':
      return t(T.EVENT_FORM.LABEL_CENTERPIECES);
    case 'bridgeChair':
      return t(T.EVENT_FORM.LABEL_BRIDE_CHAIR);
    default:
      return category;
  }
}

export function DesignGalleryAdmin() {
  const { t, T } = useTranslation();
  const queryClient = useQueryClient();
  const { data: items = [], isLoading, isError } = useDesignGalleryQuery({
    includeInactive: true,
  });

  const [name, setName] = useState('');
  const [category, setCategory] = useState<DesignGalleryCategory>('tablecloths');
  const [modelCode, setModelCode] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sortedItems = useMemo(
    () =>
      [...(items as DesignGalleryItemDto[])].sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      }),
    [items],
  );

  const resetForm = () => {
    setName('');
    setModelCode('');
    setDescription('');
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const onFileChange = (next: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
  };

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['design-gallery'] });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert(t(T.SETTINGS.DESIGN_REQUIRED));
      return;
    }
    if (!file) {
      alert(t(T.SETTINGS.DESIGN_IMAGE_REQUIRED));
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('category', category);
      if (modelCode.trim()) formData.append('modelCode', modelCode.trim());
      if (description.trim()) formData.append('description', description.trim());
      formData.append('file', file);

      const res = await apiFetch(`${API_URL}/design-gallery`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || t(T.SETTINGS.DESIGN_SAVE_ERROR));
        return;
      }
      await invalidate();
      resetForm();
      alert(t(T.SETTINGS.DESIGN_SAVE_SUCCESS));
    } catch {
      alert(t(T.SETTINGS.DESIGN_SAVE_ERROR));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: DesignGalleryItemDto) => {
    setBusyId(item.id);
    try {
      const res = await apiFetch(`${API_URL}/design-gallery/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (!res.ok) {
        alert(t(T.SETTINGS.STATUS_UPDATE_ERROR));
        return;
      }
      await invalidate();
    } catch {
      alert(t(T.SETTINGS.COMM_ERROR));
    } finally {
      setBusyId(null);
    }
  };

  const deleteItem = async (item: DesignGalleryItemDto) => {
    if (!window.confirm(t(T.SETTINGS.DESIGN_DELETE_CONFIRM))) return;
    setBusyId(item.id);
    try {
      const res = await apiFetch(`${API_URL}/design-gallery/${item.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        alert(t(T.SETTINGS.DESIGN_DELETE_ERROR));
        return;
      }
      await invalidate();
    } catch {
      alert(t(T.SETTINGS.DESIGN_DELETE_ERROR));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="settings-card design-gallery-admin">
      <h2>{t(T.SETTINGS.DESIGN_GALLERY_TITLE)}</h2>
      <p className="design-gallery-hint">{t(T.SETTINGS.DESIGN_GALLERY_HINT)}</p>

      <form className="design-gallery-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="design-name">{t(T.SETTINGS.DESIGN_NAME_LABEL)}</label>
          <input
            id="design-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(T.SETTINGS.DESIGN_NAME_PLACEHOLDER)}
            disabled={saving}
          />
        </div>
        <div className="form-group">
          <label htmlFor="design-category">{t(T.SETTINGS.DESIGN_CATEGORY_LABEL)}</label>
          <select
            id="design-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as DesignGalleryCategory)}
            disabled={saving}
          >
            {DESIGN_GALLERY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {categoryLabel(t, T, cat)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="design-model">{t(T.SETTINGS.DESIGN_MODEL_LABEL)}</label>
          <input
            id="design-model"
            value={modelCode}
            onChange={(e) => setModelCode(e.target.value)}
            placeholder={t(T.SETTINGS.DESIGN_MODEL_PLACEHOLDER)}
            disabled={saving}
          />
        </div>
        <div className="form-group design-gallery-form-span">
          <label htmlFor="design-desc">{t(T.SETTINGS.DESIGN_DESC_LABEL)}</label>
          <input
            id="design-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t(T.SETTINGS.DESIGN_DESC_PLACEHOLDER)}
            disabled={saving}
          />
        </div>
        <div className="form-group">
          <label htmlFor="design-image">{t(T.SETTINGS.DESIGN_IMAGE_LABEL)}</label>
          <input
            id="design-image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            disabled={saving}
          />
        </div>
        {previewUrl ? (
          <div className="design-gallery-preview">
            <img src={previewUrl} alt="" />
          </div>
        ) : null}
        <button type="submit" className="save-btn" disabled={saving}>
          {saving ? t(T.SETTINGS.DESIGN_UPLOADING) : t(T.SETTINGS.DESIGN_UPLOAD_SAVE)}
        </button>
      </form>

      {isLoading ? (
        <p>{t(T.SETTINGS.KASHRUT_LOADING)}</p>
      ) : isError ? (
        <p className="design-gallery-error">{t(T.SETTINGS.DESIGN_LOAD_ERROR)}</p>
      ) : sortedItems.length === 0 ? (
        <p className="design-gallery-empty">{t(T.SETTINGS.DESIGN_EMPTY)}</p>
      ) : (
        <div className="design-gallery-list">
          {sortedItems.map((item) => (
            <div
              key={item.id}
              className={`design-gallery-item ${!item.isActive ? 'is-inactive' : ''}`}
            >
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="design-gallery-thumb" />
              ) : (
                <div className="design-gallery-thumb placeholder" />
              )}
              <div className="design-gallery-meta">
                <strong>{item.name}</strong>
                <span>{categoryLabel(t, T, item.category)}</span>
                {item.modelCode ? <span>{item.modelCode}</span> : null}
              </div>
              <div className="design-gallery-actions">
                <button
                  type="button"
                  className={`status-toggle ${item.isActive ? 'status-active' : 'status-inactive'}`}
                  disabled={busyId === item.id}
                  onClick={() => toggleActive(item)}
                >
                  {item.isActive ? t(T.SETTINGS.STATUS_ACTIVE) : t(T.SETTINGS.STATUS_HIDDEN)}
                </button>
                <button
                  type="button"
                  className="extra-delete-btn"
                  disabled={busyId === item.id}
                  onClick={() => deleteItem(item)}
                >
                  {t(T.UI.REMOVE)}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DesignGalleryAdmin;
