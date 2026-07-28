import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { Usuario } from '../../tipos';
import { RolUsuario } from '../../tipos';

/**
 * WS-11 (§12): validaciones de permisos para operar Clase en Vivo.
 *
 * Usuarios autorizados:
 * - Tenant/Admin: puede operar todas las clases de su tenant
 * - Maestro: solo las clases donde está asignado
 * - Asistente: solo si está habilitado como instructor (futuro)
 *
 * No autorizados:
 * - Estudiante (no puede registrar su propia asistencia)
 * - Tutor/Acudiente (no puede modificar asistencia)
 * - Usuarios sin rol
 */

export interface ResultadoPermiso {
  autorizado: boolean;
  razon?: string;
  acciones?: {
    escanearQR: boolean;
    cerrarClase: boolean;
    marcarObservaciones: boolean;
    marcarCheckpoints: boolean;
  };
}

/**
 * Valida si un usuario puede ACCEDER a Clase en Vivo para una jornada.
 */
export function puedeAccederClaseEnVivo(usuario: Usuario | null, jornada: JornadaInstruccion): ResultadoPermiso {
  if (!usuario) {
    return {
      autorizado: false,
      razon: 'Usuario no autenticado',
    };
  }

  // Admin o SuperAdmin pueden operar cualquier clase de su tenant.
  if (usuario.rol === RolUsuario.Admin || usuario.rol === RolUsuario.SuperAdmin) {
    if (usuario.tenantId === jornada.tenantId) {
      return {
        autorizado: true,
        acciones: {
          escanearQR: true,
          cerrarClase: true,
          marcarObservaciones: true,
          marcarCheckpoints: true,
        },
      };
    }
    return {
      autorizado: false,
      razon: 'Esta clase pertenece a otro tenant',
    };
  }

  // Maestro puede operar solo las clases que imparte.
  if (usuario.rol === RolUsuario.Maestro) {
    if (usuario.tenantId === jornada.tenantId && usuario.id === jornada.instructorId) {
      return {
        autorizado: true,
        acciones: {
          escanearQR: true,
          cerrarClase: true,
          marcarObservaciones: true,
          marcarCheckpoints: true,
        },
      };
    }
    return {
      autorizado: false,
      razon: 'No eres el maestro asignado a esta clase',
    };
  }

  // Editor (secretaria) puede operar clases de su tenant (acceso administrativo).
  if (usuario.rol === RolUsuario.Editor) {
    if (usuario.tenantId === jornada.tenantId) {
      return {
        autorizado: true,
        acciones: {
          escanearQR: true,
          cerrarClase: true,
          marcarObservaciones: true,
          marcarCheckpoints: true,
        },
      };
    }
    return {
      autorizado: false,
      razon: 'Esta clase pertenece a otro tenant',
    };
  }

  // Asistente: por ahora, no autorizado. En futuro, verificar si está habilitado como instructor.
  if (usuario.rol === RolUsuario.Asistente) {
    return {
      autorizado: false,
      razon: 'Los asistentes aún no están habilitados para operar Clase en Vivo',
    };
  }

  // Estudiante: NO puede operar.
  if (usuario.rol === RolUsuario.Estudiante) {
    return {
      autorizado: false,
      razon: 'Los estudiantes no pueden operar Clase en Vivo',
    };
  }

  // Tutor: NO puede operar.
  if (usuario.rol === RolUsuario.Tutor) {
    return {
      autorizado: false,
      razon: 'Los tutores/padres no pueden modificar la asistencia',
    };
  }

  return {
    autorizado: false,
    razon: 'Rol no reconocido',
  };
}

/**
 * Valida si un usuario puede ESCANEAR QR (registrar asistencia).
 */
export function puedeEscanearQR(usuario: Usuario | null, jornada: JornadaInstruccion): boolean {
  const resultado = puedeAccederClaseEnVivo(usuario, jornada);
  return resultado.autorizado && (resultado.acciones?.escanearQR ?? false);
}

/**
 * Valida si un usuario puede CERRAR LA CLASE.
 */
export function puedeCerrarClase(usuario: Usuario | null, jornada: JornadaInstruccion): boolean {
  const resultado = puedeAccederClaseEnVivo(usuario, jornada);
  return resultado.autorizado && (resultado.acciones?.cerrarClase ?? false);
}

/**
 * Valida si un usuario puede MARCAR CHECKPOINTS DE MATERIALES.
 */
export function puedeMarcarCheckpoints(usuario: Usuario | null, jornada: JornadaInstruccion): boolean {
  const resultado = puedeAccederClaseEnVivo(usuario, jornada);
  return resultado.autorizado && (resultado.acciones?.marcarCheckpoints ?? false);
}

/**
 * Valida si un usuario puede MARCAR OBSERVACIONES GRUPALES.
 */
export function puedeMarcarObservaciones(usuario: Usuario | null, jornada: JornadaInstruccion): boolean {
  const resultado = puedeAccederClaseEnVivo(usuario, jornada);
  return resultado.autorizado && (resultado.acciones?.marcarObservaciones ?? false);
}

/**
 * Construye un registro de auditoría con quién realizó la acción.
 */
export interface RegistroAuditoria {
  usuarioId: string;
  nombreUsuario: string;
  rol: RolUsuario;
  accion: 'escaneo_qr' | 'cierre_clase' | 'marcar_checkpoint' | 'marcar_observacion';
  timestamp: string;
  detalles?: Record<string, unknown>;
}

export function construirRegistroAuditoria(
  usuario: Usuario,
  accion: RegistroAuditoria['accion'],
  detalles?: Record<string, unknown>
): RegistroAuditoria {
  return {
    usuarioId: usuario.id,
    nombreUsuario: usuario.nombreUsuario || usuario.email,
    rol: usuario.rol,
    accion,
    timestamp: new Date().toISOString(),
    detalles,
  };
}
