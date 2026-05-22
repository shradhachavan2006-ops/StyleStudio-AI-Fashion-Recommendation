/* frontend/app/admin/page.tsx - Enhanced Admin Dashboard */
'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import API from '@/lib/api';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Download,
  Gauge,
  Heart,
  LineChart,
  Lock,
  LogOut,
  MessageSquareText,
  Palette,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Star,
  ThumbsDown,
  Trash2,
  TrendingUp,
  UserCog,
  Users,
  Zap,
  Filter,
  Calendar,
  Loader2,
  Eye,
  Edit,
  MoreVertical,
} from 'lucide-react';

type Tab = 'overview' | 'users' | 'outfits' | 'satisfaction' | 'trends' | 'reports' | 'security';

interface Overview {
  admin: { name: string; email: string; role: string };
  generatedAt: string;
  metrics: Record<string, number | string | null>;
  charts: {
    activityTrend: Array<{ date: string; actions: number }>;
    popularThemes: Array<{ label: string; value: number }>;
    popularColors: Array<{ color: string; count: number }>;
  };
  topSaved: Array<{ _id: string; outfitName: string; theme: string; saves: number; colors?: string[] }>;
  realtime: {
    connectedUsers: number;
    sessions: Array<{
      id: string;
      user: string;
      email: string;
      action: string;
      outfit: string;
      theme: string;
      lastActiveAt: string;
      location: string;
      device: string;
      sessionDuration: string;
    }>;
  };
  recentUsers: Array<AdminUser>;
  auditLogs: Array<{ _id: string; action: string; targetType: string; createdAt: string; adminId?: { name: string; email: string } }>;
  system: Record<string, number | string | null>;
}

interface Satisfaction {
  summary: Record<string, number>;
  ratingDistribution: Array<{ rating: number; count: number }>;
  trendingLiked: Array<{ _id: string; outfitName: string; theme: string; score: number; actions: number }>;
  dislikedPatterns: Array<{ item: string; count: number }>;
  commonTerms: Array<{ word: string; count: number }>;
  recent: Array<{ id: string; rating: number; sentiment: string; comment: string; user: string; outfit: string; theme: string; timestamp: string }>;
}

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  lastActiveAt?: string;
  lastLoginAt?: string;
  loginCount?: number;
  engagementScore?: number;
  actionCount?: number;
  savedCount?: number;
}

interface AdminOutfit {
  _id: string;
  outfitName: string;
  description?: string;
  theme: string;
  style?: string;
  status?: string;
  colors?: string[];
  clothingPieces?: string[];
  updatedAt?: string;
}

interface Trends {
  themes: Array<{ _id: string; count: number }>;
  colors: Array<{ _id: string; count: number }>;
  footwear: Array<{ _id: string; count: number }>;
  styles: Array<{ _id: string; count: number }>;
  forecast: Array<{ trend: string; confidence: number; insight: string }>;
}

interface Reports {
  reports: Array<{ id: string; title: string; rows: number; format: string }>;
}

const tabs: Array<{ id: Tab; label: string; icon: typeof BarChart3; description: string }> = [
  { id: 'overview', label: 'Overview', icon: BarChart3, description: 'Platform metrics and real-time activity' },
  { id: 'users', label: 'User Management', icon: Users, description: 'Manage users, roles, and permissions' },
  { id: 'outfits', label: 'Outfit Library', icon: Sparkles, description: 'Review and moderate outfit catalog' },
  { id: 'satisfaction', label: 'User Satisfaction', icon: Heart, description: 'Feedback analysis and sentiment tracking' },
  { id: 'trends', label: 'Trend Analytics', icon: TrendingUp, description: 'Fashion trends and predictions' },
  { id: 'reports', label: 'Reports', icon: Download, description: 'Export data and analytics' },
  { id: 'security', label: 'Security', icon: Shield, description: 'Audit logs and system monitoring' },
];

function formatNumber(num: number | string | null): string {
  if (num === null || num === undefined) return 'N/A';
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return String(num);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function formatDate(value?: string) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return formatDate(dateString);
}

function StatCard({ icon: Icon, label, value, detail, trend, trendUp }: { 
  icon: typeof Users; 
  label: string; 
  value: string | number | null; 
  detail: string;
  trend?: number;
  trendUp?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm border border-white/10 p-6 hover:border-violet-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-violet-500/10">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/10 to-pink-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 shadow-lg shadow-violet-500/30">
            <Icon size={22} className="text-white" />
          </div>
          {trend !== undefined && (
            <span className={`flex items-center gap-1 text-xs font-bold ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {trendUp ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
        </div>
        <div className="text-3xl font-black text-white tracking-tight">{formatNumber(value)}</div>
        <div className="mt-1 text-sm font-semibold text-gray-300">{label}</div>
        <p className="mt-2 text-xs leading-relaxed text-gray-400">{detail}</p>
      </div>
    </div>
  );
}

function ProgressBar({ value, max, label, color = 'bg-violet-500' }: { value: number; max: number; label?: string; color?: string }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      {label && <div className="flex justify-between text-xs text-gray-400"><span>{label}</span><span>{value}</span></div>}
      <div className="h-2 overflow-hidden rounded-full bg-gray-700/50">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function LoginGate({
  onLogin,
  onRegisterAdmin,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegisterAdmin: (name: string, email: string, password: string, setupKey: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<'login' | 'create'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'create') {
        await onRegisterAdmin(name, email, password, setupKey);
      } else {
        await onLogin(email, password);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || (mode === 'create' ? 'Admin account creation failed' : 'Admin login failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950/50 flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-violet-600/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <div className="text-white animate-slide-in-left">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/20 border border-violet-500/30 mb-6">
            <Lock size={14} className="text-violet-400" />
            <span className="text-sm font-medium text-violet-300">Secure Admin Access</span>
          </div>
          <h1 className="text-5xl lg:text-6xl font-black tracking-tight mb-6">
            Admin Control
            <span className="gradient-text block">Center</span>
          </h1>
          <p className="text-xl text-gray-300 leading-relaxed">
            Monitor recommendations, users, feedback, and dataset quality from one command dashboard.
          </p>
          <div className="mt-8 flex gap-4">
            <div className="flex items-center gap-2 text-gray-400">
              <Shield size={16} />
              <span className="text-sm">Role-based access</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Activity size={16} />
              <span className="text-sm">Real-time metrics</span>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="relative bg-gray-900/60 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl animate-slide-up">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-violet-500/20 to-pink-500/20 rounded-full blur-2xl" />
          <div className="relative">
            <h2 className="text-2xl font-bold text-white mb-2">{mode === 'create' ? 'Create Admin' : 'Admin Login'}</h2>
            <p className="text-sm text-gray-400 mb-6">
              {mode === 'create'
                ? 'Create a role-based admin account for the dashboard'
                : 'Use an account with admin role or configured email'}
            </p>

            <div className="mb-5 grid grid-cols-2 rounded-xl border border-white/10 bg-black/30 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                  mode === 'login' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('create');
                  setError('');
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                  mode === 'create' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Create Admin
              </button>
            </div>
            
            <div className="space-y-5">
              {mode === 'create' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                    placeholder="Admin"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  placeholder="admin@stylestudio.com"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    {showPassword ? <Eye size={18} /> : <Lock size={18} />}
                  </button>
                </div>
              </div>

              {mode === 'create' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Setup Key</label>
                  <input
                    type="password"
                    value={setupKey}
                    onChange={(e) => setSetupKey(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                    placeholder="Required after first admin"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    For the first admin this can be blank. After that, use ADMIN_SETUP_KEY from backend/.env.
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                  <p className="text-sm font-medium text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold py-3 rounded-xl hover:shadow-lg hover:shadow-violet-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {mode === 'create' ? 'Creating admin...' : 'Authenticating...'}
                  </>
                ) : (
                  <>
                    <Shield size={18} />
                    {mode === 'create' ? 'Create Admin Account' : 'Enter Dashboard'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, login, registerAdmin, logout, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [satisfaction, setSatisfaction] = useState<Satisfaction | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [outfits, setOutfits] = useState<AdminOutfit[]>([]);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [reports, setReports] = useState<Reports | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [outfitSearch, setOutfitSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedOutfit, setSelectedOutfit] = useState<AdminOutfit | null>(null);

  const loginToAdmin = async (email: string, password: string) => {
    await login(email, password);
    setError('');
  };

  const createAdmin = async (name: string, email: string, password: string, setupKey: string) => {
    await registerAdmin(name, email, password, setupKey);
    setError('');
  };

  const loadAll = async () => {
    setFetching(true);
    setError('');
    try {
      const [overviewRes, satisfactionRes, usersRes, outfitsRes, trendsRes, reportsRes] = await Promise.all([
        API.get('/api/admin/overview'),
        API.get('/api/admin/satisfaction'),
        API.get('/api/admin/users'),
        API.get('/api/admin/outfits'),
        API.get('/api/admin/trends'),
        API.get('/api/admin/reports'),
      ]);
      setOverview(overviewRes.data);
      setSatisfaction(satisfactionRes.data);
      setUsers(usersRes.data.users || []);
      setOutfits(outfitsRes.data.outfits || []);
      setTrends(trendsRes.data);
      setReports(reportsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to load admin dashboard');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!loading && user) loadAll();
  }, [loading, user]);

  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      API.get('/api/admin/overview')
        .then((res) => setOverview(res.data))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [user]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    return users.filter((item) => `${item.name} ${item.email} ${item.role} ${item.status}`.toLowerCase().includes(q));
  }, [userSearch, users]);

  const filteredOutfits = useMemo(() => {
    const q = outfitSearch.toLowerCase();
    return outfits.filter((item) => `${item.outfitName} ${item.theme} ${item.status} ${item.style}`.toLowerCase().includes(q));
  }, [outfitSearch, outfits]);

  const updateUser = async (id: string, patch: Record<string, unknown>) => {
    try {
      const res = await API.patch(`/api/admin/users/${id}`, patch);
      setUsers((prev) => prev.map((item) => (item._id === id ? { ...item, ...res.data.user } : item)));
      setNotice(`User updated successfully`);
      setTimeout(() => setNotice(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Update failed');
      setTimeout(() => setError(''), 3000);
    }
  };

  const updateOutfit = async (id: string, patch: Record<string, unknown>) => {
    try {
      const res = await API.patch(`/api/admin/outfits/${id}`, patch);
      setOutfits((prev) => prev.map((item) => (item._id === id ? { ...item, ...res.data.outfit } : item)));
      setNotice(`Outfit updated successfully`);
      setTimeout(() => setNotice(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Update failed');
      setTimeout(() => setError(''), 3000);
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      await API.delete(`/api/admin/users/${id}`);
      setUsers((prev) => prev.filter((item) => item._id !== id));
      setNotice(`User deleted successfully`);
      setTimeout(() => setNotice(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Delete failed');
      setTimeout(() => setError(''), 3000);
    }
  };

  const sendNotification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await API.post('/api/admin/notifications', {
        title: data.get('title'),
        message: data.get('message'),
        type: data.get('type'),
        channel: data.get('channel'),
      });
      setNotice('Notification sent successfully.');
      setTimeout(() => setNotice(''), 3000);
      event.currentTarget.reset();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send notification');
      setTimeout(() => setError(''), 3000);
    }
  };

  const downloadReport = async (type: string) => {
    try {
      const res = await API.get('/api/admin/reports/export', {
        params: { type },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice(`Report exported successfully`);
      setTimeout(() => setNotice(''), 3000);
    } catch (err) {
      setError('Failed to export report');
      setTimeout(() => setError(''), 3000);
    }
  };

  if (loading) return null;
  if (!user || error === 'Admin access required') {
    return <LoginGate onLogin={loginToAdmin} onRegisterAdmin={createAdmin} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950/30">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-gray-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 shadow-lg shadow-violet-500/30">
                <Shield size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white">StyleStudio Admin</h1>
                <p className="text-sm text-gray-400">AI fashion analytics and operations control center</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadAll}
                disabled={fetching}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-white/10 transition-all disabled:opacity-50"
              >
                <RefreshCw size={16} className={fetching ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                onClick={() => {
                  logout();
                  router.push('/admin');
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-all"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-[280px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <div className="rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur-sm p-4">
              {tabs.map(({ id, label, icon: Icon, description }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`group relative w-full flex items-center gap-3 rounded-xl px-4 py-3 mb-1 text-left transition-all duration-200 ${
                    tab === id
                      ? 'bg-gradient-to-r from-violet-600/20 to-pink-600/20 border border-violet-500/30'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <Icon size={18} className={tab === id ? 'text-violet-400' : 'text-gray-400 group-hover:text-gray-300'} />
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${tab === id ? 'text-white' : 'text-gray-400'}`}>{label}</p>
                    {tab === id && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
                  </div>
                  {tab === id && <ChevronRight size={14} className="text-violet-400" />}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur-sm p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {overview?.admin?.name?.charAt(0) || user.name?.charAt(0) || 'A'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{overview?.admin?.name || user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{overview?.admin?.email || user.email}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/10">
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-1 text-xs font-semibold text-violet-300">
                  <Shield size={10} />
                  {overview?.admin?.role || user.role || 'admin'}
                </span>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <section className="min-h-[calc(100vh-200px)]">
            {error && (
              <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-sm font-medium text-red-400">{error}</p>
              </div>
            )}
            {notice && (
              <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 animate-slide-up">
                <p className="text-sm font-medium text-emerald-400">{notice}</p>
              </div>
            )}

            {/* Overview Tab */}
            {tab === 'overview' && overview && (
              <div className="space-y-6 animate-slide-up">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard icon={Users} label="Total Users" value={overview.metrics.totalUsers} detail="Registered accounts on the platform" trend={12} trendUp />
                  <StatCard icon={Activity} label="Active Users" value={overview.metrics.activeUsers} detail="Active in last 7 days" />
                  <StatCard icon={Sparkles} label="Recommendations" value={overview.metrics.totalRecommendations} detail="Outfit records generated" />
                  <StatCard icon={Star} label="Satisfaction" value={`${overview.metrics.averageSatisfaction}/5`} detail="Average feedback score" />
                  <StatCard icon={Heart} label="Likes" value={overview.metrics.totalLikes} detail="Total positive interactions" trend={8} trendUp />
                  <StatCard icon={ThumbsDown} label="Dislikes" value={overview.metrics.totalDislikes} detail="Rejected combinations" trend={3} trendUp={false} />
                  <StatCard icon={Gauge} label="Success Rate" value={`${overview.metrics.recommendationSuccessRate}%`} detail="Positive actions ratio" />
                  <StatCard icon={Database} label="Dataset" value={overview.system.datasetImages} detail={`${overview.system.imageStorageMb} MB storage`} />
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold text-white">Activity Trend (30 days)</h2>
                      <span className="text-sm text-emerald-400">{overview.realtime.connectedUsers} online</span>
                    </div>
                    <div className="h-48">
                      <div className="flex h-40 items-end gap-1">
                        {(overview.charts.activityTrend.length ? overview.charts.activityTrend : [{ date: 'No data', actions: 0 }]).map((row) => {
                          const max = Math.max(1, ...overview.charts.activityTrend.map(r => r.actions));
                          const height = (row.actions / max) * 140;
                          return (
                            <div key={row.date} className="flex-1 flex flex-col items-center gap-1 group">
                              <div className="relative w-full">
                                <div 
                                  className="w-full rounded-t-lg bg-gradient-to-t from-violet-500 to-pink-500 transition-all duration-300 group-hover:opacity-80"
                                  style={{ height: `${Math.max(4, height)}px` }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-500 rotate-45 origin-left translate-x-2">{row.date.slice(5)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur-sm p-6">
                      <h2 className="text-xl font-bold text-white mb-4">Popular Themes</h2>
                      {overview.charts.popularThemes.map((theme, idx) => (
                        <ProgressBar key={theme.label} value={theme.value} max={overview.charts.popularThemes[0]?.value || 1} label={theme.label} />
                      ))}
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur-sm p-6">
                      <h2 className="text-xl font-bold text-white mb-4">Trending Colors</h2>
                      <div className="flex flex-wrap gap-2">
                        {overview.charts.popularColors.slice(0, 8).map((color) => (
                          <div key={color.color} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2">
                            <span className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: color.color }} />
                            <span className="text-xs text-gray-300">{color.color}</span>
                            <span className="text-xs text-gray-500">{color.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur-sm">
                  <div className="border-b border-white/10 p-6">
                    <h2 className="text-xl font-bold text-white">Real-time Activity</h2>
                  </div>
                  <div className="divide-y divide-white/10">
                    {overview.realtime.sessions.slice(0, 5).map((session) => (
                      <div key={session.id} className="p-4 hover:bg-white/5 transition-colors">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white">
                              {session.user} <span className="text-gray-400">viewed</span> {session.outfit}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span>{session.device}</span>
                              <span>•</span>
                              <span>{session.location}</span>
                              <span>•</span>
                              <span>{formatRelativeTime(session.lastActiveAt)}</span>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-3 py-1 text-xs font-semibold text-violet-300">
                            <Activity size={10} />
                            {session.action}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {tab === 'users' && (
              <div className="rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur-sm animate-slide-up">
                <div className="flex flex-col gap-4 border-b border-white/10 p-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">User Management</h2>
                    <p className="mt-1 text-sm text-gray-400">Search, manage roles, and monitor user engagement</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search by name, email, or role..."
                      className="w-full md:w-80 rounded-xl border border-white/10 bg-black/30 pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-violet-500 transition-all"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead className="border-b border-white/10 bg-gray-800/30">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">User</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Role</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Engagement</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Last Active</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {filteredUsers.slice(0, 20).map((item) => (
                        <tr key={item._id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-white">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.email}</p>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={item.role}
                              onChange={(e) => updateUser(item._id, { role: e.target.value })}
                              className="rounded-lg border border-white/10 bg-gray-800 px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500"
                            >
                              {['user', 'admin'].map((role) => (
                                <option key={role}>{role}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => updateUser(item._id, { status: item.status === 'suspended' ? 'active' : 'suspended' })}
                              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                                item.status === 'suspended'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-emerald-500/20 text-emerald-400'
                              }`}
                            >
                              {item.status === 'suspended' ? 'Suspended' : 'Active'}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-300">
                            {item.engagementScore || 0} pts · {item.savedCount || 0} saved
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-400">{formatRelativeTime(item.lastActiveAt)}</td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateUser(item._id, { resetPreferences: true })}
                                className="rounded-lg border border-white/10 p-2 hover:bg-white/10 transition-colors"
                                title="Reset preferences"
                              >
                                <UserCog size={14} />
                              </button>
                              <button
                                onClick={() => deleteUser(item._id)}
                                className="rounded-lg border border-red-500/30 p-2 text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete user"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                           </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Outfits Tab */}
            {tab === 'outfits' && (
              <div className="rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur-sm animate-slide-up">
                <div className="flex flex-col gap-4 border-b border-white/10 p-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">Outfit Management</h2>
                    <p className="mt-1 text-sm text-gray-400">Review, approve, and manage outfit catalog</p>
                  </div>
                  <input
                    value={outfitSearch}
                    onChange={(e) => setOutfitSearch(e.target.value)}
                    placeholder="Search outfits..."
                    className="w-full md:w-80 rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-violet-500 transition-all"
                  />
                </div>
                <div className="grid gap-4 p-6 md:grid-cols-2">
                  {filteredOutfits.slice(0, 12).map((item) => (
                    <div key={item._id} className="group rounded-xl border border-white/10 bg-black/20 p-5 hover:border-violet-500/50 transition-all duration-300">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-white truncate">{item.outfitName}</h3>
                          <p className="mt-1 text-sm text-gray-400 line-clamp-2">{item.description || 'No description available'}</p>
                        </div>
                        <select
                          value={item.status || 'approved'}
                          onChange={(e) => updateOutfit(item._id, { status: e.target.value })}
                          className={`rounded-lg border px-3 py-1.5 text-sm font-semibold outline-none transition-all ${
                            item.status === 'removed'
                              ? 'border-red-500/30 bg-red-500/10 text-red-400'
                              : item.status === 'review'
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          }`}
                        >
                          <option value="approved">✓ Approved</option>
                          <option value="review">⏳ Review</option>
                          <option value="removed">✗ Removed</option>
                        </select>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-semibold text-violet-300">{item.theme}</span>
                        <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-300">{item.style || 'Unclassified'}</span>
                      </div>
                      {item.colors && item.colors.length > 0 && (
                        <div className="mt-3 flex gap-1">
                          {item.colors.slice(0, 5).map((color) => (
                            <span key={color} className="h-5 w-5 rounded-full border border-white/20" style={{ backgroundColor: color }} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Satisfaction Tab */}
            {tab === 'satisfaction' && satisfaction && (
              <div className="space-y-6 animate-slide-up">
                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard icon={MessageSquareText} label="Total Feedback" value={satisfaction.summary.totalFeedback} detail="User feedback submissions" />
                  <StatCard icon={Star} label="Average Score" value={`${satisfaction.summary.averageScore}/5`} detail="Overall satisfaction rating" />
                  <StatCard icon={CheckCircle2} label="Positive" value={`${satisfaction.summary.positivePct}%`} detail="Ratings of 4 or 5 stars" />
                  <StatCard icon={AlertTriangle} label="Negative" value={`${satisfaction.summary.negativePct}%`} detail="Ratings of 1 or 2 stars" />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur-sm p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Rating Distribution</h2>
                    {[5, 4, 3, 2, 1].map((rating) => {
                      const data = satisfaction.ratingDistribution.find(r => r.rating === rating);
                      const count = data?.count || 0;
                      const max = Math.max(1, ...satisfaction.ratingDistribution.map(r => r.count));
                      return <ProgressBar key={rating} value={count} max={max} label={`${rating} Star${rating !== 1 ? 's' : ''}`} />;
                    })}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur-sm p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Most Loved Outfits</h2>
                    <div className="space-y-3">
                      {satisfaction.trendingLiked.slice(0, 5).map((item) => (
                        <div key={item._id} className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-white">{item.outfitName}</p>
                            <p className="text-xs text-gray-400">{item.theme}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Heart size={14} className="text-pink-400" />
                            <span className="text-sm text-gray-300">{item.actions} likes</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur-sm">
                  <div className="border-b border-white/10 p-6">
                    <h2 className="text-xl font-bold text-white">Recent Feedback</h2>
                  </div>
                  <div className="divide-y divide-white/10">
                    {satisfaction.recent.slice(0, 10).map((item) => (
                      <div key={item.id} className="p-5 hover:bg-white/5 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                                item.sentiment === 'positive' ? 'bg-emerald-500/20 text-emerald-400' :
                                item.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                <Star size={10} />
                                {item.rating}/5
                              </span>
                              <span className="text-xs text-gray-500">{formatRelativeTime(item.timestamp)}</span>
                            </div>
                            <p className="text-gray-300">{item.comment || 'No written feedback'}</p>
                            <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                              <span>{item.user}</span>
                              <span>•</span>
                              <span>{item.outfit}</span>
                              <span>•</span>
                              <span className="capitalize">{item.theme}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Trends Tab */}
            {tab === 'trends' && trends && (
              <div className="space-y-6 animate-slide-up">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur-sm p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Popular Categories</h2>
                    {trends.themes.slice(0, 6).map((theme) => (
                      <ProgressBar key={theme._id} value={theme.count} max={trends.themes[0]?.count || 1} label={theme._id || 'Unknown'} />
                    ))}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur-sm p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Footwear Trends</h2>
                    {trends.footwear.slice(0, 6).map((item) => (
                      <ProgressBar key={item._id} value={item.count} max={trends.footwear[0]?.count || 1} label={item._id} color="bg-cyan-500" />
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {trends.forecast.map((item) => (
                    <div key={item.trend} className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/60 to-gray-800/30 p-6">
                      <div className="text-3xl font-black text-white">{item.confidence}%</div>
                      <h3 className="mt-2 font-bold text-lg capitalize text-violet-300">{item.trend}</h3>
                      <p className="mt-3 text-sm text-gray-400 leading-relaxed">{item.insight}</p>
                      <div className="mt-4 flex items-center gap-1 text-xs text-emerald-400">
                        <TrendingUp size={12} />
                        Trending
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reports Tab */}
            {tab === 'reports' && reports && (
              <div className="grid gap-6 lg:grid-cols-[1fr_400px] animate-slide-up">
                <div className="rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur-sm">
                  <div className="border-b border-white/10 p-6">
                    <h2 className="text-xl font-bold text-white">Exportable Reports</h2>
                    <p className="mt-1 text-sm text-gray-400">Download CSV exports for analysis and presentation</p>
                  </div>
                  <div className="divide-y divide-white/10">
                    {reports.reports.map((report) => (
                      <div key={report.id} className="flex items-center justify-between gap-4 p-5 hover:bg-white/5 transition-colors">
                        <div>
                          <p className="font-semibold text-white">{report.title}</p>
                          <p className="text-sm text-gray-500">{report.rows.toLocaleString()} rows · {report.format.toUpperCase()}</p>
                        </div>
                        <button
                          onClick={() => downloadReport(report.id.includes('outfit') ? 'outfits' : report.id.includes('feedback') ? 'feedback' : 'users')}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-white/10 transition-all"
                        >
                          <Download size={14} />
                          Export
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <form onSubmit={sendNotification} className="rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur-sm p-6">
                  <h2 className="flex items-center gap-2 text-xl font-bold text-white mb-4">
                    <Bell size={20} className="text-violet-400" />
                    Send Notification
                  </h2>
                  <div className="space-y-4">
                    <input
                      name="title"
                      required
                      placeholder="Announcement title"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-violet-500 transition-all"
                    />
                    <textarea
                      name="message"
                      required
                      placeholder="Message content..."
                      rows={4}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-violet-500 transition-all resize-none"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <select name="type" className="rounded-xl border border-white/10 bg-gray-800 px-4 py-3 text-white outline-none focus:border-violet-500">
                        <option value="announcement">📢 Announcement</option>
                        <option value="trend-alert">📈 Trend Alert</option>
                        <option value="promotion">🎁 Promotion</option>
                        <option value="release">🚀 Release</option>
                      </select>
                      <select name="channel" className="rounded-xl border border-white/10 bg-gray-800 px-4 py-3 text-white outline-none focus:border-violet-500">
                        <option value="in-app">📱 In-app</option>
                        <option value="email">✉️ Email</option>
                        <option value="push">🔔 Push</option>
                      </select>
                    </div>
                    <button className="w-full bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold py-3 rounded-xl hover:shadow-lg hover:shadow-violet-500/30 transition-all duration-300">
                      Send Notification
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Security Tab */}
            {tab === 'security' && overview && (
              <div className="space-y-6 animate-slide-up">
                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard icon={Shield} label="API Security" value="Active" detail="JWT + role-based access control" />
                  <StatCard icon={Lock} label="Active Sessions" value={overview.metrics.onlineUsers} detail="Current user sessions" />
                  <StatCard icon={Zap} label="API Latency" value={`${overview.system.recommendationLatencyMs}ms`} detail="Avg recommendation speed" />
                  <StatCard icon={LineChart} label="ML Status" value={overview.system.modelStatus || 'Active'} detail="Rule engine + scoring" />
                </div>

                <div className="rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur-sm">
                  <div className="border-b border-white/10 p-6">
                    <h2 className="text-xl font-bold text-white">Audit Logs</h2>
                  </div>
                  <div className="divide-y divide-white/10">
                    {overview.auditLogs.map((log) => (
                      <div key={log._id} className="flex items-center justify-between gap-4 p-5">
                        <div>
                          <p className="font-semibold text-white">{log.action}</p>
                          <p className="text-sm text-gray-500">{log.targetType || 'System'}</p>
                        </div>
                        <div className="text-sm text-gray-400">{formatRelativeTime(log.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur-sm p-6">
                  <h2 className="text-xl font-bold text-white mb-4">System Health</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {Object.entries(overview.system).slice(0, 6).map(([key, value]) => (
                      <div key={key} className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs font-semibold uppercase text-gray-500">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                        <p className="mt-2 text-lg font-bold text-white">{value !== null && value !== undefined ? String(value) : 'N/A'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
