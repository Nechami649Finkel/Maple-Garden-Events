import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { catchAsync } from '../middlewares/errorHandler';
import { DEFAULT_CONTRACT_TEXT } from '../utils/defaultContractText';
import { emitSettingsUpdated } from '../utils/realtime';
import { getPaymentTemplatesFromSettings } from '../utils/paymentTerms';
import { getEasyCountMeta } from '../Services/easyCount';
import { getBrandConfig } from '@maple/shared/brand';

export const settingsController = {
  // =========================================
  // הגדרות מערכת (מע"מ, מחירי בסיס קבועים)
  // =========================================
  
  getBranding: catchAsync(async (req: Request, res: Response) => {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) return res.status(403).json({ error: 'Tenant context is missing.' });
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const brand = getBrandConfig();
    res.json({
      // Prefer brand public Hebrew name so UI/contracts stay consistent for Maple.
      venueName: brand.publicVenueName || tenant?.name || brand.displayName,
      logoUrl: brand.logoUrl || '/assets/maple-default-logo.png',
    });
  }),

  getSettings: catchAsync(async (req: Request, res: Response) => {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) return res.status(403).json({ error: 'Tenant context is missing.' });
    // מנסים לשלוף את ההגדרות
    let settings = await prisma.systemSettings.findFirst({ where: { id: 'global',
        tenantId: tenantId
    } });
    
    // אם זו הפעם הראשונה שמפעילים את המערכת ואין עדיין הגדרות - ניצור אותן עם ברירות המחדל
    if (!settings) {
      settings = await prisma.systemSettings.create({ data: { contractText: DEFAULT_CONTRACT_TEXT,
          tenantId: tenantId
    } });
    }

    const paymentMeta = getPaymentTemplatesFromSettings(settings);

    res.json({
      ...settings,
      contractText: settings.contractText?.trim() || DEFAULT_CONTRACT_TEXT,
      paymentTemplates: paymentMeta.templates,
      defaultPaymentTemplateId: paymentMeta.defaultTemplateId,
      easycount: getEasyCountMeta(),
    });
  }),

  updateSettings: catchAsync(async (req: Request, res: Response) => {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) return res.status(403).json({ error: 'Tenant context is missing.' });

    const existing = await prisma.systemSettings.findFirst({
      where: { tenantId },
    });

    if (!existing) {
      const created = await prisma.systemSettings.create({
        data: {
          ...req.body,
          tenantId,
          contractText: req.body.contractText?.trim() || DEFAULT_CONTRACT_TEXT,
        },
      });
      res.json(created);
      emitSettingsUpdated();
      return;
    }

    const settings = await prisma.systemSettings.update({
      where: { id: existing.id },
      data: req.body,
    });
    res.json(settings);
    emitSettingsUpdated();
  }),

  // =========================================
  // מחירון תוספות דינמיות (קטלוג שירותים)
  // =========================================

  getExtras: catchAsync(async (req: Request, res: Response) => {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) return res.status(403).json({ error: 'Tenant context is missing.' });
    const extras = await prisma.extraService.findMany({
      orderBy: { category: 'asc' }, // נסדר לפי קטגוריות שיהיה יפה
        where: { tenantId }
    });
    res.json(extras);
  }),

  addExtra: catchAsync(async (req: Request, res: Response) => {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) return res.status(403).json({ error: 'Tenant context is missing.' });
    const { name, category, price } = req.body;
    const extra = await prisma.extraService.create({
      data: { name, category, price: Number(price),
          tenantId: tenantId
    }
    });
    res.json(extra);
    emitSettingsUpdated();
  }),

  updateExtra: catchAsync(async (req: Request, res: Response) => {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) return res.status(403).json({ error: 'Tenant context is missing.' });
    const data = req.body as { name?: string; category?: string; price?: number; isActive?: boolean };

    const extra = await prisma.extraService.updateMany({
      where: { id: req.params.id as string,
          tenantId: tenantId
    },
      data,
    });
    res.json(extra);
    emitSettingsUpdated();
  }),

  getStaff: catchAsync(async (_req: Request, res: Response) => {
      const tenantId = (_req as any).user?.tenantId;
      if (!tenantId) return res.status(403).json({ error: 'Tenant context is missing.' });
    let staff = await prisma.staffMember.findMany({
      where: { isActive: true,
          tenantId: tenantId
    },
      orderBy: { name: 'asc' },
    });

    if (staff.length === 0) {
      const defaults = ['מוישי', 'ציפי', 'שימי'];
      await prisma.staffMember.createMany({
        data: defaults.map(name => ({ name, tenantId })),
        skipDuplicates: true,
      });
      staff = await prisma.staffMember.findMany({
        where: { isActive: true,
            tenantId: tenantId
        },
        orderBy: { name: 'asc' },
      });
    }

    res.json(staff);
  }),

  addStaff: catchAsync(async (req: Request, res: Response) => {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) return res.status(403).json({ error: 'Tenant context is missing.' });
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'יש להזין שם עובד.' });
    }

    const existing = await prisma.staffMember.findFirst({ where: { name,
        tenantId: tenantId
    } });
    if (existing) {
      if (!existing.isActive) {
        const restored = await prisma.staffMember.updateMany({
          where: { id: existing.id,
              tenantId: tenantId
        },
          data: { isActive: true },
        });
        emitSettingsUpdated();
        return res.json(restored);
      }
      return res.status(409).json({ success: false, message: 'עובד בשם זה כבר קיים.' });
    }

    const member = await prisma.staffMember.create({ data: { name,
        tenantId: tenantId
    } });
    emitSettingsUpdated();
    res.status(201).json(member);
  }),

  deleteExtra: catchAsync(async (req: Request, res: Response) => {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) return res.status(403).json({ error: 'Tenant context is missing.' });
    const id = req.params.id as string;
    await prisma.extraService.deleteMany({ where: { id,
        tenantId: tenantId
    } });
    emitSettingsUpdated();
    res.json({ success: true });
  }),

  deleteStaff: catchAsync(async (req: Request, res: Response) => {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) return res.status(403).json({ error: 'Tenant context is missing.' });
    const id = req.params.id as string;
    await prisma.staffMember.deleteMany({ where: { id,
        tenantId: tenantId
    } });
    emitSettingsUpdated();
    res.json({ success: true });
  }),
};