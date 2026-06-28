// servicios/academico/bibliotecaService.ts
// Servicio frontend para la gestión de la biblioteca académica de Tudojang.
// Administra el ciclo de vida de los recursos académicos importados desde Google Drive.

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
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
      const id = `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const recurso: RecursoAcademico = {
        id,
        tenantId,
        proveedor: 'google_drive',
        externalFileId: fileId,
        nombre,
        mimeType,
        ficha: null,
        estado: 'borrador',
        creadoPorUid,
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString()
      };
      mockRecursos.push(recurso);
      return recurso;
    }

    const docRef = doc(collection(getDatabase(), 'tenants', tenantId, 'recursos'));
    const recurso: RecursoAcademico = {
      id: docRef.id,
      tenantId,
      proveedor: 'google_drive',
      externalFileId: fileId,
      nombre,
      mimeType,
      ficha: null,
      estado: 'borrador',
      creadoPorUid,
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    };
    await setDoc(docRef, recurso);
    return recurso;
  };

  /**
   * Actualiza la ficha académica de un recurso y cambia su estado a 'pendiente'.
   */
  const updateFicha = async (
    tenantId: string,
    recursoId: string,
    ficha: FichaAcademica
  ): Promise<void> => {
    if (!checkConfigured()) {
      const recurso = mockRecursos.find(r => r.id === recursoId && r.tenantId === tenantId);
      if (!recurso) {
        throw new Error('Recurso no encontrado');
      }
      if (recurso.estado !== 'borrador' && recurso.estado !== 'pendiente') {
        throw new Error(`Transición inválida: no se puede actualizar la ficha en estado ${recurso.estado}`);
      }
      recurso.ficha = ficha;
      recurso.estado = 'pendiente';
      recurso.actualizadoEn = new Date().toISOString();
      return;
    }

    const docRef = doc(getDatabase(), 'tenants', tenantId, 'recursos', recursoId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error('Recurso no encontrado');
    }
    const recurso = snap.data() as RecursoAcademico;
    if (recurso.estado !== 'borrador' && recurso.estado !== 'pendiente') {
      throw new Error(`Transición inválida: no se puede actualizar la ficha en estado ${recurso.estado}`);
    }
    await updateDoc(docRef, {
      ficha,
      estado: 'pendiente',
      actualizadoEn: new Date().toISOString()
    });
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
      if (recurso.estado !== 'pendiente') {
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
    if (recurso.estado !== 'pendiente') {
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

  return {
    importFromDrive,
    updateFicha,
    approveRecurso,
    archiveRecurso
  };
};

export const bibliotecaService = crearBibliotecaService();

// Exportaciones individuales para compatibilidad con importaciones destructuradas
export const {
  importFromDrive,
  updateFicha,
  approveRecurso,
  archiveRecurso
} = bibliotecaService;
