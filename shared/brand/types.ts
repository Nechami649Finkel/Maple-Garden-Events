export interface BrandColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
  accentLight: string;
  accentDark: string;
  bg: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
}

export interface BrandContract {
  venueLegalName: string;
  signatureDisclaimer: string;
  defaultContractText: string;
}

export interface BrandMessaging {
  whatsappFooter: string;
  whatsappTeam: string;
  emailFromName: string;
  emailAlertsFromName: string;
  managerAlertEmail: string;
}

export interface BrandConfig {
  id: string;
  displayName: string;
  /** Public Hebrew venue name for contracts / i18n (`{venueName}`). */
  publicVenueName: string;
  /** Public English venue name for contracts / i18n (`{venueName}`). */
  publicVenueNameEn: string;
  shortName: string;
  phone: string;
  supportEmail: string;
  logoUrl: string;
  colors: BrandColors;
  contract: BrandContract;
  messaging: BrandMessaging;
}
