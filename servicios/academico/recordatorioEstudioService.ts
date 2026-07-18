// servicios/academico/recordatorioEstudioService.ts
// Reglas + libreria de comentarios para los recordatorios de estudio (nudges a estudiantes
// para que abran/terminen material asignado). Logica pura: determina la "situacion" de una
// asignacion pendiente y elige un comentario de una libreria de variantes (acento bogotano,
// coherente con las demas fechas/montos del proyecto en es-CO / America/Bogota) sin repetir
// el ultimo mostrado -- simula variacion de un asistente sin depender de IA generativa en
// runtime (mismo criterio que analisisProgresoService.ts: reglas testeables, no texto no
// determinista).

// ---------------------------------------------------------------------------
// Situaciones
// ---------------------------------------------------------------------------

export type SituacionAsignacion =
  | 'por_vencer_sin_iniciar'
  | 'por_vencer_medio_camino'
  | 'recien_disponible_sin_iniciar';

export type SituacionRecordatorio = SituacionAsignacion | 'inactividad_prolongada';

const HORAS_URGENCIA_CIERRE = 48;
const HORAS_NOVEDAD_APERTURA = 48;
const PORCENTAJE_MEDIO_CAMINO = 50;
// Mismo umbral que ProgresoEstudianteCard.tsx (columna "Ult. actividad") -- reusar el
// numero ya validado en vez de inventar una escala nueva.
const DIAS_INACTIVIDAD_PROLONGADA = 14;

function horasEntre(desde: Date, hasta: Date): number {
  return (hasta.getTime() - desde.getTime()) / (1000 * 60 * 60);
}

export interface DatosAsignacionPendiente {
  fechaApertura: string;
  fechaCierre?: string;
  porcentajeConsumo: number;
}

/**
 * Situacion de UNA asignacion puntual para un estudiante. null = no amerita recordatorio
 * (ya la completo, todavia no abre, ya cerro, o va bien encaminada).
 */
export function determinarSituacionAsignacion(
  datos: DatosAsignacionPendiente,
  ahora: Date
): SituacionAsignacion | null {
  if (datos.porcentajeConsumo >= 100) return null;

  const apertura = new Date(datos.fechaApertura);
  if (apertura > ahora) return null; // todavia no esta disponible para el estudiante

  if (datos.fechaCierre) {
    const cierre = new Date(datos.fechaCierre);
    const horasParaCierre = horasEntre(ahora, cierre);
    if (horasParaCierre <= 0) return null; // ya cerro, insistir no sirve
    if (horasParaCierre <= HORAS_URGENCIA_CIERRE) {
      if (datos.porcentajeConsumo === 0) return 'por_vencer_sin_iniciar';
      if (datos.porcentajeConsumo < PORCENTAJE_MEDIO_CAMINO) return 'por_vencer_medio_camino';
      return null; // ya va bien encaminada, no hace falta insistir
    }
  }

  const horasDesdeApertura = horasEntre(apertura, ahora);
  if (datos.porcentajeConsumo === 0 && horasDesdeApertura <= HORAS_NOVEDAD_APERTURA) {
    return 'recien_disponible_sin_iniciar';
  }

  return null;
}

/** Situacion GLOBAL del estudiante (no de una asignacion puntual): no toca nada hace rato. */
export function detectarInactividadProlongada(
  ultimaActividadEn: string | undefined,
  ahora: Date
): boolean {
  if (!ultimaActividadEn) return false;
  const dias = horasEntre(new Date(ultimaActividadEn), ahora) / 24;
  return dias >= DIAS_INACTIVIDAD_PROLONGADA;
}

// ---------------------------------------------------------------------------
// Libreria de comentarios -- 5 variantes por situacion para que no se sienta como el mismo
// mensaje repetido. elegirComentario nunca devuelve el mismo texto que el ultimo mostrado
// (si hay mas de una variante disponible para esa situacion).
// ---------------------------------------------------------------------------

const LIBRERIA_COMENTARIOS: Record<SituacionRecordatorio, string[]> = {
  por_vencer_sin_iniciar: [
    '¡Quiubo! {material} cierra en menos de 2 días y todavía no lo ha abierto. Métale, que no se le vaya a pasar.',
    'Ojo con esto: {material} se cierra prontico y usted ni lo ha mirado. ¡No dé papaya, póngase al día ya!',
    'Le recordamos que quedan menos de 48 horas para ver {material}. Hágale antes de que se cierre.',
    'Pilas con {material}: está por cerrarse y no lo ha empezado. Sáquele un ratico hoy mismo.',
    '¡Última llamada para {material}! Se cierra prontico, dele una repasadita antes de que sea tarde.',
  ],
  por_vencer_medio_camino: [
    'Vamos bien con {material}, pero se cierra pronto y todavía le falta. ¡Métale para terminarlo!',
    'Ya arrancó con {material}, ¡no lo deje a medias! Cierra en poquito y le falta un buen tramo.',
    'Quiubo, le recordamos que {material} se cierra prontico. Ya llevaba avance, ¡termínelo que ya casi!',
    'Pilas: a {material} le queda poco tiempo y usted va apenas por la mitad. Un esfuercito más.',
    'No lo deje botado: {material} cierra pronto y ya había empezado. ¡Dele que se puede!',
  ],
  recien_disponible_sin_iniciar: [
    '¡Quiubo! Ya está disponible {material}. Cuando tenga un ratico, dele una mirada.',
    'Le llegó material nuevo: {material}. Está fresquito, ¡anímese a verlo!',
    'Recién publicamos {material}. No hay afán, pero no se le vaya a olvidar.',
    'Tiene pendiente por ver {material}, recién lo subimos. ¡Cuando pueda, hágale!',
    'Novedad en su Centro de Estudios: {material} ya está listo para que lo vea.',
  ],
  inactividad_prolongada: [
    '¡Quiubo! Hace ratico no lo vemos por el Centro de Estudios. ¿Todo bien? Lo esperamos pronto.',
    'Hace más de dos semanas no entra a ver material. ¡No se nos pierda, hágale una revisadita!',
    'Extrañamos verlo activo. Métale aunque sea un ratico al Centro de Estudios esta semana.',
    'Pilas, que hace tiempo no revisa nada por acá. ¡De una, dele una repasada a lo pendiente!',
    'Cuánto tiempo sin saber de usted por el Centro de Estudios. ¡Vuelva cuando pueda!',
  ],
};

/**
 * Elige un comentario de la libreria para la situacion dada, sustituyendo {material} por
 * tituloMaterial si aplica. Si se pasa ultimoMostrado, nunca devuelve exactamente ese mismo
 * texto (mientras haya mas de una variante disponible).
 */
export function elegirComentario(
  situacion: SituacionRecordatorio,
  tituloMaterial: string | undefined,
  ultimoMostrado?: string
): string {
  const variantes = LIBRERIA_COMENTARIOS[situacion];
  const candidatos =
    ultimoMostrado && variantes.length > 1
      ? variantes.filter((v) => v !== ultimoMostrado)
      : variantes;
  const elegido = candidatos[Math.floor(Math.random() * candidatos.length)];
  return tituloMaterial ? elegido.replace('{material}', tituloMaterial) : elegido;
}
