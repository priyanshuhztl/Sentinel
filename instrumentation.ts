export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const g = global as typeof globalThis & { _twInit?: boolean };
    if (g._twInit) return;
    g._twInit = true;
    const { boot } = await import('./lib/server/watcher');
    const { startUsagePoller } = await import('./lib/server/usage');
    boot();
    startUsagePoller();
  }
}
