# UX Pipeline Centro de Estudios + Google Drive

Fecha: 2026-07-01

## Objetivo

Simplificar el módulo Centro de Estudios para que el flujo sea entendible como un pipeline operativo de tres pasos:

1. Conectar Google Drive y seleccionar carpeta institucional.
2. Revisar biblioteca de recursos, clasificar y aprobar materiales.
3. Publicar asignaciones académicas con criterio, fechas y trazabilidad.

## Paso 1: Conexión Drive y carpeta activa

La tarjeta principal de Drive ahora debe mostrar información operativa y no mensajes de demo:

- Estado: conectado, conectando o desconectado.
- Cuenta Drive: correo real de la cuenta autorizada.
- Carpeta conectada: nombre real de la carpeta seleccionada en Google Drive cuando esté disponible.
- ID de conexión cuando exista.

El botón principal funciona como switch:

- Si no hay conexión activa: conecta Google Drive.
- Si hay conexión activa: desconecta Google Drive con confirmación.

La selección de carpeta se mantiene como acción posterior a la conexión y persiste el `folderName` para mejorar claridad visual.

## Paso 2: Biblioteca, clasificación y aprobación

La biblioteca ya no debe depender visualmente de archivos demo cuando Drive está activo.

Comportamiento esperado:

- Si no hay Drive conectado, se informa que debe conectarse Drive para cargar recursos.
- Si Drive está conectado pero no hay carpeta, se pide seleccionar la carpeta institucional.
- Si existe carpeta activa, se listan los archivos de Google Drive.
- Los recursos muestran tipo legible según MIME: PDF, video, imagen, documento/texto, carpeta o archivo.
- La clasificación y aprobación se presentan como parte del mismo paso 2 para evitar que el usuario sienta que está en un flujo separado.

## Paso 3: Asignación académica

La asignación se reorganizó como paso de publicación de recurso académico.

Campos y comportamiento incluidos:

- Recurso aprobado.
- Jornada asociada para trazabilidad.
- Público objetivo.
- Criterio de asignación:
  - Estudio
  - Repaso
  - Refuerzo
  - Evaluación
  - Quiz
- Fecha de asignación.
- Fecha límite.
- Descripción/instrucciones.
- Publicación de la asignación.

Nota técnica: `repaso` se normaliza internamente como `estudio` y `quiz` como `evaluacion` para no romper el modelo actual de uso académico.

## Textos retirados

Se retiraron textos internos o de demo que no deben aparecer al usuario final:

- “Modo piloto visible”.
- “El feature flag del tenant aún no está activo...”.
- “· sin consumo de IA”.
- “Demo UX · sin consumo de IA”.
- Bloques visibles de advertencia “No hay recursos aprobados...” y “Selecciona o confirma una jornada...”.

Los errores funcionales siguen existiendo, pero ahora aparecen solo cuando impiden publicar una asignación.

## Archivos modificados

- `functions/academico/drive.js`
  - Persiste y retorna `activeFolderName` / `folderName` para mostrar el nombre real de carpeta conectada.

- `services/storage/driveService.ts`
  - Añade soporte de `activeFolderName`.
  - Permite enviar `folderName` al guardar carpeta activa.

- `vistas/admin/BibliotecaView.tsx`
  - Reestructura la UX de conexión, carpeta, biblioteca y clasificación.
  - Elimina dependencia visual de datos demo cuando Drive está conectado.
  - Corrige el uso del nombre de archivo/carpeta al navegar carpetas.

- `vistas/admin/AsignacionesView.tsx`
  - Reestructura el bloque como paso 3.
  - Añade criterio de asignación.
  - Retira advertencias internas visibles.

- `vistas/CentroEstudios.tsx`
  - Retira mensajes de piloto/demo.
  - Presenta el módulo como pipeline de Centro de Estudios.

- Tests actualizados:
  - `functions/academico/drive.test.js`
  - `services/storage/driveService.test.ts`
  - `vistas/admin/BibliotecaView.test.tsx`
  - `vistas/admin/AsignacionesView.test.tsx`
  - `vistas/CentroEstudios.test.tsx`

## Validación ejecutada

Comandos ejecutados:

```powershell
npm run test:functions:drive -- --runTestsByPath functions/academico/drive.test.js
```

Resultado:

- PASS.
- 62 pruebas aprobadas.

```powershell
npm run test:app -- --runTestsByPath vistas/admin/BibliotecaView.test.tsx vistas/admin/AsignacionesView.test.tsx vistas/CentroEstudios.test.tsx services/storage/driveService.test.ts --silent
```

Resultado:

- PASS.
- 45 pruebas aprobadas.

```powershell
npm run build
```

Resultado:

- PASS.
- Solo advertencias no bloqueantes de tamaño de chunks, Browserslist antiguo y directivas `"use client"` en dependencias.

## Pendientes recomendados antes de producción

1. Desplegar frontend y funciones si se quiere ver esta UX en `https://tudojang.com`.
2. Validar manualmente el flujo completo:
   - conectar Drive;
   - elegir carpeta;
   - listar archivos reales;
   - aprobar recurso;
   - publicar asignación.
3. Decidir si el paso 3 debe persistir una sede explícita en el modelo de asignaciones. Por ahora no se agregó campo `sedeId` para evitar romper contratos existentes sin una migración clara.

