---
description: Protocolo de Autonomía Total (Antigravity)
---

# Protocolo de Autonomía Total

Este flujo de trabajo define las acciones automáticas de Antigravity para maximizar la eficiencia y seguridad del desarrollo en Tudojang.

## 1. Análisis de Impacto de Tokens
- **Cuándo:** Antes de editar archivos grandes (>20KB o >500 líneas).
- **Acción:** Calcular el % estimado de la ventana de contexto.
- **Umbral:** Si >30%, sugerir "limpiar chat".

## 2. Auto-Checkpointing
- **Cuándo:** Al finalizar un hito (ej. Integración Wompi Sandbox, Validación de Dominio, etc.).
- **Acción:** Incluir un bloque `<details>` con el JSON de migración técnica.

## 3. Vigilancia de Cuota (Resiliencia)
- **Cuándo:** Error 429 o límite de cuota.
- **Acción:** Generar `LAST_CONTEXT.md` con:
  - Resumen de tareas pendientes.
  - Estado de las variables críticas.
  - Siguiente paso inmediato.

## 4. Filtro de Archivos @
- **Cuándo:** En solicitudes generales.
- **Acción:** Listar explícitamente los archivos que se leerán o modificarán antes de proceder.
