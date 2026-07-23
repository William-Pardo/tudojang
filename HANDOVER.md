# HANDOVER — 2026-07-22

Para quien retome (otra sesión, otra IA, u otro desarrollador).

## Estado en una línea
Centro de Estudios con las **7 cadenas cubiertas por integración**, 2 bugs de producción
corregidos, y los **4 hallazgos de producto resueltos**. Todo verde local (154 suites / 1628
pruebas, typecheck 0). Queda **abrir/mergear el PR** de `fix/hallazgos-producto-centro-estudios`.

## Lo PRIMERO que hay que hacer
1. **Abrir el PR** desde `fix/hallazgos-producto-centro-estudios` → `main`:
   https://github.com/William-Pardo/tudojang/compare/main...fix/hallazgos-producto-centro-estudios?expand=1
   Incluye 6 commits: la cadena de Progreso + los 4 findings + el fix del flake.
2. Esperar el check `pruebas` (CI). HEAD ya pasó la regresión completa local.
3. **Merge → Confirm.** Esto **deploya a producción** (hosting + reglas + functions).
4. Borrar la rama `test/integracion-progreso` (su commit ya viaja en este PR).

## Contexto de deploy (importante)
- Pushear a `main` dispara `deploy.yml` → deploy a producción.
- En el PR #4 anterior el deploy salió **verde completo** (functions incluidas). OJO: ese verde
  **no prueba** que el permiso de Cloud Scheduler esté resuelto — solo que ese deploy no tocó
  ninguna función programada. Sigue pendiente de verificación real (ver `ACCIONES_PENDIENTES.md`).

## Dónde está cada cosa nueva
- Reglas de "completada" del quiz: `models/academico/actividad.ts` → `avanceAsignacionCompletado`.
- Archivar jornada: `models/academico/jornada.ts` (`archivada?`),
  `servicios/academico/jornadaRepository.ts` (`archivarJornada`),
  `hooks/academico/useEliminacionJornadaSegura.ts` (`archivar()`), `vistas/admin/AgendaView.tsx`.
- Estados del quiz en preview: `components/academico/MaterialPreviewModal.tsx`.
- Guard de archivar recurso usado: `servicios/academico/bibliotecaService.ts`
  (`RecursoNoPublicadoError`, `recursoFuePublicado`).
- Migración de correos: `scripts/normalizar-correos.js` (+ test). **No hay nada que migrar hoy**
  (diagnóstico prod: 0 afectados); se conserva para importación masiva / restauración de backup.

## Lo que quedó pendiente (no bloqueante)
- Verificar de verdad el permiso de Cloud Scheduler (deploy de functions).
- 2 alumnos de Gajog sin `tutor` (son datos de demo, confirmado — no es hueco de carga real).
- `Tudojang.rar` (230 MB) hace impusheable `codex/asistente-hibrido-catalogo`.
- Wart de entorno: `git commit` en Windows tira errores ruidosos de `refs/codex/turn-diffs/…`
  ("Filename too long") — los commits igual quedan; es un mecanismo de checkpoints de Codex.

## Cómo trabajar en este repo
- `npm run typecheck` · `npx jest --runInBand` (app) · `npm --prefix functions test` · `npm run test:node`.
- **Nunca** `npm run build` salvo pedido explícito. Commits en conventional commits, **sin**
  atribución de IA.
- Patrón de integración: `jest.mock('firebase/firestore', () => crearApiFirestoreFake())` +
  mock de `firebase/config`; el resto corre real contra el store en memoria (`test-utils/fakeFirestore.ts`).
- **Mutación**: al verificar por mutación, mutar la rama que el test REALMENTE recorre (la
  integración corre con `isFirebaseConfigured: true` = rama Firestore, no la rama mock).
