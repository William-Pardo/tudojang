
// vistas/SalidaPublica.tsx
import React, { useState } from 'react';
import { buscarAsistenciaHoyPorIdAlumno } from '../servicios/asistenciaApi';
import { EstadoEntrega } from '../tipos';
import { IconoLogoOficial, IconoBuscar, IconoAprobar } from '../components/Iconos';
import Loader from '../components/Loader';

const VistaSalidaPublica: React.FC = () => {
    const [idAlumno, setIdAlumno] = useState('');
    const [resultado, setResultado] = useState<{ asistencia: any, nombres: string } | null>(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const manejarBusqueda = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!idAlumno.trim()) return;

        setCargando(true);
        setError(null);
        setResultado(null);

        try {
            const data = await buscarAsistenciaHoyPorIdAlumno(idAlumno);
            if (data) {
                setResultado(data);
            } else {
                setError("No se encontró un registro activo para este ID hoy. Verifique el número o consulte con el profesor.");
            }
        } catch (err) {
            setError("Error al consultar el estado. Intente de nuevo.");
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="min-h-screen bg-tkd-blue flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden p-8 space-y-8">
                <div className="text-center">
                    <IconoLogoOficial className="w-20 h-20 mx-auto mb-4" />
                    <h1 className="text-2xl font-black text-tkd-dark dark:text-white uppercase tracking-tight">Monitor de Salida</h1>
                    <p className="text-gray-500 text-sm">Ingrese el ID del estudiante para ver su estado</p>
                </div>

                <form onSubmit={manejarBusqueda} className="space-y-4">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Ej: 10102030"
                            value={idAlumno}
                            onChange={(e) => setIdAlumno(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-gray-100 dark:bg-gray-800 rounded-2xl border-none focus:ring-2 focus:ring-tkd-red text-lg font-bold transition-all"
                        />
                        <IconoBuscar className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                    </div>
                    <button 
                        type="submit"
                        disabled={cargando}
                        className="w-full bg-tkd-red text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                    >
                        {cargando ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : "Consultar Estado"}
                    </button>
                </form>

                {error && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium border border-red-100 animate-fade-in text-center">
                        {error}
                    </div>
                )}

                {resultado && (
                    <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-800 animate-slide-in-right">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-black text-blue-500 uppercase">Estudiante</span>
                            <span className="text-lg font-black dark:text-white">{resultado.nombres}</span>
                        </div>
                        
                        <div className="flex flex-col items-center py-4">
                            {resultado.asistencia.estadoEntrega === EstadoEntrega.Listo ? (
                                <>
                                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-2 shadow-lg shadow-green-200">
                                        <IconoAprobar className="w-10 h-10 text-white" />
                                    </div>
                                    <p className="text-xl font-black text-green-600 uppercase">¡LISTO!</p>
                                    <p className="text-sm text-gray-500 text-center mt-2">Puedes acercarte a la puerta para recogerlo(a).</p>
                                </>
                            ) : resultado.asistencia.estadoEntrega === EstadoEntrega.EnClase ? (
                                <>
                                    <div className="w-16 h-16 bg-tkd-blue rounded-full flex items-center justify-center mb-2 animate-pulse">
                                        <IconoLogoOficial className="w-10 h-10" />
                                    </div>
                                    <p className="text-xl font-black text-tkd-blue uppercase">En Clase</p>
                                    <p className="text-sm text-gray-500 text-center mt-2">La práctica aún no ha terminado.</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-xl font-black text-gray-400 uppercase">Entregado</p>
                                    <p className="text-sm text-gray-500 text-center mt-2">El alumno ya fue retirado de la sede.</p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="text-center pt-4">
                    <p className="text-[10px] text-gray-400 italic">
                        Sistema de seguridad TaekwondoGa Jog. <br/> Datos encriptados y válidos solo por sesión.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default VistaSalidaPublica;
