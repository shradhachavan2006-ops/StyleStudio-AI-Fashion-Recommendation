// 'use client';
// import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
// import axios from 'axios';

// interface User {
//   id: string;
//   name: string;
//   email: string;
//   bodyCharacteristics?: {
//     bodyType: string;
//     skinTone: string;
//     colorPreferences: string[];
//     appearance: string;
//   };
//   gender?: string;
// }

// interface AuthContextType {
//   user: User | null;
//   token: string | null;
//   login: (email: string, password: string) => Promise<void>;
//   register: (name: string, email: string, password: string) => Promise<void>;
//   logout: () => void;
//   updateUser: (data: Partial<User>) => void;
//   loading: boolean;
// }

// const AuthContext = createContext<AuthContextType | null>(null);

// export function AuthProvider({ children }: { children: ReactNode }) {
//   const [user, setUser] = useState<User | null>(null);
//   const [token, setToken] = useState<string | null>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const storedToken = localStorage.getItem('ss_token');
//     const storedUser = localStorage.getItem('ss_user');
//     if (storedToken && storedUser) {
//       setToken(storedToken);
//       setUser(JSON.parse(storedUser));
//       axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
//     }
//     setLoading(false);
//   }, []);

//   const login = useCallback(async (email: string, password: string) => {
//     const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, { email, password });
//     const { token, user } = res.data;
//     setToken(token);
//     setUser(user);
//     localStorage.setItem('ss_token', token);
//     localStorage.setItem('ss_user', JSON.stringify(user));
//     axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
//   }, []);

//   const register = useCallback(async (name: string, email: string, password: string) => {
//     const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`, { name, email, password });
//     const { token, user } = res.data;
//     setToken(token);
//     setUser(user);
//     localStorage.setItem('ss_token', token);
//     localStorage.setItem('ss_user', JSON.stringify(user));
//     axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
//   }, []);

//   const logout = useCallback(() => {
//     setToken(null);
//     setUser(null);
//     localStorage.removeItem('ss_token');
//     localStorage.removeItem('ss_user');
//     delete axios.defaults.headers.common['Authorization'];
//   }, []);

//   const updateUser = useCallback((data: Partial<User>) => {
//     setUser((prev) => {
//       if (!prev) return prev;
//       const updated = { ...prev, ...data };
//       localStorage.setItem('ss_user', JSON.stringify(updated));
//       return updated;
//     });
//   }, []);

//   return (
//     <AuthContext.Provider value={{ user, token, login, register, logout, updateUser, loading }}>
//       {children}
//     </AuthContext.Provider>
//   );
// }

// export function useAuth() {
//   const ctx = useContext(AuthContext);
//   if (!ctx) throw new Error('useAuth must be used within AuthProvider');
//   return ctx;
// }


'use client';
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import API from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BodyCharacteristics {
  skinTone: string;
  skinUndertone: string;
  bodyType: string;
  height: number | null;
  weight: number | null;
  age: number | null;
  hairColor: string;
  hairType: string;
  hairLength: string;
  eyeColor: string;
  colorPreferences: string[];
  additionalNotes: string;
}

export interface StylePreferences {
  style_preference: string;
  lifestyle: string;
  weather_preference: string;
  location_type: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  gender?: string;
  bodyCharacteristics?: Partial<BodyCharacteristics>;
  stylePreferences?: Partial<StylePreferences>;
  onboardingDone?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate from localStorage on mount
  // Note: no need to manually set axios headers — the request interceptor
  // in lib/api.ts reads ss_token from localStorage on every request.
  useEffect(() => {
    const storedToken = localStorage.getItem('ss_token');
    const storedUser = localStorage.getItem('ss_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // Fetch latest user from server (call after profile save)
  const refreshUser = useCallback(async () => {
    try {
      const res = await API.get('/api/profile');
      const doc = res.data;
      // Reshape Mongoose doc → User interface (Mongoose uses _id, we use id)
      const fresh: User = {
        id:                  doc._id ?? doc.id,
        name:                doc.name,
        email:               doc.email,
        gender:              doc.gender,
        bodyCharacteristics: doc.bodyCharacteristics,
        stylePreferences:    doc.stylePreferences,
        onboardingDone:      doc.onboardingDone,
      };
      setUser(fresh);
      localStorage.setItem('ss_user', JSON.stringify(fresh));
    } catch (err) {
      console.error('refreshUser error:', err);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await API.post('/api/auth/login', { email, password });
    const { token, user } = res.data;
    setToken(token);
    setUser(user);
    localStorage.setItem('ss_token', token);
    localStorage.setItem('ss_user', JSON.stringify(user));
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await API.post('/api/auth/register', { name, email, password });
    const { token, user } = res.data;
    setToken(token);
    setUser(user);
    localStorage.setItem('ss_token', token);
    localStorage.setItem('ss_user', JSON.stringify(user));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('ss_token');
    localStorage.removeItem('ss_user');
  }, []);

  const updateUser = useCallback((data: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      localStorage.setItem('ss_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, updateUser, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
