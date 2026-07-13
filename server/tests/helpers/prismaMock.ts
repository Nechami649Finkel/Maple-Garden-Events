/** Mock מרכזי ל-Prisma — מאפשר שליטה ב-AuthorizedUser וב-SystemSettings בכל בדיקה */

export const authorizedUserFindUnique = jest.fn();
export const systemSettingsFindUnique = jest.fn();

const prismaMock = {
  authorizedUser: {
    findUnique: authorizedUserFindUnique,
  },
  systemSettings: {
    findUnique: systemSettingsFindUnique,
  },
  booking: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

export default prismaMock;
