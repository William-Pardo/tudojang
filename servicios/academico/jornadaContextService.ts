import { obtenerProgramas } from '../programasApi';
import { obtenerSedes } from '../sedesApi';
import { obtenerUsuarios } from '../usuariosApi';
import { obtenerConfiguracionClub } from '../configuracionApi';
import { getSedesVisibles } from '../../utils/dataIntegrity';
import { espacioRepository } from './espacioRepository';
import type { EspacioFisico } from '../../models/academico/espacio';
import { GrupoEdad, RolUsuario, type ConfiguracionClub, type Programa, type Sede, type Usuario } from '../../tipos';

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
  obtenerProgramas: () => Promise<Programa[]>;
  obtenerSedes: (tenantId?: string) => Promise<Sede[]>;
  obtenerUsuarios: () => Promise<Usuario[]>;
  obtenerConfiguracionClub: (tenantId?: string) => Promise<ConfiguracionClub>;
  // Subtarea 12.7 (Parte 3): fuente real de espacios por tenant. Reemplaza el array
  // hardcodeado `[{ id: 'tatami-1', nombre: 'Tatami principal' }]` que devolvia esta funcion
  // sin importar tenant ni sede.
  listarEspaciosPorTenant: (tenantId: string) => Promise<EspacioFisico[]>;
}

const depsDefault: JornadaContextDeps = {
  obtenerProgramas,
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

const grupoId = (grupo: GrupoEdad | string) => `grupo-${String(grupo).toLowerCase().replace(/\s+/g, '-')}`;

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
    resolved.obtenerProgramas(),
    resolved.obtenerSedes(tenantId),
    resolved.obtenerUsuarios(),
    resolved.obtenerConfiguracionClub(tenantId),
    resolved.listarEspaciosPorTenant(tenantId),
  ]);

  const programasTenant = programas.filter((programa) => programa.tenantId === tenantId && programa.activo);
  const bloques = programasTenant.flatMap((programa) => programa.bloquesHorarios ?? []);

  const programasOpciones = programasTenant.map((programa) => ({
    id: programa.id,
    nombre: programa.nombre,
  }));

  const grupos = uniqueById(bloques.map((bloque) => ({
    id: grupoId(bloque.grupo),
    nombre: `Grupo ${bloque.grupo}`,
  })));

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
