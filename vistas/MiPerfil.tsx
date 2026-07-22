
// vistas/MiPerfil.tsx
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotificacion } from '../context/NotificacionContext';
import { useConfiguracion, useSedes } from '../context/DataContext';
import { RolUsuario, type Estudiante } from '../tipos';
import { formatearPrecio, formatearFecha } from '../utils/formatters';
import { obtenerEtiquetaRol } from '../utils/roles';
import { generarReciboPagoPdf } from '../utils/receiptGenerator';
import { resolveLinkedStudent } from '../servicios/academico/tutorStudentResolver';
import {
    IconoUsuario, IconoWhatsApp, IconoEmail,
    IconoAprobar, IconoExportar, IconoDashboard,
    IconoContrato, IconoCasa, IconoCampana
} from '../components/Iconos';
import LogoDinamico from '../components/LogoDinamico';

const VistaMiPerfil: React.FC = () => {
    const { usuario } = useAuth();
    const { configClub } = useConfiguracion();
    const { sedesVisibles } = useSedes();
    const { mostrarNotificacion } = useNotificacion();
    const navigate = ReactRouterDOM.useNavigate();

    const [descargandoId, setDescargandoId] = useState<string | null>(null);
    const [estudianteVinculado, setEstudianteVinculado] = useState<Estudiante | null>(null);
    const [cargandoEstudiante, setCargandoEstudiante] = useState(false);

    const esTutorOperativo = usuario?.rol === RolUsuario.Tutor;

    // Fix tutor-role-end-to-end (2026-07-14): cargar datos reales del estudiante
    // vinculado resolviendo por el EMAIL de login del tutor (el vínculo vive en
    // estudiante.tutor.correo). El resolver ya devuelve el Estudiante completo
    // (estadoPago/saldoDeudor/historialPagos), así que no se re-consulta por id.
    useEffect(() => {
        if (esTutorOperativo && usuario?.tenantId && usuario?.email) {
            setCargandoEstudiante(true);
            (async () => {
                try {
                    const estudiantesVinculados = await resolveLinkedStudent(usuario.tenantId, usuario.email);
                    if (estudiantesVinculados.length > 0) {
                        setEstudianteVinculado(estudiantesVinculados[0]);
                    }
                } catch (err) {
                    console.error('Error cargando estudiante vinculado:', err);
                } finally {
                    setCargandoEstudiante(false);
                }
            })();
        }
    }, [esTutorOperativo, usuario?.tenantId, usuario?.email]);

    // Para Tutores: usar datos reales del estudiante. Para otros roles: usar mocks
    const talonesPago = !esTutorOperativo
        ? [
            { id: '1', periodo: 'Mes Actual', monto: usuario?.rol === RolUsuario.Admin ? 3500000 : 1200000, fecha: new Date().toISOString().split('T')[0] },
            { id: '2', periodo: 'Mes Anterior', monto: usuario?.rol === RolUsuario.Admin ? 3500000 : 1150000, fecha: '2024-04-30' },
        ]
        : estudianteVinculado
        ? [
            {
                id: 'pago-estudiante',
                periodo: 'Estado Actual',
                monto: estudianteVinculado.saldoDeudor || 0,
                fecha: new Date().toISOString().split('T')[0],
            }
        ]
        : [];

    const miAsistencia = !esTutorOperativo
        ? [
            { fecha: '2024-05-20', entrada: '08:00 AM', salida: '12:00 PM', horas: 4 },
            { fecha: '2024-05-19', entrada: '08:05 AM', salida: '12:10 PM', horas: 4.1 },
        ]
        : [];

    const notificacionesRecientes = [
        { id: 'n1', tipo: 'Sistema', mensaje: 'Tu contrato ha sido verificado correctamente.', fecha: 'Hace 2 días' },
        { id: 'n2', tipo: 'Seguridad', mensaje: 'Nuevo inicio de sesión detectado en Chrome.', fecha: 'Hace 5 horas' },
    ];

    const handleDescargarPDF = async (pago: any) => {
        setDescargandoId(pago.id);
        try {
            await generarReciboPagoPdf(pago, configClub, usuario?.nombreUsuario || 'Usuario');
            mostrarNotificacion("Comprobante generado", "success");
        } catch (error) {
            mostrarNotificacion("Error al generar PDF", "error");
        } finally {
            setDescargandoId(null);
        }
    };

    const sedeUsuario = sedesVisibles.find(s => s.id === usuario?.sedeId);
    const etiquetaRolUsuario = obtenerEtiquetaRol(usuario?.rol, 'equipoTecnico');

    return (
        <div className="p-4 sm:p-8 space-y-10 animate-fade-in pb-20">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Mi Perfil</h1>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mt-2">Gestión de datos personales y laborales</p>
                </div>
                {/* Fix tutor-role-end-to-end (2026-07-14): el "Escáner QR" es una función de
                    staff (registro de asistencia), no del padre/acudiente. Se removió del
                    perfil del Tutor a pedido explícito del usuario. */}
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-8">
                    <section className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-8 text-center border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
                            <div className="w-24 h-24 bg-tkd-blue/10 rounded-[2rem] flex items-center justify-center mx-auto mb-4 shadow-inner border-2 border-white dark:border-gray-700">
                                <IconoUsuario className="w-12 h-12 text-tkd-blue" />
                            </div>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{usuario?.nombreUsuario}</h2>
                            <span className="inline-block px-4 py-1 mt-2 rounded-full bg-tkd-red text-white text-[9px] font-black uppercase tracking-widest shadow-sm">
                                {etiquetaRolUsuario}
                            </span>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl"><IconoContrato className="w-4 h-4 text-gray-400" /></div>
                                    <div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Documento</p>
                                        <p className="text-xs font-bold dark:text-white">{usuario?.numeroIdentificacion || 'No registrado'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl"><IconoWhatsApp className="w-4 h-4 text-green-500" /></div>
                                    <div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">WhatsApp</p>
                                        <p className="text-xs font-bold dark:text-white">{usuario?.whatsapp || 'Sin teléfono'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl"><IconoEmail className="w-4 h-4 text-tkd-blue" /></div>
                                    <div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Email Corporativo</p>
                                        <p className="text-xs font-bold dark:text-white truncate max-w-[180px]">{usuario?.email}</p>
                                    </div>
                                </div>
                                {sedeUsuario && (
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl"><IconoCasa className="w-4 h-4 text-tkd-red" /></div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Sede Asignada</p>
                                            <p className="text-xs font-bold dark:text-white">{sedeUsuario.nombre}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Fix tutor-role-end-to-end (2026-07-14): para el Tutor mostramos los
                                DOCUMENTOS DEL ESTUDIANTE a firmar (consentimiento, contrato, imagen)
                                con su estado real. Cada uno queda visible siempre; al firmar solo
                                cambia de Pendiente a Firmado. Los enlaces de firma son las mismas
                                rutas públicas que el admin comparte (/firma, /contrato, /firma-imagen).
                                Para staff, se mantiene la vista de contrato laboral. */}
                            {esTutorOperativo ? (
                                <div className="pt-6 border-t dark:border-gray-700 space-y-3">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Documentos del estudiante</p>
                                    {estudianteVinculado ? (
                                        [
                                            { nombre: 'Consentimiento de Riesgos', firmado: !!estudianteVinculado.consentimientoInformado, ruta: `/firma/${estudianteVinculado.id}` },
                                            { nombre: 'Contrato de Servicios', firmado: !!estudianteVinculado.contratoServiciosFirmado, ruta: `/contrato/${estudianteVinculado.id}` },
                                            { nombre: 'Autorización de Imagen', firmado: !!estudianteVinculado.consentimientoImagenFirmado, ruta: `/firma-imagen/${estudianteVinculado.id}` },
                                        ].map((docFirma) => (
                                            <div key={docFirma.nombre} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <IconoContrato className="w-4 h-4 text-gray-400 shrink-0" />
                                                    <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200 truncate">{docFirma.nombre}</span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${docFirma.firmado ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-orange-100 text-orange-700 border border-orange-200'}`}>
                                                        {docFirma.firmado ? 'Firmado' : 'Pendiente'}
                                                    </span>
                                                    <button
                                                        onClick={() => navigate(docFirma.ruta)}
                                                        className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase text-tkd-blue border border-tkd-blue/30 hover:bg-tkd-blue/10 transition-colors"
                                                    >
                                                        {docFirma.firmado ? 'Ver' : 'Firmar'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-[11px] font-bold text-gray-400">Cargando documentos del estudiante...</p>
                                    )}
                                </div>
                            ) : (
                                <div className="pt-6 border-t dark:border-gray-700">
                                    <div className="flex justify-between items-center mb-4">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado de Vínculo</p>
                                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${usuario?.contrato?.firmado ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-orange-100 text-orange-700 border border-orange-200'}`}>
                                            {usuario?.contrato?.firmado ? 'Vigente / Firmado' : 'Pendiente Firma'}
                                        </span>
                                    </div>
                                    <button className="w-full py-3 bg-gray-50 dark:bg-gray-900 rounded-xl text-[10px] font-black uppercase text-gray-500 hover:text-tkd-blue transition-colors border border-gray-100 dark:border-gray-700">
                                        Ver Mi Contrato Digital
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <div className="lg:col-span-2 space-y-8">
                    {(usuario?.rol === RolUsuario.Tutor || usuario?.rol === RolUsuario.Asistente) && (
                        <section className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <div className="p-8 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-tkd-blue/10 text-tkd-blue rounded-xl shadow-inner"><IconoDashboard className="w-5 h-5" /></div>
                                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Mis Horas Realizadas</h2>
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase">Mayo 2024</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                                        <tr>
                                            <th className="px-8 py-4">Fecha</th>
                                            <th className="px-6 py-4">Ingreso</th>
                                            <th className="px-6 py-4">Salida</th>
                                            <th className="px-8 py-4 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700">
                                        {miAsistencia.map((a, i) => (
                                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <td className="px-8 py-5 text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{formatearFecha(a.fecha)}</td>
                                                <td className="px-6 py-5 text-xs font-bold text-gray-500 uppercase">{a.entrada}</td>
                                                <td className="px-6 py-5 text-xs font-bold text-gray-500 uppercase">{a.salida}</td>
                                                <td className="px-8 py-5 text-right">
                                                    <span className="bg-blue-50 text-tkd-blue dark:bg-blue-900/30 dark:text-blue-300 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter border border-blue-100 dark:border-blue-800">
                                                        {a.horas}h
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {!esTutorOperativo ? (
                        <section className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <div className="p-8 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-500/10 text-green-600 rounded-xl shadow-inner"><IconoAprobar className="w-5 h-5" /></div>
                                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Mis Talones de Pago</h2>
                                </div>
                            </div>
                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {talonesPago.map(t => (
                                    <div key={t.id} className="group bg-gray-50 dark:bg-gray-900/50 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-start">
                                                <p className="text-[10px] font-black text-tkd-blue uppercase tracking-widest">{t.periodo}</p>
                                                <LogoDinamico className="w-6 h-6 opacity-20" />
                                            </div>
                                            <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">{formatearPrecio(t.monto)}</p>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Emitido: {formatearFecha(t.fecha)}</p>
                                        </div>
                                        <button
                                            onClick={() => handleDescargarPDF(t)}
                                            disabled={descargandoId === t.id}
                                            className="mt-8 w-full bg-white dark:bg-gray-800 py-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-tkd-blue hover:text-white transition-all group-hover:border-tkd-blue"
                                        >
                                            {descargandoId === t.id ? (
                                                <div className="w-5 h-5 border-2 border-tkd-blue border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <IconoExportar className="w-5 h-5" />
                                            )}
                                            {descargandoId === t.id ? 'Generando...' : 'Descargar Soporte PDF'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : (
                        <section className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <div className="p-8 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-500/10 text-green-600 rounded-xl shadow-inner"><IconoAprobar className="w-5 h-5" /></div>
                                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Estado de Pago del Estudiante</h2>
                                </div>
                            </div>
                            {cargandoEstudiante ? (
                                <div className="p-8 text-center text-gray-400">
                                    <p className="text-sm">Cargando información del estudiante...</p>
                                </div>
                            ) : estudianteVinculado ? (
                                <div className="p-8 grid grid-cols-1 gap-6">
                                    <div className="group bg-gray-50 dark:bg-gray-900/50 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-start">
                                                <p className="text-[10px] font-black text-tkd-blue uppercase tracking-widest">Saldo Adeudado</p>
                                                <LogoDinamico className="w-6 h-6 opacity-20" />
                                            </div>
                                            <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">{formatearPrecio(estudianteVinculado.saldoDeudor || 0)}</p>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Estado: <span className={`${
                                                estudianteVinculado.estadoPago === 'Al día' ? 'text-green-600' :
                                                estudianteVinculado.estadoPago === 'Pendiente' ? 'text-orange-600' :
                                                'text-red-600'
                                            }`}>{estudianteVinculado.estadoPago}</span></p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-400">
                                    <p className="text-sm">No hay información de estudiante vinculado.</p>
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </div>

        </div>
    );
};

export default VistaMiPerfil;
