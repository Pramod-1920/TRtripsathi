'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { AdminNotificationsProvider } from '@/components/admin-notifications-provider';

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const shouldRetrySessionCheck = (error: unknown) => {
  const maybeError = error as { response?: { status?: number } };
  const status = maybeError.response?.status;

  if (!status) {
    return true;
  }

  return status >= 500;
};

async function getSessionWithStartupRetry() {
  const maxAttempts = 8;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await apiClient.get('/auth/me');
    } catch (error) {
      if (!shouldRetrySessionCheck(error) || attempt === maxAttempts) {
        throw error;
      }

      await sleep(750);
    }
  }

  throw new Error('Unable to check admin session');
}

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isLoginPage = pathname === '/login';
  const isLoading = useAuthStore((state) => state.isLoading);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setSession = useAuthStore((state) => state.setSession);
  const logout = useAuthStore((state) => state.logout);

  const sidebarWidthClass = sidebarCollapsed ? 'md:pl-20' : 'md:pl-60';

  const toggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen((current) => !current);
      return;
    }

    setSidebarCollapsed((current) => !current);
  };

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function loadSession() {
      setLoading(true);

      try {
        const response = await getSessionWithStartupRetry();
        const user = response.data as {
          id: string;
          phoneNumber: string;
          role: 'admin' | 'user';
        };

        if (!mounted) {
          return;
        }

        if (user.role !== 'admin') {
          logout();
          router.replace('/login?reason=admin-only');
          return;
        }

        setSession(user);
      } catch {
        if (!mounted) {
          return;
        }

        logout();
        router.replace('/login');
      }
    }

    void loadSession();

    return () => {
      mounted = false;
    };
  }, [isLoginPage, logout, router, setLoading, setSession]);

  // Inactivity logout: if admin page is inactive for 5 minutes, sign out
  useEffect(() => {
    if (isLoginPage) return;

    let timeoutId: number | undefined;

    const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes

    const resetTimeout = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(async () => {
        try {
          // attempt server logout
          await apiClient.post('/auth/logout');
        } catch {}
        logout();
        // force full navigation to login to avoid cached dashboard flashes
        window.location.replace('/login');
      }, INACTIVITY_MS);
    };

    const events = ['mousemove', 'keydown', 'touchstart', 'click'];
    events.forEach((e) => window.addEventListener(e, resetTimeout));

    // start timer
    resetTimeout();

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      events.forEach((e) => window.removeEventListener(e, resetTimeout));
    };
  }, [isLoginPage, logout]);

  // Do not rely on navigator.sendBeacon to logout (CSRF protected endpoints require a token).
  // Unload/logout via sendBeacon was removed because it may fail to clear server session.
  // Use server-side session expiry and normal POST /auth/logout flows instead.

  // Handle pages restored from Back-Forward Cache (BFCache) and popstate navigation.
  // Some browsers restore the page instantly from cache after navigating back which can show protected UI
  // before client-side auth checks run. Detect BFCache and force a fresh check/navigation.
  useEffect(() => {
    // pageshow handler must be synchronous to match EventListener type; use promises inside
    const handlePageShow = (event: Event) => {
      const p = event as PageTransitionEvent;
      if (p && 'persisted' in p && (p as PageTransitionEvent).persisted) {
        apiClient
          .get('/auth/me')
          .then(() => {
            // session still valid - reload to get fresh state
            window.location.reload();
          })
          .catch(() => {
            logout();
            window.location.replace('/login');
          });
      }
    };

    const handlePopState = () => {
      apiClient.get('/auth/me').catch(() => {
        logout();
        window.location.replace('/login');
      });
    };

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [logout]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Checking admin session...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminNotificationsProvider>
      <div className={`min-h-screen bg-background ${sidebarWidthClass}`}>
        <Sidebar collapsed={sidebarCollapsed} mobileOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />
        <div className="min-h-screen min-w-0 flex flex-col overflow-hidden">
          <Header onMenuClick={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
          <main className="flex-1 min-h-0 overflow-y-auto bg-background">{children}</main>
        </div>
      </div>
    </AdminNotificationsProvider>
  );
}
