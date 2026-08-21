
// components/ModalEditarRegistroCenso.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { RegistroTemporal } from '../tipos';
import type { AlertaCenso } from '../utils/censoInconsistencias';
import { IconoCerrar } from './Iconos';

interface Props {
    registro: RegistroTemporal;
    onGuardar: (id: string, datos: RegistroTemporal['datos']) => Promise<void>;
    onCerrar: () => void;
    guardando: boolean;
    // Alertas ya calculadas por detectarInconsistencias para este registro -- se usan para
    // resaltar el campo puntual con el error (borde rojo + texto debajo) y hacerle scroll al
    // primero al abrir. En mobile no hay hover para leer el tooltip del badge que abrió este
    // modal, así que esta es la única forma real de "llevar" al tenant hasta el dato mal
    // capturado en vez de que tenga que escanear los ~15 campos a mano.
    alertas?: AlertaCenso[];
}

// Editor liviano acotado a RegistroTemporal.datos -- distinto de FormularioEstudiante
// (formulario grande de alta oficial, con grado/sede/facturación) y distinto de aprobar o
// rechazar (validarRegistroTemporal, censoApi.ts): esto SOLO corrige lo que el aspirante
// tecleó mal en CensoPublico.tsx, sin decidir el estado del registro.
const ModalEditarRegistroCenso: React.FC<Props> = ({ registro, onGuardar, onCerrar, guardando, alertas = [] }) => {
    const [datos, setDatos] = useState<RegistroTemporal['datos']>({ ...registro.datos });
    const formRef = useRef<HTMLFormElement>(null);

    const erroresPorCampo = useMemo(() => {
        const mapa = new Map<string, string[]>();
        alertas.forEach(a => mapa.set(a.campo, [...(mapa.get(a.campo) || []), a.mensaje]));
        return mapa;
    }, [alertas]);

    // Al abrir con alertas pendientes, lleva la vista (scroll + foco) directo al primer campo
    // marcado -- sin esto, en un modal largo el tenant tendría que buscarlo por su cuenta.
    useEffect(() => {
        if (alertas.length === 0 || !formRef.current) return;
        const primerCampo = formRef.current.querySelector<HTMLElement>(`[name="${alertas[0].campo}"]`);
        primerCampo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        primerCampo?.focus();
        // Solo al montar: es la posición inicial del modal, no debe re-disparar en cada tecleo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    const claseInput = (campo: string) =>
        `w-full bg-gray-50 dark:bg-gray-800 border-2 rounded-2xl py-3 px-4 font-bold text-sm outline-none transition-all dark:text-white ${erroresPorCampo.has(campo) ? 'border-tkd-red focus:border-tkd-red' : 'border-transparent focus:border-tkd-blue'
        }`;
    const labelClass = "text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest";

    const CampoError: React.FC<{ campo: string }> = ({ campo }) => {
        const mensajes = erroresPorCampo.get(campo);
        if (!mensajes) return null;
        return <p className="mt-1.5 text-[9px] font-bold text-tkd-red uppercase tracking-wide">{mensajes.join(' · ')}</p>;
    };

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
                            {alertas.length > 0
                                ? `Revisá los ${alertas.length} campo(s) marcados en rojo -- esto no aprueba ni rechaza el registro.`
                                : 'Ajusta la información que el aspirante capturó mal. Esto no aprueba ni rechaza el registro.'}
                        </p>
                    </div>
                    <button type="button" onClick={onCerrar} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all flex-shrink-0">
                        <IconoCerrar className="w-6 h-6" />
                    </button>
                </div>

                <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClass}>Nombres</label>
                            <input name="nombres" type="text" required className={claseInput('nombres')} value={datos.nombres} onChange={handleChange} />
                            <CampoError campo="nombres" />
                        </div>
                        <div>
                            <label className={labelClass}>Apellidos</label>
                            <input name="apellidos" type="text" required className={claseInput('apellidos')} value={datos.apellidos} onChange={handleChange} />
                            <CampoError campo="apellidos" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClass}>Email Contacto</label>
                            <input name="email" type="email" required className={claseInput('email')} value={datos.email} onChange={handleChange} />
                            <CampoError campo="email" />
                        </div>
                        <div>
                            <label className={labelClass}>WhatsApp</label>
                            <input name="telefono" type="tel" required className={claseInput('telefono')} value={datos.telefono} onChange={handleChange} />
                            <CampoError campo="telefono" />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Fecha de Nacimiento</label>
                        <input name="fechaNacimiento" type="date" required className={claseInput('fechaNacimiento')} value={datos.fechaNacimiento} onChange={handleChange} />
                        <CampoError campo="fechaNacimiento" />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className={labelClass}>EPS / Salud</label>
                            <input name="eps" type="text" className={claseInput('eps')} value={datos.eps || ''} onChange={handleChange} />
                        </div>
                        <div>
                            <label className={labelClass}>RH / Sangre</label>
                            <select name="rh" className={claseInput('rh')} value={datos.rh || ''} onChange={handleChange}>
                                <option value="">Seleccionar...</option>
                                {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClass}>Dirección Residencia</label>
                            <input name="direccion" type="text" className={claseInput('direccion')} value={datos.direccion || ''} onChange={handleChange} />
                        </div>
                        <div>
                            <label className={labelClass}>Barrio</label>
                            <input name="barrio" type="text" className={claseInput('barrio')} value={datos.barrio || ''} onChange={handleChange} />
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
                                <input name="tutorNombre" type="text" className={claseInput('tutorNombre')} value={datos.tutorNombre || ''} onChange={handleChange} />
                                <CampoError campo="tutorNombre" />
                            </div>
                            <div>
                                <label className={labelClass}>Apellidos Tutor</label>
                                <input name="tutorApellidos" type="text" className={claseInput('tutorApellidos')} value={datos.tutorApellidos || ''} onChange={handleChange} />
                            </div>
                            <div>
                                <label className={labelClass}>Cédula Tutor</label>
                                <input name="tutorCedula" type="text" className={claseInput('tutorCedula')} value={datos.tutorCedula || ''} onChange={handleChange} />
                            </div>
                            <div>
                                <label className={labelClass}>Correo Tutor</label>
                                <input name="tutorEmail" type="email" className={claseInput('tutorEmail')} value={datos.tutorEmail || ''} onChange={handleChange} />
                            </div>
                            <div>
                                <label className={labelClass}>WhatsApp Tutor</label>
                                <input name="tutorTelefono" type="tel" className={claseInput('tutorTelefono')} value={datos.tutorTelefono || ''} onChange={handleChange} />
                                <CampoError campo="tutorTelefono" />
                            </div>
                            <div>
                                <label className={labelClass}>Parentesco</label>
                                <select name="parentesco" className={claseInput('parentesco')} value={datos.parentesco || 'Padre'} onChange={handleChange}>
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
