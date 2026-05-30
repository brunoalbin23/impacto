-- ============================================================
-- v2: Flujo de registro y aprobación de alumnos
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- 1. Agregar columna estado a profiles (si no existe)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente';

-- 1b. Agregar columna entrenador_id a alumnos (si no existe)
ALTER TABLE public.alumnos
  ADD COLUMN IF NOT EXISTS entrenador_id UUID REFERENCES auth.users(id);

-- 2. Los entrenadores existentes pasan a 'activo' automáticamente
UPDATE public.profiles SET estado = 'activo' WHERE rol = 'entrenador';

-- 3. Actualizar el trigger on_auth_user_created para incluir estado
--    El trigger original solo inserta nombre/email/rol.
--    Reemplazarlo para que nuevos alumnos queden con estado='pendiente'
--    y entrenadores con 'activo' (rol viene en raw_user_meta_data).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol TEXT;
BEGIN
  v_rol := COALESCE(new.raw_user_meta_data->>'rol', 'alumno');
  INSERT INTO public.profiles (id, nombre, email, rol, estado)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'nombre',
    new.email,
    v_rol,
    CASE WHEN v_rol = 'entrenador' THEN 'activo' ELSE 'pendiente' END
  );
  RETURN new;
END;
$$;

-- Asegurarse de que el trigger apunta a la función correcta
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RPCs de solicitudes (SECURITY DEFINER, bypasean RLS)
-- ============================================================

-- 4. get_solicitudes_pendientes — lista de alumnos con estado='pendiente'
CREATE OR REPLACE FUNCTION public.get_solicitudes_pendientes()
RETURNS TABLE(id UUID, nombre TEXT, email TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT p.id, p.nombre, p.email, p.created_at
    FROM public.profiles p
    WHERE p.rol = 'alumno' AND p.estado = 'pendiente'
    ORDER BY p.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_solicitudes_pendientes() TO authenticated;

-- 5. aprobar_alumno — setea estado='activo' e inserta en alumnos
CREATE OR REPLACE FUNCTION public.aprobar_alumno(p_profile_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
    SET estado = 'activo'
    WHERE id = p_profile_id;

  INSERT INTO public.alumnos (
    id, profile_id, entrenador_id, estado, fecha_inicio
  ) VALUES (
    gen_random_uuid(),
    p_profile_id,
    auth.uid(),
    'activo',
    CURRENT_DATE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprobar_alumno(UUID) TO authenticated;

-- 6. rechazar_alumno — setea estado='rechazado'
CREATE OR REPLACE FUNCTION public.rechazar_alumno(p_profile_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
    SET estado = 'rechazado'
    WHERE id = p_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rechazar_alumno(UUID) TO authenticated;
