export type EstadoProgramaAcademico = 'borrador' | 'publicado' | 'archivado';
export type EstadoEjecucionPrograma = 'activo' | 'pausado' | 'cancelado' | 'completado';

export interface ObjetivoFormativo {
  id: string;
  descripcion: string;
  orden: number;
}

export interface UnidadTematica {
  id: string;
  nombre: string;
  orden: number;
  objetivos: ObjetivoFormativo[];
}

export interface ProgramaAcademico {
  id: string;
  tenantId: string;
  nombre: string;
  descripcion: string;
  version: number;
  estado: EstadoProgramaAcademico;
  unidades: UnidadTematica[];
  creadoEn: string;
  actualizadoEn: string;
}

export interface EjecucionPrograma {
  id: string;
  tenantId: string;
  programaId: string;
  grupoId: string;
  sedeId: string;
  estado: EstadoEjecucionPrograma;
  fechaInicio: string;
  unidadActualId: string | null;
  objetivoActualId: string | null;
  objetivosCompletados: string[];
  creadoEn: string;
  actualizadoEn: string;
}
