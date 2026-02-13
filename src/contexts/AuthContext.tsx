 import React, { createContext, useContext, useEffect, useState } from 'react';
 import { User, Session } from '@supabase/supabase-js';
 import { supabase } from '@/integrations/supabase/client';
 
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
  onboarding_completed: boolean;
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
   const [user, setUser] = useState<User | null>(null);
   const [session, setSession] = useState<Session | null>(null);
   const [profile, setProfile] = useState<Profile | null>(null);
   const [tenant, setTenant] = useState<Tenant | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
   const [loading, setLoading] = useState(true);
 
  const fetchProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    setProfile(profileData);

    if (profileData?.tenant_id) {
      // Fetch tenant, branches, and roles in parallel
      const [tenantResult, branchesResult, rolesResult] = await Promise.all([
        supabase.from('tenants').select('*').eq('id', profileData.tenant_id).single(),
        supabase.from('branches').select('*').eq('tenant_id', profileData.tenant_id).eq('is_active', true),
        supabase.from('user_roles').select('role').eq('user_id', userId).eq('tenant_id', profileData.tenant_id),
      ]);

      setTenant(tenantResult.data);
      const branchesData = branchesResult.data || [];
      setBranches(branchesData);

      if (branchesData.length > 0) {
        const defaultBranch = profileData.branch_id 
          ? branchesData.find(b => b.id === profileData.branch_id) || branchesData[0]
          : branchesData[0];
        setCurrentBranch(defaultBranch);
      }

      setUserRoles((rolesResult.data || []).map(r => r.role as AppRole));
    } else {
      setTenant(null);
      setBranches([]);
      setCurrentBranch(null);
      setUserRoles([]);
    }
  };
 
   const refreshProfile = async () => {
     if (user) {
       await fetchProfile(user.id);
     }
   };
 
  const switchBranch = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (branch) {
      setCurrentBranch(branch);
    }
  };

  const hasRole = (role: AppRole): boolean => {
    return userRoles.includes(role) || userRoles.includes('owner');
  };

  useEffect(() => {
    let initialSessionHandled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') {
          // Handle initial session here to avoid race condition with getSession
          initialSessionHandled = true;
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchProfile(session.user.id);
          }
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setTenant(null);
          setBranches([]);
          setCurrentBranch(null);
          setUserRoles([]);
        }
        setLoading(false);
      }
    );

    // Fallback: if INITIAL_SESSION hasn't fired after a timeout, use getSession
    const timeout = setTimeout(async () => {
      if (!initialSessionHandled) {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
        setLoading(false);
      }
    }, 3000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);
 
   const signUp = async (email: string, password: string, fullName: string) => {
     const { data, error } = await supabase.auth.signUp({
       email,
       password,
       options: {
         emailRedirectTo: window.location.origin,
         data: { full_name: fullName }
       }
     });
 
     if (!error && data.user) {
       // Create initial profile (without tenant - will be set during onboarding)
       await supabase.from('profiles').insert({
         user_id: data.user.id,
         full_name: fullName
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
     setProfile(null);
     setTenant(null);
   };
 
   return (
     <AuthContext.Provider value={{
       user,
       session,
       profile,
       tenant,
      branches,
      currentBranch,
      userRoles,
       loading,
       signUp,
       signIn,
       signOut,
      refreshProfile,
      switchBranch,
      hasRole
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