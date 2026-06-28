## ADDED Requirements

### Requirement: Roles Estudiante y Tutor se activan por invitación de correo
El sistema SHALL soportar los roles `Estudiante` y `Tutor` con activación exclusiva mediante invitación de correo electrónico generada por Firebase Auth custom action links. Un usuario SHALL poder activar su cuenta solo si posee un enlace de invitación válido y no vencido. El registro espontáneo (sign-up abierto) NO SHALL estar disponible para estos roles.

#### Scenario: Invitación enviada por el admin
- **WHEN** el admin del tenant crea una invitación para un correo con rol `Estudiante` o `Tutor`
- **THEN** el sistema SHALL generar un Firebase Auth action link con expiración configurable (default 7 días), enviarlo al correo del invitado y registrar la invitación en estado `pendiente`

#### Scenario: Activación de cuenta por invitación válida
- **WHEN** el invitado hace clic en el link antes de su expiración y completa el registro
- **THEN** el sistema SHALL crear la cuenta en Firebase Auth con el custom claim del rol correspondiente (`role: 'estudiante'` o `role: 'tutor'`), marcar la invitación como `aceptada` y vincular la cuenta al `tenantId` del tenant que invitó

#### Scenario: Intento de activación con invitación vencida
- **WHEN** el invitado intenta activar una cuenta con un link expirado
- **THEN** el sistema SHALL informar que la invitación venció y ofrecer al admin la opción de reenviar una nueva invitación

### Requirement: Aislamiento de datos por tenantId para roles académicos
El sistema SHALL garantizar que un estudiante o tutor solo pueda acceder a datos del tenant que lo invitó. Toda consulta SHALL ser validada por Firestore Security Rules verificando que `request.auth.token.tenantId == resource.data.tenantId`.

#### Scenario: Estudiante no puede ver datos de otro tenant
- **WHEN** un estudiante autenticado intenta leer documentos de un tenant distinto al suyo
- **THEN** Firestore Security Rules SHALL rechazar la operación con `PERMISSION_DENIED`

### Requirement: Vinculación tutor-estudiante es N:M dentro del mismo tenant
El sistema SHALL permitir que un tutor supervise múltiples estudiantes y que un estudiante tenga múltiples tutores, siempre dentro del mismo tenant. La vinculación SHALL ser creada por el admin del tenant.

#### Scenario: Admin vincula tutor con múltiples estudiantes
- **WHEN** el admin crea vínculos entre un tutor y varios estudiantes del mismo tenant
- **THEN** el sistema SHALL registrar cada vínculo en una colección de relaciones y el tutor SHALL ver en su panel el progreso de todos los estudiantes vinculados

#### Scenario: Tutor sin estudiantes vinculados
- **WHEN** un tutor accede a su panel sin ningún estudiante vinculado
- **THEN** el sistema SHALL mostrar un estado vacío con instrucción para que contacte al admin del tenant
