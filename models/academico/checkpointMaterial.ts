/**
 * Checkpoint pedagógico de los materiales de una clase (WS-4, `Módulo Clase en Vivo.txt` §9).
 * Registra, por cada material ASIGNADO a la jornada (una `AsignacionAcademica` con `jornadaId`),
 * en qué quedó: planeado, usado, practicado, pendiente, etc. — un flujo guiado con opciones,
 * NO texto libre (§9).
 *
 * Persistido en `tenants/{tenantId}/jornadas/{jornadaId}/checkpointMateriales/{asignacionId}`
 * (una entrada por material asignado, `asignacionId` como doc-id).
 */

/** Estados del checkpoint, cubriendo las tres fases de §9 (inicio / durante / cierre). */
export type EstadoCheckpointMaterial =
  // §9.1 (al inicio)
  | 'planeado'    // se planea usar hoy
  | 'no_aplica'   // no aplica para esta sesión (se excluye de la cobertura)
  // §9.2 (durante)
  | 'usado'
  | 'mencionado'
  | 'explicado'
  | 'practicado'
  | 'parcial'     // parcialmente cubierto
  | 'no_usado'
  // §9.1/§9.2 (se deja para la próxima clase)
  | 'pendiente';

/** Límite de caracteres de la nota corta (§9.2: "nota corta, con límite de caracteres"). */
export const LIMITE_NOTA_CHECKPOINT = 280;

export interface CheckpointMaterialJornada {
  /** Id de la `AsignacionAcademica` (el material asignado a esta jornada). */
  asignacionId: string;
  jornadaId: string;
  tenantId: string;
  estado: EstadoCheckpointMaterial;
  /** Nota corta opcional (§9.2), truncada a `LIMITE_NOTA_CHECKPOINT`. */
  notaCorta?: string;
  /** UID de quien registró el checkpoint (§9.3: "quién registró el cierre"). */
  registradoPorUid: string;
  actualizadoEn: string;
}

// Peso de cada estado para la cobertura de la clase (§9.3, "% aproximado de cobertura").
// Trabajado a fondo = 1; parcial/mencionado = 0.5; el resto = 0. `no_aplica` se EXCLUYE del
// cálculo (no cuenta ni en numerador ni en denominador): un material que no aplicaba no debe
// bajar la cobertura.
const PESO_COBERTURA: Record<EstadoCheckpointMaterial, number> = {
  usado: 1,
  explicado: 1,
  practicado: 1,
  parcial: 0.5,
  mencionado: 0.5,
  planeado: 0,
  pendiente: 0,
  no_usado: 0,
  no_aplica: 0,
};

export type EstadoConSinMarcar = EstadoCheckpointMaterial | 'sin_marcar';

export interface ResumenCoberturaClase {
  total: number;
  detalle: Array<{ asignacionId: string; titulo: string; estado: EstadoConSinMarcar }>;
  porEstado: Record<EstadoConSinMarcar, number>;
  /** % aproximado de cobertura sobre los materiales que SÍ aplicaban (excluye `no_aplica`). */
  coberturaPorcentaje: number;
}

/**
 * Resumen de cierre (§9.3): cruza los materiales asignados a la jornada con los checkpoints
 * registrados. Un material sin checkpoint queda `sin_marcar` (= no trabajado, peso 0). Puro.
 */
export function resumirCoberturaClase(
  materialesAsignados: Array<{ asignacionId: string; titulo: string }>,
  checkpoints: CheckpointMaterialJornada[],
): ResumenCoberturaClase {
  const porAsignacion = new Map(checkpoints.map((c) => [c.asignacionId, c]));

  const detalle = materialesAsignados.map(({ asignacionId, titulo }) => ({
    asignacionId,
    titulo,
    estado: (porAsignacion.get(asignacionId)?.estado ?? 'sin_marcar') as EstadoConSinMarcar,
  }));

  const porEstado = detalle.reduce((acc, d) => {
    acc[d.estado] = (acc[d.estado] || 0) + 1;
    return acc;
  }, {} as Record<EstadoConSinMarcar, number>);

  // Cobertura: excluye los `no_aplica` del denominador.
  const aplicables = detalle.filter((d) => d.estado !== 'no_aplica');
  const suma = aplicables.reduce(
    (acc, d) => acc + (d.estado === 'sin_marcar' ? 0 : PESO_COBERTURA[d.estado]),
    0,
  );
  const coberturaPorcentaje = aplicables.length === 0 ? 0 : Math.round((suma / aplicables.length) * 100);

  return { total: materialesAsignados.length, detalle, porEstado, coberturaPorcentaje };
}
