import { apiFetch } from './api';
import { API_URL } from '../config/api';

const MENU_API = `${API_URL}/menu`;

export const menuService = {
  getMenu: async () => {
    const res = await apiFetch(MENU_API);
    return res.json();
  },

  addDish: async (dishData: { name: string; price: number; categoryId: string }) => {
    const res = await apiFetch(MENU_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dishData),
    });
    return res.json();
  },

  updateDish: async (id: string, dishData: { name: string; price: number; description?: string }) => {
    const res = await apiFetch(`${MENU_API}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dishData),
    });
    return res.json();
  },

  deleteDish: async (id: string) => {
    const res = await apiFetch(`${MENU_API}/${id}`, { method: 'DELETE' });
    return res.json();
  },
};
