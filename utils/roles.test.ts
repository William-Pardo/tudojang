// utils/roles.test.ts
// Regla canonica de roles (usuario, 2026-07-09, ver CIERRE CENTRO DE ESTUDIOS.md 14.9):
//   - Tutor  = padre/acudiente. NUNCA un instructor ni un rol de Equipo Tecnico.
//   - Maestro = rol de quien ensena y asigna clases.
//   - El alias historico Tutor->"Maestro" (contexto equipoTecnico) era la raiz del bug
//     "solo veo 1 de 3 maestros": el formulario guardaba rol Tutor etiquetado "Maestro".
import { RolUsuario } from '../tipos';
import { obtenerEtiquetaRol, obtenerDescripcionRolEquipoTecnico } from './roles';

describe('obtenerEtiquetaRol', () => {
  it('etiqueta a Maestro como "Maestro" en todos los contextos', () => {
    expect(obtenerEtiquetaRol(RolUsuario.Maestro, 'equipoTecnico')).toBe('Maestro');
    expect(obtenerEtiquetaRol(RolUsuario.Maestro, 'academico')).toBe('Maestro');
    expect(obtenerEtiquetaRol(RolUsuario.Maestro)).toBe('Maestro');
  });

  it('ya NO etiqueta a Tutor como "Maestro" en contexto equipoTecnico (regla canonica: Tutor = padre)', () => {
    expect(obtenerEtiquetaRol(RolUsuario.Tutor, 'equipoTecnico')).not.toBe('Maestro');
  });

  it('etiqueta a Tutor como "Tutor / Acudiente" en todos los contextos', () => {
    expect(obtenerEtiquetaRol(RolUsuario.Tutor, 'equipoTecnico')).toBe('Tutor / Acudiente');
    expect(obtenerEtiquetaRol(RolUsuario.Tutor, 'general')).toBe('Tutor / Acudiente');
  });

  it('mantiene el passthrough para el resto de roles y valores vacios', () => {
    expect(obtenerEtiquetaRol(RolUsuario.Editor, 'equipoTecnico')).toBe('Editor');
    expect(obtenerEtiquetaRol(null)).toBe('');
    expect(obtenerEtiquetaRol(undefined)).toBe('');
  });
});

describe('obtenerDescripcionRolEquipoTecnico', () => {
  it('describe a Maestro con la gestion tecnica/clases (texto que antes estaba mal asignado a Tutor)', () => {
    expect(obtenerDescripcionRolEquipoTecnico(RolUsuario.Maestro)).toMatch(/Maestro: gestion tecnica, asistencia, clases/i);
  });

  it('describe a Tutor como padre/acudiente, no como Maestro', () => {
    const descripcion = obtenerDescripcionRolEquipoTecnico(RolUsuario.Tutor);
    expect(descripcion).toMatch(/acudiente/i);
    expect(descripcion).not.toMatch(/Maestro:/);
  });
});
