## 1. Implementación del componente

- [x] 1.1 Definir las interfaces tipadas de cliente y props en `components/ClientItem.tsx`
- [x] 1.2 Implementar fallbacks para cliente, nombre, correo y fotografía ausentes
- [x] 1.3 Renderizar estados activo/inactivo y añadir semántica accesible
- [x] 1.4 Implementar la acción “Ver detalle” preservando aislamiento presentacional

## 2. Pruebas unitarias

- [x] 2.1 Reemplazar el test documental por pruebas de datos completos e incompletos
- [x] 2.2 Probar estados activo e inactivo
- [x] 2.3 Probar interacción “Ver detalle” con el ID correcto
- [x] 2.4 Probar cliente nulo e indefinido sin excepciones

## 3. Verificación

- [x] 3.1 Ejecutar `npx jest components/ClientItem.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="components/ClientItem.tsx"` y confirmar 100% en todas las métricas
