import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { INTERNAL_API_URL } from '@/app/lib/config';
import AdminSidebar from './components/AdminSidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get('x-pathname') ?? '';

  // Skip auth check for the login page itself — prevents infinite redirect loop.
  if (pathname.startsWith('/admin/login')) {
    return <>{children}</>;
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

    const user = await res.json() as { role?: string };
    role = user.role ?? 'reviewer';
  } catch {
    redirect('/admin/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar — client component handles responsive drawer */}
        <AdminSidebar role={role} />

        {/* Main content — add left padding on mobile for hamburger clearance */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
