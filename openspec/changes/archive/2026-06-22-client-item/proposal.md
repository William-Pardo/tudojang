## Why

`components/ClientItem.tsx` es actualmente un archivo placeholder sin componente exportado. Esto impide reutilizar una representación consistente y accesible de clientes en las vistas de administración SaaS y hace imposible validar el comportamiento mediante cobertura real.

## What Changes

- Implementar `ClientItem` como componente React tipado.
- Mostrar avatar, nombre, correo y estado activo/inactivo con valores seguros cuando falten datos.
- Exponer una acción accesible “Ver detalle” que entregue el identificador del cliente.
- Añadir pruebas unitarias para datos completos, datos incompletos, estados y callback.
- Alcanzar 100% de cobertura en statements, branches, functions y lines.

## Capabilities

### New Capabilities

- `client-item`: Representación accesible y tolerante a datos incompletos de un cliente SaaS.

### Modified Capabilities

<!-- Ninguna -->

## Impact

- **Componente**: `components/ClientItem.tsx`.
- **Tests**: `components/ClientItem.test.tsx`.
- **Dependencias**: React Testing Library y user-event existentes.
- **Coverage actual**: 0% porque el archivo no contiene código ejecutable.
- **Coverage objetivo**: 100% en todas las métricas.
