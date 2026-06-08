-- ============================================================
-- V4 PROGRESO — ejecutar en Supabase SQL Editor
-- ============================================================

-- ─── RPC: get_progreso_ejercicio ─────────────────────────────────────────────
-- Historial de un ejercicio específico para el alumno, ordenado por fecha ASC.

CREATE OR REPLACE FUNCTION public.get_progreso_ejercicio(
  p_alumno_id    UUID,
  p_ejercicio_id UUID
)
RETURNS TABLE(
  fecha                   DATE,
  semana                  INTEGER,
  series_realizadas       INTEGER,
  repeticiones_realizadas TEXT,
  peso_realizado          NUMERIC,
  rpe                     INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.fecha,
    r.semana,
    r.series_realizadas,
    r.repeticiones_realizadas,
    r.peso_realizado,
    r.rpe
  FROM public.registros_entreno r
  WHERE r.alumno_id    = p_alumno_id
    AND r.ejercicio_id = p_ejercicio_id
  ORDER BY r.fecha ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_progreso_ejercicio(UUID, UUID) TO authenticated;

-- ─── RPC: get_records_alumno ──────────────────────────────────────────────────
-- Récords personales del alumno: peso máximo, mayor volumen en sesión, racha.

CREATE OR REPLACE FUNCTION public.get_records_alumno(p_alumno_id UUID)
RETURNS TABLE(
  peso_maximo            NUMERIC,
  ejercicio_peso_maximo  TEXT,
  mayor_volumen_sesion   NUMERIC,
  racha_dias             INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_peso        NUMERIC;
  v_ej_nombre   TEXT;
  v_volumen     NUMERIC;
  v_racha       INTEGER;
BEGIN
  -- Peso máximo registrado y el ejercicio donde ocurrió
  SELECT r.peso_realizado, e.nombre
  INTO v_peso, v_ej_nombre
  FROM public.registros_entreno r
  JOIN public.ejercicios e ON e.id = r.ejercicio_id
  WHERE r.alumno_id = p_alumno_id
    AND r.peso_realizado IS NOT NULL
  ORDER BY r.peso_realizado DESC
  LIMIT 1;

  -- Mayor volumen total en un día (series × reps × peso, solo reps numéricas)
  SELECT MAX(vol) INTO v_volumen FROM (
    SELECT
      r.fecha,
      SUM(
        COALESCE(r.series_realizadas, 0)
        * CASE WHEN r.repeticiones_realizadas ~ '^[0-9]+$'
            THEN r.repeticiones_realizadas::INTEGER ELSE 0 END
        * COALESCE(r.peso_realizado, 0)
      ) AS vol
    FROM public.registros_entreno r
    WHERE r.alumno_id = p_alumno_id
    GROUP BY r.fecha
  ) sub;

  -- Racha de días consecutivos con entrenamientos (gap-and-island)
  WITH fechas AS (
    SELECT DISTINCT fecha FROM public.registros_entreno WHERE alumno_id = p_alumno_id
  ),
  grupos AS (
    SELECT fecha,
      fecha - (ROW_NUMBER() OVER (ORDER BY fecha) * INTERVAL '1 day')::INTEGER AS grp
    FROM fechas
  )
  SELECT COALESCE(MAX(cnt), 0) INTO v_racha
  FROM (SELECT COUNT(*)::INTEGER AS cnt FROM grupos GROUP BY grp) sub;

  RETURN QUERY SELECT v_peso, v_ej_nombre, v_volumen, v_racha;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_records_alumno(UUID) TO authenticated;

-- ─── RPC: get_sensaciones_alumno ─────────────────────────────────────────────
-- Promedios de sensaciones agrupados por semana ISO (últimas 4 semanas).

CREATE OR REPLACE FUNCTION public.get_sensaciones_alumno(p_alumno_id UUID)
RETURNS TABLE(
  semana_num             INTEGER,
  fecha_inicio           DATE,
  energia_promedio       NUMERIC,
  fatiga_promedio        NUMERIC,
  sueno_promedio         NUMERIC,
  estado_animo_promedio  NUMERIC,
  total_registros        INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH semanas AS (
    SELECT
      EXTRACT(ISOYEAR FROM fecha)::INTEGER * 100
        + EXTRACT(WEEK FROM fecha)::INTEGER AS week_key,
      MIN(fecha)                       AS fecha_inicio,
      ROUND(AVG(energia), 1)           AS energia_avg,
      ROUND(AVG(fatiga), 1)            AS fatiga_avg,
      ROUND(AVG(sueno), 1)             AS sueno_avg,
      ROUND(AVG(estado_animo), 1)      AS estado_animo_avg,
      COUNT(*)::INTEGER                AS cnt
    FROM public.sensaciones
    WHERE alumno_id = p_alumno_id
    GROUP BY week_key
    ORDER BY week_key DESC
    LIMIT 4
  ),
  ordered AS (
    SELECT s.*, ROW_NUMBER() OVER (ORDER BY s.fecha_inicio ASC)::INTEGER AS rn
    FROM semanas s
  )
  SELECT rn, o.fecha_inicio, o.energia_avg, o.fatiga_avg, o.sueno_avg, o.estado_animo_avg, o.cnt
  FROM ordered o
  ORDER BY o.fecha_inicio ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sensaciones_alumno(UUID) TO authenticated;
