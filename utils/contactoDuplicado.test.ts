import { detectarContactoDuplicado } from './contactoDuplicado';
import type { Estudiante } from '../tipos';
import { GradoTKD, GrupoEdad, EstadoPago } from '../tipos';

const estudiante = (overrides: Partial<Estudiante> = {}): Estudiante => ({
  id: 'est-1',
  tenantId: 't1',
  nombres: 'Ana',
  apellidos: 'García',
  numeroIdentificacion: '111',
  fechaNacimiento: '2012-01-01',
  grado: GradoTKD.Blanco,
  grupo: GrupoEdad.Precadetes,
  horasAcumuladasGrado: 0,
  sedeId: 's1',
  telefono: '3001112222',
  correo: 'ana@correo.com',
  fechaIngreso: '2024-01-01',
  estadoPago: EstadoPago.AlDia,
  saldoDeudor: 0,
  historialPagos: [],
  consentimientoInformado: true,
  contratoServiciosFirmado: true,
  consentimientoImagenFirmado: true,
  consentimientoFotosVideos: true,
  carnetGenerado: false,
  estadoMatricula: 'activo',
  ...overrides,
});

describe('detectarContactoDuplicado', () => {
  it('no marca nada si el estudiante es el único con sus datos de contacto', () => {
    const ana = estudiante();
    expect(detectarContactoDuplicado(ana, [ana])).toEqual([]);
  });

  it('no marca nada frente a otro estudiante con contacto totalmente distinto (triangulación)', () => {
    const ana = estudiante();
    const bruno = estudiante({ id: 'est-2', nombres: 'Bruno', apellidos: 'Ruiz', telefono: '3009998888', correo: 'bruno@correo.com' });
    expect(detectarContactoDuplicado(ana, [ana, bruno])).toEqual([]);
  });

  it('marca coincidencia de teléfono con el nombre del otro estudiante -- caso real: hermanos con el WhatsApp del tutor', () => {
    const ana = estudiante({ id: 'est-1', nombres: 'Ana', apellidos: 'García', telefono: '3001112222' });
    const hermano = estudiante({ id: 'est-2', nombres: 'Bruno', apellidos: 'García', telefono: '3001112222', correo: 'otro@correo.com' });
    const alertas = detectarContactoDuplicado(ana, [ana, hermano]);
    expect(alertas).toContainEqual({ campo: 'telefono', mensaje: 'Mismo teléfono que: Bruno García' });
  });

  it('reconoce el mismo teléfono aunque venga con guiones/espacios (normaliza a dígitos)', () => {
    const ana = estudiante({ id: 'est-1', telefono: '300-111-2222' });
    const hermano = estudiante({ id: 'est-2', nombres: 'Bruno', apellidos: 'García', telefono: '3001112222', correo: 'otro@correo.com' });
    const alertas = detectarContactoDuplicado(ana, [ana, hermano]);
    expect(alertas).toContainEqual({ campo: 'telefono', mensaje: 'Mismo teléfono que: Bruno García' });
  });

  it('marca coincidencia de correo con el nombre del otro estudiante -- caso real: tutor que también es alumno', () => {
    const papaAlumno = estudiante({ id: 'est-1', nombres: 'Carlos', apellidos: 'Pardo', correo: 'carlos@correo.com', telefono: '3005551111' });
    const hijo = estudiante({ id: 'est-2', nombres: 'Mateo', apellidos: 'Pardo', correo: 'carlos@correo.com', telefono: '3009996666' });
    const alertas = detectarContactoDuplicado(hijo, [papaAlumno, hijo]);
    expect(alertas).toContainEqual({ campo: 'correo', mensaje: 'Mismo correo que: Carlos Pardo' });
  });

  it('el correo se compara sin distinguir mayúsculas/espacios', () => {
    const ana = estudiante({ id: 'est-1', correo: '  Ana@Correo.com  ' });
    const otra = estudiante({ id: 'est-2', nombres: 'Otra', apellidos: 'Persona', correo: 'ana@correo.com', telefono: '3007778888' });
    const alertas = detectarContactoDuplicado(ana, [ana, otra]);
    expect(alertas).toContainEqual({ campo: 'correo', mensaje: 'Mismo correo que: Otra Persona' });
  });

  it('lista los nombres de TODOS los que coinciden, no solo el primero (triangulación)', () => {
    const ana = estudiante({ id: 'est-1', telefono: '3001112222' });
    const hermano1 = estudiante({ id: 'est-2', nombres: 'Bruno', apellidos: 'García', telefono: '3001112222', correo: 'b@correo.com' });
    const hermano2 = estudiante({ id: 'est-3', nombres: 'Carla', apellidos: 'García', telefono: '3001112222', correo: 'c@correo.com' });
    const alertas = detectarContactoDuplicado(ana, [ana, hermano1, hermano2]);
    expect(alertas).toContainEqual({ campo: 'telefono', mensaje: 'Mismo teléfono que: Bruno García, Carla García' });
  });

  it('puede marcar teléfono Y correo a la vez si ambos coinciden con estudiantes distintos', () => {
    const ana = estudiante({ id: 'est-1', telefono: '3001112222', correo: 'ana@correo.com' });
    const porTelefono = estudiante({ id: 'est-2', nombres: 'Bruno', apellidos: 'García', telefono: '3001112222', correo: 'bruno@correo.com' });
    const porCorreo = estudiante({ id: 'est-3', nombres: 'Carla', apellidos: 'Ruiz', telefono: '3004445555', correo: 'ana@correo.com' });
    const alertas = detectarContactoDuplicado(ana, [ana, porTelefono, porCorreo]);
    expect(alertas).toEqual(expect.arrayContaining([
      { campo: 'telefono', mensaje: 'Mismo teléfono que: Bruno García' },
      { campo: 'correo', mensaje: 'Mismo correo que: Carla Ruiz' },
    ]));
    expect(alertas).toHaveLength(2);
  });
});
