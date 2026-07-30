# Delta for Catálogo de Soporte

## MODIFIED Requirements

### Requirement: Catálogo canónico y guía

El sistema MUST inventariar funciones, rutas, acciones y permisos en un catálogo versionado, ensamblado en tiempo de generación a partir de DOS fuentes: un núcleo manual (`catalogo.v1.ts`) y marcadores co-locados (`soporteMeta`) descubiertos por escaneo del árbol de fuentes. Cada entrada SHALL declarar intención, módulo, roles, aliases, pasos, ruta, sensibilidad y escalamiento, sin importar de qué fuente provenga. Toda función nueva o modificada MUST seguir una guía obligatoria de alta, revisión y pruebas, extensible a Estudiante y Tutor. El artefacto publicado (`catalogo.v1.json` y su `.sha256`) MUST mantener el mismo esquema que tenía como fuente única manual.
(Previously: fuente única manual `catalogo.v1.ts`, sin escaneo de marcadores co-locados.)

#### Scenario: Función catalogada

- GIVEN una función y rol inventariados, por entrada manual o por marcador
- WHEN el usuario consulta un alias permitido
- THEN recibe pasos y ruta canónicos

#### Scenario: Alta incompleta

- GIVEN una función sin campo, revisión o escenario obligatorio
- WHEN se valida mediante la guía
- THEN la validación falla indicando cada ausencia

#### Scenario: Fuente dual sin cambio de forma

- GIVEN un catálogo ensamblado a partir del núcleo manual y de marcadores co-locados
- WHEN se emite `catalogo.v1.json`
- THEN su esquema (`CatalogoSoporte`) MUST ser idéntico al que tenía cuando la fuente era solo el núcleo manual

## ADDED Requirements

### Requirement: Equivalencia funcional de la migración de prueba de concepto

Las vistas migradas a marcador co-locado en esta entrega (`BuzonNotificaciones.tsx`, `AgendaView.tsx`) MUST seguir resolviendo, tras la fusión, exactamente las mismas preguntas de usuario (mismos aliases, roles, pasos y rutas) que resolvían como entrada manual antes de la migración. La vista nueva `JornadasView.tsx` (ruta `/jornadas`) SHALL sumar cobertura donde antes no existía ninguna.

#### Scenario: `BuzonNotificaciones` sin regresión

- GIVEN las preguntas de usuario que el catálogo resolvía para `BuzonNotificaciones.tsx` como entrada manual
- WHEN su entrada se migra a `soporteMeta` co-locado y se regenera el catálogo
- THEN las mismas preguntas MUST resolverse con el mismo `intentId`, `route` y `roles` que antes

#### Scenario: `AgendaView` sin regresión (caso complejo)

- GIVEN las 3 entradas manuales de `AgendaView.tsx` (dos rutas, sensibilidad `privileged`, siete roles)
- WHEN se migran a `soporteMeta` co-locado y se regenera el catálogo
- THEN las 3 entradas MUST seguir presentes en el catálogo fusionado con los mismos campos, y `matcher.ts`/`contexto.ts` MUST resolverlas con la misma confianza que antes de la migración

#### Scenario: `/jornadas` gana cobertura nueva

- GIVEN que antes de esta entrega ninguna entrada del catálogo cubría `vistas/admin/JornadasView.tsx` ni la ruta `/jornadas`
- WHEN se agrega su `soporteMeta` y se regenera el catálogo
- THEN una consulta de usuario sobre jornadas MUST resolver a esa entrada en lugar de caer a fallback o escalamiento
