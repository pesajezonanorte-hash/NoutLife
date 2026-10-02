/**
 * Build-time DB scripts (migrate-db, seed-production) run inside `vercel-build`.
 * Preview deployments have no DATABASE_URL, so they skip; a production build
 * without it must fail instead of shipping an unmigrated schema.
 */
export function shouldSkipBuildDbStep(script: string): boolean {
  if (process.env.DATABASE_URL) return false;
  if (process.env.VERCEL_ENV === 'production') {
    console.error(`${script}: DATABASE_URL is required for production builds.`);
    process.exit(1);
  }
  console.warn(`${script}: DATABASE_URL not set (VERCEL_ENV=${process.env.VERCEL_ENV ?? 'local'}), skipping.`);
  return true;
}
