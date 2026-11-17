# Diseño: Agregar Video Directo a Biblioteca y Asignación de Material

## Arquitectura y Componentes

### 1. `servicios/academico/bibliotecaService.ts`
Agregar el método `crearRecursoVideoDirecto`:
```ts
crearRecursoVideoDirecto(
  tenantId: string,
  input: {
    titulo: string;
    videoUrl: string;
    disciplina?: string;
    tags?: string[];
    creadoPorUid: string;
  }
): Promise<RecursoAcademico>
```
- Parsea `videoUrl` usando `parsearYoutubeVideoId`. Si no es válida, arroja un error explicativo.
- Genera un `RecursoAcademico` con:
  - `id`: `rec-video-${Date.now()}-${random}`
  - `tenantId`
  - `proveedor`: `'google_drive'` (para compatibilidad de tipos existente sin migración forzada de esquemas)
  - `externalFileId`: `video-${videoId}`
  - `youtubeVideoId`: `videoId`
  - `nombre`: input.titulo
  - `tituloVisible`: input.titulo
  - `mimeType`: `'video/mp4'`
  - `estado`: `'aprobado'`
  - `ficha`: { disciplina, tipo: 'video', usos: ['estudio'], tags }
- Se persiste en Firestore bajo la colección `tenants/{tenantId}/recursos_academicos/{id}` (o memoria mock si Firebase no está configurado).

### 2. Componente Modal Reutilizable `ModalClasificarVideo.tsx`
Extraer o crear un modal autocontenido para la creación y edición directa de video:
- Campos: Título visible, Disciplina, Tipo (fijo en 'video'), URL del video, Tags (con chips de tags sugeridos).
- Validación de URL en vivo y advertencia de permisos de inserción.
- Props:
  - `abierto: boolean`
  - `onCerrar: () => void`
  - `onGuardar: (datos: { titulo: string; videoUrl: string; disciplina: string; tags: string[] }) => Promise<void>`
  - `tagsSugeridosIniciales?: string[]`

### 3. Modificaciones en `BibliotecaView.tsx`
- Renderizar el botón `[ 📹+ ]` junto al título de Carpeta Activa / Recursos Detectados con tooltip `"Agregar video"`.
- Integrar `ModalClasificarVideo` para la creación de video directo.
- Unificar la lista mostrada en `archivosVisibles` para incluir los recursos de video directos aprobados, permitiendo verlos, reproducirlos y editarlos independientemente de la conexión con Drive.

### 4. Modificaciones en `AsignarMaterialWizard.tsx`
- Agregar en el Paso 1 (Material) el botón `[ 📹+ ] Agregar video` debajo del buscador / contador de tags.
- Al hacer clic, abrir `ModalClasificarVideo` prellenando los tags del programa.
- Al guardar:
  - Llamar a la función de guardado y aprobación.
  - Inyectar el nuevo recurso en la lista de `materialesDisponibles`.
  - Seleccionar automáticamente el ID del recurso recién creado (`setDraft((actual) => ({ ...actual, recursoId: nuevoRecurso.id }))`).
