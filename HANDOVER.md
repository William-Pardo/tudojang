# HANDOVER — 2026-09-04

Para quien retome (otra sesión, otra IA, u otro desarrollador).
**Fuente de verdad real: `bitacora.json`** (secciones `errores_sistema` y `historial`,
entradas ERR-0021 a ERR-0028). Este archivo es solo un snapshot rápido de respaldo.

## Estado en una línea
7 PRs mergeados a `main` y desplegados en verde (#85 a #91): firma tutor/colaborador,
sede extra Gajog, proceso de pago completo (transaccional), índice de Validar Pagos,
escáner QR + horas reales, botón de envío deshabilitado, y la feature nueva **Cobro Justo**.
No queda ningún PR abierto ni deploy pendiente.

## Lo PRIMERO que hay que hacer
Nada bloqueante. Antes de tocar `firestore.indexes.json` en cualquier sesión futura,
leer ERR-0024 en `bitacora.json`: cada push a `main` redespliega el archivo completo con
`--force`, así que un índice agregado manualmente que no llegue a mergearse a tiempo
puede desaparecer en el siguiente deploy automático de otra rama.

## Dónde está cada cosa nueva
- Cobro Justo (prorrateo de mensualidad, opt-in por tenant): fórmula en
  `utils/calculations.ts::calcularMontoCobroJusto`, toggle en
  `ConfiguracionClub.cobroJustoActivo` (switch pill en `Configuracion.tsx`), bloque
  informativo en `FormularioEstudiante.tsx` (reemplaza la Regla de Fin de Mes solo si
  el tenant activó la función).
- Pagos por link público de WhatsApp: `functions/pagosPublicos.js`
  (`resolverEstudiantePublico`/`reportarPagoPublico`), reemplaza las queries directas
  del cliente que estaban rotas.
- Validación de pagos: `functions/pagosValidacion.js::gestionarReportePago`,
  transaccional (`firestore.runTransaction`).
- Escáner QR con soporte iOS/Safari: `components/academico/EscanerQR.tsx`, fallback
  `jsQR` cuando `window.BarcodeDetector` no existe.
- Horas reales del estudiante: `servicios/academico/metricasAsistenciaService.ts`,
  consumido en `vistas/MiPerfil.tsx`.

## Lo que quedó pendiente (no bloqueante)
- `public/Botones Tudojang.ai` apareció con miles de líneas modificadas en disco sin que
  ningún agente lo tocara — coincide con CR-0003 (corrupción de disco intermitente, ya
  documentada, causa raíz sin investigar). No se incluyó en ningún commit. El usuario
  debería revisarlo cuando pueda.
- `.atl/skill-registry.md` aparece modificado en casi cada sesión sin que nadie lo edite
  a propósito — probablemente un proceso en background lo actualiza. No investigado.

## Cómo trabajar en este repo
- `npx tsc --noEmit` · `npx jest --silent` (suite completa, ~180 suites / ~1950 tests).
- Corrupción de objeto git no bloqueante, aparece en casi cada commit/push/fetch
  (`error: corrupt loose object 'f6e1584d...'`) pero normalmente no impide completar la
  operación. Si alguna vez SÍ es fatal, usar
  `git -c maintenance.auto=false -c gc.auto=0 <comando>`.
- Antes de confiar en un auto-merge "sin conflictos": revisar el archivo completo, no
  solo la ausencia de marcadores `<<<<<<<` — ya pasó dos veces en esta sesión que un
  auto-merge dejó código duplicado o referencias a funciones que ya no existían.
