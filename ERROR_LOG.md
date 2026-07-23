# ERROR_LOG — 2026-07-22

Bugs y anomalías encontrados durante la sesión, con causa raíz y estado.

## 1. `scoreUltimaEvaluacion` devolvía el PRIMER intento — RESUELTO
- **Síntoma**: el acudiente veía un score de quiz congelado en un valor viejo.
- **Causa raíz**: `calcularScoreUltimoQuiz` usaba `.sort((a,b) => b.registradoEn.localeCompare(a.registradoEn))[0]`. `registradoEn` es ISO a milisegundos y `Array.sort` es estable → ante empate conservaba el orden de entrada y devolvía el PRIMER intento. En producción se dispara si el reloj del dispositivo se atrasa entre dos intentos.
- **Cómo se encontró**: la suite pasó 13/13 a la primera; correrla 5 veces dio 1 en rojo.
- **Fix**: recorrido con `reduce` + `>=` (gana el último). `servicios/academico/actividadService.ts`.

## 2. Correo del acudiente sin normalizar → padre no ve a su hijo — RESUELTO
- **Síntoma**: el acudiente entra y ve una pantalla vacía, sin error.
- **Causa raíz**: `resolveLinkedStudent` consulta `where('tutor.correo','==', <email de Auth en minúsculas>)`. La igualdad de Firestore es case-sensitive. La importación masiva guardaba el correo del acudiente TAL CUAL (normalizaba el del alumno, no el del tutor). `createInvitation` sí normaliza → la cuenta Auth queda en minúsculas y el doc en mayúsculas: desencuentro garantizado.
- **Fix**: normalización centralizada en el callable `crearEstudiante` + `ModalImportacionMasiva.tsx`.
- **Verificación en prod**: 0 documentos afectados (las altas reales se hicieron por formulario). No hay migración pendiente.

## 3. Test verde certificando el defecto (identidad) — RESUELTO
- `tutorStudentResolver.test.ts:78` "es case-insensitive en el email" pasaba en verde porque corre en modo **mock**, donde el fake baja a minúsculas AMBOS lados. La rama de Firestore no puede. El mock era MÁS permisivo que producción.

## 4. Flake preexistente en `AsignarMaterialWizard.test.tsx` — RESUELTO
- **Síntoma**: 2 tests del Paso 3 fallaban intermitentemente en el run completo (3/5).
- **Causa raíz**: tests de 5-10s (navegan el wizard con userEvent + 13 grados) contra el timeout default de 5000ms de jest, bajo carga.
- **Descartado**: `userEvent.setup({ delay: null })` no ayudó (la lentitud es del render), empeoró tiempos.
- **Fix**: `jest.setTimeout(30000)`. 6 corridas verdes + regresión completa limpia.

## 5. Anomalías de proceso (no de código)
- **`git checkout -- archivo` no revierte archivos untracked**: al revertir una mutación sobre
  `scripts/normalizar-correos.js` (nuevo), la mutación quedó puesta y casi se commitea con el
  dry-run desactivado. Para archivos nuevos: copia de respaldo antes de mutar.
- **Mutar la rama equivocada**: varias veces la primera mutación tocó la rama MOCK, que la
  integración no ejecuta (corre con `isFirebaseConfigured: true`). Hay que mutar la rama Firestore.
- **`git commit` en Windows** tira errores ruidosos `cannot lock ref refs/codex/turn-diffs/… Filename too long` — mecanismo de checkpoints de Codex; los commits igual quedan. Preexistente.
