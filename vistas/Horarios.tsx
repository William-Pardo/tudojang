
// vistas/Horarios.tsx
import React, { useState, useMemo } from 'react';
import { useProgramas, useSedes, useConfiguracion, useConfiguracion as useDataConfig } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useNotificacion } from '../context/NotificacionContext';
import { IconoCasa, IconoUsuario, IconoAgregar, IconoInformacion, IconoEditar, IconoEliminar } from '../components/Iconos';
import LogoDinamico from '../components/LogoDinamico';
import ModalAgendarClase from '../components/ModalAgendarClase';
import { BloqueHorario, RolUsuario } from '../tipos';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const VistaHorarios: React.FC = () => {
    const { agendaCompleta, programas, actualizarPrograma, agregarPrograma } = useProgramas();
    const { sedesVisibles } = useSedes();
    const { usuarios } = useDataConfig();
    const { usuario } = useAuth();
    const { mostrarNotificacion } = useNotificacion();

    const [filtroSede, setFiltroSede] = useState('todas');
    const [filtroInstructor, setFiltroInstructor] = useState('todos');
    const [modalAbierto, setModalAbierto] = useState(false);
    const [bloqueEdit, setBloqueEdit] = useState<Partial<BloqueHorario> | null>(null);

    const esAdmin = usuario?.rol === RolUsuario.Admin || usuario?.rol === RolUsuario.SuperAdmin;
    const esInstructor = usuario?.rol === RolUsuario.Editor || usuario?.rol === RolUsuario.Asistente;

    // Si es instructor, por defecto filtrar por él mismo
    useState(() => {
        if (esInstructor && usuario?.id) {
            setFiltroInstructor(usuario.id);
        }
    });

    const agendaFiltrada = useMemo(() => {
        return agendaCompleta.filter(bloque => {
            const cumpleSede = filtroSede === 'todas' || bloque.sedeId === filtroSede;
            const cumpleInstructor = filtroInstructor === 'todos' || bloque.instructorId === filtroInstructor;
            return cumpleSede && cumpleInstructor;
        });
    }, [agendaCompleta, filtroSede, filtroInstructor]);

    const handleGuardarBloque = async (bloque: BloqueHorario) => {
        let programa = programas.find(p => p.id === bloque.programaId);

        // CASO: No existen programas configurados (Primer arranque o Limpieza)
        if (!programa && bloque.programaId === 'programa-base') {
            try {
                // Importamos el tipo dinámicamente o usamos fallback si es necesario
                const { TipoCobroPrograma } = await import('../tipos');
                programa = await agregarPrograma({
                    nombre: '🥋 Clase Regular (Base)',
                    tipoCobro: TipoCobroPrograma.Recurrente,
                    valor: 0,
                    bloquesHorarios: [],
                    descripcion: 'Sesión técnica regular de la academia.',
                    horario: 'Horario según agenda',
                    activo: true
                } as any);
                // Vinculamos el bloque al ID real generado por Firebase
                bloque.programaId = programa!.id;
            } catch (err) {
                mostrarNotificacion("Error al auto-configurar el programa base.", "error");
                return;
            }
        }

        if (!programa) return;

        const nuevosBloques = programa.bloquesHorarios ? [...programa.bloquesHorarios] : [];
        const index = nuevosBloques.findIndex(b => b.id === bloque.id);

        if (index >= 0) nuevosBloques[index] = bloque;
        else nuevosBloques.push(bloque);

        await actualizarPrograma({ ...programa, bloquesHorarios: nuevosBloques });
        setModalAbierto(false);
        mostrarNotificacion("Agenda actualizada correctamente.", "success");
    };

    const handleEliminarBloque = async (bloque: BloqueHorario) => {
        if (!window.confirm("¿Seguro que deseas eliminar este bloque de la agenda?")) return;
        const programa = programas.find(p => p.id === bloque.programaId);
        if (!programa || !programa.bloquesHorarios) return;

        const nuevosBloques = programa.bloquesHorarios.filter(b => b.id !== bloque.id);
        await actualizarPrograma({ ...programa, bloquesHorarios: nuevosBloques });
    };

    const getNombreInstructor = (id: string) => {
        return usuarios.find(u => u.id === id)?.nombreUsuario || 'Profesor Externo';
    };

    const getNombreSede = (id: string) => {
        return sedesVisibles.find(s => s.id === id)?.nombre || 'Sede Desconocida';
    };

    return (
        <div className="p-4 sm:p-10 space-y-10 animate-fade-in">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Agenda Maestro</h1>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-2">Planificación y Control de Sesiones Técnicas</p>
                </div>

                <div className="flex flex-wrap gap-4 w-full md:w-auto">
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-tkd-blue"><IconoCasa className="w-4 h-4" /></div>
                        <select
                            value={filtroSede}
                            onChange={(e) => setFiltroSede(e.target.value)}
                            className="bg-white dark:bg-gray-800 border-none rounded-xl pl-10 pr-6 py-3 text-[10px] font-black uppercase tracking-widest shadow-sm focus:ring-2 focus:ring-tkd-blue outline-none appearance-none cursor-pointer"
                        >
                            <option value="todas">Todas las Sedes</option>
                            {sedesVisibles.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                    </div>

                    {esAdmin && (
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-tkd-red"><IconoUsuario className="w-4 h-4" /></div>
                            <select
                                value={filtroInstructor}
                                onChange={(e) => setFiltroInstructor(e.target.value)}
                                className="bg-white dark:bg-gray-800 border-none rounded-xl pl-10 pr-6 py-3 text-[10px] font-black uppercase tracking-widest shadow-sm focus:ring-2 focus:ring-tkd-red outline-none appearance-none cursor-pointer"
                            >
                                <option value="todos">Todos los Instructores</option>
                                {usuarios.filter(u => u.rol !== RolUsuario.Tutor).map(u => (
                                    <option key={u.id} value={u.id}>{u.nombreUsuario}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </header>

            {/* REJILLA DINÁMICA */}
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
                {DIAS.map(dia => (
                    <div key={dia} className="space-y-4">
                        <div className="bg-tkd-dark text-white p-4 rounded-2xl text-center shadow-lg border border-white/10 group">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] group-hover:scale-110 transition-transform">{dia}</p>
                        </div>

                        <div className="space-y-3 min-h-[200px]">
                            {agendaFiltrada
                                .filter(b => b.dia === dia)
                                .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
                                .map(b => (
                                    <div key={b.id} className="bg-white dark:bg-gray-800 p-5 rounded-[2.2rem] border-2 border-transparent hover:border-tkd-blue/20 shadow-soft hover:shadow-premium transition-all group overflow-hidden relative">
                                        <div className="relative z-10 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div className="p-2 bg-tkd-blue/10 rounded-xl text-tkd-blue">
                                                    <LogoDinamico className="w-4 h-4" />
                                                </div>
                                                <div className="flex gap-1">
                                                    {esAdmin && (
                                                        <>
                                                            <button onClick={() => { setBloqueEdit(b); setModalAbierto(true); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-tkd-blue"><IconoEditar className="w-3 h-3" /></button>
                                                            <button onClick={() => handleEliminarBloque(b)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-tkd-red"><IconoEliminar className="w-3 h-3" /></button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="text-[11px] font-black uppercase text-gray-900 dark:text-white leading-tight">{b.nombrePrograma}</h4>
                                                <p className="text-[8px] font-bold text-tkd-blue uppercase mt-1">G: {b.grupo}</p>
                                                <p className="text-[7px] font-bold text-gray-400 uppercase mt-0.5">{getNombreSede(b.sedeId)}</p>
                                            </div>
                                            <div className="pt-2 border-t dark:border-white/5 flex justify-between items-center">
                                                <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase">{b.horaInicio}</p>
                                                <span className="text-[7px] font-black text-gray-300 uppercase">{getNombreInstructor(b.instructorId).split(' ')[0]}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                            {esAdmin && (
                                <button
                                    onClick={() => { setBloqueEdit({ dia: dia as any }); setModalAbierto(true); }}
                                    className="w-full py-4 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl flex items-center justify-center text-gray-300 hover:border-tkd-blue hover:text-tkd-blue transition-all group"
                                >
                                    <IconoAgregar className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white dark:bg-white/5 p-8 rounded-[3rem] border border-gray-100 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-tkd-blue/10 dark:bg-tkd-blue/20 rounded-2xl flex items-center justify-center">
                        <IconoInformacion className="w-8 h-8 text-tkd-blue" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase text-gray-900 dark:text-white tracking-tight">Estado de Operación</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Resumen de carga técnica semanal en todas las sedes.</p>
                    </div>
                </div>
                <div className="flex gap-12">
                    <div className="text-center">
                        <p className="text-3xl font-black text-tkd-blue">{agendaFiltrada.length}</p>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Bloques / Semana</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-black text-gray-900 dark:text-white">
                            {new Set(agendaFiltrada.map(b => b.instructorId)).size}
                        </p>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Instructores Activos</p>
                    </div>
                </div>
            </div>

            <ModalAgendarClase
                abierto={modalAbierto}
                onCerrar={() => setModalAbierto(false)}
                onGuardar={handleGuardarBloque}
                bloqueActual={bloqueEdit}
                programas={programas}
                sedes={sedesVisibles}
                usuarios={usuarios}
                mostrarNotificacion={mostrarNotificacion}
            />
        </div>
    );
};

export default VistaHorarios;
