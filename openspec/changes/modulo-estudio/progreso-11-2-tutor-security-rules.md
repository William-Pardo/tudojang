# Progreso 11.2 - Security Rules del tutor

Fecha: 2026-06-27

## Resultado

Tarea 11.2 cerrada. Las reglas de Firestore ya restringen la escritura de progreso académico a estudiantes sobre su propio documento y permiten al tutor únicamente lectura cuando existe vínculo con el estudiante.

## Alcance verificado

- `Tutor` vinculado puede leer progreso del estudiante.
- `Tutor` vinculado no puede escribir progreso del estudiante.
- `Tutor` no vinculado no puede leer progreso del estudiante.
- `Estudiante` puede escribir su propio progreso en la ruta real usada por repositorios/Cloud Functions.

## Archivos relacionados

- `firestore.rules`
- `functions/test/firestore-rules.behavior.test.js`

## Evidencia TDD

| Fase | Evidencia |
| --- | --- |
| RED | Test existente cubre el caso requerido: `tutor cannot write student academic progress but can read it in same tenant`. |
| GREEN | `npm run test:firestore-rules` ejecutado con Firebase Emulator y finalizado con exit code 0. |
| REFACTOR | No se modificó código porque la regla y el test ya estaban implementados y pasaron verificación. |

## Comandos ejecutados

```powershell
npm run test:functions -- functions/test/firestore-rules.behavior.test.js
node --test functions/test/firestore-rules.behavior.test.js
npm run test:firestore-rules
```

## Nota operativa

La ejecución directa con `node --test functions/test/firestore-rules.behavior.test.js` falló porque el Firestore Emulator no estaba activo en `127.0.0.1:8080`. No fue un fallo de reglas. La verificación válida fue `npm run test:firestore-rules`, que levanta el emulator con `firebase emulators:exec`.
