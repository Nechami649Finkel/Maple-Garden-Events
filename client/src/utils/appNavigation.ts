export { resolveRouteTitleKey } from '@shared/i18n/navigationLookups';

export function resolveDefaultBackPath(pathname: string): string {
  if (pathname.startsWith('/booking/close-option/')) return '/options-manager';
  if (pathname.startsWith('/booking/edit/')) return '/bookings-manager';
  if (pathname === '/gallery') return '/event-form-manager';
  if (pathname.startsWith('/feedback/')) return '/dashboard';
  return '/dashboard';
}

export function shouldShowGlobalBack(pathname: string): boolean {
  if (pathname === '/dashboard' || pathname === '/') return false;
  if (pathname === '/calendar') return false;
  if (pathname.startsWith('/feedback/')) return false;
  return true;
}
