import { useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';

const MenuManager = () => {
  const { t, T } = useTranslation();
  const [dishes, setDishes] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const handleAdd = () => {
    if (!newName || !newPrice) return alert(t(T.MENU.FILL_NAME_PRICE));
    setDishes([...dishes, { id: Date.now(), name: newName, price: newPrice }]);
    setNewName('');
    setNewPrice('');
  };

  const handleDelete = (id: number) => {
    if (window.confirm(t(T.MENU.DELETE_CONFIRM))) {
      setDishes(dishes.filter((d) => d.id !== id));
    }
  };

  return (
    <div>
      <h1>{t(T.MENU.MANAGER_TITLE)}</h1>

      <div>
        <h3>{t(T.MENU.ADD_DISH_TITLE)}</h3>
        <input placeholder={t(T.MENU.DISH_NAME_PLACEHOLDER)} value={newName} onChange={(e) => setNewName(e.target.value)} />
        <input placeholder={t(T.UI.PRICE)} type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
        <button onClick={handleAdd}>{t(T.MENU.ADD_DISH)}</button>
      </div>

      <ul>
        {dishes.map((dish) => (
          <li key={dish.id}>
            {dish.name} - {dish.price}
            <button onClick={() => handleDelete(dish.id)} style={{ color: 'red', marginRight: '10px' }}>{t(T.UI.DELETE)}</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MenuManager;
