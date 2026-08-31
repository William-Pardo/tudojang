
// servicios/estudiantesApi.ts
import {
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    deleteField,
    query,
    where,
    limit,
    writeBatch
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, isFirebaseConfigured } from '../firebase/config';
import type { Estudiante } from '../tipos';
import { GrupoEdad, EstadoPago, GradoTKD } from '../tipos';

const estudiantesCollection = collection(db, 'estudiantes');

const uploadFirma = async (
    tenantId: string,
    idEstudiante: string, 
    firmaBase64: string, 
    tipo: 'consentimiento' | 'contrato' | 'imagen'
): Promise<string> => {
    if (!isFirebaseConfigured) {
      console.warn("MODO SIMULADO: Saltando subida de firma a Firebase Storage.");
      return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    }
    const storageRef = ref(getStorage(), `tenants/${tenantId}/firmas/${idEstudiante}/${tipo}_${Date.now()}.png`);
    const finalBase64 = firmaBase64.startsWith('data:') ? firmaBase64 : `data:image/png;base64,${firmaBase64}`;
    const snapshot = await uploadString(storageRef, finalBase64, 'data_url');
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
};

// ERR-0011: obtenerEstudiantes() leia la coleccion COMPLETA sin filtro de tenant --
// cualquier Instructor/Admin autenticado recibia estudiantes de TODOS los tenants.
// Mismo patron ya usado en sedesApi.ts::obtenerSedes (unico caso ya corregido).
export const obtenerEstudiantes = async (tenantId?: string): Promise<Estudiante[]> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Devolviendo lista de estudiantes mock.");
        return [
            {
                id: '1', tenantId: 'escuela-gajog-001', nombres: 'Juan', apellidos: 'Pérez', numeroIdentificacion: '10101', fechaNacimiento: '2015-05-10',
                grado: GradoTKD.Amarillo, grupo: GrupoEdad.Infantil, horasAcumuladasGrado: 20, sedeId: '1', telefono: '3001',
                correo: 'juan@test.com', fechaIngreso: '2024-01-10', estadoPago: EstadoPago.AlDia, historialPagos: [], saldoDeudor: 0,
                consentimientoInformado: true, contratoServiciosFirmado: true, consentimientoImagenFirmado: true, consentimientoFotosVideos: true,
                carnetGenerado: false, estadoMatricula: 'activo' // requerido en Estudiante (SDD pricing-cupo-real, Bloque 1)
            },
            {
                id: '2', tenantId: 'escuela-gajog-001', nombres: 'Maria', apellidos: 'Lopez', numeroIdentificacion: '20202', fechaNacimiento: '2012-08-15',
                grado: GradoTKD.Verde, grupo: GrupoEdad.Precadetes, horasAcumuladasGrado: 45, sedeId: '1', telefono: '3002',
                correo: 'maria@test.com', fechaIngreso: '2024-05-15', estadoPago: EstadoPago.Pendiente, historialPagos: [], saldoDeudor: 180000,
                consentimientoInformado: false, contratoServiciosFirmado: false, consentimientoImagenFirmado: false, consentimientoFotosVideos: false,
                carnetGenerado: false, estadoMatricula: 'activo' // requerido en Estudiante (SDD pricing-cupo-real, Bloque 1)
            }
        ];
    }
    const q = tenantId
        ? query(estudiantesCollection, where('tenantId', '==', tenantId))
        : estudiantesCollection;
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, carnetGenerado: false, ...doc.data() } as Estudiante));
};

export const marcarCarnetsComoGenerados = async (ids: string[]): Promise<void> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Marcando carnets como generados.");
        return;
    }
    const batch = writeBatch(db);
    ids.forEach(id => {
        const docRef = doc(db, 'estudiantes', id);
        batch.update(docRef, { carnetGenerado: true });
    });
    await batch.commit();
};

export const obtenerEstudiantePorId = async (idEstudiante: string): Promise<Estudiante> => {
     if (!isFirebaseConfigured) {
        const all = await obtenerEstudiantes();
        const found = all.find(e => e.id === idEstudiante);
        if (found) return found;
        throw new Error("Estudiante no encontrado.");
    }
    const docRef = doc(db, 'estudiantes', idEstudiante);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Estudiante;
    } else {
        throw new Error("Estudiante no encontrado.");
    }
};

export const obtenerEstudiantePorNumIdentificacion = async (numIdentificacion: string): Promise<Estudiante> => {
     if (!isFirebaseConfigured) {
        const all = await obtenerEstudiantes();
        const found = all.find(e => e.numeroIdentificacion === numIdentificacion);
        if (found) return found;
        throw new Error("No se encontró un estudiante con ese número de identificación.");
    }
    const q = query(estudiantesCollection, where("numeroIdentificacion", "==", numIdentificacion.trim()));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        throw new Error("No se encontró un estudiante con ese número de identificación.");
    }
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Estudiante;
};

/**
 * FORMULARIO INTERNO (FormularioEstudiante.tsx, staff autenticado): consulta -- en blur, por
 * campo -- si ya existe otro estudiante del mismo tenant con ese correo/teléfono/número de
 * identificación. A diferencia de verificarDuplicadoAspirante (censoApi.ts, censo público sin
 * auth), acá SÍ hay sesión y permiso real (firestore.rules permite a Instructor leer
 * `estudiantes` de su propio tenant), así que se consulta Firestore directo -- sin pasar por
 * Cloud Function -- y se puede devolver el estudiante encontrado completo (el llamador solo
 * usa nombres/apellidos para el mensaje, nunca se expone a un tercero sin sesión).
 *
 * `limit(1)` en el caso general (alta nueva); `limit(2)` cuando se pasa `excluirId` (edición):
 * si el único resultado con limit(1) fuera justo el registro que se está editando, un
 * duplicado real y distinto quedaría sin detectar -- se trae uno más y se filtra el propio id
 * en cliente.
 */
export const buscarEstudianteDuplicado = async (
    tenantId: string,
    campo: 'correo' | 'telefono' | 'numeroIdentificacion',
    valor: string,
    excluirId?: string
): Promise<Estudiante | null> => {
    const valorNormalizado = (valor || '').trim();
    if (!isFirebaseConfigured || !tenantId || !valorNormalizado) return null;
    const q = query(
        estudiantesCollection,
        where('tenantId', '==', tenantId),
        where(campo, '==', valorNormalizado),
        limit(excluirId ? 2 : 1)
    );
    const snapshot = await getDocs(q);
    const match = snapshot.docs.find(d => d.id !== excluirId);
    return match ? ({ id: match.id, ...match.data() } as Estudiante) : null;
};

// Fix seguridad (2026-07-18, mismo bug real ya resuelto para sedes): el límite del plan
// (`tenant.limiteEstudiantes`, que ya incluye plan base + addons comprados) solo se
// validaba en el botón de la UI (hooks/useGestionEstudiantes.ts::abrirFormulario). Un
// `addDoc` directo bypaseaba ese límite por completo -- incluida la importación masiva
// (components/ModalImportacionMasiva.tsx), que llama a esta misma función en loop. La
// creación ahora pasa por la Cloud Function `crearEstudiante`, que re-valida el límite
// server-side antes de escribir (ver functions/academico/estudiantes.js). firestore.rules
// bloquea `create` directo sobre `estudiantes/{docId}` sin excepción.
export const agregarEstudiante = async (nuevoEstudiante: Omit<Estudiante, 'id' | 'historialPagos'>): Promise<Estudiante> => {
    if (!isFirebaseConfigured) {
        return { ...nuevoEstudiante, id: `mock-${Date.now()}`, historialPagos: [] } as Estudiante;
    }
    const callable = httpsCallable<
        Omit<Estudiante, 'id' | 'historialPagos'>,
        Estudiante
    >(getFunctions(), 'crearEstudiante');
    const response = await callable(nuevoEstudiante);
    return response.data;
};

export const actualizarEstudiante = async (estudianteActualizado: Estudiante): Promise<Estudiante> => {
     if (!isFirebaseConfigured) {
        return estudianteActualizado;
    }
    const { id, ...data } = estudianteActualizado;
    const docRef = doc(db, 'estudiantes', id);
    await updateDoc(docRef, data);
    return estudianteActualizado;
};

export const eliminarEstudiante = async (idEstudiante: string): Promise<void> => {
     if (!isFirebaseConfigured) return;
    const docRef = doc(db, 'estudiantes', idEstudiante);
    await deleteDoc(docRef);
};

// vincularTutorAEstudiantes / desvincularTutorDeEstudiante (2026-07-30, reemplazo de
// VinculosView/vinculoService): el vínculo tutor↔estudiante real vive en
// Estudiante.tutor.correo (fuente de verdad desde el rediseño 2026-07-14), no en la
// colección tenants/{id}/vinculos. Estas funciones permiten reutilizar el mismo objeto
// `tutor` de un tutor ya existente en varios estudiantes (hermanos) sin re-tipearlo a mano.
export const vincularTutorAEstudiantes = async (
    idsEstudiantes: string[],
    tutor: NonNullable<Estudiante['tutor']>
): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const batch = writeBatch(db);
    idsEstudiantes.forEach((id) => {
        batch.update(doc(db, 'estudiantes', id), { tutor });
    });
    await batch.commit();
};

export const desvincularTutorDeEstudiante = async (idEstudiante: string): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const docRef = doc(db, 'estudiantes', idEstudiante);
    await updateDoc(docRef, { tutor: deleteField() });
};

// retirarEstudiante / reactivarEstudiante (SDD pricing-cupo-real, Bloque 1 --
// matricula-estado-estudiante): unicos writers de `estadoMatricula` fuera del alta
// (crearEstudiante, functions/academico/estudiantes.js). `updateDoc` toca SOLO estos 2
// campos -- Firestore hace merge parcial, asi que historialPagos, progreso y asistencia
// quedan intactos por construccion (Scenario: "Retirar un estudiante conserva su
// historial"). `facturacion-metered` (bloque posterior) lee `estadoMatricula` para decidir
// que estudiante es facturable; retirar/reactivar es la unica forma de cambiarlo despues
// del alta.
export const retirarEstudiante = async (idEstudiante: string): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const docRef = doc(db, 'estudiantes', idEstudiante);
    await updateDoc(docRef, { estadoMatricula: 'retirado', fechaRetiro: new Date().toISOString() });
};

export const reactivarEstudiante = async (idEstudiante: string): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const docRef = doc(db, 'estudiantes', idEstudiante);
    await updateDoc(docRef, { estadoMatricula: 'activo', fechaReactivacion: new Date().toISOString() });
};

export const guardarFirmaConsentimiento = async (idEstudiante: string, tenantId: string, firmaDigital: string): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const urlFirma = await uploadFirma(tenantId, idEstudiante, firmaDigital, 'consentimiento');
    const docRef = doc(db, 'estudiantes', idEstudiante);
    await updateDoc(docRef, { consentimientoInformado: true, 'tutor.firmaDigital': urlFirma });
};

export const guardarFirmaContrato = async (idEstudiante: string, tenantId: string, firmaDigital: string): Promise<void> => {
     if (!isFirebaseConfigured) return;
    const urlFirma = await uploadFirma(tenantId, idEstudiante, firmaDigital, 'contrato');
    const docRef = doc(db, 'estudiantes', idEstudiante);
    await updateDoc(docRef, { contratoServiciosFirmado: true, 'tutor.firmaContratoDigital': urlFirma });
};

export const guardarFirmaImagen = async (idEstudiante: string, tenantId: string, firmaDigital: string, autorizaFotos: boolean): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const urlFirma = await uploadFirma(tenantId, idEstudiante, firmaDigital, 'imagen');
    const docRef = doc(db, 'estudiantes', idEstudiante);
    await updateDoc(docRef, { consentimientoImagenFirmado: true, consentimientoFotosVideos: autorizaFotos, 'tutor.firmaImagenDigital': urlFirma });
};
