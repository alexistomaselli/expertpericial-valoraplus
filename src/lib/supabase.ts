import { createClient } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Tipos para los perfiles de usuario
export type Profile = {
  id: string;
  email: string;
  role: 'admin' | 'admin_mechanic';
  full_name: string | null;
  workshop_id: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

// Tipo para workshops
export type Workshop = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
};

// Tipos para la autenticación
export type AuthUser = {
  id: string;
  email: string;
};

// Función para obtener el perfil del usuario actual
export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  const { data } = await supabase
    .from('profiles' as never)
    .select('*')
    .eq('id', user.id)
    .single();
    
  return data as Profile | null;
}