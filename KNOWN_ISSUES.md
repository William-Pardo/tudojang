# Issues conocidos — Rol Tutor (padre/acudiente) completamente no funcional, auditoría 2026-07-14

**Contexto:** auditoría disparada al preparar una presentación en vivo para ~150 padres del club Gajog (ver `PRESENTACION_GAJOG_GUION_NARRATIVA.md` y `presentacion-gajog-interactive.html`). Se necesitaba confirmar qué ve realmente un usuario con rol `Tutor` (= padre/acudiente, redefinido 2026-07-09 en `utils/roles.ts` — nunca instructor) antes de prometer una demo de login real frente a los padres. Decisión del usuario: NO arreglar ahora — documentar para atender en otra sesión, seguir con la presentación en esta.

**Conclusión de una línea:** hoy, un Tutor logueado no ve ningún dato real de su hijo/a en ninguna pantalla de la app. Todo lo que ve es vacío, mock, o lo desvía a una pantalla de staff.

## Tabla resumen — qué ve hoy un Tutor

| Ruta | Qué ve realmente |
|---|---|
| `/centro-estudios` | Siempre "Aún no tienes materiales asignados", sin importar si existen asignaciones reales. |
| `/mi-perfil` | 100% mock hardcodeado: "Mis Talones de Pago" y "Mis Horas Realizadas" (arrays con fechas fijas tipo `2024-05-20`), lenguaje de nómina/staff, cero datos del estudiante vinculado. |
| `/estudiantes` | Tab por defecto lo manda a `GestionClase.tsx`, panel de recepción de TODA la sede (no de "mi hijo"), que además está roto para todos los roles (ver Bug #7). |

## Bugs concretos (file:line)

1. **Nav visible pero colección bloqueada** — `App.tsx:73-74` incluye `RolUsuario.Tutor` en los links `/estudiantes` y `/centro-estudios`, pero `firestore.rules:137-140` (`allow read: if isInstructor()`) no incluye Tutor en `isInstructor()` (`firestore.rules:54-57`).
2. **Bug de identidad Tutor→Estudiante en Centro de Estudios** — `vistas/CentroEstudios.tsx:64-67` usa `usuario?.id` (UID de Auth del padre) como si fuera el `estudianteId`, en vez de resolver primero el hijo vinculado. `servicios/academico/centroEstudiosRepository.ts:63-64` intenta `getDoc(doc(db,'estudiantes', estudianteId))`, choca contra la regla de arriba, cae en el `catch` genérico (líneas 124-127) y retorna `[]` silenciosamente. **Sospecha fuerte de que este mismo bug rompe también el rol `Estudiante` real**, no solo Tutor — ningún flujo de creación de estudiantes hace que el docId de `/estudiantes` coincida con un Auth UID.
3. **`vinculos` (Tutor↔Estudiante) con llave que no calza** — `vistas/admin/VinculosView.tsx` (montada en `Configuracion.tsx:878`) SÍ escribe `tenants/{tenantId}/vinculos/{tutorEmail}_{estudianteId}` vía `servicios/academico/vinculoService.ts:29-64`, pero usa el **docId de `/estudiantes`**, mientras que la regla `tutorLinkedToStudent(tenantId, uid)` (`firestore.rules:69-73`, usada por `canReadProgress`, líneas 75-79) espera el **Auth UID del estudiante**. Namespaces distintos que nunca se sincronizan → el vínculo se crea pero no habilita nada. Bonus privacidad menor: la regla de lectura de `vinculos` (`firestore.rules:195-198`) deja que cualquier Tutor del tenant lea TODA la subcolección, no solo sus propios vínculos.
4. **`/mi-perfil` con contenido heredado de rol staff** — `vistas/MiPerfil.tsx:30-38` (arrays hardcodeados `talonesPago`/`miAsistencia`), `:139` (agrupa `Tutor` con `Asistente` en la misma condición de UI), `:177-210` (sección de pagos sin ningún condicional de rol). Origen confirmado: `vistas/PerfilTutor.tsx` (código muerto, no ruteado, "Panel del Sabonim") — contenido casi calcado, de cuando Tutor significaba instructor.
5. **Subsistema de check-in/recepción roto para TODOS los roles** — `servicios/asistenciaApi.ts:7` usa la colección raíz `asistencia`, que **no tiene ninguna regla** en `firestore.rules` (cae al catch-all `deny`, líneas ~397-399). Efecto: `GestionClase.tsx` queda en spinner infinito "Conectando al dojang..." para cualquier usuario — y es justo la pantalla a la que hoy se desvía a un Tutor.
6. **`DataContext.tsx:150-160` hace fetch eager de 9 colecciones instructor/admin-only** (`obtenerUsuarios`, `obtenerSedes`, `obtenerEstudiantes`, `obtenerEventos`, etc.) para CUALQUIER usuario autenticado sin ramificar por rol — genera permission-denied silencioso constante para Tutor, capturado por `Promise.allSettled` pero sin ramificación de qué cargar según rol.

## Propuesta de fix (diseño, no implementado)

- **Bug #2 (identidad):** resolver el `estudianteId` real del hijo vinculado ANTES de llamar a `centroEstudiosRepository` — no usar `usuario.id` del padre directamente.
- **Bug #3 (vinculos):** sincronizar el Auth UID del estudiante de vuelta al doc `/estudiantes/{docId}` (campo `authUid`) y usar ESE valor de forma consistente en `vinculos` y en `progreso/{uid}/...`, en vez de intentar hacer calzar dos IDs generados independientemente. Acotar además la regla de lectura de `vinculos` para que un Tutor solo lea sus propios vínculos.
- **Bug #4 (mock data):** eliminar las secciones "Mis Talones de Pago"/"Mis Horas Realizadas" para Tutor; reemplazar por `estadoPago`/`historialPagos` reales del estudiante vinculado (ya existen en el modelo `Estudiante`). Quitar el botón "Abrir Escáner QR" para Tutor (no corresponde a un padre y apunta a una función rota). Considerar borrar `vistas/PerfilTutor.tsx` (código muerto) para que nadie lo reutilice por error.
- **Bug #5 (asistencia sin regla):** agregar `match /asistencia/{docId}` a `firestore.rules` con condiciones de tenant/sede/rol — prerrequisito independiente si se quisiera reusar esa pantalla para algo, aunque la recomendación de producto es que Tutor ni siquiera debería llegar ahí.
- **Bug #6 (fetch eager):** ramificar `cargarTodo()` en `DataContext.tsx` según `usuario.rol` — para Tutor, no disparar las 9 colecciones instructor-only.
- **Decisión de producto pendiente:** ¿mantener `/estudiantes` y `/centro-estudios` como rutas de Tutor una vez arregladas, o quitarlas del sidebar (`App.tsx:73-74`) y construir una experiencia Tutor dedicada? Recomendación de la auditoría: la segunda opción, dado el resto de hallazgos.

## Antes de reintentar cualquier demo con login real de padre

Reproducir al menos el Bug #2 y el Bug #5 con una cuenta Tutor real (o emulador de Firestore) — son los que más directamente prometerían algo incumplible frente a los padres. Ver memoria de proyecto `tutor-role-broken-end-to-end` para contexto adicional.

---

# Issues conocidos — módulo 12 (Agenda), al cierre de la sesión 2026-07-08

## Bloqueantes para cumplir `Mejora del módulo Agenda.txt` (pendientes, subtareas 12.5–12.12)

1. **No existe la parrilla semanal** (12.8). `vistas/Horarios.tsx` es una grilla por día sin franja horaria 7am–10pm ni navegación de semanas. No hay ruta `/agenda`.
2. **No existe el modal de edición granular** con pestañas Programa/Materiales (12.7/12.9). Ni `JornadasView.tsx` ni `MisClasesView.tsx` lo cubren hoy.
3. **Auditoría incompleta** (12.5): `registrarAuditoria` no guarda `rol` del usuario ni valor anterior/nuevo por campo, y sus fallos son silenciosos.
4. **Hard delete peligroso sin guardas** (12.6): `eliminarJornadasEnLote` es borrado físico real, usado hoy solo para limpiar previews; sin guarda de "no borrar si hay asistencia u operación en Clase en Vivo".
5. **Ventana de Clase en Vivo no configurable** (12.10): `App.tsx` tiene el placeholder permanente `showClaseEnVivo = true`; no existen las constantes `LIVE_CLASS_OPEN_BEFORE_MINUTES`/`CLOSE_AFTER_MINUTES`.
6. **Hub Estudiantes no existe** (12.11): sin roster estudiante-jornada real (bloqueado además por el change `clase-en-vivo-checkin-trigger-agenda`, Fase 0, sin implementar). Decisión ya tomada: exponer solo servicio de lectura, no construir UI completa en este módulo.
7. **Espacio único hardcodeado** `'tatami-1'` en `jornadaContextService.ts:83`, bloqueando selección real de sede/espacio en el modal futuro.

## Ya resueltos en esta sesión (no reabrir sin evidencia nueva)

- Permisos "maestro asignado" no aplicados ni en frontend ni en backend → resuelto en 12.2.
- Choque de instructor entre sedes distintas no detectado → resuelto en 12.3.
- Sin concurrencia optimista (último que guarda gana en silencio) → resuelto en 12.4.

## Cosméticos / bajo impacto, no atendidos (fuera de alcance del módulo 12)

- Mojibake preexistente en comentarios de `firestore.rules` (`acadÃ©mico` en vez de `académico`). Ver `ERROR_LOG.md`.
- Falla preexistente en `jornadaContextService.test.ts` ("instructores activos"), no relacionada con esta sesión, aislada con `git stash` durante la verificación de 12.3.
- Ruido de tipos Chai/Cypress sobre `expect` de Jest en `tsc --noEmit` para archivos `*.test.ts(x)` — documentado desde sesiones anteriores del proyecto.

## Riesgo operativo abierto

El repo tiene un volumen grande de cambios sin commitear acumulados de sesiones previas (visible en `git status`), sumado ahora a los cambios del módulo 12. El usuario pidió explícitamente revisar y commitear todo junto al terminar el módulo 12 completo — hasta entonces, el working tree permanece con cambios pendientes de forma intencional. Ver `RECOMMENDATIONS.md`.

## Cierre prematuro de esta sesión por hook compartido (2026-07-09)

Esta sesión no terminó por decisión del usuario de pausar el módulo 12: un hook `Stop` agregado desde otra ventana de Claude Code abierta en paralelo sobre el mismo repo (config de proyecto compartida y con recarga en vivo) empezó a dispararse acá también, sin respuesta del usuario, y esta sesión generó su documentación de cierre siguiendo esa instrucción. **12.5–12.12 quedan pendientes y son el próximo paso**, no trabajo descartado. Detalle completo en `ERROR_LOG.md` (ítems 5–6) y `HANDOVER.md`.
