## Context

Tudojang es un SaaS multi-tenant de gestión de dojangs de Taekwondo construido con React 19, TypeScript 5.7, Vite 6, Firebase Firestore y Cloud Functions (Node 20). La arquitectura actual es una SPA con HashRouter, Context providers, servicios, hooks y vistas. El negocio ya maneja sedes, instructores, grupos, bloques horarios y programas comerciales.

El módulo de estudio agrega la capa académica completa: Google Drive como almacén de archivos institucionales, una biblioteca académica por tenant, programas formativos, jornadas de instrucción con ciclo de vida real, asignaciones del maestro y un centro de estudios personal para el estudiante con seguimiento de progreso, supervisado por tutores.

## Goals / Non-Goals

**Goals:**
- Conectar Google Drive institucional por tenant mediante OAuth; tokens nunca expuestos al navegador.
- Proveer biblioteca académica clasificada con estados, auditoría y alertas por archivos eliminados.
- Modelar programas formativos académicos separados de los programas comerciales.
- Evolucionar `BloqueHorario` a bloques recurrentes + jornadas de instrucción con validación de conflictos.
- Gestionar espacios físicos por sede como recurso validado en jornadas.
- Permitir al maestro publicar asignaciones (grupo, grado o estudiante) con contexto pedagógico.
- Proveer centro de estudios al estudiante: recursos vigentes, consumo, quizzes, progreso.
- Proveer vista de supervisión al tutor (lectura): sin capacidad de completar actividades.
- Motor de progreso granular (PDF por páginas, video por segundos, quiz por umbral), con sincronización optimista.
- Activar todo por tenant mediante feature flag (`features.centroEstudios`).

**Non-Goals:**
- Videoconferencia o streaming en vivo dentro de Tudojang.
- Integración con OneDrive/SharePoint o Dropbox en esta versión (arquitectura preparada, no implementada).
- Corrección de exámenes de ascenso (eso pertenece al módulo de graduaciones).
- Editor de contenido propio dentro de Tudojang (los archivos viven en Drive).
- Pago o suscripción académica (pertenece al módulo comercial existente).

## Decisions

### D1: Google Drive como primer proveedor de almacenamiento

**Decisión:** Implementar solo Google Drive v3 en esta versión mediante una interfaz abstracta `StorageProvider`.

**Alternativas consideradas:**
- Implementar Drive + OneDrive al mismo tiempo: duplica la complejidad de OAuth y el surface de errores.
- Firebase Storage: no permite usar archivos institucionales que la academia ya tiene en Drive.

**Rationale:** La academia ya usa Google Workspace. Drive v3 tiene SDK maduro. La interfaz abstracta permite añadir OneDrive en el futuro sin refactoring mayor.

**Diagrama — Flujo OAuth Drive:**
```
[Admin Tenant]
  → llama Cloud Function "connectDrive"
  → CF genera URL OAuth con scope=drive.readonly + offline_access
  → Admin autoriza en Google
  → Google devuelve code al CF (redirect URI del servidor)
  → CF intercambia code por access_token + refresh_token
  → CF cifra tokens con Cloud KMS y guarda en Firestore (tenants/{id}/driveConnections/{connId})
  → Admin selecciona carpeta raíz
  → CF guarda folderId en driveConnections
[Frontend solicita archivo]
  → llama CF "getTemporaryFileUrl"
  → CF valida rol, asignación vigente, tenantId
  → CF renueva token si expira (usa KMS para descifrar)
  → CF genera signed URL temporal (15 min) o proxy de stream
  → Frontend recibe URL; nunca toca el access_token
```

### D2: Tokens cifrados en Cloud KMS, no en Firestore plaintext

**Decisión:** Usar Google Cloud KMS para cifrar refresh_tokens antes de persistirlos.

**Alternativas:** Guardar tokens encriptados con una clave en Secret Manager (más simple) vs KMS (key rotation, auditoría).

**Rationale:** KMS permite rotación de claves sin re-cifrar todos los tokens, y provee auditoría de uso. Es el estándar para tokens OAuth de larga vida en GCP.

### D3: Progreso con sincronización por intervalo, no por evento

**Decisión:** El cliente acumula progreso local (localStorage/IndexedDB) y sincroniza en: intervalo configurable (30s), pausa, visibilidad oculta y finalización.

**Alternativas:** Firestore onSnapshot en tiempo real (writes por segundo → costo) vs batch por evento (complejidad).

**Rationale:** Evita escrituras por segundo que dispararían costos en Firestore. El progreso eventual es aceptable pedagógicamente; no es trading en tiempo real.

**Diagrama — Motor de progreso PDF:**
```
[Visor PDF]
  → onPageVisible(pageNum) → marca página en Set local
  → onTimeSpent(pageNum, seconds) → acumula en Map local
  → cada 30s → syncProgress()
    → calcula uniquePages, totalSeconds
    → verifica criterio (página final alcanzada, permanencia mínima)
    → si cumple → estado "Completado"
    → escribe un único doc en Firestore (progreso/{uid}/{asignacionId})
  → on pausa/cierre → flush inmediato
```

### D4: Jornadas generadas desde bloques recurrentes, no reemplazando bloques

**Decisión:** Los `BloqueHorario` actuales subsisten. Se agrega `BloqueRecurrente` como concepto de patrón semanal y `JornadaInstruccion` como instancia real.

**Alternativas:** Migrar `BloqueHorario` directamente a `JornadaInstruccion` (ruptura) vs modelo dual temporal.

**Rationale:** Migración big-bang es riesgosa en producción. El modelo dual permite que el tenant adopte jornadas gradualmente sin perder la agenda actual.

**Diagrama — Ciclo de vida de Jornada:**
```
Borrador
  → [Admin/Maestro confirma] → Pendiente de confirmación
    → [CF valida: maestro disponible, espacio libre, grupo sin cruce,
       capacidad, autorización sede, compatibilidad disciplina]
      → Confirmada
        → [fecha llega] → En curso
          → [Maestro registra asistencia + objetivos + materiales]
            → Pendiente de cierre
              → [Maestro cierra] → Cerrada ✓ (avanza ciclo del programa)
Alternativas en cualquier paso:
  - Cancelada (no avanza ciclo)
  - Reprogramada (genera nueva jornada hija)
  - Parcial (avanza solo objetivos marcados)
  - Pendiente de sustitución
```

### D5: Aislamiento de colecciones académicas por tenantId en Firestore

**Decisión:** Todas las colecciones académicas son subcolecciones de `tenants/{tenantId}/` o llevan `tenantId` como campo indexado con reglas de seguridad que lo validan.

**Rationale:** Alineado con el modelo actual de la app. Las Security Rules validan `request.auth.token.tenantId == resource.data.tenantId` en cada colección.

### D6: Feature flag por tenant para activación gradual

**Decisión:** `tenants/{id}/features.centroEstudios: boolean` controla toda la superficie académica.

**Rationale:** Permite onboarding gradual y rollback inmediato sin despliegue nuevo.

### D7: Estrategia de mocking y testing

**Decisión:** Usar los mocks de Firebase existentes (patrón ya establecido en el proyecto). Para las Cloud Functions se usarán mocks de `firebase-functions-test`. Para el motor de progreso se testean las funciones puras de cálculo en Jest sin dependencias de Firebase. Cypress cubre los flujos E2E críticos: invitación, publicación de asignación, consumo de recurso y cierre de jornada.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|-----------|
| Revocación de permisos de Drive (usuario elimina archivo o revoca OAuth) | Detector via webhook de Drive + polling periódico; bloqueo inmediato de asignaciones afectadas + alerta al tenant |
| Costo de Firestore por progreso granular | Sincronización batch (no por evento), un doc por asignación/estudiante, no sub-docs por página |
| Complejidad de validación de conflictos en jornadas | CF dedicada `validateJornada` como única fuente de verdad; Firestore transactions para prevenir race conditions |
| Migración de `BloqueHorario` sin romper agenda actual | Modelo dual; los bloques actuales se mantienen; jornadas son opt-in por tenant |
| Tokens de Drive expirados sin renovación silenciosa | CF renueva token on-demand antes de cada acceso; si falla notifica al admin del tenant |
| Multi-grado en un mismo grupo | Las asignaciones tienen campo `grados: string[]`; el motor de progreso filtra por grado del estudiante |

## Migration Plan

1. **Fase 0 — Infraestructura**: Feature flag, roles académicos en Firebase Auth claims, colecciones Firestore con reglas.
2. **Fase 1 — Biblioteca y Drive**: Conexión OAuth, importación de archivos, clasificación, biblioteca por tenant.
3. **Fase 2 — Agenda ampliada**: Espacios físicos, bloques recurrentes, jornadas con validación de conflictos y ciclo de vida.
4. **Fase 3 — Programas y asignaciones**: Programas académicos, asignaciones del maestro, publicación de materiales.
5. **Fase 4 — Centro de Estudios**: Roles estudiante/tutor, invitaciones, consumo de recursos, motor de progreso.
6. **Fase 5 — Supervisión**: Vista tutor, activación por tenant del flag.

**Rollback:** Desactivar `features.centroEstudios` en el tenant → UI oculta todo el módulo académico. Cloud Functions académicas son independientes del núcleo.

## Open Questions

1. ¿Los quizzes se crean dentro de Tudojang o también viven en Google Drive (Forms)? → Asumo creados en Tudojang para tener control de intentos y umbral.
2. ¿El límite de dispositivos simultáneos por estudiante es configurable por tenant desde el inicio o se deja para una fase posterior?
3. ¿Se notifica al estudiante (push/email) cuando el maestro publica una nueva asignación?
