import { mapearErrorAcademico } from './erroresAcademicos';

describe('mapearErrorAcademico', () => {
  it('mapea FirebaseError Missing or insufficient permissions a español', () => {
    const error = new Error('Missing or insufficient permissions.');
    expect(mapearErrorAcademico(error)).toBe(
      'Permisos insuficientes para realizar esta acción. Verifica los permisos de tu cuenta.'
    );
  });

  it('mapea objeto con code permission-denied a español', () => {
    const error = { code: 'permission-denied', message: 'The caller does not have permission' };
    expect(mapearErrorAcademico(error)).toBe(
      'Permisos insuficientes para realizar esta acción. Verifica los permisos de tu cuenta.'
    );
  });

  it('mapea unauthenticated a mensaje de sesión expirada', () => {
    const error = { code: 'unauthenticated', message: 'Request is missing auth credentials' };
    expect(mapearErrorAcademico(error)).toBe(
      'Tu sesión ha expirado. Vuelve a iniciar sesión e intenta de nuevo.'
    );
  });

  it('mapea errores de red a mensaje de conexión', () => {
    const error = new Error('Failed to fetch from network');
    expect(mapearErrorAcademico(error)).toBe(
      'Error de conexión. Verifica tu conexión a internet e intenta de nuevo.'
    );
  });

  it('preserva mensajes ya en español', () => {
    const error = new Error('El título visible del recurso es obligatorio.');
    expect(mapearErrorAcademico(error)).toBe('El título visible del recurso es obligatorio.');
  });

  it('retorna fallback cuando el error es nulo o vacío', () => {
    expect(mapearErrorAcademico(null, 'Error por defecto')).toBe('Error por defecto');
  });
});
