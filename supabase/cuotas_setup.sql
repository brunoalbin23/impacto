-- ============================================================
-- MÓDULO CUOTAS — ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Tabla planes (si ya existe con duracion_dias, este CREATE se saltea)
CREATE TABLE IF NOT EXISTS public.planes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre        TEXT NOT NULL,
  descripcion   TEXT,
  duracion_dias INTEGER,
  precio        NUMERIC(10,2),
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;


-- 2. Tabla cuotas
CREATE TABLE IF NOT EXISTS public.cuotas (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alumno_id         UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  plan_id           UUID REFERENCES public.planes(id) ON DELETE SET NULL,
  fecha_vencimiento DATE NOT NULL,
  monto             NUMERIC(10,2) NOT NULL,
  metodo_pago       TEXT NOT NULL DEFAULT 'efectivo',
  estado            TEXT NOT NULL DEFAULT 'pendiente',
  fecha_pago        DATE,
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cuotas ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 3. RPCs (SECURITY DEFINER — bypasean RLS)
-- ============================================================

-- get_planes: lista de planes disponibles
CREATE OR REPLACE FUNCTION public.get_planes()
RETURNS TABLE (id UUID, nombre TEXT, precio NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.nombre, p.precio FROM public.planes p ORDER BY p.nombre;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_planes() TO authenticated;


-- get_cuotas_entrenador: todas las cuotas del entrenador autenticado
CREATE OR REPLACE FUNCTION public.get_cuotas_entrenador()
RETURNS TABLE (
  id                UUID,
  alumno_id         UUID,
  alumno_nombre     TEXT,
  plan_id           UUID,
  plan_nombre       TEXT,
  fecha_vencimiento DATE,
  monto             NUMERIC,
  metodo_pago       TEXT,
  estado            TEXT,
  fecha_pago        DATE,
  created_at        TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.alumno_id,
    pr.nombre   AS alumno_nombre,
    c.plan_id,
    pl.nombre   AS plan_nombre,
    c.fecha_vencimiento,
    c.monto,
    c.metodo_pago,
    c.estado,
    c.fecha_pago,
    c.created_at
  FROM public.cuotas c
  JOIN public.alumnos a  ON a.id  = c.alumno_id
  JOIN public.profiles pr ON pr.id = a.profile_id
  LEFT JOIN public.planes pl ON pl.id = c.plan_id
  WHERE a.entrenador_id = auth.uid()
  ORDER BY c.fecha_vencimiento ASC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_cuotas_entrenador() TO authenticated;


-- get_cuota: una cuota por id (verifica ownership)
CREATE OR REPLACE FUNCTION public.get_cuota(p_id UUID)
RETURNS TABLE (
  id                UUID,
  alumno_id         UUID,
  alumno_nombre     TEXT,
  plan_id           UUID,
  plan_nombre       TEXT,
  fecha_vencimiento DATE,
  monto             NUMERIC,
  metodo_pago       TEXT,
  estado            TEXT,
  fecha_pago        DATE,
  created_at        TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.alumno_id,
    pr.nombre   AS alumno_nombre,
    c.plan_id,
    pl.nombre   AS plan_nombre,
    c.fecha_vencimiento,
    c.monto,
    c.metodo_pago,
    c.estado,
    c.fecha_pago,
    c.created_at
  FROM public.cuotas c
  JOIN public.alumnos a  ON a.id  = c.alumno_id
  JOIN public.profiles pr ON pr.id = a.profile_id
  LEFT JOIN public.planes pl ON pl.id = c.plan_id
  WHERE c.id = p_id
    AND a.entrenador_id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_cuota(UUID) TO authenticated;


-- crear_cuota
CREATE OR REPLACE FUNCTION public.crear_cuota(
  p_alumno_id         UUID,
  p_plan_id           UUID,
  p_fecha_vencimiento DATE,
  p_monto             NUMERIC,
  p_metodo_pago       TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.alumnos WHERE id = p_alumno_id AND entrenador_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  INSERT INTO public.cuotas (alumno_id, plan_id, fecha_vencimiento, monto, metodo_pago, estado)
  VALUES (p_alumno_id, p_plan_id, p_fecha_vencimiento, p_monto, p_metodo_pago, 'pendiente')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.crear_cuota(UUID, UUID, DATE, NUMERIC, TEXT) TO authenticated;


-- marcar_cuota_pagada
CREATE OR REPLACE FUNCTION public.marcar_cuota_pagada(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.cuotas c
  SET estado = 'pagado', fecha_pago = CURRENT_DATE
  FROM public.alumnos a
  WHERE c.id = p_id
    AND c.alumno_id = a.id
    AND a.entrenador_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No autorizado o cuota no encontrada';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.marcar_cuota_pagada(UUID) TO authenticated;


-- actualizar_cuota
CREATE OR REPLACE FUNCTION public.actualizar_cuota(
  p_id                UUID,
  p_alumno_id         UUID,
  p_plan_id           UUID,
  p_fecha_vencimiento DATE,
  p_monto             NUMERIC,
  p_metodo_pago       TEXT,
  p_estado            TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.cuotas c
  SET
    alumno_id         = p_alumno_id,
    plan_id           = p_plan_id,
    fecha_vencimiento = p_fecha_vencimiento,
    monto             = p_monto,
    metodo_pago       = p_metodo_pago,
    estado            = p_estado
  FROM public.alumnos a
  WHERE c.id = p_id
    AND c.alumno_id = a.id
    AND a.entrenador_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No autorizado o cuota no encontrada';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.actualizar_cuota(UUID, UUID, UUID, DATE, NUMERIC, TEXT, TEXT) TO authenticated;
