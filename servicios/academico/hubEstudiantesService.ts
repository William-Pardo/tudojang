import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { AsignacionAcademica } from '../../models/academico/asignacion';
import type { GradoTKD } from '../../tipos';
import { jornadaRepository, type JornadaRepository } from './jornadaRepository';
import { listarAsignacionesPorTenant } from './asignacionService';
import { obtenerRangoSemana } from './agendaSemanalService';
import { calcularIndicadorClaseEnVivo, type IndicadorClaseEnVivo } from './ventanaClaseEnVivoService';

/**
 * Subtarea 12.11 (`Mejora del módulo Agenda.txt`, seccion 15 "Relación con Hub Estudiantes").
 *
 * DECISION DEL USUARIO (confirmada explicitamente, no volver a preguntar): la seccion 15
 * permite explicitamente NO construir la interfaz de Hub Estudiantes todavia ("No desarrollar
 * toda la interfaz de Hub Estudiantes en esta tarea, salvo que ya exista una dependencia
 * directa necesaria para consumir la agenda"). El usuario eligio esa opcion: SOLO se expone
 * este servicio de LECTURA, listo para que un futuro modulo Hub Estudiantes lo consuma. No se
 * agrega ninguna pantalla ni se toca ningun archivo de `vistas/**`.
 *
 * LIMITACION HEREDADA Y DOCUMENTADA (importante, no es un bug de esta subtarea): no existe hoy
 * un roster preciso estudiante-jornada (que estudiante puntual esta inscripto en que jornada
 * exacta) -- esa pieza es la Fase 0 del change `clase-en-vivo-checkin-trigger-agenda`, NO
 * implementada. Por eso el filtro de "clases que corresponden al estudiante" (seccion 15) se
 * resuelve aca por GRADO/GRUPO (`grupoId` de `JornadaInstruccion`, ya usado por
 * matricula/asignacion automatica por grado segun 12.7/12.8), no por estudiante individual. El
 * futuro consumidor (Hub Estudiantes) debe resolver "que grupo/grado le corresponde a ESTE
 * estudiante" por su cuenta (p.ej. via el perfil del estudiante) y pasarlo en `filtro`.
 *
 * DISEÑO / REUTILIZACION (para no duplicar logica ya resuelta en este modulo):
 * - El rango de la semana visible se calcula con `obtenerRangoSemana` (agendaSemanalService.ts,
 *   12.8) -- MISMO calculo Lunes-Domingo que ya usa la parrilla de Agenda, no se reinventa.
 * - La lectura de jornadas usa `jornadaRepository.listarJornadasPorRangoFechas` (12.8), que ya
 *   filtra por tenant + rango de fechas en el propio Firestore query (seccion 21 del documento
 *   de mejora, rendimiento) -- cumple "no mostrar clases de otro tenant" sin filtrar en memoria.
 * - El "estado de disponibilidad de Clase en Vivo" que pide la seccion 15 es exactamente
 *   `calcularIndicadorClaseEnVivo` (ventanaClaseEnVivoService.ts, 12.10 -- simplificado
 *   2026-07-16 de 6 a 4 estados: proxima/activa/finalizada/cancelada), sin reimplementar la
 *   logica de ventana horaria [horaInicio-15min, horaFin+15min].
 * - El material asignado (titulos) usa el MISMO criterio que `agruparClasesAcademicas`
 *   (agendaAcademicaService.ts): `AsignacionAcademica.jornadaId === jornada.id`.
 * - Patron de inyeccion de dependencias: a diferencia de `espacioRepository.ts`/
 *   `programaRepository.ts` (que hacen I/O directo contra Firestore y por eso exponen un objeto
 *   `deps` con una rama mock propia), esta funcion NO habla con Firestore directamente -- compone
 *   dos servicios que YA resuelven su propio acceso a datos (`jornadaRepository` y
 *   `listarAsignacionesPorTenant`). Se sigue el patron mas cercano que YA existe en este mismo
 *   modulo para ese caso (`agendaAcademicaService.obtenerClasesAcademicasDelTenant`): el
 *   repositorio de jornadas se recibe como parametro inyectable con el singleton real como
 *   default (`repository: JornadaRepository = jornadaRepository`), y `listarAsignacionesPorTenant`
 *   se mockea a nivel de modulo en tests (`jest.mock('./asignacionService', ...)`), igual que
 *   hace `agendaAcademicaService.test.ts`. Reimplementar un segundo objeto `deps` con
 *   collection/doc/getDocs aca duplicaria exactamente lo que `jornadaRepository` ya cubre.
 *
 * REGLAS DE LA SECCION 15 CUBIERTAS POR ESTA FUNCION:
 * - "No mostrar clases de otro tenant": filtro de tenant lo aplica el repositorio (query real).
 * - "No mostrar clases que no correspondan al estudiante, grado o programa": filtro por
 *   `grupoId` y/o `grado` (ver `gradosExcluidos`), documentado arriba como filtro por
 *   grado/grupo (no por estudiante individual, limitacion heredada).
 * - "No mostrar clases canceladas como disponibles": una jornada cancelada NO se saca del
 *   listado (Hub Estudiantes debe poder reflejar que se cancelo, seccion 15: "Si Agenda edita
 *   horario, sede, maestro o estado, Hub Estudiantes debe reflejar el cambio"), pero su
 *   `indicadorClaseEnVivo` es siempre `'cancelada'` (nunca `'activa'`), via
 *   `calcularIndicadorClaseEnVivo`.
 * - "Las clases futuras deben existir y estar consultables aunque todavia no esten en ventana
 *   de Clase en Vivo": se incluyen `'proxima'`/`'activa'`, no solo las que ya estan en ventana.
 * - "Clases futuras de la semana" (el nombre literal de la funcion pedida en el checklist de
 *   12.11): se excluyen las jornadas cuyo `indicadorClaseEnVivo` ya es `'finalizada'` -- ese
 *   valor ya encapsula tanto el cierre academico manual (`estado === 'cerrada'`) como el cierre
 *   por ventana horaria vencida, sin reinventar un segundo chequeo de "es pasado".
 *
 * CAMPOS NO RESUELTOS A PROPOSITO (fuera de alcance de un servicio de solo lectura minimo):
 * "Nombre de clase", "Maestro" y "Sede o modalidad" (seccion 15) se exponen como
 * `programaId`/`instructorId`/`sedeId`/`espacioId` (los mismos ids crudos que ya guarda
 * `JornadaInstruccion`), NO como nombres visibles. Resolverlos a texto requiere repositorios
 * que este modulo no necesita hoy (usuarios, programas, sedes) -- el futuro consumidor (Hub
 * Estudiantes) ya tiene o tendra acceso a esos repositorios para el join, igual que
 * `ClaseAcademicaAgenda.nombrePrograma` (agendaAcademicaService.ts) resuelve el nombre via un
 * mapa opcional pasado por el llamador en vez de acoplar este servicio a otro repositorio.
 */

export interface FiltroClasesHubEstudiantes {
  /** Filtra por grupo exacto (`JornadaInstruccion.grupoId`). Omitir = todos los grupos. */
  grupoId?: string;
  /**
   * Filtra por grado: excluye las jornadas cuyo `gradosExcluidos` incluya este grado (mismo
   * campo que ya usa la matricula automatica por grado, ver `models/academico/jornada.ts`).
   * Omitir = todos los grados (una jornada sin `gradosExcluidos` cubre todos los grados).
   */
  grado?: GradoTKD;
}

export interface ClaseFuturaHubEstudiantes {
  jornadaId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  /** Id crudo, sin resolver a nombre -- ver nota "CAMPOS NO RESUELTOS A PROPOSITO" arriba. */
  programaId: string;
  /** Id crudo del maestro, sin resolver a nombre -- idem. */
  instructorId: string;
  /** Id crudo de sede, sin resolver a nombre/modalidad -- idem. */
  sedeId: string;
  espacioId: string;
  grupoId: string;
  /** Titulos de `AsignacionAcademica` vinculadas a esta jornada. Vacio si no hay material. */
  materialAsignado: string[];
  /** "Estado de disponibilidad de Clase en Vivo" (seccion 15), via `calcularIndicadorClaseEnVivo`. */
  indicadorClaseEnVivo: IndicadorClaseEnVivo;
}

function jornadaCorrespondeAlFiltro(jornada: JornadaInstruccion, filtro: FiltroClasesHubEstudiantes): boolean {
  if (filtro.grupoId && jornada.grupoId !== filtro.grupoId) return false;
  if (filtro.grado && jornada.gradosExcluidos?.includes(filtro.grado)) return false;
  return true;
}

function materialAsignadoDeJornada(jornadaId: string, asignaciones: AsignacionAcademica[]): string[] {
  return asignaciones
    .filter((asignacion) => asignacion.jornadaId === jornadaId)
    .map((asignacion) => asignacion.titulo);
}

/**
 * Lectura de las clases futuras de la semana (Lunes-Domingo que contiene `fechaReferenciaIso`),
 * filtrable por grado/grupo, para que un futuro Hub Estudiantes las consuma. Ver el JSDoc de
 * cabecera de este archivo para el detalle completo de decisiones y limitaciones.
 *
 * @param tenantId tenant del estudiante. Vacio devuelve `[]` sin consultar el repositorio.
 * @param filtro grado/grupo del estudiante (no hay roster estudiante-jornada, ver limitacion).
 * @param fechaReferenciaIso fecha (YYYY-MM-DD) usada para resolver la semana Lunes-Domingo.
 * @param ahoraIso instante actual (ISO), usado para calcular `indicadorClaseEnVivo` y para
 *   excluir jornadas cuya ventana ya finalizo (ver "CAMPOS NO RESUELTOS..." arriba).
 * @param repository inyectable para tests; default = singleton real de Firestore/mock.
 */
export async function obtenerClasesFuturasSemanaHubEstudiantes(
  tenantId: string,
  filtro: FiltroClasesHubEstudiantes,
  fechaReferenciaIso: string,
  ahoraIso: string,
  repository: JornadaRepository = jornadaRepository,
): Promise<ClaseFuturaHubEstudiantes[]> {
  if (!tenantId) return [];

  const rango = obtenerRangoSemana(fechaReferenciaIso);
  const [jornadas, asignaciones] = await Promise.all([
    repository.listarJornadasPorRangoFechas(tenantId, rango.inicioIso, rango.finIso),
    listarAsignacionesPorTenant(tenantId),
  ]);

  return jornadas
    .filter((jornada) => jornadaCorrespondeAlFiltro(jornada, filtro))
    .map((jornada) => ({
      jornada,
      indicador: calcularIndicadorClaseEnVivo(jornada, ahoraIso),
    }))
    // "Clases futuras": se excluyen las que ya finalizaron (cierre academico manual o
    // ventana horaria vencida). Las canceladas SI permanecen (ver nota de cabecera).
    .filter(({ indicador }) => indicador !== 'finalizada')
    .map(({ jornada, indicador }): ClaseFuturaHubEstudiantes => ({
      jornadaId: jornada.id,
      fecha: jornada.fecha,
      horaInicio: jornada.horaInicio,
      horaFin: jornada.horaFin,
      programaId: jornada.programaId,
      instructorId: jornada.instructorId,
      sedeId: jornada.sedeId,
      espacioId: jornada.espacioId,
      grupoId: jornada.grupoId,
      materialAsignado: materialAsignadoDeJornada(jornada.id, asignaciones),
      indicadorClaseEnVivo: indicador,
    }))
    .sort((a, b) => (a.fecha === b.fecha ? a.horaInicio.localeCompare(b.horaInicio) : a.fecha.localeCompare(b.fecha)));
}
