// components/configuracion/GestionGruposEntrenamiento.tsx
// Catálogo de grupos de entrenamiento del club (Configuración > Grupos de Entrenamiento).
// Cada cambio (crear/renombrar/eliminar) se persiste de inmediato con onGuardar, que la vista
// conecta a la misma ruta de guardado de la configuración del club (guardarConfiguraciones).
// Eliminar un grupo con alumnos asignados solo lo quita del catálogo: los alumnos conservan
// el id huérfano y la UI los muestra como "Sin grupo" (sin escritura masiva de limpieza).
import React, { useState } from 'react';
import type { Estudiante, GrupoEntrenamiento } from '../../tipos';
import {
    agregarGrupoAlCatalogo,
    renombrarGrupoEnCatalogo,
    quitarGrupoDelCatalogo,
    contarEstudiantesEnGrupo,
} from '../../utils/gruposEntrenamiento';
import ModalConfirmacion from '../ModalConfirmacion';
import { IconoAgregar, IconoEditar, IconoEliminar } from '../Iconos';

interface Props {
    grupos: GrupoEntrenamiento[];
    estudiantes: Pick<Estudiante, 'grupoEntrenamientoId'>[];
    onGuardar: (grupos: GrupoEntrenamiento[]) => Promise<void>;
    onNotificar: (mensaje: string, tipo: 'success' | 'error' | 'warning' | 'info') => void;
}

const GestionGruposEntrenamiento: React.FC<Props> = ({ grupos, estudiantes, onGuardar, onNotificar }) => {
    const [nombreNuevo, setNombreNuevo] = useState('');
    const [edicion, setEdicion] = useState<{ id: string; nombre: string } | null>(null);
    const [grupoAEliminar, setGrupoAEliminar] = useState<GrupoEntrenamiento | null>(null);
    const [guardando, setGuardando] = useState(false);

    const persistir = async (calcular: () => GrupoEntrenamiento[], mensajeExito: string): Promise<boolean> => {
        let nuevos: GrupoEntrenamiento[];
        try {
            nuevos = calcular();
        } catch (error) {
            onNotificar(error instanceof Error ? error.message : 'Dato inválido.', 'warning');
            return false;
        }
        setGuardando(true);
        try {
            await onGuardar(nuevos);
            onNotificar(mensajeExito, 'success');
            return true;
        } catch (error) {
            onNotificar(`No se pudo guardar el grupo: ${error instanceof Error ? error.message : 'Error desconocido'}.`, 'error');
            return false;
        } finally {
            setGuardando(false);
        }
    };

    const crear = async (e: React.FormEvent) => {
        e.preventDefault();
        const ok = await persistir(() => agregarGrupoAlCatalogo(grupos, nombreNuevo), 'Grupo creado.');
        if (ok) setNombreNuevo('');
    };

    const guardarRenombre = async () => {
        if (!edicion) return;
        const ok = await persistir(() => renombrarGrupoEnCatalogo(grupos, edicion.id, edicion.nombre), 'Grupo renombrado.');
        if (ok) setEdicion(null);
    };

    const confirmarEliminacion = async () => {
        if (!grupoAEliminar) return;
        await persistir(() => quitarGrupoDelCatalogo(grupos, grupoAEliminar.id), 'Grupo eliminado.');
        setGrupoAEliminar(null);
    };

    const alumnosEnGrupoAEliminar = grupoAEliminar ? contarEstudiantesEnGrupo(estudiantes, grupoAEliminar.id) : 0;
    const inputClasses = "w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-3 text-xs font-black text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner transition-all";

    return (
        <div className="max-w-3xl space-y-8 animate-fade-in">
            <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-tkd-blue">Grupos de Entrenamiento</h3>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                    Niveles o clases de tu club (p. ej. Infantil, Avanzados). Son distintos del grupo por edad, que se calcula solo.
                </p>
            </div>

            <form onSubmit={crear} className="flex flex-col sm:flex-row gap-3">
                <label htmlFor="nuevo-grupo-entrenamiento" className="sr-only">Nombre del nuevo grupo</label>
                <input
                    id="nuevo-grupo-entrenamiento"
                    type="text"
                    value={nombreNuevo}
                    onChange={e => setNombreNuevo(e.target.value)}
                    placeholder="Nombre del grupo (ej. Avanzados)"
                    maxLength={60}
                    className={inputClasses}
                />
                <button type="submit" disabled={guardando || !nombreNuevo.trim()} className="bg-tkd-blue disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
                    <IconoAgregar className="w-4 h-4" /> Crear grupo
                </button>
            </form>

            {grupos.length === 0 ? (
                <div className="py-10 px-8 rounded-[2rem] border-2 border-dashed border-gray-200 dark:border-white/10 text-center">
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Aún no hay grupos de entrenamiento</p>
                </div>
            ) : (
                <ul className="space-y-3" aria-label="Grupos de entrenamiento">
                    {grupos.map(g => {
                        const cantidad = contarEstudiantesEnGrupo(estudiantes, g.id);
                        const editando = edicion?.id === g.id;
                        return (
                            <li key={g.id} className="tkd-card p-5 flex items-center justify-between gap-4">
                                {editando ? (
                                    <input
                                        aria-label={`Nuevo nombre para ${g.nombre}`}
                                        value={edicion!.nombre}
                                        onChange={e => setEdicion({ id: g.id, nombre: e.target.value })}
                                        maxLength={60}
                                        className={inputClasses}
                                        autoFocus
                                    />
                                ) : (
                                    <div>
                                        <p className="font-black uppercase text-sm dark:text-white">{g.nombre}</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{cantidad} {cantidad === 1 ? 'alumno' : 'alumnos'}</p>
                                    </div>
                                )}
                                <div className="flex gap-2 flex-shrink-0">
                                    {editando ? (
                                        <>
                                            <button type="button" onClick={guardarRenombre} disabled={guardando} className="px-4 py-2 bg-tkd-blue text-white rounded-xl font-black uppercase text-[10px] tracking-widest disabled:opacity-50">Guardar</button>
                                            <button type="button" onClick={() => setEdicion(null)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 rounded-xl font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                                        </>
                                    ) : (
                                        <>
                                            <button type="button" onClick={() => setEdicion({ id: g.id, nombre: g.nombre })} title={`Renombrar ${g.nombre}`} aria-label={`Renombrar ${g.nombre}`} className="p-2 text-gray-400 hover:text-tkd-blue"><IconoEditar className="w-4 h-4" /></button>
                                            <button type="button" onClick={() => setGrupoAEliminar(g)} title={`Eliminar ${g.nombre}`} aria-label={`Eliminar ${g.nombre}`} className="p-2 text-gray-400 hover:text-tkd-red"><IconoEliminar className="w-4 h-4" /></button>
                                        </>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            <ModalConfirmacion
                abierto={!!grupoAEliminar}
                titulo="Eliminar grupo de entrenamiento"
                mensaje={grupoAEliminar
                    ? (alumnosEnGrupoAEliminar > 0
                        ? `El grupo "${grupoAEliminar.nombre}" tiene ${alumnosEnGrupoAEliminar} ${alumnosEnGrupoAEliminar === 1 ? 'alumno asignado' : 'alumnos asignados'}. Si lo eliminas, esos alumnos quedarán como "Sin grupo". ¿Continuar?`
                        : `¿Eliminar el grupo "${grupoAEliminar.nombre}"?`)
                    : ''}
                onCerrar={() => setGrupoAEliminar(null)}
                onConfirmar={confirmarEliminacion}
                cargando={guardando}
                textoBotonConfirmar="Eliminar"
            />
        </div>
    );
};

export default GestionGruposEntrenamiento;
