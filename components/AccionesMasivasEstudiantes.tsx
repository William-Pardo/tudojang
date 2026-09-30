// components/AccionesMasivasEstudiantes.tsx
// Barra de acciones masivas del Directorio (aparece con >= 1 estudiante seleccionado):
// asignar grupo de entrenamiento o grado a varios alumnos a la vez. Flujo: elegir valor ->
// confirmar (con la lista de nombres) -> aplicar -> resultado "X actualizados, Y fallaron"
// con reintento SOLO de los fallidos. La escritura real la hace onAplicar
// (DataContext.aplicarCambioMasivoEstudiantes -> un updateDoc parcial por estudiante).
import React, { useState } from 'react';
import type { Estudiante, GrupoEntrenamiento } from '../tipos';
import { GradoTKD } from '../tipos';
import type { CambioMasivoEstudiante, ResultadoCambioMasivo } from '../servicios/estudiantesApi';
import { ETIQUETA_SIN_GRUPO } from '../utils/gruposEntrenamiento';

type TipoAccion = 'grupoEntrenamiento' | 'grado';
type Paso = 'elegir' | 'confirmar' | 'aplicando' | 'resultado';

interface Props {
    seleccionados: Estudiante[];
    gruposEntrenamiento: GrupoEntrenamiento[];
    onAplicar: (ids: string[], cambio: CambioMasivoEstudiante) => Promise<ResultadoCambioMasivo>;
    onLimpiarSeleccion: () => void;
    onNotificar?: (mensaje: string, tipo: 'success' | 'error' | 'warning' | 'info') => void;
}

const nombreCompleto = (e: Estudiante) => `${e.nombres} ${e.apellidos}`.trim();

const AccionesMasivasEstudiantes: React.FC<Props> = ({ seleccionados, gruposEntrenamiento, onAplicar, onLimpiarSeleccion, onNotificar }) => {
    const [accion, setAccion] = useState<TipoAccion | null>(null);
    const [paso, setPaso] = useState<Paso>('elegir');
    const [valor, setValor] = useState('');
    // Snapshot de los alumnos a los que apunta la operación en curso: la lista del
    // resultado y el reintento no deben cambiar si la selección/filtros cambian por debajo.
    const [objetivo, setObjetivo] = useState<Estudiante[]>([]);
    const [resultado, setResultado] = useState<ResultadoCambioMasivo | null>(null);

    if (seleccionados.length === 0 && !accion) return null;

    const abrir = (tipo: TipoAccion) => {
        setAccion(tipo);
        setPaso('elegir');
        setValor(tipo === 'grado' ? GradoTKD.Blanco : '');
        setObjetivo([]);
        setResultado(null);
    };

    const cerrar = () => {
        setAccion(null);
        setPaso('elegir');
        setObjetivo([]);
        setResultado(null);
    };

    const construirCambio = (): CambioMasivoEstudiante =>
        accion === 'grado'
            ? { campo: 'grado', valor: valor as GradoTKD }
            : { campo: 'grupoEntrenamientoId', valor: valor || null };

    const etiquetaValor = accion === 'grado'
        ? valor
        : (gruposEntrenamiento.find(g => g.id === valor)?.nombre ?? ETIQUETA_SIN_GRUPO);
    const etiquetaCampo = accion === 'grado' ? 'el grado' : 'el grupo de entrenamiento';

    const ejecutar = async (estudiantes: Estudiante[]) => {
        setPaso('aplicando');
        let res: ResultadoCambioMasivo;
        try {
            res = await onAplicar(estudiantes.map(e => e.id), construirCambio());
        } catch (error) {
            // aplicarCambioMasivoEstudiantes usa allSettled y no debería lanzar; si igual
            // pasa, se trata como fallo de todos para no dejar el modal colgado.
            const motivo = error instanceof Error ? error.message : String(error);
            res = { exitosos: [], fallidos: estudiantes.map(e => ({ id: e.id, error: motivo })) };
        }
        // Al reintentar, los que ya se habían guardado en la primera pasada siguen contando.
        const exitososPrevios = resultado?.exitosos ?? [];
        const combinado: ResultadoCambioMasivo = {
            exitosos: [...exitososPrevios, ...res.exitosos],
            fallidos: res.fallidos,
        };
        setResultado(combinado);
        if (combinado.fallidos.length === 0) {
            onNotificar?.(`${combinado.exitosos.length} alumnos actualizados.`, 'success');
            onLimpiarSeleccion();
            cerrar();
        } else {
            setPaso('resultado');
        }
    };

    const confirmar = () => {
        const lista = [...seleccionados];
        setObjetivo(lista);
        ejecutar(lista);
    };

    const reintentarFallidos = () => {
        const idsFallidos = new Set(resultado?.fallidos.map(f => f.id));
        ejecutar(objetivo.filter(e => idsFallidos.has(e.id)));
    };

    const cerrarResultado = () => {
        onLimpiarSeleccion();
        cerrar();
    };

    const botonSecundario = "px-5 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-all";
    const botonPrimario = "px-5 py-3 bg-tkd-blue text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-blue-800 transition-all disabled:opacity-50";

    const nombresPorId = new Map(objetivo.map(e => [e.id, nombreCompleto(e)]));

    return (
        <>
            {seleccionados.length > 0 && (
                <div role="region" aria-label="Acciones masivas" className="sticky top-2 z-30 bg-tkd-dark text-white rounded-2xl shadow-xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <p className="text-xs font-black uppercase tracking-widest">
                        {seleccionados.length} {seleccionados.length === 1 ? 'alumno seleccionado' : 'alumnos seleccionados'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => abrir('grupoEntrenamiento')} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-xl font-black uppercase text-[10px] tracking-widest">
                            Asignar grupo de entrenamiento
                        </button>
                        <button type="button" onClick={() => abrir('grado')} className="px-4 py-2 bg-tkd-blue hover:bg-blue-800 rounded-xl font-black uppercase text-[10px] tracking-widest">
                            Asignar grado
                        </button>
                        <button type="button" onClick={onLimpiarSeleccion} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl font-black uppercase text-[10px] tracking-widest">
                            Quitar selección
                        </button>
                    </div>
                </div>
            )}

            {accion && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-tkd-dark/80 p-4 backdrop-blur-sm">
                    <div role="dialog" aria-modal="true" aria-label={accion === 'grado' ? 'Asignar grado' : 'Asignar grupo de entrenamiento'} className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
                        <header className="p-6 border-b dark:border-gray-800">
                            <h2 className="text-lg font-black uppercase text-tkd-dark dark:text-white tracking-tight">
                                {accion === 'grado' ? 'Asignar grado' : 'Asignar grupo de entrenamiento'}
                            </h2>
                        </header>

                        <div className="p-6 overflow-y-auto space-y-4">
                            {paso === 'elegir' && (
                                <div className="space-y-2">
                                    <label htmlFor="valor-masivo" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        {accion === 'grado' ? 'Nuevo grado' : 'Nuevo grupo de entrenamiento'}
                                    </label>
                                    <select id="valor-masivo" value={valor} onChange={e => setValor(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white">
                                        {accion === 'grado'
                                            ? Object.values(GradoTKD).map(g => <option key={g} value={g}>{g}</option>)
                                            : <>
                                                <option value="">{ETIQUETA_SIN_GRUPO}</option>
                                                {gruposEntrenamiento.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                                            </>}
                                    </select>
                                    <p className="text-[10px] font-bold text-gray-500">Se aplicará a {seleccionados.length} {seleccionados.length === 1 ? 'alumno' : 'alumnos'}.</p>
                                </div>
                            )}

                            {paso === 'confirmar' && (
                                <div className="space-y-3">
                                    <p className="text-sm font-black text-gray-900 dark:text-white">
                                        Vas a cambiar {etiquetaCampo} de {seleccionados.length} {seleccionados.length === 1 ? 'alumno' : 'alumnos'} a {etiquetaValor}
                                    </p>
                                    <ul aria-label="Alumnos a actualizar" className="max-h-60 overflow-y-auto text-xs font-bold text-gray-600 dark:text-gray-300 space-y-1 bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                                        {seleccionados.map(e => <li key={e.id}>{nombreCompleto(e)}</li>)}
                                    </ul>
                                </div>
                            )}

                            {paso === 'aplicando' && (
                                <p className="text-sm font-black text-gray-500 uppercase tracking-widest">Aplicando cambios...</p>
                            )}

                            {paso === 'resultado' && resultado && (
                                <div className="space-y-3">
                                    <p className="text-sm font-black text-gray-900 dark:text-white">
                                        {resultado.exitosos.length} actualizados, {resultado.fallidos.length} fallaron
                                    </p>
                                    <ul aria-label="Alumnos que fallaron" className="max-h-60 overflow-y-auto text-xs font-bold text-tkd-red space-y-1 bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
                                        {resultado.fallidos.map(f => <li key={f.id} title={f.error}>{nombresPorId.get(f.id) ?? f.id}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <footer className="p-6 border-t dark:border-gray-800 flex justify-end gap-3">
                            {paso === 'elegir' && <>
                                <button type="button" onClick={cerrar} className={botonSecundario}>Cancelar</button>
                                <button type="button" onClick={() => setPaso('confirmar')} className={botonPrimario}>Continuar</button>
                            </>}
                            {paso === 'confirmar' && <>
                                <button type="button" onClick={() => setPaso('elegir')} className={botonSecundario}>Volver</button>
                                <button type="button" onClick={confirmar} className={botonPrimario}>Confirmar</button>
                            </>}
                            {paso === 'resultado' && <>
                                <button type="button" onClick={cerrarResultado} className={botonSecundario}>Cerrar</button>
                                <button type="button" onClick={reintentarFallidos} className={botonPrimario}>Reintentar fallidos</button>
                            </>}
                        </footer>
                    </div>
                </div>
            )}
        </>
    );
};

export default AccionesMasivasEstudiantes;
