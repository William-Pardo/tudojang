# Reporte de tests — sesión módulo 12 (Agenda), 2026-07-08

Resultados verificados por el orquestador leyendo el registro de cierre y, en 12.2/12.3/12.4, spot-checkeando el código fuente real (no solo el resumen del subagente).

## 12.2 — Permisos "maestro asignado"

| Comando | Resultado |
|---|---|
| `npm run test:firestore-rules` (emulador) | 26 pass / 0 fail |
| `npx jest vistas/admin/MisClasesView.test.tsx --runInBand` | 18 pass / 0 fail |
| `npx jest JornadasView + AsignacionesView --runInBand` | 37 pass / 0 fail (4 suites) |
| `npx tsc --noEmit` | 0 errores en archivos de producción tocados |

RED confirmado: 2 tests de reglas fallaban con `Expected request to fail, but it succeeded` antes del fix (cualquier instructor podía editar la clase de otro).

## 12.3 — Disponibilidad de maestro y sede

| Comando | Resultado |
|---|---|
| Test RED dirigido (`-t "simulando el filtrado real"`) | 1 fail: `Expected: true, Received: false` (falso negativo confirmado) |
| `jornadaRepository.test.ts` + `JornadasView.test.tsx` + `MisClasesView.test.tsx` | 48 pass / 0 fail |
| `AsignacionesView*` (3 suites, no invocan la función tocada) | 31 pass / 0 fail |
| Barrido amplio `servicios/academico` + `vistas/admin` | 244 pass / 1 fail (ver Known Issues — preexistente, aislada con `git stash`) |
| `npx tsc --noEmit` | 0 errores en producción |

## 12.4 — Concurrencia optimista

| Comando | Resultado |
|---|---|
| Test RED dirigido (`-t "concurrencia optimista"`) | 3 fail: `Received promise resolved instead of rejected` (pisado silencioso confirmado) |
| `jornadaRepository.test.ts` | 26 pass / 0 fail |
| Suite conjunta repositorio + `JornadasView` + `MisClasesView` | 56 pass / 0 fail |
| `AsignacionesView*` (3 suites) | 31 pass / 0 fail (2do parámetro opcional, sin regresión) |
| `npx tsc --noEmit` | 0 errores en producción |

## No ejecutado en esta sesión (por instrucción explícita del usuario)

- `npm run build` — nunca se corre tras cambios chicos, instrucción permanente del usuario.
- `npx cypress run` / E2E — fuera de alcance de estas subtareas (lógica de dominio/reglas, no flujo UI completo).

## Ruido preexistente confirmado (no regresión de esta sesión)

`npx tsc --noEmit` reporta errores de tipo `Property 'toBeInTheDocument'/'toEqual' does not exist on type 'Assertion'` en archivos `*.test.ts(x)` en todo el repo — contaminación de tipos Chai/Cypress sobre `expect` de Jest, presente en archivos no tocados por esta sesión (`Finanzas.test.tsx`, `Horarios.test.tsx`, etc.). Documentado en sesiones previas de `CIERRE CENTRO DE ESTUDIOS.md` (Fase 4/5 de `unificar-flujo-publicar-material`), no es un problema nuevo.
