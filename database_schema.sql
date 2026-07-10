-- Source: 20241010_auth_setup.sql
-- Crear tabla para perfiles de usuario con roles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'admin_mechanic')),
  full_name TEXT,
  workshop_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Crear índice para búsqueda por email
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);

-- Función para manejar nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (new.id, new.email, 'admin_mechanic', new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para insertar automáticamente en profiles cuando se crea un usuario
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Políticas de seguridad para la tabla profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios solo puedan ver su propio perfil
CREATE POLICY "Users can view their own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = id);

-- Política para que los usuarios solo puedan actualizar su propio perfil
CREATE POLICY "Users can update their own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

-- Política para que los administradores puedan ver todos los perfiles
CREATE POLICY "Admins can view all profiles" 
  ON public.profiles 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política para que los administradores puedan actualizar todos los perfiles
CREATE POLICY "Admins can update all profiles" 
  ON public.profiles 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Nota: La creación del usuario administrador se hará manualmente a través de la interfaz de Supabase
-- o mediante código en el frontend después de configurar las tablas

-- Source: 20241011_create_admin_user.sql
-- Crear un usuario administrador usando la función de Supabase
-- Nota: En producción, este usuario debe crearse manualmente desde el dashboard
-- Esta migración solo crea el perfil si el usuario ya existe

-- Primero, intentamos crear el usuario usando la API de Supabase
-- Si falla, continuamos sin error
DO $$
DECLARE
  admin_id uuid;
BEGIN
  -- Intentar obtener el ID del usuario admin si ya existe
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@valoraplus.com';
  
  -- Si no existe el usuario, crear un UUID temporal para el perfil
  -- El usuario real debe crearse desde el dashboard de Supabase
  IF admin_id IS NULL THEN
    admin_id := gen_random_uuid();
    
    -- Insertar un registro temporal en auth.users (esto puede fallar en Cloud)
    BEGIN
      INSERT INTO auth.users (
        id, 
        email, 
        encrypted_password, 
        email_confirmed_at, 
        created_at, 
        updated_at, 
        raw_app_meta_data, 
        raw_user_meta_data
      )
      VALUES (
        admin_id,
        'admin@valoraplus.com',
        '$2a$10$dummy.hash.for.development.only',  -- Hash dummy
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{}'
      );
    EXCEPTION WHEN OTHERS THEN
      -- Si falla, continuamos sin crear el usuario en auth.users
      NULL;
    END;
  END IF;
  
  -- Crear o actualizar el perfil en la tabla profiles
  INSERT INTO public.profiles (id, email, role, full_name, workshop_name)
  VALUES (
    admin_id,
    'admin@valoraplus.com',
    'admin',
    'Administrador Sistema',
    NULL
  ) ON CONFLICT (id) DO UPDATE SET 
    role = 'admin',
    email = 'admin@valoraplus.com',
    full_name = 'Administrador Sistema';
    
END $$;

-- Source: 20241012_create_workshops_table.sql
-- Create workshops table
CREATE TABLE public.workshops (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add workshop_id to profiles table and remove workshop_name
ALTER TABLE public.profiles 
ADD COLUMN workshop_id UUID REFERENCES public.workshops(id) ON DELETE CASCADE,
ADD COLUMN phone TEXT;

-- Remove the old workshop_name column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS workshop_name;

-- Create index for better performance
CREATE INDEX idx_profiles_workshop_id ON public.profiles(workshop_id);

-- Enable RLS on workshops table
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;

-- Create policies for workshops table
CREATE POLICY "Users can view their own workshop" ON public.workshops
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.workshop_id = workshops.id 
            AND profiles.id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own workshop" ON public.workshops
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.workshop_id = workshops.id 
            AND profiles.id = auth.uid()
            AND profiles.role = 'admin_mechanic'
        )
    );

-- Allow admins to view and manage all workshops
CREATE POLICY "Admins can view all workshops" ON public.workshops
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can manage all workshops" ON public.workshops
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Function to handle workshop creation during user registration
CREATE OR REPLACE FUNCTION public.handle_workshop_registration(
    workshop_name TEXT,
    workshop_email TEXT,
    workshop_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    workshop_id UUID;
BEGIN
    -- Insert new workshop
    INSERT INTO public.workshops (name, email, phone)
    VALUES (workshop_name, workshop_email, workshop_phone)
    RETURNING id INTO workshop_id;
    
    RETURN workshop_id;
END;
$$;

-- Function to update user profile with workshop info
CREATE OR REPLACE FUNCTION public.complete_user_registration(
    user_id UUID,
    workshop_id UUID,
    user_phone TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update user profile with workshop_id and phone
    UPDATE public.profiles 
    SET 
        workshop_id = complete_user_registration.workshop_id,
        phone = user_phone,
        updated_at = now()
    WHERE id = user_id;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.workshops TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_workshop_registration TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_user_registration TO authenticated;

-- Source: 20241013_fix_data_consistency.sql
-- Migración para corregir inconsistencias de datos y asegurar roles correctos
-- Fecha: 2024-10-13
-- Versión compatible con Supabase Cloud

-- 1. Primero, corregir el perfil del admin (eliminar workshop_name que ya no existe)
UPDATE public.profiles 
SET workshop_id = NULL 
WHERE email = 'admin@valoraplus.com' AND role = 'admin';

-- 2. Crear workshops de ejemplo (si no existen)
INSERT INTO public.workshops (id, name, email, phone, address) VALUES 
(
    '550e8400-e29b-41d4-a716-446655440000', 
    'Taller Mecánico Demo', 
    'demo@tallerdemo.com', 
    '612 345 678',
    'Calle Principal 123, Madrid'
),
(
    '550e8400-e29b-41d4-a716-446655440001', 
    'AutoReparaciones SL', 
    'info@autoreparaciones.com', 
    '634 567 890',
    'Avenida Industrial 45, Barcelona'
) ON CONFLICT (id) DO NOTHING;

-- 3. Crear perfiles para usuarios admin_mechanic de los workshops
-- Nota: Los usuarios reales deben crearse desde el dashboard de Supabase
DO $$
DECLARE
    workshop_demo_id uuid := '550e8400-e29b-41d4-a716-446655440000';
    workshop_auto_id uuid := '550e8400-e29b-41d4-a716-446655440001';
    user_demo_id uuid;
    user_auto_id uuid;
BEGIN
    -- Intentar obtener o crear ID para usuario demo
    SELECT id INTO user_demo_id FROM auth.users WHERE email = 'demo@tallerdemo.com';
    
    IF user_demo_id IS NULL THEN
        user_demo_id := gen_random_uuid();
        
        -- Intentar crear usuario demo (puede fallar en Cloud)
        BEGIN
            INSERT INTO auth.users (
                id, 
                instance_id,
                email, 
                encrypted_password, 
                email_confirmed_at, 
                created_at, 
                updated_at, 
                raw_app_meta_data, 
                raw_user_meta_data,
                aud,
                role
            ) VALUES (
                user_demo_id,
                '00000000-0000-0000-0000-000000000000',
                'demo@tallerdemo.com',
                '$2a$10$dummy.hash.for.development.only',  -- Hash dummy
                now(),
                now(),
                now(),
                '{"provider":"email","providers":["email"]}',
                '{"workshop_name":"Taller Mecánico Demo"}',
                'authenticated',
                'authenticated'
            );
        EXCEPTION WHEN OTHERS THEN
            -- Si falla, continuamos sin crear el usuario en auth.users
            NULL;
        END;
    END IF;

    -- Crear perfil para usuario demo
    INSERT INTO public.profiles (id, email, role, full_name, workshop_id, phone)
    VALUES (
        user_demo_id,
        'demo@tallerdemo.com',
        'admin_mechanic',
        'Juan Pérez',
        workshop_demo_id,
        '612 345 678'
    ) ON CONFLICT (id) DO UPDATE SET 
        role = 'admin_mechanic',
        workshop_id = workshop_demo_id,
        full_name = 'Juan Pérez',
        phone = '612 345 678';

    -- Intentar obtener o crear ID para usuario auto
    SELECT id INTO user_auto_id FROM auth.users WHERE email = 'info@autoreparaciones.com';
    
    IF user_auto_id IS NULL THEN
        user_auto_id := gen_random_uuid();
        
        -- Intentar crear usuario auto (puede fallar en Cloud)
        BEGIN
            INSERT INTO auth.users (
                id, 
                instance_id,
                email, 
                encrypted_password, 
                email_confirmed_at, 
                created_at, 
                updated_at, 
                raw_app_meta_data, 
                raw_user_meta_data,
                aud,
                role
            ) VALUES (
                user_auto_id,
                '00000000-0000-0000-0000-000000000000',
                'info@autoreparaciones.com',
                '$2a$10$dummy.hash.for.development.only',  -- Hash dummy
                now(),
                now(),
                now(),
                '{"provider":"email","providers":["email"]}',
                '{"workshop_name":"AutoReparaciones SL"}',
                'authenticated',
                'authenticated'
            );
        EXCEPTION WHEN OTHERS THEN
            -- Si falla, continuamos sin crear el usuario en auth.users
            NULL;
        END;
    END IF;

    -- Crear perfil para usuario auto
    INSERT INTO public.profiles (id, email, role, full_name, workshop_id, phone)
    VALUES (
        user_auto_id,
        'info@autoreparaciones.com',
        'admin_mechanic',
        'María García',
        workshop_auto_id,
        '634 567 890'
    ) ON CONFLICT (id) DO UPDATE SET 
        role = 'admin_mechanic',
        workshop_id = workshop_auto_id,
        full_name = 'María García',
        phone = '634 567 890';

END $$;

-- 3. Verificar que todo esté correcto
SELECT 'Verificación de datos:' as status;

-- Mostrar usuarios y sus roles
SELECT 
    u.email,
    p.role,
    p.full_name,
    w.name as workshop_name
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.workshops w ON p.workshop_id = w.id
ORDER BY p.role, u.email;

-- Mostrar workshops y sus admin_mechanics
SELECT 
    w.name as workshop_name,
    w.email as workshop_email,
    p.full_name as admin_mechanic_name,
    u.email as admin_mechanic_email
FROM public.workshops w
LEFT JOIN public.profiles p ON w.id = p.workshop_id
LEFT JOIN auth.users u ON p.id = u.id
ORDER BY w.name;

-- Source: 20241014_make_workshop_email_optional.sql
-- Migración para hacer el email del workshop opcional
-- Fecha: 2024-10-14

-- 1. Modificar la tabla workshops para permitir email nulo
ALTER TABLE public.workshops 
ALTER COLUMN email DROP NOT NULL;

-- 2. Actualizar workshops existentes para separar conceptualmente el email del usuario del email del taller
-- Por ahora mantenemos los emails existentes, pero en el futuro los talleres podrán tener emails diferentes

-- 3. Comentario para clarificar el propósito de cada email
COMMENT ON COLUMN public.workshops.email IS 'Email comercial del taller (opcional). Puede ser diferente al email del usuario admin_mechanic.';
COMMENT ON COLUMN public.profiles.email IS 'Email del usuario para autenticación. Debe coincidir con auth.users.email.';

-- 4. Verificar la estructura actualizada
SELECT 
    'ESTRUCTURA ACTUALIZADA:' as status;

-- Mostrar la nueva estructura
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'workshops' 
    AND table_schema = 'public'
    AND column_name = 'email';

-- Source: 20241015_allow_admin_mechanic_create_workshop.sql
-- Allow admin_mechanic users to create workshops
-- Updated to avoid dependency on profiles table during registration
CREATE POLICY "Admin mechanics can create workshops v2" ON workshops
  FOR INSERT 
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users 
      WHERE raw_user_meta_data ->> 'role' = 'admin_mechanic'
    )
  );

-- Source: 20241016_fix_all_rls_policies.sql
-- Fix all RLS policies to avoid database access issues
-- This migration fixes infinite recursion and permission denied errors

-- 1. Fix profiles policies (remove infinite recursion)
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles v2" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles v2" ON profiles;

-- Remove problematic function
DROP FUNCTION IF EXISTS is_admin_user();

-- Create new profiles policies that only use JWT
CREATE POLICY "Admins can view all profiles v3" ON profiles
  FOR SELECT USING (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
    OR 
    (auth.jwt() ->> 'raw_user_meta_data')::jsonb ->> 'role' = 'admin'
  );

CREATE POLICY "Admins can update all profiles v3" ON profiles
  FOR UPDATE USING (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
    OR 
    (auth.jwt() ->> 'raw_user_meta_data')::jsonb ->> 'role' = 'admin'
  );

-- 2. Fix workshops policies (remove auth.users access)
DROP POLICY IF EXISTS "Admin mechanics can create workshops" ON workshops;
DROP POLICY IF EXISTS "Admin mechanics can create workshops v2" ON workshops;

-- Create new workshop creation policy that only uses JWT
CREATE POLICY "Admin mechanics can create workshops v3" ON workshops
  FOR INSERT 
  WITH CHECK (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin_mechanic'
    OR 
    (auth.jwt() ->> 'raw_user_meta_data')::jsonb ->> 'role' = 'admin_mechanic'
  );

-- Source: 20241017_fix_profiles_infinite_recursion.sql
-- Fix infinite recursion in profiles RLS policies
-- Drop problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Create a function that checks admin status without querying profiles table
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  -- Verify if the authenticated user has admin role in auth.users metadata
  RETURN auth.jwt() ->> 'email' IN (
    SELECT email FROM auth.users 
    WHERE raw_user_meta_data ->> 'role' = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new policies that don't cause recursion
CREATE POLICY "Admins can view all profiles v2" ON profiles
  FOR SELECT USING (is_admin_user());

CREATE POLICY "Admins can update all profiles v2" ON profiles
  FOR UPDATE USING (is_admin_user());

-- Source: 20241018_remove_workshops_insert_policy.sql
-- Remove INSERT policy from workshops table to allow registration
-- This replicates the behavior of the profiles table which has RLS enabled
-- but no INSERT policies, allowing creation during registration

-- Drop the INSERT policy that was causing registration failures
DROP POLICY IF EXISTS "Admin mechanics can create workshops v3" ON workshops;

-- Note: With RLS enabled but no INSERT policies, PostgreSQL allows
-- insertions by default, which is what we want for registration flow
-- Other policies (SELECT, UPDATE, DELETE) remain for proper access control

-- Source: 20241019_create_analysis_table.sql
-- Create analysis table for PDF analysis tracking
CREATE TABLE IF NOT EXISTS analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
    pdf_url TEXT,
    pdf_filename TEXT,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'pending_verification', 'pending_costs', 'completed', 'failed')),
    analysis_month DATE NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX idx_analysis_workshop_id ON analysis(workshop_id);
CREATE INDEX idx_analysis_status ON analysis(status);
CREATE INDEX idx_analysis_month ON analysis(analysis_month);

-- Enable RLS
ALTER TABLE analysis ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own workshop analysis" ON analysis
    FOR SELECT USING (
        workshop_id IN (
            SELECT id FROM workshops 
            WHERE id IN (
                SELECT workshop_id FROM profiles 
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert analysis for their workshop" ON analysis
    FOR INSERT WITH CHECK (
        workshop_id IN (
            SELECT id FROM workshops 
            WHERE id IN (
                SELECT workshop_id FROM profiles 
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update their own workshop analysis" ON analysis
    FOR UPDATE USING (
        workshop_id IN (
            SELECT id FROM workshops 
            WHERE id IN (
                SELECT workshop_id FROM profiles 
                WHERE id = auth.uid()
            )
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_analysis_updated_at
    BEFORE UPDATE ON analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_analysis_updated_at();

-- Create storage bucket for PDFs if it doesn't exist
INSERT INTO storage.buckets (id, name)
VALUES ('analysis-pdfs', 'analysis-pdfs')
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for PDFs
CREATE POLICY "Users can upload PDFs for their workshop" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'analysis-pdfs' AND
        auth.uid() IS NOT NULL
    );

CREATE POLICY "Users can view PDFs for their workshop" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'analysis-pdfs' AND
        auth.uid() IS NOT NULL
    );

CREATE POLICY "Users can delete PDFs for their workshop" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'analysis-pdfs' AND
        auth.uid() IS NOT NULL
    );

-- Source: 20241020_create_extracted_data_tables.sql
-- Create tables for storing extracted data from n8n analysis

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Table for vehicle metadata extracted from PDF
CREATE TABLE vehicle_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES analysis(id) ON DELETE CASCADE,
  license_plate TEXT,
  vin TEXT,
  manufacturer TEXT,
  model TEXT,
  internal_reference TEXT,
  system TEXT, -- e.g., "AUDA"
  hourly_price DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for insurance amounts extracted from PDF
CREATE TABLE insurance_amounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES analysis(id) ON DELETE CASCADE,
  -- Totales de repuestos
  total_spare_parts_eur DECIMAL(10,2),
  -- Mano de obra carrocería
  bodywork_labor_ut DECIMAL(10,2),
  bodywork_labor_eur DECIMAL(10,2),
  -- Mano de obra pintura
  painting_labor_ut DECIMAL(10,2),
  painting_labor_eur DECIMAL(10,2),
  -- Material de pintura
  paint_material_eur DECIMAL(10,2),
  -- Totales calculados
  net_subtotal DECIMAL(10,2),
  iva_amount DECIMAL(10,2),
  total_with_iva DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_vehicle_data_analysis_id ON vehicle_data(analysis_id);
CREATE INDEX idx_insurance_amounts_analysis_id ON insurance_amounts(analysis_id);

-- Create updated_at triggers
CREATE TRIGGER update_vehicle_data_updated_at
  BEFORE UPDATE ON vehicle_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_insurance_amounts_updated_at
  BEFORE UPDATE ON insurance_amounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE vehicle_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_amounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vehicle_data
CREATE POLICY "Users can view their own vehicle data" ON vehicle_data
  FOR SELECT USING (
    analysis_id IN (
      SELECT id FROM analysis WHERE workshop_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own vehicle data" ON vehicle_data
  FOR INSERT WITH CHECK (
    analysis_id IN (
      SELECT id FROM analysis WHERE workshop_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own vehicle data" ON vehicle_data
  FOR UPDATE USING (
    analysis_id IN (
      SELECT id FROM analysis WHERE workshop_id = auth.uid()
    )
  );

-- RLS Policies for insurance_amounts
CREATE POLICY "Users can view their own insurance amounts" ON insurance_amounts
  FOR SELECT USING (
    analysis_id IN (
      SELECT id FROM analysis WHERE workshop_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own insurance amounts" ON insurance_amounts
  FOR INSERT WITH CHECK (
    analysis_id IN (
      SELECT id FROM analysis WHERE workshop_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own insurance amounts" ON insurance_amounts
  FOR UPDATE USING (
    analysis_id IN (
      SELECT id FROM analysis WHERE workshop_id = auth.uid()
    )
  );

-- Source: 20241021_create_workshop_costs_table.sql
-- Create workshop_costs table to store actual workshop costs
CREATE TABLE workshop_costs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    analysis_id UUID NOT NULL REFERENCES analysis(id) ON DELETE CASCADE,
    
    -- Spare parts costs
    spare_parts_purchase_cost DECIMAL(10,2),
    
    -- Bodywork labor costs
    bodywork_actual_hours DECIMAL(8,2),
    bodywork_hourly_cost DECIMAL(8,2),
    
    -- Painting labor costs
    painting_actual_hours DECIMAL(8,2),
    painting_hourly_cost DECIMAL(8,2),
    
    -- Other costs
    painting_consumables_cost DECIMAL(10,2),
    subcontractor_costs DECIMAL(10,2),
    other_costs DECIMAL(10,2),
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies
ALTER TABLE workshop_costs ENABLE ROW LEVEL SECURITY;

-- Policy for workshop users to manage their own costs
CREATE POLICY "workshop_costs_workshop_policy" ON workshop_costs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM analysis a
            JOIN profiles p ON p.workshop_id = a.workshop_id
            WHERE a.id = workshop_costs.analysis_id
            AND p.id = auth.uid()
        )
    );

-- Policy for admin users to view all costs
CREATE POLICY "workshop_costs_admin_policy" ON workshop_costs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Create updated_at trigger
CREATE TRIGGER update_workshop_costs_updated_at
    BEFORE UPDATE ON workshop_costs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Source: 20241022_fix_user_role_from_metadata.sql
-- Fix handle_new_user function to use role from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'role', 'admin_mechanic'), -- Use role from metadata, default to admin_mechanic
    new.raw_user_meta_data->>'full_name'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: 20241023_disable_workshops_rls.sql
-- Disable RLS on workshops table to allow registration
ALTER TABLE public.workshops DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on workshops table
DROP POLICY IF EXISTS "Users can view their own workshop" ON public.workshops;
DROP POLICY IF EXISTS "Users can update their own workshop" ON public.workshops;
DROP POLICY IF EXISTS "Admins can view all workshops" ON public.workshops;
DROP POLICY IF EXISTS "Admins can manage all workshops" ON public.workshops;
DROP POLICY IF EXISTS "Admin mechanics can create workshops v2" ON public.workshops;
DROP POLICY IF EXISTS "Admin mechanics can create workshops v3" ON public.workshops;

-- Fix handle_new_user function to properly handle full_name from signup data
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'role', 'admin_mechanic'),
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'workshop_name', 'Usuario')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: 20241024_setup_storage.sql
-- Create documents bucket for PDF uploads
INSERT INTO storage.buckets (id, name)
VALUES (
  'documents',
  'documents'
) ON CONFLICT (id) DO NOTHING;

-- Source: 20241025_create_system_settings.sql
-- Crear tabla para configuraciones del sistema
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_at ON system_settings(updated_at);

-- Insertar configuraciones iniciales del sistema
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
  ('monthly_free_analyses_limit', '{"value": 3}', 'Límite de análisis gratuitos por mes para usuarios admin_mechanic'),
  ('additional_analysis_price', '{"value": 25.00, "currency": "EUR"}', 'Precio por análisis adicional después del límite gratuito'),
  ('billing_enabled', '{"value": true}', 'Si está habilitada la facturación por análisis adicionales'),
  ('stripe_enabled', '{"value": false}', 'Si está habilitada la integración con Stripe'),
  ('company_info', '{"name": "Valora Plus", "tax_id": "", "address": "", "email": ""}', 'Información de la empresa para facturación')
ON CONFLICT (setting_key) DO NOTHING;

-- Función para obtener configuración del sistema
CREATE OR REPLACE FUNCTION get_system_setting(setting_name TEXT)
RETURNS JSONB AS $$
BEGIN
  RETURN (SELECT setting_value FROM system_settings WHERE setting_key = setting_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para actualizar configuración del sistema (solo admins)
CREATE OR REPLACE FUNCTION update_system_setting(setting_name TEXT, new_value JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Verificar que el usuario es admin
  SELECT role INTO user_role FROM profiles WHERE id = auth.uid();
  
  IF user_role != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden modificar configuraciones del sistema';
  END IF;
  
  -- Actualizar la configuración
  UPDATE system_settings 
  SET setting_value = new_value, 
      updated_at = NOW(), 
      updated_by = auth.uid()
  WHERE setting_key = setting_name;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas RLS para system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Los admins pueden ver y modificar todas las configuraciones
CREATE POLICY "Admins can manage system settings" ON system_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Los usuarios pueden ver configuraciones públicas (solo lectura)
CREATE POLICY "Users can view public settings" ON system_settings
  FOR SELECT USING (
    setting_key IN (
      'monthly_free_analyses_limit',
      'additional_analysis_price',
      'billing_enabled'
    )
  );

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_updated_at();

-- Source: 20241026_create_user_monthly_usage.sql
-- Crear tabla para el seguimiento del uso mensual de análisis por usuario
CREATE TABLE IF NOT EXISTS user_monthly_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  analyses_count INTEGER DEFAULT 0,
  free_analyses_used INTEGER DEFAULT 0,
  paid_analyses_count INTEGER DEFAULT 0,
  total_amount_due DECIMAL(10,2) DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'pending', -- pending, paid, overdue
  stripe_payment_intent_id TEXT, -- ID del payment intent de Stripe
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_user_monthly_usage_user_id ON user_monthly_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_monthly_usage_year_month ON user_monthly_usage(year, month);
CREATE INDEX IF NOT EXISTS idx_user_monthly_usage_payment_status ON user_monthly_usage(payment_status);
CREATE INDEX IF NOT EXISTS idx_user_monthly_usage_stripe_payment ON user_monthly_usage(stripe_payment_intent_id);

-- Función para obtener o crear el registro de uso mensual del usuario actual
CREATE OR REPLACE FUNCTION get_or_create_monthly_usage(target_year INTEGER DEFAULT NULL, target_month INTEGER DEFAULT NULL)
RETURNS user_monthly_usage AS $$
DECLARE
  current_year INTEGER := COALESCE(target_year, EXTRACT(YEAR FROM NOW()));
  current_month INTEGER := COALESCE(target_month, EXTRACT(MONTH FROM NOW()));
  usage_record user_monthly_usage;
BEGIN
  -- Intentar obtener el registro existente
  SELECT * INTO usage_record 
  FROM user_monthly_usage 
  WHERE user_id = auth.uid() 
    AND year = current_year 
    AND month = current_month;
  
  -- Si no existe, crearlo
  IF NOT FOUND THEN
    INSERT INTO user_monthly_usage (user_id, year, month)
    VALUES (auth.uid(), current_year, current_month)
    RETURNING * INTO usage_record;
  END IF;
  
  RETURN usage_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para incrementar el conteo de análisis
CREATE OR REPLACE FUNCTION increment_analysis_count()
RETURNS JSONB AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM NOW());
  current_month INTEGER := EXTRACT(MONTH FROM NOW());
  usage_record user_monthly_usage;
  free_limit INTEGER;
  additional_price DECIMAL(10,2);
  is_free_analysis BOOLEAN := FALSE;
  amount_to_charge DECIMAL(10,2) := 0;
  current_total_analyses INTEGER := 0;
  user_workshop_id UUID;
BEGIN
  -- Obtener configuraciones del sistema
  SELECT (get_system_setting('monthly_free_analyses_limit')->>'value')::INTEGER INTO free_limit;
  SELECT (get_system_setting('additional_analysis_price')->>'value')::DECIMAL INTO additional_price;
  
  -- Obtener el workshop_id del usuario actual
  SELECT workshop_id INTO user_workshop_id 
  FROM profiles 
  WHERE id = auth.uid();
  
  -- Contar análisis reales del mes actual (antes de crear el nuevo)
  SELECT COUNT(*) INTO current_total_analyses
  FROM analysis 
  WHERE workshop_id = user_workshop_id
    AND EXTRACT(YEAR FROM created_at) = current_year
    AND EXTRACT(MONTH FROM created_at) = current_month;
  
  -- Determinar si este análisis es gratuito o de pago basado en el conteo real
  IF current_total_analyses < free_limit THEN
    is_free_analysis := TRUE;
  ELSE
    amount_to_charge := additional_price;
  END IF;
  
  -- Obtener o crear registro de uso mensual
  SELECT * INTO usage_record FROM get_or_create_monthly_usage(current_year, current_month);
  
  -- Solo actualizar el total_amount_due si hay cargo
  IF amount_to_charge > 0 THEN
    UPDATE user_monthly_usage 
    SET 
      total_amount_due = total_amount_due + amount_to_charge,
      updated_at = NOW()
    WHERE user_id = auth.uid() 
      AND year = current_year 
      AND month = current_month;
  END IF;
  
  -- Retornar información sobre el análisis
  RETURN jsonb_build_object(
    'is_free', is_free_analysis,
    'amount_charged', amount_to_charge,
    'total_analyses', current_total_analyses + 1,
    'free_analyses_used', LEAST(current_total_analyses + 1, free_limit),
    'free_analyses_limit', free_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener el uso mensual actual del usuario
CREATE OR REPLACE FUNCTION get_current_monthly_usage()
RETURNS JSONB AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM NOW());
  current_month INTEGER := EXTRACT(MONTH FROM NOW());
  usage_record user_monthly_usage;
  free_limit INTEGER;
  actual_total_analyses INTEGER := 0;
  actual_free_analyses INTEGER := 0;
  actual_paid_analyses INTEGER := 0;
  user_workshop_id UUID;
BEGIN
  -- Obtener configuraciones del sistema
  SELECT (get_system_setting('monthly_free_analyses_limit')->>'value')::INTEGER INTO free_limit;
  
  -- Obtener el workshop_id del usuario actual
  SELECT workshop_id INTO user_workshop_id 
  FROM profiles 
  WHERE id = auth.uid();
  
  -- Contar análisis reales del mes actual desde la tabla analysis
  SELECT COUNT(*) INTO actual_total_analyses
  FROM analysis 
  WHERE workshop_id = user_workshop_id
    AND EXTRACT(YEAR FROM created_at) = current_year
    AND EXTRACT(MONTH FROM created_at) = current_month;
  
  -- Calcular análisis gratuitos y de pago basado en el límite
  actual_free_analyses := LEAST(actual_total_analyses, free_limit);
  actual_paid_analyses := GREATEST(0, actual_total_analyses - free_limit);
  
  -- Obtener registro de uso mensual (crear si no existe) para obtener payment_status y total_amount_due
  SELECT * INTO usage_record FROM get_or_create_monthly_usage(current_year, current_month);
  
  RETURN jsonb_build_object(
    'total_analyses', actual_total_analyses,
    'free_analyses_used', actual_free_analyses,
    'paid_analyses_count', actual_paid_analyses,
    'free_analyses_limit', free_limit,
    'remaining_free_analyses', GREATEST(0, free_limit - actual_free_analyses),
    'total_amount_due', usage_record.total_amount_due,
    'payment_status', usage_record.payment_status,
    'year', current_year,
    'month', current_month
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para marcar un pago como completado
CREATE OR REPLACE FUNCTION mark_payment_completed(stripe_payment_intent_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_monthly_usage 
  SET 
    payment_status = 'paid',
    updated_at = NOW()
  WHERE stripe_payment_intent_id = stripe_payment_intent_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas RLS para user_monthly_usage
ALTER TABLE user_monthly_usage ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver y modificar solo sus propios registros
CREATE POLICY "Users can manage their own monthly usage" ON user_monthly_usage
  FOR ALL USING (user_id = auth.uid());

-- Los admins pueden ver todos los registros
CREATE POLICY "Admins can view all monthly usage" ON user_monthly_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_user_monthly_usage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_monthly_usage_updated_at
  BEFORE UPDATE ON user_monthly_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_user_monthly_usage_updated_at();

-- Constraint para validar el estado de pago
ALTER TABLE user_monthly_usage 
ADD CONSTRAINT check_payment_status 
CHECK (payment_status IN ('pending', 'paid', 'overdue', 'failed'));

-- Constraint para validar mes y año
ALTER TABLE user_monthly_usage 
ADD CONSTRAINT check_month_range 
CHECK (month >= 1 AND month <= 12);

ALTER TABLE user_monthly_usage 
ADD CONSTRAINT check_year_range 
CHECK (year >= 2024 AND year <= 2100);

-- Source: 20241027_setup_stripe_integration.sql
-- Crear tabla para almacenar información de pagos de Stripe
CREATE TABLE IF NOT EXISTS stripe_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  payment_intent_id TEXT UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  status VARCHAR(50) NOT NULL, -- requires_payment_method, requires_confirmation, requires_action, processing, requires_capture, canceled, succeeded
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_stripe_payments_user_id ON stripe_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_payment_intent ON stripe_payments(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_status ON stripe_payments(status);

-- Función para crear un payment intent de Stripe (simulada - se implementará con Edge Functions)
CREATE OR REPLACE FUNCTION create_stripe_payment_intent(
  amount_cents INTEGER,
  currency_code TEXT DEFAULT 'eur',
  description_text TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  payment_record stripe_payments;
  mock_payment_intent_id TEXT;
BEGIN
  -- Generar un ID simulado para el payment intent (en producción esto vendrá de Stripe)
  mock_payment_intent_id := 'pi_mock_' || gen_random_uuid()::TEXT;
  
  -- Insertar registro de pago
  INSERT INTO stripe_payments (
    user_id, 
    payment_intent_id, 
    amount, 
    currency, 
    status, 
    description,
    metadata
  ) VALUES (
    auth.uid(),
    mock_payment_intent_id,
    amount_cents / 100.0,
    currency_code,
    'requires_payment_method',
    description_text,
    jsonb_build_object(
      'user_id', auth.uid(),
      'created_by', 'system',
      'type', 'additional_analysis'
    )
  ) RETURNING * INTO payment_record;
  
  -- Retornar información del payment intent
  RETURN jsonb_build_object(
    'payment_intent_id', payment_record.payment_intent_id,
    'amount', payment_record.amount,
    'currency', payment_record.currency,
    'status', payment_record.status,
    'client_secret', 'pi_mock_secret_' || gen_random_uuid()::TEXT -- En producción esto vendrá de Stripe
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para actualizar el estado de un payment intent
CREATE OR REPLACE FUNCTION update_stripe_payment_status(
  payment_intent_id_param TEXT,
  new_status TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE stripe_payments 
  SET 
    status = new_status,
    updated_at = NOW()
  WHERE payment_intent_id = payment_intent_id_param;
  
  -- Si el pago fue exitoso, actualizar el estado en user_monthly_usage
  IF new_status = 'succeeded' THEN
    PERFORM mark_payment_completed(payment_intent_id_param);
  END IF;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para procesar un análisis con verificación de pago
CREATE OR REPLACE FUNCTION process_analysis_with_payment_check()
RETURNS JSONB AS $$
DECLARE
  usage_info JSONB;
  payment_info JSONB;
  billing_enabled BOOLEAN;
BEGIN
  -- Verificar si la facturación está habilitada
  SELECT (get_system_setting('billing_enabled')->>'value')::BOOLEAN INTO billing_enabled;
  
  -- Incrementar el conteo de análisis
  SELECT increment_analysis_count() INTO usage_info;
  
  -- Si no es gratuito y la facturación está habilitada, crear payment intent
  IF NOT (usage_info->>'is_free')::BOOLEAN AND billing_enabled THEN
    SELECT create_stripe_payment_intent(
      ((usage_info->>'amount_charged')::DECIMAL * 100)::INTEGER, -- Convertir a centavos
      'eur',
      'Análisis adicional - ' || TO_CHAR(NOW(), 'MM/YYYY')
    ) INTO payment_info;
    
    -- Actualizar el registro de uso mensual con el payment intent ID
    UPDATE user_monthly_usage 
    SET stripe_payment_intent_id = payment_info->>'payment_intent_id'
    WHERE user_id = auth.uid() 
      AND year = EXTRACT(YEAR FROM NOW())
      AND month = EXTRACT(MONTH FROM NOW());
  END IF;
  
  -- Retornar información completa
  RETURN jsonb_build_object(
    'usage_info', usage_info,
    'payment_info', COALESCE(payment_info, '{}'::JSONB),
    'requires_payment', NOT (usage_info->>'is_free')::BOOLEAN AND billing_enabled
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener historial de pagos del usuario
CREATE OR REPLACE FUNCTION get_user_payment_history()
RETURNS JSONB AS $$
DECLARE
  payments JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', sp.id,
      'amount', sp.amount,
      'currency', sp.currency,
      'status', sp.status,
      'description', sp.description,
      'created_at', sp.created_at,
      'month_year', TO_CHAR(sp.created_at, 'MM/YYYY')
    ) ORDER BY sp.created_at DESC
  ) INTO payments
  FROM stripe_payments sp
  WHERE sp.user_id = auth.uid();
  
  RETURN COALESCE(payments, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas RLS para stripe_payments
ALTER TABLE stripe_payments ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver solo sus propios pagos
CREATE POLICY "Users can view their own payments" ON stripe_payments
  FOR SELECT USING (user_id = auth.uid());

-- Los admins pueden ver todos los pagos
CREATE POLICY "Admins can view all payments" ON stripe_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Solo el sistema puede insertar/actualizar pagos (a través de funciones SECURITY DEFINER)
CREATE POLICY "System can manage payments" ON stripe_payments
  FOR ALL USING (FALSE); -- Bloquear acceso directo, solo a través de funciones

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_stripe_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stripe_payments_updated_at
  BEFORE UPDATE ON stripe_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_stripe_payments_updated_at();

-- Agregar configuraciones adicionales para Stripe
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
  ('stripe_publishable_key', '{"value": ""}', 'Clave pública de Stripe para el frontend'),
  ('stripe_webhook_secret', '{"value": ""}', 'Secret para validar webhooks de Stripe'),
  ('payment_success_redirect', '{"value": "/my-account?payment=success"}', 'URL de redirección después de pago exitoso'),
  ('payment_cancel_redirect', '{"value": "/my-account?payment=cancelled"}', 'URL de redirección después de cancelar pago')
ON CONFLICT (setting_key) DO NOTHING;

-- Source: 20241028_simplify_user_monthly_usage.sql
-- Simplificar la tabla user_monthly_usage eliminando campos redundantes
-- Ahora que contamos directamente desde la tabla analysis, estos campos ya no son necesarios

-- Eliminar columnas redundantes que ahora se calculan dinámicamente
ALTER TABLE user_monthly_usage 
DROP COLUMN IF EXISTS analyses_count,
DROP COLUMN IF EXISTS free_analyses_used,
DROP COLUMN IF EXISTS paid_analyses_count;

-- Actualizar la función get_or_create_monthly_usage para no inicializar estos campos
CREATE OR REPLACE FUNCTION get_or_create_monthly_usage(target_year INTEGER DEFAULT NULL, target_month INTEGER DEFAULT NULL)
RETURNS user_monthly_usage AS $$
DECLARE
  current_year INTEGER := COALESCE(target_year, EXTRACT(YEAR FROM NOW()));
  current_month INTEGER := COALESCE(target_month, EXTRACT(MONTH FROM NOW()));
  usage_record user_monthly_usage;
BEGIN
  -- Intentar obtener el registro existente
  SELECT * INTO usage_record 
  FROM user_monthly_usage 
  WHERE user_id = auth.uid() 
    AND year = current_year 
    AND month = current_month;
  
  -- Si no existe, crear uno nuevo
  IF NOT FOUND THEN
    INSERT INTO user_monthly_usage (
      user_id, 
      year, 
      month,
      total_amount_due,
      payment_status
    ) VALUES (
      auth.uid(), 
      current_year, 
      current_month,
      0,
      'pending'
    ) RETURNING * INTO usage_record;
  END IF;
  
  RETURN usage_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario explicativo sobre el nuevo enfoque
COMMENT ON TABLE user_monthly_usage IS 'Tabla simplificada para seguimiento de pagos mensuales. Los conteos de análisis se calculan dinámicamente desde la tabla analysis.';
COMMENT ON COLUMN user_monthly_usage.total_amount_due IS 'Monto total adeudado por análisis de pago del mes';
COMMENT ON COLUMN user_monthly_usage.payment_status IS 'Estado del pago: pending, paid, overdue';
COMMENT ON COLUMN user_monthly_usage.stripe_payment_intent_id IS 'ID del payment intent de Stripe para este mes';

-- Source: 20241029_create_payments_table.sql
-- Crear tabla payments mejorada para registrar todas las transacciones de Stripe
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID REFERENCES workshops(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  
  -- Datos de Stripe
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  stripe_session_id TEXT,
  stripe_customer_id TEXT,
  
  -- Detalles del pago
  amount_cents INTEGER NOT NULL, -- en centavos
  currency TEXT DEFAULT 'EUR' NOT NULL,
  status TEXT NOT NULL, -- 'pending', 'succeeded', 'failed', 'canceled'
  
  -- Contexto del pago
  analysis_month TEXT NOT NULL, -- formato 'YYYY-MM'
  analyses_purchased INTEGER DEFAULT 1 NOT NULL, -- cuántos análisis se compraron
  unit_price_cents INTEGER NOT NULL, -- precio por análisis en centavos
  
  -- Metadatos
  payment_method TEXT, -- 'card', 'sepa_debit', etc.
  stripe_fee_cents INTEGER, -- comisión de Stripe
  net_amount_cents INTEGER, -- cantidad neta recibida
  description TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_payments_workshop_id ON payments(workshop_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_analysis_month ON payments(analysis_month);

-- Políticas RLS para payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver solo los pagos de su workshop
CREATE POLICY "Users can view their workshop payments" ON payments
  FOR SELECT USING (
    workshop_id IN (
      SELECT workshop_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Los admins pueden ver todos los pagos
CREATE POLICY "Admins can view all payments" ON payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Solo el sistema puede insertar/actualizar pagos (a través de funciones SECURITY DEFINER)
CREATE POLICY "System can manage payments" ON payments
  FOR ALL USING (FALSE); -- Bloquear acceso directo, solo a través de funciones

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();

-- Función para crear un registro de pago
CREATE OR REPLACE FUNCTION create_payment_record(
  workshop_id_param UUID,
  stripe_payment_intent_id_param TEXT,
  stripe_session_id_param TEXT,
  amount_cents_param INTEGER,
  currency_param TEXT DEFAULT 'EUR',
  analysis_month_param TEXT DEFAULT NULL,
  description_param TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  payment_id UUID;
  current_month TEXT;
BEGIN
  -- Usar el mes actual si no se proporciona
  current_month := COALESCE(analysis_month_param, TO_CHAR(NOW(), 'YYYY-MM'));
  
  -- Insertar registro de pago
  INSERT INTO payments (
    workshop_id,
    user_id,
    stripe_payment_intent_id,
    stripe_session_id,
    amount_cents,
    currency,
    status,
    analysis_month,
    analyses_purchased,
    unit_price_cents,
    description
  ) VALUES (
    workshop_id_param,
    auth.uid(),
    stripe_payment_intent_id_param,
    stripe_session_id_param,
    amount_cents_param,
    currency_param,
    'pending',
    current_month,
    1, -- Por defecto 1 análisis
    amount_cents_param, -- Por ahora el precio unitario es igual al total
    description_param
  ) RETURNING id INTO payment_id;
  
  RETURN payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para actualizar el estado de un pago
CREATE OR REPLACE FUNCTION update_payment_status(
  stripe_payment_intent_id_param TEXT,
  new_status TEXT,
  payment_method_param TEXT DEFAULT NULL,
  stripe_fee_cents_param INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  payment_record payments;
BEGIN
  -- Actualizar el estado del pago
  UPDATE payments 
  SET 
    status = new_status,
    payment_method = COALESCE(payment_method_param, payment_method),
    stripe_fee_cents = COALESCE(stripe_fee_cents_param, stripe_fee_cents),
    net_amount_cents = CASE 
      WHEN stripe_fee_cents_param IS NOT NULL 
      THEN amount_cents - stripe_fee_cents_param 
      ELSE net_amount_cents 
    END,
    paid_at = CASE WHEN new_status = 'succeeded' THEN NOW() ELSE paid_at END,
    updated_at = NOW()
  WHERE stripe_payment_intent_id = stripe_payment_intent_id_param
  RETURNING * INTO payment_record;
  
  -- Si el pago fue exitoso, actualizar el estado en user_monthly_usage
  IF new_status = 'succeeded' AND payment_record.id IS NOT NULL THEN
    PERFORM mark_payment_completed(stripe_payment_intent_id_param);
  END IF;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener historial de pagos de un workshop
CREATE OR REPLACE FUNCTION get_workshop_payment_history(workshop_id_param UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  target_workshop_id UUID;
  payments_data JSONB;
BEGIN
  -- Si no se proporciona workshop_id, usar el del usuario actual
  IF workshop_id_param IS NULL THEN
    SELECT workshop_id INTO target_workshop_id
    FROM profiles 
    WHERE id = auth.uid();
  ELSE
    target_workshop_id := workshop_id_param;
  END IF;
  
  -- Verificar que el usuario tenga acceso al workshop
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND (workshop_id = target_workshop_id OR role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied to workshop payments';
  END IF;
  
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'amount_cents', p.amount_cents,
      'amount_euros', ROUND(p.amount_cents / 100.0, 2),
      'currency', p.currency,
      'status', p.status,
      'description', p.description,
      'analysis_month', p.analysis_month,
      'analyses_purchased', p.analyses_purchased,
      'payment_method', p.payment_method,
      'created_at', p.created_at,
      'paid_at', p.paid_at
    ) ORDER BY p.created_at DESC
  ) INTO payments_data
  FROM payments p
  WHERE p.workshop_id = target_workshop_id;
  
  RETURN COALESCE(payments_data, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener estadísticas de pagos para admin
CREATE OR REPLACE FUNCTION get_payment_statistics()
RETURNS JSONB AS $$
DECLARE
  stats JSONB;
BEGIN
  -- Verificar que el usuario sea admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied - admin only';
  END IF;
  
  SELECT jsonb_build_object(
    'total_revenue_cents', COALESCE(SUM(CASE WHEN status = 'succeeded' THEN amount_cents ELSE 0 END), 0),
    'total_revenue_euros', ROUND(COALESCE(SUM(CASE WHEN status = 'succeeded' THEN amount_cents ELSE 0 END), 0) / 100.0, 2),
    'total_payments', COUNT(*),
    'successful_payments', COUNT(*) FILTER (WHERE status = 'succeeded'),
    'pending_payments', COUNT(*) FILTER (WHERE status = 'pending'),
    'failed_payments', COUNT(*) FILTER (WHERE status IN ('failed', 'canceled')),
    'current_month_revenue_cents', COALESCE(SUM(CASE 
      WHEN status = 'succeeded' AND analysis_month = TO_CHAR(NOW(), 'YYYY-MM') 
      THEN amount_cents ELSE 0 END), 0),
    'workshops_with_payments', COUNT(DISTINCT workshop_id) FILTER (WHERE status = 'succeeded')
  ) INTO stats
  FROM payments;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: 20241030_fix_workshops_insert_policy.sql
-- Fix workshops INSERT policy to allow registration
-- The issue: RLS is enabled but there's no INSERT policy, preventing workshop creation

-- Add INSERT policy to allow authenticated users to create workshops
-- This is needed for the registration flow where new users create their workshop
CREATE POLICY "Allow authenticated users to create workshops" ON public.workshops
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Also ensure we have a proper SELECT policy for workshop owners
-- This allows users to see their own workshop after creation
CREATE POLICY "Users can view their own workshop" ON public.workshops
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.workshop_id = workshops.id 
    AND profiles.id = auth.uid()
  )
);

-- Note: This maintains security while allowing the registration flow to work
-- Users can create workshops, but can only see their own workshop
-- Admins can still see all workshops via existing admin policies

-- Source: 20241031_allow_profile_insert.sql
-- Allow users to insert their own profile (needed for UPSERT during registration)
-- This is safe because users can only insert their own profile (auth.uid() = id)

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Source: 20241101_fix_workshop_costs_rls.sql
-- Fix workshop_costs RLS policies to allow proper access
-- The issue is that the current policies are too restrictive and block SELECT queries
-- even when no data exists, which is normal for new analyses

-- Drop existing policies
DROP POLICY IF EXISTS "workshop_costs_workshop_policy" ON workshop_costs;
DROP POLICY IF EXISTS "workshop_costs_admin_policy" ON workshop_costs;

-- Create separate policies for different operations
-- Policy for SELECT operations - allows users to query their workshop's costs (even if empty)
CREATE POLICY "workshop_costs_select_policy" ON workshop_costs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM analysis a
            JOIN profiles p ON p.workshop_id = a.workshop_id
            WHERE a.id = workshop_costs.analysis_id
            AND p.id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Policy for INSERT operations - allows users to create costs for their workshop's analyses
CREATE POLICY "workshop_costs_insert_policy" ON workshop_costs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM analysis a
            JOIN profiles p ON p.workshop_id = a.workshop_id
            WHERE a.id = workshop_costs.analysis_id
            AND p.id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Policy for UPDATE operations - allows users to update costs for their workshop's analyses
CREATE POLICY "workshop_costs_update_policy" ON workshop_costs
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM analysis a
            JOIN profiles p ON p.workshop_id = a.workshop_id
            WHERE a.id = workshop_costs.analysis_id
            AND p.id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Policy for DELETE operations - allows users to delete costs for their workshop's analyses
CREATE POLICY "workshop_costs_delete_policy" ON workshop_costs
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM analysis a
            JOIN profiles p ON p.workshop_id = a.workshop_id
            WHERE a.id = workshop_costs.analysis_id
            AND p.id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Source: 20241220_add_converted_hours_fields.sql
-- Add converted hours fields and unit metadata to insurance_amounts table
-- This migration adds support for storing converted hours alongside original UT values

ALTER TABLE insurance_amounts 
ADD COLUMN bodywork_labor_hours DECIMAL(10,2),
ADD COLUMN painting_labor_hours DECIMAL(10,2),
ADD COLUMN detected_units TEXT CHECK (detected_units IN ('UT', 'HORAS', 'MIXTO'));

-- Add comments to explain the new fields
COMMENT ON COLUMN insurance_amounts.bodywork_labor_hours IS 'Mano de obra chapa convertida a horas (10 UT = 1 hora)';
COMMENT ON COLUMN insurance_amounts.painting_labor_hours IS 'Mano de obra pintura convertida a horas (10 UT = 1 hora)';
COMMENT ON COLUMN insurance_amounts.detected_units IS 'Tipo de unidades detectadas en el PDF: UT, HORAS o MIXTO';

-- Update existing records to convert UT to hours (assuming existing data is in UT)
-- Only update if the hours fields are null and UT fields have values
UPDATE insurance_amounts 
SET 
  bodywork_labor_hours = ROUND(bodywork_labor_ut / 10.0, 2),
  painting_labor_hours = ROUND(painting_labor_ut / 10.0, 2),
  detected_units = 'UT'
WHERE 
  bodywork_labor_hours IS NULL 
  AND painting_labor_hours IS NULL 
  AND (bodywork_labor_ut IS NOT NULL OR painting_labor_ut IS NOT NULL);

-- Source: 20241220_add_hourly_prices_to_insurance_amounts.sql
-- Agregar campos de precios por hora a la tabla insurance_amounts
ALTER TABLE insurance_amounts 
ADD COLUMN bodywork_hourly_price DECIMAL(10,2),
ADD COLUMN painting_hourly_price DECIMAL(10,2),
ADD COLUMN bodywork_labor_hours DECIMAL(10,2),
ADD COLUMN painting_labor_hours DECIMAL(10,2),
ADD COLUMN iva_percentage DECIMAL(5,2);

-- Agregar comentarios para documentar los nuevos campos
COMMENT ON COLUMN insurance_amounts.bodywork_hourly_price IS 'Precio por hora de mano de obra de chapa';
COMMENT ON COLUMN insurance_amounts.painting_hourly_price IS 'Precio por hora de mano de obra de pintura';
COMMENT ON COLUMN insurance_amounts.bodywork_labor_hours IS 'Horas de mano de obra de chapa';
COMMENT ON COLUMN insurance_amounts.painting_labor_hours IS 'Horas de mano de obra de pintura';
COMMENT ON COLUMN insurance_amounts.iva_percentage IS 'Porcentaje de IVA aplicado';

-- Source: 20241224_disable_workshop_costs_rls.sql
-- Disable Row Level Security for workshop_costs table temporarily
-- This is a temporary fix to resolve authentication issues with the workshop costs page

ALTER TABLE public.workshop_costs DISABLE ROW LEVEL SECURITY;

-- Add a comment explaining this is temporary
COMMENT ON TABLE public.workshop_costs IS 'RLS temporarily disabled due to session authentication issues. Should be re-enabled once auth flow is fixed.';

-- Source: 20241225_update_payment_status_with_session_id.sql
-- Actualizar la función update_payment_status para incluir stripe_session_id_param
CREATE OR REPLACE FUNCTION update_payment_status(
  stripe_payment_intent_id_param TEXT,
  new_status TEXT,
  payment_method_param TEXT DEFAULT NULL,
  stripe_fee_cents_param INTEGER DEFAULT NULL,
  stripe_session_id_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  payment_record payments;
BEGIN
  -- Actualizar el estado del pago
  UPDATE payments 
  SET 
    status = new_status,
    payment_method = COALESCE(payment_method_param, payment_method),
    stripe_fee_cents = COALESCE(stripe_fee_cents_param, stripe_fee_cents),
    stripe_session_id = COALESCE(stripe_session_id_param, stripe_session_id),
    net_amount_cents = CASE 
      WHEN stripe_fee_cents_param IS NOT NULL 
      THEN amount_cents - stripe_fee_cents_param 
      ELSE net_amount_cents 
    END,
    paid_at = CASE WHEN new_status = 'succeeded' THEN NOW() ELSE paid_at END,
    updated_at = NOW()
  WHERE stripe_payment_intent_id = stripe_payment_intent_id_param
  RETURNING * INTO payment_record;
  
  -- Si el pago fue exitoso, actualizar el estado en user_monthly_usage
  IF new_status = 'succeeded' AND payment_record.id IS NOT NULL THEN
    PERFORM mark_payment_completed(stripe_payment_intent_id_param);
  END IF;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: 20241226_fix_payments_rls_policies.sql
-- Arreglar las políticas RLS para permitir que las funciones SECURITY DEFINER accedan a payments

-- Eliminar la política restrictiva actual
DROP POLICY IF EXISTS "System can manage payments" ON payments;

-- Crear una política que permita acceso a las funciones del sistema
-- Las funciones SECURITY DEFINER se ejecutan con el rol del propietario de la función
CREATE POLICY "System functions can manage payments" ON payments
  FOR ALL USING (
    -- Permitir acceso si no hay usuario autenticado (webhooks) 
    -- O si es una función del sistema (SECURITY DEFINER)
    auth.uid() IS NULL 
    OR 
    -- Permitir si es el propietario de la función (postgres/service_role)
    current_setting('role', true) = 'service_role'
    OR
    -- Permitir si es una función SECURITY DEFINER ejecutándose
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- También crear una política específica para webhooks anónimos
CREATE POLICY "Anonymous webhooks can manage payments" ON payments
  FOR ALL USING (
    -- Permitir si no hay usuario autenticado (caso de webhooks)
    auth.uid() IS NULL
  );

-- Source: 20250121_add_customer_id_to_payment_record.sql
-- Add stripe_customer_id parameter to create_payment_record function

CREATE OR REPLACE FUNCTION create_payment_record(
  workshop_id_param UUID,
  user_id_param UUID,
  stripe_payment_intent_id_param TEXT,
  stripe_session_id_param TEXT,
  stripe_customer_id_param TEXT,
  amount_cents_param INTEGER,
  currency_param TEXT DEFAULT 'EUR',
  analysis_month_param TEXT DEFAULT NULL,
  description_param TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  payment_id UUID;
  current_month TEXT;
BEGIN
  -- Usar el mes actual si no se proporciona
  current_month := COALESCE(analysis_month_param, TO_CHAR(NOW(), 'YYYY-MM'));
  
  -- Insertar registro de pago
  INSERT INTO payments (
    workshop_id,
    user_id,
    stripe_payment_intent_id,
    stripe_session_id,
    stripe_customer_id,
    amount_cents,
    currency,
    status,
    analysis_month,
    analyses_purchased,
    unit_price_cents,
    description
  ) VALUES (
    workshop_id_param,
    user_id_param,
    stripe_payment_intent_id_param,
    stripe_session_id_param,
    stripe_customer_id_param,
    amount_cents_param,
    currency_param,
    'pending',
    current_month,
    1, -- Por defecto 1 análisis
    amount_cents_param, -- Por ahora el precio unitario es igual al total
    description_param
  ) RETURNING id INTO payment_id;
  
  RETURN payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: 20250121_fix_create_payment_record_customer_id.sql
-- Fix create_payment_record function to accept stripe_customer_id parameter
-- This solves the issue where the function call fails due to parameter mismatch

CREATE OR REPLACE FUNCTION create_payment_record(
  workshop_id_param UUID,
  user_id_param UUID,
  stripe_payment_intent_id_param TEXT,
  stripe_session_id_param TEXT,
  amount_cents_param INTEGER,
  stripe_customer_id_param TEXT DEFAULT NULL,
  currency_param TEXT DEFAULT 'EUR',
  analysis_month_param TEXT DEFAULT NULL,
  description_param TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  payment_id UUID;
  current_month TEXT;
BEGIN
  -- Usar el mes actual si no se proporciona
  current_month := COALESCE(analysis_month_param, TO_CHAR(NOW(), 'YYYY-MM'));
  
  -- Insertar registro de pago
  INSERT INTO payments (
    workshop_id,
    user_id,
    stripe_payment_intent_id,
    stripe_session_id,
    stripe_customer_id,
    amount_cents,
    currency,
    status,
    analysis_month,
    analyses_purchased,
    unit_price_cents,
    description
  ) VALUES (
    workshop_id_param,
    user_id_param,
    stripe_payment_intent_id_param,
    stripe_session_id_param,
    stripe_customer_id_param,
    amount_cents_param,
    currency_param,
    'pending',
    current_month,
    1, -- Por defecto 1 análisis
    amount_cents_param, -- Por ahora el precio unitario es igual al total
    description_param
  ) RETURNING id INTO payment_id;
  
  RETURN payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: 20250121_fix_create_payment_record_user_id.sql
-- Fix create_payment_record function to accept user_id parameter
-- This solves the issue where webhooks fail because auth.uid() returns null

CREATE OR REPLACE FUNCTION create_payment_record(
  workshop_id_param UUID,
  user_id_param UUID,
  stripe_payment_intent_id_param TEXT,
  stripe_session_id_param TEXT,
  amount_cents_param INTEGER,
  currency_param TEXT DEFAULT 'EUR',
  analysis_month_param TEXT DEFAULT NULL,
  description_param TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  payment_id UUID;
  current_month TEXT;
BEGIN
  -- Usar el mes actual si no se proporciona
  current_month := COALESCE(analysis_month_param, TO_CHAR(NOW(), 'YYYY-MM'));
  
  -- Insertar registro de pago
  INSERT INTO payments (
    workshop_id,
    user_id,
    stripe_payment_intent_id,
    stripe_session_id,
    amount_cents,
    currency,
    status,
    analysis_month,
    analyses_purchased,
    unit_price_cents,
    description
  ) VALUES (
    workshop_id_param,
    user_id_param, -- Usar el parámetro en lugar de auth.uid()
    stripe_payment_intent_id_param,
    stripe_session_id_param,
    amount_cents_param,
    currency_param,
    'pending',
    current_month,
    1, -- Por defecto 1 análisis
    amount_cents_param, -- Por ahora el precio unitario es igual al total
    description_param
  ) RETURNING id INTO payment_id;
  
  RETURN payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: 20250121_fix_update_payment_status_overload.sql
-- Solucionar conflicto de sobrecarga de funciones update_payment_status
-- Eliminar todas las versiones anteriores y mantener solo la más completa

-- Eliminar versión original (4 parámetros)
DROP FUNCTION IF EXISTS update_payment_status(
  stripe_payment_intent_id_param TEXT,
  new_status TEXT,
  payment_method_param TEXT,
  stripe_fee_cents_param INTEGER
);

-- Eliminar versión con session_id (5 parámetros)
DROP FUNCTION IF EXISTS update_payment_status(
  stripe_payment_intent_id_param TEXT,
  new_status TEXT,
  payment_method_param TEXT,
  stripe_fee_cents_param INTEGER,
  stripe_session_id_param TEXT
);

-- Recrear la función final con todos los parámetros (6 parámetros)
-- Esta es la versión más completa que debe mantenerse
CREATE OR REPLACE FUNCTION update_payment_status(
  stripe_payment_intent_id_param TEXT,
  new_status TEXT,
  payment_method_param TEXT DEFAULT NULL,
  stripe_fee_cents_param INTEGER DEFAULT NULL,
  stripe_session_id_param TEXT DEFAULT NULL,
  stripe_customer_id_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  payment_record payments;
BEGIN
  -- Actualizar el estado del pago
  UPDATE payments 
  SET 
    status = new_status,
    payment_method = COALESCE(payment_method_param, payment_method),
    stripe_fee_cents = COALESCE(stripe_fee_cents_param, stripe_fee_cents),
    stripe_session_id = COALESCE(stripe_session_id_param, stripe_session_id),
    stripe_customer_id = COALESCE(stripe_customer_id_param, stripe_customer_id),
    net_amount_cents = CASE 
      WHEN stripe_fee_cents_param IS NOT NULL 
      THEN amount_cents - stripe_fee_cents_param 
      ELSE net_amount_cents 
    END,
    paid_at = CASE WHEN new_status = 'succeeded' THEN NOW() ELSE paid_at END,
    updated_at = NOW()
  WHERE stripe_payment_intent_id = stripe_payment_intent_id_param
  RETURNING * INTO payment_record;
  
  -- Si el pago fue exitoso, actualizar el estado en user_monthly_usage
  IF new_status = 'succeeded' AND payment_record.id IS NOT NULL THEN
    PERFORM mark_payment_completed(stripe_payment_intent_id_param);
  END IF;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: 20250121_update_payment_status_with_customer_id.sql
-- Actualizar la función update_payment_status para incluir stripe_customer_id_param
CREATE OR REPLACE FUNCTION update_payment_status(
  stripe_payment_intent_id_param TEXT,
  new_status TEXT,
  payment_method_param TEXT DEFAULT NULL,
  stripe_fee_cents_param INTEGER DEFAULT NULL,
  stripe_session_id_param TEXT DEFAULT NULL,
  stripe_customer_id_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  payment_record payments;
BEGIN
  -- Actualizar el estado del pago
  UPDATE payments 
  SET 
    status = new_status,
    payment_method = COALESCE(payment_method_param, payment_method),
    stripe_fee_cents = COALESCE(stripe_fee_cents_param, stripe_fee_cents),
    stripe_session_id = COALESCE(stripe_session_id_param, stripe_session_id),
    stripe_customer_id = COALESCE(stripe_customer_id_param, stripe_customer_id),
    net_amount_cents = CASE 
      WHEN stripe_fee_cents_param IS NOT NULL 
      THEN amount_cents - stripe_fee_cents_param 
      ELSE net_amount_cents 
    END,
    paid_at = CASE WHEN new_status = 'succeeded' THEN NOW() ELSE paid_at END,
    updated_at = NOW()
  WHERE stripe_payment_intent_id = stripe_payment_intent_id_param
  RETURNING * INTO payment_record;
  
  -- Si el pago fue exitoso, actualizar el estado en user_monthly_usage
  IF new_status = 'succeeded' AND payment_record.id IS NOT NULL THEN
    PERFORM mark_payment_completed(stripe_payment_intent_id_param);
  END IF;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: 20250121_webhook_simplification.sql
-- Webhook Simplification Migration
-- This migration documents the webhook simplification to avoid duplicate payment processing

-- Verify that the update_payment_status function exists with the correct signature
-- This should already be created by the previous migration
DO $$
BEGIN
  -- Check if the function exists with the correct parameters
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'update_payment_status'
    AND p.pronargs = 6  -- 6 parameters
  ) THEN
    RAISE EXCEPTION 'update_payment_status function with 6 parameters not found. Please run the fix_update_payment_status_overload migration first.';
  END IF;
  
  RAISE NOTICE 'update_payment_status function verified successfully';
END $$;

-- Add a comment to document the webhook simplification
COMMENT ON FUNCTION update_payment_status(TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT) IS 
'Updated function to handle payment status updates from simplified webhook. 
Webhook now only processes:
- checkout.session.completed (for successful payments)
- checkout.session.expired (for canceled payments) 
- payment_intent.payment_failed (for failed payments)
Removed duplicate events: payment_intent.succeeded and charge.succeeded to avoid conflicts.';

-- Verify that create_payment_record function exists with customer_id parameter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'create_payment_record'
    AND p.pronargs = 9  -- 9 parameters including stripe_customer_id_param
  ) THEN
    RAISE EXCEPTION 'create_payment_record function with customer_id parameter not found. Please run the add_customer_id_to_payment_record migration first.';
  END IF;
  
  RAISE NOTICE 'create_payment_record function verified successfully';
END $$;

-- Source: 20250122_create_user_paid_analyses_balance.sql
-- Create user_paid_analyses_balance table for persistent paid analyses
CREATE TABLE user_paid_analyses_balance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    remaining_analyses INTEGER NOT NULL DEFAULT 0 CHECK (remaining_analyses >= 0),
    total_purchased INTEGER NOT NULL DEFAULT 0 CHECK (total_purchased >= 0),
    total_used INTEGER NOT NULL DEFAULT 0 CHECK (total_used >= 0),
    package_type VARCHAR(50) DEFAULT 'individual' CHECK (package_type IN ('individual', 'package_5', 'package_10', 'package_20')),
    purchase_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on user_id (one record per user)
CREATE UNIQUE INDEX idx_user_paid_analyses_balance_user_id ON user_paid_analyses_balance(user_id);

-- Create index on remaining_analyses for quick lookups
CREATE INDEX idx_user_paid_analyses_balance_remaining ON user_paid_analyses_balance(remaining_analyses);

-- Add RLS policies
ALTER TABLE user_paid_analyses_balance ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own balance
CREATE POLICY "Users can view own paid analyses balance" ON user_paid_analyses_balance
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can update their own balance (for consuming analyses)
CREATE POLICY "Users can update own paid analyses balance" ON user_paid_analyses_balance
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: System can insert new balances (for new users or purchases)
CREATE POLICY "System can insert paid analyses balance" ON user_paid_analyses_balance
    FOR INSERT WITH CHECK (true);

-- Function to get or create user paid analyses balance
CREATE OR REPLACE FUNCTION get_or_create_paid_analyses_balance(p_user_id UUID)
RETURNS user_paid_analyses_balance AS $$
DECLARE
    balance_record user_paid_analyses_balance;
BEGIN
    -- Try to get existing balance
    SELECT * INTO balance_record
    FROM user_paid_analyses_balance
    WHERE user_id = p_user_id;
    
    -- If no balance exists, create one
    IF NOT FOUND THEN
        INSERT INTO user_paid_analyses_balance (user_id)
        VALUES (p_user_id)
        RETURNING * INTO balance_record;
    END IF;
    
    RETURN balance_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add paid analyses to user balance
CREATE OR REPLACE FUNCTION add_paid_analyses(
    p_user_id UUID,
    p_analyses_count INTEGER,
    p_package_type VARCHAR(50) DEFAULT 'individual',
    p_stripe_payment_intent_id TEXT DEFAULT NULL,
    p_amount_paid DECIMAL DEFAULT NULL
)
RETURNS user_paid_analyses_balance AS $$
DECLARE
    balance_record user_paid_analyses_balance;
    purchase_entry JSONB;
BEGIN
    -- Validate input
    IF p_analyses_count <= 0 THEN
        RAISE EXCEPTION 'Analyses count must be positive';
    END IF;
    
    -- Get or create balance record
    SELECT * INTO balance_record FROM get_or_create_paid_analyses_balance(p_user_id);
    
    -- Create purchase history entry
    purchase_entry := jsonb_build_object(
        'date', NOW(),
        'analyses_count', p_analyses_count,
        'package_type', p_package_type,
        'stripe_payment_intent_id', p_stripe_payment_intent_id,
        'amount_paid', p_amount_paid
    );
    
    -- Update balance
    UPDATE user_paid_analyses_balance
    SET 
        remaining_analyses = remaining_analyses + p_analyses_count,
        total_purchased = total_purchased + p_analyses_count,
        package_type = p_package_type,
        purchase_history = purchase_history || purchase_entry,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING * INTO balance_record;
    
    RETURN balance_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to consume a paid analysis
CREATE OR REPLACE FUNCTION consume_paid_analysis(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    balance_record user_paid_analyses_balance;
BEGIN
    -- Get current balance
    SELECT * INTO balance_record
    FROM user_paid_analyses_balance
    WHERE user_id = p_user_id;
    
    -- If no balance or no remaining analyses, return false
    IF NOT FOUND OR balance_record.remaining_analyses <= 0 THEN
        RETURN FALSE;
    END IF;
    
    -- Consume one analysis
    UPDATE user_paid_analyses_balance
    SET 
        remaining_analyses = remaining_analyses - 1,
        total_used = total_used + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's paid analyses balance
CREATE OR REPLACE FUNCTION get_paid_analyses_balance(p_user_id UUID)
RETURNS TABLE (
    remaining_analyses INTEGER,
    total_purchased INTEGER,
    total_used INTEGER,
    package_type VARCHAR(50),
    purchase_history JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(upab.remaining_analyses, 0) as remaining_analyses,
        COALESCE(upab.total_purchased, 0) as total_purchased,
        COALESCE(upab.total_used, 0) as total_used,
        COALESCE(upab.package_type, 'individual') as package_type,
        COALESCE(upab.purchase_history, '[]'::jsonb) as purchase_history
    FROM user_paid_analyses_balance upab
    WHERE upab.user_id = p_user_id
    
    UNION ALL
    
    SELECT 0, 0, 0, 'individual', '[]'::jsonb
    WHERE NOT EXISTS (
        SELECT 1 FROM user_paid_analyses_balance WHERE user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_paid_analyses_balance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_paid_analyses_balance_updated_at
    BEFORE UPDATE ON user_paid_analyses_balance
    FOR EACH ROW
    EXECUTE FUNCTION update_paid_analyses_balance_updated_at();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON user_paid_analyses_balance TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_paid_analyses_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_paid_analyses(UUID, INTEGER, VARCHAR, TEXT, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION consume_paid_analysis(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_paid_analyses_balance(UUID) TO authenticated;

-- Source: 20250122_update_monthly_usage_with_paid_balance.sql
-- Update get_current_monthly_usage to include paid analyses balance
CREATE OR REPLACE FUNCTION get_current_monthly_usage()
RETURNS JSONB AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM NOW());
  current_month INTEGER := EXTRACT(MONTH FROM NOW());
  usage_record user_monthly_usage;
  paid_balance_record RECORD;
  free_limit INTEGER;
  actual_total_analyses INTEGER := 0;
  actual_free_analyses INTEGER := 0;
  actual_paid_analyses INTEGER := 0;
  user_workshop_id UUID;
  remaining_paid_analyses INTEGER := 0;
BEGIN
  -- Obtener configuraciones del sistema
  SELECT (get_system_setting('monthly_free_analyses_limit')->>'value')::INTEGER INTO free_limit;
  
  -- Obtener el workshop_id del usuario actual
  SELECT workshop_id INTO user_workshop_id 
  FROM profiles 
  WHERE id = auth.uid();
  
  -- Contar análisis reales del mes actual desde la tabla analysis
  SELECT COUNT(*) INTO actual_total_analyses
  FROM analysis 
  WHERE workshop_id = user_workshop_id
    AND EXTRACT(YEAR FROM created_at) = current_year
    AND EXTRACT(MONTH FROM created_at) = current_month;
  
  -- Calcular análisis gratuitos y de pago basado en el límite
  actual_free_analyses := LEAST(actual_total_analyses, free_limit);
  actual_paid_analyses := GREATEST(0, actual_total_analyses - free_limit);
  
  -- Obtener balance de análisis pagados
  SELECT * INTO paid_balance_record 
  FROM get_paid_analyses_balance(auth.uid()) 
  LIMIT 1;
  
  IF paid_balance_record IS NOT NULL THEN
    remaining_paid_analyses := paid_balance_record.remaining_analyses;
  ELSE
    remaining_paid_analyses := 0;
  END IF;
  
  -- Obtener registro de uso mensual (crear si no existe) para obtener payment_status y total_amount_due
  SELECT * INTO usage_record FROM get_or_create_monthly_usage(current_year, current_month);
  
  RETURN jsonb_build_object(
    'total_analyses', actual_total_analyses,
    'free_analyses_used', actual_free_analyses,
    'paid_analyses_count', actual_paid_analyses,
    'free_analyses_limit', free_limit,
    'remaining_free_analyses', GREATEST(0, free_limit - actual_free_analyses),
    'remaining_paid_analyses', remaining_paid_analyses,
    'total_amount_due', usage_record.total_amount_due,
    'payment_status', usage_record.payment_status,
    'year', current_year,
    'month', current_month
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update increment_analysis_count to consume paid analyses when free analyses are exhausted
CREATE OR REPLACE FUNCTION increment_analysis_count()
RETURNS JSONB AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM NOW());
  current_month INTEGER := EXTRACT(MONTH FROM NOW());
  usage_record user_monthly_usage;
  free_limit INTEGER;
  additional_price DECIMAL;
  billing_enabled BOOLEAN;
  current_total_analyses INTEGER := 0;
  user_workshop_id UUID;
  is_free_analysis BOOLEAN := FALSE;
  amount_to_charge DECIMAL := 0;
  paid_analysis_consumed BOOLEAN := FALSE;
  remaining_paid_analyses INTEGER := 0;
BEGIN
  -- Obtener configuraciones del sistema
  SELECT (get_system_setting('monthly_free_analyses_limit')->>'value')::INTEGER INTO free_limit;
  SELECT (get_system_setting('additional_analysis_price')->>'value')::DECIMAL INTO additional_price;
  SELECT (get_system_setting('billing_enabled')->>'value')::BOOLEAN INTO billing_enabled;
  
  -- Obtener el workshop_id del usuario actual
  SELECT workshop_id INTO user_workshop_id 
  FROM profiles 
  WHERE id = auth.uid();
  
  -- Contar análisis reales del mes actual
  SELECT COUNT(*) INTO current_total_analyses
  FROM analysis 
  WHERE workshop_id = user_workshop_id
    AND EXTRACT(YEAR FROM created_at) = current_year
    AND EXTRACT(MONTH FROM created_at) = current_month;
  
  -- Determinar si este análisis es gratuito, de pago con balance, o requiere pago
  IF current_total_analyses < free_limit THEN
    -- Análisis gratuito
    is_free_analysis := TRUE;
  ELSE
    -- Análisis de pago - intentar consumir del balance primero
    SELECT consume_paid_analysis(auth.uid()) INTO paid_analysis_consumed;
    
    IF paid_analysis_consumed THEN
      -- Se consumió un análisis del balance pagado
      is_free_analysis := FALSE;
      amount_to_charge := 0;
    ELSE
      -- No hay balance pagado, cobrar si la facturación está habilitada
      IF billing_enabled THEN
        amount_to_charge := additional_price;
      END IF;
    END IF;
  END IF;
  
  -- Obtener o crear registro de uso mensual
  SELECT * INTO usage_record FROM get_or_create_monthly_usage(current_year, current_month);
  
  -- Solo actualizar el total_amount_due si hay cargo
  IF amount_to_charge > 0 THEN
    UPDATE user_monthly_usage 
    SET 
      total_amount_due = total_amount_due + amount_to_charge,
      updated_at = NOW()
    WHERE user_id = auth.uid() 
      AND year = current_year 
      AND month = current_month;
  END IF;
  
  -- Obtener análisis pagados restantes después de la operación
  SELECT remaining_analyses INTO remaining_paid_analyses
  FROM get_paid_analyses_balance(auth.uid())
  LIMIT 1;
  
  IF remaining_paid_analyses IS NULL THEN
    remaining_paid_analyses := 0;
  END IF;
  
  -- Retornar información sobre el análisis
  RETURN jsonb_build_object(
    'is_free', is_free_analysis,
    'paid_analysis_consumed', paid_analysis_consumed,
    'amount_charged', amount_to_charge,
    'total_analyses', current_total_analyses + 1,
    'free_analyses_used', LEAST(current_total_analyses + 1, free_limit),
    'free_analyses_limit', free_limit,
    'remaining_paid_analyses', remaining_paid_analyses
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can create analysis (considering both free and paid analyses)
CREATE OR REPLACE FUNCTION can_user_create_analysis()
RETURNS JSONB AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM NOW());
  current_month INTEGER := EXTRACT(MONTH FROM NOW());
  free_limit INTEGER;
  billing_enabled BOOLEAN;
  current_total_analyses INTEGER := 0;
  user_workshop_id UUID;
  remaining_paid_analyses INTEGER := 0;
  can_create BOOLEAN := FALSE;
  reason TEXT := '';
BEGIN
  -- Obtener configuraciones del sistema
  SELECT (get_system_setting('monthly_free_analyses_limit')->>'value')::INTEGER INTO free_limit;
  SELECT (get_system_setting('billing_enabled')->>'value')::BOOLEAN INTO billing_enabled;
  
  -- Obtener el workshop_id del usuario actual
  SELECT workshop_id INTO user_workshop_id 
  FROM profiles 
  WHERE id = auth.uid();
  
  -- Contar análisis reales del mes actual
  SELECT COUNT(*) INTO current_total_analyses
  FROM analysis 
  WHERE workshop_id = user_workshop_id
    AND EXTRACT(YEAR FROM created_at) = current_year
    AND EXTRACT(MONTH FROM created_at) = current_month;
  
  -- Obtener análisis pagados restantes
  SELECT remaining_analyses INTO remaining_paid_analyses
  FROM get_paid_analyses_balance(auth.uid())
  LIMIT 1;
  
  IF remaining_paid_analyses IS NULL THEN
    remaining_paid_analyses := 0;
  END IF;
  
  -- Determinar si puede crear análisis
  IF current_total_analyses < free_limit THEN
    -- Tiene análisis gratuitos disponibles
    can_create := TRUE;
    reason := 'free_analysis_available';
  ELSIF remaining_paid_analyses > 0 THEN
    -- Tiene análisis pagados disponibles
    can_create := TRUE;
    reason := 'paid_analysis_available';
  ELSIF billing_enabled THEN
    -- Puede pagar por análisis adicional
    can_create := TRUE;
    reason := 'payment_required';
  ELSE
    -- No puede crear más análisis
    can_create := FALSE;
    reason := 'limit_reached_billing_disabled';
  END IF;
  
  RETURN jsonb_build_object(
    'can_create', can_create,
    'reason', reason,
    'free_analyses_used', LEAST(current_total_analyses, free_limit),
    'free_analyses_limit', free_limit,
    'remaining_free_analyses', GREATEST(0, free_limit - current_total_analyses),
    'remaining_paid_analyses', remaining_paid_analyses,
    'billing_enabled', billing_enabled
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for the new function
GRANT EXECUTE ON FUNCTION can_user_create_analysis() TO authenticated;

-- Source: 20250123_create_analysis_packages.sql
-- Crear tabla de paquetes de análisis
CREATE TABLE IF NOT EXISTS analysis_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    analyses_count INTEGER NOT NULL CHECK (analyses_count > 0),
    price_per_analysis DECIMAL(10,2) NOT NULL CHECK (price_per_analysis > 0),
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price > 0),
    discount_percentage DECIMAL(5,2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices
CREATE INDEX idx_analysis_packages_active ON analysis_packages(is_active);
CREATE INDEX idx_analysis_packages_sort_order ON analysis_packages(sort_order);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_analysis_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_analysis_packages_updated_at
    BEFORE UPDATE ON analysis_packages
    FOR EACH ROW
    EXECUTE FUNCTION update_analysis_packages_updated_at();

-- Insertar paquetes predefinidos
INSERT INTO analysis_packages (name, description, analyses_count, price_per_analysis, total_price, discount_percentage, sort_order) VALUES
('Análisis Individual', 'Compra un análisis individual', 1, 15.00, 15.00, 0, 1),
('Paquete Básico', 'Paquete de 10 análisis con 5% de descuento', 10, 14.25, 142.50, 5, 2),
('Paquete Estándar', 'Paquete de 50 análisis con 10% de descuento', 50, 13.50, 675.00, 10, 3),
('Paquete Premium', 'Paquete de 100 análisis con 15% de descuento', 100, 12.75, 1275.00, 15, 4),
('Paquete Empresarial', 'Paquete de 500 análisis con 20% de descuento', 500, 12.00, 6000.00, 20, 5);

-- Función para obtener paquetes activos
CREATE OR REPLACE FUNCTION get_active_analysis_packages()
RETURNS TABLE (
    id UUID,
    name VARCHAR(100),
    description TEXT,
    analyses_count INTEGER,
    price_per_analysis DECIMAL(10,2),
    total_price DECIMAL(10,2),
    discount_percentage DECIMAL(5,2),
    sort_order INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.description,
        p.analyses_count,
        p.price_per_analysis,
        p.total_price,
        p.discount_percentage,
        p.sort_order
    FROM analysis_packages p
    WHERE p.is_active = true
    ORDER BY p.sort_order ASC;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener un paquete por ID
CREATE OR REPLACE FUNCTION get_analysis_package_by_id(package_id UUID)
RETURNS TABLE (
    id UUID,
    name VARCHAR(100),
    description TEXT,
    analyses_count INTEGER,
    price_per_analysis DECIMAL(10,2),
    total_price DECIMAL(10,2),
    discount_percentage DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.description,
        p.analyses_count,
        p.price_per_analysis,
        p.total_price,
        p.discount_percentage
    FROM analysis_packages p
    WHERE p.id = package_id AND p.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Políticas RLS
ALTER TABLE analysis_packages ENABLE ROW LEVEL SECURITY;

-- Política para lectura (todos pueden ver paquetes activos)
CREATE POLICY "Anyone can view active analysis packages" ON analysis_packages
    FOR SELECT USING (is_active = true);

-- Política para administradores (pueden hacer todo)
CREATE POLICY "Admins can manage analysis packages" ON analysis_packages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Comentarios
COMMENT ON TABLE analysis_packages IS 'Tabla que almacena los diferentes paquetes de análisis disponibles para compra';
COMMENT ON COLUMN analysis_packages.analyses_count IS 'Número de análisis incluidos en el paquete';
COMMENT ON COLUMN analysis_packages.price_per_analysis IS 'Precio por análisis individual en este paquete';
COMMENT ON COLUMN analysis_packages.total_price IS 'Precio total del paquete';
COMMENT ON COLUMN analysis_packages.discount_percentage IS 'Porcentaje de descuento aplicado respecto al precio individual';

-- Source: 20250124_add_missing_package_functions.sql
-- Crear función get_active_packages (alias para get_active_analysis_packages)
CREATE OR REPLACE FUNCTION get_active_packages()
RETURNS TABLE (
    id UUID,
    name VARCHAR(100),
    description TEXT,
    analyses_count INTEGER,
    price_per_analysis DECIMAL(10,2),
    total_price DECIMAL(10,2),
    discount_percentage DECIMAL(5,2),
    sort_order INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.description,
        p.analyses_count,
        p.price_per_analysis,
        p.total_price,
        p.discount_percentage,
        p.sort_order
    FROM analysis_packages p
    WHERE p.is_active = true
    ORDER BY p.sort_order ASC;
END;
$$ LANGUAGE plpgsql;

-- Crear función get_package_by_id (alias para get_analysis_package_by_id)
CREATE OR REPLACE FUNCTION get_package_by_id(package_id UUID)
RETURNS TABLE (
    id UUID,
    name VARCHAR(100),
    description TEXT,
    analyses_count INTEGER,
    price_per_analysis DECIMAL(10,2),
    total_price DECIMAL(10,2),
    discount_percentage DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.description,
        p.analyses_count,
        p.price_per_analysis,
        p.total_price,
        p.discount_percentage
    FROM analysis_packages p
    WHERE p.id = package_id AND p.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Source: 20250124_fix_package_type_constraint.sql
-- Fix package_type constraint to match actual packages
ALTER TABLE user_paid_analyses_balance 
DROP CONSTRAINT IF EXISTS user_paid_analyses_balance_package_type_check;

ALTER TABLE user_paid_analyses_balance 
ADD CONSTRAINT user_paid_analyses_balance_package_type_check 
CHECK (package_type IN ('individual', 'basic', 'professional', 'enterprise'));

-- Source: 20250125_add_analysis_trigger.sql
-- Add trigger to automatically call increment_analysis_count when an analysis is created
-- This ensures that paid analyses are properly decremented from user balance

CREATE OR REPLACE FUNCTION trigger_increment_analysis_count()
RETURNS TRIGGER AS $$
DECLARE
  analysis_result JSONB;
BEGIN
  -- Call increment_analysis_count to handle the analysis counting logic
  -- This will consume paid analyses if available, or handle billing
  SELECT increment_analysis_count() INTO analysis_result;
  
  -- Log the result for debugging (optional)
  RAISE LOG 'Analysis count incremented for user %: %', auth.uid(), analysis_result;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires AFTER INSERT on analysis table
CREATE TRIGGER trigger_analysis_count_increment
  AFTER INSERT ON analysis
  FOR EACH ROW
  EXECUTE FUNCTION trigger_increment_analysis_count();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION trigger_increment_analysis_count() TO authenticated;

-- Source: 20250125_cleanup_create_payment_record_overloads.sql
-- Cleanup create_payment_record function overloads
-- Remove all existing versions and keep only the most recent one

-- Drop all existing versions of create_payment_record
DROP FUNCTION IF EXISTS create_payment_record(
  workshop_id_param UUID,
  user_id_param UUID,
  stripe_payment_intent_id_param TEXT,
  stripe_session_id_param TEXT,
  amount_cents_param INTEGER,
  currency_param TEXT,
  analysis_month_param TEXT,
  description_param TEXT
);

DROP FUNCTION IF EXISTS create_payment_record(
  user_id_param UUID,
  workshop_id_param UUID,
  stripe_payment_intent_id_param TEXT,
  stripe_session_id_param TEXT,
  amount_cents_param INTEGER,
  currency_param TEXT,
  analysis_month_param TEXT,
  analyses_purchased_param INTEGER,
  unit_price_cents_param INTEGER,
  description_param TEXT,
  stripe_customer_id_param TEXT
);

DROP FUNCTION IF EXISTS create_payment_record(
  workshop_id_param UUID,
  user_id_param UUID,
  stripe_payment_intent_id_param TEXT,
  stripe_session_id_param TEXT,
  stripe_customer_id_param TEXT,
  amount_cents_param INTEGER,
  currency_param TEXT,
  analysis_month_param TEXT,
  description_param TEXT
);

-- Create the final version of create_payment_record
CREATE OR REPLACE FUNCTION create_payment_record(
  workshop_id_param UUID,
  user_id_param UUID,
  stripe_payment_intent_id_param TEXT,
  stripe_session_id_param TEXT,
  amount_cents_param INTEGER,
  stripe_customer_id_param TEXT DEFAULT NULL,
  currency_param TEXT DEFAULT 'EUR',
  analysis_month_param TEXT DEFAULT NULL,
  description_param TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  payment_id UUID;
  current_month TEXT;
BEGIN
  -- Usar el mes actual si no se proporciona
  current_month := COALESCE(analysis_month_param, TO_CHAR(NOW(), 'YYYY-MM'));
  
  -- Insertar registro de pago
  INSERT INTO payments (
    workshop_id,
    user_id,
    stripe_payment_intent_id,
    stripe_session_id,
    stripe_customer_id,
    amount_cents,
    currency,
    status,
    analysis_month,
    analyses_purchased,
    unit_price_cents,
    description
  ) VALUES (
    workshop_id_param,
    user_id_param,
    stripe_payment_intent_id_param,
    stripe_session_id_param,
    stripe_customer_id_param,
    amount_cents_param,
    currency_param,
    'pending',
    current_month,
    1, -- Por defecto 1 análisis
    amount_cents_param, -- Por ahora el precio unitario es igual al total
    description_param
  ) RETURNING id INTO payment_id;

  RETURN payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: 20250125_create_payment_balance_trigger.sql
-- Trigger automático para registrar balance cuando un payment se completa
-- Este trigger se ejecuta cuando el status de un payment cambia a 'completed'

CREATE OR REPLACE FUNCTION trigger_add_paid_analyses_on_payment_completion()
RETURNS TRIGGER AS $$
DECLARE
  package_data RECORD;
  analyses_to_add INTEGER := 0;
  package_type_value VARCHAR(50) := 'individual';
  amount_paid_euros DECIMAL;
  analysis_price DECIMAL;
BEGIN
  -- Solo procesar si el status cambió a 'completed' y antes no era 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    RAISE LOG 'Payment completion trigger fired for payment_id: %, user_id: %', NEW.id, NEW.user_id;
    
    -- Convertir amount_cents a euros
    amount_paid_euros := NEW.amount_cents / 100.0;
    
    -- Intentar obtener datos del paquete desde los metadatos de Stripe
    -- Primero buscar por package_id si existe en description o metadata
    IF NEW.description IS NOT NULL AND NEW.description LIKE '%package_id:%' THEN
      -- Extraer package_id de la descripción (formato: "package_id:uuid")
      DECLARE
        package_id_text TEXT;
        package_uuid UUID;
      BEGIN
        package_id_text := substring(NEW.description from 'package_id:([a-f0-9-]+)');
        package_uuid := package_id_text::UUID;
        
        SELECT * INTO package_data
        FROM analysis_packages
        WHERE id = package_uuid AND is_active = true;
        
        IF FOUND THEN
          analyses_to_add := package_data.analyses_count;
          package_type_value := CASE 
            WHEN package_data.analyses_count = 1 THEN 'individual'
            WHEN package_data.analyses_count <= 10 THEN 'basic'
            WHEN package_data.analyses_count <= 50 THEN 'professional'
            ELSE 'enterprise'
          END;
          RAISE LOG 'Found package data: % analyses, type: %', analyses_to_add, package_type_value;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'Error parsing package_id from description: %', SQLERRM;
      END;
    END IF;
    
    -- Si no encontramos paquete, usar fallback basado en analyses_purchased
    IF analyses_to_add = 0 AND NEW.analyses_purchased IS NOT NULL AND NEW.analyses_purchased > 0 THEN
      analyses_to_add := NEW.analyses_purchased;
      package_type_value := CASE 
        WHEN analyses_to_add = 1 THEN 'individual'
        WHEN analyses_to_add <= 10 THEN 'basic'
        WHEN analyses_to_add <= 50 THEN 'professional'
        ELSE 'enterprise'
      END;
      RAISE LOG 'Using analyses_purchased fallback: % analyses, type: %', analyses_to_add, package_type_value;
    END IF;
    
    -- Si aún no tenemos análisis, calcular basado en precio del sistema
    IF analyses_to_add = 0 THEN
      SELECT (setting_value->>'value')::DECIMAL INTO analysis_price
      FROM system_settings
      WHERE setting_key = 'additional_analysis_price';
      
      IF analysis_price IS NOT NULL AND analysis_price > 0 THEN
        analyses_to_add := GREATEST(1, FLOOR(amount_paid_euros / analysis_price));
        package_type_value := 'individual';
        RAISE LOG 'Using price-based fallback: % analyses (%.2f / %.2f)', analyses_to_add, amount_paid_euros, analysis_price;
      ELSE
        -- Último fallback: 1 análisis por cada 15 euros
        analyses_to_add := GREATEST(1, FLOOR(amount_paid_euros / 15.0));
        package_type_value := 'individual';
        RAISE LOG 'Using final fallback: % analyses (%.2f / 15.0)', analyses_to_add, amount_paid_euros;
      END IF;
    END IF;
    
    -- Llamar a add_paid_analyses si tenemos análisis que añadir
    IF analyses_to_add > 0 THEN
      RAISE LOG 'Calling add_paid_analyses with: user_id=%, analyses_count=%, package_type=%, payment_intent_id=%, amount_paid=%.2f', 
        NEW.user_id, analyses_to_add, package_type_value, NEW.stripe_payment_intent_id, amount_paid_euros;
      
      PERFORM add_paid_analyses(
        p_user_id := NEW.user_id,
        p_analyses_count := analyses_to_add,
        p_package_type := package_type_value,
        p_stripe_payment_intent_id := NEW.stripe_payment_intent_id,
        p_amount_paid := amount_paid_euros
      );
      
      RAISE LOG 'Successfully added % paid analyses for user %', analyses_to_add, NEW.user_id;
    ELSE
      RAISE LOG 'No analyses to add for payment %', NEW.id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger que se ejecuta AFTER UPDATE en la tabla payments
CREATE TRIGGER trigger_payment_completion_add_balance
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_add_paid_analyses_on_payment_completion();

-- Grant permissions
GRANT EXECUTE ON FUNCTION trigger_add_paid_analyses_on_payment_completion() TO authenticated;

-- Comentarios
COMMENT ON FUNCTION trigger_add_paid_analyses_on_payment_completion() IS 'Trigger function que automáticamente añade análisis pagados al balance del usuario cuando un payment se completa';
COMMENT ON TRIGGER trigger_payment_completion_add_balance ON payments IS 'Trigger que ejecuta add_paid_analyses automáticamente cuando un payment cambia a status completed';

-- Source: 20250125_fix_update_payment_status_session_id.sql
-- Corregir la función update_payment_status para que funcione con session_id y devuelva user_id
-- Esta función es necesaria para que el webhook de Stripe pueda continuar con add_paid_analyses

CREATE OR REPLACE FUNCTION update_payment_status(
  session_id_param TEXT,
  new_status TEXT,
  payment_method_param TEXT DEFAULT NULL,
  stripe_fee_cents_param INTEGER DEFAULT NULL,
  net_amount_cents_param INTEGER DEFAULT NULL,
  stripe_customer_id_param TEXT DEFAULT NULL
)
RETURNS TABLE(user_id UUID, payment_id UUID) AS $$
DECLARE
  payment_record payments;
BEGIN
  -- Actualizar el estado del pago usando session_id
  UPDATE payments 
  SET 
    status = new_status,
    payment_method = COALESCE(payment_method_param, payment_method),
    stripe_fee_cents = COALESCE(stripe_fee_cents_param, stripe_fee_cents),
    stripe_customer_id = COALESCE(stripe_customer_id_param, stripe_customer_id),
    net_amount_cents = COALESCE(net_amount_cents_param, net_amount_cents),
    paid_at = CASE WHEN new_status = 'completed' THEN NOW() ELSE paid_at END,
    updated_at = NOW()
  WHERE stripe_session_id = session_id_param
  RETURNING * INTO payment_record;
  
  -- Si encontramos el pago, devolver user_id y payment_id
  IF payment_record.id IS NOT NULL THEN
    -- Si el pago fue exitoso, actualizar el estado en user_monthly_usage
    IF new_status = 'completed' THEN
      PERFORM mark_payment_completed(payment_record.stripe_payment_intent_id);
    END IF;
    
    -- Devolver los datos necesarios para el webhook
    RETURN QUERY SELECT payment_record.user_id, payment_record.id;
  ELSE
    -- Si no se encontró el pago, devolver NULL
    RETURN QUERY SELECT NULL::UUID, NULL::UUID;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: 20250125_fix_user_paid_analyses_balance_fkey.sql
-- Fix foreign key constraint in user_paid_analyses_balance to point to auth.users instead of public.users

-- Drop the incorrect foreign key constraint
ALTER TABLE user_paid_analyses_balance 
DROP CONSTRAINT user_paid_analyses_balance_user_id_fkey;

-- Add the correct foreign key constraint pointing to auth.users
ALTER TABLE user_paid_analyses_balance 
ADD CONSTRAINT user_paid_analyses_balance_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Source: 20250125_update_trigger_with_package_id.sql
-- Actualizar el trigger para usar correctamente el campo package_id
-- Esta migración reemplaza la lógica anterior que parseaba la descripción

CREATE OR REPLACE FUNCTION trigger_add_paid_analyses_on_payment_completion()
RETURNS TRIGGER AS $$
DECLARE
    package_data RECORD;
    analyses_to_add INTEGER;
    package_type VARCHAR(50);
    amount_paid DECIMAL(10,2);
BEGIN
    -- Solo procesar si el estado cambió a 'completed'
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        
        -- Calcular el monto pagado en euros (convertir de centavos)
        amount_paid := NEW.amount_cents / 100.0;
        
        -- Si tenemos package_id, obtener datos del paquete directamente
        IF NEW.package_id IS NOT NULL THEN
            SELECT 
                name,
                analyses_count
            INTO package_data
            FROM analysis_packages 
            WHERE id = NEW.package_id AND is_active = true;
            
            IF FOUND THEN
                analyses_to_add := package_data.analyses_count;
                package_type := package_data.name;
                
                RAISE LOG 'Trigger: Usando package_id %, paquete: %, análisis: %', 
                    NEW.package_id, package_type, analyses_to_add;
            ELSE
                RAISE LOG 'Trigger: Package_id % no encontrado o inactivo', NEW.package_id;
                -- Fallback: usar analyses_purchased del payment
                analyses_to_add := COALESCE(NEW.analyses_purchased, 1);
                package_type := 'Paquete no encontrado';
            END IF;
        ELSE
            -- Fallback: usar analyses_purchased del payment
            analyses_to_add := COALESCE(NEW.analyses_purchased, 1);
            package_type := 'Sin package_id';
            
            RAISE LOG 'Trigger: Sin package_id, usando analyses_purchased: %', analyses_to_add;
        END IF;
        
        -- Llamar a la función add_paid_analyses
        BEGIN
            PERFORM add_paid_analyses(
                p_user_id := NEW.user_id,
                p_analyses_count := analyses_to_add,
                p_package_type := package_type,
                p_stripe_payment_intent_id := NEW.stripe_payment_intent_id,
                p_amount_paid := amount_paid
            );
            
            RAISE LOG 'Trigger: add_paid_analyses ejecutado exitosamente para user_id: %, análisis: %, tipo: %', 
                NEW.user_id, analyses_to_add, package_type;
                
        EXCEPTION WHEN OTHERS THEN
            RAISE LOG 'Trigger: Error al ejecutar add_paid_analyses: %', SQLERRM;
            -- No re-lanzar el error para evitar que falle la transacción del payment
        END;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario actualizado
COMMENT ON FUNCTION trigger_add_paid_analyses_on_payment_completion() IS 'Trigger function que automáticamente añade análisis pagados al balance del usuario cuando un payment se completa. Utiliza el campo package_id para obtener datos exactos del paquete.';

-- Source: 20250127_add_valuation_date_to_analysis.sql
-- Add valuation_date and analysis_date fields to analysis table
ALTER TABLE analysis 
ADD COLUMN IF NOT EXISTS valuation_date DATE,
ADD COLUMN IF NOT EXISTS analysis_date DATE;

-- Add index for efficient queries on valuation_date
CREATE INDEX IF NOT EXISTS idx_analysis_valuation_date ON analysis(valuation_date);
CREATE INDEX IF NOT EXISTS idx_analysis_analysis_date ON analysis(analysis_date);

-- Source: 20250128_add_spare_parts_quantity.sql
-- Agregar campo de cantidad de repuestos a la tabla insurance_amounts
ALTER TABLE insurance_amounts
ADD COLUMN spare_parts_quantity INTEGER;

COMMENT ON COLUMN insurance_amounts.spare_parts_quantity IS 'Cantidad total de ítems/elementos de repuestos extraídos del PDF';

