/** A controllable stand-in for src/lib/supabase used by the component tests. */
type Result = { data: unknown; error: { message: string } | null };

export const rpcHandlers: Record<string, (args: Record<string, unknown>) => Result | Promise<Result>> = {};
export const tableData: Record<string, unknown[]> = {};
export let currentSession: unknown = null;
export function setSession(s: unknown) {
  currentSession = s;
}

function query(table: string) {
  const rows = () => tableData[table] ?? [];
  const chain: Record<string, unknown> = {};
  const self = new Proxy(chain, {
    get(_t, prop) {
      if (prop === 'then') return (resolve: (r: Result) => void) => resolve({ data: rows(), error: null });
      if (prop === 'single' || prop === 'maybeSingle') return async () => ({ data: rows()[0] ?? null, error: null });
      return () => self;
    },
  });
  return self;
}

export const supabase = {
  rpc: jest.fn(async (fn: string, args: Record<string, unknown>) => {
    const h = rpcHandlers[fn];
    if (!h) return { data: null, error: { message: `no handler for ${fn}` } };
    return h(args);
  }),
  from: jest.fn((t: string) => query(t)),
  auth: {
    getSession: jest.fn(async () => ({ data: { session: currentSession } })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: () => {} } } })),
    signInWithPassword: jest.fn(async ({ password }: { password: string }) => (password === 'Adventure123' ? { data: { user: {} }, error: null } : { data: {}, error: { message: 'Invalid login credentials' } })),
    signOut: jest.fn(async () => ({ error: null })),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  },
};
export const isConfigured = true;
