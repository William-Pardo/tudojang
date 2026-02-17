
// vistas/CensoPublico.tsx
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTenant } from '../components/BrandingProvider';
import { registrarAspirantePublico } from '../servicios/censoApi';
import { IconoUsuario, IconoEnviar, IconoExitoAnimado, IconoInformacion, IconoAprobar } from '../components/Iconos';
import LogoDinamico from '../components/LogoDinamico';
import Loader from '../components/Loader';
import { formatearPrecio } from '../utils/formatters';

const CensoPublico: React.FC = () => {
    const { misionId } = useParams();
    const { tenant, estaCargado } = useTenant();
    const [edad, setEdad] = useState<number | null>(null);
    const [enviado, setEnviado] = useState(false);
    const [cargando, setCargando] = useState(false);

    const [formData, setFormData] = useState({
        nombres: '', apellidos: '', email: '', telefono: '',
        fechaNacimiento: '', eps: '', rh: '', direccion: '', barrio: '',
        tutorNombre: '', tutorApellidos: '', tutorCedula: '',
        tutorEmail: '', tutorTelefono: '', parentesco: 'Padre'
    });

    const calcularEdad = (fecha: string) => {
        if (!fecha) return null;
        const hoy = new Date();
        const cumpleanos = new Date(fecha);
        let edadCalculada = hoy.getFullYear() - cumpleanos.getFullYear();
        const m = hoy.getMonth() - cumpleanos.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < cumpleanos.getDate())) edadCalculada--;
        return edadCalculada;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
        if (name === 'fechaNacimiento') setEdad(calcularEdad(value));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setCargando(true);
        try {
            await registrarAspirantePublico(misionId || 'general', tenant?.tenantId || 'anon', formData);
            setEnviado(true);
        } catch (err) {
            console.error(err);
        } finally {
            setCargando(false);
        }
    };

    if (!estaCargado) return <div className="h-screen bg-tkd-dark flex items-center justify-center"><Loader texto="Autenticando Dojang..." /></div>;

    if (enviado) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 text-center transition-colors" style={{ backgroundColor: tenant?.colorPrimario }}>
                <div className="bg-white dark:bg-gray-950 p-10 rounded-[3rem] shadow-2xl max-w-md w-full animate-fade-in border border-white/10">
                    <IconoExitoAnimado className="mx-auto w-24 h-24" style={{ color: tenant?.colorSecundario }} />
                    <h2 className="text-3xl font-black text-tkd-dark dark:text-white uppercase mt-6 tracking-tight">¡Enviado!</h2>
                    <p className="text-gray-500 mt-4 font-medium uppercase text-xs tracking-widest leading-relaxed">
                        Tus datos han sido recibidos por {tenant?.nombreClub}. Pronto un Sabonim te contactará.
                    </p>
                    <button onClick={() => window.location.reload()} className="mt-8 w-full py-4 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl" style={{ backgroundColor: tenant?.colorSecundario }}>Nuevo Registro</button>
                </div>
            </div>
        );
    }

    const inputClass = "w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-tkd-blue rounded-2xl py-3 px-4 font-bold text-sm outline-none transition-all dark:text-white";

    return (
        <div className="min-h-screen py-12 px-6 flex flex-col items-center transition-colors" style={{ backgroundColor: tenant?.colorPrimario }}>
            <div className="mb-10 text-center animate-fade-in">
                <div className="bg-white p-5 rounded-[2rem] shadow-xl inline-block mb-4 border-b-4" style={{ borderBottomColor: tenant?.colorAcento }}>
                    <LogoDinamico className="w-20 h-20" />
                </div>
                <h1 className="text-white text-4xl font-black uppercase tracking-tighter drop-shadow-lg">{tenant?.nombreClub}</h1>
                <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Protocolo de Registro Oficial</p>
            </div>

            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/10">
                {/* BANNER DE INVERSIÓN */}
                <div className="bg-blue-600 p-8 text-white flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                            <IconoAprobar className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">
                                Matrícula / Formulario
                                {tenant?.activarMatriculaAnual && <span className="ml-1 text-white underline"> (COBRO ANUAL)</span>}
                            </p>
                            <p className="text-2xl font-black tracking-tighter">{formatearPrecio(tenant?.valorMatricula || 0)}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80 text-center sm:text-right">Mensualidad Base</p>
                        <p className="text-lg font-black tracking-tighter">{formatearPrecio(tenant?.valorMensualidad || 0)}</p>
                    </div>
                </div>

                <div className="p-8 sm:p-12 space-y-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Nombres Completos</label>
                            <input name="nombres" type="text" required className={inputClass} placeholder="EJ: JUAN" onChange={handleInputChange} />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Apellidos</label>
                            <input name="apellidos" type="text" required className={inputClass} placeholder="EJ: PEREZ" onChange={handleInputChange} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Email Contacto</label>
                            <input name="email" type="email" required className={inputClass} placeholder="EMAIL@EJEMPLO.COM" onChange={handleInputChange} />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">WhatsApp</label>
                            <input name="telefono" type="tel" required className={inputClass} placeholder="3001234567" onChange={handleInputChange} />
                        </div>
                    </div>

                    <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
                        <label className="text-[9px] font-black uppercase text-tkd-blue mb-2 block tracking-widest">Fecha de Nacimiento</label>
                        <input name="fechaNacimiento" type="date" required className={inputClass} onChange={handleInputChange} />
                        {edad !== null && <p className="mt-3 text-[10px] font-black uppercase text-tkd-red tracking-widest">Edad Detectada: {edad} Años</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">EPS / Salud</label>
                            <input name="eps" type="text" required className={inputClass} placeholder="EPS" onChange={handleInputChange} />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">RH / Sangre</label>
                            <select name="rh" required className={inputClass} onChange={handleInputChange}>
                                <option value="">Seleccionar...</option>
                                {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Dirección Residencia</label>
                            <input name="direccion" type="text" required className={inputClass} placeholder="CALLE/CARRERA..." onChange={handleInputChange} />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Barrio</label>
                            <input name="barrio" type="text" required className={inputClass} placeholder="BARRIO" onChange={handleInputChange} />
                        </div>
                    </div>

                    {edad !== null && edad < 18 && (
                        <div className="pt-8 border-t dark:border-gray-800 animate-slide-in-right space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-tkd-red/10 rounded-2xl flex items-center justify-center">
                                    <IconoUsuario className="w-5 h-5 text-tkd-red" />
                                </div>
                                <h3 className="text-sm font-black uppercase text-tkd-dark dark:text-white tracking-widest">Acudiente Responsable</h3>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Nombres Tutor</label>
                                    <input name="tutorNombre" type="text" required className={inputClass} onChange={handleInputChange} />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Apellidos Tutor</label>
                                    <input name="tutorApellidos" type="text" required className={inputClass} onChange={handleInputChange} />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Cédula Tutor</label>
                                    <input name="tutorCedula" type="text" required className={inputClass} onChange={handleInputChange} />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">WhatsApp Tutor</label>
                                    <input name="tutorTelefono" type="tel" required className={inputClass} onChange={handleInputChange} />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Parentesco</label>
                                    <select name="parentesco" className={inputClass} onChange={handleInputChange}>
                                        <option value="Padre">Padre</option>
                                        <option value="Madre">Madre</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-10 border-t dark:border-gray-800">
                    <button type="submit" disabled={cargando} className="w-full py-5 text-white rounded-[2rem] font-black uppercase text-sm tracking-[0.3em] shadow-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4" style={{ backgroundColor: tenant?.colorSecundario }}>
                        {cargando ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : <IconoEnviar className="w-6 h-6" />}
                        Finalizar Registro
                    </button>
                </div>
            </form>

            <footer className="mt-12 text-center">
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Tudojang Core v4.3 • Protocolo de Carga Masiva</p>
            </footer>
        </div>
    );
};

export default CensoPublico;
