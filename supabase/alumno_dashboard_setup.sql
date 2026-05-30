-- ============================================================
-- DASHBOARD ALUMNO — ejecutar en Supabase SQL Editor
-- ============================================================

-- get_dashboard_alumno: rutina activa + cuota más reciente del alumno autenticado
-- Siempre devuelve 1 fila; los campos son NULL si no hay datos.
CREATE OR REPLACE FUNCTION public.get_dashboard_alumno()
RETURNS TABLE(
  alumno_id         UUID,
  rutina_id         UUID,
  rutina_nombre     TEXT,
  rutina_nivel      TEXT,
  rutina_ejercicios JSONB,
  cuota_id          UUID,
  plan_nombre       TEXT,
  cuota_monto       NUMERIC,
  cuota_vencimiento DATE,
  cuota_estado      TEXT,
  cuota_fecha_pago  DATE
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_alumno_id UUID;
BEGIN
  -- Busca el registro de alumnos por profile_id = usuario autenticado
  SELECT a.id INTO v_alumno_id
  FROM public.alumnos a
  WHERE a.profile_id = auth.uid() AND a.estado = 'activo'
  LIMIT 1;

  -- Siempre devuelve 1 fila aunque no haya datos (nulls)
  RETURN QUERY
  WITH rutina_cte AS (
    SELECT r.id, r.nombre, r.nivel,
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
    JOIN public.rutina_alumnos ra ON r.id = ra.rutina_id
    WHERE ra.alumno_id = v_alumno_id AND ra.activa = true
    LIMIT 1
  ),
  cuota_cte AS (
    SELECT c.id, pl.nombre AS plan_nombre, c.monto,
      c.fecha_vencimiento, c.estado, c.fecha_pago
    FROM public.cuotas c
    LEFT JOIN public.planes pl ON pl.id = c.plan_id
    WHERE c.alumno_id = v_alumno_id
    ORDER BY c.created_at DESC
    LIMIT 1
  )
  SELECT
    v_alumno_id,
    (SELECT id          FROM rutina_cte),
    (SELECT nombre      FROM rutina_cte),
    (SELECT nivel       FROM rutina_cte),
    COALESCE((SELECT ejercicios FROM rutina_cte), '[]'::jsonb),
    (SELECT id          FROM cuota_cte),
    (SELECT plan_nombre FROM cuota_cte),
    (SELECT monto       FROM cuota_cte),
    (SELECT fecha_vencimiento FROM cuota_cte),
    (SELECT estado      FROM cuota_cte),
    (SELECT fecha_pago  FROM cuota_cte)
  FROM (SELECT 1) AS t;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_dashboard_alumno() TO authenticated;


-- get_clases_disponibles: todas las clases con nombre del entrenador
CREATE OR REPLACE FUNCTION public.get_clases_disponibles()
RETURNS TABLE(
  id              UUID,
  nombre          TEXT,
  descripcion     TEXT,
  capacidad_max   INTEGER,
  dias_semana     TEXT[],
  hora_inicio     TIME,
  hora_fin        TIME,
  entrenador_nombre TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.nombre, c.descripcion, c.capacidad_max,
    c.dias_semana, c.hora_inicio, c.hora_fin,
    pr.nombre AS entrenador_nombre
  FROM public.clases c
  JOIN public.profiles pr ON pr.id = c.entrenador_id
  ORDER BY c.nombre;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_clases_disponibles() TO authenticated;
