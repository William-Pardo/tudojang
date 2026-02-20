
// components/ModalAgendarClase.tsx
import React, { useState, useEffect } from 'react';
import { BloqueHorario, Programa, Sede, Usuario, GrupoEdad, RolUsuario } from '../tipos';
import { IconoCerrar, IconoGuardar, IconoInformacion, IconoCasa, IconoUsuario, IconoLogoOficial } from './Iconos';

interface Props {
    abierto: boolean;
    onCerrar: () => void;
    onGuardar: (bloque: BloqueHorario) => Promise<void>;
    bloqueActual: Partial<BloqueHorario> | null;
    programas: Programa[];
    sedes: Sede[];
    usuarios: Usuario[];
    mostrarNotificacion?: (msg: string, tipo: 'success' | 'error' | 'warning' | 'info') => void;
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const ModalAgendarClase: React.FC<Props> = ({ abierto, onCerrar, onGuardar, bloqueActual, programas, sedes, usuarios, mostrarNotificacion }) => {
    const [formData, setFormData] = useState<Partial<BloqueHorario>>({});
    const [cargando, setCargando] = useState(false);

    useEffect(() => {
        if (abierto) {
            setFormData(bloqueActual || {
                dia: 'Lunes',
                horaInicio: '17:00',
                horaFin: '18:30',
                grupo: GrupoEdad.Infantil
            });
        }
    }, [abierto, bloqueActual]);

    const profesores = usuarios.filter(u =>
        u.rol === RolUsuario.Admin ||
        u.rol === RolUsuario.Editor ||
        u.rol === RolUsuario.Asistente
    );

    // Si no hay programas configurados, creamos uno virtual para que la UI no se bloquee
    const listaProgramas = programas.length > 0 ? programas : [{ id: 'programa-base', nombre: '🥋 Clase Regular (Base)', bloquesHorarios: [] }];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const progId = formData.programaId || (programas.length === 0 ? 'programa-base' : '');
        if (!progId || !formData.sedeId || !formData.instructorId) {
            mostrarNotificacion?.("Completa todos los campos obligatorios.", "warning");
            return;
        }

        // VALIDACIÓN DE TIEMPO
        const [h1, m1] = (formData.horaInicio || "00:00").split(':').map(Number);
        const [h2, m2] = (formData.horaFin || "00:00").split(':').map(Number);

        const minInicio = h1 * 60 + m1;
        const minFin = h2 * 60 + m2;
        const duracion = minFin - minInicio;

        if (duracion <= 0) {
            mostrarNotificacion?.("La hora de fin debe ser posterior a la de inicio.", "error");
            return;
        }
        if (duracion < 30) {
            mostrarNotificacion?.("La sesión debe durar al menos 30 minutos.", "warning");
            return;
        }
        if (duracion > 240) {
            mostrarNotificacion?.("La sesión no puede superar las 4 horas.", "warning");
            return;
        }

        setCargando(true);
        try {
            const bloqueFinal: BloqueHorario = {
                id: formData.id || `b-${Date.now()}`,
                dia: formData.dia as any,
                horaInicio: formData.horaInicio as string,
                horaFin: formData.horaFin as string,
                sedeId: formData.sedeId as string,
                instructorId: formData.instructorId as string,
                grupo: formData.grupo as GrupoEdad,
                programaId: progId,
                nombrePrograma: listaProgramas.find(p => p.id === progId)?.nombre || 'Clase Regular'
            };
            await onGuardar(bloqueFinal);
            onCerrar();
        } finally {
            setCargando(false);
        }
    };

    if (!abierto) return null;

    const inputStyle = "w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-4 text-sm font-black text-gray-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner transition-all";
    const labelStyle = "text-[10px] font-black uppercase text-gray-400 mb-2 ml-2 block tracking-widest";

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-tkd-dark/95 p-4 animate-fade-in backdrop-blur-md">
            <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl w-full max-w-lg p-10 space-y-8 overflow-hidden relative border border-gray-100 dark:border-white/10 mt-10 md:mt-0">
                <div className="text-center">
                    <h3 className="text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Planificar Bloque Técnico</h3>
                    <p className="text-[10px] font-black text-tkd-blue uppercase tracking-[0.2em] mt-2">Configuración de sesión en agenda</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className={labelStyle}>Programa Técnico</label>
                        <select
                            value={formData.programaId}
                            onChange={e => setFormData({ ...formData, programaId: e.target.value })}
                            className={inputStyle}
                            required
                        >
                            <option value="">Seleccione Programa</option>
                            {listaProgramas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelStyle}>Día</label>
                            <select
                                value={formData.dia}
                                onChange={e => setFormData({ ...formData, dia: e.target.value as any })}
                                className={inputStyle}
                            >
                                {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelStyle}>Grupo Etario</label>
                            <select
                                value={formData.grupo}
                                onChange={e => setFormData({ ...formData, grupo: e.target.value as any })}
                                className={inputStyle}
                            >
                                {Object.values(GrupoEdad).map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelStyle}>Hora Inicio</label>
                            <input
                                type="time"
                                value={formData.horaInicio}
                                onChange={e => setFormData({ ...formData, horaInicio: e.target.value })}
                                className={inputStyle}
                                required
                            />
                        </div>
                        <div>
                            <label className={labelStyle}>Hora Fin</label>
                            <input
                                type="time"
                                value={formData.horaFin}
                                onChange={e => setFormData({ ...formData, horaFin: e.target.value })}
                                className={inputStyle}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelStyle}>Sede / Dojang</label>
                            <select
                                value={formData.sedeId}
                                onChange={e => setFormData({ ...formData, sedeId: e.target.value })}
                                className={inputStyle}
                                required
                            >
                                <option value="">Seleccione Sede</option>
                                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelStyle}>Instructor Responsable</label>
                            <select
                                value={formData.instructorId}
                                onChange={e => setFormData({ ...formData, instructorId: e.target.value })}
                                className={inputStyle}
                                required
                            >
                                <option value="">Seleccione Instructor</option>
                                {profesores.map(u => <option key={u.id} value={u.id}>{u.nombreUsuario}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-3 pt-4">
                        <button
                            type="submit"
                            disabled={cargando}
                            className="w-full bg-tkd-red text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-red-700 transition-all active:scale-95 disabled:bg-gray-400"
                        >
                            {cargando ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : <IconoGuardar className="w-6 h-6" />}
                            {formData.id ? 'Actualizar Bloque' : 'Agendar Clase'}
                        </button>
                        <button type="button" onClick={onCerrar} className="w-full text-gray-400 font-black uppercase text-[10px] tracking-widest py-2 hover:text-gray-600 transition-colors">Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ModalAgendarClase;
