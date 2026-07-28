# Clase en Vivo: Debug + Plan de Solución Radical

## Problema
William Roa intenta check-in a clase Precadetes/Cocodrilos y recibe "Error al procesar el registro". La validación de pertenencia está fallando silenciosamente sin detalles.

## Paso 1: Debuggea POR QUÉ falla (5 min)

1. **Abre la clase en Clase en Vivo** (desde el QR scanner)
2. **Abre la consola del navegador** (F12 → Console)
3. **Ejecuta el debug:**
```javascript
const resultado = await window.debugClaseEnVivo.validarAsistencia(
  'ID_DEL_TENANT',
  'ID_DE_LA_JORNADA',
  'ID_DE_WILLIAM_ROA'
);
console.log(JSON.stringify(resultado, null, 2));
```

Reemplaza:
- `ID_DEL_TENANT`: el tenantId de tu club
- `ID_DE_LA_JORNADA`: el jornadaId de la clase test
- `ID_DE_WILLIAM_ROA`: el estudianteId de William

### Qué esperar

El debug retorna un objeto con esta estructura:

```javascript
{
  "estudiante": {
    "tenantId": "...",
    "grupo": "Precadetes",
    "sedeId": "...",
    "grado": "...",
    "estadoPago": "Al día"  // o "Vencido" / "Pendiente"
  },
  "ejecucion": {
    "grupoId": "precadetes",
    "sedeId": "...",
    "id": "..."
  },
  "validaciones": {
    "tenantMatch": true,
    "pagoAlDia": true,
    "noEnGradosExcluidos": true,
    "grupoMatch": true,  // grupoASlug(estudiante.grupo) === ejecucion.grupoId
    "grupoMatch_detail": {
      "grupoEstudiante": "Precadetes",
      "grupoEstudianteSlug": "precadetes",
      "grupoEjecucion": "precadetes"
    },
    "sedeMatch": true,
    "inscripcionExplicita": false  // No hay inscripción manual en `inscripciones/{estudianteId}`
  },
  "pertenece": true  // Resultado final
}
```

### Análisis

**Si `pertenece: true`** → El código dice que William SÍ debería poder entrar. El error viene de otra parte (probablemente un bug en el callable o un fallo de red).

**Si `pertenece: false`** → Al menos una validación falló. Busca cuál:
- `tenantMatch: false` → William está en otro tenant
- `pagoAlDia: false` → Pago vencido (esto NO se valida hoy en el SDD, solo en code que heredó)
- `noEnGradosExcluidos: false` → La jornada excluye explícitamente el grado de William
- `grupoMatch: false` → El grupo de William NO coincide con el de la clase (mismatch de strings)
- `sedeMatch: false` → La sede de William NO coincide con la sede de la clase

---

## Paso 2: Solución Radical — Implementar Fase 0 (Roster Explícito)

**El problema no es técnico.** Es arquitectónico.

Hoy el código valida automáticamente: **"¿El estudiante está en el mismo grupo+sede que la clase?"**

Eso falla porque:
1. **No hay control** sobre quién se incluye automáticamente
2. **Múltiples condiciones silenciosas** que pueden fallar (pago vencido, grado excluido, etc.)
3. **Sin forma de hacer override**: no puedes decir "sí, matricula a este estudiante aunque falle alguna condición"

**La solución de Bloque A del SDD:**
- Crear un **roster explícito** de inscripciones: `ejecucionesPrograma/{ejecucionId}/inscripciones/{estudianteId}`
- **Manual + simple**: admin entra a AsignacionesView, busca la clase, ve una lista sugerida de estudiantes (por grupo+sede), elige manualmente, guarda
- **Validación determinística**: existe en el roster o no existe — sin lógica fuzzy

**Por qué esto es "radical":**
- Desacopla la pertenencia del estado de pago / pago (conflicto de responsabilidades)
- Desacopla la pertenencia de cambios accidentales en grupo/sede del estudiante
- Permite matricular a un estudiante aunque sea de otro grupo/sede (ej. clase de prueba, invitado)
- Una vez implementado, el check-in es `exists(...inscripciones/{estudianteId})` → o entra o no entra, sin sorpresas

---

## Implementación Fase 0 — Timeline

**Bloques de código a agregar:**

1. `models/academico/inscripcion.ts` — Modelo del documento
2. `servicios/academico/inscripcionRepository.ts` — CRUD con patrón singleton
3. `servicios/academico/inscripcionService.ts` — Lógica pura (sugerencia por atributo, validación)
4. `components/academico/MatricularEstudiantesModal.tsx` — UI modal: lista sugerida + selección manual
5. `vistas/admin/AsignacionesView.tsx` — Modificar para agregar botón "Matricular estudiantes"
6. `firestore.rules` — Regla para `inscripciones` (allow write: if isInstructor())
7. Tests — `inscripcionRepository.test.ts`, `MatricularEstudiantesModal.test.tsx`, `firestore-rules.behavior.test.js`

**Modificaciones:**

1. `functions/academico/asistencia.js` — Cambiar validación de:
   ```javascript
   // Hoy: validación automática + opcional roster explícito
   return grupoASlug(estudiante.grupo) === ejecucion.grupoId && estudiante.sedeId === ejecucion.sedeId;
   
   // Después: SOLO roster explícito (si existe, entra; si no, no entra)
   return inscripcionSnap.exists && inscripcionSnap.data().estado === 'activa';
   ```

2. `asistencia.test.js` — Casos nuevos:
   - Estudiante matriculado explícitamente (estado='activa') → entra
   - Estudiante NO matriculado → rechazado (aunque grupo+sede coincidan)
   - Estudiante retirado (estado='retirada') → rechazado (aunque haya registro)

---

## Próximos pasos (después de debug)

**Option A: Quick Fix (hoy)**
- Ajusta el pago de William a "Al día" si es que está vencido
- O agrega manualmente un registro en `inscripciones/{williamId}` con estado='activa' en Firestore Console

**Option B: Real Solution (Fase 0, 1-2 días)**
- Implementa el roster explícito
- Crea la UI de matrícula en AsignacionesView
- Matricula manualmente a William (y otros estudiantes de esa clase)
- Prueba end-to-end

**Recomendación: B**. Es mucho más trabajo hoy, pero elimina el problema de raíz para siempre.

---

## Comandos para testing

Una vez implementado Fase 0, prueba con:

```bash
npm run test -- functions/academico/asistencia.test.js  # Valida pertenencia
npm run test -- servicios/academico/inscripcionService.test.ts
npm run build  # Compila sin errores
```

---

## Referencias

- `openspec/changes/clase-en-vivo-checkin-trigger-agenda/design.md` — Decisión 4 (Roster explícito)
- `functions/academico/asistencia.js` — Líneas 86-111 (pertenceAEjecucion)
- `Módulo Clase en Vivo.txt` — Sección 6 (requisitos de validación)
