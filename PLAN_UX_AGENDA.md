# Diseño UX / Flujo de Agenda y Vinculación de Clases

## 1. Vista de Agenda Principal (Calendario)
- **Visualización:** Un calendario semanal/mensual que muestra tarjetas (cards) por cada `JornadaAcademica`.
- **Colores:**
  - `Gris/Neutro`: Clase huérfana (origen: `agenda_manual`, sin `programaId`).
  - `Azul/Verde (Color del Programa)`: Clase vinculada a una Cohorte/Programa.

## 2. Modal de Creación de Clase Manual (Huérfana)
Cuando el usuario hace clic en un espacio vacío del calendario:
- **Campos:** 
  - Fecha (pre-llenada según el clic).
  - Hora Inicio / Hora Fin.
  - Sede (selector).
  - Maestro Titular (selector).
  - Grupo Operativo (ej. Infantil).
- **Acción principal:** "Guardar Clase".
- *Nota UX:* No se exige seleccionar un Programa. Si se guarda así, queda "huérfana" lista para ser vinculada luego.

## 3. Modal de Vinculación a Programa
Al hacer clic en una clase "Gris" (huérfana):
- Aparece el detalle de la clase y un botón destacado: **"Vincular a Programa"**.
- Al hacer clic, se abre un wizard de 2 opciones:
  1. **Asignar a Cohorte Existente:** Muestra un dropdown con cohortes compatibles (misma sede y maestro).
  2. **Crear Nuevo Programa desde esta Clase:** Toma los datos base y pide solo el "Nombre del Programa", autogenerando la cohorte y el ciclo completo.

## 4. Modal de Edición y Regla Anti-Choques
- Si el usuario arrastra una clase en el calendario (Drag & Drop) para cambiarle la hora/día, se lanza la validación `editarClaseManual`.
- Si el servicio devuelve `Conflicto de agenda`, la UI devuelve la tarjeta a su posición original y muestra un Toast/Snackbar rojo: *"Error: El maestro ya tiene una clase asignada en esa sede a esa hora"*.
