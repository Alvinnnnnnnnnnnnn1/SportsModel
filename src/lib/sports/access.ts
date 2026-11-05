/** The provider proxy is intentionally unsupported on public/serverless hosts. */
export function isLocalSportsRequest(request: Request): boolean {
  const url = new URL(request.url), origin = request.headers.get('origin');
  return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && (!origin || origin === url.origin);
}
