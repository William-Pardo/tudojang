# Especificación de Fallback IA Controlado

## Purpose

Permitir IA trazable solo ante baja confianza local.

## Requirements

### Requirement: IA exclusivamente backend

El sistema MUST invocar IA solo desde backend autenticado y verificado, sin exponer secretos. SHALL enviar fragmentos autorizados mínimos y devolver respuesta tipada con fuente, confianza, escalamiento y cuota restante.

#### Scenario: Fallback autorizado
- GIVEN baja confianza, sesión, cuota y presupuesto válidos
- WHEN se solicita fallback
- THEN devuelve una respuesta basada en fuentes y marcada como IA

#### Scenario: Solicitud manipulada
- GIVEN identidad inválida o instrucciones para eludir fuentes o permisos
- WHEN se solicita fallback
- THEN se rechaza sin consumir cuota ni revelar información

### Requirement: Cuotas y presupuesto

El sistema MUST aplicar límites atómicos por usuario, tenant y periodo, más techo global. El presupuesto SHALL derivarse de fallback medido, tokens máximos y precio; las cuotas MUST esperar medición aprobada. SHALL registrar fuente, latencia, tokens, costo, límites y escalamiento con redacción y retención.

#### Scenario: Concurrencia en el límite
- GIVEN solicitudes simultáneas próximas a un límite
- WHEN se reserva consumo
- THEN nunca se supera ninguna cuota

#### Scenario: Presupuesto agotado
- GIVEN el techo global agotado
- WHEN se solicita fallback
- THEN evita al proveedor y ofrece aclaración o escalamiento

#### Scenario: Métrica privada
- GIVEN una llamada completada o evitada
- WHEN se registra su resultado
- THEN permite calcular costo sin secretos, PII ni conversación completa
