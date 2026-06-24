# Añadir una función al catálogo de soporte

El catálogo `shared/soporte/catalogo.v1.ts` es la única fuente de respuestas locales. Una función no está lista hasta que tiene metadatos, prueba, revisión del dueño y copias generadas sin drift.

## Ruta rápida

1. Confirma la pantalla, ruta, roles y guardas reales en el código.
2. Añade una entrada con ID estable y todos los campos obligatorios.
3. Agrega el ID al golden test y cubre alias, restricción de rol y ambigüedad.
4. Ejecuta `node scripts/generar-catalogo.mjs`.
5. Verifica con `node scripts/generar-catalogo.mjs --check` y las pruebas focalizadas.

## Campos obligatorios

| Campo | Qué debe registrar |
|---|---|
| `id` / `inventoryId` | Identificador estable que enlaza el inventario auditado. |
| `module`, `label`, `intent` | Ubicación y propósito comprensible. |
| `aliases`, `actions`, `negativeTerms` | Frases positivas, verbos y conflictos que desambiguan. |
| `roles` | Audiencias activas; no equivale por sí solo a autorización backend. |
| `steps`, `route` | Procedimiento y ruta canónica verificadas. |
| `sensitivity`, `escalationReason` | Riesgo de datos/privilegios y momento de escalar. |
| `sourceFiles`, `authorizationRef` | Evidencia en código y estado real de la guarda. |
| `owner`, `introducedIn`, `lastVerifiedAt` | Responsable, versión y fecha de revisión. |

## Checklist de alta y revisión

- [ ] El ID aparece una sola vez y corresponde a una fila del inventario.
- [ ] La ruta existe en `RUTAS_SOPORTE_CONOCIDAS`.
- [ ] Los aliases incluyen lenguaje real del usuario y no solo nombres técnicos.
- [ ] Los términos negativos separan intenciones cercanas.
- [ ] Los pasos no prometen permisos que el backend o las reglas no verifican.
- [ ] La respuesta sensible evita exponer datos de otro usuario o tenant.
- [ ] Hay al menos un caso permitido y uno restringido o ambiguo.
- [ ] Producto/Soporte revisó contenido y el dueño actualizó `lastVerifiedAt`.
- [ ] El generador y `--check` terminan sin drift.

## Activar Tutor o Estudiante

`Tutor` está activo y solo debe añadirse a una entrada cuando la pantalla y su autorización hayan sido verificadas. `Estudiante` permanece `reserved`: no se añade a entradas ni puede resolver consultas.

Para activar `Estudiante`:

1. Implementa primero autenticación, navegación y autorización verificable.
2. Cambia su estado a `active` en `ROLES_SOPORTE`.
3. Añade únicamente entradas comprobadas para ese rol.
4. Crea pruebas de acceso permitido, contenido restringido y aislamiento de tenant.
5. Regenera los activos y solicita revisión del dueño del catálogo.

Los flujos actuales de estudiantes por enlace siguen usando el rol `Publico`; no deben migrarse por similitud de nombre.

## Verificación

```powershell
npm test -- --runInBand shared/soporte/catalogo.v1.test.ts scripts/validar-catalogo.test.ts
npm test -- --runInBand servicios/soporte/contexto.test.ts servicios/soporte/matcher.test.ts
node scripts/generar-catalogo.mjs --check
```
