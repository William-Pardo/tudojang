
// components/ModalEditarRegistroCenso.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { RegistroTemporal } from '../tipos';
import { IconoCerrar } from './Iconos';

interface Props {
    registro: RegistroTemporal;
    onGuardar: (id: string, datos: RegistroTemporal['datos']) => Promise<void>;
    onCerrar: () => void;
    guardando: boolean;
}

// Editor liviano acotado a RegistroTemporal.datos -- distinto de FormularioEstudiante
// (formulario grande de alta oficial, con grado/sede/facturación) y distinto de aprobar o
// rechazar (validarRegistroTemporal, censoApi.ts): esto SOLO corrige lo que el aspirante
// tecleó mal en CensoPublico.tsx, sin decidir el estado del registro.
const ModalEditarRegistroCenso: React.FC<Props> = ({ registro, onGuardar, onCerrar, guardando }) => {
    const [datos, setDatos] = useState<RegistroTemporal['datos']>({ ...registro.datos });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        // Mismo criterio de mayúsculas que CensoPublico.tsx (handleInputChange), salvo los
        // correos -- forzarlos a mayúsculas los dejaría inválidos para el envío de emails.
        const esCorreo = name === 'email' || name === 'tutorEmail';
        setDatos(prev => ({ ...prev, [name]: esCorreo ? value : value.toUpperCase() }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onGuardar(registro.id, datos);
    };

    const inputClass = "w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-tkd-blue rounded-2xl py-3 px-4 font-bold text-sm outline-none transition-all dark:text-white";
    const labelClass = "text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest";

    return (
        <div className="fixed inset-0 z-[250] bg-tkd-dark/95 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-white dark:bg-gray-900 rounded-[3rem] p-10 max-w-2xl w-full shadow-2xl border border-white/5 max-h-[90vh] overflow-y-auto"
            >
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight dark:text-white">Corregir Datos</h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 leading-relaxed max-w-md">
                            Ajusta la información que el aspirante capturó mal. Esto no aprueba ni rechaza el registro.
                        </p>
                    </div>
                    <button type="button" onClick={onCerrar} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all flex-shrink-0">
                        <IconoCerrar className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClass}>Nombres</label>
                            <input name="nombres" type="text" required className={inputClass} value={datos.nombres} onChange={handleChange} />
                        </div>
                        <div>
                            <label className={labelClass}>Apellidos</label>
                            <input name="apellidos" type="text" required className={inputClass} value={datos.apellidos} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClass}>Email Contacto</label>
                            <input name="email" type="email" required className={inputClass} value={datos.email} onChange={handleChange} />
                        </div>
                        <div>
                            <label className={labelClass}>WhatsApp</label>
                            <input name="telefono" type="tel" required className={inputClass} value={datos.telefono} onChange={handleChange} />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Fecha de Nacimiento</label>
                        <input name="fechaNacimiento" type="date" required className={inputClass} value={datos.fechaNacimiento} onChange={handleChange} />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className={labelClass}>EPS / Salud</label>
                            <input name="eps" type="text" className={inputClass} value={datos.eps || ''} onChange={handleChange} />
                        </div>
                        <div>
                            <label className={labelClass}>RH / Sangre</label>
                            <select name="rh" className={inputClass} value={datos.rh || ''} onChange={handleChange}>
                                <option value="">Seleccionar...</option>
                                {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClass}>Dirección Residencia</label>
                            <input name="direccion" type="text" className={inputClass} value={datos.direccion || ''} onChange={handleChange} />
                        </div>
                        <div>
                            <label className={labelClass}>Barrio</label>
                            <input name="barrio" type="text" className={inputClass} value={datos.barrio || ''} onChange={handleChange} />
                        </div>
                    </div>

                    {/* Bloque de tutor siempre visible (a diferencia de CensoPublico.tsx, que lo
                        oculta si edad >= 18): la corrección debe poder resolver justo el caso de
                        una fecha de nacimiento mal capturada que ocultó estos campos al aspirante
                        menor de edad -- no tendría sentido bloquear la corrección de lo que causó
                        el error original. */}
                    <div className="pt-6 border-t dark:border-gray-800 space-y-6">
                        <h3 className="text-sm font-black uppercase text-tkd-dark dark:text-white tracking-widest">Acudiente Responsable (si aplica)</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className={labelClass}>Nombres Tutor</label>
                                <input name="tutorNombre" type="text" className={inputClass} value={datos.tutorNombre || ''} onChange={handleChange} />
                            </div>
                            <div>
                                <label className={labelClass}>Apellidos Tutor</label>
                                <input name="tutorApellidos" type="text" className={inputClass} value={datos.tutorApellidos || ''} onChange={handleChange} />
                            </div>
                            <div>
                                <label className={labelClass}>Cédula Tutor</label>
                                <input name="tutorCedula" type="text" className={inputClass} value={datos.tutorCedula || ''} onChange={handleChange} />
                            </div>
                            <div>
                                <label className={labelClass}>Correo Tutor</label>
                                <input name="tutorEmail" type="email" className={inputClass} value={datos.tutorEmail || ''} onChange={handleChange} />
                            </div>
                            <div>
                                <label className={labelClass}>WhatsApp Tutor</label>
                                <input name="tutorTelefono" type="tel" className={inputClass} value={datos.tutorTelefono || ''} onChange={handleChange} />
                            </div>
                            <div>
                                <label className={labelClass}>Parentesco</label>
                                <select name="parentesco" className={inputClass} value={datos.parentesco || 'Padre'} onChange={handleChange}>
                                    <option value="Padre">Padre</option>
                                    <option value="Madre">Madre</option>
                                    <option value="Otro">Otro</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button type="button" onClick={onCerrar} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
                            Cancelar
                        </button>
                        <button type="submit" disabled={guardando} className="flex-1 py-4 bg-tkd-blue text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-blue-800 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                            {guardando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : null}
                            Guardar Corrección
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default ModalEditarRegistroCenso;
