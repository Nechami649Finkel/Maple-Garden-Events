import { z } from 'zod';
import { USER_ROLES } from '../middlewares/requireRole';

const roleSchema = z.enum(USER_ROLES);

export const addAuthorizedUserSchema = z.object({
  body: z.object({
    email: z.string().trim().email('כתובת אימייל לא תקינה'),
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
