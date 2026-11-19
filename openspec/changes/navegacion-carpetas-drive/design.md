# Design: Navegación de carpetas Drive con migas de pan y preservación de biblioteca

## Arquitectura y Estado en `BibliotecaView.tsx`

### Estado Nuevo
- `rutaCarpetasDrive`: Array de `{ id: string, nombre: string }`.
  - Cuando se establece `folderId` inicial (por localStorage o Firestore), la ruta se inicializa con `[{ id: folderId, nombre: folderName || 'Carpeta institucional' }]`.
  - Cuando se hace click en `abrirCarpetaDrive(subcarpetaId, subcarpetaNombre)`:
    - Se agrega al array de ruta.
    - Se invoca `driveService.listarCarpetaDrive(tenantId, subcarpetaId)` y se actualiza `archivosDrive`.
  - Cuando se hace click en un nivel anterior del breadcrumb `navegarARutaDrive(indice)`:
    - Se trunca la ruta hasta ese índice.
    - Se invoca `driveService.listarCarpetaDrive(tenantId, destino.id)` y se actualiza `archivosDrive`.
    - Se actualiza `folderId` y `folderName`.

### Preservación de Recursos
- Los recursos aprobados provienen de Firestore (`recursos`), por lo que navegar carpetas NO toca ni borra `recursos`.
- Los recursos que ya estaban aprobados pero cuyos archivos físicos no están en la subcarpeta actual siguen mostrándose como aprobados en la aplicación o bajo su estado `fuera_carpeta_activa`.

### UI / Componentes
- Encima de la lista de archivos detectados, un bloque de breadcrumb navegable:
  `[ Raíz Institucional ] > [ Subcarpeta A ] > [ Subcarpeta B ]`
- Cada elemento previo es un botón accesible con `type="button"`, teclado y estilo Tailwind consistente.
