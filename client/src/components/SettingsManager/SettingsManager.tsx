import React, { useState, useEffect } from 'react';
import './SettingsManager.css';
import { apiFetch } from '../../services/api';
// הוספנו את הייבוא של הקומפוננטה החדשה:
import { AuthorizedUsers } from './AuthorizedUsers';


export const SettingsManager = () => {
  const [globalSettings, setGlobalSettings] = useState<any>({});
  const [extras, setExtras] = useState<any[]>([]);
  const [kashruts, setKashruts] = useState<any[]>([]);
  
  const [newExtra, setNewExtra] = useState({ name: '', category: 'עיצוב', price: '' });
  const [staffMembers, setStaffMembers] = useState<{ id: string; name: string }[]>([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

 const fetchData = async () => {
    try {
      const [settingsRes, extrasRes, kashrutRes, staffRes] = await Promise.all([
        apiFetch('http://localhost:5000/api/settings/global'),
        apiFetch('http://localhost:5000/api/settings/extras'),
        apiFetch('http://localhost:5000/api/kashrut'),
        apiFetch('http://localhost:5000/api/settings/staff'),
      ]);
      
      const settingsData = await settingsRes.json();
      const extrasData = await extrasRes.json();
      const kashrutData = await kashrutRes.json();
      const staffData = await staffRes.json();
      
      setGlobalSettings(settingsData);
      
      // התיקון שלנו: מוודאים שקיבלנו באמת מערך לפני ששומרים בסטייט
      setExtras(Array.isArray(extrasData) ? extrasData : []);
      setKashruts(Array.isArray(kashrutData) ? kashrutData : []);
      setStaffMembers(Array.isArray(staffData) ? staffData : []);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching settings:', error);
      alert('שגיאה בטעינת נתונים');
    }
  };
  const saveGlobalSettings = async () => {
    try {
      await apiFetch('http://localhost:5000/api/settings/global', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globalSettings)
      });
      alert('הגדרות נשמרו בהצלחה!');
    } catch (error) {
      alert('שגיאה בשמירת הגדרות');
    }
  };

  const updateKashrut = async (id: string, data: any) => {
    try {
      const response = await apiFetch(`http://localhost:5000/api/kashrut/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        alert(`השרת סירב לשמור! קוד שגיאה: ${response.status}. תבדקי את החלון השחור של השרת.`);
        return;
      }

      fetchData();
    } catch (error) {
      alert('שגיאה בתקשורת מול השרת');
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
    if (!newExtra.name || !newExtra.price) return alert('נא למלא שם ומחיר');

    try {
      await apiFetch('http://localhost:5000/api/settings/extras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExtra)
      });
      setNewExtra({ name: '', category: 'עיצוב', price: '' });
      fetchData(); 
    } catch (error) {
      alert('שגיאה בהוספת תוספת');
    }
  };

  const toggleExtraStatus = async (id: string, currentStatus: boolean) => {
    try {
      await apiFetch(`http://localhost:5000/api/settings/extras/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      fetchData();
    } catch (error) {
      alert('שגיאה בעדכון סטטוס');
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newStaffName.trim();
    if (!name) return alert('נא להזין שם עובד');

    try {
      const res = await apiFetch('http://localhost:5000/api/settings/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.message || 'שגיאה בהוספת עובד');
        return;
      }
      setNewStaffName('');
      fetchData();
    } catch {
      alert('שגיאה בהוספת עובד');
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!window.confirm(`להסיר את ${name} מרשימת הנציגים?`)) return;
    try {
      await apiFetch(`http://localhost:5000/api/settings/staff/${id}`, { method: 'DELETE' });
      fetchData();
    } catch {
      alert('שגיאה במחיקת עובד');
    }
  };

  const handleDateChangeLocal = (id: string, newDate: string) => {
    setKashruts(prev => prev.map(k => k.id === id ? { ...k, validUntil: newDate } : k));
  };

  const formatDateForInput = (dateString: any) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  };

  if (loading) return <div>טוען הגדרות...</div>;

  const mainKashrut = kashruts[0];

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>הגדרות מערכת ומחירון</h1>
        <p>ניהול תעריפי בסיס, מע"מ וקטלוג תוספות דינמי</p>
      </div>

      <div className="settings-grid">
        {/* כרטיס תעריפי בסיס */}
        <div className="settings-card">
          <h2>תעריפי בסיס ומערכת</h2>
          <div className="form-group">
            <label>מע"מ נוכחי (%)</label>
            <input 
              type="number" 
              value={globalSettings.vatRate || ''} 
              onChange={e => setGlobalSettings({...globalSettings, vatRate: Number(e.target.value)})} 
            />
          </div>
          <div className="form-group">
            <label>מחיר בסיס ממוצע למנה (₪)</label>
            <input 
              type="number" 
              value={globalSettings.basePricePerPortion || ''} 
              onChange={e => setGlobalSettings({...globalSettings, basePricePerPortion: Number(e.target.value)})} 
            />
          </div>
          <div className="form-group">
            <label>עלות מנת בר (₪)</label>
            <input
              type="number"
              value={globalSettings.barPortionPrice ?? ''}
              onChange={e => setGlobalSettings({ ...globalSettings, barPortionPrice: Number(e.target.value) })}
            />
            <span style={{ fontSize: '12px', color: '#666' }}>משמש לחישוב מינימום מנות בטופס הפקת אירוע ובחוזה</span>
          </div>
          <div className="form-group">
            <label>מחיר בסיס לעיצוב אולם (₪)</label>
            <input 
              type="number" 
              value={globalSettings.designBasePrice || ''} 
              onChange={e => setGlobalSettings({...globalSettings, designBasePrice: Number(e.target.value)})} 
            />
          </div>
          <div className="form-group">
            <label>מחיר למנת איש צוות (₪)</label>
            <input 
              type="number" 
              value={globalSettings.staffPortionPrice || ''} 
              onChange={e => setGlobalSettings({...globalSettings, staffPortionPrice: Number(e.target.value)})} 
            />
          </div>
          <div className="form-group">
            <label>מחיר חבילת תאורה (₪)</label>
            <input 
              type="number" 
              value={globalSettings.lightingPrice || ''} 
              onChange={e => setGlobalSettings({...globalSettings, lightingPrice: Number(e.target.value)})} 
            />
          </div>
          <button className="save-btn" onClick={saveGlobalSettings}>שמור הגדרות בסיס</button>
        </div>

        {/* כרטיס קטלוג תוספות */}
        <div className="settings-card">
          <h2>קטלוג תוספות ושדרוגים (דינמי)</h2>
          <form className="add-extra-form" onSubmit={handleAddExtra}>
            <div className="form-group" style={{marginBottom: 0}}>
              <label>שם הפריט</label>
              <input 
                placeholder="לדוג': מכונת עשן" 
                value={newExtra.name} 
                onChange={e => setNewExtra({...newExtra, name: e.target.value})} 
              />
            </div>
            <div className="form-group" style={{marginBottom: 0}}>
              <label>קטגוריה</label>
              <select value={newExtra.category} onChange={e => setNewExtra({...newExtra, category: e.target.value})}>
                <option value="עיצוב">עיצוב</option>
                <option value="טכני">ציוד טכני</option>
                <option value="צוות">צוות והפקה</option>
                <option value="אחר">אחר</option>
              </select>
            </div>
            <div className="form-group" style={{marginBottom: 0}}>
              <label>מחיר (₪)</label>
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
                <th>שם פריט</th>
                <th>קטגוריה</th>
                <th>מחיר</th>
                <th>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {extras.map(extra => (
                <tr key={extra.id}>
                  <td>{extra.name}</td>
                  <td>{extra.category}</td>
                  <td>₪{extra.price}</td>
                  <td>
                    <button 
                      onClick={() => toggleExtraStatus(extra.id, extra.isActive)}
                      className={`status-toggle ${extra.isActive ? 'status-active' : 'status-inactive'}`}
                    >
                      {extra.isActive ? 'פעיל' : 'מוסתר'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ניהול נציגי מכירות */}
        <div className="settings-card">
          <h2>ניהול נציגי מכירות</h2>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px' }}>
            הרשימה מוצגת בטופס הזמנה ואופציה — ניתן להוסיף או להסיר עובדים.
          </p>
          <form className="add-extra-form" onSubmit={handleAddStaff}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label>שם עובד / נציג</label>
              <input
                placeholder="לדוגמה: שמעון"
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
                  onClick={() => handleDeleteStaff(member.id, member.name)}
                  style={{
                    background: '#fee2e2',
                    color: '#b91c1c',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                  }}
                >
                  הסר
                </button>
              </li>
            ))}
            {staffMembers.length === 0 && (
              <li style={{ color: '#888', padding: '12px' }}>אין נציגים — הוסיפי עובד ראשון.</li>
            )}
          </ul>
        </div>

        {/* חלון ניהול תעודת כשרות */}
        <div className="settings-card" style={{gridColumn: '1 / -1'}}>
          <h2>ניהול תעודת כשרות האולם</h2>
          <p style={{color: '#666', fontSize: '14px', marginBottom: '15px'}}>התעודה המועלת כאן תוצג אוטומטית בתוסף הפקת האירועים עבור הלקוח.</p>
          
          {mainKashrut ? (
            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#fdfdfd', padding: '20px', borderRadius: '8px', border: '1px solid #eaeaea' }}>
              
              <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
                <label style={{fontWeight: 'bold'}}>תאריך תוקף התעודה:</label>
                <input 
                  type="date" 
                  value={formatDateForInput(mainKashrut.validUntil)} 
                  onChange={(e) => handleDateChangeLocal(mainKashrut.id, e.target.value)} 
                  onBlur={(e) => updateKashrut(mainKashrut.id, { validUntil: e.target.value })} 
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div className="form-group" style={{ flex: '1', minWidth: '250px' }}>
                <label style={{fontWeight: 'bold'}}>העלאת קובץ תעודה חדש:</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(mainKashrut.id, e.target.files[0])} 
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '120px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#555', marginBottom: '5px' }}>תצוגה מקדימה:</span>
                {mainKashrut.imageUrl ? (
                  <img 
                    src={mainKashrut.imageUrl} 
                    alt="תעודת כשרות" 
                    style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', backgroundColor: '#fff', padding: '4px' }} 
                  />
                ) : (
                  <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #ccc', borderRadius: '6px', color: '#999', fontSize: '12px' }}>אין תמונה</div>
                )}
              </div>

            </div>
          ) : (
            <div style={{padding: '20px', textAlign: 'center', color: '#666'}}>טוען נתוני תעודת כשרות...</div>
          )}
        </div>

        {/* הוספנו את רכיב ניהול המשתמשים כאן למטה - פורס על כל הרוחב */}
        <div style={{gridColumn: '1 / -1'}}>
          <AuthorizedUsers />
        </div>

      </div>
    </div>
  );
};