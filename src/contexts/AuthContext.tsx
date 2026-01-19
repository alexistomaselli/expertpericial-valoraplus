import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile, Workshop } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  workshop: Workshop | null;
  loading: boolean;
  signIn: (email: string, password: string, options?: { suppressSuccessToast?: boolean }) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshWorkshop: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Función para obtener el perfil del usuario (con timeout)
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      // Timeout para evitar que el perfil bloquee la UI
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout')), 2000); // 2 segundos timeout
      });

      const { data, error } = await Promise.race([
        profilePromise,
        timeoutPromise
      ]) as any;

      if (error) {
        // console.warn('Profile fetch unavailable:', error.message);
        return null;
      }

      return data;
    } catch (error: any) {
      // console.warn('Profile service unavailable:', error.message);
      return null;
    }
  };

  // Función para actualizar el estado de autenticación (optimizada)
  const updateAuthState = async (session: Session | null) => {
    // console.log('🔴 UPDATE AUTH STATE: session exists:', !!session);
    setSession(session);
    setUser(session?.user ?? null);
    
    // Establecer loading false inmediatamente para mejor UX
    // console.log('🔴 UPDATE AUTH STATE: Setting loading to false immediately');
    setLoading(false);

    if (session?.user) {
      // console.log('🔴 UPDATE AUTH STATE: User found, fetching profile in background');
      // Cargar perfil en background sin bloquear la UI
      fetchProfile(session.user.id).then(async (userProfile) => {
        setProfile(userProfile);
        
        // Si el perfil tiene workshop_id, cargar también el workshop
        if (userProfile?.workshop_id) {
          try {
            const { data: workshopData, error } = await supabase
              .from('workshops')
              .select('*')
              .eq('id', userProfile.workshop_id)
              .single();

            if (!error && workshopData) {
              setWorkshop(workshopData);
            }
          } catch (error) {
            console.error('Error loading workshop in background:', error);
          }
        } else {
          setWorkshop(null);
        }
      }).catch(error => {
        // console.warn('Background profile fetch failed:', error);
        setProfile(null);
        setWorkshop(null);
      });
    } else {
      // console.log('🔴 UPDATE AUTH STATE: No user, clearing profile');
      setProfile(null);
      setWorkshop(null);
    }
  };

  // Inicializar la sesión al cargar
  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        // Timeout de seguridad más corto para mejor UX
        timeoutId = setTimeout(() => {
          if (mounted) {
            // console.warn('Auth initialization timeout - setting loading to false');
            setLoading(false);
          }
        }, 1500); // Reducido a 1.5 segundos

        // Obtener la sesión actual con timeout más agresivo
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Supabase connection timeout')), 1000); // Reducido a 1 segundo
        });

        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;
        
        // Limpiar el timeout si la operación fue exitosa
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        if (error) {
          // console.warn('Supabase session unavailable:', error.message);
          if (mounted) {
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          // Optimización: actualizar estado inmediatamente sin esperar el perfil
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false); // Establecer loading false inmediatamente
          
          // Cargar perfil en background sin bloquear la UI
          if (session?.user) {
            fetchProfile(session.user.id).then(userProfile => {
              if (mounted) {
                setProfile(userProfile);
              }
            }).catch(error => {
              // console.warn('Background profile fetch failed:', error);
            });
          } else {
            setProfile(null);
          }
        }
      } catch (error: any) {
        // Solo mostrar warning si no es un timeout esperado
        if (error.message !== 'Supabase connection timeout') {
          // console.warn('Auth initialization issue:', error.message);
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // console.log('🔴 AUTH STATE CHANGE:', event, session?.user?.email);
        
        if (mounted) {
          // console.log('🔴 AUTH STATE: Calling updateAuthState with session:', !!session);
          await updateAuthState(session);
        }
      }
    );

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      subscription.unsubscribe();
    };
  }, []);

  // Función de inicio de sesión
  const signIn = async (email: string, password: string, options?: { suppressSuccessToast?: boolean }): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      // console.log('🔐 AUTH: Starting signIn process');
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // console.log('🔐 AUTH: SignIn error:', error.message);
        setLoading(false); // Solo establecer loading false en caso de error
        // Traducir mensajes de error comunes
        let errorMessage = error.message;
        if (error.message.includes("Email not confirmed")) {
          errorMessage = "Email no confirmado. Por favor, revisa tu bandeja de entrada y confirma tu correo electrónico.";
        } else if (error.message.includes("Invalid login credentials")) {
          errorMessage = "Credenciales de acceso inválidas. Verifica tu email y contraseña.";
        } else if (error.message.includes("Email/Password combination is incorrect")) {
          errorMessage = "La combinación de email y contraseña es incorrecta.";
        } else if (error.message.includes("User not found")) {
          errorMessage = "Usuario no encontrado.";
        } else if (error.message.includes("Too many requests")) {
          errorMessage = "Demasiados intentos. Por favor, inténtalo más tarde.";
        }
        
        toast({
          title: "Error de autenticación",
          description: errorMessage,
          variant: "destructive",
        });
        return { success: false, error: error.message };
      }

      if (data.session) {
        // console.log('🔐 AUTH: SignIn successful, session created');
        // NO establecer setLoading(false) aquí - dejar que onAuthStateChange lo maneje
        if (!options?.suppressSuccessToast) {
          toast({
            title: "Inicio de sesión exitoso",
            description: "Bienvenido de vuelta",
          });
        }
        return { success: true };
      }

      // console.log('🔐 AUTH: SignIn failed - no session created');
      setLoading(false);
      return { success: false, error: "No se pudo iniciar sesión" };
    } catch (error) {
      // console.log('🔐 AUTH: SignIn exception:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setLoading(false); // Solo establecer loading false en caso de error
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    }
    // NO finally block - dejar que onAuthStateChange maneje el loading state
  };

  // Función de cierre de sesión
  const signOut = async (): Promise<void> => {
    // console.log('🔴 LOGOUT: signOut function called');
    
    // Función para limpiar todo localmente
    const forceLocalLogout = () => {
      // console.log('🔴 LOGOUT: Forcing complete local logout');
      setSession(null);
      setUser(null);
      setProfile(null);
      
      // Limpiar también el localStorage de Supabase
       try {
         // Limpiar todas las claves que empiecen con 'sb-' (claves de Supabase)
         Object.keys(localStorage).forEach(key => {
           if (key.startsWith('sb-') || key.includes('supabase')) {
             localStorage.removeItem(key);
           }
         });
         // console.log('🔴 LOGOUT: LocalStorage cleared');
       } catch (e) {
         // console.warn('🔴 LOGOUT: Error clearing localStorage:', e);
       }
    };
    
    // Intentar logout de Supabase de forma no bloqueante
    try {
      // console.log('🔴 LOGOUT: Attempting Supabase signOut');
      
      // Intentar logout de Supabase con timeout más generoso
      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Supabase logout timeout')), 15000)
      );
      
      await Promise.race([signOutPromise, timeoutPromise]);
      // console.log('🔴 LOGOUT: Supabase signOut completed successfully');
      
    } catch (error: any) {
      // console.warn('🔴 LOGOUT: Supabase signOut failed or timed out:', error.message);
      // Continuar con logout local sin mostrar error al usuario
      // El logout local siempre debe funcionar independientemente de Supabase
    }
    
    // SIEMPRE limpiar el estado local, sin importar si Supabase funcionó
    forceLocalLogout();
    
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión exitosamente",
    });
    
    // console.log('🔴 LOGOUT: Logout process completed');
  };

  // Función para refrescar el perfil
  const refreshProfile = async (): Promise<void> => {
    if (user) {
      const userProfile = await fetchProfile(user.id);
      setProfile(userProfile);
      
      // Si el perfil tiene workshop_id, cargar también el workshop
      if (userProfile?.workshop_id) {
        await refreshWorkshop();
      }
    }
  };

  // Función para refrescar el workshop
  const refreshWorkshop = async (): Promise<void> => {
    if (profile?.workshop_id) {
      try {
        const { data: workshopData, error } = await supabase
          .from('workshops')
          .select('*')
          .eq('id', profile.workshop_id)
          .single();

        if (error) {
          console.error('Error fetching workshop:', error);
          return;
        }

        setWorkshop(workshopData);
      } catch (error) {
        console.error('Error in refreshWorkshop:', error);
      }
    }
  };

  const value: AuthContextType = {
    session,
    user,
    profile,
    workshop,
    loading,
    signIn,
    signOut,
    refreshProfile,
    refreshWorkshop,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}