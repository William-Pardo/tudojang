# Proposal: Navegación de carpetas Drive con migas de pan y preservación de biblioteca

## Contexto y Problema
En `BibliotecaView.tsx`, cuando el usuario está conectado a Google Drive:
1. Al abrir una subcarpeta con el botón `DIR`, se listan sus archivos, pero no existe navegación hacia atrás ni breadcrumb para volver a las carpetas padre o a la raíz institucional.
2. Si cambia de carpeta mediante el modal selector, un diálogo `window.confirm` bloquea el cambio innecesariamente.
3. Se requiere que el usuario pueda navegar fluidamente entre carpetas en "Recursos detectados", actualizando la lista de archivos detectados de esa carpeta específica, pero garantizando que los recursos previamente clasificados y aprobados en la biblioteca (materiales) permanezcan intactos y asignables.

## Solución Propuesta
1. Agregar estado de historial/migas de pan (`rutaCarpetasDrive: { id: string, nombre: string }[]`) en `BibliotecaView`.
2. Al seleccionar la carpeta institucional o navegar con `DIR`, registrar y actualizar la ruta.
3. Mostrar un componente visual de breadcrumbs/migas de pan sobre "Recursos detectados", permitiendo hacer click en cualquier nivel previo para volver a él instantáneamente.
4. Asegurar que al cambiar de carpeta o navegar, `setArchivosDrive` muestre exclusivamente los archivos de la carpeta actual, manteniendo en la biblioteca de materiales todos los recursos indexados y aprobados previamente.
