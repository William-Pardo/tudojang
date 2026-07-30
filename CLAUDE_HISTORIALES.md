# 📚 Histórico de Sesiones Claude — Tudojang

Este documento indexa todos los chats y proyectos desarrollados en Claude para el proyecto Tudojang.

## 🔄 Proyectos Activos (con historial)

### Principal: `e--Apps-Tudojang-Workspace-Tudojang`
**Ruta de trabajo:** `i:\Apps\Tudojang-Workspace\Tudojang`  
**Sesiones recientes:** 2 sesiones indexadas  
**Última actividad:** 2026-07-21  
**Descripción:** Proyecto principal del workspace Tudojang con todo el historial de desarrollo.

**Historial disponible:**
- ✅ Sesión 18128 (2026-07-21) — Centro de Estudios (7 cadenas cubiertas, 4 hallazgos resueltos)
- ✅ Sesión 16936 (2026-07-21) — Configuración y sincronización inicial
- ✅ Sesión 22264 (2026-07-28) — Retoma de configuración de IAs
- ✅ Sesión 8108 (2026-07-28) — Sincronización de bitacora.json

### Rama Worktree: `E--Apps-Tudojang-Workspace-Tudojang--claude-worktrees-clase-en-vivo`
**Ruta de trabajo:** `i:\Apps\Tudojang-Workspace\Tudojang\` (worktree isolation)  
**Descripción:** Rama aislada para desarrollo de módulo Clase en Vivo

### Legacy: `e--Apps-Tudojang`
**Ruta de trabajo:** `i:\Apps\Tudojang`  
**Descripción:** Proyecto previo a la creación del workspace (historial anterior)

---

## 📋 Resumen del Último Sprint (2026-07-21 a 2026-07-28)

### ✅ Completado
- **Centro de Estudios Module 12** — Agenda redesign y automatización
  - 7 cadenas cubiertas por integración
  - 2 bugs de producción corregidos
  - 4 hallazgos de producto resueltos
  - PR `fix/hallazgos-producto-centro-estudios` listo para merge → deploy

- **Configuración Global de IAs**
  - Claude: actualizado a opus + xhigh + custom:gentleman
  - Codex: configurado con danger-full-access + MCP servers
  - Antigravity: argv.json configurado
  - Engram: sincronización con paths locales (I:\Apps\engram y I:\Apps\ENGRAM-BANK)

- **Protocolo de Documentación**
  - bitacora.json establecida como source of truth
  - HANDOVER.md como respaldo/snapshot
  - Memoria compartida entre Claude, Codex, Antigravity

### 🔄 En Progreso
- **DT-0012 (FIX-0012)** — Matriz de roles para Agenda
  - Admin/SuperAdmin: control total
  - Maestro: edita clase propia
  - Estudiante: solo lectura
  - Asistente/Editor: editan con flag `permisoEdicionAgenda`

### 📌 Pendiente
- Deploy a producción del PR `fix/hallazgos-producto-centro-estudios`
- Auditar y retomar contexto de Codex sobre Sistema B (fragmentación académica)
- Completar CRUD de espacios (alcance mínimo)
- Conectar email templates a functions reales

---

## 🎯 Cómo Acceder a los Historiales

### Opción 1: Desde Claude VSCode
Los historiales están almacenados en:
```
~/.claude/sessions/          # Metadata de sesiones (JSON)
~/.claude/projects/          # Contexto por proyecto
~/.codex/sessions/           # Historiales de Codex (JSONL)
```

**Para retomar una sesión:**
1. Abre Claude en VSCode (`Cmd/Ctrl + Shift + C`)
2. Los proyectos y sesiones aparecen en el panel lateral
3. Haz clic en una sesión para retomar desde donde se dejó

### Opción 2: Revisar bitacora.json
El archivo central de debugs y avances:
```
i:\Apps\Tudojang-Workspace\Tudojang\bitacora.json
```
Contiene:
- Todas las conexiones rotas (CR-xxx)
- Todos los errores sistema (ERR-xxx)
- Todos los fixes por atender (FIX-xxx)
- Toda la deuda técnica (DT-xxx)

### Opción 3: Revisar HANDOVER.md
Estado rápido ejecutivo del proyecto:
```
i:\Apps\Tudojang-Workspace\Tudojang\HANDOVER.md
```
Última actualización: 2026-07-22

---

## 🗂️ Archivos de Contexto Importantes

| Archivo | Propósito | Última Actualización |
|---------|-----------|---------------------|
| `bitacora.json` | Source of truth: bugs, fixes, avances | 2026-07-15 |
| `HANDOVER.md` | Resumen ejecutivo y próximos pasos | 2026-07-22 |
| `CLAUDE.md` (proyecto) | Instrucciones y convenciones del proyecto | 2026-03-23 |
| `COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md` | Roles y coordinación entre IAs | Vigente |
| `Mejora del módulo Agenda.txt` | Requisitos y alcance del módulo 12 | Completado |
| `CIERRE CENTRO DE ESTUDIOS.md` | Checklist de cierre del módulo | Vigente |

---

## 🔑 Comandos Rápidos (Claude VSCode)

```bash
# Retomar sesión reciente
# (Simplemente abre Claude en VSCode y selecciona el proyecto)

# Ver estado SDD (si hay cambios en progreso)
/sdd-status

# Ver bitacora sincronizada
# (Revisar i:\Apps\Tudojang-Workspace\Tudojang\bitacora.json)
```

---

## 📞 Contacto / Próximas Acciones

**Para Claude:** 
- Retoma desde Centro de Estudios (Módulo 12 completado)
- Revisar PR `fix/hallazgos-producto-centro-estudios` antes de merge
- Continuar con DT-0012 (matriz de roles)

**Para Codex:**
- Coordinar con la rama de clase-en-vivo si es necesario
- Revisar permisos en Configuracion.tsx para DT-0036

**Para Antigravity:**
- Seguir convenciones en COORDINACION CODEX ANTIGRAVITY
- Evitar sobrescribir bitacora.json sin leer primero (ERR-0004 previo)

---

*Índice actualizado: 2026-07-28*
