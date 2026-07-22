# Design: Persistencia real de Programa/Ejecución + gestión de clases

## Technical Approach

Persistencia primero (reutilizando infraestructura ya existente y nunca conectada), después una vista nueva de gestión de clases que reusa el patrón ya probado de `JornadasView.tsx`, y la fusión de flujos de publicar queda acotada a una investigación adicional durante `sdd-apply` (ver Open Questions — el archivo tiene más duplicación de la que se mapeó en la exploración).

## Architecture Decisions

| Decisión | Elegido | Alternativa descartada | Por qué |
|---|---|---|---|
| Persistencia de `EjecucionPrograma` | Conectar `repositoryJornada.guardarEjecucion()` — **ya existe y funciona**, solo falta el llamado en `guardarPrograma()` | Reescribir la persistencia de ejecución desde cero | Es una función ya implementada y no usada — cero riesgo, cero código nuevo necesario |
| Persistencia de `ProgramaAcademico` | Nuevo `programaRepository.ts`, mismo patrón que `jornadaRepository.ts` (mock en memoria si `!isFirebaseConfigured`, `setDoc`/`getDocs` real si sí) | Meter la lógica de Firestore directo en `AsignacionesView.tsx` | Consistencia con el resto del dominio académico; testeable igual que `jornadaRepository.test.ts` |
| Colección y reglas de Firestore | `tenants/{tenantId}/programasAcademicos/{id}` | Colección nueva | **Ya existe en `firestore.rules:230-235`**, anticipada de antes y nunca usada — `write: if isAdmin()`, `read: if authenticated()`. Cero cambios de reglas necesarios |
| Vista "Mis clases" | Componente nuevo que reusa el patrón `registrarCambio()` de `JornadasView.tsx` (guardarJornada + guardarEjecucion opcional + registrarAuditoria) adaptado a una lista, no a una sola jornada | Extender `JornadasView.tsx` directamente | `JornadasView` está diseñado para UNA jornada activa a la vez (el "hoy estoy dando esta clase"); forzarlo a listar N jornadas cambia su contrato — más simple un componente nuevo que reusa el patrón, no el componente |
| Fusión de flujos de publicar | **Diferido a investigación de apply** | Diseñar la fusión ahora | Al leer el archivo se encontraron MÁS secciones duplicadas de las mapeadas en la exploración (ver Open Questions) — diseñar la fusión sin verlas todas es adivinar |

## Data Flow

```
guardarPrograma() [AsignacionesView.tsx]
  ├── createPrograma + publishPrograma (puro, sin cambios)
  ├── assignProgramaToGrupo (puro, sin cambios)
  ├── programaRepository.guardarPrograma(programaReal)         ← NUEVO
  ├── repositoryJornada.guardarEjecucion(ejecucion)             ← CONECTAR (ya existe)
  └── generarJornadasDeEjecucion + guardarJornadasEnLote (sin cambios)

Al montar AsignacionesView:
  programaRepository.listarProgramasPorTenant(tenantId) → seedea `programas` (en vez de solo programaInicial)

Vista "Mis clases" (nueva):
  listarJornadasPorTenant(tenantId) → filtra por programaId → tabla
  + listarAsignacionesPorTenant(tenantId) → resuelve material por jornadaId (reusa lógica de agendaAcademicaService)
  → confirmar/iniciar por fila → jornadaService.ts (puro) + guardarJornada/registrarAuditoria
  → cerrar por fila (corregido en Fase 6, ver más abajo) →
      marcarPendienteCierre(jornada, { asistenciaRegistrada, objetivosImpartidos }) [checkboxes por fila, mismo patrón que JornadasView.tsx]
      → cerrarJornada(pendiente) → guardarJornada/registrarAuditoria
```

## File Changes

| Archivo | Acción | Descripción |
|---|---|---|
| `servicios/academico/programaRepository.ts` | Crear | `guardarPrograma`, `listarProgramasPorTenant` — mismo patrón que `jornadaRepository.ts` |
| `servicios/academico/programaRepository.test.ts` | Crear | Tests unitarios del repo nuevo |
| `vistas/admin/AsignacionesView.tsx` | Modificar | `guardarPrograma()` conecta `guardarEjecucion` + llama al repo nuevo; `useEffect` de montaje lee programas reales |
| `vistas/admin/MisClasesView.tsx` | Crear | Tabla de jornadas del programa con acciones de ciclo de vida |
| `vistas/admin/MisClasesView.test.tsx` | Crear | Tests del componente nuevo |
| `vistas/CentroEstudios.test.tsx` | Modificar (Fase 6) | Aserciones de "Publicar material" (removido del modo embedded en Fase 4) actualizadas al flujo de lote fusionado |
| `vistas/admin/MisClasesView.tsx` | Corregir (Fase 6) | "Cerrar" pasa primero por `marcarPendienteCierre()` con asistencia/objetivos capturados en checkboxes por fila, en vez de llamar `cerrarJornada()` directo sobre una jornada `en_curso` |
| `vistas/admin/MisClasesView.test.tsx` | Extender (Fase 6) | 2 tests nuevos: cierre exitoso tras registrar asistencia/objetivos, y error si se intenta cerrar sin registrarlos |

## Interfaces / Contracts

```typescript
export interface ProgramaRepository {
  guardarPrograma(programa: ProgramaAcademico): Promise<void>;
  listarProgramasPorTenant(tenantId: string): Promise<ProgramaAcademico[]>;
}
```

## Testing Strategy

| Capa | Qué testear | Enfoque |
|---|---|---|
| Unit | `programaRepository`: guardar y listar, mock y Firestore real | Nuevo, mismo patrón que `jornadaRepository.test.ts` |
| Unit | `guardarPrograma()` llama `guardarEjecucion` + `programaRepository.guardarPrograma` | Extender `AsignacionesView.test.tsx` |
| Componente | `MisClasesView`: lista jornadas, transiciona estado, muestra material | Nuevo |
| Integración | Programa persiste y se relee tras "recargar" (nuevo mount) | Extender `AsignacionesView.test.tsx` |

## Migration / Rollout

Sin migración — aditivo. Programas creados antes de este change simplemente no existen en Firestore (se pierden si no se recrean), pero eso ya era el comportamiento actual, no se degrada nada.

## Resuelto durante `sdd-apply`: fusión de flujos de publicar

**Confirmado con evidencia de código** (dos búsquedas de `onClick={publicar}`, dos ocurrencias): existen genuinamente DOS formularios completos que llaman a la misma función `publicar()` — el de "Clase activa" (carrusel de jornada + botón con `disabled={... || !puedePublicarEmbebido}`, nombre de variable literalmente "embebido") y el de "Paso 3B · Envío" (formulario plano con `id="asignacion-recurso"`, botón con `disabled={... || !tieneJornadaSeleccionada}`). Ninguno de los dos está gateado a nivel de artículo completo por `embedded`/`!embedded` — ambos renderizan simultáneamente cuando `embedded=true`, aunque los tests embedded existentes nunca lo notaron porque interactúan vía el flujo de tarjeta+modal, no por el `id="asignacion-recurso"` plano.

**Decisión**: envolver el artículo completo de "Paso 3B" (el formulario plano, más viejo y simple) en `{!embedded && (...)}` — deja de renderizar en modo embedded, dejando el flujo de "Clase activa" (más rico: contexto de jornada real, multi-select, lote) como el ÚNICO flujo de publicar en Centro de Estudios. El modo standalone (no tocado por este change) sigue usando el formulario "Paso 3B" sin cambios.

## Corregido durante fix-up de `sdd-verify` (Fase 6)

`sdd-verify` encontró 2 CRITICAL con ejecución real de tests, ambos ya corregidos:

1. **`CentroEstudios.test.tsx` desactualizado**: dos aserciones (~líneas 201, 212) todavía esperaban el botón "Publicar material" en modo embedded — removido en Fase 4 (ver sección anterior). Se actualizaron para verificar el flujo de lote fusionado: el recurso preparado queda marcado (`checked`) en el checklist de "Materiales" del bloque de Publicación en lote, y el botón "Publicar en lote" pasa de deshabilitado a habilitado al seleccionar material + clase. Sin cambios de código de producción, solo de test.

2. **`MisClasesView.tsx` — "Cerrar" siempre fallaba**: `transicionar()` llamaba `cerrarJornada(jornada)` directo sobre una jornada `en_curso`. `cerrarJornada()` exige `asistenciaRegistrada === true` y `objetivosImpartidos.length > 0`, pero ninguna jornada generada por este change los seteaba nunca — todo click en "Cerrar" lanzaba `Error: No se puede cerrar una jornada sin asistencia registrada.` y la clase quedaba trabada en `en_curso`. Probado con un test descartable real antes de corregir.

   **Decisión del usuario**: reusar el patrón ya probado de `JornadasView.tsx` en vez de construir un formulario de asistencia nuevo. Ese patrón es: checkboxes de "Asistencia registrada" y de objetivo(s) impartido(s) → `marcarPendienteCierre(jornada, { asistenciaRegistrada, objetivosImpartidos })` (transición `en_curso → pendiente_cierre`, setea los dos campos) → recién ahí se cierra de verdad.

   **Adaptado a `MisClasesView.tsx`** (que maneja una LISTA de jornadas, no una sola como `JornadasView.tsx`): se agregó estado por fila (`asistenciaPorJornadaId`, `objetivosImpartidosPorJornadaId`, ambos `Record<string, boolean>` keyed por `jornada.id`) y, solo para filas en `en_curso`, se reemplazó el botón "Cerrar" suelto por las mismas dos casillas + botón "Cerrar", mismo shape que `JornadasView.tsx`. Al confirmar: `marcarPendienteCierre(...)` seguido de `cerrarJornada(pendiente)` (mismas funciones puras de `jornadaService.ts`, sin duplicar lógica de validación).

   **Desviación consciente del patrón de `JornadasView.tsx`**: `JornadasView.tsx` no llama `cerrarJornada()` directo sino `cerrarJornadaConPrograma({ jornada, programa, ejecucion })` (de `servicios/academico/closeJornada.ts`), que además ejecuta `advanceCiclo(programa, ejecucion, objetivosImpartidos)` para avanzar el ciclo del programa. Esto requiere el objeto `ProgramaAcademico` completo (con `unidades`) y el `EjecucionPrograma` completo — `MisClasesView.tsx` solo recibe `programaId: string` como prop, y **no existe hoy ningún método de repositorio para obtener una única `EjecucionPrograma` por id** (`jornadaRepository.ts` solo expone `guardarEjecucion`, no un getter). Agregar esa capacidad es trabajo nuevo de plomería fuera del alcance de este fix-up de 2 CRITICAL. Se optó por el fix mínimo correcto (`marcarPendienteCierre` + `cerrarJornada`, sin `advanceCiclo`), que resuelve el crash reportado sin inventar datos falsos de programa/ejecución. **Queda como limitación conocida**: cerrar una clase desde "Mis clases" no avanza el ciclo del programa (`EjecucionPrograma.objetivosCompletados`/`unidadActualId` no se actualizan); sí lo hace cerrar desde `JornadasView.tsx`. Sería una mejora futura, no un bug de este change.

## Open Questions

Ninguna pendiente — las tres (fusión de flujos de publicar, regresión de aserciones y bug de cierre en Mis clases) quedaron resueltas durante `sdd-apply`/fix-up de Fase 6. La única limitación conocida (avance de ciclo del programa al cerrar desde "Mis clases") está documentada arriba y no bloquea este change.
