-- ============================================================
-- V3 ENTRENAMIENTO — ejecutar en Supabase SQL Editor
-- ============================================================

-- ─── Tablas ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.registros_entreno (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id                UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  ejercicio_id             UUID NOT NULL REFERENCES public.ejercicios(id) ON DELETE CASCADE,
  fecha                    DATE NOT NULL,
  semana                   INTEGER NOT NULL CHECK (semana BETWEEN 1 AND 4),
  series_realizadas        INTEGER,
  repeticiones_realizadas  TEXT,
  peso_realizado           NUMERIC(6,2),
  rpe                      INTEGER CHECK (rpe BETWEEN 1 AND 10),
  rir                      INTEGER,
  notas                    TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (alumno_id, ejercicio_id, fecha)
);

CREATE TABLE IF NOT EXISTS public.sensaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id     UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  fecha         DATE NOT NULL,
  energia       INTEGER CHECK (energia BETWEEN 1 AND 10),
  fatiga        INTEGER CHECK (fatiga BETWEEN 1 AND 10),
  sueno         INTEGER CHECK (sueno BETWEEN 1 AND 10),
  estado_animo  INTEGER CHECK (estado_animo BETWEEN 1 AND 10),
  dolor         TEXT,
  comentarios   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (alumno_id, fecha)
);

-- ─── RPC: get_mi_alumno_id ───────────────────────────────────────────────────
-- Devuelve el id de la tabla alumnos del usuario autenticado.
-- Busca primero por profile_id directo, luego por email como fallback
-- (cubre el caso de alumnos creados manualmente por el entrenador).

CREATE OR REPLACE FUNCTION public.get_mi_alumno_id()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id    UUID;
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT a.id INTO v_id
  FROM public.alumnos a
  JOIN public.profiles p ON p.id = a.profile_id
  WHERE a.estado = 'activo'
    AND (a.profile_id = auth.uid() OR p.email = v_email)
  ORDER BY (a.profile_id = auth.uid()) DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mi_alumno_id() TO authenticated;

-- ─── RPC: registrar_entreno ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.registrar_entreno(
  p_alumno_id                UUID,
  p_ejercicio_id             UUID,
  p_fecha                    DATE,
  p_semana                   INTEGER,
  p_series_realizadas        INTEGER DEFAULT NULL,
  p_repeticiones_realizadas  TEXT    DEFAULT NULL,
  p_peso_realizado           NUMERIC DEFAULT NULL,
  p_rpe                      INTEGER DEFAULT NULL,
  p_rir                      INTEGER DEFAULT NULL,
  p_notas                    TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.registros_entreno (
    alumno_id, ejercicio_id, fecha, semana,
    series_realizadas, repeticiones_realizadas, peso_realizado,
    rpe, rir, notas
  ) VALUES (
    p_alumno_id, p_ejercicio_id, p_fecha, p_semana,
    p_series_realizadas, p_repeticiones_realizadas, p_peso_realizado,
    p_rpe, p_rir, p_notas
  )
  ON CONFLICT (alumno_id, ejercicio_id, fecha) DO UPDATE SET
    semana                   = EXCLUDED.semana,
    series_realizadas        = EXCLUDED.series_realizadas,
    repeticiones_realizadas  = EXCLUDED.repeticiones_realizadas,
    peso_realizado           = EXCLUDED.peso_realizado,
    rpe                      = EXCLUDED.rpe,
    rir                      = EXCLUDED.rir,
    notas                    = EXCLUDED.notas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_entreno(UUID, UUID, DATE, INTEGER, INTEGER, TEXT, NUMERIC, INTEGER, INTEGER, TEXT) TO authenticated;

-- ─── RPC: registrar_sensaciones ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.registrar_sensaciones(
  p_alumno_id    UUID,
  p_fecha        DATE,
  p_energia      INTEGER DEFAULT NULL,
  p_fatiga       INTEGER DEFAULT NULL,
  p_sueno        INTEGER DEFAULT NULL,
  p_dolor        TEXT    DEFAULT NULL,
  p_estado_animo INTEGER DEFAULT NULL,
  p_comentarios  TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.sensaciones (
    alumno_id, fecha, energia, fatiga, sueno,
    estado_animo, dolor, comentarios
  ) VALUES (
    p_alumno_id, p_fecha, p_energia, p_fatiga, p_sueno,
    p_estado_animo, p_dolor, p_comentarios
  )
  ON CONFLICT (alumno_id, fecha) DO UPDATE SET
    energia       = EXCLUDED.energia,
    fatiga        = EXCLUDED.fatiga,
    sueno         = EXCLUDED.sueno,
    estado_animo  = EXCLUDED.estado_animo,
    dolor         = EXCLUDED.dolor,
    comentarios   = EXCLUDED.comentarios;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_sensaciones(UUID, DATE, INTEGER, INTEGER, INTEGER, TEXT, INTEGER, TEXT) TO authenticated;

-- ─── RPC: get_resumen_semanal ─────────────────────────────────────────────────
-- Devuelve entrenamientos de la semana indicada, agrupados por fecha.
-- Cada fila: { fecha DATE, ejercicios JSONB[] }

CREATE OR REPLACE FUNCTION public.get_resumen_semanal(
  p_alumno_id UUID,
  p_semana    INTEGER
)
RETURNS TABLE(
  fecha      DATE,
  ejercicios JSONB
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.fecha,
    jsonb_agg(
      jsonb_build_object(
        'ejercicio_id',              r.ejercicio_id,
        'ejercicio_nombre',          e.nombre,
        'series_planificadas',       e.series,
        'repeticiones_planificadas', e.repeticiones,
        'series_realizadas',         r.series_realizadas,
        'repeticiones_realizadas',   r.repeticiones_realizadas,
        'peso_realizado',            r.peso_realizado,
        'rpe',                       r.rpe,
        'rir',                       r.rir
      ) ORDER BY e.orden, e.created_at
    ) AS ejercicios
  FROM public.registros_entreno r
  JOIN public.ejercicios e ON e.id = r.ejercicio_id
  WHERE r.alumno_id = p_alumno_id
    AND r.semana    = p_semana
  GROUP BY r.fecha
  ORDER BY r.fecha DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_resumen_semanal(UUID, INTEGER) TO authenticated;
