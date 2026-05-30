-- ============================================================
-- MÓDULO RUTINAS — ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Tabla rutinas
CREATE TABLE IF NOT EXISTS public.rutinas (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entrenador_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  descripcion   TEXT,
  nivel         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.rutinas ENABLE ROW LEVEL SECURITY;

-- 2. Tabla ejercicios
CREATE TABLE IF NOT EXISTS public.ejercicios (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rutina_id     UUID NOT NULL REFERENCES public.rutinas(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  series        INTEGER,
  repeticiones  TEXT,
  notas         TEXT,
  orden         INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ejercicios ENABLE ROW LEVEL SECURITY;

-- 3. Tabla rutina_alumnos
CREATE TABLE IF NOT EXISTS public.rutina_alumnos (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rutina_id        UUID NOT NULL REFERENCES public.rutinas(id) ON DELETE CASCADE,
  alumno_id        UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  fecha_asignacion DATE DEFAULT CURRENT_DATE,
  activa           BOOLEAN DEFAULT true,
  CONSTRAINT unique_rutina_alumno UNIQUE (rutina_id, alumno_id)
);
ALTER TABLE public.rutina_alumnos ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RPCs (SECURITY DEFINER — bypasean RLS)
-- ============================================================

-- get_mis_rutinas: lista de rutinas del entrenador con count de ejercicios
CREATE OR REPLACE FUNCTION public.get_mis_rutinas()
RETURNS TABLE(id UUID, nombre TEXT, descripcion TEXT, nivel TEXT, num_ejercicios BIGINT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.nombre, r.descripcion, r.nivel,
    COUNT(e.id) AS num_ejercicios,
    r.created_at
  FROM public.rutinas r
  LEFT JOIN public.ejercicios e ON e.rutina_id = r.id
  WHERE r.entrenador_id = auth.uid()
  GROUP BY r.id
  ORDER BY r.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_mis_rutinas() TO authenticated;

-- get_rutina: una rutina con sus ejercicios como JSONB
CREATE OR REPLACE FUNCTION public.get_rutina(p_id UUID)
RETURNS TABLE(id UUID, nombre TEXT, descripcion TEXT, nivel TEXT, created_at TIMESTAMPTZ, ejercicios JSONB)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.nombre, r.descripcion, r.nivel, r.created_at,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'nombre', e.nombre,
          'series', e.series,
          'repeticiones', e.repeticiones,
          'notas', e.notas,
          'orden', e.orden
        ) ORDER BY e.orden, e.created_at
      ) FROM public.ejercicios e WHERE e.rutina_id = r.id),
      '[]'::jsonb
    ) AS ejercicios
  FROM public.rutinas r
  WHERE r.id = p_id AND r.entrenador_id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_rutina(UUID) TO authenticated;

-- crear_rutina: crea y devuelve el id
CREATE OR REPLACE FUNCTION public.crear_rutina(p_nombre TEXT, p_descripcion TEXT, p_nivel TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.rutinas (entrenador_id, nombre, descripcion, nivel)
  VALUES (auth.uid(), p_nombre, p_descripcion, p_nivel)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.crear_rutina(TEXT, TEXT, TEXT) TO authenticated;

-- actualizar_rutina
CREATE OR REPLACE FUNCTION public.actualizar_rutina(p_id UUID, p_nombre TEXT, p_descripcion TEXT, p_nivel TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.rutinas
  SET nombre = p_nombre, descripcion = p_descripcion, nivel = p_nivel
  WHERE id = p_id AND entrenador_id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.actualizar_rutina(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- eliminar_rutina
CREATE OR REPLACE FUNCTION public.eliminar_rutina(p_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.rutinas WHERE id = p_id AND entrenador_id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.eliminar_rutina(UUID) TO authenticated;

-- agregar_ejercicio
CREATE OR REPLACE FUNCTION public.agregar_ejercicio(
  p_rutina_id UUID, p_nombre TEXT, p_series INTEGER, p_repeticiones TEXT, p_notas TEXT, p_orden INTEGER
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.rutinas WHERE id = p_rutina_id AND entrenador_id = auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  INSERT INTO public.ejercicios (rutina_id, nombre, series, repeticiones, notas, orden)
  VALUES (p_rutina_id, p_nombre, p_series, p_repeticiones, p_notas, p_orden)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.agregar_ejercicio(UUID, TEXT, INTEGER, TEXT, TEXT, INTEGER) TO authenticated;

-- actualizar_ejercicio
CREATE OR REPLACE FUNCTION public.actualizar_ejercicio(
  p_id UUID, p_nombre TEXT, p_series INTEGER, p_repeticiones TEXT, p_notas TEXT, p_orden INTEGER
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.ejercicios e
  SET nombre = p_nombre, series = p_series, repeticiones = p_repeticiones, notas = p_notas, orden = p_orden
  FROM public.rutinas r
  WHERE e.id = p_id AND e.rutina_id = r.id AND r.entrenador_id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.actualizar_ejercicio(UUID, TEXT, INTEGER, TEXT, TEXT, INTEGER) TO authenticated;

-- eliminar_ejercicio
CREATE OR REPLACE FUNCTION public.eliminar_ejercicio(p_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.ejercicios e
  USING public.rutinas r
  WHERE e.id = p_id AND e.rutina_id = r.id AND r.entrenador_id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.eliminar_ejercicio(UUID) TO authenticated;

-- asignar_rutina: con ON CONFLICT para manejar re-asignaciones
CREATE OR REPLACE FUNCTION public.asignar_rutina(p_rutina_id UUID, p_alumno_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.rutinas WHERE id = p_rutina_id AND entrenador_id = auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  INSERT INTO public.rutina_alumnos (rutina_id, alumno_id, activa)
  VALUES (p_rutina_id, p_alumno_id, true)
  ON CONFLICT (rutina_id, alumno_id) DO UPDATE SET activa = true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.asignar_rutina(UUID, UUID) TO authenticated;

-- desasignar_rutina
CREATE OR REPLACE FUNCTION public.desasignar_rutina(p_rutina_id UUID, p_alumno_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.rutina_alumnos
  WHERE rutina_id = p_rutina_id AND alumno_id = p_alumno_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.desasignar_rutina(UUID, UUID) TO authenticated;

-- get_alumnos_rutina: alumnos asignados a una rutina
CREATE OR REPLACE FUNCTION public.get_alumnos_rutina(p_rutina_id UUID)
RETURNS TABLE(alumno_id UUID, nombre TEXT, email TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, pr.nombre, pr.email
  FROM public.rutina_alumnos ra
  JOIN public.alumnos a ON a.id = ra.alumno_id
  JOIN public.profiles pr ON pr.id = a.profile_id
  WHERE ra.rutina_id = p_rutina_id AND ra.activa = true
  ORDER BY pr.nombre;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_alumnos_rutina(UUID) TO authenticated;

-- get_rutina_alumno: rutina activa de un alumno
CREATE OR REPLACE FUNCTION public.get_rutina_alumno(p_alumno_id UUID)
RETURNS TABLE(rutina_id UUID, nombre TEXT, descripcion TEXT, nivel TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.nombre, r.descripcion, r.nivel
  FROM public.rutina_alumnos ra
  JOIN public.rutinas r ON r.id = ra.rutina_id
  WHERE ra.alumno_id = p_alumno_id AND ra.activa = true
  LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_rutina_alumno(UUID) TO authenticated;
