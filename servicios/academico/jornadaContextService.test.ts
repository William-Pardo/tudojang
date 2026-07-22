import { RolUsuario } from '../../tipos';
import type { EspacioFisico } from '../../models/academico/espacio';
import { obtenerContextoJornada } from './jornadaContextService';

function crearEspacio(overrides: Partial<EspacioFisico> = {}): EspacioFisico {
  const ahora = '2026-07-01T00:00:00.000Z';
  return {
    id: 'espacio-1',
    tenantId: 'tenant-1',
    sedeId: 'sede-1',
    nombre: 'Tatami principal',
    capacidad: 30,
    disciplinasPermitidas: ['taekwondo'],
    activo: true,
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}

// Deps minimas para aislar la logica de espacios (Parte 3) sin depender de las demas fuentes.
function depsBase() {
  return {
    obtenerProgramas: jest.fn().mockResolvedValue([]),
    obtenerSedes: jest.fn().mockResolvedValue([]),
    obtenerUsuarios: jest.fn().mockResolvedValue([]),
    obtenerConfiguracionClub: jest.fn().mockResolvedValue({
      tenantId: 'tenant-1',
      nombreClub: 'Club',
      direccionClub: 'Calle',
    }),
  };
}

describe('jornadaContextService', () => {
  it('construye opciones reales por tenant desde programas, sedes e instructores activos', async () => {
    const contexto = await obtenerContextoJornada('tenant-1', {
      // Fix 2026-07-16: obtenerProgramas ahora lee ProgramaAcademico (tenants/{tenantId}/
      // programasAcademicos), no el `Programa` legacy de la raiz -- el campo real de
      // estado es `estado: 'publicado'`, no `.activo` (que nunca existio en este tipo).
      obtenerProgramas: jest.fn().mockResolvedValue([
        {
          id: 'programa-1',
          tenantId: 'tenant-1',
          nombre: 'Programa base',
          descripcion: 'Base',
          version: 1,
          estado: 'publicado',
          unidades: [],
          creadoEn: '2026-07-01T00:00:00.000Z',
          actualizadoEn: '2026-07-01T00:00:00.000Z',
        },
        {
          id: 'programa-borrador',
          tenantId: 'tenant-1',
          nombre: 'Todavia no publicado',
          descripcion: 'No deberia aparecer',
          version: 1,
          estado: 'borrador',
          unidades: [],
          creadoEn: '2026-07-01T00:00:00.000Z',
          actualizadoEn: '2026-07-01T00:00:00.000Z',
        },
        {
          id: 'programa-otro-tenant',
          tenantId: 'tenant-2',
          nombre: 'Otro tenant',
          descripcion: 'No visible',
          version: 1,
          estado: 'publicado',
          unidades: [],
          creadoEn: '2026-07-01T00:00:00.000Z',
          actualizadoEn: '2026-07-01T00:00:00.000Z',
        },
      ]),
      obtenerSedes: jest.fn().mockResolvedValue([
        {
          id: 'sede-real',
          tenantId: 'tenant-1',
          nombre: 'Cocodrilos',
          direccion: 'Calle 1',
          ciudad: 'Bogota',
          telefono: '300',
        },
      ]),
      obtenerConfiguracionClub: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        nombreClub: 'Cocodrilos principal',
        direccionClub: 'Calle principal',
      }),
      // Subtarea 12.7 (Parte 3): los espacios ya no son el hardcode `tatami-1`, se leen del
      // repositorio real por tenant. Aca se inyecta un espacio real del tenant-1.
      listarEspaciosPorTenant: jest.fn().mockResolvedValue([
        crearEspacio({ id: 'tatami-real', nombre: 'Tatami real', tenantId: 'tenant-1' }),
      ]),
      obtenerUsuarios: jest.fn().mockResolvedValue([
        {
          id: 'instructor-real',
          tenantId: 'tenant-1',
          nombreUsuario: 'Alonzo Jimenez',
          email: 'alonzo@test.com',
          numeroIdentificacion: '1',
          whatsapp: '300',
          rol: RolUsuario.Editor,
        },
        // Regla canonica de roles (usuario, 2026-07-09 — CIERRE 14.9): Tutor = padre/
        // acudiente y NUNCA instructor. Este caso ("sabonim-real"/Israel con rol Tutor)
        // antes esperaba a Israel DENTRO de instructores (14.6, hoy SUPERSEDED): esa
        // expectativa venia del mislabel del formulario (<option value=Tutor>Maestro</option>),
        // no del dominio. El rol docente real es Maestro.
        {
          id: 'sabonim-real',
          tenantId: 'tenant-1',
          nombreUsuario: 'Israel',
          email: 'israel@test.com',
          numeroIdentificacion: '3',
          whatsapp: '302',
          rol: RolUsuario.Tutor,
        },
        {
          id: 'maestro-real',
          tenantId: 'tenant-1',
          nombreUsuario: 'Maestra Sofia',
          email: 'sofia@test.com',
          numeroIdentificacion: '4',
          whatsapp: '303',
          rol: RolUsuario.Maestro,
        },
        {
          id: 'asistente-real',
          tenantId: 'tenant-1',
          nombreUsuario: 'Asistente',
          email: 'asistente@test.com',
          numeroIdentificacion: '2',
          whatsapp: '301',
          rol: RolUsuario.Asistente,
        },
      ]),
    });

    // Solo el programa publicado del tenant correcto aparece -- "programa-borrador"
    // (estado: 'borrador') y "programa-otro-tenant" (tenant-2) quedan afuera.
    expect(contexto.programas).toEqual([{ id: 'programa-1', nombre: 'Programa base' }]);
    // Los grupos son el catalogo FIJO de GrupoEdad, no algo derivado de los programas
    // mockeados arriba (ver comentario en jornadaContextService.ts).
    expect(contexto.grupos).toEqual([
      { id: 'infantil', nombre: 'Infantil' },
      { id: 'precadetes', nombre: 'Precadetes' },
      { id: 'cadetes', nombre: 'Cadetes' },
      { id: 'adultos', nombre: 'Adultos' },
      { id: 'no-asignado', nombre: 'No Asignado' },
    ]);
    expect(contexto.sedes).toEqual([
      { id: 'principal', nombre: 'Cocodrilos principal' },
      { id: 'sede-real', nombre: 'Cocodrilos' },
    ]);
    expect(contexto.espacios).toEqual([{ id: 'tatami-real', nombre: 'Tatami real' }]);
    // Solo el Maestro aparece: Editor (Secretaria), Tutor (padre) y Asistente (sin la
    // opcion de tenant activada) quedan fuera del selector de instructor de Programa.
    expect(contexto.instructores).toEqual([
      { id: 'maestro-real', nombre: 'Maestra Sofia' },
    ]);
  });

  // Regla canonica de roles (CIERRE CENTRO DE ESTUDIOS.md 14.9):
  //   Tutor = padre (fuera SIEMPRE), Maestro = docente (dentro SIEMPRE),
  //   Editor = Secretaria (fuera del selector de Programa),
  //   Asistente = solo si el admin activa features.asistenteInstructorPrograma.
  describe('roles de instructor de Programa (regla canonica 14.9)', () => {
    const usuarioConRol = (id: string, nombre: string, rol: RolUsuario) => ({
      id,
      tenantId: 'tenant-1',
      nombreUsuario: nombre,
      email: `${id}@test.com`,
      numeroIdentificacion: id,
      whatsapp: '300',
      rol,
    });

    const depsConUsuarios = (usuarios: unknown[]) => ({
      ...depsBase(),
      listarEspaciosPorTenant: jest.fn().mockResolvedValue([]),
      obtenerUsuarios: jest.fn().mockResolvedValue(usuarios),
    });

    it('incluye Admin, SuperAdmin y Maestro; excluye Tutor y Editor', async () => {
      const contexto = await obtenerContextoJornada('tenant-1', depsConUsuarios([
        usuarioConRol('admin-1', 'Admin Uno', RolUsuario.Admin),
        usuarioConRol('super-1', 'Super Uno', RolUsuario.SuperAdmin),
        usuarioConRol('maestro-1', 'Maestro Uno', RolUsuario.Maestro),
        usuarioConRol('tutor-1', 'Padre Uno', RolUsuario.Tutor),
        usuarioConRol('editor-1', 'Secretaria Uno', RolUsuario.Editor),
      ]));

      expect(contexto.instructores.map((opcion) => opcion.id)).toEqual([
        'admin-1',
        'super-1',
        'maestro-1',
      ]);
    });

    it('excluye Asistente por defecto (sin la opcion de tenant)', async () => {
      const contexto = await obtenerContextoJornada('tenant-1', depsConUsuarios([
        usuarioConRol('maestro-1', 'Maestro Uno', RolUsuario.Maestro),
        usuarioConRol('asistente-1', 'Asistente Uno', RolUsuario.Asistente),
      ]));

      expect(contexto.instructores.map((opcion) => opcion.id)).toEqual(['maestro-1']);
    });

    it('incluye Asistente cuando permitirAsistenteInstructor es true (opcion del admin)', async () => {
      const contexto = await obtenerContextoJornada(
        'tenant-1',
        depsConUsuarios([
          usuarioConRol('maestro-1', 'Maestro Uno', RolUsuario.Maestro),
          usuarioConRol('asistente-1', 'Asistente Uno', RolUsuario.Asistente),
          usuarioConRol('tutor-1', 'Padre Uno', RolUsuario.Tutor),
        ]),
        { permitirAsistenteInstructor: true },
      );

      expect(contexto.instructores.map((opcion) => opcion.id)).toEqual([
        'maestro-1',
        'asistente-1',
      ]);
    });

    it('la opcion de Asistente NO reincorpora a Tutor ni Editor', async () => {
      const contexto = await obtenerContextoJornada(
        'tenant-1',
        depsConUsuarios([
          usuarioConRol('tutor-1', 'Padre Uno', RolUsuario.Tutor),
          usuarioConRol('editor-1', 'Secretaria Uno', RolUsuario.Editor),
        ]),
        { permitirAsistenteInstructor: true },
      );

      expect(contexto.instructores).toEqual([]);
    });

    // 12.12 (seccion 22 del documento de mejora, caso "No se puede asignar maestro
    // inactivo"): este dominio no tiene un campo `activo` en Usuario, el equivalente real es
    // el soft delete (`deletedAt`, ya filtrado por la implementacion en la linea
    // `!usuario.deletedAt && rolesInstructorEfectivos.has(...)`) -- nadie probaba esta rama
    // todavia, solo el filtro por rol.
    it('excluye instructores con soft delete (deletedAt) del selector, aunque tengan un rol valido', async () => {
      const contexto = await obtenerContextoJornada('tenant-1', depsConUsuarios([
        usuarioConRol('maestro-1', 'Maestro Activo', RolUsuario.Maestro),
        { ...usuarioConRol('maestro-2', 'Maestro Eliminado', RolUsuario.Maestro), deletedAt: '2026-06-01T00:00:00.000Z' },
      ]));

      expect(contexto.instructores.map((opcion) => opcion.id)).toEqual(['maestro-1']);
    });
  });

  // Fix 2026-07-16 (bug real: la Agenda mostraba "programa-1783222231030-ek..." en vez
  // del nombre del programa, en toda la app -- ver comentario extenso en
  // jornadaContextService.ts). Antes esta funcion leia de la coleccion RAIZ legacy
  // `programas` y filtraba por `.activo` (un campo inexistente en ProgramaAcademico),
  // asi que `programasTenant` daba SIEMPRE vacio.
  describe('programas (fix 2026-07-16 -- nombre de programa en vez de ID crudo)', () => {
    it('pasa el tenantId a obtenerProgramas (lee tenants/{tenantId}/programasAcademicos, no la coleccion raiz legacy)', async () => {
      const obtenerProgramas = jest.fn().mockResolvedValue([]);

      await obtenerContextoJornada('tenant-42', { ...depsBase(), obtenerProgramas });

      expect(obtenerProgramas).toHaveBeenCalledWith('tenant-42');
    });

    it('excluye programas en borrador (solo un programa publicado puede tener jornadas reales)', async () => {
      const contexto = await obtenerContextoJornada('tenant-1', {
        ...depsBase(),
        obtenerProgramas: jest.fn().mockResolvedValue([
          { id: 'p-borrador', tenantId: 'tenant-1', nombre: 'Sin publicar', descripcion: '', version: 1, estado: 'borrador', unidades: [], creadoEn: '', actualizadoEn: '' },
        ]),
      });

      expect(contexto.programas).toEqual([]);
    });

    it('excluye programas archivados', async () => {
      const contexto = await obtenerContextoJornada('tenant-1', {
        ...depsBase(),
        obtenerProgramas: jest.fn().mockResolvedValue([
          { id: 'p-archivado', tenantId: 'tenant-1', nombre: 'Archivado', descripcion: '', version: 1, estado: 'archivado', unidades: [], creadoEn: '', actualizadoEn: '' },
        ]),
      });

      expect(contexto.programas).toEqual([]);
    });

    it('grupos es siempre el catalogo fijo de GrupoEdad, sin importar que devuelva obtenerProgramas', async () => {
      const sinProgramas = await obtenerContextoJornada('tenant-1', depsBase());
      const conProgramas = await obtenerContextoJornada('tenant-1', {
        ...depsBase(),
        obtenerProgramas: jest.fn().mockResolvedValue([
          { id: 'p-1', tenantId: 'tenant-1', nombre: 'Uno', descripcion: '', version: 1, estado: 'publicado', unidades: [], creadoEn: '', actualizadoEn: '' },
        ]),
      });

      expect(sinProgramas.grupos).toEqual(conProgramas.grupos);
      expect(sinProgramas.grupos.map((g) => g.id)).toEqual(['infantil', 'precadetes', 'cadetes', 'adultos', 'no-asignado']);
    });
  });

  // Subtarea 12.7 (Parte 3): antes esta funcion devolvia siempre
  // `[{ id: 'tatami-1', nombre: 'Tatami principal' }]` sin importar tenant. Ahora los
  // espacios provienen del repositorio real por tenant.
  describe('espacios (Parte 3)', () => {
    it('mapea los espacios reales del tenant a {id, nombre} (no el hardcode tatami-1)', async () => {
      const contexto = await obtenerContextoJornada('tenant-1', {
        ...depsBase(),
        listarEspaciosPorTenant: jest.fn().mockResolvedValue([
          crearEspacio({ id: 'esp-a', nombre: 'Salon A', tenantId: 'tenant-1' }),
          crearEspacio({ id: 'esp-b', nombre: 'Salon B', tenantId: 'tenant-1' }),
        ]),
      });

      expect(contexto.espacios).toEqual([
        { id: 'esp-a', nombre: 'Salon A' },
        { id: 'esp-b', nombre: 'Salon B' },
      ]);
    });

    it('pasa el tenantId al repositorio de espacios', async () => {
      const listarEspaciosPorTenant = jest.fn().mockResolvedValue([]);

      await obtenerContextoJornada('tenant-42', { ...depsBase(), listarEspaciosPorTenant });

      expect(listarEspaciosPorTenant).toHaveBeenCalledWith('tenant-42');
    });

    it('devuelve espacios vacios cuando el tenant no tiene espacios cargados (fallback esperado)', async () => {
      // Caso normal hoy: ninguna UI persiste espacios, el repositorio devuelve []. El
      // selector debe recibir una lista vacia sin romper el flujo.
      const contexto = await obtenerContextoJornada('tenant-sin-espacios', {
        ...depsBase(),
        listarEspaciosPorTenant: jest.fn().mockResolvedValue([]),
      });

      expect(contexto.espacios).toEqual([]);
    });

    it('excluye espacios inactivos del selector', async () => {
      const contexto = await obtenerContextoJornada('tenant-1', {
        ...depsBase(),
        listarEspaciosPorTenant: jest.fn().mockResolvedValue([
          crearEspacio({ id: 'esp-activo', nombre: 'Activo', activo: true }),
          crearEspacio({ id: 'esp-inactivo', nombre: 'Inactivo', activo: false }),
        ]),
      });

      expect(contexto.espacios).toEqual([{ id: 'esp-activo', nombre: 'Activo' }]);
    });
  });
});
