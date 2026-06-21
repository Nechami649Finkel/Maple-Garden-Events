// client/src/services/menuService.ts
import { apiFetch } from './api'; // מייבאים את פונקציית הקסם שלנו!

const API_URL = 'http://localhost:5000/api/menu';

export const menuService = {
  getMenu: async () => {
    const res = await apiFetch(API_URL);
    return res.json();
  },
  
  addDish: async (dishData: { name: string; price: number; categoryId: string }) => {
    const res = await apiFetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dishData),
    });
    return res.json();
  },
  
  deleteDish: async (id: string) => {
    const res = await apiFetch(`${API_URL}/${id}`, { method: 'DELETE' });
    return res.json();
  }
};