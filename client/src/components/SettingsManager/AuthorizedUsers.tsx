import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';
import { API_URL } from '../../config/api';
import { useTranslation } from '../../i18n/useTranslation';

const ROLE_KEYS = {
  manager: 'ROLE_MANAGER',
  staff: 'ROLE_STAFF',
  production: 'ROLE_PRODUCTION',
  floor_staff: 'ROLE_FLOOR',
} as const;

const ROLE_OPTIONS = Object.entries(ROLE_KEYS) as [keyof typeof ROLE_KEYS, string][];

const AUTH_USERS_URL = `${API_URL}/auth/authorized-users`;

type AuthorizedUser = {
  id: string;
  email: string;
  role: string;
  createdAt?: string;
};

export const AuthorizedUsers = () => {
  const { t, T } = useTranslation();
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState('manager');
  const [loadError, setLoadError] = useState<string | null>(null);

  const roleLabel = (role: keyof typeof ROLE_KEYS) =>
    t(T.SETTINGS[ROLE_KEYS[role] as keyof typeof T.SETTINGS] as typeof T.SETTINGS.ROLE_MANAGER);

  const loadUsers = useCallback(async () => {
    try {
      const res = await apiFetch(AUTH_USERS_URL);
      if (!res.ok) {
        throw new Error(`${res.status}`);
      }
      const data: unknown = await res.json();
      if (Array.isArray(data)) {
        setUsers(data as AuthorizedUser[]);
        setLoadError(null);
      }
    } catch (err) {
      console.error(t(T.SETTINGS.USERS_LOAD_ERROR), err);
      setLoadError(t(T.SETTINGS.USERS_LOAD_ERROR));
    }
  }, [t, T]);

  // Mount-only fetch — do NOT depend on loadUsers/t (unstable wrappers caused a 429 loop).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await apiFetch(AUTH_USERS_URL);
        if (cancelled) return;
        if (!res.ok) throw new Error(`${res.status}`);
        const data: unknown = await res.json();
        if (!cancelled && Array.isArray(data)) {
          setUsers(data as AuthorizedUser[]);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('authorized-users load failed', err);
          setLoadError('load-failed');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddEmail = async () => {
    const emailToSave = email.toLowerCase().trim();
    if (!emailToSave) return;

    try {
      const res = await apiFetch(AUTH_USERS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToSave, role: newRole }),
      });
      if (!res.ok) throw new Error(t(T.SETTINGS.USER_ADD_ERROR));
      setEmail('');
      await loadUsers();
    } catch {
      alert(t(T.SETTINGS.USER_ADD_ERROR));
    }
  };

  const handleRoleChange = async (id: string, role: string) => {
    try {
      const res = await apiFetch(`${AUTH_USERS_URL}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error(t(T.SETTINGS.ROLE_UPDATE_ERROR));
      await loadUsers();
    } catch {
      alert(t(T.SETTINGS.ROLE_UPDATE_ERROR));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t(T.SETTINGS.USER_DELETE_CONFIRM))) return;
    try {
      const res = await apiFetch(`${AUTH_USERS_URL}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(t(T.SETTINGS.USER_DELETE_ERROR));
      await loadUsers();
    } catch {
      alert(t(T.SETTINGS.USER_DELETE_ERROR));
    }
  };

  return (
    <div style={{
      background: '#fff',
      padding: '24px',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      marginTop: '20px',
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#2c3e50' }}>{t(T.SETTINGS.USERS_TITLE)}</h3>

      {loadError && (
        <p style={{ color: '#b91c1c', marginBottom: '12px' }}>{t(T.SETTINGS.USERS_LOAD_ERROR)}</p>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input
          type="email"
          placeholder={t(T.SETTINGS.USER_EMAIL_PLACEHOLDER)}
          value={email}
          onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
          style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
        />
        <select
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
          aria-label={t(T.SETTINGS.USER_ROLE_ARIA)}
        >
          {ROLE_OPTIONS.map(([value]) => (
            <option key={value} value={value}>{roleLabel(value)}</option>
          ))}
        </select>
        <button
          onClick={handleAddEmail}
          style={{ padding: '10px 20px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {t(T.SETTINGS.ADD_USER)}
        </button>
      </div>

      <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #eee' }}>
            <th style={{ padding: '12px 8px', color: '#7f8c8d' }}>{t(T.UI.LABEL_EMAIL)}</th>
            <th style={{ padding: '12px 8px', color: '#7f8c8d' }}>{t(T.SETTINGS.USER_ROLE_ARIA)}</th>
            <th style={{ padding: '12px 8px', color: '#7f8c8d', width: '80px' }}>{t(T.COMMON.LABELS.ACTIONS)}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
              <td style={{ padding: '12px 8px' }}>{user.email}</td>
              <td style={{ padding: '12px 8px' }}>
                <select
                  value={user.role || 'manager'}
                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                  style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
                  aria-label={`${t(T.SETTINGS.USER_ROLE_ARIA)} ${user.email}`}
                >
                  {ROLE_OPTIONS.map(([value]) => (
                    <option key={value} value={value}>{roleLabel(value)}</option>
                  ))}
                </select>
              </td>
              <td style={{ padding: '12px 8px' }}>
                <button
                  onClick={() => handleDelete(user.id)}
                  style={{ background: '#ff4757', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                >
                  {t(T.UI.DELETE)}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
