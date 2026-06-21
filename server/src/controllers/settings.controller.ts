import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { catchAsync } from '../middlewares/errorHandler';
import { DEFAULT_CONTRACT_TEXT } from '../utils/defaultContractText';

export const settingsController = {
  // =========================================
  // הגדרות מערכת (מע"מ, מחירי בסיס קבועים)
  // =========================================
  
  getSettings: catchAsync(async (req: Request, res: Response) => {
    // מנסים לשלוף את ההגדרות
    let settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
    
    // אם זו הפעם הראשונה שמפעילים את המערכת ואין עדיין הגדרות - ניצור אותן עם ברירות המחדל
    if (!settings) {
      settings = await prisma.systemSettings.create({ data: { contractText: DEFAULT_CONTRACT_TEXT } });
    }

    res.json({
      ...settings,
      contractText: settings.contractText?.trim() || DEFAULT_CONTRACT_TEXT,
    });
  }),

  updateSettings: catchAsync(async (req: Request, res: Response) => {
    const data = req.body;
    const settings = await prisma.systemSettings.update({
      where: { id: 'global' },
      data
    });
    res.json(settings);
  }),

  // =========================================
  // מחירון תוספות דינמיות (קטלוג שירותים)
  // =========================================

  getExtras: catchAsync(async (req: Request, res: Response) => {
    const extras = await prisma.extraService.findMany({
      orderBy: { category: 'asc' } // נסדר לפי קטגוריות שיהיה יפה
    });
    res.json(extras);
  }),

  addExtra: catchAsync(async (req: Request, res: Response) => {
    const { name, category, price } = req.body;
    const extra = await prisma.extraService.create({
      data: { name, category, price: Number(price) }
    });
    res.json(extra);
  }),

  updateExtra: catchAsync(async (req: Request, res: Response) => {
    const data = req.body;
    
    // המרה למספר במידה והגיע כטקסט מהטופס
    if (data.price !== undefined) data.price = Number(data.price);
    
    const extra = await prisma.extraService.update({
      where: { id: req.params.id as string }, // התיקון שהורג את השגיאה של TypeScript
      data
    });
    res.json(extra);
  }),

  getStaff: catchAsync(async (_req: Request, res: Response) => {
    let staff = await prisma.staffMember.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    if (staff.length === 0) {
      const defaults = ['מוישי', 'ציפי', 'שימי'];
      await prisma.staffMember.createMany({
        data: defaults.map(name => ({ name })),
        skipDuplicates: true,
      });
      staff = await prisma.staffMember.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    }

    res.json(staff);
  }),

  addStaff: catchAsync(async (req: Request, res: Response) => {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'יש להזין שם עובד.' });
    }

    const existing = await prisma.staffMember.findUnique({ where: { name } });
    if (existing) {
      if (!existing.isActive) {
        const restored = await prisma.staffMember.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
        return res.json(restored);
      }
      return res.status(409).json({ success: false, message: 'עובד בשם זה כבר קיים.' });
    }

    const member = await prisma.staffMember.create({ data: { name } });
    res.status(201).json(member);
  }),

  deleteStaff: catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await prisma.staffMember.delete({ where: { id } });
    res.json({ success: true });
  }),
};