import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { broadcastUpdate } from '../server'; 
import { catchAsync } from '../middlewares/errorHandler'; // <-- ייבוא עוטף השגיאות

// 1. שליפת התפריט
export const getMenu = catchAsync(async (req: Request, res: Response) => {
  const menu = await prisma.menuCategory.findMany({
    include: { dishes: true }
  });
  res.status(200).json({ success: true, data: menu });
});

// 2. הוספת מנה
export const addDish = catchAsync(async (req: Request, res: Response) => {
  const { name, description, price, categoryId } = req.body;
  const newDish = await prisma.dish.create({
    data: { name, description, price, categoryId }
  });
  
  // שליחת עדכון לכל הלקוחות המחוברים
  broadcastUpdate('menuUpdated', { type: 'ADD', data: newDish });
  
  res.status(201).json({ success: true, data: newDish });
});

// 3. עדכון מנה
export const updateDish = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, price } = req.body;
  
  const updatedDish = await prisma.dish.update({
    where: { id: id as string },
    data: { name, description, price }
  });
  
  // שליחת עדכון לכל הלקוחות המחוברים
  broadcastUpdate('menuUpdated', { type: 'UPDATE', data: updatedDish });
  
  res.status(200).json({ success: true, data: updatedDish });
});

// 4. מחיקת מנה
export const deleteDish = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  await prisma.dish.delete({ 
    where: { id: id as string } 
  });
  
  // שליחת עדכון לכל הלקוחות המחוברים שהמנה נמחקה
  broadcastUpdate('menuUpdated', { type: 'DELETE', id: id });
  
  res.status(200).json({ success: true, message: 'המנה נמחקה בהצלחה' });
});