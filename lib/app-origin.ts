/** Use deployment configuration, not client-supplied forwarded-host headers. */
export function appOrigin(request: Request): string {
  return new URL(
    process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || request.url,
  ).origin;
}
