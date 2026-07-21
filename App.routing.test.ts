import { obtenerRutaInicioUsuario, extraerCallbackDrive, mensajeErrorCallbackDrive } from './App';
import { RolUsuario } from './tipos';

describe('rutas academicas por rol', () => {
  it('envia Estudiante y Tutor al Centro de Estudios como inicio operativo', () => {
    expect(obtenerRutaInicioUsuario({ rol: RolUsuario.Estudiante })).toBe('/centro-estudios');
    expect(obtenerRutaInicioUsuario({ rol: RolUsuario.Tutor })).toBe('/centro-estudios');
  });

  it('mantiene Admin y Editor en el inicio administrativo', () => {
    expect(obtenerRutaInicioUsuario({ rol: RolUsuario.Admin })).toBe('/');
    expect(obtenerRutaInicioUsuario({ rol: RolUsuario.Editor })).toBe('/');
  });
});

// Regresión 2026-07-21: el manejo del callback OAuth de Drive se había perdido sin commitear
// entre sesiones concurrentes (ver docs/DEBUG_DRIVE_OAUTH_CENTRO_ESTUDIOS.md). Estos tests
// blindan la extracción de parámetros que es el corazón del fix — antes NADIE procesaba la
// vuelta de Google y la conexión de Drive quedaba en silencio.
describe('extraerCallbackDrive', () => {
  it('lee code y state del query string real (redirect a la raíz de la app)', () => {
    const resultado = extraerCallbackDrive(
      '?state=escuela-gajog-001&code=4/abc123&scope=drive.readonly',
      '',
    );
    expect(resultado).toEqual({ code: '4/abc123', error: null, state: 'escuela-gajog-001' });
  });

  it('lee code y state de un query embebido en el hash', () => {
    const resultado = extraerCallbackDrive(
      '',
      '#/centro-estudios?state=tenant-xyz&code=4/hashcode',
    );
    expect(resultado).toEqual({ code: '4/hashcode', error: null, state: 'tenant-xyz' });
  });

  it('captura el rechazo de consentimiento (error=access_denied) conservando el state', () => {
    const resultado = extraerCallbackDrive('?state=tenant-1&error=access_denied', '');
    expect(resultado).toEqual({ code: null, error: 'access_denied', state: 'tenant-1' });
  });

  it('devuelve null cuando no hay callback de Drive (navegación normal)', () => {
    expect(extraerCallbackDrive('', '#/centro-estudios')).toBeNull();
    expect(extraerCallbackDrive('?foo=bar', '')).toBeNull();
  });

  it('devuelve null si viene code pero falta el state (no sabríamos el tenant)', () => {
    expect(extraerCallbackDrive('?code=4/sinstate', '')).toBeNull();
  });
});

describe('mensajeErrorCallbackDrive', () => {
  it('da un mensaje accionable cuando el usuario niega el permiso', () => {
    expect(mensajeErrorCallbackDrive('access_denied')).toMatch(/No autorizaste/i);
  });

  it('da un mensaje genérico para cualquier otro error de Google', () => {
    expect(mensajeErrorCallbackDrive('server_error')).toMatch(/no completó la autorización/i);
    expect(mensajeErrorCallbackDrive(null)).toMatch(/no completó la autorización/i);
  });
});
