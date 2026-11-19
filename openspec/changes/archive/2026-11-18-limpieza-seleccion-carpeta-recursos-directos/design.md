# Design: Selección fluida de carpetas Drive y discriminación de recursos directos

## Cambios Arquitectónicos en `BibliotecaView.tsx`

### 1. Eliminación de `confirmarCambioCarpetaDrive`
- En `validarCarpetaDrivePorId`, remover la llamada bloqueante a `confirmarCambioCarpetaDrive`.
- La selección de carpeta pasa a ser puramente reactiva: carga los archivos de la nueva carpeta y persiste la selección activa sin prompts modales intrusivos.

### 2. Filtro estricto de `recursosDirectos`
- Modificar el cálculo memoizado:
  ```ts
  const recursosDirectos = React.useMemo(
    () => recursos.filter((r) => r.estado === 'aprobado' && (Boolean(r.youtubeVideoId) || r.externalFileId?.startsWith('video-'))),
    [recursos]
  );
  ```
- Ya no depende de `archivosDriveIds`. Los recursos sincronizados de otras carpetas de Drive no se inyectan en `recursosDirectos`.

### 3. Sincronización de estado de recursos
- `sincronizarEstadosFuenteConArchivos`: mantener `verificada` para los recursos del tenant mientras la cuenta Drive permanezca conectada, evitando estigmatizarlos con `fuera_carpeta_activa` al simplemente explorar subcarpetas.
