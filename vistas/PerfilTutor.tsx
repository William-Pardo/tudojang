
// vistas/PerfilTutor.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotificacion } from '../context/NotificacionContext';
import { useConfiguracion } from '../context/DataContext';
import EscanerAsistencia from '../components/EscanerAsistencia';
import { IconoLogoOficial, IconoDashboard, IconoExportar, IconoCampana, IconoAprobar, IconoCasa } from '../components/Iconos';
import { formatearPrecio, formatearFecha } from '../utils/formatters';
import { generarReciboPagoPdf } from '../utils/receiptGenerator';

const VistaPerfilTutor: React.FC = () => {
    const { usuario } = useAuth();
    const { configClub } = useConfiguracion();
    const { mostrarNotificacion } = useNotificacion();
    const [escanerAbierto, setEscanerAbierto] = useState(false);
    const [registrandoSalida, setRegistrandoSalida] = useState(false);
    const [descargandoId, setDescargandoId] = useState<string | null>(null);

    // Mock de datos personales del tutor (profesor)
    const asistenciaPersonal = [
        { fecha: '2024-05-20', entrada: '08:00 AM', salida: '12:00 PM', horas: 4 },
        { fecha: '2024-05-19', entrada: '08:05 AM', salida: '12:10 PM', horas: 4.1 },
    ];

    const talonesPago = [
        { id: '1', periodo: 'Mayo 2024', monto: 1200000, fecha: '2024-05-01' },
        { id: '2', periodo: 'Abril 2024', monto: 1150000, fecha: '2024-04-01' },
    ];

    const toggleAsistenciaPropia = () => {
        const accion = registrandoSalida ? "Salida" : "Entrada";
        mostrarNotificacion(`${accion} registrada correctamente`, "success");
        setRegistrandoSalida(!registrandoSalida);
    };

    const handleDescargarPDF = async (pago: typeof talonesPago[0]) => {
        setDescargandoId(pago.id);
        try {
            await generarReciboPagoPdf(pago, configClub, usuario?.nombreUsuario || 'Profesor');
            mostrarNotificacion("Descarga iniciada con éxito", "success");
        } catch (error) {
            mostrarNotificacion("No se pudo generar el comprobante", "error");
        } finally {
            setDescargandoId(null);
        }
    };

    return (
        <div className="p-4 sm:p-8 space-y-10 bg-gray-50 dark:bg-tkd-dark min-h-screen animate-fade-in">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Panel del Sabonim</h1>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mt-2">Bienvenido, {usuario?.nombreUsuario}. Área de gestión técnica.</p>
                </div>
                <div className="flex w-full sm:w-auto gap-3">
                    <button 
                        onClick={toggleAsistenciaPropia}
                        className={`flex-1 sm:flex-none px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl active:scale-95 ${registrandoSalida ? 'bg-tkd-red text-white hover:bg-red-700' : 'bg-green-600 text-white hover:bg-green-700'}`}
                    >
                        Registrar {registrandoSalida ? 'Salida' : 'Entrada'}
                    </button>
                    <button 
                        onClick={() => setEscanerAbierto(true)}
                        className="flex-1 sm:flex-none bg-tkd-blue text-white px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-blue-800 active:scale-95 transition-all"
                    >
                        <IconoLogoOficial className="w-5 h-5" />
                        Escanear Alumno
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sección de Asistencia Propia */}
                <section className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-8 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/20">
                        <div className="flex items-center gap-3">
                            <IconoDashboard className="w-5 h-5 text-tkd-blue" />
                            <h2 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Mi Registro de Asistencia</h2>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900/50">
                                <tr>
                                    <th className="px-8 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Fecha</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Entrada</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Salida</th>
                                    <th className="px-8 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700">
                                {asistenciaPersonal.map((a, i) => (
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

                {/* Sección de Pagos */}
                <section className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-8 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/20">
                        <div className="flex items-center gap-3">
                            <IconoAprobar className="w-5 h-5 text-green-600" />
                            <h2 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Mis Talones de Pago</h2>
                        </div>
                    </div>
                    <div className="p-8 space-y-4">
                        {talonesPago.map(t => (
                            <div key={t.id} className="group bg-gray-50 dark:bg-gray-900/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 flex items-center justify-between hover:shadow-md transition-all">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-tkd-blue uppercase tracking-widest">{t.periodo}</p>
                                    <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{formatearPrecio(t.monto)}</p>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Emitido: {formatearFecha(t.fecha)}</p>
                                </div>
                                <button 
                                    onClick={() => handleDescargarPDF(t)}
                                    disabled={descargandoId === t.id}
                                    className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm hover:shadow-lg hover:scale-110 active:scale-95 transition-all text-tkd-blue disabled:opacity-50"
                                >
                                    {descargandoId === t.id ? (
                                        <div className="w-6 h-6 border-4 border-tkd-blue border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <IconoExportar className="w-6 h-6" />
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {escanerAbierto && (
                <EscanerAsistencia 
                    sedeId={usuario?.sedeId || '1'} 
                    onClose={() => setEscanerAbierto(false)} 
                />
            )}
        </div>
    );
};

export default VistaPerfilTutor;
