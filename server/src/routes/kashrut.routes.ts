import { Router } from 'express';
import prisma from '../config/prisma';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const kashruts = await prisma.kashrutCertificate.findMany();
    res.json(kashruts);
  } catch (error) {
    res.status(500).json({ error: 'שגיאה בשליפת כשרויות' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { imageUrl, validUntil } = req.body;
  
  console.log('--- ניסיון שמירת כשרות ---');
  console.log('ID שהתקבל:', id);
  console.log('נתונים שהתקבלו:', { imageUrl: imageUrl ? 'יש תמונה!' : 'אין', validUntil });

  try {
    const updated = await prisma.kashrutCertificate.update({
      where: { id: id }, // ודאי שזה תואם לשם השדה ב-Prisma
      data: {
        imageUrl: imageUrl,
        validUntil: validUntil ? new Date(validUntil) : undefined
      }
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('שגיאת פריזמה:', error);
    res.status(500).json({ error: 'שגיאה בשמירה', details: error.message });
  }
});

export default router;