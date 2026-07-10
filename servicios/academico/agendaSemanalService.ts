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

// Subtarea 12.8: franja horaria fija 7:00-22:00, intervalo de 60 minutos. El documento
// de mejora sugiere "intervalos configurables de 30 o 60 minutos" pero no lo exige para
// esta primera version; se elige 60 min fijo por simplicidad y se documenta el atajo.
export const HORA_INICIO_GRILLA_MINUTOS = 7 * 60; // 7:00 a.m.
export const HORA_FIN_GRILLA_MINUTOS = 22 * 60; // 10:00 p.m.
export const INTERVALO_MINUTOS_GRILLA = 60;

// Marcas de hora (gridlines) desde las 7:00 hasta las 22:00 INCLUSIVE (16 marcas: una
// por cada limite de hora, incluyendo el borde final de la ultima fila 21:00-22:00).
export function obtenerHorasGrilla(): string[] {
  const horas: string[] = [];
  for (
    let minuto = HORA_INICIO_GRILLA_MINUTOS;
    minuto <= HORA_FIN_GRILLA_MINUTOS;
    minuto += INTERVALO_MINUTOS_GRILLA
  ) {
    const horaEntera = String(Math.floor(minuto / 60)).padStart(2, '0');
    const minutos = String(minuto % 60).padStart(2, '0');
    horas.push(`${horaEntera}:${minutos}`);
  }
  return horas;
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

export interface PosicionBloque {
  topPercent: number;
  heightPercent: number;
}

// Calcula la posicion vertical proporcional (0-100%) de un bloque de clase dentro de la
// franja horaria visible (7:00-22:00), para posicionarlo con CSS absoluto dentro de la
// columna del dia -- refleja proporcionalmente el horario real, no solo "cae en la fila
// de las 8". Si la clase empieza antes de las 7:00 o termina despues de las 22:00, se
// recorta (clamp) a los bordes de la franja para no romper el layout.
export function calcularPosicionBloque(horaInicio: string, horaFin: string): PosicionBloque {
  const totalMinutos = HORA_FIN_GRILLA_MINUTOS - HORA_INICIO_GRILLA_MINUTOS;
  const inicioMin = Math.min(
    Math.max(minutosDesdeHora(horaInicio), HORA_INICIO_GRILLA_MINUTOS),
    HORA_FIN_GRILLA_MINUTOS,
  );
  const finMin = Math.min(
    Math.max(minutosDesdeHora(horaFin), HORA_INICIO_GRILLA_MINUTOS),
    HORA_FIN_GRILLA_MINUTOS,
  );

  const topPercent = ((inicioMin - HORA_INICIO_GRILLA_MINUTOS) / totalMinutos) * 100;
  // Piso minimo de 2% de altura para que bloques muy cortos sigan siendo clickeables/legibles.
  const heightPercent = Math.max(((finMin - inicioMin) / totalMinutos) * 100, 2);

  return { topPercent, heightPercent };
}
