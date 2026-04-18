import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { initializePushNotifications } from '@/lib/native/push';

interface Profile {
  id: string;
  user_id: string;
  tenant_id: string | null;
  branch_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
}

interface Tenant {
  id: string;
  name: string;
  logo_url: string | null;
  onboarding_completed: boolean | null;  // nullable in DB — treated as false when null
  is_trial: boolean;
  trial_ends_at: string;
  subscription_plan: string;
  default_tax_rate: number | null;
  currency: string | null;
}

interface Branch {
  id: string;
  name: string;
  name_ar: string | null;
  address: string | null;
  phone: string | null;
  opening_time: string;
  closing_time: string;
  is_active: boolean;
}

type AppRole = 'owner' | 'manager' | 'receptionist' | 'cashier' | 'stylist' | 'inventory_clerk' | 'accountant' | 'readonly' | 'super_admin';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  tenant: Tenant | null;
  branches: Branch[];
  currentBranch: Branch | null;
  userRoles: AppRole[];
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchBranch: (branchId: string) => void;
  hasRole: (role: AppRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user,          setUser]          = useState<User | null>(null);
  const [session,       setSession]       = useState<Session | null>(null);
  const [profile,       setProfile]       = useState<Profile | null>(null);
  const [tenant,        setTenant]        = useState<Tenant | null>(null);
  const [branches,      setBranches]      = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [userRoles,     setUserRoles]     = useState<AppRole[]>([]);
  const [loading,       setLoading]       = useState(true);

  // ── Core profile fetch ───────────────────────────────────────
  const fetchProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, tenant_id, branch_id, full_name, avatar_url, phone')
        .eq('user_id', userId)
        .single();

      if (profileError) {
        // Profile doesn't exist yet (e.g. right after sign-up before insert completes)
        console.warn('Profile not found:', profileError.message);
        setProfile(null);
        setTenant(null);
        setBranches([]);
        setCurrentBranch(null);
        setUserRoles([]);
        return;
      }

      setProfile(profileData);

      if (profileData?.tenant_id) {
        // Fetch tenant, branches, and roles in parallel
        const [tenantResult, branchesResult, rolesResult] = await Promise.all([
          supabase.from('tenants').select('id, name, logo_url, onboarding_completed, is_trial, trial_ends_at, subscription_plan, default_tax_rate, currency').eq('id', profileData.tenant_id).single(),
          supabase.from('branches').select('id, name, name_ar, address, phone, opening_time, closing_time, is_active').eq('tenant_id', profileData.tenant_id).eq('is_active', true),
          supabase.from('user_roles').select('role').eq('user_id', userId).eq('tenant_id', profileData.tenant_id),
        ]);

        setTenant(tenantResult.data ?? null);

        const branchesData = branchesResult.data || [];
        setBranches(branchesData);

        if (branchesData.length > 0) {
          const defaultBranch = profileData.branch_id
            ? branchesData.find(b => b.id === profileData.branch_id) || branchesData[0]
            : branchesData[0];
          setCurrentBranch(defaultBranch);
        } else {
          setCurrentBranch(null);
        }

        setUserRoles((rolesResult.data || []).map(r => r.role as AppRole));
      } else {
        // User has no tenant yet — needs onboarding
        setTenant(null);
        setBranches([]);
        setCurrentBranch(null);
        setUserRoles([]);
      }
    } catch (err) {
      console.error('fetchProfile error:', err);
      setProfile(null);
      setTenant(null);
      setBranches([]);
      setCurrentBranch(null);
      setUserRoles([]);
    }
  };

  // ── Refresh (called after onboarding completes) ──────────────
  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const switchBranch = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (branch) setCurrentBranch(branch);
  };

  const hasRole = (role: AppRole): boolean =>
    userRoles.includes(role) || userRoles.includes('owner');

  // ── Auth state listener ──────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // KEY FIX: set loading=true synchronously HERE, before the async
          // fetchProfile call. This ensures ProtectedRoute renders the spinner
          // instead of briefly seeing tenant=null and redirecting to /onboarding.
          setLoading(true);

          // setTimeout(0) is required to avoid a Supabase auth deadlock where
          // calling supabase queries inside onAuthStateChange hangs.
          setTimeout(async () => {
            if (!mounted) return;
            await fetchProfile(newSession.user.id);
            if (mounted) setLoading(false);
            // Native-only: register for push notifications once we have
            // a signed-in user.  No-op on web.  Idempotent — guarded
            // internally so re-entering this block on session refresh
            // doesn't re-register.
            initializePushNotifications(newSession.user.id).catch(() => {
              /* non-fatal: push will retry on next session event */
            });
          }, 0);
        } else {
          // Signed out — clear everything
          setProfile(null);
          setTenant(null);
          setBranches([]);
          setCurrentBranch(null);
          setUserRoles([]);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ── Auth actions ─────────────────────────────────────────────
  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });

    if (!error && data.user) {
      // Create the profile row — tenant_id is null until onboarding
      await supabase.from('profiles').insert({
        user_id: data.user.id,
        full_name: fullName,
      });
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    // Clear all state — onAuthStateChange will also fire but this is immediate
    setUser(null);
    setSession(null);
    setProfile(null);
    setTenant(null);
    setBranches([]);
    setCurrentBranch(null);
    setUserRoles([]);
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, tenant,
      branches, currentBranch, userRoles,
      loading,
      signUp, signIn, signOut,
      refreshProfile, switchBranch, hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
