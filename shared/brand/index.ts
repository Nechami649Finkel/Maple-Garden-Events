import { BrandConfig } from './types';
import { defaultBrand } from './defaultBrand';

let currentBrand: BrandConfig | null = null;

/**
 * Returns the active brand configuration.
 * On Node/Server, it uses `process.env.TENANT_NAME`.
 * On Vite/Frontend, it uses `import.meta.env.VITE_TENANT_NAME`.
 */
export function getBrandConfig(): BrandConfig {
  if (currentBrand) return currentBrand;

  let tenantName: string | undefined;

  // Resolve environment variable safely based on the runtime
  if (typeof process !== 'undefined' && process.env && process.env.TENANT_NAME) {
    tenantName = process.env.TENANT_NAME;
  } else {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_TENANT_NAME) {
      // @ts-ignore
      tenantName = import.meta.env.VITE_TENANT_NAME;
    }
  }

  // Example for loading dynamic JSON config based on tenantName.
  // In a real multi-tenant setup with many brands, this might read a JSON file 
  // or fetch from a database at app startup. For now, we fallback to default.
  if (tenantName === 'maple' || !tenantName) {
    currentBrand = defaultBrand;
  } else {
    // Fallback to default if tenant is not recognized
    // Ideally we would load `${tenantName}.json` here.
    currentBrand = defaultBrand;
  }

  return currentBrand;
}

export * from './types';
export * from './defaultBrand';
