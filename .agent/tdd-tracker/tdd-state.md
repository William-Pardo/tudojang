# Estado TDD y refactorización de Tudojang

> Última revisión documental: 2026-06-25
>
> Estado estimado del trabajo útil: **45–60%**
>
> Este documento representa el estado real conocido, no solo las casillas históricas.

## Resumen ejecutivo

La aplicación tiene una base de pruebas amplia, pero todavía no puede considerarse completamente refactorizada ni desarrollada bajo TDD.

| Indicador | Estado actual |
|---|---:|
| Archivos productivos TypeScript/TSX | 181 |
| Archivos de pruebas TypeScript/TSX | 58 |
| Pruebas Jest que pasan en la ejecución global más reciente | 563 |
| Fallos Jest conocidos | 10, más pruebas `node:test` recolectadas incorrectamente por Jest |
| Functions | 57/57 pruebas aprobadas con su runner correcto |
| Asistente E2E | 7/7 recorridos aprobados |
| Build de producción | Aprobado |
| TypeScript global | Bloqueado por conflictos preexistentes de tipos Jest/Chai |

## Interpretación correcta de la cobertura

El reporte disponible muestra:

| Métrica | Cobertura reportada |
|---|---:|
| Líneas | 94.79% |
| Statements | 93.08% |
| Funciones | 86.11% |
| Ramas | 89.72% |

Estos porcentajes cubren únicamente **1.421 líneas instrumentadas**. No representan automáticamente los 181 archivos productivos de la aplicación. No deben utilizarse como evidencia de que el proyecto completo tiene 93% de cobertura.

Antes de establecer una meta global se debe:

1. Corregir la configuración de recolección de cobertura.
2. Incluir explícitamente todos los archivos productivos relevantes.
3. Excluir únicamente archivos generados, tipos puros y adaptadores justificadamente no ejecutables.
4. Generar una nueva línea base reproducible.

## Trabajo completado o sustancialmente cubierto

### Servicios y lógica

- `usuariosApi.ts`: cobertura reportada de 100%.
- `eventosApi.ts`: cobertura reportada de 100%.
- `pagosApi.ts`: cobertura reportada de 100%.
- `pagosEstudiantesApi.ts`: cobertura reportada de 100%.
- `asistenciaApi.ts`: cobertura reportada de 100%.
- `estudiantesApi.ts`: aproximadamente 98% de statements.
- Asistente híbrido: catálogo local, IA backend, cuotas, tickets, telemetría, privacidad y E2E implementados.
- Reglas de seguridad y límites multi-tenant del asistente probados con Firebase Emulator.

### Componentes

Existe cobertura alta o completa en componentes como:

- `AsistenteVirtual`
- `FormularioUsuario`
- `ModalImportacionMasiva`
- `FilaEstudiante`
- `FilaUsuario`
- `TablaUsuarios`
- `ComprobantesPago`
- estados vacíos, errores, loaders, badges y switches

### Flujos críticos ya cubiertos

- Respuestas locales, aclaración, IA y cuota agotada.
- Creación segura de tickets.
- Consentimiento explícito para WhatsApp.
- Protección de identidad y tenant.
- Límites concurrentes de IA.
- Generación multipágina de certificados.
- Límites de membresía y selección de instructores en agenda.

## Bloqueadores técnicos actuales

### 1. Configuración de pruebas

La ejecución Jest raíz recolecta archivos que usan `node:test`. Esto produce fallos artificiales como “test suite must contain at least one test” y errores de módulos ESM.

Se debe separar:

- Jest: React, TypeScript y Testing Library.
- `node --test`: Cloud Functions y scripts Node.
- Firebase Emulator: reglas y pruebas de integración.
- Cypress: recorridos E2E.

### 2. Fallos reales de la suite global

La última ejecución global registró 563 pruebas aprobadas y 10 fallos en módulos no relacionados directamente con el asistente. Entre los problemas observados:

- mocks incompletos de `framer-motion`;
- pruebas de `ModalRegistrarPago`;
- pruebas de `Dashboard`;
- dependencias o comportamiento asíncrono no estabilizado.

Estos fallos deben resolverse antes de usar la suite global como puerta de CI.

### 3. TypeScript global

`npx tsc --noEmit` está afectado por conflictos entre tipos de Jest, `jest-dom` y Chai. Primero debe corregirse la configuración de tipos; después se deben clasificar los errores productivos restantes.

### 4. Seguridad del asistente

La tarea 4.3 sigue abierta porque requiere acciones externas:

- revocar y rotar `RESEND_API_KEY`;
- crear `GEMINI_API_KEY` en Secret Manager;
- registrar reCAPTCHA Enterprise en Firebase App Check;
- desplegar y comprobar métricas antes de habilitar IA.

### 5. Storage multi-tenant

El cambio `asegurar-storage-tenant` conserva tres tareas pendientes de verificación y cierre.

## Hoja de ruta priorizada

### Prioridad 0 — estabilizar la plataforma de pruebas

- [x] Excluir `functions/**` y scripts `node:test` del Jest raíz.
- [x] Crear comandos separados y claros para cada runner.
- [ ] Corregir los 10 fallos reales actuales.
- [ ] Corregir los tipos Jest/Chai para que `tsc` sea una señal confiable.
- [ ] Regenerar cobertura incluyendo toda la fuente productiva.
- [ ] Configurar CI con build, TypeScript, Jest, Functions, Emulator y E2E separados.

#### Evidencia TDD — separación de runners

| Etapa | Evidencia |
|---|---|
| RED | `scripts/infraestructura-pruebas.test.js`: 3/3 contratos fallaron antes de modificar configuración. |
| GREEN | 3/3 contratos aprobados; Jest lista solo pruebas TS/TSX; Functions 58/58. |
| REFACTOR | Scripts separados: `test:app`, `test:functions`, `test:node`, `test:infra` y `test:all`. Se eliminó la transformación JS innecesaria de Jest. |

`npx tsc --noEmit` ya no analiza `functions/` ni pruebas Node, pero la ejecución completa superó tres minutos. Su rendimiento y los conflictos de tipos restantes continúan pendientes.

#### Evidencia TDD — mock estable de Framer Motion

| Etapa | Evidencia |
|---|---|
| RED | `vistas/Dashboard.test.tsx`: 1/4 falló porque `motion.div` no existía; el contenido de solicitudes no se renderizaba. |
| GREEN | `Dashboard.test.tsx`: 4/4 aprobadas, incluyendo solicitudes pendientes. |
| REFACTOR | `__mocks__/framer-motion.tsx` exporta componentes cacheados por etiqueta, filtra props exclusivas de animación y evita automocks duplicados. |

La verificación con `--detectOpenHandles` terminó en verde y sin handles reportados.

#### Evidencia TDD — ModalRegistrarPago

| Etapa | Evidencia |
|---|---|
| RED | `ModalRegistrarPago.test.tsx`: 6/8 fallaban; la carga quedaba bloqueada y los casos siguientes agotaban 5 segundos. |
| GREEN | Al usar correctamente el mock manual compartido, `ModalRegistrarPago.test.tsx` pasó 8/8. |
| REFACTOR | Se eliminaron automocks redundantes en `ModalRegistrarPago`, `Dashboard` y `ModalVerFirma`; las tres suites pasan juntas 25/25. |

La ejecución conjunta con `--detectOpenHandles` finalizó en 29.6 segundos y no reportó handles abiertos.

#### Evidencia TDD — FormularioEstudiante

| Etapa | Evidencia |
|---|---|
| RED | Dos pruebas excedían el timeout y luego demostraron que el botón seguía deshabilitado aunque los campos visibles y el grupo derivado eran correctos. |
| GREEN | Se sincronizó la validación completa después de calcular `grupo`; las dos pruebas y el contrato puro pasaron 3/3. |
| REFACTOR | El esquema se exportó como `schemaEstudiante` y el helper de prueba centraliza el llenado mínimo y espera el estado derivado. |

La suite completa de `FormularioEstudiante` pasa 18/18 con `--detectOpenHandles`.

#### Evidencia TDD — filtros de VistaEstudiantes

| Etapa | Evidencia |
|---|---|
| RED | El recorrido de búsqueda, grado, grupo y estado excedía el timeout de 5 segundos. |
| GREEN | Se sustituyeron simulaciones costosas de controles nativos por eventos directos y se esperó la inicialización asíncrona de la misión. |
| REFACTOR | La prueba verifica cada transición de filtro sin `forceExit`; la vista completa pasa 15/15 con detección de handles. |

La suite de `VistaEstudiantes` termina naturalmente en verde y no reporta handles abiertos.

### Prioridad 1 — seguridad y aislamiento

- [ ] Cerrar la tarea 4.3 del asistente.
- [ ] Completar las tres tareas pendientes de Storage multi-tenant.
- [ ] Auditar reglas Firestore y Storage de todos los módulos.
- [ ] Probar operaciones cruzadas entre tenants en estudiantes, pagos, sedes, equipo técnico y archivos.
- [x] Revisar funciones HTTP antiguas y migrar configuraciones heredadas como `functions.config().gemini` (resuelto: `gemini.api_key` eliminado de Runtime Config; `analizarComprobanteEstudiante` usa Secret Manager).

### Prioridad 2 — servicios de negocio

Revisar con TDD y cobertura real:

- [ ] `configuracionApi.ts`: cobertura actual especialmente baja.
- [ ] `finanzasApi.ts`
- [ ] `sedesApi.ts`
- [ ] `programasApi.ts`
- [ ] `notificacionesApi.ts`
- [ ] `tiendaApi.ts`
- [ ] `emailService.ts`
- [ ] `pushService.ts`
- [ ] `plantillas.ts`
- [ ] `baseConocimiento.ts`
- [ ] `tudojangRelay.ts`
- [ ] `wompiWebhook.ts`

También se deben completar las ramas faltantes de `censoApi.ts`.

### Prioridad 3 — componentes y formularios

Auditar por comportamiento, no solo por renderizado:

- [ ] `FormularioSede`
- [ ] `FormularioImplemento`
- [ ] `FormularioMovimiento`
- [ ] `BrandingProvider`
- [ ] `GestionNotificacionesPush`
- [ ] `ModalAgendarClase`
- [ ] `ModalBusquedaGlobal`
- [ ] modales de compartir, compras e inscripciones
- [ ] `ModalGestionarSolicitudes`
- [ ] `ModalRecuperarContrasena`
- [ ] `ModalSeleccionarEstudiante`
- [ ] completar ramas de `ModalVerFirma`
- [ ] decidir si `Iconos.tsx` requiere pruebas o exclusión justificada

### Prioridad 4 — vistas y recorridos integrados

Las vistas grandes necesitan pruebas de integración y extracción de lógica:

- [ ] Configuración
- [ ] Administración
- [ ] Master Dashboard
- [ ] Eventos y Evento Público
- [ ] Carnetización y Certificaciones
- [ ] Gestión de Clase y Horarios
- [ ] Mi Perfil y Perfil Tutor
- [ ] Pasarelas de inscripción y pagos
- [ ] Tienda pública y administrativa
- [ ] Censo y Misión Kicho
- [ ] Registro, landing y salidas públicas
- [ ] PQRS, Notificaciones, Licencia y vistas de firma

### Prioridad 5 — refactor arquitectónico

- [ ] Dividir `Configuracion.tsx` en secciones, hooks y servicios pequeños.
- [ ] Dividir `MasterDashboard.tsx` por capacidades.
- [ ] Extraer lógica de negocio de vistas hacia funciones puras y hooks.
- [ ] Unificar contratos de errores, estados de carga y notificaciones.
- [ ] Reducir mocks globales frágiles.
- [ ] Revisar duplicación entre servicios, hooks y contextos.
- [ ] Dividir el bundle principal, actualmente superior a 3 MB minificado.

## Metas recomendadas

No se recomienda perseguir 100% uniforme en toda la interfaz. La meta debe depender del riesgo:

| Área | Meta |
|---|---:|
| Seguridad, autorización, pagos, cuotas y multi-tenant | 100% de ramas críticas |
| Servicios y lógica de negocio | 90–95% |
| Hooks y contextos | 90% |
| Componentes interactivos | 85–90% |
| Componentes puramente visuales | 70–85% o exclusión justificada |
| Recorridos comerciales críticos | E2E obligatorio |

## Definición de “aplicación refactorizada y cubierta”

El trabajo podrá considerarse completo cuando:

- [ ] todos los runners funcionen de forma independiente y reproducible;
- [ ] la suite completa esté verde;
- [ ] TypeScript y build estén verdes;
- [ ] la cobertura incluya todo el código productivo acordado;
- [ ] los módulos críticos cumplan sus metas por riesgo;
- [ ] existan E2E para acceso, estudiantes, pagos, configuración, agenda, certificados y soporte;
- [ ] todas las rutas de escritura estén autorizadas por tenant;
- [ ] no existan secretos en código o bundles;
- [ ] las vistas grandes hayan sido divididas en unidades mantenibles;
- [ ] OpenSpec no tenga cambios críticos pendientes.

## Evidencia adicional de estabilización — formularios

- `FormularioUsuario` + `FormularioSede`: **37/37** pruebas verdes con `--detectOpenHandles`.
  - RED: selector de sede sin nombre accesible y contrato obsoleto que esperaba cierre por backdrop.
  - GREEN: asociación `label`/`select`, botón de cierre con nombre accesible y prueba alineada con cierre exclusivamente explícito.
  - REFACTOR: fixture de sede principal alineado con el identificador canónico `principal`.
- `FormularioEvento` + `FormularioImplemento` + `FormularioMovimiento`: **29/29** pruebas verdes con `--detectOpenHandles`.
  - RED: pruebas de movimientos usaban miembros inexistentes del enum y producían categorías `undefined`.
  - GREEN/REFACTOR: contratos actualizados a `CategoriaFinanciera.Servicios` e `Inscripcion`.

## Siguiente bloque recomendado

Antes de continuar agregando pruebas aisladas, ejecutar el bloque **“Prioridad 0 — estabilizar la plataforma de pruebas”**. Esto convierte Jest, TypeScript y cobertura en señales confiables y evita invertir tiempo basándose en métricas incompletas.
