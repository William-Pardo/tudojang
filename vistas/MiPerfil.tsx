
// vistas/MiPerfil.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotificacion } from '../context/NotificacionContext';
import { useConfiguracion, useSedes } from '../context/DataContext';
import { RolUsuario } from '../tipos';
import { formatearPrecio, formatearFecha } from '../utils/formatters';
import { generarReciboPagoPdf } from '../utils/receiptGenerator';
import { 
    IconoUsuario, IconoWhatsApp, IconoEmail, 
    IconoAprobar, IconoExportar, IconoDashboard, 
    IconoContrato, IconoCasa, IconoCampana,
    IconoLogoOficial
} from '../components/Iconos';
import EscanerAsistencia from '../components/EscanerAsistencia';

const VistaMiPerfil: React.FC = () => {
    const { usuario } = useAuth();
    const { configClub } = useConfiguracion();
    const { sedes } = useSedes();
    const { mostrarNotificacion } = useNotificacion();
    
    const [escanerAbierto, setEscanerAbierto] = useState(false);
    const [descargandoId, setDescargandoId] = useState<string | null>(null);

    const esTutorOperativo = usuario?.rol === RolUsuario.Tutor;

    const talonesPago = [
        { id: '1', periodo: 'Mes Actual', monto: usuario?.rol === RolUsuario.Admin ? 3500000 : 1200000, fecha: new Date().toISOString().split('T')[0] },
        { id: '2', periodo: 'Mes Anterior', monto: usuario?.rol === RolUsuario.Admin ? 3500000 : 1150000, fecha: '2024-04-30' },
    ];

    const miAsistencia = [
        { fecha: '2024-05-20', entrada: '08:00 AM', salida: '12:00 PM', horas: 4 },
        { fecha: '2024-05-19', entrada: '08:05 AM', salida: '12:10 PM', horas: 4.1 },
    ];

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

    const sedeUsuario = sedes.find(s => s.id === usuario?.sedeId);

    return (
        <div className="p-4 sm:p-8 space-y-10 animate-fade-in pb-20">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Mi Perfil</h1>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mt-2">Gestión de datos personales y laborales</p>
                </div>
                {esTutorOperativo && (
                    <button 
                        onClick={() => setEscanerAbierto(true)}
                        className="w-full sm:w-auto bg-tkd-blue text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-blue-800 active:scale-95 transition-all"
                    >
                        <IconoLogoOficial className="w-5 h-5" /> Abrir Escáner QR
                    </button>
                )}
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
                                {usuario?.rol}
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
                                            <IconoLogoOficial className="w-6 h-6 opacity-20" />
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
                </div>
            </div>

            {escanerAbierto && esTutorOperativo && (
                <EscanerAsistencia 
                    sedeId={usuario?.sedeId || '1'} 
                    onClose={() => setEscanerAbierto(false)} 
                />
            )}
        </div>
    );
};

export default VistaMiPerfil;
