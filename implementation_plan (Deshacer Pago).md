# Refactorización del Sistema de Pagos y Función "Deshacer Pago"

La meta de este plan es reducir drásticamente la deuda técnica del módulo de finanzas/pagos de la academia. Actualmente, un pago modifica múltiples documentos dispersos sin dejar un registro transaccional trazable. Vamos a implementar el patrón de **Registro de Transacción (Transaction Log)** para que cada pago tenga un historial exacto de qué afectó, permitiendo que la anulación sea quirúrgica, segura y 100% testeable.

## ⚠️ User Review Required

- **Estructura de la Transacción:** Proponemos guardar las transacciones en una nueva colección raíz de Firestore llamada `transaccionesPago`. Esto permite escalar a reportes globales por academia en el futuro.
- **Lógica de Anulación:** Al anular un pago, en lugar de borrar el ingreso de Finanzas, propondremos crear un "Movimiento Negativo" (Devolución) para mantener intacta la auditoría contable. ¿Estás de acuerdo con mantener el rastro contable en vez de hacer "hard delete"?

## Open Questions

1. ¿Te gustaría que el botón "Deshacer Pago" en la interfaz solo permita anular el **último pago registrado** del alumno, o preferís un historial completo donde puedas elegir qué pago anular? (Por pragmatismo, recomiendo empezar permitiendo anular solo el último).

## Proposed Changes

---

### Capa de Datos y Servicios (Backend Firebase)

#### [MODIFY] [servicios/pagosApi.ts](file:///e:/Apps/Tudojang/servicios/pagosApi.ts)
- Actualizaremos la interfaz y la función `procesarPagoEfectivo`. Dentro del `batch.commit()`, insertaremos un nuevo documento en la colección `transaccionesPago` que guarde:
  - `reciboId`
  - `estudianteId`
  - `tenantId`
  - `montoTotal`
  - `itemsPagados` (Lista exacta de IDs de tienda/eventos pagados en este recibo).
  - `fecha` y `estado` ('Completado' | 'Anulado').
- **[NEW FUNCTION]** `anularTransaccionPago(transaccionId: string, estudianteId: string)`:
  - Buscará la transacción.
  - Revertirá el `saldoDeudor` sumándole el monto de la transacción.
  - Buscará los `itemsPagados` en las colecciones `solicitudesCompra` e `solicitudesInscripcion` y los volverá a poner como `pagado: false`.
  - Marcará la transacción como 'Anulado'.
  - Creará un egreso/devolución en `finanzas`.

---

### Capa de Interfaz (Frontend React)

#### [MODIFY] [components/FilaEstudiante.tsx](file:///e:/Apps/Tudojang/components/FilaEstudiante.tsx)
- Agregaremos un botón de "Deshacer Último Pago" junto al icono de registrar pago.
- Al hacer clic, se disparará una doble confirmación usando el componente `ModalConfirmacion`.

#### [MODIFY] [components/ModalRegistrarPago.tsx](file:///e:/Apps/Tudojang/components/ModalRegistrarPago.tsx)
- Actualizaremos las llamadas si cambia la firma de la interfaz de la API.

---

### Capa de Testing (>95% Cobertura)

Reducir la deuda técnica exige que el código crítico financiero esté blindado con tests automatizados. Implementaremos la pirámide de testing:

#### [NEW] [servicios/pagosApi.test.ts](file:///e:/Apps/Tudojang/servicios/pagosApi.test.ts)
- **Tests Unitarios:** Verificaremos que el cálculo de deudas y saldos remanentes sea exacto, usando mocks puros.
- **Tests de Integración (Firestore Mocks):**
  - Simularemos la escritura del `batch.commit()` para asegurar que se crea la transacción, se bajan las deudas y se crea el recibo en finanzas todo al mismo tiempo (Atomicidad).
  - Test de anulación: Verificaremos que al llamar a `anularTransaccionPago`, todas las entidades previas vuelven a su estado original (saldo, booleanos de pago).
- **Tests de Excepciones (Unhappy Paths):**
  - Forzaremos errores de base de datos (e.g., simular caída de internet o permisos denegados) para garantizar que el `try/catch` responda adecuadamente sin corromper el estado parcial.

#### [NEW] [cypress/e2e/deshacerPago.cy.ts](file:///e:/Apps/Tudojang/cypress/e2e/deshacerPago.cy.ts)
- **Test E2E:** Simularemos el flujo de un usuario en el navegador:
  1. Registra un pago.
  2. Aprieta el botón de deshacer.
  3. Valida que salte la doble confirmación.
  4. Aprueba la anulación y valida que la interfaz muestre la deuda restaurada.

## Verification Plan

### Automated Tests
- Ejecutar `npm run test -- --coverage` para validar que `pagosApi.ts` supera el 95% de cobertura global (líneas, ramas y funciones).
- Ejecutar `npx cypress run --spec cypress/e2e/deshacerPago.cy.ts` para asegurar que el botón funciona visualmente.

### Manual Verification
1. Acceder a la app localmente.
2. Registrar un pago para un estudiante ficticio (viendo que la deuda quede en $0).
3. Presionar "Deshacer Pago" en el perfil del estudiante, confirmar el modal de precaución.
4. Validar que la deuda regrese al monto original y que el ícono de pago vuelva a estar en rojo/pendiente.
