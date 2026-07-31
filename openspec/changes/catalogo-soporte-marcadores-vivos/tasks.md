# Tasks: Marcadores vivos del catálogo de soporte

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2,200 (range 1,800–2,700) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3 → PR4 → PR5 → (PR6 parallel) → PR7 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Phases | Est. lines | Depends on |
|------|------|--------|-----------|------------|
| PR1 | Type contract + fixture scaffold | 1 | ~250 | none |
| PR2 | `catalogo-fuente.mjs` lib + unit tests (parser, rutas, fusión) | 2 | ~570 | PR1 |
| PR3 | Generator delegates to lib + `validar-catalogo.test.ts` invariants | 3 | ~150 | PR2 |
| PR4 | PoC migration (3 views) + golden fusion test + regression | 4, 5 | ~400 | PR3 |
| PR5 | Debt baseline + gate script + CI wiring (largest unit — may need further split at apply time, e.g. gate-core vs gate-branches vs CI-wiring) | 6, 7, 8 | ~770 | PR4 |
| PR6 | Docs + spec wording fix (independent files; author anytime, merge after PR5 for accuracy) | 9 | ~75 | none (merge after PR5) |
| PR7 | Follow-up change scaffold (`catalogo-soporte-migracion-deuda`) | 10 | ~350 | PR5 |

Phase 11 (full regression) is not a PR; it is the final gate run once PR5/PR6/PR7 are all merged.

## Phase 1: Foundation — type contract & fixtures

- [x] 1.1 Add `export type MarcadorSoporte = Omit<EntradaCatalogoSoporte, 'introducedIn'>;` to `shared/soporte/tipos.ts` (D2).
- [x] 1.2 Add `"scripts/__fixtures__"` to `exclude` in `tsconfig.json` (deliberately-invalid fixtures must not break `npx tsc --noEmit`).
- [x] 1.3 Create fixture trees under `scripts/__fixtures__/catalogo-gate/`: `marcador-simple/`, `marcador-multiple/`, `marcador-duplicado/`, `marcador-dinamico/`, `marcador-jsx-pesado/`, `marcador-sin-selfref/`, `app-rutas/App.tsx`, `baseline-crece/{base,head}/deuda-catalogo.json` per design.md fixture table.
- [x] 1.4 Verify: `npx tsc --noEmit` passes with fixtures excluded (no runtime logic yet, nothing else to test).

## Phase 2: Shared module `scripts/lib/catalogo-fuente.mjs` (TDD)

- [x] 2.1 RED — write `scripts/catalogo-marcadores.test.js` (node --test) over `marcador-simple/`, `marcador-multiple/`, `marcador-duplicado/`, `marcador-dinamico/`, `marcador-jsx-pesado/`, `marcador-sin-selfref/`: asserts `escanearMarcadores()` shape, literal-only AST evaluator (D3), duplicate-id and missing-selfref (D9) hard failures with `archivo:línea:columna`.
- [x] 2.2 GREEN — implement `escanearMarcadores()` + literal AST evaluator in `catalogo-fuente.mjs` (substring pre-filter, `ts.createSourceFile`, never `transpileModule`/`import` of views). Run `npm run test:node -- scripts/catalogo-marcadores.test.js`.
- [x] 2.3 RED — write `scripts/rutas-app.test.js` over `app-rutas/App.tsx`: literal `path`, `"*"` skipped, layout route w/o `path` skipped, ternary `element` (multi-tag), two routes→same file, locally-declared component → `App.tsx`.
- [x] 2.4 GREEN — implement `leerRutasApp()` (import map + JSX route walk) in `catalogo-fuente.mjs`. Run `npm run test:node -- scripts/rutas-app.test.js`.
- [x] 2.5 RED — extend `catalogo-marcadores.test.js` with `leerNucleoManual()`/`fusionarCatalogo()` cases: merge order, `introducedIn` stamped from `catalogVersion` (D2), manual↔marker and marker↔marker id/inventoryId collisions accumulated and reported together before exit 1.
- [x] 2.6 GREEN — implement `leerNucleoManual()` + `fusionarCatalogo()`. Verify: `npm run test:node -- scripts/catalogo-marcadores.test.js scripts/rutas-app.test.js`.

## Phase 3: Generator wiring

- [x] 3.1 RED — update `scripts/validar-catalogo.test.ts`: replace golden `expectedJson` diff with invariants (`public/` ≡ `functions/` byte-identical, `.sha256` matches, `validarCatalogoSoporte(JSON.parse(json)) === []`); add fixture-driven cases for id-duplicado and marcador-dinamico via `--source-root`.
- [x] 3.2 GREEN — modify `scripts/generar-catalogo.mjs`: delegate `loadCatalog()` to `catalogo-fuente.mjs` (núcleo + marcadores fusionados), add `--source-root <dir>` (default `cwd`), drop the fixed `entries.length !== 59` check from `assertCatalog`.
- [x] 3.3 Verify: `npm test -- --runInBand scripts/validar-catalogo.test.ts`.

## Phase 4: PoC migration — 3 views

- [ ] 4.1 Add `soporteMeta: MarcadorSoporte[]` to `vistas/BuzonNotificaciones.tsx` (1 entry `buzon.consultor`) and `vistas/admin/JornadasView.tsx` (1 new entry `jornadas.manage`, route `/jornadas`, roles `['Admin','Editor']`), per design.md insertion points.
- [ ] 4.2 Add `soporteMeta: MarcadorSoporte[]` to `vistas/admin/AgendaView.tsx` (3 entries: `agenda.read`+`agenda.manage` route `/`, `agenda.standalone` route `/agenda`).
- [ ] 4.3 Remove the 4 migrated `entry(...)` calls from `shared/soporte/catalogo.v1.ts`; add `/jornadas` to `RUTAS_SOPORTE_CONOCIDAS`.
- [ ] 4.4 Update `shared/soporte/catalogo.v1.test.ts` (`INVENTARIO_ESPERADO` minus 4 ids, both `toHaveLength(59)`→`55`) and finalize `validar-catalogo.test.ts` l.18 `59`→`55`.
- [ ] 4.5 Regenerate committed artifacts (`node scripts/generar-catalogo.mjs`); verify `node scripts/generar-catalogo.mjs --check` passes against repo root with no flags.
- [ ] 4.6 Verify: `npm test -- --runInBand shared/soporte/catalogo.v1.test.ts scripts/validar-catalogo.test.ts vistas/BuzonNotificaciones.test.tsx vistas/admin/AgendaView.test.tsx`; `npx tsc --noEmit`.

## Phase 5: Fusion golden + regression

- [ ] 5.1 Create `scripts/catalogo-fusion.test.js` (node --test): builds the real fused catalog against repo root, asserts the 60 expected `inventoryId`s (55 manual + 4 migrated + `jornadas.manage`).
- [ ] 5.2 Verify no regression: `npm test -- --runInBand servicios/soporte/matcher.test.ts servicios/soporte/contexto.test.ts App.routing.test.ts`.
- [ ] 5.3 Coverage: `npm run test:coverage -- shared/soporte scripts/lib`.

## Phase 6: Debt baseline

- [ ] 6.1 Create `shared/soporte/deuda-catalogo.json` (`{ note, deuda[], exentosPermanentes[] }`, D4/D5): `deuda[]` = every currently routed file with manual coverage minus the 4 PoC entries (~27 files/55 entries, enumerated against `App.tsx` routes + `catalogo.v1.ts` `sourceFiles`); `exentosPermanentes[]` = structural core (`App.tsx`, `shell.session`, `master.tenants`, `master.kicho`, `master.analytics`, `master.support`, unmapped public routes).
- [ ] 6.2 Verify: JSON parses; arrays sorted and deduplicated (manual review — nothing consumes this file yet).

## Phase 7: Gate script `scripts/verificar-rutas-soporte.mjs` (TDD)

- [ ] 7.1 RED — write `scripts/verificar-rutas-soporte.test.js` (node --test), 7 cases per spec `catalogo-soporte-antideriva`: (a) routed file outside baseline w/o coverage ⇒ exit 1 naming route+file; (b) marker `route` absent from `App.tsx` ⇒ exit 1; (c) coverage w/ no `status:'active'` role ⇒ exit 1; (d) baseline file untouched ⇒ exit 0, no notice; (e) baseline file touched ⇒ exit 0 + `::notice`; (f) baseline/exentos grows vs `--baseline-base` ⇒ exit 1; (g) clean tree ⇒ exit 0.
- [ ] 7.2 GREEN — implement `verificar-rutas-soporte.mjs`: consumes `catalogo-fuente.mjs`, per-file coverage + active-role check, shrink-only diff (D6), `::notice`/`$GITHUB_STEP_SUMMARY` or plain text outside CI (D7), flags `--source-root`/`--changed-files`/`--baseline-base`/`--strict-baseline` (D10).
- [ ] 7.3 Verify: `npm run test:node -- scripts/verificar-rutas-soporte.test.js`; local dry run against real repo root passes clean.

## Phase 8: CI wiring

- [ ] 8.1 Modify `.github/workflows/deploy.yml` job `pruebas`: `checkout@v4` → `fetch-depth: 0`; add "Base del diff para el catálogo de soporte" (`merge-base`, `diff --name-only`, `git show <base>:…deuda-catalogo.json`); add "Gate de rutas del catálogo de soporte"; add "Catálogo generado en sincronía" (`--check`) — all after `Typecheck`, before `Pruebas de la app`.
- [ ] 8.2 Verify: no local automated test for GH Actions YAML; confirm via a PR run on this branch before merge.

## Phase 9: Docs + spec correction

- [ ] 9.1 Rewrite `docs/asistente/catalogo.md`: manual checklist → description of the automated mechanism (marcador → escaneo → fusión → gate); fix l.40 (`Estudiante` is `active`, not `reserved`); note `RutaInicial`-mounted `vistas/Administracion.tsx` (+8 entries) stays out of gate scope.
- [ ] 9.2 Update `specs/catalogo-soporte-antideriva/spec.md` Requirement "Contrato del marcador co-locado": one-line clarification that the **emitted** entry satisfies the full contract while the marker type is `Omit<…,'introducedIn'>` (D2; resolves design.md open question).
- [ ] 9.3 Verify: doc/spec-only, manual proofread against D2/D9.

## Phase 10: Follow-up change scaffold (closure condition — Decision #7)

- [ ] 10.1 Create `openspec/changes/catalogo-soporte-migracion-deuda/proposal.md`: intent = migrate remaining manual entries to `soporteMeta`; scope = every file in `shared/soporte/deuda-catalogo.json`'s `deuda[]`; out of scope = `exentosPermanentes[]`.
- [ ] 10.2 Create `openspec/changes/catalogo-soporte-migracion-deuda/tasks.md`: one checklist item per file in `deuda[]` (file path + entry id(s)), sourced directly from `shared/soporte/deuda-catalogo.json`.
- [ ] 10.3 Verify: `tasks.md` item count equals `deuda-catalogo.json`'s `deuda[]` length exactly (spec requirement "Condición de cierre").

## Phase 11: Full regression (post-merge gate, not its own PR)

- [ ] 11.1 `npm run typecheck && npm run test:app && npm run test:functions:full && npm run test:node`.
- [ ] 11.2 `npm run build`.
- [ ] 11.3 `npm run test:coverage -- shared/soporte scripts/lib scripts`.

## Dependency / Parallelization Notes

- Sequential core: Phase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 (each builds on the previous artifact).
- Phase 9 (docs) has no code dependency and can be drafted in parallel with Phases 5–8, but should merge after Phase 8 so the description matches the shipped mechanism.
- Phase 10 depends on Phase 6's final `deuda-catalogo.json` (needs the frozen file list).
- Phase 11 runs once every other unit has merged; it is verification, not new work.
