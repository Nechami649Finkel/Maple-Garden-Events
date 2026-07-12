import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';
import { API_URL } from '../../config/api';

const ROLE_LABELS: Record<string, string> = {
  manager: 'מנהל/ת',
  staff: 'מזכירות / מכירות',
  production: 'הפקה',
  floor_staff: 'צוות קבלה',
};

const ROLE_OPTIONS = Object.entries(ROLE_LABELS);

export const AuthorizedUsers = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState('manager');

  const AUTH_USERS_URL = `${API_URL}/auth/authorized-users`;

  const loadUsers = () => {
    apiFetch(AUTH_USERS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`שגיאת שרת: ${res.status}`);
        return res.json();
      })
      .then((data) => setUsers(data))
      .catch((err) => console.error('שגיאה בטעינת משתמשים:', err));
  };

  useEffect(() => {
    loadUsers();
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
      if (!res.ok) throw new Error('שגיאה בהוספה');
      setEmail('');
      loadUsers();
    } catch {
      alert('שגיאה בהוספת המייל - אולי הוא כבר קיים?');
    }
  };

  const handleRoleChange = async (id: string, role: string) => {
    try {
      const res = await apiFetch(`${AUTH_USERS_URL}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('שגיאה בעדכון תפקיד');
      loadUsers();
    } catch {
      alert('שגיאה בעדכון התפקיד');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('האם את בטוחה שברצונך למחוק משתמש זה?')) return;
    try {
      const res = await apiFetch(`${AUTH_USERS_URL}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('שגיאה במחיקה');
      loadUsers();
    } catch {
      alert('שגיאה במחיקת המייל');
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
      <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#2c3e50' }}>ניהול משתמשים מורשים</h3>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input
          type="email"
          placeholder="הקלידי מייל של משתמש חדש..."
          value={email}
          onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
          style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
        />
        <select
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
          aria-label="תפקיד משתמש חדש"
        >
          {ROLE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button
          onClick={handleAddEmail}
          style={{ padding: '10px 20px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          הוסף
        </button>
      </div>

      <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #eee' }}>
            <th style={{ padding: '12px 8px', color: '#7f8c8d' }}>מייל מורשה</th>
            <th style={{ padding: '12px 8px', color: '#7f8c8d' }}>תפקיד</th>
            <th style={{ padding: '12px 8px', color: '#7f8c8d', width: '80px' }}>פעולות</th>
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
                  aria-label={`תפקיד עבור ${user.email}`}
                >
                  {ROLE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </td>
              <td style={{ padding: '12px 8px' }}>
                <button
                  onClick={() => handleDelete(user.id)}
                  style={{ background: '#ff4757', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                >
                  מחק
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
