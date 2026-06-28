# Especificación de Escalamiento de Soporte

## Purpose

Escalar mediante ticket interno o WhatsApp.

## Requirements

### Requirement: Escalamiento mínimo y consentido

El sistema MUST ofrecer ambos canales según política. Identidad y tenant SHALL derivarse de autenticación; solo se usarán datos mínimos, redactados, consentidos y con retención definida.

#### Scenario: Ticket interno
- GIVEN un usuario autenticado que acepta escalar
- WHEN crea un ticket
- THEN contiene identidad, tenant, resumen, fuente y estado verificados

#### Scenario: WhatsApp cancelado
- GIVEN WhatsApp indisponible, datos sensibles o falta de consentimiento
- WHEN se solicita ese canal
- THEN MUST NOT transmitir datos y mantiene el ticket interno

### Requirement: Autorización de soporte

Solo un Master verificado MUST consultar entre tenants o cambiar estados. Usuarios ordinarios SHALL acceder únicamente a tickets autorizados. El sistema MUST auditar canal, actor, transición, tiempos y fallos sin conversaciones completas.

#### Scenario: Actualización privilegiada
- GIVEN un Master verificado
- WHEN cambia un estado
- THEN registra actor, transición y fecha

#### Scenario: Acceso cruzado
- GIVEN un usuario ajeno al tenant
- WHEN intenta leer o modificar un ticket
- THEN se rechaza y audita sin exponerlo
