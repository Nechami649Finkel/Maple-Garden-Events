export const KOSHER_PRICING: Record<string, { label: string; extra: number }> = {
  machpud: { label: 'הרב מחפוד', extra: 0 },
  rubin: { label: 'הרב רובין', extra: 10 },
  kehilot: { label: 'קהילות', extra: 10 },
  gross: { label: 'הרב גרוס', extra: 10 },
  landa: { label: 'הרב לנדא', extra: 20 },
  badatz: { label: 'בד"ץ העדה החרדית', extra: 20 },
};

export const DEFAULT_KOSHER_TYPE = 'machpud';
export const DEFAULT_VAT_TYPE = 'included';

export const SERVING_STYLES: Record<string, string> = {
  american: 'אמריקן סרביס',
  center: 'מרכז שולחן',
  bar: 'בר',
};

export const DEFAULT_SERVING_STYLE = 'american';

/** קישורי דמה לתשלום לספקים חיצוניים — יוחלפו בקישורים אמיתיים */
export const EXTERNAL_SUPPLIER_LINKS: Record<string, string> = {
  baseDesign: 'https://example.com/pay/design',
  lighting: 'https://example.com/pay/lighting',
  amplification: 'https://example.com/pay/sound',
  screens: 'https://example.com/pay/screens',
  fireworks: 'https://example.com/pay/fireworks',
};
