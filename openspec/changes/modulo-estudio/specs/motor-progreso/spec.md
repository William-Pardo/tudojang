## ADDED Requirements

### Requirement: Progreso se calcula con criterios granulares por tipo de recurso
El sistema SHALL calcular el progreso de cada asignación de manera diferenciada según el tipo de recurso:
- **PDF**: páginas únicas visualizadas, permanencia mínima por página y llegada al tramo final (último 10%).
- **Video**: segundos únicos reproducidos; se considera suficiente a partir del 78% del total.
- **Quiz**: respuestas registradas, número de intentos, puntuación y umbral configurable (definido en la asignación).
- **Actividad práctica**: requiere validación presencial del maestro.

Ver un archivo NO SHALL equivaler automáticamente a dominar el contenido.

#### Scenario: PDF marcado como completado
- **WHEN** el estudiante visualiza todas las páginas requeridas con la permanencia mínima y la última página mostrada pertenece al tramo final del documento
- **THEN** el motor de progreso SHALL marcar el estado de la asignación como `completado` y registrar el timestamp de finalización

#### Scenario: Video completado al 78%
- **WHEN** los segundos únicos reproducidos por el estudiante alcanzan el 78% de la duración total del video
- **THEN** el motor de progreso SHALL marcar el estado de la asignación como `completado`

#### Scenario: Video visto pero sin continuidad suficiente
- **WHEN** el estudiante hace avance rápido (seeking) cubriendo el 78% sin reproducir efectivamente esos segundos
- **THEN** el motor SHALL solo contar segundos realmente reproducidos (únicos); el salto en el scrubber no SHALL incrementar el contador

### Requirement: Progreso se sincroniza por intervalo y eventos de ciclo de vida, no por segundo
El sistema SHALL acumular datos de progreso en memoria local (localStorage/IndexedDB) y sincronizar con Firestore en los siguientes momentos: cada 30 segundos de consumo activo, al pausar, al perder visibilidad de la página y al cerrar el recurso. El sistema NO SHALL escribir en Firestore en cada segundo de reproducción o en cada evento de scroll.

#### Scenario: Sincronización periódica durante consumo activo
- **WHEN** el estudiante lleva 30 segundos consumiendo un recurso
- **THEN** el sistema SHALL ejecutar una escritura en Firestore con el progreso acumulado hasta ese momento; el total de escrituras por sesión de 10 minutos SHALL ser ≤ 20

#### Scenario: Flush al cerrar el recurso
- **WHEN** el estudiante cierra la vista del recurso o la pestaña del navegador
- **THEN** el sistema SHALL ejecutar un flush inmediato del progreso local pendiente antes de desmontar el componente o en el evento `beforeunload`

#### Scenario: Reanudación desde progreso guardado
- **WHEN** el estudiante vuelve a abrir un recurso que ya había comenzado
- **THEN** el sistema SHALL cargar el progreso guardado en Firestore y posicionar el visor en la última página o timestamp registrado

### Requirement: Progreso se conserva ante reprogramación, cambio de grupo o versión de programa
El sistema SHALL preservar el historial de progreso del estudiante aunque la jornada sea reprogramada, el estudiante cambie de grupo o la versión del programa sea actualizada. El progreso histórico SHALL ser solo de lectura y no SHALL perderse.

#### Scenario: Progreso conservado tras reprogramación de jornada
- **WHEN** una jornada asociada a asignaciones es reprogramada
- **THEN** el progreso del estudiante en esas asignaciones SHALL mantenerse; la nueva jornada hija SHALL heredar las mismas asignaciones con el progreso existente

#### Scenario: Progreso conservado tras cambio de versión del programa
- **WHEN** el admin publica una nueva versión del programa mientras hay ejecuciones activas
- **THEN** las ejecuciones activas de los grupos SHALL continuar con la versión anterior hasta que el admin migre explícitamente; el progreso ya registrado NO SHALL perderse
