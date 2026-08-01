import { obtenerSedes } from '../sedesApi';
import { obtenerUsuarios } from '../usuariosApi';
import { obtenerConfiguracionClub } from '../configuracionApi';
import { getSedesVisibles } from '../../utils/dataIntegrity';
import { espacioRepository } from './espacioRepository';
import { programaRepository } from './programaRepository';
import type { EspacioFisico } from '../../models/academico/espacio';
import type { ProgramaAcademico } from '../../models/academico/programa';
import { GrupoEdad, RolUsuario, type ConfiguracionClub, type Sede, type Usuario } from '../../tipos';

export interface OpcionJornada {
  id: string;
  nombre: string;
}

export interface ContextoJornada {
  programas: OpcionJornada[];
  grupos: OpcionJornada[];
  sedes: OpcionJornada[];
  espacios: OpcionJornada[];
  instructores: OpcionJornada[];
}

interface JornadaContextDeps {
  // Fix 2026-07-16 (bug real: la Agenda mostraba el ID crudo del programa -- "programa-
  // 1783222231030-ek..." -- en vez del nombre, en TODA la app). Esta funcion leia de
  // `programasApi.obtenerProgramas()`, la coleccion RAIZ legacy `programas` (el catalogo
  // de "Programas Extra" para licenciamiento -- un concepto DISTINTO, ver Configuracion.tsx),
  // no de `tenants/{tenantId}/programasAcademicos`, donde realmente viven los programas
  // que generan jornadas (createPrograma/publishPrograma/assignProgramaToGrupo, ver
  // programaService.ts). Ademas el filtro comparaba contra `.activo`, un campo que ni
  // siquiera existe en ProgramaAcademico (el campo real es `estado: 'borrador' |
  // 'publicado' | 'archivado'`). Entre ambos bugs, `programasTenant` -- y por lo tanto
  // `nombresPrograma` en cada consumidor (AgendaView, AsignacionesView, JornadasView,
  // PestanaProgramaJornada, ModalEdicionJornada) -- daba SIEMPRE vacio, para cualquier
  // tenant, siempre: el fallback a `jornada.programaId` crudo nunca dejaba de activarse.
  obtenerProgramas: (tenantId: string) => Promise<ProgramaAcademico[]>;
  obtenerSedes: (tenantId?: string) => Promise<Sede[]>;
  // ERR-0011: usuariosApi.obtenerUsuarios ahora exige tenantId para que firestore.rules
  // pueda validar el `list` (ver firestore.rules, match /usuarios/{uid}).
  obtenerUsuarios: (tenantId?: string) => Promise<Usuario[]>;
  obtenerConfiguracionClub: (tenantId?: string) => Promise<ConfiguracionClub>;
  // Subtarea 12.7 (Parte 3): fuente real de espacios por tenant. Reemplaza el array
  // hardcodeado `[{ id: 'tatami-1', nombre: 'Tatami principal' }]` que devolvia esta funcion
  // sin importar tenant ni sede.
  listarEspaciosPorTenant: (tenantId: string) => Promise<EspacioFisico[]>;
}

const depsDefault: JornadaContextDeps = {
  obtenerProgramas: (tenantId: string) => programaRepository.listarProgramasPorTenant(tenantId),
  obtenerSedes,
  obtenerUsuarios,
  obtenerConfiguracionClub,
  listarEspaciosPorTenant: (tenantId: string) => espacioRepository.listarEspaciosPorTenant(tenantId),
};

// Regla canonica de roles (decision del usuario 2026-07-09, CIERRE CENTRO DE
// ESTUDIOS.md 14.9 — SUPERSEDE el bugfix de 14.6 que habia reincorporado Tutor):
//   - Tutor  = padre/acudiente. NUNCA instructor. La "evidencia" de 14.6 venia del
//     mislabel del formulario (<option value=Tutor>Maestro</option>), no del dominio.
//   - Maestro = el rol docente real (nuevo en RolUsuario); es quien ensena y asigna clases.
//   - Editor = Secretaria (gestion de alumnos/tienda/cobros); fuera del selector de
//     instructor de Programa. Su capacidad docente historica queda como legacy en otras
//     vistas, no aca.
//   - Asistente: SOLO si el admin del tenant lo habilita explicitamente via
//     `features.asistenteInstructorPrograma` (se recibe como opcion, ver abajo).
const rolesInstructor = new Set<RolUsuario>([RolUsuario.Admin, RolUsuario.SuperAdmin, RolUsuario.Maestro]);

export interface OpcionesContextoJornada {
  /**
   * Toggle a nivel tenant (features.asistenteInstructorPrograma, default false):
   * cuando es true, los usuarios con rol Asistente tambien aparecen como
   * instructores seleccionables de Programa. No reincorpora a Tutor ni Editor.
   */
  permitirAsistenteInstructor?: boolean;
}

// Mismo slug que realmente escribe AsignacionesView.tsx en `jornada.grupoId`
// (`slugificar(programa.grupoObjetivo)`, ej. "Precadetes" -> "precadetes", SIN prefijo
// "grupo-"). El lookup de nombresGrupo en AgendaView.tsx es una comparacion directa
// contra `jornada.grupoId` tal cual esta guardado -- si el id generado aca no calza
// exactamente con ese formato, el mapa nunca encuentra match y se vuelve a caer al id
// crudo (el mismo bug de fondo que el de programas, aplicado a grupos).
const slugificarGrupo = (grupo: string) => grupo.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function uniqueById(opciones: OpcionJornada[]): OpcionJornada[] {
  return Array.from(new Map(opciones.map((opcion) => [opcion.id, opcion])).values());
}

export async function obtenerContextoJornada(
  tenantId: string,
  deps: Partial<JornadaContextDeps> = {},
  opciones: OpcionesContextoJornada = {},
): Promise<ContextoJornada> {
  // Merge con los defaults en vez de reemplazo total: asi un caller (o un test) puede
  // sobrescribir solo las deps que le interesan sin tener que re-proveer todas. Necesario
  // ahora que se sumo `listarEspaciosPorTenant`: los call sites viejos que pasaban un deps
  // parcial siguen funcionando y caen al repositorio real para los espacios.
  const resolved: JornadaContextDeps = { ...depsDefault, ...deps };
  const [programas, sedes, usuarios, configClub, espacios] = await Promise.all([
    resolved.obtenerProgramas(tenantId),
    resolved.obtenerSedes(tenantId),
    resolved.obtenerUsuarios(tenantId),
    resolved.obtenerConfiguracionClub(tenantId),
    resolved.listarEspaciosPorTenant(tenantId),
  ]);

  // `programa.tenantId === tenantId` es defensa en profundidad (listarProgramasPorTenant
  // ya filtra por tenant); `estado === 'publicado'` es la condicion real (ver comentario
  // en JornadaContextDeps.obtenerProgramas mas arriba) -- assignProgramaToGrupo exige
  // que el programa este publicado antes de generar ninguna jornada real, asi que todo
  // programa con jornadas asociadas SIEMPRE pasa este filtro.
  const programasTenant = programas.filter((programa) => programa.tenantId === tenantId && programa.estado === 'publicado');

  const programasOpciones = programasTenant.map((programa) => ({
    id: programa.id,
    nombre: programa.nombre,
  }));

  // Los grupos NO son un catalogo dinamico por programa -- ProgramaAcademico no tiene
  // horarios/bloques (eso vive en EjecucionPrograma.bloques, ligado a sede+horario, no a
  // nombre de grupo). Son el catalogo FIJO de GrupoEdad (tipos.ts), igual en todos los
  // tenants -- por eso se listan directo del enum en vez de intentar derivarlos de datos
  // que nunca tuvieron esa forma.
  const grupos = Object.values(GrupoEdad).map((grupo) => ({
    id: slugificarGrupo(grupo),
    nombre: grupo,
  }));

  const sedesOpciones = uniqueById(
    getSedesVisibles(configClub, sedes)
      .filter((sede) => (!sede.tenantId || sede.tenantId === tenantId) && !sede.deletedAt)
      .map((sede) => ({ id: sede.id, nombre: sede.nombre }))
  );

  const rolesInstructorEfectivos = opciones.permitirAsistenteInstructor
    ? new Set<RolUsuario>([...rolesInstructor, RolUsuario.Asistente])
    : rolesInstructor;

  const instructores = uniqueById(
    usuarios
      .filter((usuario) => usuario.tenantId === tenantId && !usuario.deletedAt && rolesInstructorEfectivos.has(usuario.rol))
      .map((usuario) => ({ id: usuario.id, nombre: usuario.nombreUsuario }))
  );

  // Subtarea 12.7 (Parte 3): espacios reales del tenant en vez del hardcode `tatami-1`.
  // Se filtran los inactivos (`activo === false`) y se mapea a `OpcionJornada` ({id, nombre}).
  // NO se filtra por sede aca: `obtenerContextoJornada` solo recibe `tenantId` y el selector
  // de espacio de JornadasView/PestanaProgramaJornada hoy no depende de la sede elegida
  // (lista todos los espacios del tenant). El scoping espacio-por-sede queda para el modal de
  // 12.9, donde sede y espacio se editan juntos. Si el tenant no tiene espacios cargados
  // (caso esperado hoy: ninguna UI persiste espacios), esto queda como `[]` y el consumidor
  // muestra un selector vacio sin romperse.
  const espaciosOpciones = uniqueById(
    espacios
      .filter((espacio) => (!espacio.tenantId || espacio.tenantId === tenantId) && espacio.activo !== false)
      .map((espacio) => ({ id: espacio.id, nombre: espacio.nombre }))
  );

  return {
    programas: programasOpciones,
    grupos,
    sedes: sedesOpciones,
    espacios: espaciosOpciones,
    instructores,
  };
}
