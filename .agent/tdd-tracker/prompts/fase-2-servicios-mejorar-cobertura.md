# Fase 2 — Servicios CON Tests (Mejorar Cobertura)

> **Instrucciones**: Cada sección (§) es un prompt independiente. Copia UNA sección completa al chat de Kilo Code.
> **Antes de empezar**: Lee `.agent/tdd-tracker/kilo-code-rules.md` como contexto.
> **Objetivo**: Llevar la cobertura de estos archivos al 100% (Stmts, Branches, Funcs, Lines).

---

## §1 — estudiantesApi.test.ts

**Archivo**: `servicios/estudiantesApi.ts`
**Test a mejorar**: `servicios/estudiantesApi.test.ts`

### Instrucciones

1. **Ejecuta** el coverage actual para identificar las brechas:
```bash
npx jest servicios/estudiantesApi.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/estudiantesApi.ts"
```
2. **Lee** el output y busca las líneas específicas (Branches y Functions) que no están cubiertas.
3. **Agrega tests** específicos para cubrir esos edge cases, errores simulados (`mockRejectedValueOnce`), o condicionales if/else.
4. **Vuelve a ejecutar** hasta alcanzar el 100%.
5. **Pega el output de coverage 100% en el chat.**

---

## §2 — eventosApi.test.ts

**Archivo**: `servicios/eventosApi.ts`
**Test a mejorar**: `servicios/eventosApi.test.ts`

### Instrucciones

1. **Ejecuta** el coverage actual:
```bash
npx jest servicios/eventosApi.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/eventosApi.ts"
```
2. Este archivo maneja creación de eventos, imágenes en Storage y subcolecciones. Verifica si faltan pruebas para:
   - Errores de red al subir imágenes.
   - Eliminación de documentos huérfanos (rollback).
   - Formateo incorrecto de fechas.
3. **Escribe los tests faltantes** y alcanza el 100% de cobertura.
4. **Pega el output final en el chat.**

---

## §3 — pagosApi.test.ts

**Archivo**: `servicios/pagosApi.ts`
**Test a mejorar**: `servicios/pagosApi.test.ts`

### Instrucciones

1. **Ejecuta** el coverage actual:
```bash
npx jest servicios/pagosApi.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/pagosApi.ts"
```
2. Pagos es crítico. Presta atención a las ramas de lógica matemática:
   - Pagos parciales.
   - Saldos a favor.
   - Fallos de transaccionalidad (`runTransaction` o actualizaciones batch).
3. **Agrega tests** usando triangulación de valores monetarios.
4. Alcanza 100% de cobertura. **Pega el output en el chat.**

---

## §4 — pagosEstudiantesApi.test.ts

**Archivo**: `servicios/pagosEstudiantesApi.ts`
**Test a mejorar**: `servicios/pagosEstudiantesApi.test.ts`

### Instrucciones

1. **Ejecuta** el coverage:
```bash
npx jest servicios/pagosEstudiantesApi.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/pagosEstudiantesApi.ts"
```
2. Cubre cualquier rama condicional (branch) pendiente o funciones de utilería exportadas.
3. **Pega el resultado 100% en el chat**.

---

## §5 — asistenciaApi.test.ts

**Archivo**: `servicios/asistenciaApi.ts`
**Test a mejorar**: `servicios/asistenciaApi.test.ts`

### Instrucciones

1. **Ejecuta** el coverage:
```bash
npx jest servicios/asistenciaApi.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/asistenciaApi.ts"
```
2. Verifica si la lógica de lectura/parseo de códigos QR en `buscarAsistenciaHoyPorIdAlumno` está 100% cubierta (JSONs inválidos, estudiantes no encontrados).
3. Asegura el 100% y **pega el output en el chat**.

---

## §6 — leadsEventosApi.test.ts

**Archivo**: `servicios/leadsEventosApi.ts`
**Test a mejorar**: `servicios/leadsEventosApi.test.ts`

### Instrucciones

1. **Ejecuta** el coverage:
```bash
npx jest servicios/leadsEventosApi.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/leadsEventosApi.ts"
```
2. Probablemente falten edge cases o manejo de errores de Firestore.
3. **Cubre el archivo al 100% y pega el resultado**.
