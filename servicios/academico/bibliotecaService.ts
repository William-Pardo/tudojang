// servicios/academico/bibliotecaService.ts
// Servicio frontend para la gestión de la biblioteca académica de Tudojang.
// Administra el ciclo de vida de los recursos académicos importados desde Google Drive.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Firestore
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../firebase/config';
import { RecursoAcademico, FichaAcademica } from '../../models/academico/recurso';

export interface BibliotecaServiceDeps {
  db?: Firestore;
  isFirebaseConfigured?: boolean;
}

// In-memory mock storage for local/test mode
let mockRecursos: RecursoAcademico[] = [];

export const clearMockRecursos = () => {
  mockRecursos = [];
};

export const getMockRecursos = () => mockRecursos;

/**
 * Crea el servicio de Biblioteca con dependencias inyectadas (facilita testing).
 */
export const crearBibliotecaService = (deps: BibliotecaServiceDeps = {}) => {
  // Usar base de datos inyectada o la por defecto de forma dinámica para evitar cacheo de estados en testing
  const getDatabase = () => deps.db || db;
  const checkConfigured = () => deps.isFirebaseConfigured !== undefined ? deps.isFirebaseConfigured : isFirebaseConfigured;

  /**
   * Importa un archivo de Drive y lo registra en Firestore en estado 'borrador'.
   */
  const importFromDrive = async (
    tenantId: string,
    fileId: string,
    nombre: string,
    mimeType: string,
    creadoPorUid: string
  ): Promise<RecursoAcademico> => {
    if (!checkConfigured()) {
      const existente = buscarRecursoIndexadoEnMock_(tenantId, fileId, nombre);
      if (existente) return existente;

      const id = `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const recurso: RecursoAcademico = {
        id,
        tenantId,
        proveedor: 'google_drive',
        externalFileId: fileId,
        nombre,
        nombreNormalizado: normalizarNombreRecurso_(nombre),
        mimeType,
        fuenteDriveEstado: 'verificada',
        ultimaVerificacionDrive: new Date().toISOString(),
        ficha: null,
        estado: 'borrador',
        creadoPorUid,
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString()
      };
      mockRecursos.push(recurso);
      return recurso;
    }

    const existente = await findRecursoIndexado(tenantId, fileId, nombre);
    if (existente) return existente;

    const docRef = doc(collection(getDatabase(), 'tenants', tenantId, 'recursos'));
    const recurso: RecursoAcademico = {
      id: docRef.id,
      tenantId,
      proveedor: 'google_drive',
      externalFileId: fileId,
      nombre,
      nombreNormalizado: normalizarNombreRecurso_(nombre),
      mimeType,
      fuenteDriveEstado: 'verificada',
      ultimaVerificacionDrive: new Date().toISOString(),
      ficha: null,
      estado: 'borrador',
      creadoPorUid,
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    };
    await setDoc(docRef, recurso);
    return recurso;
  };

  const findRecursoIndexado = async (
    tenantId: string,
    fileId: string,
    nombre?: string
  ): Promise<RecursoAcademico | null> => {
    if (!checkConfigured()) {
      return buscarRecursoIndexadoEnMock_(tenantId, fileId, nombre);
    }

    const recursosRef = collection(getDatabase(), 'tenants', tenantId, 'recursos');
    const consultaPorArchivo = query(recursosRef, where('externalFileId', '==', fileId));
    const snapPorArchivo = await getDocs(consultaPorArchivo);
    if (snapPorArchivo && !snapPorArchivo.empty && snapPorArchivo.docs[0]) {
      const item = snapPorArchivo.docs[0];
      return { id: item.id, ...item.data() } as RecursoAcademico;
    }

    if (!nombre) return null;

    const consultaPorNombre = query(recursosRef, where('nombreNormalizado', '==', normalizarNombreRecurso_(nombre)));
    const snapPorNombre = await getDocs(consultaPorNombre);
    if (snapPorNombre && !snapPorNombre.empty && snapPorNombre.docs[0]) {
      const item = snapPorNombre.docs[0];
      return { id: item.id, ...item.data() } as RecursoAcademico;
    }

    return null;
  };

  /**
   * Actualiza la ficha académica de un recurso y cambia su estado a 'pendiente'.
   * `tituloVisible` se persiste solo cuando llega no vacío, para no pisar el valor
   * existente en re-guardados que no lo editan.
   */
  const updateFicha = async (
    tenantId: string,
    recursoId: string,
    ficha: FichaAcademica,
    tituloVisible?: string
  ): Promise<void> => {
    const tituloVisibleLimpio = tituloVisible?.trim() ?? '';

    if (!checkConfigured()) {
      const recurso = mockRecursos.find(r => r.id === recursoId && r.tenantId === tenantId);
      if (!recurso) {
        throw new Error('Recurso no encontrado');
      }
      if (recurso.estado !== 'borrador' && recurso.estado !== 'pendiente' && recurso.estado !== 'aprobado') {
        throw new Error(`Transición inválida: no se puede actualizar la ficha en estado ${recurso.estado}`);
      }
      recurso.ficha = ficha;
      if (tituloVisibleLimpio) {
        recurso.tituloVisible = tituloVisibleLimpio;
      }
      if (recurso.estado === 'borrador') {
        recurso.estado = 'pendiente';
      }
      recurso.actualizadoEn = new Date().toISOString();
      return;
    }

    const docRef = doc(getDatabase(), 'tenants', tenantId, 'recursos', recursoId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error('Recurso no encontrado');
    }
    const recurso = snap.data() as RecursoAcademico;
    if (recurso.estado !== 'borrador' && recurso.estado !== 'pendiente' && recurso.estado !== 'aprobado') {
      throw new Error(`Transición inválida: no se puede actualizar la ficha en estado ${recurso.estado}`);
    }
    const nuevoEstado = recurso.estado === 'borrador' ? 'pendiente' : recurso.estado;
    await updateDoc(docRef, {
      ficha,
      estado: nuevoEstado,
      actualizadoEn: new Date().toISOString(),
      ...(tituloVisibleLimpio ? { tituloVisible: tituloVisibleLimpio } : {})
    });

    // Fix (bug reportado: renombrar un material no actualizaba el nombre en cascada):
    // AsignacionAcademica.titulo es una copia del título tomada al publicar (ver
    // AsignacionesView.tsx `titulo: recursoDraft.tituloVisible || recursoDraft.nombre`),
    // no una referencia en vivo al recurso. Sin este fan-out, renombrar un recurso ya
    // asignado dejaba el nombre viejo "huérfano" en Agenda, Centro de Estudios y el
    // panel de Progreso por Estudiante (todos leen `asignacion.titulo`, no el recurso).
    if (tituloVisibleLimpio && tituloVisibleLimpio !== recurso.tituloVisible) {
      await propagarTituloAAsignaciones(getDatabase(), tenantId, recursoId, tituloVisibleLimpio);
    }
  };

  /**
   * Aprueba el recurso y cambia su estado a 'aprobado'.
   */
  const approveRecurso = async (
    tenantId: string,
    recursoId: string,
    adminUid: string
  ): Promise<void> => {
    if (!checkConfigured()) {
      const recurso = mockRecursos.find(r => r.id === recursoId && r.tenantId === tenantId);
      if (!recurso) {
        throw new Error('Recurso no encontrado');
      }
      if (recurso.estado === 'aprobado') {
        return; // Idempotente
      }
      if (!recurso.ficha) {
        throw new Error('No se puede aprobar un recurso sin ficha académica clasificada.');
      }
      if (recurso.estado !== 'pendiente' && recurso.estado !== 'borrador') {
        throw new Error(`Transición inválida: no se puede aprobar un recurso en estado ${recurso.estado}`);
      }
      recurso.estado = 'aprobado';
      recurso.aprobadoPorUid = adminUid;
      recurso.aprobadoEn = new Date().toISOString();
      recurso.actualizadoEn = new Date().toISOString();
      return;
    }

    const docRef = doc(getDatabase(), 'tenants', tenantId, 'recursos', recursoId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error('Recurso no encontrado');
    }
    const recurso = snap.data() as RecursoAcademico;
    if (recurso.estado === 'aprobado') {
      return; // Idempotente
    }
    if (!recurso.ficha) {
      throw new Error('No se puede aprobar un recurso sin ficha académica clasificada.');
    }
    if (recurso.estado !== 'pendiente' && recurso.estado !== 'borrador') {
      throw new Error(`Transición inválida: no se puede aprobar un recurso en estado ${recurso.estado}`);
    }
    await updateDoc(docRef, {
      estado: 'aprobado',
      aprobadoPorUid: adminUid,
      aprobadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    });
  };

  /**
   * Archiva el recurso y cambia su estado a 'archivado'.
   */
  const archiveRecurso = async (
    tenantId: string,
    recursoId: string
  ): Promise<void> => {
    if (!checkConfigured()) {
      const recurso = mockRecursos.find(r => r.id === recursoId && r.tenantId === tenantId);
      if (!recurso) {
        throw new Error('Recurso no encontrado');
      }
      if (recurso.estado !== 'aprobado') {
        throw new Error(`Transición inválida: no se puede archivar un recurso en estado ${recurso.estado}`);
      }
      recurso.estado = 'archivado';
      recurso.actualizadoEn = new Date().toISOString();
      return;
    }

    const docRef = doc(getDatabase(), 'tenants', tenantId, 'recursos', recursoId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error('Recurso no encontrado');
    }
    const recurso = snap.data() as RecursoAcademico;
    if (recurso.estado !== 'aprobado') {
      throw new Error(`Transición inválida: no se puede archivar un recurso en estado ${recurso.estado}`);
    }
    await updateDoc(docRef, {
      estado: 'archivado',
      actualizadoEn: new Date().toISOString()
    });
  };

  const listarRecursosAprobados = async (tenantId: string): Promise<RecursoAcademico[]> => {
    if (!checkConfigured()) {
      return mockRecursos.filter((recurso) => (
        recurso.tenantId === tenantId
        && recurso.estado === 'aprobado'
      ));
    }

    const recursosRef = collection(getDatabase(), 'tenants', tenantId, 'recursos');
    const consulta = query(recursosRef, where('estado', '==', 'aprobado'));
    const snap = await getDocs(consulta);

    return snap.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    } as RecursoAcademico));
  };

  return {
    importFromDrive,
    findRecursoIndexado,
    updateFicha,
    approveRecurso,
    archiveRecurso,
    listarRecursosAprobados
  };
};

export const bibliotecaService = crearBibliotecaService();

// Exportaciones individuales para compatibilidad con importaciones destructuradas
export const {
  importFromDrive,
  findRecursoIndexado,
  updateFicha,
  approveRecurso,
  archiveRecurso,
  listarRecursosAprobados
} = bibliotecaService;

function buscarRecursoIndexadoEnMock_(tenantId: string, fileId: string, nombre?: string): RecursoAcademico | null {
  const nombreNormalizado = nombre ? normalizarNombreRecurso_(nombre) : '';
  return mockRecursos.find((recurso) => (
    recurso.tenantId === tenantId
    && (
      recurso.externalFileId === fileId
      || Boolean(nombreNormalizado && normalizarNombreRecurso_(recurso.nombre) === nombreNormalizado)
    )
  )) ?? null;
}

function normalizarNombreRecurso_(nombre: string): string {
  return String(nombre || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Actualiza `titulo` en todas las asignaciones (`tenants/{tenantId}/asignaciones`) que
 * referencian este recurso, para que el nuevo nombre se refleje en cascada en Agenda,
 * Centro de Estudios y el panel de Progreso por Estudiante. No falla la clasificaci\u00f3n del
 * recurso si esto da error (se loggea y se sigue) -- el t\u00edtulo del recurso ya qued\u00f3
 * guardado correctamente, que es la operaci\u00f3n principal del usuario.
 */
async function propagarTituloAAsignaciones(
  database: Firestore,
  tenantId: string,
  recursoId: string,
  tituloNuevo: string
): Promise<void> {
  try {
    const asignacionesRef = collection(database, 'tenants', tenantId, 'asignaciones');
    const snap = await getDocs(query(asignacionesRef, where('recursoId', '==', recursoId)));
    if (snap.empty) return;

    const batch = writeBatch(database);
    for (const docSnap of snap.docs) {
      batch.update(docSnap.ref, { titulo: tituloNuevo, actualizadoEn: new Date().toISOString() });
    }
    await batch.commit();
  } catch (err) {
    console.error(`[bibliotecaService] No se pudo propagar el nuevo t\u00edtulo a las asignaciones de ${recursoId}:`, err);
  }
}
