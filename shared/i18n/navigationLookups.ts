import { T, type TranslationKey } from './keys';

export type NavIconName =
  | 'dashboard'
  | 'calendar'
  | 'settings'
  | 'settingsAlt'
  | 'clipboard'
  | 'bookings'
  | 'star'
  | 'chart'
  | 'mail'
  | 'event';

export interface NavItemDef {
  labelKey: TranslationKey;
  path: string;
  icon: NavIconName;
}

export const NAV_ITEMS: NavItemDef[] = [
  { labelKey: T.NAV.DASHBOARD, path: '/dashboard', icon: 'dashboard' },
  { labelKey: T.NAV.CALENDAR, path: '/calendar', icon: 'calendar' },
  { labelKey: T.NAV.SETTINGS, path: '/settings', icon: 'settingsAlt' },
  { labelKey: T.NAV.OPTIONS_MANAGER, path: '/options-manager', icon: 'clipboard' },
  { labelKey: T.NAV.BOOKINGS_MANAGER, path: '/bookings-manager', icon: 'bookings' },
  { labelKey: T.NAV.FEEDBACK_MANAGER, path: '/feedback-manager', icon: 'star' },
  { labelKey: T.NAV.FEEDBACK_STATS, path: '/feedback-stats', icon: 'chart' },
  { labelKey: T.NAV.GREETING, path: '/greeting', icon: 'mail' },
  { labelKey: T.NAV.EVENT_FORM_MANAGER, path: '/event-form-manager', icon: 'event' },
];

export const ROUTE_TITLE_KEYS: Record<string, TranslationKey> = {
  '/dashboard': T.NAV.DASHBOARD,
  '/calendar': T.NAV.CALENDAR,
  '/booking': T.NAV.BOOKING_NEW,
  '/options-manager': T.NAV.OPTIONS_MANAGER,
  '/bookings-manager': T.NAV.BOOKINGS_MANAGER,
  '/greeting': T.NAV.GREETING,
  '/event-form-manager': T.NAV.EVENT_FORM_MANAGER,
  '/option': T.NAV.OPTION_NEW,
  '/menu': T.NAV.MENU,
  '/settings': T.NAV.SETTINGS,
  '/feedback-manager': T.NAV.FEEDBACK_MANAGER,
  '/feedback-stats': T.NAV.FEEDBACK_STATS,
  '/gallery': T.NAV.GALLERY,
};

export function resolveRouteTitleKey(pathname: string): TranslationKey | null {
  if (pathname.startsWith('/booking/close-option/')) {
    return T.NAV.BOOKING_CLOSE_FROM_OPTION;
  }
  if (pathname.startsWith('/booking/edit/')) {
    return T.NAV.BOOKING_EDIT;
  }
  if (pathname.startsWith('/feedback/')) {
    return T.NAV.FEEDBACK_PAGE;
  }
  return ROUTE_TITLE_KEYS[pathname] ?? null;
}

export function resolveRouteIcon(pathname: string): NavIconName | null {
  const item = NAV_ITEMS.find((nav) => isNavItemActive(pathname, nav.path));
  return item?.icon ?? null;
}

export function isNavItemActive(pathname: string, itemPath: string): boolean {
  if (itemPath === '/dashboard') return pathname === '/dashboard' || pathname === '/';
  if (itemPath === '/calendar') return pathname === '/calendar';
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}
