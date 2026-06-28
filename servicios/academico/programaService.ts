import type {
  EjecucionPrograma,
  ObjetivoFormativo,
  ProgramaAcademico,
  UnidadTematica,
} from '../../models/academico/programa';

interface CrearProgramaInput {
  tenantId: string;
  nombre: string;
  descripcion: string;
  unidades: UnidadTematica[];
}

interface AsignarProgramaInput {
  grupoId: string;
  sedeId: string;
  fechaInicio: string;
}

const crearId = (prefijo: string) => `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function ordenarUnidades(unidades: UnidadTematica[]): UnidadTematica[] {
  return [...unidades]
    .sort((a, b) => a.orden - b.orden)
    .map((unidad) => ({
      ...unidad,
      objetivos: [...unidad.objetivos].sort((a, b) => a.orden - b.orden),
    }));
}

function obtenerObjetivosOrdenados(programa: ProgramaAcademico): ObjetivoFormativo[] {
  return ordenarUnidades(programa.unidades).flatMap((unidad) => unidad.objetivos);
}

function validarProgramaPublicable(programa: ProgramaAcademico): void {
  if (programa.unidades.length === 0) {
    throw new Error('El programa debe tener unidades para publicarse.');
  }

  const tieneUnidadSinObjetivos = programa.unidades.some((unidad) => unidad.objetivos.length === 0);
  if (tieneUnidadSinObjetivos) {
    throw new Error('Cada unidad debe tener objetivos formativos para publicarse.');
  }
}

function encontrarUnidadDeObjetivo(programa: ProgramaAcademico, objetivoId: string | null): string | null {
  if (!objetivoId) return null;
  const unidad = ordenarUnidades(programa.unidades).find((item) =>
    item.objetivos.some((objetivo) => objetivo.id === objetivoId)
  );
  return unidad?.id ?? null;
}

export function createPrograma(input: CrearProgramaInput): ProgramaAcademico {
  const ahora = new Date().toISOString();

  return {
    id: crearId('programa'),
    tenantId: input.tenantId,
    nombre: input.nombre,
    descripcion: input.descripcion,
    version: 1,
    estado: 'borrador',
    unidades: ordenarUnidades(input.unidades),
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
}

export function publishPrograma(programa: ProgramaAcademico): ProgramaAcademico {
  validarProgramaPublicable(programa);

  return {
    ...programa,
    estado: 'publicado',
    actualizadoEn: new Date().toISOString(),
  };
}

export function assignProgramaToGrupo(
  programa: ProgramaAcademico,
  input: AsignarProgramaInput
): EjecucionPrograma {
  if (programa.estado !== 'publicado') {
    throw new Error('Solo se puede asignar un programa publicado.');
  }

  const primerObjetivo = obtenerObjetivosOrdenados(programa)[0] ?? null;
  const ahora = new Date().toISOString();

  return {
    id: crearId('ejecucion'),
    tenantId: programa.tenantId,
    programaId: programa.id,
    grupoId: input.grupoId,
    sedeId: input.sedeId,
    estado: primerObjetivo ? 'activo' : 'completado',
    fechaInicio: input.fechaInicio,
    unidadActualId: encontrarUnidadDeObjetivo(programa, primerObjetivo?.id ?? null),
    objetivoActualId: primerObjetivo?.id ?? null,
    objetivosCompletados: [],
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
}

export function advanceCiclo(
  programa: ProgramaAcademico,
  ejecucion: EjecucionPrograma,
  objetivosImpartidos: string[]
): EjecucionPrograma {
  if (ejecucion.estado === 'cancelado' || ejecucion.estado === 'completado') {
    return ejecucion;
  }

  const completados = Array.from(new Set([
    ...ejecucion.objetivosCompletados,
    ...objetivosImpartidos,
  ]));
  const siguienteObjetivo = obtenerObjetivosOrdenados(programa)
    .find((objetivo) => !completados.includes(objetivo.id));

  return {
    ...ejecucion,
    estado: siguienteObjetivo ? ejecucion.estado : 'completado',
    unidadActualId: encontrarUnidadDeObjetivo(programa, siguienteObjetivo?.id ?? null),
    objetivoActualId: siguienteObjetivo?.id ?? null,
    objetivosCompletados: completados,
    actualizadoEn: new Date().toISOString(),
  };
}
