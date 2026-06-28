# Hoja de ruta de calidad, TDD y refactorización

Esta hoja de ruta resume qué falta para llevar Tudojang a una base mantenible, segura y verificable. El detalle operativo y el inventario vigente están en [tdd-state.md](../../.agent/tdd-tracker/tdd-state.md).

## Orden de ejecución

1. Estabilizar runners, TypeScript y cobertura.
2. Cerrar seguridad del asistente y Storage multi-tenant.
3. Cubrir servicios de negocio.
4. Refactorizar formularios y componentes interactivos.
5. Dividir vistas grandes y agregar pruebas de integración.
6. Completar E2E y establecer puertas de CI.

## Estado

| Área | Evaluación |
|---|---|
| Base de pruebas | Amplia, pero los runners están mezclados |
| Cobertura | Alta sobre una muestra incompleta |
| Servicios críticos | Parcialmente cubiertos |
| Componentes | Cobertura desigual |
| Vistas | Principal deuda pendiente |
| E2E | Existen flujos, falta cobertura transversal |
| Seguridad multi-tenant | En progreso |
| Refactor arquitectónico | Pendiente en vistas grandes |

## Criterio de priorización

Cada unidad se prioriza según:

1. riesgo financiero o de seguridad;
2. impacto multi-tenant;
3. frecuencia de uso;
4. historial de errores;
5. dificultad de cambio sin pruebas.

## Próxima entrega recomendada

La primera unidad de estabilización ya separó Jest, Functions y pruebas Node mediante TDD. La siguiente unidad debe:

- corregir los fallos reales de Jest;
- reducir el tiempo y corregir los tipos de `tsc --noEmit`;
- mantener los comandos de Emulator independientes;
- ampliar la cobertura a las fuentes acordadas;
- hacer que CI reporte cada capa por separado.

También se estabilizó el mock compartido de Framer Motion:

- `Dashboard.test.tsx`: 4/4.
- `ModalRegistrarPago.test.tsx`: 8/8.
- `ModalVerFirma.test.tsx`: 13/13.

Las tres suites pasan juntas 25/25 sin handles abiertos. El siguiente grupo identificado son dos pruebas lentas de `FormularioEstudiante.test.tsx`.

`FormularioEstudiante` también fue estabilizado:

- validación mínima del esquema comprobada de forma pura;
- sincronización de `isValid` después del cálculo automático del grupo;
- suite completa 18/18 sin handles abiertos.

`VistaEstudiantes` quedó estable en 15/15. La prueba de filtros ahora usa eventos directos en controles nativos y espera la consulta inicial de misión, evitando timeouts y cierres forzados.

### Comandos vigentes

| Capa | Comando |
|---|---|
| Aplicación React/TypeScript | `npm run test:app` |
| Cloud Functions | `npm run test:functions` |
| Scripts Node | `npm run test:node` |
| Contrato de infraestructura | `npm run test:infra` |
| Secuencia local combinada | `npm run test:all` |
