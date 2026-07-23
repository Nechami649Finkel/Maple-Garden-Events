/** Mock מרכזי ל-Prisma — מאפשר שליטה ב-AuthorizedUser וב-SystemSettings בכל בדיקה */

export const authorizedUserFindUnique = jest.fn();
export const systemSettingsFindUnique = jest.fn();
export const bookingFindUnique = jest.fn();
export const bookingFindMany = jest.fn();
export const bookingUpdate = jest.fn();
export const eventCheckInUpsert = jest.fn();
export const eventCheckInFindUnique = jest.fn();
export const eventCheckInCreate = jest.fn();
export const eventCheckInUpdate = jest.fn();
export const whatsappInboundCreate = jest.fn();
export const whatsappInboundUpdateMany = jest.fn();
export const tenantFindFirst = jest.fn();

const prismaMock = {
  authorizedUser: {
    findUnique: authorizedUserFindUnique,
  },
  systemSettings: {
    findUnique: systemSettingsFindUnique,
  },
  booking: {
    findUnique: bookingFindUnique,
    findMany: bookingFindMany,
    update: bookingUpdate,
  },
  eventCheckIn: {
    upsert: eventCheckInUpsert,
    findUnique: eventCheckInFindUnique,
    create: eventCheckInCreate,
    update: eventCheckInUpdate,
  },
  whatsAppInboundMessage: {
    create: whatsappInboundCreate,
    updateMany: whatsappInboundUpdateMany,
  },
  tenant: {
    findFirst: tenantFindFirst,
  },
  $transaction: jest.fn(),
};

export default prismaMock;
