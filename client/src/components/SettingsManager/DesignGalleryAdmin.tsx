import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { useDesignGalleryQuery } from '../../hooks/queries';
import { apiFetch } from '../../services/api';
import { API_URL } from '../../config/api';
import {
  DESIGN_GALLERY_CATEGORIES,
  designItemFullSrc,
  designItemMatchesSearch,
  designItemThumbSrc,
  type DesignGalleryCategory,
  type DesignGalleryItemDto,
} from '@shared/gallery';
import { DesignImageLightbox } from '../DesignGallery/DesignImageLightbox';
import { useToast } from '../ui/Toast/ToastProvider';
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

type EditDraft = {
  id: string;
  name: string;
  category: DesignGalleryCategory;
  modelCode: string;
  description: string;
};

const emptyForm = {
  name: '',
  category: 'tablecloths' as DesignGalleryCategory,
  modelCode: '',
  description: '',
};

export function DesignGalleryAdmin() {
  const { t, T } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { data: items = [], isLoading, isError } = useDesignGalleryQuery({
    includeInactive: true,
  });

  const [managerOpen, setManagerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<DesignGalleryCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const sortedItems = useMemo(
    () =>
      [...(items as DesignGalleryItemDto[])].sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      }),
    [items],
  );

  const filteredItems = useMemo(() => {
    const byCategory =
      activeCategory === 'all'
        ? sortedItems
        : sortedItems.filter((item) => item.category === activeCategory);
    return byCategory.filter((item) => designItemMatchesSearch(item, searchQuery));
  }, [sortedItems, activeCategory, searchQuery]);

  const setCategoryTab = (cat: DesignGalleryCategory | 'all') => {
    setActiveCategory(cat);
    setSearchQuery('');
    if (cat !== 'all') {
      setForm((prev) => ({ ...prev, category: cat }));
    }
  };

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: sortedItems.length };
    for (const cat of DESIGN_GALLERY_CATEGORIES) {
      map[cat] = sortedItems.filter((i) => i.category === cat).length;
    }
    return map;
  }, [sortedItems]);

  useEffect(() => {
    if (!managerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setManagerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [managerOpen]);

  const resetForm = () => {
    setForm(emptyForm);
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

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert(t(T.SETTINGS.DESIGN_REQUIRED));
      return;
    }
    if (!file) {
      alert(t(T.SETTINGS.DESIGN_IMAGE_REQUIRED));
      return;
    }

    setSaving(true);
    try {
      const body = new FormData();
      body.append('name', form.name.trim());
      body.append('category', form.category);
      if (form.modelCode.trim()) body.append('modelCode', form.modelCode.trim());
      if (form.description.trim()) body.append('description', form.description.trim());
      body.append('file', file);

      const res = await apiFetch(`${API_URL}/design-gallery`, {
        method: 'POST',
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || t(T.SETTINGS.DESIGN_SAVE_ERROR));
        return;
      }
      await invalidate();
      resetForm();
      showToast(t(T.SETTINGS.DESIGN_SAVE_SUCCESS), 'success');
    } catch {
      alert(t(T.SETTINGS.DESIGN_SAVE_ERROR));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: DesignGalleryItemDto) => {
    setEditing({
      id: item.id,
      name: item.name,
      category: (DESIGN_GALLERY_CATEGORIES.includes(item.category as DesignGalleryCategory)
        ? item.category
        : 'tablecloths') as DesignGalleryCategory,
      modelCode: item.modelCode || '',
      description: item.description || '',
    });
    setEditFile(null);
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.name.trim()) {
      alert(t(T.SETTINGS.DESIGN_REQUIRED));
      return;
    }
    setBusyId(editing.id);
    try {
      let res: Response;
      if (editFile) {
        const body = new FormData();
        body.append('name', editing.name.trim());
        body.append('category', editing.category);
        body.append('modelCode', editing.modelCode.trim());
        body.append('description', editing.description.trim());
        body.append('file', editFile);
        res = await apiFetch(`${API_URL}/design-gallery/${editing.id}`, {
          method: 'PUT',
          body,
        });
      } else {
        res = await apiFetch(`${API_URL}/design-gallery/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editing.name.trim(),
            category: editing.category,
            modelCode: editing.modelCode.trim() || null,
            description: editing.description.trim() || null,
          }),
        });
      }
      if (!res.ok) {
        alert(t(T.SETTINGS.DESIGN_SAVE_ERROR));
        return;
      }
      await invalidate();
      setEditing(null);
      setEditFile(null);
      showToast(t(T.SETTINGS.DESIGN_SAVE_SUCCESS), 'success');
    } catch {
      alert(t(T.SETTINGS.DESIGN_SAVE_ERROR));
    } finally {
      setBusyId(null);
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
      if (editing?.id === item.id) setEditing(null);
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
      <div className="design-gallery-launch">
        <span className="design-gallery-count">
          {isLoading
            ? t(T.SETTINGS.KASHRUT_LOADING)
            : t(T.SETTINGS.DESIGN_ITEMS_COUNT, { count: sortedItems.length })}
        </span>
        <button
          type="button"
          className="save-btn"
          onClick={() => setManagerOpen(true)}
        >
          {t(T.SETTINGS.DESIGN_MANAGE_OPEN)}
        </button>
      </div>

      {managerOpen ? (
        <div
          className="design-gallery-manager-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setManagerOpen(false)}
        >
          <div
            className="design-gallery-manager"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="design-gallery-manager-header">
              <h3>{t(T.SETTINGS.DESIGN_GALLERY_TITLE)}</h3>
              <button
                type="button"
                className="design-gallery-close"
                onClick={() => setManagerOpen(false)}
                aria-label={t(T.BOOKING.CONTRACT.CLOSE)}
              >
                ✕
              </button>
            </div>

            <div className="design-gallery-manager-body">
              <div className="design-gallery-cat-tabs">
                <button
                  type="button"
                  className={activeCategory === 'all' ? 'is-active' : ''}
                  onClick={() => setCategoryTab('all')}
                >
                  {t(T.SETTINGS.DESIGN_CATEGORY_ALL)} ({counts.all || 0})
                </button>
                {DESIGN_GALLERY_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={activeCategory === cat ? 'is-active' : ''}
                    onClick={() => setCategoryTab(cat)}
                  >
                    {categoryLabel(t, T, cat)} ({counts[cat] || 0})
                  </button>
                ))}
              </div>

              <div className="design-gallery-search-wrap">
                <label htmlFor="admin-design-search">{t(T.EVENT_FORM.DESIGN_SEARCH_LABEL)}</label>
                <input
                  id="admin-design-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t(T.EVENT_FORM.DESIGN_SEARCH_PLACEHOLDER)}
                  autoComplete="off"
                />
              </div>

              <form className="design-gallery-form" onSubmit={handleCreate}>
                <h4 className="design-gallery-form-title">{t(T.SETTINGS.DESIGN_ADD_TITLE)}</h4>
                <div className="form-group">
                  <label htmlFor="design-name">{t(T.SETTINGS.DESIGN_NAME_LABEL)}</label>
                  <input
                    id="design-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t(T.SETTINGS.DESIGN_NAME_PLACEHOLDER)}
                    disabled={saving}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="design-category">{t(T.SETTINGS.DESIGN_CATEGORY_LABEL)}</label>
                  <select
                    id="design-category"
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as DesignGalleryCategory })
                    }
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
                    value={form.modelCode}
                    onChange={(e) => setForm({ ...form, modelCode: e.target.value })}
                    placeholder={t(T.SETTINGS.DESIGN_MODEL_PLACEHOLDER)}
                    disabled={saving}
                  />
                </div>
                <div className="form-group design-gallery-form-span">
                  <label htmlFor="design-desc">{t(T.SETTINGS.DESIGN_DESC_LABEL)}</label>
                  <input
                    id="design-desc"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
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

              {isError ? (
                <p className="design-gallery-error">{t(T.SETTINGS.DESIGN_LOAD_ERROR)}</p>
              ) : filteredItems.length === 0 ? (
                <p className="design-gallery-empty">
                  {searchQuery.trim()
                    ? t(T.EVENT_FORM.DESIGN_SEARCH_EMPTY)
                    : t(T.SETTINGS.DESIGN_EMPTY)}
                </p>
              ) : (
                <div className="design-gallery-list">
                  {filteredItems.map((item) => {
                    const thumb = designItemThumbSrc(item);
                    const full = designItemFullSrc(item);
                    return (
                    <div
                      key={item.id}
                      className={`design-gallery-item ${!item.isActive ? 'is-inactive' : ''}`}
                    >
                      {thumb ? (
                        <button
                          type="button"
                          className="design-gallery-thumb-btn"
                          onClick={() => setLightboxSrc(full)}
                        >
                          <img
                            src={thumb}
                            alt=""
                            className="design-gallery-thumb"
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
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
                          className="status-toggle status-active"
                          disabled={busyId === item.id}
                          onClick={() => startEdit(item)}
                        >
                          {t(T.SETTINGS.DESIGN_EDIT)}
                        </button>
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
                    );
                  })}
                </div>
              )}

              {editing ? (
                <form className="design-gallery-edit-form" onSubmit={saveEdit}>
                  <h4>{t(T.SETTINGS.DESIGN_EDIT_TITLE)}</h4>
                  <div className="form-group">
                    <label>{t(T.SETTINGS.DESIGN_NAME_LABEL)}</label>
                    <input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t(T.SETTINGS.DESIGN_CATEGORY_LABEL)}</label>
                    <select
                      value={editing.category}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          category: e.target.value as DesignGalleryCategory,
                        })
                      }
                    >
                      {DESIGN_GALLERY_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {categoryLabel(t, T, cat)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t(T.SETTINGS.DESIGN_MODEL_LABEL)}</label>
                    <input
                      value={editing.modelCode}
                      onChange={(e) => setEditing({ ...editing, modelCode: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t(T.SETTINGS.DESIGN_DESC_LABEL)}</label>
                    <input
                      value={editing.description}
                      onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t(T.SETTINGS.DESIGN_IMAGE_LABEL)}</label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  <div className="design-gallery-edit-actions">
                    <button type="submit" className="save-btn" disabled={busyId === editing.id}>
                      {t(T.SETTINGS.DESIGN_SAVE_EDIT)}
                    </button>
                    <button
                      type="button"
                      className="extra-delete-btn"
                      onClick={() => {
                        setEditing(null);
                        setEditFile(null);
                      }}
                    >
                      {t(T.BOOKING.PAYMENT.CUSTOM_TERMS_CANCEL)}
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <DesignImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}

export default DesignGalleryAdmin;
