# Spec: Navegación de carpetas Drive y Breadcrumbs en Biblioteca

## Requirements

### Requirement: Navegación jerárquica de carpetas con migas de pan
`BibliotecaView` MUST ofrecer una barra de migas de pan (breadcrumb) cuando el usuario navegue en subcarpetas de Google Drive.

#### Scenario: Abrir una subcarpeta actualiza la ruta y muestra migas de pan
- GIVEN un usuario con Google Drive conectado en una carpeta activa "Carpeta Raíz"
- WHEN hace click en el botón de abrir (`DIR`) de una subcarpeta "Seminarios"
- THEN se lista el contenido de "Seminarios" en "Recursos detectados"
- AND la ruta de navegación muestra "Carpeta Raíz" y "Seminarios"
- AND "Carpeta Raíz" es clickeable para retroceder

#### Scenario: Retroceder en las migas de pan restaura los archivos del nivel anterior
- GIVEN un usuario en la subcarpeta "Seminarios" dentro de "Carpeta Raíz"
- WHEN hace click en "Carpeta Raíz" en la barra de migas de pan
- THEN se listan nuevamente los archivos de "Carpeta Raíz"
- AND la ruta de navegación se acorta dejando activa "Carpeta Raíz"

#### Scenario: Los recursos aprobados se preservan al navegar
- GIVEN un recurso que fue clasificado y aprobado desde "Carpeta Raíz"
- WHEN el usuario navega a la subcarpeta "Seminarios"
- THEN los recursos asignados en la biblioteca de materiales siguen existiendo y permanecen disponibles
