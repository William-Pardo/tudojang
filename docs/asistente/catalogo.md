# Catálogo de soporte: mecanismo automatizado

El catálogo de soporte (`shared/soporte/catalogo.v1.ts` + marcadores `soporteMeta`
co-locados en las vistas) es la única fuente de respuestas locales del asistente. Desde
`openspec/changes/catalogo-soporte-marcadores-vivos`, el catálogo emitido
(`{public,functions}/generated/soporte/catalogo.v1.json`) ya no es un archivo que se edita
a mano y se revisa por checklist: es el resultado de **escanear, fusionar y verificar**
automáticamente dos fuentes.

## Las dos fuentes del catálogo

1. **Núcleo manual** — `shared/soporte/catalogo.v1.ts` (`CATALOGO_SOPORTE_V1`). Sigue
   existiendo para archivos que `App.tsx` no enruta directamente (ver
   [Fuera de alcance del gate](#fuera-de-alcance-del-gate-vistasadministraciontsx) más
   abajo) y para lo que todavía no se migró.
2. **Marcadores co-locados** — un export `soporteMeta` que una vista enrutada declara
   junto a su propio código, tipado como `MarcadorSoporte[]` (`shared/soporte/tipos.ts`):

   ```ts
   export type MarcadorSoporte = Omit<EntradaCatalogoSoporte, 'introducedIn'>;
   ```

   `introducedIn` es un "sello" que `validacion.ts` exige igual a
   `catalog.catalogVersion`; si el marcador lo escribiera a mano, cada bump de versión
   del catálogo obligaría a editar N vistas. El generador lo estampa automáticamente al
   fusionar. Fuera de ese único campo, la entrada emitida en el catálogo fusionado
   satisface el contrato `EntradaCatalogoSoporte` completo.

   Ejemplo real (`vistas/admin/AgendaView.tsx`, recortado):

   ```ts
   import type { MarcadorSoporte } from '../../shared/soporte/tipos';

   export const soporteMeta: MarcadorSoporte[] = [
     {
       id: 'agenda.read',
       inventoryId: 'agenda.read',
       module: 'agenda',
       label: 'Consulta de horario semanal',
       // ... intent, aliases, actions, negativeTerms, steps, sensitivity,
       // escalationReason, authorizationRef, owner, lastVerifiedAt, status
       roles: ['Admin', 'Editor', 'Asistente', 'SuperAdmin'],
       route: '/',
       sourceFiles: ['vistas/admin/AgendaView.tsx'],
       status: 'active',
     },
     // agenda.manage, agenda.standalone (route '/agenda') …
   ];
   ```

   `soporteMeta` siempre es un array, incluso con una sola entrada — un modelo mental
   único ("una vista declara sus entradas") y agregar una entrada es un `push`, no un
   refactor de forma.

## Mecanismo: marcador → escaneo → fusión → gate

`scripts/lib/catalogo-fuente.mjs` es el módulo compartido que consumen **ambos**
ejecutables (`generar-catalogo.mjs` y el gate), de modo que generador y gate nunca
puedan ver catálogos distintos:

1. **`escanearMarcadores({ root, dirs })`** recorre `vistas/` y `components/`, y para
   cada archivo `.ts(x)` que contiene el substring `soporteMeta` (pre-filtro barato),
   parsea el `export const soporteMeta` **solo por AST** de TypeScript
   (`ts.createSourceFile`) — nunca importa ni ejecuta el módulo de la vista, así que JSX
   y globals de navegador en el archivo no rompen el escaneo. El valor debe ser un
   literal estático auto-contenido: identificador, spread, llamada de función o clave
   computada hacen fallar el escaneo con `archivo:línea:columna`.
2. **Anti-huérfano (D9)**: el generador exige que cada entrada de marcador incluya su
   propio archivo en `sourceFiles`; si no lo incluye, falla duro en el escaneo. Además,
   el gate verifica con `existsSync` que **cada** `sourceFiles` de **cada** entrada
   (manual y marcador) exista en disco. Ninguno de los dos chequeos depende del otro.
3. **`leerRutasApp({ root })`** lee `App.tsx` por AST y devuelve los pares
   `{ route, archivo }` de cada `<Route path="..." element={...}>` literal (excluyendo
   `"*"`), incluyendo los tags dentro de un `element` ternario.
4. **`fusionarCatalogo(nucleo, marcadores)`** concatena núcleo + marcadores, estampa
   `introducedIn` en todas las entradas y falla duro (acumulando todas las colisiones,
   no solo la primera) si dos entradas —manual↔marcador o marcador↔marcador— repiten
   `id` o `inventoryId`.
5. **`scripts/generar-catalogo.mjs`** delega en lo anterior y emite
   `{public,functions}/generated/soporte/catalogo.v1.json` + `.sha256`. `--check`
   compara los artefactos comiteados contra lo que generaría la fuente actual.
6. **`scripts/verificar-rutas-soporte.mjs`** (el gate) compara cada archivo que
   `App.tsx` enruta contra el catálogo fusionado: sin cobertura ni marcador ⇒ falla;
   marcador con `route` que no existe en `App.tsx` ⇒ falla; cobertura con ningún rol en
   `status: 'active'` ⇒ falla (cobertura nominal, no real).

Ambos scripts corren en el job `pruebas` de CI (`.github/workflows/deploy.yml`), después
de `Typecheck` y antes de las suites de test.

## Línea base de deuda (`shared/soporte/deuda-catalogo.json`)

Los archivos ya enrutados que hoy solo tienen cobertura manual (todavía no migraron a
`soporteMeta`) están congelados en una línea base explícita para que el gate nazca en
verde sin exigir una migración masiva de una sola vez:

- **`deuda`**: 25 archivos / 35 entradas manuales — archivos que `App.tsx` enruta
  directamente y que algún día deberían migrar a un marcador co-locado.
- **`exentosPermanentes`**: 2 archivos / 5 entradas manuales — núcleo estructural fuera
  de alcance del gate (`App.tsx`, montado vía `RutaInicial`/`shell.session`; y
  `vistas/MasterDashboard.tsx`, vía las entradas `master.*`).

La regla es **shrink-only** (D6): ambos arrays solo pueden achicarse. Agregar un archivo
nuevo a cualquiera de las dos listas, en vez de cubrirlo con marcador o entrada manual,
hace fallar el gate. Un archivo de deuda tocado en el PR emite un aviso no bloqueante
(`::notice` en CI); un archivo de deuda no tocado no emite nada. El seguimiento de la
migración de `deuda[]` vive en
`openspec/changes/catalogo-soporte-migracion-deuda`.

## Fuera de alcance del gate: `vistas/Administracion.tsx`

`App.tsx` no monta `vistas/Administracion.tsx` en su propia `<Route>`: la renderiza
`RutaInicial` (un componente interno de `App.tsx`, sin `<Route>` propia) cuando no hay
una ruta guardada distinta. `leerRutasApp` solo recorre el árbol JSX del atributo
`element` de un `<Route>` real — nunca entra al cuerpo de una función como
`RutaInicial` — así que ni `vistas/Administracion.tsx` ni las vistas que sus pestañas
internas montan (`vistas/Dashboard.tsx`, `vistas/Finanzas.tsx`, etc.) son visibles para
el gate.

En consecuencia, las entradas manuales que solo se alcanzan a través de las pestañas de
`Administracion.tsx` — `admin.summary`, `admin.late-fees`, `finance.ledger`,
`finance.delete`, `finance.student-payments`, `finance.student-payment-undo`,
`finance.payment-validation` (7 entradas, módulos `administracion` y `finanzas`) —
siguen siendo manuales y **no se pueden co-locar como marcador** con este mecanismo tal
como está diseñado hoy: no hay ninguna `<Route>` a la que atarlas. Esto es coherente con
el "fuera de alcance" de elementos no enrutados del proposal original, pero se deja
escrito acá para que nadie asuma que el gate las cubre. Lo mismo aplica a las entradas
alcanzadas vía pestañas de `vistas/Estudiantes.tsx` (`students.kicho*`,
`students.live-class`, `centro-estudios.material`/`biblioteca`/`progreso`,
`students.certificates`, `students.cards`) — tampoco entran ni a `deuda` ni a
`exentosPermanentes`: quedan fuera del alcance del gate por completo.

## Añadir una función al catálogo

### Caso preferido: vista enrutada nueva o existente

1. Confirma la pantalla, ruta (`path` literal en `App.tsx`), roles y guardas reales en
   el código.
2. Agrega (o crea) el export `soporteMeta: MarcadorSoporte[]` en el archivo de la
   vista, como primera declaración top-level después de los imports. Incluye el propio
   archivo en `sourceFiles` (D9) y **no** escribas `introducedIn` (el tipo lo omite a
   propósito).
3. Agrega el `id`/`inventoryId` a los tests que correspondan (golden fusionado,
   suites de la vista).
4. Ejecuta `node scripts/generar-catalogo.mjs` y verifica con `--check`.

### Caso núcleo manual (archivo no enrutado directamente por `App.tsx`)

Sigue el patrón `entry(...)` existente en `shared/soporte/catalogo.v1.ts` — este
mecanismo aplica a los archivos descritos en
[Fuera de alcance del gate](#fuera-de-alcance-del-gate-vistasadministraciontsx) y a
cualquier archivo todavía no migrado en `deuda[]`.

## Campos obligatorios

| Campo | Qué debe registrar |
|---|---|
| `id` / `inventoryId` | Identificador estable que enlaza el inventario auditado. |
| `module`, `label`, `intent` | Ubicación y propósito comprensible. |
| `aliases`, `actions`, `negativeTerms` | Frases positivas, verbos y conflictos que desambiguan. |
| `roles` | Audiencias activas; no equivale por sí solo a autorización backend. |
| `steps`, `route` | Procedimiento y ruta canónica verificadas. |
| `sensitivity`, `escalationReason` | Riesgo de datos/privilegios y momento de escalar. |
| `sourceFiles`, `authorizationRef` | Evidencia en código y estado real de la guarda. |
| `owner`, `lastVerifiedAt` | Responsable y fecha de revisión (el marcador los sigue escribiendo a mano — señal de revisión, no boilerplate). |
| `introducedIn` | Solo en el núcleo manual y en la entrada **emitida**; el marcador (`MarcadorSoporte`) lo omite — lo estampa el generador desde `catalogVersion`. |

## Checklist de alta y revisión

- [ ] El ID aparece una sola vez y corresponde a una fila del inventario.
- [ ] La ruta existe en `RUTAS_SOPORTE_CONOCIDAS` (marcador y núcleo comparten esta
      lista; el generador **no** la agrega automáticamente — D8, un typo en un marcador
      no se auto-declara "conocido").
- [ ] Los aliases incluyen lenguaje real del usuario y no solo nombres técnicos.
- [ ] Los términos negativos separan intenciones cercanas.
- [ ] Los pasos no prometen permisos que el backend o las reglas no verifican.
- [ ] La respuesta sensible evita exponer datos de otro usuario o tenant.
- [ ] Hay al menos un caso permitido y uno restringido o ambiguo.
- [ ] Producto/Soporte revisó contenido y el dueño actualizó `lastVerifiedAt`.
- [ ] El generador, `--check` y el gate de rutas terminan sin drift.

## Activar Tutor o Estudiante

`Tutor` y `Estudiante` están `active` en `ROLES_SOPORTE`
(`shared/soporte/catalogo.v1.ts`) y ya pueden resolver consultas: agrégalos a una
entrada solo cuando la pantalla y su autorización real hayan sido verificadas para ese
rol.

Los flujos actuales de estudiantes por enlace público siguen usando el rol `Publico`;
no deben migrarse por similitud de nombre con `Estudiante`.

## Verificación

```powershell
# Unit (marcadores, rutas de App.tsx, fusión, gate)
npm run test:node -- scripts/catalogo-marcadores.test.js scripts/rutas-app.test.js scripts/catalogo-fusion.test.js scripts/verificar-rutas-soporte.test.js

# Integración (generador end-to-end)
npm test -- --runInBand shared/soporte/catalogo.v1.test.ts scripts/validar-catalogo.test.ts

# Regresión de resolución
npm test -- --runInBand servicios/soporte/contexto.test.ts servicios/soporte/matcher.test.ts App.routing.test.ts

# Artefactos y gate contra la raíz real del repo
node scripts/generar-catalogo.mjs --check
node scripts/verificar-rutas-soporte.mjs
```
