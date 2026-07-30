# 🔍 Índice Técnico de Chats Claude — Tudojang

Documento que mapea sesiones de Claude con los temas desarrollados, para poder retomar contexto rápidamente.

---

## 📅 Sesión 18128 (2026-07-21)
**Proyecto:** `e--Apps-Tudojang-Workspace-Tudojang`  
**Tópico Principal:** Centro de Estudios — Cierre de Módulo 12 (Agenda)

### Temas Cubiertos:
1. ✅ **Auditoría de bugs de producción**
   - Firestore rules gap: rol 'Maestro' excluido de isInstructor()
   - Usuario no podía registrar auditoría como Maestro
   - **Fix aplicado:** Agregado 'Maestro' a isInstructor() + deploy

2. ✅ **Cloud Functions deployadas a producción**
   - `publishAsignacion` / `publishAsignacionesBatch` — publish de asignaciones
   - `registrarAsistenciaJornada` — matrícula automática y asistencia
   - `actualizarUsuarioStaff` — actualización segura de usuarios por Admin

3. ✅ **Matricula automática (DT-0023)**
   - Algoritmo: estudiante → ejecución automática si grupo+sede+pago+no-excluido
   - excepciones explícitas: retirada/inclusion manual
   - Cloud Function + Frontend + Service layer

4. ✅ **Rediseño visual de Mis Clases (DT-0024 a DT-0034)**
   - 4 pasadas de diseño basadas en feedback del usuario
   - Pill tema → clickeable para editar
   - Iconos Reagendar/Editar/Cancelar → fila vertical
   - Fecha + Horario en líneas separadas
   - Confirmación automática por horario (DT-0026)

5. ✅ **Centro de Estudios — Listo para producción**
   - PR `fix/hallazgos-producto-centro-estudios`
   - 6 commits: Progreso + 4 hallazgos + fix flake
   - Todos los tests verdes: 154 suites / 1628 pruebas
   - Pendiente: merge + deploy

### Archivos Tocados (principales):
- `firestore.rules` — Corregido rol Maestro
- `functions/academico/asignaciones.js` — Cloud Function publish
- `functions/academico/asistencia.js` — Cloud Function asistencia
- `functions/academico/usuarios.js` — Cloud Function actualización segura
- `vistas/admin/MisClasesView.tsx` — Rediseño completo (43 tests)
- `servicios/academico/inscripcionService.ts` — Matricula automática
- `firestore.rules` — Deploy a producción

---

## 📅 Sesión 16936 (2026-07-21)
**Proyecto:** `e--Apps-Tudojang-Workspace-Tudojang`  
**Tópico Principal:** Sincronización inicial de configuración

### Temas Cubiertos:
1. Verifi inicial del proyecto Tudojang
2. Revisión de bitacora.json y protocolo de documentación
3. Identificación de historiales y sesiones previas

---

## 📅 Sesión 22264 (2026-07-28)
**Proyecto:** `i--Apps-Tudojang-Workspace` (nueva sesión con usuario)  
**Tópico Principal:** Configuración global de IAs y protocolo de documentación

### Temas Cubiertos:
1. ✅ **Engram sincronización global**
   - Configuradas variables de entorno: ENGRAM_STORAGE, ENGRAM_BACKUP
   - Paths: `I:\Apps\engram` (principal), `I:\Apps\ENGRAM-BANK` (backup)
   - Verificación: variables activas y almacenamiento funcionando

2. ✅ **Protocolo bitacora.json ↔ HANDOVER.md**
   - bitacora.json = Source of truth (todos los debugs/avances)
   - HANDOVER.md = Respaldo/snapshot rápido (resumen ejecutivo)
   - Convención establecida para futuras sesiones

3. ✅ **Configuración Clara/Codex/Antigravity sincronizada**
   - Claude: opus + xhigh + custom:gentleman + engram plugin
   - Codex: config.toml con MCP servers (engram, context7, node_repl)
   - Paths actualizados: H:\ → C:\, E:\ → I:\
   - Proyectos trusted en Codex: I:\Apps, I:\Apps\Tudojang, etc.

4. ✅ **Historiales retomaos**
   - 4 sesiones Claude copiadas con metadata actualizada
   - 47 sesiones Codex copiadas (marzo a junio 2026)
   - Rutas en metadatos actualizadas automáticamente

5. 📄 **Documentación creada**
   - Este archivo: CLAUDE_HISTORIALES.md
   - Índice técnico: CLAUDE_CHATS_INDICE.md (este documento)

---

## 📅 Sesión 8108 (2026-07-28)
**Proyecto:** `i--Apps-Tudojang-Workspace\Tudojang`  
**Tópico Principal:** Configuración de bitacora.json como source of truth

### Temas Cubiertos:
1. ✅ **Establecimiento del protocolo**
   - bitacora.json ubicado en raíz del proyecto
   - 36 entradas de deuda técnica (DT-0001 a DT-0036)
   - 7 errores del sistema (ERR-0001 a ERR-0007)
   - 13 fixes por atender (FIX-0001 a FIX-0013)
   - Instrucciones obligatorias para NO sobrescribir sin leer

2. ✅ **Sincronización con engram**
   - Best-effort (nunca bloqueante)
   - Intento único con timeout corto
   - Registro de fallos en errores_sistema

3. ✅ **Memoria persistente activada**
   - Guardadas preferencias en `~/.claude/projects/.../memory/`
   - Spanish Preference: Colombian Spanish
   - Bitácora/Handover Protocol: documented

---

## 🎯 Estados Actuales por Módulo

### ✅ Centro de Estudios (Módulo 12) — COMPLETADO
**Estado:** Listo para deploy a producción  
**Referencia sesión:** 18128  
**PR:** `fix/hallazgos-producto-centro-estudios` (pendiente merge)  
**Archivos clave:** `bitacora.json` (DT-0024 a DT-0034)

**Qué se hizo:**
- 7 cadenas de integración cubiertas
- Auditoría de firestore.rules (ERR-0001, DT-0019)
- Cloud Functions deployadas (usuarios, asignaciones, asistencia)
- UI redesign con 4 pasadas de feedback
- Tests: 1628 pruebas, 154 suites, todas verdes

**Qué falta:**
- Merge del PR
- Deploy a Firebase hosting (deploy.yml)
- Pruebas en producción por usuario

---

### 🔄 Clase en Vivo — EN PROGRESO
**Estado:** Funcionalidad core completada, permisos en progreso  
**Referencia sesión:** 18128 (matricula automática)  
**Archivos clave:** `servicios/academico/inscripcionService.ts`

**Qué se hizo:**
- Matricula automática (DT-0023) — integrada
- Inicio automático de jornadas por horario (DT-0026) — Cloud Function
- Asistencia → EjecucionPrograma (registrarAsistenciaJornada) — deployed

**Qué falta:**
- DT-0012 (matriz de roles): Asistente/Editor permisoEdicionAgenda control visual
- DT-0036: Toggle en Configuracion.tsx (responsabilidad Codex)

---

### 📋 Infraestructura — VIGENTE
**Estado:** Estable con alertas  
**Referencia sesión:** Múltiples (bitacora.json)

**Alertas activas:**
- DT-0008: bitacora.json puede ser sobrescrito (mitigación: convención + git)
- DT-0009: Codex sin restricción de filesystem (aceptado conscientemente)
- DT-0010: Sistema B académico huérfano — ELIMINADO (FIX-0011)

---

## 🔗 Referencias Cruzadas

| Tema | Sesión | Archivo | Estado |
|------|--------|---------|--------|
| Engram setup | 22264 | `.claude/settings.json` | ✅ Completado |
| bitacora.json protocol | 8108 | `bitacora.json` | ✅ Establecido |
| Centro de Estudios | 18128 | `HANDOVER.md` | ✅ Completado |
| Clase en Vivo | 18128 | `servicios/academico/*` | 🔄 En progreso |
| Roles/Permisos | 18128 | `firestore.rules` | ✅ Deployado |
| Cloud Functions | 18128 | `functions/academico/*` | ✅ Deployado |

---

## 📝 Cómo Continuar

### Para la próxima sesión Claude:
1. Revisar `bitacora.json` (source of truth)
2. Revisar `HANDOVER.md` (estado actual)
3. Mirar PR `fix/hallazgos-producto-centro-estudios` (pendiente merge)
4. Si aplica, continuar con DT-0012 (matriz de roles)

### Para Codex:
1. Revisar `COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md`
2. Implementar DT-0036 (toggle permisoEdicionAgenda en Configuracion.tsx)
3. Auditar `Refactorizacion verticale.md` (creado sin acceso al filesystem real)

### Para Antigravity:
1. Seguir protocolo de NO sobrescribir bitacora.json
2. Revisar convenciones en COORDINACION
3. Usar mem_save si descubre bugs nuevos

---

*Índice actualizado: 2026-07-28*  
*Generado desde sesión 8108 (Claude Code)*
