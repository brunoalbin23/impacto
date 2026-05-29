# CONTEXT.md — Estado del proyecto Impacto

## Stack y versiones

| Tecnología | Versión |
|---|---|
| Expo SDK | ~54.0.33 |
| expo-router | ~6.0.23 |
| React | 19.1.0 |
| React Native | 0.81.5 |
| TypeScript | ~5.9.2 |
| @supabase/supabase-js | ^2.106.2 |
| @react-native-async-storage/async-storage | 2.2.0 |
| react-native-safe-area-context | ~5.6.0 |
| react-native-screens | ~4.16.0 |

---

## Arquitectura de auth

### Flujo general
1. `AuthProvider` envuelve toda la app en `app/_layout.tsx`
2. `onAuthStateChange` es la única fuente de verdad para sesión y rol
3. Al recibir sesión, se fetcha el rol via `fetch()` directo (no Supabase client) con el access_token
4. El contexto expone `{ session, role, loading }`

### Por qué fetch() directo para el rol
`supabase.from('profiles')` dentro de `onAuthStateChange` falla con 403 porque el JWT del cliente no está disponible en ese momento. La solución es hacer un `fetch()` nativo con `Authorization: Bearer ${access_token}` explícito.

### Archivos de auth

**`lib/auth-context.tsx`** — Contexto central. Función `fetchRoleWithToken(userId, accessToken)` hace GET directo a `/rest/v1/profiles`. `AuthProvider` escucha `onAuthStateChange` y actualiza `{ session, role, loading }` en un solo `setState` para evitar renders intermedios con estado inconsistente.

**`lib/supabase.ts`** — Cliente Supabase con `AsyncStorage` para persistencia de sesión en mobile. `detectSessionInUrl: false` obligatorio en RN.

### Navegación por rol
- `app/index.tsx` — Gate screen: spinner mientras carga, luego `<Redirect>` según rol
- `app/(auth)/_layout.tsx` — Si hay sesión activa, redirige al tab correspondiente (maneja post-login)
- `app/(tabs)/_layout.tsx` — Si no hay sesión, redirige a login (maneja logout/expiración)

### Roles disponibles
- `entrenador` → `/(tabs)/entrenador`
- `alumno` (o cualquier otro) → `/(tabs)/alumno`

---

## Tablas en Supabase

### `auth.users` (Supabase managed)
Tabla nativa de Supabase Auth. Trigger `on_auth_user_created` crea automáticamente una fila en `public.profiles` al registrarse.

### `public.profiles`
```
id         UUID  PK  (gen_random_uuid(), sin FK a auth.users — constraint eliminada)
nombre     TEXT
email      TEXT
telefono   TEXT
rol        TEXT  ('entrenador' | 'alumno')
created_at TIMESTAMPTZ
```
- Para usuarios con auth: `id` coincide con `auth.users.id`, creado por trigger
- Para alumnos sin auth (creados por entrenador): `id` generado manualmente en RPC

### `public.alumnos`
```
id             UUID  PK
profile_id     UUID  FK → profiles.id
entrenador_id  UUID  FK → auth.users.id
objetivo       TEXT
estado_fisico  TEXT
observaciones  TEXT
fecha_inicio   DATE
estado         TEXT  ('activo' | 'inactivo')
created_at     TIMESTAMPTZ
```

---

## Funciones RPC en Supabase

Todas las funciones son `SECURITY DEFINER` para bypasear RLS. Esto es el patrón central del proyecto.

| Función | Parámetros | Descripción |
|---|---|---|
| `crear_alumno` | `p_nombre, p_email, p_telefono, p_objetivo, p_estado_fisico, p_observaciones` | Crea profile + alumno atómicamente. Genera UUID manualmente. |
| `get_mis_alumnos` | — | Devuelve todos los alumnos del `auth.uid()` actual con datos de perfil en campos planos. |
| `get_alumno` | `p_id UUID` | Devuelve un alumno por ID, verificando que pertenezca al entrenador autenticado. |
| `actualizar_alumno` | `p_id, p_nombre, p_email, p_telefono, p_objetivo, p_estado_fisico, p_observaciones, p_estado` | Actualiza profile + alumno atómicamente. Verifica ownership. |

Todos los grants: `GRANT EXECUTE ON FUNCTION public.<fn> TO authenticated;`

---

## Estructura de archivos

```
app/
  _layout.tsx                        — Root layout, solo monta Stack dentro de AuthProvider
  index.tsx                          — Gate screen (spinner → redirect por rol)
  (auth)/
    _layout.tsx                      — Redirige a tabs si hay sesión
    login.tsx                        — Formulario de login
    register.tsx                     — Formulario de registro (nombre en metadata, sin insert manual)
  (tabs)/
    _layout.tsx                      — Redirige a login si no hay sesión
    alumno/
      index.tsx                      — Dashboard alumno (placeholder)
    entrenador/
      _layout.tsx                    — Stack sin header
      index.tsx                      — Dashboard entrenador (logo, saludo, 4 cards, logout)
      alumnos.tsx                    — Lista de alumnos con FAB para agregar
      cuotas.tsx                     — Lista de cuotas con filtros (Todos/Pendientes/Vencidos/Pagados) y FAB
      cuotas/
        nueva.tsx                    — Formulario registrar cuota (alumno, plan, monto, fecha, método pago)
        [id].tsx                     — Detalle cuota + botón marcar pagado + edición inline
      clases.tsx                     — Lista de clases con días (píldoras) y horario
      clases/
        [id].tsx                     — Crear (id='nuevo') / Editar clase + botón eliminar
      asistencia.tsx                 — Registro asistencia del día por clase
      alumno/
        nuevo.tsx                    — Formulario crear alumno
        [id].tsx                     — Perfil + edición inline de alumno

lib/
  supabase.ts                        — Cliente Supabase con AsyncStorage
  auth-context.tsx                   — AuthProvider y useAuth hook

assets/
  images/logo.png                    — Logo usado en dashboard entrenador
```

---

## Módulos completados

### Auth
- Login con email/password
- Registro con nombre (pasado en `signUp options.data`, trigger crea el profile)
- Logout
- Persistencia de sesión con AsyncStorage
- Redirect automático por rol al iniciar y al hacer login/logout

### Dashboard entrenador
- Header con logo y saludo con nombre del usuario
- 4 tarjetas de navegación: Alumnos, Cuotas, Clases, Asistencia
- Botón de logout

### Módulo Alumnos (entrenador)
- **Lista** (`alumnos.tsx`): FlatList con avatar de iniciales, nombre, email, badge de estado activo/inactivo. Pull-to-refresh. FAB para agregar. Recarga automática con `useFocusEffect`.
- **Crear** (`alumno/nuevo.tsx`): Formulario con nombre, email, teléfono, objetivo, estado físico, observaciones. Guarda via `crear_alumno` RPC.
- **Perfil / Editar** (`alumno/[id].tsx`): Vista de perfil con todos los datos. Modo edición inline toggle. Toggle activo/inactivo. Guarda via `actualizar_alumno` RPC. Fecha de inicio formateada.

---

## Módulos completados (continuación)

### Módulo Cuotas (entrenador)
- **Lista** (`cuotas.tsx`): FlatList con filtros horizontales (Todos/Pendientes/Vencidos/Pagados). Cards con color por estado: rojo=vencido (`borderColor`+`backgroundColor`), amarillo=por vencer, verde=pagado. Lógica de estado visual calculada client-side (no depende del campo `estado` del DB para el color). FAB para nueva cuota. `useFocusEffect` para recarga al volver.
- **Crear** (`cuotas/nueva.tsx`): Selector de alumno y plan via Modal bottom-sheet. Fecha DD/MM/AAAA con parse a YYYY-MM-DD. Monto editable. Selector método pago (3 botones). Al seleccionar plan, pre-carga el precio en el campo monto.
- **Detalle/Editar** (`cuotas/[id].tsx`): Card central con estado visual + monto grande. Vista de datos en InfoSection. Edición inline toggle igual que perfil alumno. Botón verde "Marcar como pagado" (solo si estado != pagado). Modales para alumno y plan.

### Tablas Supabase nuevas (módulo cuotas)
- `public.planes` — id, nombre, descripcion, precio, created_at
- `public.cuotas` — id, alumno_id (FK→alumnos), plan_id (FK→planes nullable), fecha_vencimiento, monto, metodo_pago, estado, fecha_pago, created_at

### RPCs nuevas (módulo cuotas)
| Función | Parámetros | Descripción |
|---|---|---|
| `get_planes` | — | Devuelve id, nombre, precio de todos los planes |
| `get_cuotas_entrenador` | — | Cuotas de alumnos del entrenador autenticado con alumno_nombre y plan_nombre |
| `get_cuota` | `p_id UUID` | Una cuota por id, verifica ownership |
| `crear_cuota` | `p_alumno_id, p_plan_id, p_fecha_vencimiento, p_monto, p_metodo_pago` | Crea cuota con estado='pendiente' |
| `marcar_cuota_pagada` | `p_id` | Setea estado='pagado' y fecha_pago=CURRENT_DATE |
| `actualizar_cuota` | `p_id, p_alumno_id, p_plan_id, p_fecha_vencimiento, p_monto, p_metodo_pago, p_estado` | Edición completa |

Script SQL: `supabase/cuotas_setup.sql`

---

## Módulos pendientes

- **Cuotas**: ✅ COMPLETADO

### Módulo Clases (entrenador)
- **Lista** (`clases.tsx`): Cards con nombre, capacidad badge, todos los 7 días mostrados como píldoras (blancas=activo, oscuras=inactivo) y horario con icono reloj. `parseDias()` maneja tanto JS array como el string `{lun,mar}` que puede devolver Postgres.
- **Crear/Editar** (`clases/[id].tsx`): Una sola pantalla. `id === 'nuevo'` → crear, cualquier UUID → editar. Toggle días con `flexWrap`. Horario HH:MM en dos inputs lado a lado. Botón eliminar con `Alert.alert` de confirmación solo en modo edición.

### Tablas Supabase nuevas (módulo clases)
- `public.clases` — id, entrenador_id, nombre, descripcion, capacidad_max, dias_semana TEXT[], hora_inicio TIME, hora_fin TIME, created_at

### RPCs nuevas (módulo clases)
| Función | Parámetros | Descripción |
|---|---|---|
| `get_mis_clases` | — | Clases del entrenador autenticado |
| `get_clase` | `p_id UUID` | Una clase por id, verifica ownership |
| `crear_clase` | `p_nombre, p_descripcion, p_capacidad_max, p_dias_semana TEXT[], p_hora_inicio, p_hora_fin` | Crea clase |
| `actualizar_clase` | `p_id + mismos parámetros` | Edita clase |
| `eliminar_clase` | `p_id UUID` | Elimina clase, verifica ownership |

Script SQL: `supabase/clases_setup.sql`

### Módulo Asistencia (entrenador)
- **Pantalla única** (`asistencia.tsx`): Fecha de hoy formateada ("Jueves 29 de Mayo"). Selector de clase (Modal bottom-sheet). Una vez seleccionada, carga `get_asistencia_hoy` y muestra todos los alumnos activos del entrenador. Cada fila es tappable para togglear Presente/Ausente. Resumen contador arriba de la lista. Si la asistencia ya fue guardada hoy → badge amarillo "Editando asistencia ya guardada". Botón guardar. Mensaje de éxito en verde después de guardar.
- **Reset en `useFocusEffect`**: al volver a la pantalla limpia clase/alumnos para evitar estado stale.

### Tablas Supabase nuevas (módulo asistencia)
- `public.asistencias` — id, clase_id (FK→clases), alumno_id (FK→alumnos), fecha DATE, estado TEXT, created_at. UNIQUE(clase_id, alumno_id, fecha) para upsert.

### RPCs nuevas (módulo asistencia)
| Función | Parámetros | Descripción |
|---|---|---|
| `get_asistencia_hoy` | `p_clase_id UUID` | Alumnos activos del entrenador con estado de hoy (COALESCE → 'ausente') + `tiene_registro` bool |
| `guardar_asistencia` | `p_clase_id UUID, p_registros JSONB` | Upsert masivo ON CONFLICT(clase_id, alumno_id, fecha) |
| `get_historial_asistencia` | `p_alumno_id UUID` | Historial completo del alumno (para perfil, v2) |

Script SQL: `supabase/asistencia_setup.sql`

---

## Estado v1 — COMPLETO ✅

Todos los módulos del dashboard del entrenador están implementados:
- ✅ Auth (login, registro, logout, redirect por rol)
- ✅ Dashboard entrenador
- ✅ Alumnos (lista, crear, perfil/editar)
- ✅ Cuotas (lista+filtros, nueva, detalle/editar)
- ✅ Clases (lista, crear/editar/eliminar)
- ✅ Asistencia (registro diario por clase)
- **Clases**: gestión de clases y horarios
- **Asistencia**: registro de asistencia por clase
- **Dashboard alumno**: contenido real (clases, plan, asistencia)

---

## Decisiones de diseño importantes

### 1. SECURITY DEFINER RPCs para todas las operaciones de DB
`supabase.from()` con RLS activo falla consistentemente en React Native por timing del JWT. Solución adoptada: todas las operaciones que tocan tablas con RLS van por funciones `SECURITY DEFINER` en Supabase. Las funciones verifican `auth.uid()` internamente para ownership.

### 2. profiles sin FK a auth.users
Se eliminó `profiles_id_fkey` (FK de `profiles.id` → `auth.users.id`) para permitir crear perfiles de alumnos sin cuenta de auth. Los alumnos creados por el entrenador existen solo en `profiles` + `alumnos`, sin usuario en `auth.users`.

### 3. Un solo setState en AuthProvider
Tres `setState` separados (session, role, loading) causaban renders intermedios con estado inconsistente (ej: session seteada pero role todavía null → redirect incorrecto). Solucionado con un único objeto de estado.

### 4. `<Redirect>` en lugar de `router.replace()`
`router.replace()` falla si el Stack no está montado. `<Redirect>` de expo-router maneja esto correctamente y es el patrón para navegación condicional en layouts.

### 5. Nombre en signUp metadata, no insert manual
El trigger `on_auth_user_created` en Supabase crea el profile automáticamente usando `raw_user_meta_data->>'nombre'`. Un insert manual adicional genera conflicto de PK duplicada.

---

## Convenciones de código

- **Tema**: dark puro (`#000` background, `#0f0f0f` cards, `#1e1e1e` borders, `#fff` texto primario, `#555` texto secundario)
- **StyleSheet**: siempre al final del archivo, separado por componente si hay subcomponentes (`styles`, `sectionStyles`, `fieldStyles`, `rowStyles`)
- **Tipos**: definidos al inicio del archivo, antes del componente
- **Formularios**: estado en un único objeto `Form` con helper `const set = (field) => (value) => setForm(prev => ({...prev, [field]: value}))`
- **Headers**: patrón consistente — botón izquierdo (back), título centrado, botón derecho (acción o `View` vacío de mismo ancho para centrar)
- **Navegación**: `router.push()` para ir adelante, `router.back()` para volver
- **Ionicons**: librería de íconos (`@expo/vector-icons`)
- **SafeAreaView**: de `react-native-safe-area-context` (no de react-native)
- **useFocusEffect**: para recargar datos al volver a una pantalla (lista de alumnos)
- **Campos opcionales en RPC**: se pasan como `value.trim() || null` para no guardar strings vacíos
