export type HttpResult = {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
  buffer?: Buffer;
};

export function isHttpResult(value: unknown): value is HttpResult {
  return !!value && typeof value === 'object' && 'status' in value && 'body' in value;
}
