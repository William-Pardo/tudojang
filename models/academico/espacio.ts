export interface EspacioFisico {
  id: string;
  tenantId: string;
  sedeId: string;
  nombre: string;
  capacidad: number;
  disciplinasPermitidas: string[];
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ReservaEspacio {
  id: string;
  espacioId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  referenciaId: string;
}

export interface DisponibilidadEspacio {
  disponible: boolean;
  conflictos: ReservaEspacio[];
}
