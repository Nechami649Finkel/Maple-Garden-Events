import { useState, useEffect } from 'react';
import { menuService } from '../../services/menuService';

const MenuManager = () => {
  const [menu, setMenu] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  useEffect(() => {
    loadMenu();
  }, []);

  const loadMenu = async () => {
    const res = await menuService.getMenu();
    if (res.success) setMenu(res.data);
  };

  const handleAdd = async () => {
    if (!newName || !newPrice) return alert("נא למלא שם ומחיר");
    
    // זמני: ה-categoryId מוגדר כ-hardcoded לניסוי. 
    // בהמשך נוסיף בחירה מרשימה.
    await menuService.addDish({ 
        name: newName, 
        price: parseFloat(newPrice), 
        categoryId: menu[0]?.id || "" 
    });
    
    setNewName('');
    setNewPrice('');
    loadMenu(); // מרענן את הרשימה אחרי הוספה
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('את בטוחה שאת רוצה למחוק?')) {
      await menuService.deleteDish(id);
      loadMenu();
    }
  };

  return (
    <div style={{ padding: '20px', direction: 'rtl' }}>
      <h1>ניהול תפריט</h1>
      
      {/* טופס הוספת מנה */}
      <div style={{ marginBottom: '30px', padding: '15px', background: '#f4f4f4' }}>
        <h3>הוספת מנה חדשה</h3>
        <input placeholder="שם המנה" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <input placeholder="מחיר" type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
        <button onClick={handleAdd}>הוסף מנה</button>
      </div>

      {/* רשימת המנות */}
      {menu.map((category) => (
        <div key={category.id} style={{ marginBottom: '20px' }}>
          <h2>{category.name}</h2>
          <ul>
            {category.dishes.map((dish: any) => (
              <li key={dish.id}>
                {dish.name} - {dish.price} ₪
                <button onClick={() => handleDelete(dish.id)} style={{ color: 'red', marginRight: '10px' }}>מחק</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default MenuManager;