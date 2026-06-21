import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// מודל מותאם אישית לאופציה החדשה
export const createOptionEntry = async (data: any) => {
  return await prisma.booking.create({
    data: {
      ...data,
      status: 'OPTION', // סטטוס מיוחד לאופציות
      createdBy: data.openedBy // השדה שביקשת
    }
  });
};