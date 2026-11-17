# Tareas: Agregar Video Directo a Biblioteca y Asignación de Material

## Tareas

- [x] 1. TDD en `servicios/academico/bibliotecaService.ts` <!-- id: 1-service-test -->
  - [x] 1.1 Escribir pruebas unitarias en `bibliotecaService.test.ts` para `crearRecursoVideoDirecto`.
  - [x] 1.2 Implementar `crearRecursoVideoDirecto` en `bibliotecaService.ts`.
  - [x] 1.3 Verificar que todas las pruebas pasen.

- [x] 2. Componente `ModalClasificarVideo.tsx` <!-- id: 2-modal-component -->
  - [x] 2.1 Crear `components/academico/ModalClasificarVideo.tsx` con soporte de accesibilidad, validación de URL y tags sugeridos.
  - [x] 2.2 Crear `components/academico/ModalClasificarVideo.test.tsx` con pruebas de renderizado, validación y guardado.

- [x] 3. Integración en `BibliotecaView.tsx` <!-- id: 3-biblioteca-view -->
  - [x] 3.1 Agregar el botón con ícono de video y tooltip "Agregar video" junto a Carpeta Activa / Recursos detectados.
  - [x] 3.2 Conectar apertura y guardado con `crearRecursoVideoDirecto`.
  - [x] 3.3 Asegurar que los recursos de video directos aprobados se listen en la tabla incluso sin Drive.
  - [x] 3.4 Actualizar pruebas de `BibliotecaView.test.tsx`.

- [x] 4. Integración en `AsignarMaterialWizard.tsx` <!-- id: 4-wizard -->
  - [x] 4.1 Agregar el botón con ícono y nota "Agregar video" en el Paso 1 (Material).
  - [x] 4.2 Conectar `onCrearVideoDirecto` (opcional en props) para abrir el modal y auto-seleccionar el material recién creado.
  - [x] 4.3 Actualizar pruebas en `AsignarMaterialWizard.test.tsx`.

- [x] 5. Verificación de Integración y Build <!-- id: 5-verify -->
  - [x] 5.1 Ejecutar suite de pruebas completa relevante.
  - [x] 5.2 Realizar typecheck (`npm run typecheck`).
  - [x] 5.3 Commit con conventional commit.
