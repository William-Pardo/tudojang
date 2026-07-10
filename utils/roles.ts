import { RolUsuario } from '../tipos';

export type ContextoEtiquetaRol = 'equipoTecnico' | 'academico' | 'general';

// Regla canonica de roles (2026-07-09, CIERRE CENTRO DE ESTUDIOS.md 14.9):
// Tutor = padre/acudiente, Maestro = quien ensena y asigna clases. El alias
// historico Tutor->"Maestro" (solo en contexto equipoTecnico) fue la raiz del
// bug "solo veo 1 de 3 maestros": el formulario de Equipo Tecnico guardaba
// rol 'Tutor' bajo la etiqueta "Maestro". Queda eliminado a proposito.
export const obtenerEtiquetaRol = (
  rol?: RolUsuario | string | null,
  // El contexto se conserva por compatibilidad de firma, pero ya no cambia la
  // etiqueta: un rol se llama igual en toda la app.
  _contexto: ContextoEtiquetaRol = 'general',
): string => {
  if (!rol) return '';

  if (rol === RolUsuario.Tutor) {
    return 'Tutor / Acudiente';
  }

  return String(rol);
};

export const obtenerDescripcionRolEquipoTecnico = (rol: RolUsuario): string => {
  const descripciones: Record<RolUsuario, string> = {
    [RolUsuario.Admin]: 'Acceso total: Finanzas, Configuracion y Personal.',
    [RolUsuario.Editor]: 'Secretaria: Gestion de alumnos, tienda, eventos y cobros.',
    [RolUsuario.Asistente]: 'Apoyo en sede: registro de asistencias y consulta de alumnos.',
    [RolUsuario.Maestro]: 'Maestro: gestion tecnica, asistencia, clases y seguimiento operativo.',
    [RolUsuario.Tutor]: 'Tutor / Acudiente: padre o acudiente con seguimiento academico del estudiante. No es un rol de Equipo Tecnico.',
    [RolUsuario.Estudiante]: 'Estudiante: acceso academico limitado al Centro de Estudios.',
    [RolUsuario.SuperAdmin]: 'SuperAdmin: administracion global de la plataforma.',
  };

  return descripciones[rol] ?? String(rol);
};
