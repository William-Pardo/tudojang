# Proposal: Migración de la deuda congelada del catálogo de soporte

## Intent

`catalogo-soporte-marcadores-vivos` introdujo el marcador co-locado `soporteMeta` y una línea base congelada de deuda (`shared/soporte/deuda-catalogo.json`) para no bloquear el gate de rutas con las entradas manuales existentes. Esa línea base es explícitamente temporal (Decisión #7 del change padre): esta entrega migra cada archivo de `deuda[]` a su marcador co-locado, quita su(s) `entry(...)` manual de `shared/soporte/catalogo.v1.ts` y achica `deuda[]` hasta dejarlo vacío, cerrando la deuda que el gate solo advierte hoy sin bloquear.

Éxito: `shared/soporte/deuda-catalogo.json`'s `deuda[]` queda en `[]`; toda vista enrutada por `App.tsx` (fuera de `exentosPermanentes[]`) declara su cobertura vía `soporteMeta` co-locado, no vía entrada manual lejana.

## Scope

### In Scope

Migrar, uno por uno, cada uno de los 25 archivos listados en `shared/soporte/deuda-catalogo.json`'s `deuda[]` (línea base congelada en la Fase 6 de `catalogo-soporte-marcadores-vivos`) al mecanismo de marcador co-locado ya probado en la PoC de ese change (`BuzonNotificaciones.tsx`, `admin/AgendaView.tsx`, `admin/JornadasView.tsx`). Por archivo:

- Agregar `export const soporteMeta` (o `soporteMeta: EntradaCatalogoSoporte[]` cuando el archivo aporta más de una entrada) tipado contra `EntradaCatalogoSoporte` de `shared/soporte/tipos.ts`.
- Quitar la(s) llamada(s) `entry(...)` manual(es) correspondiente(s) de `shared/soporte/catalogo.v1.ts`.
- Quitar el archivo de `deuda[]` en `shared/soporte/deuda-catalogo.json` (regla shrink-only D6: el array solo puede achicarse).
- Regenerar `catalogo.v1.json`/`.sha256` (`functions/generated/soporte/` y `public/generated/soporte/`) vía `scripts/generar-catalogo.mjs`.
- Confirmar que `scripts/verificar-rutas-soporte.mjs` sigue en verde tras cada migración.

La lista completa de archivos, con el/los id(s) de entry que le corresponden (cruzados contra `shared/soporte/catalogo.v1.ts`), vive en `tasks.md` de este change como checklist verificable — ver ese archivo para el detalle uno por uno.

### Out of Scope

- **`exentosPermanentes[]`** de `shared/soporte/deuda-catalogo.json`: `App.tsx` (vía `shell.session`) y `vistas/MasterDashboard.tsx` (vía `master.support`/`master.tenants`/`master.kicho`/`master.analytics`). Es núcleo estructural fuera de alcance del gate de forma permanente, documentado así en el change padre; no se migra en esta ni en ninguna entrega futura salvo decisión explícita nueva.
- Las 15 entradas manuales que cubren archivos que `App.tsx` **no enruta directamente** (se alcanzan vía pestañas de `Administracion.tsx`/`Estudiantes.tsx`: `admin.*`, `finance.*`, `students.kicho*`, `students.live-class`, `centro-estudios.material`/`biblioteca`/`progreso`, `students.certificates`, `students.cards`). Quedan fuera del alcance del gate de rutas por completo — ni deuda ni exento — y por lo tanto fuera del alcance de esta migración también; no hay marcador co-locado que aplicar porque no hay ruta de `App.tsx` que lo exija.
- Cambiar el esquema del catálogo, el contrato de `EntradaCatalogoSoporte`, el matcher, el fallback de IA o el escalamiento.
- Cambiar el gate de rutas en sí (`scripts/verificar-rutas-soporte.mjs`) más allá de lo necesario para que siga pasando con `deuda[]` vacío.
- Migrar contenido de producto (aliases, pasos, roles) — cada marcador co-locado conserva el contenido ya verificado de su `entry(...)` manual actual; no es una revisión de copy.

## Capabilities

### Modified Capabilities

- `catalogo-soporte-antideriva`: `deuda[]` pasa de 25 archivos a 0; el gate deja de tener excepción alguna fuera de `exentosPermanentes[]`.
- `catalogo-soporte`: las 35 entradas manuales restantes en `shared/soporte/catalogo.v1.ts` se retiran del núcleo manual y pasan a generarse por escaneo de `soporteMeta`, igual que las 4 entradas de la PoC.

## Approach

Migración por goteo, archivo por archivo, replicando el patrón ya validado en la PoC del change padre — sin descubrir mecanismo nuevo, solo aplicarlo con disciplina:

1. Por archivo (ver `tasks.md`): agregar `soporteMeta`, quitar el `entry(...)` manual equivalente, correr `generar-catalogo.mjs` y el gate, achicar `deuda[]`.
2. Casos con más de un `entry(...)` en el mismo archivo (p. ej. `Configuracion.tsx` con 7 entradas) migran todas juntas en una sola tarea, ya que dividir el archivo en múltiples PRs no reduce riesgo real.
3. Caso con una entrada compartida entre dos archivos (`public.marketing`, `sourceFiles: ['vistas/PublicLanding.tsx', 'vistas/RegistroEscuela.tsx']`): decidir en el `sdd-design` de este change si se declara `soporteMeta` en ambos archivos apuntando al mismo `id` (y el generador deduplica), o si se elige un archivo canónico y el otro queda sin marcador propio. No se resuelve en esta propuesta porque el mecanismo de fusión de `generar-catalogo.mjs` no fue diseñado para entradas multi-archivo — es una pregunta abierta explícita, no una decisión tomada.
4. Verificación incremental: el gate (`scripts/verificar-rutas-soporte.mjs`) debe permanecer en verde después de cada archivo migrado, no solo al final.

## Impact

| Area | Impact |
|---|---|
| 25 archivos de `deuda[]` (ver `tasks.md`) | Modified — cada uno agrega `soporteMeta` co-locado |
| `shared/soporte/catalogo.v1.ts` | Modified — se retiran 35 entradas manuales (el núcleo manual pasa de 55 a ~20 entradas: las 15 fuera de alcance del gate + `exentosPermanentes`) |
| `shared/soporte/deuda-catalogo.json` | Modified — `deuda[]` de 25 elementos a `[]` |
| `scripts/generar-catalogo.mjs` | Read-only — reutiliza el escaneo ya construido en el change padre |
| `functions/generated/soporte/catalogo.v1.json`, `public/generated/soporte/catalogo.v1.json` y `.sha256` | Regenerated — mismo formato, contenido equivalente |

Tests afectados:

- `shared/soporte/catalogo.v1.test.ts` — el golden `INVENTARIO_ESPERADO` y el conteo de entradas del catálogo fusionado deben actualizarse conforme cada archivo migra (ya dejó de ser un literal fijo desde el change padre).
- `scripts/validar-catalogo.test.ts` — casos de fusión existentes deben seguir en verde con más archivos escaneados.
- Suites de las 25 vistas migradas — deben permanecer en verde con el export `soporteMeta` adicional (cambio aditivo, sin tocar el componente).
- Test del gate de rutas (`scripts/verificar-rutas-soporte.test.ts` o equivalente) — casos de `deuda[]` vacío y de la regla shrink-only deben seguir cubiertos.

Evidencia de cobertura actual: heredada del change padre al momento de su archivo (161/161 suites, ver su `proposal.md`). El objetivo de cobertura de esta entrega es mantener ese estado en verde tras cada migración incremental — 0% de regresión tolerada en `catalogo.v1.test.ts`, `validar-catalogo.test.ts` y las suites de las 25 vistas listadas en `tasks.md`.

## Risks

| Risk | Mitigation |
|---|---|
| La entrada compartida `public.marketing` (`PublicLanding.tsx` + `RegistroEscuela.tsx`) no tiene mecanismo de fusión multi-archivo definido | Resolver explícitamente en `sdd-design` de este change antes de tocar esos dos archivos; no improvisar durante `sdd-apply` |
| Migrar 25 archivos en un solo PR excede el presupuesto de revisión (400 líneas) | `sdd-tasks` de este change debe forecastear el riesgo y recomendar PRs encadenados por lote de archivos, igual que hizo el change padre |
| `deuda[]` se edita a mano y alguien agrega un archivo en vez de migrarlo | Ya cubierto por la regla shrink-only (D6) del gate heredado del change padre; esta entrega no la debilita |
| Migración incompleta dejando el catálogo fusionado inconsistente entre corridas | Verificar el gate y `generar-catalogo.mjs --check` después de cada archivo, no solo al final del change |

## Rollback Plan

Cada archivo se revierte de forma independiente sin afectar a los demás ya migrados:

1. Restaurar el/los `entry(...)` manual(es) retirado(s) en `shared/soporte/catalogo.v1.ts`.
2. Quitar el `soporteMeta` agregado al archivo (export inerte, no se importa en runtime).
3. Volver a agregar el archivo a `deuda[]` en `shared/soporte/deuda-catalogo.json`.
4. Regenerar el catálogo publicado; el checksum debe volver al valor previo a esa migración puntual.

## Dependencies

- Requiere que `catalogo-soporte-marcadores-vivos` esté mergeado: este change consume su mecanismo de marcador, su escaneo en `generar-catalogo.mjs`, su gate de rutas y la línea base congelada en `shared/soporte/deuda-catalogo.json`. No introduce infraestructura nueva.
- Sin nuevas dependencias de npm.

## Success Criteria

- [ ] `shared/soporte/deuda-catalogo.json`'s `deuda[]` queda en `[]`.
- [ ] Los 25 archivos listados en `tasks.md` declaran `soporteMeta` co-locado y ya no tienen entrada manual equivalente en `shared/soporte/catalogo.v1.ts`.
- [ ] El caso `public.marketing` (entrada compartida entre `PublicLanding.tsx` y `RegistroEscuela.tsx`) queda resuelto explícitamente en `design.md`, no improvisado.
- [ ] `scripts/verificar-rutas-soporte.mjs` y `node scripts/generar-catalogo.mjs --check` permanecen en verde durante y después de la migración.
- [ ] Suites en verde sin regresión respecto al estado heredado del change padre.
