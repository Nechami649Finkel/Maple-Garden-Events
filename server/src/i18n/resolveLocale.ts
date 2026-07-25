import type { Request } from 'express';
import { LOCALE_STORAGE_KEY, type Locale } from '@maple/shared/i18n';
import { resolveRequestLocale } from './getServerTranslation';

export function resolveLocaleFromRequest(req: Request, fallback?: Locale): Locale {
  const cookieLocale = req.cookies?.[LOCALE_STORAGE_KEY] as string | undefined;
  const headerLocale = req.headers['accept-language']?.split(',')[0];
  return resolveRequestLocale(cookieLocale ?? headerLocale, fallback);
}
