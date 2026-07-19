import {
  DEFAULT_LOCALE,
  type Locale,
  type PluralForms,
  type TranslationParams,
  type TranslationTree,
  type Translator,
} from './types';

function isDevEnvironment(): boolean {
  const nodeEnv = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
    ?.NODE_ENV;
  return nodeEnv === 'development';
}

function getNestedValue(tree: TranslationTree, keyPath: string): unknown {
  return keyPath.split('.').reduce<unknown>((node, segment) => {
    if (node && typeof node === 'object' && segment in node) {
      return (node as TranslationTree)[segment];
    }
    return undefined;
  }, tree);
}

export function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  );
}

export function pluralize(
  locale: Locale,
  forms: PluralForms,
  count: number,
  params?: TranslationParams,
): string {
  const category = new Intl.PluralRules(locale).select(count);
  const template = forms[category as keyof PluralForms] ?? forms.other;
  return interpolate(template, { ...params, count });
}

export function createTranslator(
  locale: Locale,
  catalog: Record<Locale, TranslationTree>,
): Translator {
  const fallbackTree = catalog[DEFAULT_LOCALE];
  const activeTree = catalog[locale] ?? fallbackTree;

  function resolveRaw(key: string): unknown {
    return getNestedValue(activeTree, key) ?? getNestedValue(fallbackTree, key);
  }

  function warnMissing(key: string): void {
    if (isDevEnvironment()) {
      console.warn(`[i18n] Missing translation: ${key} (${locale})`);
    }
  }

  function t(key: string, params?: TranslationParams): string {
    const raw = resolveRaw(key);

    if (typeof raw === 'string') {
      return interpolate(raw, params);
    }

    warnMissing(key);
    return key;
  }

  function tp(key: string, count: number, params?: TranslationParams): string {
    const raw = resolveRaw(key);

    if (raw && typeof raw === 'object' && 'other' in raw) {
      return pluralize(locale, raw as PluralForms, count, params);
    }

    warnMissing(key);
    return t(key, { ...params, count });
  }

  return { locale, t, tp };
}
