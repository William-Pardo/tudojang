
// vistas/CensoPublico.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTenant } from '../components/BrandingProvider';
import { registrarAspirantePublico, obtenerMisionPorId, verificarDuplicadoAspirante } from '../servicios/censoApi';
import { MISION_ID_DIRECTO } from '../constantes';
import { IconoUsuario, IconoEnviar, IconoExitoAnimado, IconoInformacion, IconoAprobar, IconoAlertaTriangulo } from '../components/Iconos';
import LogoDinamico from '../components/LogoDinamico';
import Loader from '../components/Loader';
import CountdownTimer from '../components/CountdownTimer';
import ModalConfirmacion from '../components/ModalConfirmacion';
import type { MisionKicho } from '../tipos';
import { formatearPrecio } from '../utils/formatters';
import { generarAlertasAsistenciales } from '../utils/validacionAsistencial';

const CensoPublico: React.FC = () => {
    const { misionId } = useParams();

    // Resolución del tenant (incluye ?club=slug cuando está presente en la URL) ya vive
    // centralizada en BrandingProvider -- antes esta vista tenía su propio bypass duplicado,
    // arreglando el síntoma acá en vez de la causa real (ver BrandingProvider.tsx).
    const { tenant, estaCargado } = useTenant();

    const [edad, setEdad] = useState<number | null>(null);
    const [enviado, setEnviado] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

    // El link fijo (MISION_ID_DIRECTO) nunca vence; una misión real sí -- se valida contra
    // Firestore (activa + fechaExpiracion) antes de mostrar el formulario, mismo criterio que
    // misionVigente() en firestore.rules del lado del servidor.
    const esMisionReal = !!misionId && misionId !== MISION_ID_DIRECTO;
    const [verificandoMision, setVerificandoMision] = useState(esMisionReal);
    const [misionInvalida, setMisionInvalida] = useState(false);
    // Se guarda la misión completa (no solo si es vigente) para poder mostrarle al
    // aspirante/tutor el mismo contador de cierre que ya ve el tenant en MisionKicho.tsx --
    // antes el plazo era invisible del lado del formulario público.
    const [mision, setMision] = useState<MisionKicho | null>(null);

    useEffect(() => {
        if (!esMisionReal) return;
        obtenerMisionPorId(misionId!)
            .then(m => {
                const vigente = !!m && m.activa && new Date(m.fechaExpiracion) > new Date();
                setMisionInvalida(!vigente);
                if (vigente) setMision(m);
            })
            .catch(() => setMisionInvalida(true))
            .finally(() => setVerificandoMision(false));
    }, [misionId]);

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

    // Chequeo de duplicados en vivo (on-blur, sin debounce) contra la Cloud Function pública
    // verificarDuplicadoAspirante -- nunca bloquea el formulario, solo alimenta la advertencia
    // inline y las alertas de confirmación previas al envío (ver alertasParaConfirmar).
    const [duplicados, setDuplicados] = useState<{ correoExiste: boolean; telefonoExiste: boolean }>({ correoExiste: false, telefonoExiste: false });

    // Alertas pendientes de confirmar (patrón "preguntar y confirmar", nunca rechazo
    // silencioso): si hay alguna, el envío real se frena hasta que el aspirante confirme
    // explícitamente desde el ModalConfirmacion.
    const [alertasConfirmacion, setAlertasConfirmacion] = useState<string[]>([]);
    const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
        if (name === 'fechaNacimiento') setEdad(calcularEdad(value));
    };

    const handleBlurCorreo = async (e: React.FocusEvent<HTMLInputElement>) => {
        const correo = e.target.value;
        if (!correo || !tenant?.tenantId) return;
        try {
            const resultado = await verificarDuplicadoAspirante(tenant.tenantId, { correo });
            setDuplicados(prev => ({ ...prev, correoExiste: resultado.correoExiste }));
        } catch (err) {
            // Silencioso: es una ayuda no-bloqueante -- un fallo de red acá no debe frenar
            // el llenado del formulario.
            console.error(err);
        }
    };

    const handleBlurTelefono = async (e: React.FocusEvent<HTMLInputElement>) => {
        const telefono = e.target.value;
        if (!telefono || !tenant?.tenantId) return;
        try {
            const resultado = await verificarDuplicadoAspirante(tenant.tenantId, { telefono });
            setDuplicados(prev => ({ ...prev, telefonoExiste: resultado.telefonoExiste }));
        } catch (err) {
            console.error(err);
        }
    };

    // Combina los flags de duplicado (ya verificados en blur) con las heurísticas de
    // asistenciales (edad implausible, nombre del alumno calcado del tutor) recalculadas al
    // momento del envío -- array vacío si no hay nada raro que confirmar.
    const alertasParaConfirmar = (): string[] => {
        const alertas = generarAlertasAsistenciales({
            edad: calcularEdad(formData.fechaNacimiento),
            nombres: formData.nombres,
            apellidos: formData.apellidos,
            tutorNombres: formData.tutorNombre,
            tutorApellidos: formData.tutorApellidos,
        });
        if (duplicados.correoExiste) alertas.push('Ya existe un registro con este correo en nuestro sistema.');
        if (duplicados.telefonoExiste) alertas.push('Ya existe un registro con este teléfono en nuestro sistema.');
        return alertas;
    };

    const enviarFormulario = async () => {
        setCargando(true);
        setErrorEnvio(null);
        try {
            await registrarAspirantePublico(misionId || 'general', tenant?.tenantId || 'anon', formData);
            setEnviado(true);
        } catch (err) {
            // Fix (2026-08-10): antes este catch solo hacia console.error -- el aspirante
            // (sin acceso a la consola del navegador) no se enteraba de nada si el envio
            // fallaba (ej. permission-denied porque el tenant/mision aun no cargo, o la
            // mision vencio). El boton volvia a su estado normal en silencio, sin exito NI
            // error, indistinguible de que "no paso nada".
            console.error(err);
            setErrorEnvio('No pudimos enviar tu registro. Verifica tu conexión e intenta de nuevo; si el problema sigue, contacta directamente a tu academia.');
        } finally {
            setCargando(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const alertas = alertasParaConfirmar();
        if (alertas.length > 0) {
            setAlertasConfirmacion(alertas);
            return;
        }
        await enviarFormulario();
    };

    const handleConfirmarEnvio = async () => {
        setConfirmandoEnvio(true);
        try {
            await enviarFormulario();
        } finally {
            setConfirmandoEnvio(false);
            setAlertasConfirmacion([]);
        }
    };

    if (!estaCargado || verificandoMision) return <div className="h-screen bg-tkd-dark flex items-center justify-center"><Loader texto="Autenticando Dojang..." /></div>;

    if (misionInvalida) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-tkd-dark p-6 text-center">
                <IconoAlertaTriangulo className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-white font-black uppercase">Link No Disponible</h1>
                <p className="text-gray-400 mt-2 max-w-sm">Este formulario de registro ya no está activo. Contacta directamente a tu academia para conseguir un link vigente.</p>
            </div>
        );
    }

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
                {mision && (
                    <div className="flex justify-center mt-4">
                        <CountdownTimer fechaExpiracion={mision.fechaExpiracion} />
                    </div>
                )}
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
                            <input name="email" type="email" required className={inputClass} placeholder="EMAIL@EJEMPLO.COM" onChange={handleInputChange} onBlur={handleBlurCorreo} />
                            {duplicados.correoExiste && (
                                <p className="mt-2 text-[9px] font-black uppercase text-amber-600 tracking-widest">Ya existe un registro con este dato en nuestro sistema.</p>
                            )}
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">WhatsApp</label>
                            <input name="telefono" type="tel" required className={inputClass} placeholder="3001234567" onChange={handleInputChange} onBlur={handleBlurTelefono} />
                            {duplicados.telefonoExiste && (
                                <p className="mt-2 text-[9px] font-black uppercase text-amber-600 tracking-widest">Ya existe un registro con este dato en nuestro sistema.</p>
                            )}
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
                                    <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Correo Tutor</label>
                                    <input name="tutorEmail" type="email" required className={inputClass} onChange={handleInputChange} />
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
                    {errorEnvio && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-start gap-3">
                            <IconoAlertaTriangulo className="w-5 h-5 text-tkd-red flex-shrink-0 mt-0.5" />
                            <p className="text-xs font-bold text-tkd-red">{errorEnvio}</p>
                        </div>
                    )}
                    <button type="submit" disabled={cargando} className="w-full py-5 text-white rounded-[2rem] font-black uppercase text-sm tracking-[0.3em] shadow-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4" style={{ backgroundColor: tenant?.colorSecundario }}>
                        {cargando ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : <IconoEnviar className="w-6 h-6" />}
                        Finalizar Registro
                    </button>
                </div>
            </form>

            <footer className="mt-12 text-center">
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Tudojang Core v4.3 • Protocolo de Carga Masiva</p>
            </footer>

            <ModalConfirmacion
                abierto={alertasConfirmacion.length > 0}
                titulo="Revisa antes de enviar"
                mensaje={alertasConfirmacion.join(' · ')}
                onCerrar={() => setAlertasConfirmacion([])}
                onConfirmar={handleConfirmarEnvio}
                cargando={confirmandoEnvio}
                textoBotonConfirmar="Enviar de todas formas"
            />
        </div>
    );
};

export default CensoPublico;
