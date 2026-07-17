import type { JornadaInstruccion } from '../../models/academico/jornada';

// Subtarea 12.8 (Vista Agenda: parrilla semanal). Este helper de mapeo/agrupacion es
// PROPIO de la parrilla semanal nueva y NO reemplaza a `agruparClasesAcademicas`
// (agendaAcademicaService.ts), que sigue sirviendo para su proposito original: una
// tarjeta por `bloqueRecurrenteId` con SOLO la proxima ocurrencia (usado hoy por
// `Horarios.tsx` para la lista "tus proximas clases"). Una parrilla semanal necesita
// TODAS las ocurrencias reales dentro del rango Lunes-Domingo visible: una clase que se
// dicta martes y jueves debe aparecer en AMBOS dias de esa semana, no solo "la proxima".
// Reutilizar agruparClasesAcademicas aca perderia esas ocurrencias -- ver decision
// documentada en el prompt de la subtarea 12.8.

// Subtarea 12.8: dias de la semana FIJOS Lunes a Domingo. El documento de mejora del
// modulo Agenda dice explicitamente "permitir ajuste futuro si el tenant maneja otra
// configuracion" -- es decir, NO es un requisito de esta subtarea. Se deja como
// constante fija y documentada a proposito (no configurable por tenant todavia).
export const DIAS_SEMANA: Array<{ indiceIso: number; etiqueta: string }> = [
  { indiceIso: 0, etiqueta: 'Lunes' },
  { indiceIso: 1, etiqueta: 'Martes' },
  { indiceIso: 2, etiqueta: 'Miércoles' },
  { indiceIso: 3, etiqueta: 'Jueves' },
  { indiceIso: 4, etiqueta: 'Viernes' },
  { indiceIso: 5, etiqueta: 'Sábado' },
  { indiceIso: 6, etiqueta: 'Domingo' },
];

// Simplificado 2026-07-17, SEGUNDA vuelta (pedido explicito del usuario: la primera vuelta
// -- un eje continuo proporcional recortado al rango real de la semana -- seguia dejando
// huecos grandes en blanco cuando habia horas SIN clases en el medio del rango, ej. clases
// a las 09:00 y a las 15:00 dejaban 10:00-14:00 vacio en pantalla). Se abandona el eje
// continuo por completo: la grilla ahora es un conjunto de FILAS DISCRETAS, una por cada
// franja horaria EXACTA (horaInicio-horaFin) que realmente tiene alguna jornada esa semana
// -- sin fila para huecos donde NINGUN dia tiene clase, sin importar cuan separadas esten
// las franjas entre si. Si dos jornadas distintas (mismo dia, distinto programa/grupo) caen
// en la MISMA franja exacta, terminan en la MISMA fila -- el consumidor (AgendaView) las
// layoutea lado a lado en esa celda en vez de superponerlas.
//
// A diferencia de la primera vuelta (que SI excluia canceladas, porque una cancelada
// aislada no debia estirar el eje continuo), aca NO se filtran: subtarea 12.8 documenta a
// proposito que una jornada cancelada sigue siendo VISIBLE en la grilla (atenuada, no
// desaparece) para no perder trazabilidad de que existio/se cancelo una clase esa
// fecha/hora -- si se excluyera aca, una semana con SOLO una clase cancelada perderia su
// unica fila y la cancelacion dejaria de verse por completo.
export interface FranjaHorariaAgenda {
  horaInicio: string;
  horaFin: string;
}

export function calcularFilasHorarioAgenda(jornadas: JornadaInstruccion[]): FranjaHorariaAgenda[] {
  const clavesVistas = new Set<string>();
  const franjas: FranjaHorariaAgenda[] = [];

  for (const jornada of jornadas) {
    const clave = `${jornada.horaInicio}-${jornada.horaFin}`;
    if (clavesVistas.has(clave)) continue;
    clavesVistas.add(clave);
    franjas.push({ horaInicio: jornada.horaInicio, horaFin: jornada.horaFin });
  }

  return franjas.sort((a, b) => {
    const inicioDiff = minutosDesdeHora(a.horaInicio) - minutosDesdeHora(b.horaInicio);
    return inicioDiff !== 0 ? inicioDiff : minutosDesdeHora(a.horaFin) - minutosDesdeHora(b.horaFin);
  });
}

// Construye una fecha LOCAL (no UTC) a partir de un string YYYY-MM-DD, para que los
// calculos de dia de la semana no se corran por el desfase de zona horaria que introduce
// `new Date('YYYY-MM-DD')` (que Node/los navegadores interpretan como medianoche UTC).
function aFechaLocal(fechaIso: string): Date {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

export function formatearFechaIso(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

// Devuelve el Lunes (00:00 local) de la semana que contiene `fechaIso`.
export function obtenerLunesDeSemana(fechaIso: string): Date {
  const fecha = aFechaLocal(fechaIso);
  const diaSemanaJs = fecha.getDay(); // 0=domingo..6=sabado
  const offsetHastaLunes = diaSemanaJs === 0 ? -6 : 1 - diaSemanaJs;
  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() + offsetHastaLunes);
  return lunes;
}

export interface RangoSemana {
  inicioIso: string;
  finIso: string;
  // Las 7 fechas ISO de la semana visible, Lunes a Domingo en orden.
  diasIso: string[];
}

// Arma el rango Lunes-Domingo (ambos inclusive) de la semana que contiene `fechaIso`.
export function obtenerRangoSemana(fechaIso: string): RangoSemana {
  const lunes = obtenerLunesDeSemana(fechaIso);
  const diasIso = Array.from({ length: 7 }, (_, indice) => {
    const dia = new Date(lunes);
    dia.setDate(lunes.getDate() + indice);
    return formatearFechaIso(dia);
  });
  return {
    inicioIso: diasIso[0],
    finIso: diasIso[6],
    diasIso,
  };
}

// Suma (o resta, si `cantidad` es negativa) semanas completas (7 dias) a `fechaIso`.
// Usado por la navegacion "semana anterior"/"semana siguiente" de la parrilla.
export function sumarSemanas(fechaIso: string, cantidad: number): string {
  const fecha = aFechaLocal(fechaIso);
  fecha.setDate(fecha.getDate() + cantidad * 7);
  return formatearFechaIso(fecha);
}

// Agrupa jornadas por fecha EXACTA (no por bloqueRecurrenteId como agruparClasesAcademicas):
// preserva TODAS las ocurrencias, para que una clase recurrente aparezca en cada dia real
// que le corresponde dentro de la semana visible.
export function agruparJornadasPorFecha(jornadas: JornadaInstruccion[]): Record<string, JornadaInstruccion[]> {
  const grupos: Record<string, JornadaInstruccion[]> = {};
  for (const jornada of jornadas) {
    grupos[jornada.fecha] = [...(grupos[jornada.fecha] ?? []), jornada];
  }
  return grupos;
}

function minutosDesdeHora(hora: string): number {
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
}
