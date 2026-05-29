-- ============================================================
-- MÓDULO ASISTENCIA — ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Tabla asistencias
CREATE TABLE IF NOT EXISTS public.asistencias (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clase_id   UUID NOT NULL REFERENCES public.clases(id) ON DELETE CASCADE,
  alumno_id  UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  fecha      DATE NOT NULL DEFAULT CURRENT_DATE,
  estado     TEXT NOT NULL DEFAULT 'ausente',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (clase_id, alumno_id, fecha)
);

ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 2. RPCs (SECURITY DEFINER — bypasean RLS)
-- ============================================================

-- get_asistencia_hoy: alumnos activos del entrenador con su estado
-- para una clase y la fecha de hoy. tiene_registro = true si ya fue guardado.
CREATE OR REPLACE FUNCTION public.get_asistencia_hoy(p_clase_id UUID)
RETURNS TABLE (
  alumno_id      UUID,
  nombre         TEXT,
  estado         TEXT,
  tiene_registro BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clases WHERE id = p_clase_id AND entrenador_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
  SELECT
    a.id                            AS alumno_id,
    pr.nombre                       AS nombre,
    COALESCE(asi.estado, 'ausente') AS estado,
    (asi.id IS NOT NULL)            AS tiene_registro
  FROM public.alumnos a
  JOIN public.profiles pr ON pr.id = a.profile_id
  LEFT JOIN public.asistencias asi
    ON asi.alumno_id = a.id
   AND asi.clase_id  = p_clase_id
   AND asi.fecha     = CURRENT_DATE
  WHERE a.entrenador_id = auth.uid()
    AND a.estado        = 'activo'
  ORDER BY pr.nombre;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_asistencia_hoy(UUID) TO authenticated;


-- guardar_asistencia: upsert de todos los registros del día
-- p_registros: [{"alumno_id": "uuid", "estado": "presente|ausente"}, ...]
CREATE OR REPLACE FUNCTION public.guardar_asistencia(
  p_clase_id  UUID,
  p_registros JSONB
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  registro JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clases WHERE id = p_clase_id AND entrenador_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  FOR registro IN SELECT * FROM jsonb_array_elements(p_registros)
  LOOP
    INSERT INTO public.asistencias (clase_id, alumno_id, fecha, estado)
    VALUES (
      p_clase_id,
      (registro->>'alumno_id')::UUID,
      CURRENT_DATE,
      registro->>'estado'
    )
    ON CONFLICT (clase_id, alumno_id, fecha)
    DO UPDATE SET estado = EXCLUDED.estado;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.guardar_asistencia(UUID, JSONB) TO authenticated;


-- get_historial_asistencia: historial completo de un alumno
-- (para usar en el perfil del alumno en versiones futuras)
CREATE OR REPLACE FUNCTION public.get_historial_asistencia(p_alumno_id UUID)
RETURNS TABLE (
  id           UUID,
  clase_id     UUID,
  clase_nombre TEXT,
  fecha        DATE,
  estado       TEXT,
  created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    asi.id,
    asi.clase_id,
    c.nombre   AS clase_nombre,
    asi.fecha,
    asi.estado,
    asi.created_at
  FROM public.asistencias asi
  JOIN public.clases  c ON c.id  = asi.clase_id
  JOIN public.alumnos a ON a.id  = asi.alumno_id
  WHERE asi.alumno_id     = p_alumno_id
    AND a.entrenador_id   = auth.uid()
  ORDER BY asi.fecha DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_historial_asistencia(UUID) TO authenticated;
