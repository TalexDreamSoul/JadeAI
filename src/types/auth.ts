export interface AppUser {
  id: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  fingerprint?: string | null;
  authType: 'oauth' | 'fingerprint' | 'password';
  role: 'user' | 'admin';
}

export interface AuthState {
  user: AppUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
