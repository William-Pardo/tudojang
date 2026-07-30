# 🚀 Punto de Entrada — Historiales Claude

Bienvenido. Este documento te lleva rápidamente a todos los chats e historiales de Claude sobre Tudojang.

---

## ⚡ Retomar en 30 segundos

### 1️⃣ Ver estado actual del proyecto
👉 Abre: [`HANDOVER.md`](./HANDOVER.md)
- Qué se hizo ✅
- Qué hay que hacer ahora 🎯
- Pendientes no bloqueantes 📌

### 2️⃣ Ver TODO el historial de bugs y avances
👉 Abre: [`bitacora.json`](./bitacora.json)
- Source of truth del proyecto
- 36 items de deuda técnica (DT-xxx)
- 7 errores del sistema (ERR-xxx)
- 13 fixes por atender (FIX-xxx)

### 3️⃣ Ver índice de chats Claude
👉 Abre: [`CLAUDE_CHATS_INDICE.md`](./CLAUDE_CHATS_INDICE.md)
- Qué se discutió en cada sesión
- Archivos tocados
- Referencias cruzadas

### 4️⃣ Retomar sesión anterior
En VS Code:
1. Abre Claude (`Cmd/Ctrl + Shift + C`)
2. Ve a la sección "Proyectos"
3. Selecciona: `e--Apps-Tudojang-Workspace-Tudojang`
4. Haz clic en la última sesión → retomas desde donde se dejó

---

## 📚 Todos los Documentos (Completos)

| Documento | Propósito | Audiencia |
|-----------|-----------|-----------|
| [`HANDOVER.md`](./HANDOVER.md) | Estado actual en 1 línea + próximos pasos | ⭐ Todos |
| [`bitacora.json`](./bitacora.json) | Source of truth: bugs, fixes, deuda técnica | 👨‍💻 Técnico |
| [`CLAUDE_CHATS_INDICE.md`](./CLAUDE_CHATS_INDICE.md) | Índice técnico de sesiones y temas | 🔍 Referencia |
| [`CLAUDE_HISTORIALES.md`](./CLAUDE_HISTORIALES.md) | Índice visual de proyectos y sesiones | 📋 Gestión |
| [`CLAUDE.md`](./CLAUDE.md) | Reglas y convenciones del proyecto | 📖 Onboarding |
| [`COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md`](./COORDINACION%20CODEX%20ANTIGRAVITY%20-%20CENTRO%20ESTUDIOS.md) | Roles y coordinación entre IAs | 🤝 Múltiples IAs |

---

## 🎯 Estado Actual (2026-07-28)

### ✅ Hecho (Listo para merge/deploy)
- **Centro de Estudios (Módulo 12)** — Auditoría, bugs, Cloud Functions, UI redesign
- **Clase en Vivo** — Matricula automática, asistencia, inicio automático
- **Configuración global** — Claude, Codex, Antigravity alineados

### 🔄 En Progreso
- **DT-0012** — Matriz de roles para Agenda (Asistente/Editor permisos)
- **PR** `fix/hallazgos-producto-centro-estudios` — Pendiente merge

### 📌 Pendiente
- Deploy a producción (after merge)
- Auditar `Refactorizacion verticale.md` (responsabilidad Codex)
- Completar CRUD de espacios
- Conectar email templates

---

## 🔗 Acceso Directo a Historiales en VS Code

**Sesión más reciente:**
```
~/.claude/sessions/16936.json   (2026-07-21 — Centro de Estudios)
~/.claude/sessions/18128.json   (2026-07-21 — Bugs audit)
~/.claude/sessions/22264.json   (2026-07-28 — Configuración)
~/.claude/sessions/8108.json    (2026-07-28 — bitacora.json)
```

**Proyecto asociado:**
```
~/.claude/projects/e--Apps-Tudojang-Workspace-Tudojang/
```

**Para retomar:** Abre Claude VSCode → Proyectos → Haz clic

---

## 🎓 Primeros Pasos (Nuevos Contributors)

1. Lee [`HANDOVER.md`](./HANDOVER.md) — 2 minutos
2. Lee [`CLAUDE.md`](./CLAUDE.md) (primeros 100 líneas) — 5 minutos
3. Revisa [`bitacora.json`](./bitacora.json) buscando `"estado": "vigente"` — 10 minutos
4. Pregunta en el chat qué necesitas hacer

---

## 📞 Preguntas Frecuentes

**P: ¿Dónde está todo el contexto del proyecto?**  
R: En [`bitacora.json`](./bitacora.json). Es la fuente de verdad.

**P: ¿Cómo retomo un chat anterior?**  
R: Abre Claude en VSCode → Proyectos → `e--Apps-Tudojang-Workspace-Tudojang` → Selecciona sesión

**P: ¿Qué debería hacer ahora?**  
R: Ver [`HANDOVER.md`](./HANDOVER.md) sección "Lo PRIMERO que hay que hacer"

**P: ¿Dónde están los chats completos?**  
R: En la BD de Claude (`.claude/sessions/`). Los JSON son solo metadata. Retoma desde VS Code.

**P: ¿Codex/Antigravity también tienen historial?**  
R: Sí. 47 sesiones en `~/.codex/sessions/2026/`. Ver [`CLAUDE_HISTORIALES.md`](./CLAUDE_HISTORIALES.md)

---

## ✨ Pro Tips

- 💾 **bitacora.json es crítico** — Nunca sobrescribir sin leer primero
- 🔄 **Sincroniza con engram** — Ahora funciona a nivel global
- 📝 **Usa convenciones** — Ver CLAUDE.md (Engram Protocol)
- 🤝 **Coordina con otras IAs** — Ver COORDINACION CODEX ANTIGRAVITY
- ⚡ **Es todo colaborativo** — Todos los historiales están disponibles

---

**Última actualización:** 2026-07-28  
**Creado desde:** Sesión 8108 (Claude Code VSCode)  
**Próxima sesión:** Merge de PR + Deploy
