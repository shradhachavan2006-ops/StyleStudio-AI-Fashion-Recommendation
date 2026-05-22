/* frontend/components/Navbar.tsx - Enhanced with animations */
'use client';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { LogOut, Menu, X, Sparkles } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const NO_NAV_PAGES = ['/welcome', '/login', '/register', '/admin'];

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (NO_NAV_PAGES.includes(pathname)) return null;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navLink = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      onClick={() => setMobileMenuOpen(false)}
      className={`relative text-sm font-medium transition-all duration-300 px-3 py-2 rounded-lg
        ${pathname === href
          ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30'
          : 'text-gray-600 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20'
        }`}
    >
      {label}
      {pathname === href && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-violet-500 rounded-full" />
      )}
    </Link>
  );

  return (
    <nav className={`sticky top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'glass-effect shadow-lg' : 'bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform duration-300">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight gradient-text">
              StyleStudio
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2">
              {user && (
                <>
                  {navLink('/dashboard', 'Dashboard')}
                  {navLink('/themes', 'Themes')}
                  {navLink('/outfits', 'Outfits')}
                  {navLink('/stores', 'Stores')}
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              
              {user ? (
                <div className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
                      {user.name?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden lg:inline">
                      {user.name}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all duration-300 hover:scale-110"
                    title="Logout"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link href="/login" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-violet-600 transition-colors">
                    Log in
                  </Link>
                  <Link
                    href="/register"
                    className="btn-primary text-sm py-2 px-4"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100 dark:border-gray-800 animate-slide-up">
            <div className="flex flex-col gap-2">
              {user ? (
                <>
                  {navLink('/dashboard', 'Dashboard')}
                  {navLink('/themes', 'Themes')}
                  {navLink('/outfits', 'Outfits')}
                  {navLink('/stores', 'Stores')}
                  <div className="pt-4 mt-2 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
                          {user.name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {user.name}
                        </span>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                      >
                        <LogOut size={18} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link href="/login" className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-violet-600 transition-colors">
                    Log in
                  </Link>
                  <Link href="/register" className="btn-primary text-center text-sm py-2">
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
