
import {
    collection,
    getDocs,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    query,
    where,
    writeBatch,
    Timestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import type { Estudiante, SolicitudCompra, SolicitudInscripcion, MovimientoFinanciero, TransaccionPago } from '../tipos';
import { EstadoPago, EstadoSolicitud, EstadoSolicitudCompra, TipoMovimiento, CategoriaFinanciera } from '../tipos';
import { calcularSaldoTrasPago, estadoPagoPorSaldo } from '../utils/finanzas';

// Interfaces para el manejo de pagos
export interface DeudaPendiente {
    id: string;
    tipo: 'Tienda' | 'Evento' | 'Mensualidad' | 'Mora' | 'Matricula';
    descripcion: string;
    monto: number;
    fechaGeneracion: string; // Fecha de solicitud o fecha de vencimiento
    origenId?: string; // ID de la solicitud o evento
    detalles?: any; // Objeto completo de la solicitud convertida a any para flexibilidad
}

export interface ItemAPagar {
    id: string;
    tipo: 'Tienda' | 'Evento' | 'Mensualidad' | 'Mora' | 'Matricula';
    monto: number; // Monto que se está pagando por este item
}

export interface ResumenDeudas {
    totalDeuda: number;
    items: DeudaPendiente[];
    estudiante: Estudiante;
}

export interface PagoProcesado {
    exito: boolean;
    reciboId?: string;
    nuevoSaldo?: number;
    mensaje?: string;
}

const solicitudesCompraCollection = collection(db, 'solicitudesCompra');
const solicitudesInscripcionCollection = collection(db, 'solicitudesInscripcion');
const transaccionesPagoCollection = collection(db, 'transaccionesPago');

/**
 * Obtiene todas las deudas pendientes de un estudiante (Tienda, Eventos, Mensualidad calculada)
 */
export const obtenerDeudasEstudiante = async (estudianteId: string): Promise<ResumenDeudas> => {
    // 1. Obtener estudiante
    const estudianteRef = doc(db, 'estudiantes', estudianteId);
    const estudianteSnap = await getDoc(estudianteRef);

    if (!estudianteSnap.exists()) {
        throw new Error("Estudiante no encontrado");
    }

    const estudiante = { id: estudianteSnap.id, ...estudianteSnap.data() } as Estudiante;
    const items: DeudaPendiente[] = [];

    /* istanbul ignore next -- rama exclusiva del modo demo, sin Firebase */
    if (!isFirebaseConfigured) {
        // MOCK DATA para desarrollo local
        return {
            totalDeuda: estudiante.saldoDeudor,
            items: [
                { id: 'mock-1', tipo: 'Mensualidad', descripcion: 'Mensualidad Mayo', monto: 180000, fechaGeneracion: '2024-05-05' },
                { id: 'mock-2', tipo: 'Tienda', descripcion: 'Dobok Talla 2', monto: 140000, fechaGeneracion: '2024-04-20', origenId: 'req-123' }
            ],
            estudiante
        };
    }

    // 2. Buscar Solicitudes de Tienda Aprobadas pero NO pagadas
    const qTienda = query(
        solicitudesCompraCollection,
        where('estudiante.id', '==', estudianteId),
        where('estado', '==', EstadoSolicitudCompra.Aprobada)
    );
    const snapTienda = await getDocs(qTienda);
    snapTienda.forEach(doc => {
        const data = doc.data() as SolicitudCompra;
        if (!data.pagado) {
            items.push({
                id: doc.id,
                tipo: 'Tienda',
                descripcion: `${data.implemento.nombre} - ${data.variacion.descripcion}`,
                monto: data.variacion.precio,
                fechaGeneracion: data.fechaSolicitud,
                origenId: doc.id,
                detalles: data
            });
        }
    });

    // 3. Buscar Solicitudes de Eventos Aprobadas pero NO pagadas
    const qEventos = query(
        solicitudesInscripcionCollection,
        where('estudiante.id', '==', estudianteId),
        where('estado', '==', EstadoSolicitud.Aprobada)
    );
    const snapEventos = await getDocs(qEventos);

    // Recolectar IDs de eventos para lectura eficiente
    const uniqueEventoIds = new Set<string>();
    snapEventos.forEach(doc => {
        const data = doc.data() as SolicitudInscripcion;
        if (!data.pagado) uniqueEventoIds.add(data.eventoId);
    });

    // Leer eventos en paralelo para obtener info (nombre y precio)
    const eventosMap = new Map<string, { nombre: string; valor: number }>();
    await Promise.all(Array.from(uniqueEventoIds).map(async (evId) => {
        try {
            const evSnap = await getDoc(doc(db, 'eventos', evId));
            if (evSnap.exists()) {
                const evData = evSnap.data();
                eventosMap.set(evId, { nombre: evData.nombre, valor: evData.valor });
            }
        } catch (e) {
            console.error("Error cargando evento", evId);
        }
    }));

    snapEventos.forEach(doc => {
        const data = doc.data() as SolicitudInscripcion;
        if (!data.pagado) {
            const eventoInfo = eventosMap.get(data.eventoId) || { nombre: 'Evento (Info no disponible)', valor: 0 };
            items.push({
                id: doc.id,
                tipo: 'Evento',
                descripcion: eventoInfo.nombre,
                monto: eventoInfo.valor,
                fechaGeneracion: data.fechaSolicitud,
                origenId: doc.id,
                detalles: data
            });
        }
    });

    // 4. Calcular Mensualidad Pendiente
    // El saldoDeudor total incluye todo. 
    // Mensualidad = saldoDeudor - (suma de tienda + suma de eventos).
    const sumaItems = items.reduce((acc, curr) => acc + curr.monto, 0);
    // Usamos Math.max(0, ...) porque a veces los datos pueden estar desincronizados
    const remanente = Math.max(0, estudiante.saldoDeudor - sumaItems);

    if (remanente > 0) {
        items.push({
            id: 'mensualidad-calc',
            tipo: 'Mensualidad',
            descripcion: 'Mensualidad / Saldo Pendiente',
            monto: remanente,
            fechaGeneracion: new Date().toISOString()
        });
    }

    return {
        totalDeuda: estudiante.saldoDeudor,
        items: items.sort((a, b) => b.fechaGeneracion.localeCompare(a.fechaGeneracion)),
        estudiante
    };
};

/**
 * Procesa el pago en efectivo
 */
export const procesarPagoEfectivo = async (
    estudianteId: string,
    itemsAPagar: ItemAPagar[], // Array de objetos { id, tipo, monto }
    montoTotalRecibido: number,
    concepto: string, // Ej: "Pago Efectivo - Mayo"
    notas?: string,
    usuarioAdminId?: string
): Promise<PagoProcesado> => {

    /* istanbul ignore next -- rama exclusiva del modo demo, sin Firebase */
    if (!isFirebaseConfigured) {
        return { exito: true, reciboId: `REC-MOCK-${Date.now()}`, nuevoSaldo: 0, mensaje: "Pago simulado exitoso" };
    }

    try {
        const batch = writeBatch(db);
        const reciboId = `REC-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
        const fechaHora = new Date().toISOString();

        // 1. Obtener Estudiante actual
        const estRef = doc(db, 'estudiantes', estudianteId);
        const estSnap = await getDoc(estRef);
        if (!estSnap.exists()) throw new Error("Estudiante no encontrado");
        const estudiante = { id: estSnap.id, ...estSnap.data() } as Estudiante;

        const descripcionItems: string[] = [];
        let categoriaFinanciera: CategoriaFinanciera = CategoriaFinanciera.Otros; // Por defecto

        // Determinar categoría principal basada en lo que se paga
        const tiposPagados = new Set(itemsAPagar.map(i => i.tipo));
        if (tiposPagados.has('Tienda')) categoriaFinanciera = CategoriaFinanciera.Implementos;
        else if (tiposPagados.has('Evento')) categoriaFinanciera = CategoriaFinanciera.Eventos;
        else if (tiposPagados.has('Mensualidad')) categoriaFinanciera = CategoriaFinanciera.Mensualidad;

        // 2. Actualizar Estado de Documentos (Solicitudes)
        for (const item of itemsAPagar) {
            if (item.tipo === 'Tienda') {
                const docRef = doc(db, 'solicitudesCompra', item.id);
                batch.update(docRef, {
                    pagado: true,
                    fechaPago: fechaHora,
                    reciboId: reciboId,
                    metodoPago: 'Efectivo'
                });
                descripcionItems.push(`Tienda: $${item.monto}`);
            } else if (item.tipo === 'Evento') {
                const docRef = doc(db, 'solicitudesInscripcion', item.id);
                batch.update(docRef, {
                    pagado: true,
                    fechaPago: fechaHora,
                    reciboId: reciboId,
                    metodoPago: 'Efectivo'
                });
                descripcionItems.push(`Evento: $${item.monto}`);
            } else {
                descripcionItems.push(`Mensualidad/Saldo: $${item.monto}`);
            }
        }

        // 3. Actualizar Saldo Estudiante
        const nuevoSaldo = calcularSaldoTrasPago(estudiante.saldoDeudor, montoTotalRecibido);
        const nuevoEstadoPago = estadoPagoPorSaldo(nuevoSaldo);

        batch.update(estRef, {
            saldoDeudor: nuevoSaldo,
            estadoPago: nuevoEstadoPago,
            // Opcional: registrar en historialPagos del documento estudiante si se desea redundancia
        });

        // 4. Crear Registro en Finanzas
        const finanzaRef = doc(collection(db, 'finanzas'));
        const nuevoIngreso: MovimientoFinanciero = {
            id: finanzaRef.id,
            tenantId: estudiante.tenantId,
            tipo: TipoMovimiento.Ingreso,
            categoria: categoriaFinanciera,
            monto: montoTotalRecibido,
            descripcion: `${concepto} (${descripcionItems.join(', ')}) - Notas: ${notas || ''}`,
            fecha: fechaHora.split('T')[0],
            sedeId: estudiante.sedeId
        };
        batch.set(finanzaRef, nuevoIngreso);

        // 5. Crear Registro Maestro de Transacción
        const transaccionRef = doc(transaccionesPagoCollection);
        const nuevaTransaccion: TransaccionPago = {
            id: transaccionRef.id,
            tenantId: estudiante.tenantId,
            estudianteId: estudiante.id,
            reciboId: reciboId,
            montoTotal: montoTotalRecibido,
            fecha: fechaHora,
            estado: 'Completado',
            itemsPagados: itemsAPagar.map(i => ({ id: i.id, tipo: i.tipo, monto: i.monto }))
        };
        batch.set(transaccionRef, nuevaTransaccion);

        await batch.commit();

        // 6. Notificar (Solo WhatsApp, según requerimiento de usuario)
        // La notificación por correo para estudiantes ha sido desactivada.
        // Se recomienda usar el flujo de WhatsApp del componente ModalRegistrarPago.

        return { exito: true, reciboId, nuevoSaldo };

    } catch (error: any) {
        console.error("Error al procesar pago:", error);
        return { exito: false, mensaje: error.message };
    }
};

/**
 * Anula una transacción de pago específica, revirtiendo el saldo del estudiante 
 * y restaurando el estado pendiente de los ítems involucrados.
 */
export const anularPagoEfectivo = async (
    transaccionId: string, 
    usuarioAdminId?: string
): Promise<{ exito: boolean, mensaje?: string }> => {
    /* istanbul ignore next -- rama exclusiva del modo demo, sin Firebase */
    if (!isFirebaseConfigured) {
        return { exito: true, mensaje: "Pago anulado simulado exitosamente" };
    }

    try {
        // 1. Obtener Transacción
        const transaccionRef = doc(transaccionesPagoCollection, transaccionId);
        const transaccionSnap = await getDoc(transaccionRef);
        
        if (!transaccionSnap.exists()) {
            throw new Error("Transacción no encontrada");
        }

        const transaccion = { id: transaccionSnap.id, ...transaccionSnap.data() } as TransaccionPago;

        if (transaccion.estado === 'Anulado') {
            throw new Error("La transacción ya se encuentra anulada");
        }

        const batch = writeBatch(db);
        const fechaHora = new Date().toISOString();

        // 2. Obtener Estudiante y Revertir Saldo
        const estRef = doc(db, 'estudiantes', transaccion.estudianteId);
        const estSnap = await getDoc(estRef);
        
        if (estSnap.exists()) {
            const estudiante = estSnap.data() as Estudiante;
            const nuevoSaldo = estudiante.saldoDeudor + transaccion.montoTotal;
            batch.update(estRef, {
                saldoDeudor: nuevoSaldo,
                estadoPago: nuevoSaldo === 0 ? EstadoPago.AlDia : EstadoPago.Pendiente
            });
        }

        // 3. Revertir estado de los Items Pagados
        for (const item of transaccion.itemsPagados) {
            if (item.tipo === 'Tienda') {
                const docRef = doc(db, 'solicitudesCompra', item.id);
                batch.update(docRef, { pagado: false });
            } else if (item.tipo === 'Evento') {
                const docRef = doc(db, 'solicitudesInscripcion', item.id);
                batch.update(docRef, { pagado: false });
            }
        }

        // 4. Marcar Transacción como Anulada
        batch.update(transaccionRef, {
            estado: 'Anulado'
        });

        // 5. Crear Movimiento Negativo en Finanzas (Auditoría Contable)
        const finanzaRef = doc(collection(db, 'finanzas'));
        const egresoAnulacion: MovimientoFinanciero = {
            id: finanzaRef.id,
            tenantId: transaccion.tenantId,
            tipo: TipoMovimiento.Egreso,
            categoria: CategoriaFinanciera.Otros, // Opcionalmente otra categoría específica
            monto: transaccion.montoTotal, // Contablemente se refleja como gasto/egreso
            descripcion: `ANULACIÓN de recibo ${transaccion.reciboId} - Autorizado por ${usuarioAdminId || 'Admin'}`,
            fecha: fechaHora.split('T')[0],
            sedeId: estSnap.exists() ? (estSnap.data() as Estudiante).sedeId : 'N/A'
        };
        batch.set(finanzaRef, egresoAnulacion);

        await batch.commit();

        return { exito: true };

    } catch (error: any) {
        console.error("Error al anular pago:", error);
        return { exito: false, mensaje: error.message };
    }
};

/**
 * Busca y retorna la última transacción de pago completada de un estudiante.
 */
export const obtenerUltimoPagoEfectivo = async (
    estudianteId: string
): Promise<TransaccionPago | null> => {
    /* istanbul ignore next -- rama exclusiva del modo demo, sin Firebase */
    if (!isFirebaseConfigured) {
        return null;
    }

    try {
        const q = query(
            transaccionesPagoCollection,
            where('estudianteId', '==', estudianteId),
            where('estado', '==', 'Completado')
        );
        
        const snap = await getDocs(q);
        if (snap.empty) {
            return null;
        }

        // Ordenamos en memoria para obtener el más reciente
        const transacciones = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransaccionPago));
        transacciones.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        
        return transacciones[0];
    } catch (error: any) {
        // Fix 2026-07-22: antes esto devolvia `null` al fallar la consulta, exactamente el
        // mismo valor que cuando NO HAY pagos. El llamador no podia distinguir un caso del
        // otro, asi que `anularUltimoPagoEfectivo` respondia "No hay pagos recientes para
        // anular" ante una caida de Firestore: el operador quedaba creyendo que no habia
        // nada que anular cuando en realidad la consulta habia reventado.
        //
        // Ahora el error se propaga. El unico consumidor directo
        // (components/ModalRegistrarPago.tsx:94, `cargarUltimoPago`) ya envuelve la llamada
        // en su propio try/catch, asi que sigue degradando igual de bien; la diferencia es
        // que el mensaje real llega a quien lo necesita.
        console.error("Error al buscar último pago:", error);
        throw error;
    }
};

/**
 * Busca y anula la última transacción de pago completada de un estudiante.
 */
export const anularUltimoPagoEfectivo = async (
    estudianteId: string,
    usuarioAdminId?: string
): Promise<{ exito: boolean, mensaje?: string }> => {
    /* istanbul ignore next -- rama exclusiva del modo demo, sin Firebase */
    if (!isFirebaseConfigured) {
        return { exito: true, mensaje: "Pago anulado simulado exitosamente" };
    }

    try {
        const ultimaTransaccion = await obtenerUltimoPagoEfectivo(estudianteId);
        if (!ultimaTransaccion) {
            throw new Error("No hay pagos recientes para anular.");
        }
        
        return await anularPagoEfectivo(ultimaTransaccion.id, usuarioAdminId);
        
    } catch (error: any) {
        console.error("Error al anular último pago:", error);
        return { exito: false, mensaje: error.message };
    }
};
