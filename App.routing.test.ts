import { construirUrlCallbackDrive, obtenerCodigoCallbackDrive, obtenerRutaInicioUsuario } from './App';
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

describe('callback OAuth de Drive', () => {
  it('redirige callbacks con code hacia Centro de Estudios aunque el usuario venga de configuración', () => {
    expect(
      construirUrlCallbackDrive(
        '/',
        '?code=oauth-code-123&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file',
        '',
        '/centro-estudios',
      )
    ).toBe('/#/centro-estudios?code=oauth-code-123&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file');
  });

  it('redirige callbacks si Google devuelve el code dentro del hash de configuración', () => {
    expect(
      construirUrlCallbackDrive(
        '/',
        '',
        '#/configuracion?code=oauth-code-456&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file',
        '/centro-estudios',
      )
    ).toBe('/#/centro-estudios?code=oauth-code-456&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file');
  });

  it('no modifica URLs que no sean callback OAuth', () => {
    expect(construirUrlCallbackDrive('/', '?foo=bar', '', '/centro-estudios')).toBeNull();
  });

  it('extrae el code desde search o hash', () => {
    expect(obtenerCodigoCallbackDrive('?code=search-code', '')).toBe('search-code');
    expect(obtenerCodigoCallbackDrive('', '#/configuracion?code=hash-code')).toBe('hash-code');
  });
});
