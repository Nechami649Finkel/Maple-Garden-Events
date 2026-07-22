import { z } from 'zod';
import { USER_ROLES } from '../middlewares/requireRole';
import { T } from '../i18n/getServerTranslation';

const roleSchema = z.enum(USER_ROLES);

export const addAuthorizedUserSchema = z.object({
  body: z.object({
    email: z.string().trim().email(T.SERVER.VALIDATION.EMAIL_INVALID),
    role: roleSchema.optional(),
  }),
});

export const updateAuthorizedUserRoleSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    role: roleSchema,
  }),
});

export const deleteAuthorizedUserSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const loginSchema = z.object({
  body: z.object({
    token: z.string().min(1),
  }),
});
