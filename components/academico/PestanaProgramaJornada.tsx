import React from 'react';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { OpcionJornada } from '../../servicios/academico/jornadaContextService';

// Subtarea 12.7 (Parte 1): formulario "Programa" de una jornada (programa, grupo, sede,
// espacio, instructor), extraido de `JornadasView.tsx` para que el modal de edicion singular
// de 12.9 lo reutilice como pestana "Programa" sin duplicar el markup ni las opciones.
//
// Es un componente 100% presentacional/controlado: no tiene estado propio ni valida nada por
// su cuenta. Recibe los valores actuales de la jornada (draft) y las opciones ya cargadas
// (via `obtenerContextoJornada`), y emite el cambio de cada campo por callback. Las reglas de
// negocio (conflicto de horario, concurrencia optimista, auditoria) viven en el contenedor
// que lo consume (hoy `JornadasView`, mañana el modal de 12.9), NO aca — el objetivo del
// extract era mover el markup sin cambiar comportamiento, no reimplementar validaciones.
//
// Rediseño del modal de edicion singular (post-cierre modulo 12, ver CIERRE CENTRO DE
// ESTUDIOS.md): decision explicita del usuario de reducir la pestana "Programa" DENTRO de
// `ModalEdicionJornada.tsx` a solo Fecha/Hora inicio/Hora fin/Sede/Instructor -- Programa,
// Grupo y Espacio dejan de editarse desde ahi (ya no tiene sentido reasignar el programa/
// grupo/espacio de UNA clase puntual una vez creada). Pero este componente sigue siendo
// COMPARTIDO con `JornadasView.tsx` (creacion de clases nuevas), que SI necesita esos 3
// selectores -- por eso se vuelven opcionales (mismo patron ya usado por fecha/hora): cada
// bloque solo se renderiza si su callback on*Change esta presente. `Estado` (selector +
// opciones) y el checklist de "Grados excluidos de esta clase" se ELIMINAN por completo de
// este componente (no son opcionales, no existen mas aca): grep confirmo que `JornadasView`
// nunca los uso, son exclusivos del modal de edicion, que ahora los maneja de otra forma
// (Estado: fuera del alcance de esta pestana; grados excluidos: el usuario lo encontraba
// confuso por parecerse al paso "GRADOS" del wizard de materiales, que es un concepto
// distinto).

export interface OpcionesProgramaJornada {
  programas: OpcionJornada[];
  grupos: OpcionJornada[];
  sedes: OpcionJornada[];
  espacios: OpcionJornada[];
  instructores: OpcionJornada[];
}

export interface PestanaProgramaJornadaProps {
  // Solo los campos que este formulario edita; se acepta un subset para que un draft parcial
  // (p.ej. el del modal de 12.9) tambien encaje sin exigir una JornadaInstruccion completa.
  jornada: Pick<JornadaInstruccion, 'programaId' | 'grupoId' | 'sedeId' | 'espacioId' | 'instructorId'>;
  opciones: OpcionesProgramaJornada;
  // Rediseño post-cierre modulo 12: Programa/Grupo/Espacio pasan a ser OPCIONALES. Cada
  // bloque JSX solo se renderiza si su callback on*Change esta presente -- mismo patron que
  // ya usaban fecha/hora. `JornadasView.tsx` sigue pasando los 3 (crear una clase requiere
  // elegirlos) y ve exactamente el mismo markup de 5 columnas que antes. El modal de edicion
  // singular deja de pasarlos: esa clase ya nacio con un programa/grupo/espacio fijo, no se
  // reasigna desde ahi.
  onProgramaChange?: (programaId: string) => void;
  onGrupoChange?: (grupoId: string) => void;
  // Sede e Instructor quedan SIEMPRE obligatorios/visibles: los dos consumidores (crear
  // clase y editar clase) necesitan poder cambiarlos.
  onSedeChange: (sedeId: string) => void;
  onEspacioChange?: (espacioId: string) => void;
  onInstructorChange: (instructorId: string) => void;
  // Subtarea 12.9 (seccion 6 del documento de mejora: "Hora de inicio", "Hora de
  // finalizacion", "Fecha de la clase" son campos minimos de la pestana Programa que
  // JornadasView.tsx nunca edito -- esa vista solo los muestra como texto de solo lectura
  // fuera de este componente). TODOS opcionales y cada bloque solo se renderiza si su
  // callback on*Change esta presente, para que JornadasView.tsx (que no pasa ninguno de
  // estos props) siga viendo exactamente el mismo markup que antes.
  fecha?: string;
  onFechaChange?: (fecha: string) => void;
  horaInicio?: string;
  onHoraInicioChange?: (horaInicio: string) => void;
  horaFin?: string;
  onHoraFinChange?: (horaFin: string) => void;
  // Subtarea 12.9 (seccion 9/11 del documento de mejora): si el usuario que edita es el
  // maestro asignado (no admin), no puede reasignar la clase a otro maestro. El modal de
  // edicion calcula esta condicion (a partir de rol/usuarioId) y la pasa aca; este
  // componente no conoce roles, solo deshabilita el select cuando se lo piden.
  instructorDeshabilitado?: boolean;
}

const CLASE_LABEL = 'text-[10px] font-black uppercase tracking-widest text-gray-400';
const CLASE_SELECT = 'rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold';

// Rediseño post-cierre modulo 12: la cantidad de columnas visibles de cada grid ahora
// depende de que callbacks pase el consumidor (JornadasView pasa los 5 campos de la fila de
// Programa/Grupo/Sede/Espacio/Instructor; ModalEdicionJornada solo pasa Sede+Instructor).
// Se resuelve con un mapa fijo (en vez de una clase Tailwind interpolada) porque Tailwind
// necesita ver la clase completa en el código para generarla.
const CLASE_GRID_POR_CANTIDAD: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
};

const PestanaProgramaJornada: React.FC<PestanaProgramaJornadaProps> = ({
  jornada,
  opciones,
  onProgramaChange,
  onGrupoChange,
  onSedeChange,
  onEspacioChange,
  onInstructorChange,
  fecha,
  onFechaChange,
  horaInicio,
  onHoraInicioChange,
  horaFin,
  onHoraFinChange,
  instructorDeshabilitado = false,
}) => {
  const cantidadCamposFechaHora = [onFechaChange, onHoraInicioChange, onHoraFinChange].filter(Boolean).length;
  const cantidadCamposPrograma = 2 + [onProgramaChange, onGrupoChange, onEspacioChange].filter(Boolean).length;

  return (
    <div className="grid gap-4">
      {cantidadCamposFechaHora > 0 && (
        <div className={`grid gap-4 ${CLASE_GRID_POR_CANTIDAD[cantidadCamposFechaHora] ?? 'md:grid-cols-3'}`}>
          {onFechaChange && (
            <div className="grid gap-2">
              <label htmlFor="jornada-fecha" className={CLASE_LABEL}>
                Fecha de la clase
              </label>
              <input
                id="jornada-fecha"
                type="date"
                value={fecha ?? ''}
                onChange={(event) => onFechaChange(event.target.value)}
                className={CLASE_SELECT}
              />
            </div>
          )}
          {onHoraInicioChange && (
            <div className="grid gap-2">
              <label htmlFor="jornada-hora-inicio" className={CLASE_LABEL}>
                Hora de inicio
              </label>
              <input
                id="jornada-hora-inicio"
                type="time"
                value={horaInicio ?? ''}
                onChange={(event) => onHoraInicioChange(event.target.value)}
                className={CLASE_SELECT}
              />
            </div>
          )}
          {onHoraFinChange && (
            <div className="grid gap-2">
              <label htmlFor="jornada-hora-fin" className={CLASE_LABEL}>
                Hora de fin
              </label>
              <input
                id="jornada-hora-fin"
                type="time"
                value={horaFin ?? ''}
                onChange={(event) => onHoraFinChange(event.target.value)}
                className={CLASE_SELECT}
              />
            </div>
          )}
        </div>
      )}
      <div className={`grid gap-4 ${CLASE_GRID_POR_CANTIDAD[cantidadCamposPrograma] ?? 'md:grid-cols-5'}`}>
        {onProgramaChange && (
          <div className="grid gap-2">
            <label htmlFor="jornada-programa" className={CLASE_LABEL}>
              Programa
            </label>
            <select
              id="jornada-programa"
              value={jornada.programaId}
              onChange={(event) => onProgramaChange(event.target.value)}
              className={CLASE_SELECT}
            >
              {opciones.programas.map((programaOpcion) => (
                <option key={programaOpcion.id} value={programaOpcion.id}>{programaOpcion.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {onGrupoChange && (
          <div className="grid gap-2">
            <label htmlFor="jornada-grupo" className={CLASE_LABEL}>
              Grupo
            </label>
            <select
              id="jornada-grupo"
              value={jornada.grupoId}
              onChange={(event) => onGrupoChange(event.target.value)}
              className={CLASE_SELECT}
            >
              {opciones.grupos.map((grupo) => (
                <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid gap-2">
          <label htmlFor="jornada-sede" className={CLASE_LABEL}>
            Sede
          </label>
          <select
            id="jornada-sede"
            value={jornada.sedeId}
            onChange={(event) => onSedeChange(event.target.value)}
            className={CLASE_SELECT}
          >
            {opciones.sedes.map((sede) => (
              <option key={sede.id} value={sede.id}>{sede.nombre}</option>
            ))}
          </select>
        </div>

        {onEspacioChange && (
          <div className="grid gap-2">
            <label htmlFor="jornada-espacio" className={CLASE_LABEL}>
              Espacio
            </label>
            <select
              id="jornada-espacio"
              value={jornada.espacioId}
              onChange={(event) => onEspacioChange(event.target.value)}
              className={CLASE_SELECT}
            >
              {opciones.espacios.map((espacio) => (
                <option key={espacio.id} value={espacio.id}>{espacio.nombre}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid gap-2">
          <label htmlFor="jornada-instructor" className={CLASE_LABEL}>
            Instructor
          </label>
          <select
            id="jornada-instructor"
            value={jornada.instructorId}
            onChange={(event) => onInstructorChange(event.target.value)}
            disabled={instructorDeshabilitado}
            className={`${CLASE_SELECT} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {opciones.instructores.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>{instructor.nombre}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default PestanaProgramaJornada;
