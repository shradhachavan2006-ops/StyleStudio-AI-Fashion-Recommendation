'use client';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { LogOut, Sparkles } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

// Pages that have their own navigation — hide the global Navbar on these
const NO_NAV_PAGES = ['/welcome', '/login', '/register'];

export default function Navbar() {
  const { user, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  // Don't render Navbar on auth/welcome pages
  if (NO_NAV_PAGES.includes(pathname)) return null;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navLink = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      className={`text-sm font-medium transition-colors px-1 py-0.5 border-b-2
        ${pathname === href
          ? 'text-violet-400 border-violet-400'
          : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-violet-500'
        }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="border-b bg-white dark:bg-gray-950 border-gray-100 dark:border-gray-800
                    px-6 py-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500
                        flex items-center justify-center shadow-md shadow-violet-500/30">
          <span className="text-white font-bold text-lg">S</span>
        </div>
        <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent
                         bg-gradient-to-r from-violet-500 to-pink-500">
          StyleStudio
        </span>
      </Link>

      <div className="flex items-center gap-5">
        <ThemeToggle />

        {user ? (
          <div className="flex items-center gap-5">
            {/* Nav links */}
            {navLink('/dashboard',  'Dashboard')}
            {navLink('/themes',     'Themes')}
            {navLink('/outfits',    'Outfits')}
            {navLink('/stores',     '🗺️ Stores')}

            {/* Recommend — highlighted */}
            <Link
              href="/recommend"
              className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full
                          transition-all border
                ${pathname === '/recommend'
                  ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/30'
                  : 'border-violet-400/50 text-violet-500 hover:bg-violet-500/10 dark:border-violet-500/40'
                }`}
            >
              <Sparkles size={13} />
              Recommend
            </Link>

            {/* User / Logout */}
            <div className="flex items-center gap-2 border-l pl-4 dark:border-gray-800">
              <span className="text-sm font-medium truncate max-w-[100px] text-gray-700 dark:text-gray-300">
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium hover:text-violet-500 transition-colors">
              Log in
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium bg-black text-white dark:bg-white dark:text-black
                         px-4 py-2 rounded-full hover:opacity-90 transition-opacity"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
