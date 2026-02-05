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
 }
 
 interface AuthContextType {
   user: User | null;
   session: Session | null;
   profile: Profile | null;
   tenant: Tenant | null;
   loading: boolean;
   signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
   signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
   signOut: () => Promise<void>;
   refreshProfile: () => Promise<void>;
 }
 
 const AuthContext = createContext<AuthContextType | undefined>(undefined);
 
 export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
   const [user, setUser] = useState<User | null>(null);
   const [session, setSession] = useState<Session | null>(null);
   const [profile, setProfile] = useState<Profile | null>(null);
   const [tenant, setTenant] = useState<Tenant | null>(null);
   const [loading, setLoading] = useState(true);
 
   const fetchProfile = async (userId: string) => {
     const { data: profileData } = await supabase
       .from('profiles')
       .select('*')
       .eq('user_id', userId)
       .single();
     
     setProfile(profileData);
 
     if (profileData?.tenant_id) {
       const { data: tenantData } = await supabase
         .from('tenants')
         .select('*')
         .eq('id', profileData.tenant_id)
         .single();
       setTenant(tenantData);
     } else {
       setTenant(null);
     }
   };
 
   const refreshProfile = async () => {
     if (user) {
       await fetchProfile(user.id);
     }
   };
 
   useEffect(() => {
     const { data: { subscription } } = supabase.auth.onAuthStateChange(
       async (event, session) => {
         setSession(session);
         setUser(session?.user ?? null);
         
         if (session?.user) {
           setTimeout(() => fetchProfile(session.user.id), 0);
         } else {
           setProfile(null);
           setTenant(null);
         }
         setLoading(false);
       }
     );
 
     supabase.auth.getSession().then(({ data: { session } }) => {
       setSession(session);
       setUser(session?.user ?? null);
       if (session?.user) {
         fetchProfile(session.user.id);
       }
       setLoading(false);
     });
 
     return () => subscription.unsubscribe();
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
       loading,
       signUp,
       signIn,
       signOut,
       refreshProfile
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