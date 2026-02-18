# Plan de Desarrollo: Sistema de Pagos en Efectivo

## 1. Resumen Ejecutivo

**Objetivo:** Implementar un sistema de recepción de pagos en efectivo como alternativa a la verificación de comprobantes de pago, que permita registrar manualmente pagos por diferentes conceptos (membresía, eventos, tienda, cursos) y generar facturas/notificaciones automáticas.

---

## 2. Análisis del Sistema Actual

### 2.1 Estructuras de Datos Existentes

| Entidad | Campo de Pago | Estado |
|---------|---------------|--------|
| `Estudiante` | `estadoPago`, `saldoDeudor`, `historialPagos` | Control de membresía |
| `SolicitudInscripcion` | `estado` (Pendiente/Aprobada/Rechazada) | Inscripción a eventos |
| `SolicitudCompra` | `estado` (Pendiente/Aprobada/Rechazada) | Compras en tienda |
| `MovimientoFinanciero` | `tipo`, `categoria`, `monto` | Registro contable |

### 2.2 Categorías de Pago Identificadas

```typescript
enum CategoriaFinanciera {
    Mensualidad = 'Mensualidad',
    Implementos = 'Implementos',
    Eventos = 'Eventos',
    Inscripcion = 'Inscripción Nuevo Alumno',
    Mora = 'Recargo por Mora',
    // NUEVAS:
    Programa = 'Programa/Curso',
    Tienda = 'Tienda'
}
```

---

## 3. Arquitectura Propuesta

### 3.1 Nueva Interfaz: `PagoEfectivo`

```typescript
interface PagoEfectivo {
    id: string;
    tenantId: string;
    estudianteId: string;
    estudianteNombre: string;
    tutorEmail?: string;
    tutorTelefono?: string;
    
    // Detalles del pago
    tipoPago: 'Mensualidad' | 'Evento' | 'Tienda' | 'Programa' | 'Inscripcion' | 'Mora';
    concepto: string;           // Descripción del concepto pagado
    monto: number;
    referenciaId?: string;      // ID del evento, implemento, programa, etc.
    referenciaNombre?: string;  // Nombre del evento, implemento, programa
    
    // Control
    fechaPago: string;
    fechaRegistro: string;
    registradoPor: string;      // ID del usuario que registró el pago
    registradoPorNombre: string;
    sedeId: string;
    
    // Comprobante
    numeroRecibo: string;       // Autogenerado: REC-2024-0001
    facturaEnviada: boolean;
    fechaEnvioFactura?: string;
    
    // Estado
    estado: 'Registrado' | 'Facturado' | 'Anulado';
}
```

### 3.2 Nueva Interfaz: `DeudaPendiente`

```typescript
interface DeudaPendiente {
    id: string;
    estudianteId: string;
    tipo: 'Mensualidad' | 'Evento' | 'Tienda' | 'Programa' | 'Inscripcion' | 'Mora';
    concepto: string;
    monto: number;
    fechaVencimiento?: string;
    referenciaId?: string;
    referenciaNombre?: string;
    sedeId: string;
    estado: 'Pendiente' | 'Pagado' | 'Vencido';
}
```

---

## 4. Flujo de Usuario

### 4.1 Flujo Principal

```
┌─────────────────────────────────────────────────────────────────┐
│                    VISTA DE ESTUDIANTE                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  SECCIÓN: Pagos Pendientes                                  ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │ 📋 Deudas Detectadas:                                   │││
│  │  │                                                         │││
│  │  │ [Mensualidad Enero] $80.000  [🔘 Pagar en Efectivo]    │││
│  │  │ [Evento: Torneo Regional] $50.000  [🔘 Pagar en Efectivo]││
│  │  │ [Tienda: Pechera Adidas] $120.000  [🔘 Pagar en Efectivo]││
│  │  │ [Programa: Poomsae Avanzado] $60.000  [🔘 Pagar en Efectivo]││
│  │  └─────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              MODAL: Confirmar Pago en Efectivo                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Concepto: Mensualidad Enero 2024                          ││
│  │  Monto: $80.000                                             ││
│  │  Estudiante: Juan Pérez                                     ││
│  │  Tutor: María Pérez (maria@email.com)                      ││
│  │                                                             ││
│  │  [✓] Enviar factura por WhatsApp                           ││
│  │  [✓] Enviar factura por Email                              ││
│  │                                                             ││
│  │  [Confirmar Pago]  [Cancelar]                              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ACCIONES AUTOMÁTICAS                         │
│                                                                 │
│  1. Crear MovimientoFinanciero (Ingreso)                       │
│  2. Actualizar estado de la deuda (Pagado)                     │
│  3. Generar número de recibo (REC-2024-0001)                   │
│  4. Crear registro PagoEfectivo                                │
│  5. Enviar factura por WhatsApp/Email                          │
│  6. Actualizar estadoPago del estudiante (si aplica)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Plan de Implementación

### FASE 1: Infraestructura Base (2-3 días)

#### 5.1.1 Crear Nuevos Tipos (`tipos.ts`)
- [ ] Agregar interfaz `PagoEfectivo`
- [ ] Agregar interfaz `DeudaPendiente`
- [ ] Agregar enum `TipoPago`
- [ ] Extender `CategoriaFinanciera` con nuevos tipos

#### 5.1.2 Crear Servicio de Pagos en Efectivo (`servicios/pagosEfectivoApi.ts`)
- [ ] `obtenerPagosEfectivo(tenantId, estudianteId?)`
- [ ] `registrarPagoEfectivo(pago)` - Crea pago, movimiento financiero y actualiza deudas
- [ ] `anularPagoEfectivo(pagoId)` - Anula pago y revierte cambios
- [ ] `generarNumeroRecibo(tenantId)` - Genera número secuencial
- [ ] `obtenerDeudasPendientes(estudianteId)` - Calcula deudas activas

#### 5.1.3 Crear Servicio de Facturación (`servicios/facturacionApi.ts`)
- [ ] `generarFacturaPDF(pago)` - Genera PDF del recibo
- [ ] `enviarFacturaWhatsApp(pago, telefono)` - Envía por WhatsApp
- [ ] `enviarFacturaEmail(pago, email)` - Envía por Email

### FASE 2: Detección de Deudas (1-2 días)

#### 5.2.1 Crear Utilidad de Cálculo de Deudas (`utils/calculoDeudas.ts`)
- [ ] `detectarDeudasEstudiante(estudiante, eventos, solicitudesCompra, programas)`
  - Detecta mensualidades pendientes/vencidas
  - Detecta eventos con inscripción aprobada sin pago
  - Detecta compras de tienda aprobadas sin pago
  - Detecta programas inscritos sin pago
  - Detecta inscripciones de nuevo alumno sin pago

#### 5.2.2 Crear Hook `useDeudasEstudiante`
- [ ] Hook que calcula y cachea las deudas de un estudiante
- [ ] Actualización automática cuando cambian los datos

### FASE 3: Interfaz de Usuario (2-3 días)

#### 5.3.1 Componente `ModalPagoEfectivo.tsx`
- [ ] Modal de confirmación de pago
- [ ] Opciones de envío de factura (WhatsApp/Email)
- [ ] Validación de monto y concepto
- [ ] Animación de confirmación

#### 5.3.2 Componente `TarjetaDeudaPendiente.tsx`
- [ ] Muestra una deuda individual
- [ ] Botón "Pagar en Efectivo"
- [ ] Indicador de tipo de deuda (icono y color)
- [ ] Información de vencimiento

#### 5.3.3 Sección `DeudasPendientes.tsx`
- [ ] Lista de deudas del estudiante
- [ ] Agrupación por tipo
- [ ] Total de deuda
- [ ] Acción rápida de pago múltiple (opcional)

#### 5.3.4 Integración en `FilaEstudiante.tsx`
- [ ] Agregar indicador visual de deudas pendientes
- [ ] Botón de acceso rápido a pagos

### FASE 4: Integración con Finanzas (1 día)

#### 5.4.1 Actualizar `DataContext.tsx`
- [ ] Agregar `pagosEfectivo` al contexto
- [ ] Agregar `deudasPendientes` calculadas
- [ ] Funciones `registrarPagoEfectivo`, `anularPagoEfectivo`

#### 5.4.2 Actualizar `vistas/Finanzas.tsx`
- [ ] Mostrar pagos en efectivo en el historial
- [ ] Filtro por método de pago (Efectivo/Transferencia)
- [ ] Indicador de pagos manuales vs automáticos

### FASE 5: Notificaciones y Facturación (1-2 días)

#### 5.5.1 Plantilla de Factura
- [ ] Diseñar plantilla HTML para factura
- [ ] Generación de PDF con jsPDF o similar
- [ ] Incluir QR de verificación

#### 5.5.2 Integración con WhatsApp
- [ ] Usar WhatsApp Business API o wa.me
- [ ] Mensaje personalizado con detalles del pago
- [ ] Adjuntar PDF de la factura

#### 5.5.3 Integración con Email
- [ ] Usar Firebase Functions o servicio externo
- [ ] Plantilla de email profesional
- [ ] Adjuntar PDF de la factura

### FASE 6: Reportes y Auditoría (1 día)

#### 5.6.1 Reporte de Pagos en Efectivo
- [ ] Resumen diario de pagos en efectivo
- [ ] Reporte por usuario que registró
- [ ] Exportación a Excel

#### 5.6.2 Auditoría
- [ ] Log de cambios en pagos
- [ ] Historial de anulaciones
- [ ] Trazabilidad completa

---

## 6. Estructura de Archivos Nuevos

```
src/
├── tipos.ts (modificar)
├── servicios/
│   ├── pagosEfectivoApi.ts (nuevo)
│   ├── facturacionApi.ts (nuevo)
│   └── finanzasApi.ts (modificar)
├── utils/
│   └── calculoDeudas.ts (nuevo)
├── hooks/
│   └── useDeudasEstudiante.ts (nuevo)
├── components/
│   ├── ModalPagoEfectivo.tsx (nuevo)
│   ├── TarjetaDeudaPendiente.tsx (nuevo)
│   └── SeccionDeudasPendientes.tsx (nuevo)
├── context/
│   └── DataContext.tsx (modificar)
├── vistas/
│   ├── Finanzas.tsx (modificar)
│   └── Estudiantes.tsx (modificar)
└── plantillas/
    └── factura.html (nuevo)
```

---

## 7. Consideraciones Técnicas

### 7.1 Seguridad
- Solo roles `Admin`, `Editor` y `SuperAdmin` pueden registrar pagos en efectivo
- Cada pago queda registrado con el usuario que lo realizó
- Los pagos pueden ser anulados solo por Admin o SuperAdmin

### 7.2 Concurrencia
- Usar transacciones de Firestore para operaciones atómicas
- Evitar doble registro del mismo pago

### 7.3 Performance
- Cache de deudas calculadas
- Actualización optimista de UI
- Paginación de historial de pagos

---

## 8. Estimación de Tiempo

| Fase | Duración | Prioridad |
|------|----------|-----------|
| FASE 1: Infraestructura | 2-3 días | Alta |
| FASE 2: Detección de Deudas | 1-2 días | Alta |
| FASE 3: Interfaz de Usuario | 2-3 días | Alta |
| FASE 4: Integración Finanzas | 1 día | Media |
| FASE 5: Notificaciones | 1-2 días | Media |
| FASE 6: Reportes | 1 día | Baja |
| **TOTAL** | **8-12 días** | |

---

## 9. Criterios de Aceptación

### 9.1 Funcionales
- [ ] El sistema detecta automáticamente deudas pendientes por tipo
- [ ] El botón de pago en efectivo está disponible para cada deuda
- [ ] Al confirmar el pago, se genera un recibo con número único
- [ ] El pago se registra en el módulo de finanzas
- [ ] Se envía factura por WhatsApp y/o Email al tutor
- [ ] El estado del estudiante se actualiza automáticamente
- [ ] Los pagos pueden ser consultados y anulados

### 9.2 No Funcionales
- [ ] Tiempo de respuesta < 2 segundos
- [ ] Disponible en modo offline (con sincronización posterior)
- [ ] Compatible con dispositivos móviles
- [ ] Cumple con regulaciones de facturación

---

## 10. Próximos Pasos

1. **Aprobación del Plan** - Revisar y aprobar este documento
2. **Crear Rama de Desarrollo** - `feature/pago-efectivo`
3. **Iniciar FASE 1** - Comenzar con la infraestructura base
4. **Revisión Continua** - Daily standups y demos al finalizar cada fase

---

**Documento preparado por:** Kilo Code  
**Fecha:** 2026-02-18  
**Versión:** 1.0
