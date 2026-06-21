import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';

export const AuthorizedUsers = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState('');

  // ✅ הכתובת תוקנה - הוספנו את הקידומת auth
  const API_URL = 'http://localhost:5000/api/auth/authorized-users';

  useEffect(() => {
    apiFetch(API_URL)
      .then(res => {
        if (!res.ok) throw new Error(`שגיאת שרת: ${res.status}`);
        return res.json();
      })
      .then(data => setUsers(data))
      .catch(err => console.error("שגיאה בטעינת משתמשים:", err));
  }, []);

  const handleAddEmail = async () => {
    // ✅ רשת ביטחון: מוודא סופית שהמייל באותיות קטנות וללא רווחים לפני השליחה
    const emailToSave = email.toLowerCase().trim();
    if (!emailToSave) return;
    
    try {
      const res = await apiFetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToSave })
      });
      if (!res.ok) throw new Error('שגיאה בהוספה');
      window.location.reload(); 
    } catch (e) {
      alert("שגיאה בהוספת המייל - אולי הוא כבר קיים?");
    }
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm('האם את בטוחה שברצונך למחוק מנהל זה?')) return;
    try {
      const res = await apiFetch(`${API_URL}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('שגיאה במחיקה');
      window.location.reload();
    } catch (e) {
      alert("שגיאה במחיקת המייל");
    }
  };

  return (
    <div style={{ 
      background: '#fff', 
      padding: '24px', 
      borderRadius: '12px', 
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      marginTop: '20px'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#2c3e50' }}>ניהול מנהלי מערכת</h3>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input 
          type="email" 
          placeholder="הקלידי מייל של מנהל חדש..." 
          value={email} 
          // ✅ התיקון כאן: כל אות שמוקלדת הופכת מיד לקטנה, ורווחים נמחקים
          onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
          style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
        />
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
            <th style={{ padding: '12px 8px', color: '#7f8c8d', width: '80px' }}>פעולות</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
              <td style={{ padding: '12px 8px' }}>{user.email}</td>
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