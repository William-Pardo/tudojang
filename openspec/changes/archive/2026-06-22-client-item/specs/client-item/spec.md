## ADDED Requirements

### Requirement: Renderizado accesible del cliente

El sistema DEBE renderizar cada cliente como un elemento de lista accesible con su identidad y estado.

#### Scenario: Cliente con datos completos

- **WHEN** se proporciona nombre, correo y fotografía
- **THEN** el componente muestra esos valores y usa el nombre como texto alternativo de la imagen

#### Scenario: Cliente con datos incompletos

- **WHEN** el cliente es nulo, indefinido o tiene campos vacíos
- **THEN** el componente muestra fallbacks legibles y no lanza errores

### Requirement: Estado visual del cliente

El sistema DEBE distinguir clientes activos e inactivos mediante una etiqueta visible.

#### Scenario: Cliente activo

- **WHEN** `activo` es verdadero
- **THEN** se muestra la etiqueta “Activo” con estilo verde

#### Scenario: Cliente inactivo

- **WHEN** `activo` es falso o no está definido
- **THEN** se muestra la etiqueta “Inactivo” con estilo gris

### Requirement: Acción de detalle

El sistema DEBE permitir solicitar el detalle del cliente mediante un botón accesible.

#### Scenario: Ver detalle

- **WHEN** el usuario pulsa “Ver detalle”
- **THEN** se invoca `onVerDetalle` con el identificador del cliente
