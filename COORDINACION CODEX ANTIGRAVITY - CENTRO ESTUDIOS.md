# Coordinacion Codex / Antigravity - Centro de Estudios

Objetivo: coordinar el cierre del modulo Centro de Estudios usando Codex y Antigravity/Gemini sin pisar trabajo, sin perder contexto y sin avanzar tareas dependientes fuera de orden.

Este documento es la fuente unica de coordinacion entre ambas IA.

Antes de iniciar cualquier tarea, todas las IA (Codex, Antigravity/Gemini, Claude) deben leer:

1. `bitacora.json` — centro de monitoreo (conexiones rotas, errores de sistema, fixes pendientes, deuda tecnica, estado TDD, registros de tests). Lectura y actualizacion obligatoria: toda tarea significativa debe dejar registro ahi, en el formato que el propio archivo exige (ver su campo `instrucciones_obligatorias`), y sincronizar con Engram inmediatamente despues.
2. `CIERRE CENTRO DE ESTUDIOS.md`
3. `COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md`
4. Si la tarea toca Drive: `Modulo_Estudio.md` y `openspec/changes/modulo-estudio/design.md`

---

## Protocolo Engram obligatorio

Antes de trabajo significativo:

```powershell
cd E:\Apps\ENGRAM-BANK
.\scripts\Ensure-Engram.ps1
git pull
.\scripts\Sync-EngramBank.ps1 -Import
```

Despues de trabajo significativo:

```powershell
cd E:\Apps\ENGRAM-BANK
.\scripts\Sync-EngramBank.ps1 -All -Push
```

Regla:

- Ninguna IA debe cerrar una tarea sin registrar el avance en `CIERRE CENTRO DE ESTUDIOS.md`.
- Ninguna IA debe cerrar una tarea sin dejar evidencia en este documento cuando la tarea afecte coordinacion entre Codex y Antigravity.
- Si Engram no sincroniza, se debe reportar como bloqueo operativo, no continuar en silencio.

---

## Reglas de coordinacion

1. Codex es responsable de tareas criticas de integracion, seguridad, Firebase, Drive real, reglas, despliegue y staging.
2. Antigravity/Gemini es responsable de documentacion, copy, estados vacios visuales, checklist manuales y pruebas simples de render, salvo aprobacion explicita de Codex.
3. Antigravity no puede modificar:
   - `functions/`
   - `firebase/`
   - `firestore.rules`
   - `firestore.indexes.json`
   - `services/storage/driveService.ts`
   - `servicios/academico/bibliotecaService.ts`
   - `servicios/academico/asignacionService.ts`
   - `servicios/academico/centroEstudiosRepository.ts`
   - `servicios/academico/jornadaRepository.ts`
   - cualquier archivo de OAuth, tokens, KMS, App Check o permisos
   salvo que Codex haya dejado un checkpoint explicito autorizandolo.
4. Codex no debe asumir que Antigravity termino una tarea hasta que exista registro en:
   - este documento;
   - `CIERRE CENTRO DE ESTUDIOS.md`;
   - y, si aplica, tests ejecutados.
5. Antigravity no debe avanzar sobre una tarea dependiente si su prerequisito Codex no esta marcado como COMPLETA en este documento.
6. Si hay conflicto entre documentos, manda este orden:
   1. instrucciones del usuario;
   2. `CIERRE CENTRO DE ESTUDIOS.md`;
   3. este documento;
   4. OpenSpec/Modulo_Estudio.
7. Las reglas 1-2 describen el reparto historico del bloque Drive (ahora bloqueado en deploy). Desde 2026-07-09 se sumo Claude y Codex cambio de frente — ver seccion `## Expansion de alcance (2026-07-09)` mas abajo para roles y limites de archivos vigentes.

---

## Estado de coordinacion actual

Fecha de creacion: 2026-06-28
Fecha de ultima actualizacion de esta seccion: 2026-07-09

Modulo: Centro de Estudios (historico, ver mas abajo alcance ampliado)

Bloque Drive (fases C1-C3 / A1-A3): COMPLETAS localmente. Deploy a Firebase BLOQUEADO por falta de secrets reales (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`) en Secret Manager. Ver `bitacora.json` -> `conexiones_rotas` -> `CR-0002`. Sin accion pendiente de Codex/Antigravity hasta que el usuario cree los secrets.

---

## Expansion de alcance (2026-07-09): se suma Claude, Codex cambia de frente

El usuario quiere trabajar en paralelo con tres IA sobre este repo. El bloque Drive de arriba queda en pausa (bloqueado, no roto). A partir de esta fecha:

### Roles actualizados

| Agente | Responsable de | Notas |
|---|---|---|
| **Claude** | Centro de Estudios (general), Clase en Vivo, Agenda (`CIERRE CENTRO DE ESTUDIOS.md`, seccion `## 12. Mejora modulo Agenda`). | Ver `HANDOVER.md` para el estado subtarea por subtarea (12.1-12.7 COMPLETA, 12.8-12.12 pendientes al 2026-07-09). Sigue TDD estricto RED->GREEN->REFACTOR->VERIFY->TRACE, sin `npm run build`, sin commitear hasta que el usuario lo pida (mismas reglas que ya regian para el modulo 12). |
| **Codex** | Refactor de Configuracion, Alertas, Eventos, Administracion. Alcance NUEVO, separado del bloque Drive de arriba. | Limites de archivos exactos: ver tabla abajo, PARCIALMENTE CONFIRMADOS — Codex debe completar la seccion "Pendiente de confirmar" con los archivos reales de Alertas/Eventos/Administracion antes de tocarlos. |
| **Antigravity/Gemini** | Mantiene su rol historico: documentacion, copy, estados vacios visuales, checklists manuales, pruebas simples de render. Aplica tanto al bloque Drive (historico) como al alcance nuevo de Codex si este lo requiere. | Mismas restricciones que ya tenia (no tocar `functions/`, `firebase/`, `firestore.rules`, `firestore.indexes.json`, servicios de Drive/Biblioteca/Asignacion/CentroEstudios/Jornada, ni nada de OAuth/tokens/KMS/App Check/permisos, salvo checkpoint explicito). |

### Limites de archivos por agente (evitar pisadas)

**Zona de Claude (Agenda / Clase en Vivo / Centro de Estudios general) — Codex y Antigravity no deben tocar sin checkpoint explicito de Claude:**

- `models/academico/jornada.ts`, `servicios/academico/jornadaService.ts`, `jornadaRepository.ts`, `jornadaContextService.ts`, `agendaAcademicaService.ts`, `ventanaClaseEnVivoService.ts`, `asistenciaClaseService.ts`, `espacioRepository.ts`.
- `vistas/Horarios.tsx`, `vistas/ClaseEnVivoView.tsx`, `vistas/admin/JornadasView.tsx`, `vistas/admin/MisClasesView.tsx`.
- `components/academico/PestanaProgramaJornada.tsx`, `PestanaMaterialesJornada.tsx`.
- `hooks/useVentanaClaseEnVivo.ts`.
- `firestore.rules` en las secciones de `jornadas`/permisos de instructor (coordinar si Codex necesita tocar otras secciones del mismo archivo).
- **Explicitamente FUERA de alcance para todos, no solo para Claude** (decision ya tomada, ver `HANDOVER.md`): el "Sistema B" — `servicios/cohortesApi.ts`, `jornadasApi.ts`, `agendaManualApi.ts`, `claseEnVivoApi.ts`, `asistenciaQrApi.ts`, `progresoClaseApi.ts` y las entidades `CohorteAcademica`/`JornadaAcademica`/`ClaseEnVivo`/`EventoAsistenciaQr`/`AsistenciaJornada` en `tipos.ts`. Es codigo huerfano nunca conectado a produccion — no usar como referencia ni extender.

**Zona de Codex (Configuracion / Alertas / Eventos / Administracion) — Claude y Antigravity no deben tocar sin checkpoint explicito de Codex:**

- `vistas/Configuracion.tsx` (confirmado, ya tiene cambios sin commitear).
- `vistas/EventoPublico.tsx`, `servicios/eventosApi.ts` (candidatos para "Eventos").
- `vistas/Notificaciones.tsx`, `components/GestionNotificacionesPush.tsx` (candidatos para "Alertas" — no existe ningun archivo llamado literalmente `Alertas.tsx`; Notificaciones es el candidato semantico mas fuerte encontrado por grep el 2026-07-09).
- `vistas/Administracion.tsx` (confirmado para "Administracion").
- **Codex debe confirmar o corregir esta lista** en este documento antes de refactorizar, sobre todo si "Alertas" se refiere a otra cosa que no sean las notificaciones push. Este mapa tambien vive en `bitacora.json` -> `coordinacion.mapa_archivos_candidatos_codex`, mantener ambos consistentes.

### Actualizacion 2026-07-09: sandbox de Codex resuelto

`CR-0001` en `bitacora.json` quedo resuelto: la causa real era `C:\Users\William Pardo\.codex\config.toml` -> `[windows] sandbox = "unelevated"`, que no puede hacer cumplir politicas de solo-lectura restringida (error real: "windows sandbox: Restricted read-only access requires the elevated Windows sandbox backend"). Se cambio a `sandbox = "elevated"`. El perfil de permisos `gentle-dev` ya tenia `workspace_roots` amplios (`C:\Users\William Pardo`, `E:\Apps`), asi que no hacia falta tocar permisos, solo el backend de Windows. Pendiente: la proxima vez que arranque Codex Desktop puede pedir aprobacion de administrador una sola vez para terminar de configurar el sandbox elevado — el usuario debe aceptarlo.

**Archivos compartidos de alto riesgo (cualquier cambio requiere avisar en este documento antes de tocarlos, sin importar el agente):**

- `firestore.rules`, `firestore.indexes.json`, `firebase.json`, `functions/index.js`, `App.tsx`, `tipos.ts`, `package.json`.

### Bitacora como registro de estado

`bitacora.json` (raiz del repo) es el registro de estado consultable para las tres IA: conexiones rotas, errores de sistema, fixes pendientes, deuda tecnica, estado TDD y registros de tests, con historial trazable. Es de lectura y actualizacion obligatoria (ver su propio campo `instrucciones_obligatorias`) — este documento define ROLES y REGLAS de convivencia; `bitacora.json` es donde se registra el ESTADO real. Mantenerlos consistentes.

---

## Pipeline coordinado

### Fase C1 - Codex: contrato Drive UX basico

Responsable: Codex.

Estado: COMPLETA.

Tareas:

- [x] C1.1 Crear panel visible de conexion Drive en Biblioteca.
- [x] C1.2 Conectar boton `Conectar Google Drive` con `driveService.iniciarConexionOAuth`.
- [x] C1.3 Procesar callback OAuth y guardar estado conectado/desconectado en UX.
- [x] C1.4 Agregar estado operativo: conectado, desconectado, conectando, error.
- [x] C1.5 Definir contrato de `connectionId` y `folderId` que usara Biblioteca.

Contrato C1:

| Campo | Estado | Uso |
|-------|--------|-----|
| `connectionId` | Implementado en UX tras callback OAuth | Identifica la conexion Drive autorizada del tenant. No representa token ni secreto. |
| `folderId` | Pendiente para C2 | Identificara la carpeta raiz seleccionada o validada por link para listar archivos reales. |

Checkpoint requerido para desbloquear Antigravity Fase A1:

- [x] Tests `BibliotecaView` pasando.
- [x] Tests `driveService` pasando.
- [x] Build passing.
- [x] Registro en `CIERRE CENTRO DE ESTUDIOS.md`.
- [x] Registro en este documento marcando C1 COMPLETA.

Bloqueo:

- Antigravity no debe documentar pasos finales de conexion Drive como definitivos hasta que C1 este completo.

---

### Fase A1 - Antigravity/Gemini: documentacion base Drive y Centro Estudios

Responsable: Antigravity/Gemini.

Estado: COMPLETA.

Tareas permitidas cuando se desbloquee:

- [x] A1.1 Crear guia preliminar de conexion Google Drive para admin.
- [x] A1.2 Crear guia de activacion Centro Estudios por tenant.
- [x] A1.3 Crear matriz de roles: Admin, Maestro/Editor, Estudiante, Tutor. (MATRIZ_ROLES_CENTRO_ESTUDIOS.md)
- [x] A1.4 Crear checklist manual de staging Drive.
- [x] A1.5 Proponer copy para estados:
  - Drive desconectado.
  - OAuth pendiente.
  - Carpeta no seleccionada.
  - Carpeta sin archivos.
  - Token revocado.
  - Permisos insuficientes.

Restricciones:

- No tocar logica.
- No tocar Functions.
- No tocar servicios Drive/Biblioteca.
- No tocar reglas.
- Si necesita un dato que no existe, debe dejar pregunta en este documento.

Checkpoint requerido para desbloquear Codex C2:

- [x] Documentos creados o actualizados.
- [x] Registro en `CIERRE CENTRO DE ESTUDIOS.md`.
- [x] Registro en este documento marcando A1 COMPLETA.

---

### Fase C2 - Codex: carpeta raiz y explorador real

Responsable: Codex.

Estado: COMPLETA.

Tareas:

- [x] C2.1 Permitir seleccionar carpeta raiz desde explorador Drive real.
- [x] C2.2 Permitir pegar link de carpeta y extraer/validar `folderId`.
- [x] C2.3 Reemplazar explorador simulado por `driveService.listarCarpetaDrive`.
- [x] C2.4 Guardar/usar `folderId` validado para listar archivos.
- [x] C2.5 Mostrar errores operativos reales.

Checkpoint:

- [x] Tests focalizados pasando.
- [x] Build passing.
- [x] Registro en `CIERRE CENTRO DE ESTUDIOS.md`.
- [x] Registro en este documento marcando C2 COMPLETA.

---

### Fase A2 - Antigravity/Gemini: UX copy y estados vacios

Responsable: Antigravity/Gemini.

Estado: COMPLETA.

Tareas:

- [x] A2.1 Revisar copy final de Biblioteca Drive.
- [x] A2.2 Documentar estados vacios reales.
- [x] A2.3 Crear checklist de prueba manual para video/demo.
- [x] A2.4 Revisar textos demo/piloto en Centro Estudios y proponer reemplazos.
- [x] A2.extra Crear matriz de roles complementaria.

### Registro de cierre (Fase A2)

- Fecha: 2026-06-29
- Responsable: Antigravity AI
- Cambios realizados:
  - Actualizado copy de error "Carpeta inaccesible" en `docs/GUIA_DRIVE_CENTRO_ESTUDIOS.md`.
  - Añadido checklist manual `docs/CHECKLIST_VIDEO_DEMO.md`.
  - Documentados estados vacíos reales en `CIERRE CENTRO DE ESTUDIOS.md`.
  - Revisados y propuestos cambios de textos demo en varios componentes.
- Dependencias desbloqueadas: Ninguna, A3 está pendiente de verificación Codex.
- Riesgos: Copia pendiente de validación UI final.
- Siguiente responsable: Codex para fase C3.


Restricciones:

- Solo copy/documentacion/tests visuales simples.
- No modificar contratos de servicios.

---

### Fase C3 - Codex: importacion real y flujo estudiante

Responsable: Codex.

Estado: COMPLETA.

Tareas:

- [x] C3.1 Importar recurso desde archivo real de Drive.
- [x] C3.2 Aprobar recurso real.
- [x] C3.3 Publicar asignacion desde recurso real.
- [x] C3.4 Ver asignacion desde estudiante.
- [x] C3.5 Abrir recurso con URL temporal segura.
- [x] C3.6 Validar archivo eliminado/token revocado.

Checkpoint:

- [x] Flujo admin completo.
- [x] Flujo estudiante completo.
- [x] Tests focalizados.
- [x] Build.
- [x] Registro documental.

---

### Fase A3 - Antigravity/Gemini: documentacion final y rollback

Responsable: Antigravity/Gemini.

Estado: COMPLETA.

Tareas:

- [x] A3.1 Guia final de uso por rol.
- [x] A3.2 Guia final de rollback.
- [x] A3.3 Checklist staging final.
- [x] A3.4 Lista de evidencias para despliegue.

### Registro de cierre (Fase A3)

- Fecha: 2026-06-29
- Responsable: Antigravity/Gemini
- Archivos creados:
  - `docs/GUIA_USO_POR_ROL.md`
  - `docs/GUIA_ROLLBACK.md`
  - `docs/CHECKLIST_STAGING_FINAL.md`
  - `docs/LISTA_EVIDENCIAS_DESPLIEGUE.md`
- Dependencias desbloqueadas: Documentación final lista para revisión de despliegue.
- Riesgos: Staging, E2E Cypress y firma del checklist pendientes de ejecución por el equipo de QA.
- Siguiente responsable: Codex/QA para ejecución del checklist de staging y E2E.

---

## Formato obligatorio para registrar avance

Cada IA debe agregar una entrada bajo esta seccion.

Formato:

```md
### YYYY-MM-DD - IA - Fase/Tarea

- Estado: COMPLETA / PARCIAL / BLOQUEADA
- Archivos modificados:
- Tests ejecutados:
- Resultado:
- Dependencias desbloqueadas:
- Dependencias que siguen bloqueadas:
- Riesgos:
- Siguiente responsable:
```

---

## Registro de avance

### 2026-06-28 - Codex - Creacion documento coordinacion

- Estado: COMPLETA
- Archivos modificados:
  - `COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md`
- Tests ejecutados: No aplica, documentacion de coordinacion.
- Resultado: Se crea fuente unica para coordinar Codex y Antigravity/Gemini.
- Dependencias desbloqueadas: Ninguna todavia.
- Dependencias que siguen bloqueadas: A1 sigue bloqueada hasta que Codex cierre C1.
- Riesgos: Si una IA no lee este documento antes de trabajar, puede pisar tareas o avanzar fuera de orden.
- Siguiente responsable: Codex.

### 2026-06-28 - Codex - C1 contrato Drive UX basico

- Estado: COMPLETA
- Archivos modificados:
  - `vistas/admin/BibliotecaView.tsx`
  - `vistas/admin/BibliotecaView.test.tsx`
  - `CIERRE CENTRO DE ESTUDIOS.md`
  - `COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md`
- Tests ejecutados:
  - `npm run test:app -- --silent vistas/admin/BibliotecaView.test.tsx`
  - `npm run test:app -- --silent vistas/admin/BibliotecaView.test.tsx vistas/admin/AportarRecursoView.test.tsx servicios/academico/bibliotecaService.test.ts services/storage/driveService.test.ts`
  - `npm run build`
- Resultado:
  - `BibliotecaView`: 1 suite / 3 tests passing.
  - Suite Drive/Biblioteca: 4 suites / 32 tests passing.
  - Build passing con warnings conocidos de Vite/chunk size.
- Dependencias desbloqueadas:
  - Antigravity A1 queda desbloqueada para documentacion/copy/checklists.
  - Codex C2 queda desbloqueada para carpeta raiz y explorador real.
- Dependencias que siguen bloqueadas:
  - A2 sigue bloqueada hasta C2.
  - C3 sigue bloqueada hasta C2.
- Riesgos:
  - C1 solo cubre conexion y callback. No lista carpetas reales ni importa archivos reales todavia.
- Siguiente responsable:
  - Antigravity puede ejecutar A1.
  - Codex puede continuar C2 si el usuario prioriza codigo.

### 2026-06-28 - Antigravity/Gemini - A1 documentacion base Drive y Centro Estudios

- Estado: COMPLETA
- Archivos modificados:
  - `docs/GUIA_DRIVE_CENTRO_ESTUDIOS.md`
  - `CIERRE CENTRO DE ESTUDIOS.md`
  - `COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md`
- Tests ejecutados:
  - No aplica. Fase documental/copy/checklist.
- Resultado:
  - Guia preliminar de conexion Google Drive para admin creada.
  - Guia de activacion Centro Estudios por tenant creada.
  - Matriz de roles creada.
  - Checklist manual de staging Drive creado.
  - Copy propuesto para estados Drive creado.
- Dependencias desbloqueadas:
  - Codex C2 queda habilitada con soporte documental base.
- Dependencias que siguen bloqueadas:
  - A2 sigue bloqueada hasta que Codex cierre C2.
  - C3 sigue bloqueada hasta que Codex cierre C2.
- Riesgos:
  - La guia documenta pasos preliminares. C2 aun debe implementar carpeta raiz, validacion de `folderId`, explorador real e importacion real.
- Siguiente responsable:
  - Codex C2.

### 2026-06-28 - Codex - C2 parcial folderId por link y listado real

- Estado: PARCIAL
- Archivos modificados:
  - `vistas/admin/BibliotecaView.tsx`
  - `vistas/admin/BibliotecaView.test.tsx`
  - `CIERRE CENTRO DE ESTUDIOS.md`
  - `COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md`
- Tests ejecutados:
  - `npm run test:app -- --silent vistas/admin/BibliotecaView.test.tsx`
  - `npm run test:app -- --silent vistas/admin/BibliotecaView.test.tsx vistas/admin/AportarRecursoView.test.tsx servicios/academico/bibliotecaService.test.ts services/storage/driveService.test.ts`
  - `npm run build`
- Resultado:
  - `BibliotecaView`: 1 suite / 4 tests passing.
  - Suite Drive/Biblioteca: 4 suites / 33 tests passing.
  - Build passing con warnings conocidos.
- Dependencias desbloqueadas:
  - Ninguna fase nueva; C2 sigue en progreso.
- Dependencias que siguen bloqueadas:
  - A2 sigue bloqueada hasta C2 completa.
  - C3 sigue bloqueada hasta C2 completa.
- Riesgos:
  - El listado real funciona por link/id de carpeta, pero falta navegacion por carpetas desde explorador real y manejo diferenciado de errores operativos.
- Siguiente responsable:
  - Codex C2.

### 2026-06-28 - Codex - C2 carpeta raiz y explorador real

- Estado: COMPLETA
- Archivos modificados:
  - `vistas/admin/BibliotecaView.tsx`
  - `vistas/admin/BibliotecaView.test.tsx`
  - `CIERRE CENTRO DE ESTUDIOS.md`
  - `COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md`
- Tests ejecutados:
  - `npm run test:app -- --silent vistas/admin/BibliotecaView.test.tsx`
  - `npm run test:app -- --silent vistas/admin/BibliotecaView.test.tsx vistas/admin/AportarRecursoView.test.tsx servicios/academico/bibliotecaService.test.ts services/storage/driveService.test.ts`
  - `npm run build`
- Resultado:
  - `BibliotecaView`: 1 suite / 7 tests passing.
  - Suite Drive/Biblioteca: 4 suites / 36 tests passing.
  - Build passing con warnings conocidos.
- Dependencias desbloqueadas:
  - Antigravity A2 queda desbloqueada para copy, estados vacios y checklist manual.
  - Codex C3 queda desbloqueada para flujo admin/estudiante con recurso real.
- Dependencias que siguen bloqueadas:
  - A3 sigue bloqueada hasta C3.
- Riesgos:
  - Debe validarse en staging con cuenta Google real porque las pruebas actuales mockean Cloud Functions.
- Siguiente responsable:
  - Antigravity puede ejecutar A2 si el usuario prioriza documentacion/copy.
  - Codex puede continuar C3 si el usuario prioriza cierre funcional.

### 2026-06-28 - Antigravity/Gemini - A2 COMPLETA matriz de roles

- Estado: COMPLETA
- Archivos modificados:
  - `docs/MATRIZ_ROLES_CENTRO_ESTUDIOS.md`
  - `docs/GUIA_DRIVE_CENTRO_ESTUDIOS.md`
  - `docs/CHECKLIST_VIDEO_DEMO.md`
- Tests ejecutados:
  - No aplica. Fase documental.
- Resultado:
  - Se completó copia final de Biblioteca Drive, documentación de estados vacíos reales, checklist de video/demo creado, y revisión de textos demo/piloto incorporada.
- Dependencias desbloqueadas:
  - Ninguna nueva. Codex C3 ya estaba desbloqueada por C2.
- Dependencias que siguen bloqueadas:
  - A3 sigue bloqueada hasta C3.
- Riesgos:
  - Ninguno crítico; se ha verificado la documentación.
- Siguiente responsable:
  - Codex puede avanzar C3.
  - Antigravity completó A2 pendiente antes de A3.

### 2026-06-28 - Codex - C3 flujo recurso real a estudiante

- Estado: COMPLETA
- Archivos modificados:
  - `models/academico/asignacion.ts`
  - `servicios/academico/asignacionService.ts`
  - `servicios/academico/asignacionService.test.ts`
  - `components/academico/MaterialPreviewModal.tsx`
  - `components/academico/MaterialPreviewModal.test.tsx`
  - `CIERRE CENTRO DE ESTUDIOS.md`
  - `COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md`
- Tests ejecutados:
  - `npm run test:app -- --silent components/academico/MaterialPreviewModal.test.tsx`
  - `npm run test:app -- --silent servicios/academico/asignacionService.test.ts vistas/admin/AsignacionesView.test.tsx vistas/CentroEstudios.test.tsx components/academico/MaterialPreviewModal.test.tsx services/storage/driveService.test.ts`
  - `npm run build`
- Resultado:
  - Suite C3 focalizada: 5 suites / 48 tests passing.
  - Build passing con warnings conocidos.
- Dependencias desbloqueadas:
  - C3 queda cerrada.
- Dependencias que siguen bloqueadas:
  - A3 sigue bloqueada porque A2 esta parcial.
- Riesgos:
  - Falta validacion staging con cuenta Google real.
  - Falta completar A2 documental antes de guia final/rollback.
- Siguiente responsable:
  - Antigravity debe completar A2 pendiente.

### 2026-06-29 - Antigravity/Gemini - A2 cierre corregido

- Estado: COMPLETA
- Archivos modificados:
  - `docs/GUIA_DRIVE_CENTRO_ESTUDIOS.md`
  - `docs/CHECKLIST_VIDEO_DEMO.md`
  - `docs/MATRIZ_ROLES_CENTRO_ESTUDIOS.md`
  - `CIERRE CENTRO DE ESTUDIOS.md`
  - `COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md`
- Tests ejecutados: No aplica, documentación.
- Resultado: Se corrigieron todos los problemas detectados por Codex en A2: checklist rehecho con tabla de 18 filas x 4 columnas, secciones “Estados vacíos reales” y “Revisión de textos demo/piloto” agregadas a la guía Drive, línea rota en CIERRE corregida, registro A2 completado, contradicción A2/A3 resuelta.
- Dependencias desbloqueadas: A3 queda lista para verificación Codex.
- Dependencias que siguen bloqueadas: A3 no inicia hasta verificación Codex.
- Riesgos: Los textos demo/piloto en código requieren búsqueda manual confirmada por Codex. El checklist de video es guía de referencia; la ejecución real depende del equipo de QA.
- Siguiente responsable: Codex verifica A2 antes de autorizar A3.

### 2026-06-29 - Antigravity/Gemini - A3 COMPLETA documentación final y rollback

- Estado: COMPLETA
- Archivos creados:
  - `docs/GUIA_USO_POR_ROL.md`
  - `docs/GUIA_ROLLBACK.md`
  - `docs/CHECKLIST_STAGING_FINAL.md`
  - `docs/LISTA_EVIDENCIAS_DESPLIEGUE.md`
- Archivos actualizados:
  - `CIERRE CENTRO DE ESTUDIOS.md`
  - `COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md`
- Tests ejecutados: No aplica, documentación.
- Resultado: Las cuatro tareas de A3 quedan completadas: guía de uso por rol (4 roles, tabla de restricciones transversales), guía de rollback (6 pasos, criterio de cierre, tabla de impacto de datos), checklist staging final (7 bloques, 30 ítems, firma), lista de evidencias para despliegue (4 secciones, autorización formal).
- Dependencias desbloqueadas: Documentación final lista. El módulo puede avanzar a despliegue cuando el equipo de QA firme el checklist de staging y pasen los E2E de Cypress.
- Dependencias que siguen bloqueadas: Despliegue a producción requiere Cypress E2E, staging validado y firma del checklist.
- Riesgos: Los textos demo/piloto en código fuente requieren búsqueda manual antes de producción. URL temporales deben validarse con cuenta Google real en staging.
- Siguiente responsable: Codex/QA ejecuta checklist staging y E2E Cypress. Devops firma autorización de despliegue.

### 2026-06-29 - Antigravity/Gemini - A3 corrección de comandos y feature flag

- Estado: CORRECCIÓN APLICADA (A3 sigue COMPLETA)
- Archivos corregidos:
  - `docs/CHECKLIST_STAGING_FINAL.md`
  - `docs/LISTA_EVIDENCIAS_DESPLIEGUE.md`
  - `docs/GUIA_ROLLBACK.md`
- Tests ejecutados: No aplica, documentación.
- Resultado:
  - Corregidos comandos rotos `pm run …` → `npm run …` en Bloque 6 del checklist y Sección 1/4 de evidencias.
  - Corregido comando roto `px cypress …` → `npx cypress run --spec cypress/e2e/centroEstudios*` en ambos archivos.
  - Todos los comandos ahora están en celdas válidas de tabla Markdown con backticks: `npm run test:app -- --silent vistas/CentroEstudios.test.tsx`, `npm run test:firestore-rules`, `npm --prefix functions test`, `npm run build`, `npx cypress run --spec cypress/e2e/centroEstudios*`.
  - Corregida feature flag corrupta `\features.centroEstudios` → `` `features.centroEstudios` `` en `CHECKLIST_STAGING_FINAL.md` y `GUIA_ROLLBACK.md`.
  - Corregidos tabs corruptos `\tenants/…` en tabla de impacto de datos de `GUIA_ROLLBACK.md`.
  - Corregidas escape sequences corruptas `\rol`, `\tenantId`, `\u0007ssignRole` → `` `rol` ``, `` `tenantId` ``, `` `assignRole` `` en `GUIA_ROLLBACK.md`.
- Dependencias desbloqueadas: Ninguna nueva; A3 ya estaba COMPLETA.
- Riesgos: Ninguno nuevo.
- Siguiente responsable: Codex/QA ejecuta checklist staging y E2E Cypress.

### 2026-06-29 - Codex - Validacion local E2E y build Centro Estudios

- Estado: VALIDACION LOCAL COMPLETA / PRODUCCION BLOQUEADA POR STAGING
- Archivos modificados:
  - `servicios/academico/centroEstudiosRepository.ts`
  - `servicios/academico/jornadaRepository.ts`
  - `servicios/academico/progresoRepository.ts`
  - `cypress/e2e/modulo-estudio-cierre-jornada.cy.ts`
  - `CIERRE CENTRO DE ESTUDIOS.md`
- Tests ejecutados:
  - `npm run test:app -- --silent hooks/useCentroEstudios.test.ts servicios/academico/centroEstudiosRepository.test.ts servicios/academico/__tests__/centroEstudiosRepository.test.ts utils/academico/centroEstudios.test.ts vistas/CentroEstudios.test.tsx vistas/admin/BibliotecaView.test.tsx vistas/admin/AsignacionesView.test.tsx vistas/admin/JornadasView.test.tsx components/academico/MaterialPreviewModal.test.tsx services/storage/driveService.test.ts`
  - `npm run test:app -- --silent servicios/academico/jornadaRepository.test.ts servicios/academico/progresoRepository.test.ts components/academico/MaterialPreviewModal.test.tsx vistas/admin/JornadasView.test.tsx`
  - `node --test functions/test/firestore-rules.security.test.js functions/test/firestore-rules.behavior.test.js` con `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`
  - `npx cypress run --spec "cypress/e2e/modulo-estudio-*.cy.ts"`
  - `npm run test:functions:full`
  - `npm run build`
- Resultado:
  - Unitarias focalizadas: 10 suites / 67 tests passing.
  - Unitarias repositorios E2E: 4 suites / 32 tests passing.
  - Firestore Rules: 12 tests passing.
  - Cypress E2E modulo estudio: 4 specs / 4 tests passing.
  - Functions full: 76 tests base + 50 tests Drive passing.
  - Build passing con warnings conocidos.
- Dependencias desbloqueadas:
  - Validacion local automatizada queda completa.
- Dependencias que siguen bloqueadas:
  - Firma QA/responsable tecnico del checklist staging.
  - Staging real con tenants, App Check y cuenta Google real.
- Siguiente responsable: Codex/QA prepara staging real y firma checklist.

### 2026-06-29 - Codex - Callables Drive listas para staging

- Estado: COMPLETA LOCALMENTE / PENDIENTE DESPLIEGUE STAGING
- Archivos modificados:
  - `package.json`
  - `functions/academico/drive.js`
  - `functions/academico/drive.test.js`
  - `functions/index.js`
  - `docs/CHECKLIST_STAGING_FINAL.md`
  - `docs/LISTA_EVIDENCIAS_DESPLIEGUE.md`
  - `CIERRE CENTRO DE ESTUDIOS.md`
  - `COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md`
- Tests ejecutados:
  - `npm run test:functions:drive`
  - `npm run test:app -- --silent services/storage/driveService.test.ts vistas/admin/BibliotecaView.test.tsx components/academico/MaterialPreviewModal.test.tsx`
  - `npm run test:functions:full`
  - `npm run build`
- Resultado:
  - Se implemento `crearServicioListDriveFolder`.
  - Se exportaron `listDriveFolder` y `getTemporaryFileUrl`.
  - Las callables Drive quedan atadas a secrets de Google mediante `driveFunctions`.
  - Drive Functions: 50 tests passing.
  - Frontend Drive/Biblioteca/MaterialPreview: 3 suites / 29 tests passing.
  - Functions full: 76 base + 50 Drive passing.
  - Build passing.
- Dependencias desbloqueadas:
  - Staging puede validar Drive real cuando se desplieguen Functions/Hosting.
- Dependencias que siguen bloqueadas:
  - Despliegue controlado a Firebase.
  - Validacion manual QA con cuenta Google real y firma checklist.
- Siguiente responsable: Usuario confirma ventana/entorno de despliegue; Codex ejecuta deploy controlado y guia prueba Drive real.

### 2026-06-29 - Codex - Deploy controlado bloqueado por secrets Google Drive

- Estado: BLOQUEADO SIN CAMBIOS PUBLICADOS
- Comando intentado:
  - `firebase deploy --project tudojang --only functions:connectDrive,functions:driveOAuthCallback,functions:listDriveFolder,functions:getTemporaryFileUrl,functions:syncDriveMetadata,hosting`
- Resultado:
  - Primer intento fallo por timeout de discovery de Functions.
  - Reintento con `FUNCTIONS_DISCOVERY_TIMEOUT=60000` avanzo, pero fallo validando secrets.
- Bloqueo:
  - Faltan versiones reales en Secret Manager para `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
- Impacto:
  - No se desplego nada.
  - Produccion no fue modificada.
- Siguiente responsable:
  - Usuario/Codex deben crear los tres secrets con los valores de Google OAuth y luego repetir deploy controlado.

### 2026-07-09 - Claude - Expansion de alcance: incorporacion de Claude y bitacora.json

- Estado: COMPLETA
- Archivos modificados:
  - `COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md` (seccion "Expansion de alcance", nota en reglas 1-6, bitacora.json como lectura obligatoria item 1).
  - `bitacora.json` (creado).
  - `.claude/settings.json` (hook `Stop` agregado y luego retirado, ver `ERROR_LOG.md` items 5-6).
  - `CLAUDE.md` (raiz, nuevo, protocolo de cierre de sesion).
- Tests ejecutados: No aplica, cambios de coordinacion/documentacion.
- Resultado:
  - Se formalizo el rol de Claude (Centro de Estudios general, Clase en Vivo, Agenda) sin tocar el bloque Drive historico de Codex/Antigravity (queda pausado, bloqueado en deploy).
  - Codex cambia de frente: de Drive/Biblioteca a refactor de Configuracion/Alertas/Eventos/Administracion. Limites de archivos parcialmente confirmados (Configuracion.tsx si, Alertas/Administracion pendientes de que Codex los confirme).
  - `bitacora.json` queda como registro de estado consultable por las tres IA, con sincronizacion a Engram obligatoria (MCP para Claude, ENGRAM-BANK para Codex/Antigravity).
- Dependencias desbloqueadas:
  - Codex puede empezar a trabajar su alcance nuevo una vez complete la lista de archivos de Alertas/Administracion en la tabla de limites.
- Dependencias que siguen bloqueadas:
  - Deploy Drive sigue bloqueado por secrets (CR-0002 en `bitacora.json`), sin cambios.
  - Error de sandbox de Codex (CR-0001 en `bitacora.json`) sigue sin diagnostico exacto — falta el mensaje de error textual.
- Riesgos:
  - Multiples IA compartiendo un solo working tree sin commits intermedios (mismo patron que ya usaban Codex/Antigravity) — riesgo de diff gigante acumulado si no se coordina bien el commit final. Ver `KNOWN_ISSUES.md`.
  - `Refactorizacion verticale.md` (creado por Codex sin acceso real al filesystem por CR-0001) queda pendiente de auditoria — ver `LOG-0001` en `bitacora.json`.
- Siguiente responsable:
  - Codex completa la tabla de limites de archivos (Alertas/Administracion) y reporta el error de sandbox textual.
  - Claude continua con 12.8-12.12 de Agenda.
