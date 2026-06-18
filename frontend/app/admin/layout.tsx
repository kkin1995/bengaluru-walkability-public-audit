import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { INTERNAL_API_URL } from '@/app/lib/config';
import AdminSidebar from './components/AdminSidebar';
import './admin.css';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get('x-pathname') ?? '';

  // Skip auth check for the login page itself — prevents infinite redirect loop.
  if (pathname.startsWith('/admin/login')) {
    return (
      <>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=localStorage.getItem('admin-theme');if(d==='dark')document.documentElement.classList.add('dark');else if(d==='light')document.documentElement.classList.remove('dark');})();`,
          }}
        />
        <div className="admin-portal" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
          {children}
        </div>
      </>
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');

  if (!token) {
    redirect('/admin/login');
  }

  // Verify token is still valid by calling /api/admin/auth/me.
  let role = 'reviewer';

  try {
    const res = await fetch(`${INTERNAL_API_URL}/api/admin/auth/me`, {
      headers: {
        Cookie: `admin_token=${token.value}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      redirect('/admin/login');
    }

    const user = await res.json() as { role?: string; is_super_admin?: boolean };
    role = user.is_super_admin ? 'super_admin' : (user.role ?? 'reviewer');
  } catch {
    redirect('/admin/login');
  }

  return (
    <>
      {/* FOTWT blocking script — reads localStorage before React hydrates to prevent flash-of-wrong-theme (D-10) */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var d=localStorage.getItem('admin-theme');if(d==='dark')document.documentElement.classList.add('dark');else if(d==='light')document.documentElement.classList.remove('dark');})();`,
        }}
      />
      <div className="admin-portal" style={{ minHeight: '100dvh', display: 'flex', background: 'var(--bg)' }}>
        {/* Sidebar — client component handles responsive drawer */}
        <AdminSidebar role={role} />

        {/* Main content — overflowY:auto lets list/form pages scroll via main
            while the report detail page's right rail scrolls independently */}
        <main style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {children}
        </main>
      </div>
    </>
  );
}
