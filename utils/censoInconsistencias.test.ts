import { detectarInconsistencias } from './censoInconsistencias';
import type { RegistroTemporal, Estudiante } from '../tipos';
import { GradoTKD, GrupoEdad, EstadoPago } from '../tipos';

const registro = (
  datos: Partial<RegistroTemporal['datos']> = {},
  id = 'reg1'
): RegistroTemporal => ({
  id,
  tenantId: 't1',
  misionId: 'm1',
  fechaRegistro: '2026-08-20T00:00:00.000Z',
  estado: 'pendiente',
  datos: {
    nombres: 'Juan',
    apellidos: 'Perez',
    email: 'juan@correo.com',
    telefono: '3001234567',
    fechaNacimiento: '1990-05-15',
    ...datos,
  },
});

const estudiante = (overrides: Partial<Estudiante> = {}): Estudiante => ({
  id: 'est1',
  tenantId: 't1',
  nombres: 'Otro',
  apellidos: 'Existente',
  numeroIdentificacion: '123',
  fechaNacimiento: '1990-01-01',
  grado: GradoTKD.Blanco,
  grupo: GrupoEdad.Adultos,
  horasAcumuladasGrado: 0,
  sedeId: 's1',
  telefono: '3009999999',
  correo: 'otro@correo.com',
  fechaIngreso: '2020-01-01',
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

describe('detectarInconsistencias', () => {
  it('no reporta alertas para un registro de adulto completo y bien formado', () => {
    expect(detectarInconsistencias(registro(), [], [])).toEqual([]);
  });

  it('no reporta alertas para otro registro válido distinto (triangulación)', () => {
    const otro = registro({
      email: 'maria.gomez@academia.co',
      telefono: '3159876543',
      fechaNacimiento: '1985-11-02',
    }, 'reg2');
    expect(detectarInconsistencias(otro, [], [])).toEqual([]);
  });

  describe('teléfono del aspirante', () => {
    it('marca un teléfono con menos de 10 dígitos', () => {
      const r = registro({ telefono: '12345' });
      expect(detectarInconsistencias(r, [], [])).toContain('Teléfono del aspirante no tiene 10 dígitos');
    });

    it('marca un teléfono con más de 10 dígitos', () => {
      const r = registro({ telefono: '300123456789' });
      expect(detectarInconsistencias(r, [], [])).toContain('Teléfono del aspirante no tiene 10 dígitos');
    });

    it('no marca un teléfono de 10 dígitos aunque tenga guiones/espacios', () => {
      const r = registro({ telefono: '300-123-4567' });
      expect(detectarInconsistencias(r, [], [])).not.toContain('Teléfono del aspirante no tiene 10 dígitos');
    });
  });

  describe('email del aspirante', () => {
    it('marca un email sin arroba', () => {
      const r = registro({ email: 'noesunemail' });
      expect(detectarInconsistencias(r, [], [])).toContain('Email con formato inválido');
    });

    it('marca un email sin dominio con punto', () => {
      const r = registro({ email: 'falta@dominio' });
      expect(detectarInconsistencias(r, [], [])).toContain('Email con formato inválido');
    });

    it('no marca un email válido', () => {
      const r = registro({ email: 'valido@academia.com' });
      expect(detectarInconsistencias(r, [], [])).not.toContain('Email con formato inválido');
    });
  });

  describe('fecha de nacimiento', () => {
    it('marca una fecha no parseable', () => {
      const r = registro({ fechaNacimiento: 'no-es-fecha' });
      expect(detectarInconsistencias(r, [], [])).toContain('Fecha de nacimiento inválida');
    });

    it('marca una fecha futura', () => {
      const futura = new Date();
      futura.setFullYear(futura.getFullYear() + 1);
      const r = registro({ fechaNacimiento: futura.toISOString().slice(0, 10) });
      expect(detectarInconsistencias(r, [], [])).toContain('Fecha de nacimiento inválida');
    });

    it('marca una edad mayor a 100 años', () => {
      const r = registro({ fechaNacimiento: '1900-01-01' });
      expect(detectarInconsistencias(r, [], [])).toContain('Fecha de nacimiento inválida');
    });
  });

  describe('menor de edad sin tutor', () => {
    it('marca un menor sin datos de tutor', () => {
      const haceDiezAnios = new Date();
      haceDiezAnios.setFullYear(haceDiezAnios.getFullYear() - 10);
      const r = registro({ fechaNacimiento: haceDiezAnios.toISOString().slice(0, 10), tutorNombre: undefined });
      expect(detectarInconsistencias(r, [], [])).toContain('Menor de edad sin datos de tutor');
    });

    it('no marca un menor que sí tiene tutor cargado', () => {
      const haceDiezAnios = new Date();
      haceDiezAnios.setFullYear(haceDiezAnios.getFullYear() - 10);
      const r = registro({ fechaNacimiento: haceDiezAnios.toISOString().slice(0, 10), tutorNombre: 'Maria' });
      expect(detectarInconsistencias(r, [], [])).not.toContain('Menor de edad sin datos de tutor');
    });

    it('no marca a un adulto sin tutor (no le hace falta)', () => {
      const r = registro({ fechaNacimiento: '1990-01-01', tutorNombre: undefined });
      expect(detectarInconsistencias(r, [], [])).not.toContain('Menor de edad sin datos de tutor');
    });
  });

  describe('teléfono del tutor', () => {
    it('marca un teléfono de tutor con menos de 10 dígitos', () => {
      const r = registro({ tutorNombre: 'Maria', tutorTelefono: '123' });
      expect(detectarInconsistencias(r, [], [])).toContain('Teléfono del tutor no tiene 10 dígitos');
    });

    it('no marca nada si no hay teléfono de tutor (no aplica)', () => {
      const r = registro({ tutorTelefono: undefined });
      expect(detectarInconsistencias(r, [], [])).not.toContain('Teléfono del tutor no tiene 10 dígitos');
    });
  });

  describe('duplicados dentro del mismo lote', () => {
    it('marca dos registros con el mismo teléfono', () => {
      const a = registro({ telefono: '3001112222' }, 'reg-a');
      const b = registro({ telefono: '3001112222', email: 'otro@correo.com' }, 'reg-b');
      const lote = [a, b];
      expect(detectarInconsistencias(a, lote, [])).toContain('Posible duplicado: otro registro pendiente tiene el mismo teléfono o email');
      expect(detectarInconsistencias(b, lote, [])).toContain('Posible duplicado: otro registro pendiente tiene el mismo teléfono o email');
    });

    it('marca dos registros con el mismo email aunque el teléfono difiera', () => {
      const a = registro({ telefono: '3001112222', email: 'dup@correo.com' }, 'reg-a');
      const b = registro({ telefono: '3003334444', email: 'dup@correo.com' }, 'reg-b');
      expect(detectarInconsistencias(a, [a, b], [])).toContain('Posible duplicado: otro registro pendiente tiene el mismo teléfono o email');
    });

    it('no marca duplicado si todos los registros del lote son distintos', () => {
      const a = registro({ telefono: '3001112222', email: 'a@correo.com' }, 'reg-a');
      const b = registro({ telefono: '3003334444', email: 'b@correo.com' }, 'reg-b');
      expect(detectarInconsistencias(a, [a, b], [])).not.toContain('Posible duplicado: otro registro pendiente tiene el mismo teléfono o email');
    });
  });

  describe('duplicados contra estudiantes existentes', () => {
    it('marca coincidencia por teléfono con un estudiante ya inscrito', () => {
      const r = registro({ telefono: '3009999999' });
      const est = estudiante({ telefono: '3009999999' });
      expect(detectarInconsistencias(r, [], [est])).toContain('Posible duplicado: ya existe un estudiante con este teléfono o email');
    });

    it('marca coincidencia por email con un estudiante ya inscrito', () => {
      const r = registro({ email: 'existente@academia.com' });
      const est = estudiante({ correo: 'existente@academia.com' });
      expect(detectarInconsistencias(r, [], [est])).toContain('Posible duplicado: ya existe un estudiante con este teléfono o email');
    });

    it('no marca nada si no coincide con ningún estudiante existente', () => {
      const r = registro();
      const est = estudiante();
      expect(detectarInconsistencias(r, [], [est])).not.toContain('Posible duplicado: ya existe un estudiante con este teléfono o email');
    });
  });
});
