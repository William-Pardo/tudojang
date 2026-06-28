# Especificación de Catálogo de Soporte

## Purpose

Definir conocimiento local completo y extensible por rol.

## Requirements

### Requirement: Catálogo canónico y guía

El sistema MUST inventariar funciones, rutas, acciones y permisos en un catálogo versionado. Cada entrada SHALL declarar intención, módulo, roles, aliases, pasos, ruta, sensibilidad y escalamiento. Toda función nueva o modificada MUST seguir una guía obligatoria de alta, revisión y pruebas, extensible a Estudiante y Tutor.

#### Scenario: Función catalogada
- GIVEN una función y rol inventariados
- WHEN el usuario consulta un alias permitido
- THEN recibe pasos y ruta canónicos

#### Scenario: Alta incompleta
- GIVEN una función sin campo, revisión o escenario obligatorio
- WHEN se valida mediante la guía
- THEN la validación falla indicando cada ausencia

### Requirement: Búsqueda determinista y contextual

El sistema MUST priorizar la pregunta actual, usar contexto solo para desambiguar, reportar confianza y aclarar resultados bajo el umbral.

#### Scenario: Resultado repetible
- GIVEN catálogo, rol, pregunta y contexto idénticos
- WHEN se repite la búsqueda
- THEN devuelve intención, fuente y confianza idénticas

#### Scenario: Conflicto o restricción
- GIVEN contexto contradictorio o una entrada no autorizada
- WHEN la confianza queda bajo el umbral
- THEN solicita aclaración y MUST NOT revelar contenido restringido
