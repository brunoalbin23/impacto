-- ============================================================
-- MÓDULO CLASES — ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Tabla clases
CREATE TABLE IF NOT EXISTS public.clases (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entrenador_id UUID NOT NULL,
  nombre        TEXT NOT NULL,
  descripcion   TEXT,
  capacidad_max INTEGER,
  dias_semana   TEXT[] DEFAULT '{}',
  hora_inicio   TIME,
  hora_fin      TIME,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.clases ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 2. RPCs (SECURITY DEFINER — bypasean RLS)
-- ============================================================

-- get_mis_clases: todas las clases del entrenador autenticado
CREATE OR REPLACE FUNCTION public.get_mis_clases()
RETURNS TABLE (
  id            UUID,
  nombre        TEXT,
  descripcion   TEXT,
  capacidad_max INTEGER,
  dias_semana   TEXT[],
  hora_inicio   TIME,
  hora_fin      TIME,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.nombre, c.descripcion, c.capacidad_max,
         c.dias_semana, c.hora_inicio, c.hora_fin, c.created_at
  FROM public.clases c
  WHERE c.entrenador_id = auth.uid()
  ORDER BY c.nombre;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_mis_clases() TO authenticated;


-- get_clase: una clase por id (verifica ownership)
CREATE OR REPLACE FUNCTION public.get_clase(p_id UUID)
RETURNS TABLE (
  id            UUID,
  nombre        TEXT,
  descripcion   TEXT,
  capacidad_max INTEGER,
  dias_semana   TEXT[],
  hora_inicio   TIME,
  hora_fin      TIME,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.nombre, c.descripcion, c.capacidad_max,
         c.dias_semana, c.hora_inicio, c.hora_fin, c.created_at
  FROM public.clases c
  WHERE c.id = p_id AND c.entrenador_id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_clase(UUID) TO authenticated;


-- crear_clase
CREATE OR REPLACE FUNCTION public.crear_clase(
  p_nombre        TEXT,
  p_descripcion   TEXT,
  p_capacidad_max INTEGER,
  p_dias_semana   TEXT[],
  p_hora_inicio   TIME,
  p_hora_fin      TIME
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.clases
    (entrenador_id, nombre, descripcion, capacidad_max, dias_semana, hora_inicio, hora_fin)
  VALUES
    (auth.uid(), p_nombre, p_descripcion, p_capacidad_max, p_dias_semana, p_hora_inicio, p_hora_fin)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.crear_clase(TEXT, TEXT, INTEGER, TEXT[], TIME, TIME) TO authenticated;


-- actualizar_clase
CREATE OR REPLACE FUNCTION public.actualizar_clase(
  p_id            UUID,
  p_nombre        TEXT,
  p_descripcion   TEXT,
  p_capacidad_max INTEGER,
  p_dias_semana   TEXT[],
  p_hora_inicio   TIME,
  p_hora_fin      TIME
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.clases
  SET
    nombre        = p_nombre,
    descripcion   = p_descripcion,
    capacidad_max = p_capacidad_max,
    dias_semana   = p_dias_semana,
    hora_inicio   = p_hora_inicio,
    hora_fin      = p_hora_fin
  WHERE id = p_id AND entrenador_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No autorizado o clase no encontrada';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.actualizar_clase(UUID, TEXT, TEXT, INTEGER, TEXT[], TIME, TIME) TO authenticated;


-- eliminar_clase
CREATE OR REPLACE FUNCTION public.eliminar_clase(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.clases
  WHERE id = p_id AND entrenador_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No autorizado o clase no encontrada';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.eliminar_clase(UUID) TO authenticated;
