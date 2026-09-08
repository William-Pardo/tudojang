import { obtenerRutaInicioUsuario, extraerCallbackDrive, mensajeErrorCallbackDrive } from './App';
import { RolUsuario } from './tipos';
import { HIJOS_POR_ID_ENLACE, obtenerHijosDeEnlace } from './components/navegacion/menuMobileHijos';
import { resolverTabInicial } from './utils/navegacion/resolverTabInicial';

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

// Menú mobile acordeon unificado (plan aprobado): estos tests blindan la lógica pura y
// testeable que introdujo esa feature -- resolverTabInicial (valida `?tab=` de deep-link
// contra ids conocidos) y HIJOS_POR_ID_ENLACE (arma qué ids de navegación tienen hijos según
// rol/condiciones, espejando las 4 vistas con tabs internas). Ninguna renderiza JSX, así que
// no hace falta montar BarraLateral ni las vistas reales para cubrirla.
describe('resolverTabInicial', () => {
  const idsValidos = ['resumen', 'tesoreria', 'analisis'] as const;

  it('usa el valor del query param cuando es uno de los ids conocidos', () => {
    expect(resolverTabInicial(idsValidos, 'tesoreria', 'resumen')).toBe('tesoreria');
  });

  it('cae al fallback cuando el query param es un id desconocido', () => {
    expect(resolverTabInicial(idsValidos, 'inexistente', 'resumen')).toBe('resumen');
  });

  it('cae al fallback cuando el query param está ausente (null)', () => {
    expect(resolverTabInicial(idsValidos, null, 'resumen')).toBe('resumen');
  });

  it('cae al fallback cuando el query param es un string vacío', () => {
    expect(resolverTabInicial(idsValidos, '', 'resumen')).toBe('resumen');
  });
});

describe('HIJOS_POR_ID_ENLACE (menú mobile acordeon)', () => {
  it('Administracion expone las 6 pestañas reales sin condición de rol/config', () => {
    const hijos = HIJOS_POR_ID_ENLACE.administracion({ usuario: { rol: RolUsuario.Asistente } });
    expect(hijos.map((h) => h.id)).toEqual(['resumen', 'tesoreria', 'validar', 'historial', 'horarios', 'analisis']);
  });

  it('Estudiantes: Admin ve las 5 pestañas (sin demo comercial)', () => {
    const hijos = HIJOS_POR_ID_ENLACE.estudiantes({ usuario: { rol: RolUsuario.Admin }, configClub: { esDemoComercial: false } });
    expect(hijos.map((h) => h.id)).toEqual(['kicho', 'directorio', 'asistencia', 'certificados', 'carnets']);
  });

  it('Estudiantes: Asistente no ve Misión KICHO ni Carnetización', () => {
    const hijos = HIJOS_POR_ID_ENLACE.estudiantes({ usuario: { rol: RolUsuario.Asistente } });
    expect(hijos.map((h) => h.id)).toEqual(['directorio', 'asistencia', 'certificados']);
  });

  it('Estudiantes: Tutor solo ve Control de Asistencia (esTutor oculta el resto)', () => {
    const hijos = HIJOS_POR_ID_ENLACE.estudiantes({ usuario: { rol: RolUsuario.Tutor } });
    expect(hijos.map((h) => h.id)).toEqual(['asistencia']);
  });

  it('Estudiantes: esDemoComercial oculta Carnetización aunque el rol sea Admin', () => {
    const hijos = HIJOS_POR_ID_ENLACE.estudiantes({ usuario: { rol: RolUsuario.Admin }, configClub: { esDemoComercial: true } });
    expect(hijos.map((h) => h.id)).not.toContain('carnets');
  });

  it('CentroEstudios: Admin/Editor/SuperAdmin ven Flujo Académico + Progreso Estudiantes', () => {
    for (const rol of [RolUsuario.Admin, RolUsuario.Editor, RolUsuario.SuperAdmin]) {
      const hijos = HIJOS_POR_ID_ENLACE.centroEstudios({ usuario: { rol } });
      expect(hijos.map((h) => h.id)).toEqual(['flujo', 'metricas']);
    }
  });

  it('CentroEstudios: Tutor/Estudiante no tienen hijos -- el parent debe renderizarse como leaf', () => {
    expect(HIJOS_POR_ID_ENLACE.centroEstudios({ usuario: { rol: RolUsuario.Tutor } })).toEqual([]);
    expect(HIJOS_POR_ID_ENLACE.centroEstudios({ usuario: { rol: RolUsuario.Estudiante } })).toEqual([]);
  });

  it('Configuracion: expone las 7 pestañas reales cuando no es demo comercial', () => {
    const hijos = HIJOS_POR_ID_ENLACE.configuracion({ usuario: { rol: RolUsuario.Admin }, configClub: { esDemoComercial: false } });
    expect(hijos.map((h) => h.id)).toEqual(['branding', 'equipo', 'accesos', 'sedes', 'programas', 'alertas', 'licencia']);
  });

  it('Configuracion: esDemoComercial oculta Programas Extra', () => {
    const hijos = HIJOS_POR_ID_ENLACE.configuracion({ usuario: { rol: RolUsuario.Admin }, configClub: { esDemoComercial: true } });
    expect(hijos.map((h) => h.id)).not.toContain('programas');
  });

  it('obtenerHijosDeEnlace devuelve [] para un idEnlace sin tabs internas (leaf plano)', () => {
    expect(obtenerHijosDeEnlace('agenda', { usuario: { rol: RolUsuario.Maestro } })).toEqual([]);
    expect(obtenerHijosDeEnlace('id-inexistente', { usuario: { rol: RolUsuario.Admin } })).toEqual([]);
  });
});
