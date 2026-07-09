# Coordinacion Multi-IA - Tudojang (general)

Objetivo: permitir que Codex y Claude trabajen en paralelo real (al mismo tiempo,
no por turnos) sobre el mismo repo, sin pisarse y sin perder trabajo. Antigravity
sigue el protocolo especifico de `COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md`
para ese modulo; para el resto de la app aplica el mismo criterio de esa IA
(solo docs/copy/tests visuales simples, sin tocar logica ni servicios).

Este documento gobierna coordinacion transversal a toda la app (no un modulo
puntual). Si hay conflicto entre documentos, manda este orden:

1. instrucciones del usuario;
2. este documento (para trabajo transversal / paralelo real);
3. `COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md` (para el modulo Centro de Estudios especificamente).

---

## Actores, rol y aislamiento fisico

| IA | Rol | Worktree | Rama |
|----|-----|----------|------|
| Codex | Debugging y refactor transversal: barrer toda la app buscando bugs, crashes, conexiones rotas o mal cableadas, y resolverlos. | `E:\Apps\Tudojang-codex-debug` | `codex/debug-sweep` |
| Claude | Desarrollo puro de modulos: conexiones, TDD (unitarios, integracion, excepcion, triangulacion), UX, logica, reglas de negocio. | `E:\Apps\Tudojang` | `claude/dev-modulos` |
| Antigravity/Gemini | Documentacion, copy, estados vacios, checklists manuales. | Segun protocolo especifico del modulo que toque. | Definir rama propia si toca codigo; si es solo docs, puede ir directo a su rama de trabajo habitual. |

`main` queda como tronco estable. Nadie escribe directo ahi salvo merges.

---

## Regla unica de no-colision

Cada IA trabaja en su propia rama/worktree, todo el tiempo que quiera, sin pedir
permiso por archivo. El punto de sincronizacion es el merge a `main`, no el
tiempo real. Ahi, y solo ahi, se resuelven los solapamientos (git marca el
conflicto en las lineas exactas si dos ramas tocaron lo mismo).

Reglas minimas:

1. Commitear seguido en la rama propia. No hace falta avisar para tocar un
   archivo dentro de la rama propia.
2. Antes de mergear una rama a `main`: build y tests de esa rama deben pasar.
3. Anunciar el merge en el registro de abajo (rama, resumen, archivos
   relevantes) antes o inmediatamente despues de mergear.
4. Si al mergear aparece conflicto de texto, se resuelve una sola vez en ese
   momento (no requiere haber coordinado antes).
5. El usuario decide cuando y quien mergea si hay dudas de orden.

---

## Registro de avance

Formato:

```md
### YYYY-MM-DD - IA - resumen

- Rama:
- Archivos relevantes:
- Tests ejecutados:
- Resultado:
- Mergeado a main: si/no
- Siguiente responsable:
```

### 2026-07-09 - Claude - Setup inicial de paralelismo

- Rama: `claude/dev-modulos` creada; `codex/debug-sweep` creada en worktree separado.
- Archivos relevantes: checkpoint de 137 archivos en `main` (commit `d495b49`), `.gitignore` (commit `894ace5`), este documento.
- Tests ejecutados: no aplica, setup de infraestructura de coordinacion.
- Resultado: `main` quedo limpio como base comun. Codex tiene worktree/carpeta propia (`E:\Apps\Tudojang-codex-debug`) ya registrada como trusted en su config. Claude sigue en `E:\Apps\Tudojang` sobre `claude/dev-modulos`.
- Mergeado a main: no aplica (es el punto de partida).
- Siguiente responsable: Codex arranca `debug-sweep` en su worktree; Claude arranca desarrollo de modulos en el suyo.
