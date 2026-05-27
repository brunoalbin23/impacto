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
      cuotas.tsx                     — Placeholder "Próximamente"
      clases.tsx                     — Placeholder "Próximamente"
      asistencia.tsx                 — Placeholder "Próximamente"
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

## Módulos pendientes

- **Cuotas**: gestión de pagos/cuotas por alumno
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
