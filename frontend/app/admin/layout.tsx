import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');

  if (!token) {
    redirect('/admin/login');
  }

  // Verify token is still valid by calling /api/admin/auth/me.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  let role = 'reviewer';

  try {
    const res = await fetch(`${apiUrl}/api/admin/auth/me`, {
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
        {/* Sidebar */}
        <nav
          className="w-64 min-h-screen bg-white border-r border-gray-200 p-4"
          aria-label="Admin navigation"
        >
          <div className="mb-6">
            <h1 className="text-lg font-bold text-green-700">Walkability Admin</h1>
            <span className="text-xs text-gray-500 capitalize">{role}</span>
          </div>
          <ul className="space-y-2" role="list">
            <li>
              <a
                href="/admin"
                className="block px-3 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium"
              >
                Dashboard
              </a>
            </li>
            <li>
              <a
                href="/admin/reports"
                className="block px-3 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium"
              >
                Reports
              </a>
            </li>
            {role === 'admin' && (
              <li>
                <a
                  href="/admin/users"
                  className="block px-3 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium"
                >
                  Users
                </a>
              </li>
            )}
          </ul>
        </nav>

        {/* Main content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
