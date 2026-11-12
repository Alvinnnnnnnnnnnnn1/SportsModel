/** Dashboard access is separate from the deliberately loopback-only provider proxy.
 * Only the existing Production origin or this exact Vercel Preview are trusted. */
export function isV6DashboardRequest(request: Request, env: Record<string, string | undefined> = process.env): boolean {
  const url = new URL(request.url), origin = request.headers.get('origin');
  if (['cross-site', 'same-site'].includes(request.headers.get('sec-fetch-site') ?? '')) return false;
  if (origin && origin !== url.origin) return false;
  if (url.username || url.password) return false;
  if (env.VERCEL !== '1' && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return true;
  if (url.protocol !== 'https:' || url.port) return false;
  if (url.origin === 'https://sports-model-mauve.vercel.app') return true;
  // Never accept arbitrary *.vercel.app hosts or a caller's forwarded headers.
  return env.VERCEL_ENV === 'preview' && [env.VERCEL_URL, env.VERCEL_BRANCH_URL]
    .filter((host): host is string => !!host && /^[a-z0-9-]+\.vercel\.app$/.test(host))
    .some(host => url.origin === `https://${host}`);
}
