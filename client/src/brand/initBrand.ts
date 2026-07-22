import { getBrandConfig } from '@shared/brand/index';

export function initBrand() {
  const brand = getBrandConfig();
  
  // Set document title
  document.title = `${brand.displayName} — מערכת ניהול`;

  // Inject CSS variables into the root
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', brand.colors.primary);
  root.style.setProperty('--brand-primary-light', brand.colors.primaryLight);
  root.style.setProperty('--brand-primary-dark', brand.colors.primaryDark);
  root.style.setProperty('--brand-accent', brand.colors.accent);
  root.style.setProperty('--brand-accent-light', brand.colors.accentLight);
  root.style.setProperty('--brand-accent-dark', brand.colors.accentDark);
  root.style.setProperty('--brand-bg', brand.colors.bg);
  root.style.setProperty('--brand-surface', brand.colors.surface);
  root.style.setProperty('--brand-surface-raised', brand.colors.surfaceRaised);
  root.style.setProperty('--brand-text', brand.colors.text);
  root.style.setProperty('--brand-text-secondary', brand.colors.textSecondary);
  root.style.setProperty('--brand-text-muted', brand.colors.textMuted);
  root.style.setProperty('--brand-border', brand.colors.border);
  root.style.setProperty('--brand-border-strong', brand.colors.borderStrong);
}
