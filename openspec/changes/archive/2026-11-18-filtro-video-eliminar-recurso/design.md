# Design: YouTube Video Embeddability Pre-Validation & Direct Resource Deletion

## Architecture Overview

```
[ModalClasificarVideo]
    │
    ├─> User pastes URL ──> parsearYoutubeVideoId(url)
    │                             │
    │                       Valid ID found?
    │                        ├── Yes ──> Render <YoutubePlayer videoId={id} ... />
    │                        │             │
    │                        │             ├── onReady ──> State: 'valid' (enable Save)
    │                        │             └── onError(101|150|100|2) ──> State: 'blocked' (disable Save + show alert)
    │                        └── No ───> State: 'idle'
    │
    └─> "Guardar" disabled while state === 'blocked' or 'validando'

[BibliotecaView]
    │
    ├─> recursosDirectos.map(...)
    │         │
    │         └── Action buttons: [Vista previa] [Reporte] [Eliminar]
    │                                                          │
    │                                                  window.confirm()
    │                                                          │
    │                                              bibliotecaService.eliminarRecurso()
    │                                                          │
    │                                                  Firestore deleteDoc()
```

## Component Contracts

### 1. `YoutubePlayer.tsx`
Enhance `YoutubePlayerProps`:
- Add optional callback `onErrorDetectado?: (mensaje: string, codigo?: number) => void;`
- Add optional callback `onListo?: () => void;`
- When `onError` triggers, forward message and code to `onErrorDetectado`.

### 2. `ModalClasificarVideo.tsx`
State management:
- `estadoValidacionVideo`: `'inactivo' | 'verificando' | 'valido' | 'bloqueado'`
- `errorBloqueoVideo`: `string | null`
- Whenever `videoUrl` changes:
  - If empty or invalid URL: reset to `'inactivo'` and clear error.
  - If valid YouTube ID: set to `'verificando'`.
- If `onErrorDetectado` triggers:
  - Set `estadoValidacionVideo = 'bloqueado'`.
  - Set `errorBloqueoVideo = mensaje`.
- If `onListo` triggers and no error:
  - Set `estadoValidacionVideo = 'valido'`.
- Button "Guardar":
  - `disabled={guardando || estadoValidacionVideo === 'bloqueado' || estadoValidacionVideo === 'verificando'}`

### 3. `bibliotecaService.ts`
Add method:
```ts
eliminarRecurso: (tenantId: string, recursoId: string) => Promise<void>;
```
- In demo/mock mode: removes from `mockRecursos`.
- In Firestore mode: calls `deleteDoc(doc(getDatabase(), 'tenants', tenantId, 'recursos', recursoId))`.

### 4. `firestore.rules`
```
match /tenants/{tenantId}/recursos/{recursoId} {
  allow read: if authenticated()
    && (currentTenantId() == tenantId || isSuperAdmin());
  allow create, update, delete: if (isInstructor() && currentTenantId() == tenantId)
    || isSuperAdmin();
}
```
Ensures instructors (Admin, Editor, Asistente, Maestro) can delete resources in their tenant.
