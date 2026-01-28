
// components/FilaEstudiante.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { Estudiante } from '../tipos';
import { RolUsuario } from '../tipos';
import { useAuth } from '../context/AuthContext';
import EstadoPagoBadge from './EstadoPagoBadge';
import { 
    IconoContrato, 
    IconoImagen, 
    IconoEditar, 
    IconoEliminar, 
    IconoFirma, 
    IconoLogoOficial 
} from './Iconos';
import GeneradorQR from './GeneradorQR';

interface Props {
  estudiante: Estudiante;
  onEditar: (estudiante: Estudiante) => void;
  onEliminar: (estudiante: Estudiante) => void;
  onVerFirma: (firma: string, tutor: Estudiante['tutor']) => void;
  onCompartirLink: (tipo: 'firma' | 'contrato' | 'imagen', idEstudiante: string) => void;
  isCard: boolean;
}

export const FilaEstudiante: React.FC<Props> = ({
  estudiante,
  onEditar,
  onEliminar,
  onVerFirma,
  onCompartirLink,
  isCard,
}) => {
    const { usuario } = useAuth();
    const [modalQrAbierto, setModalQrAbierto] = useState(false);
    const esAdmin = usuario?.rol === RolUsuario.Admin;

    // Helper para renderizar el estado de cada documento
    const renderEstadoDoc = (
        firmado: boolean, 
        signature: string | undefined, 
        tipo: 'firma' | 'contrato' | 'imagen', 
        Icono: any, 
        label: string
    ) => {
        const estaFirmado = firmado && !!signature;
        
        return (
            <div className="flex flex-col items-center px-2 border-r last:border-r-0 border-gray-200 dark:border-gray-700 group relative">
                {estaFirmado ? (
                    <button 
                        onClick={() => onVerFirma(signature!, estudiante.tutor)}
                        className="p-1.5 text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-900/20 rounded-md transition-all shadow-sm"
                        title={`Ver ${label} Firmado`}
                    >
                        <Icono className="w-5 h-5" />
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                    </button>
                ) : (
                    <button 
                        onClick={() => onCompartirLink(tipo, estudiante.id)}
                        className="p-1.5 text-tkd-red dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md transition-all shadow-sm hover:scale-110 active:scale-95"
                        title={`PENDIENTE: Enviar enlace de ${label}`}
                    >
                        <Icono className="w-5 h-5" />
                    </button>
                )}
            </div>
        );
    };

    const contenidoDocumentos = (
        <div className="flex items-center bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            {/* CARNET / QR */}
            <div className="px-2 border-r border-gray-200 dark:border-gray-700">
                <button 
                    onClick={() => setModalQrAbierto(true)}
                    className="p-1.5 text-tkd-blue rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/50 transition-colors" 
                    title="Ver Carnet y QR"
                >
                    <IconoLogoOficial className="w-5 h-5" />
                </button>
            </div>

            {/* CONTRATO */}
            {renderEstadoDoc(
                estudiante.contratoServiciosFirmado, 
                estudiante.tutor?.firmaContratoDigital, 
                'contrato', 
                IconoContrato, 
                'Contrato de Servicios'
            )}

            {/* CONSENTIMIENTO RIESGOS */}
            {renderEstadoDoc(
                estudiante.consentimientoInformado, 
                estudiante.tutor?.firmaDigital, 
                'firma', 
                IconoFirma, 
                'Consentimiento Informado (Riesgos)'
            )}

            {/* AUTORIZACIÓN DE MANEJO DE IMAGEN */}
            {renderEstadoDoc(
                estudiante.consentimientoImagenFirmado, 
                estudiante.tutor?.firmaImagenDigital, 
                'imagen', 
                IconoImagen, 
                'Autorización de Manejo de Imagen'
            )}
        </div>
    );

    const contenidoAcciones = (
        <div className="flex items-center space-x-1 justify-end">
            <button onClick={() => onEditar(estudiante)} className="p-2 text-tkd-blue hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Editar"><IconoEditar className="w-5 h-5" /></button>
            {esAdmin && (
                <button onClick={() => onEliminar(estudiante)} className="p-2 text-tkd-red hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Eliminar"><IconoEliminar className="w-5 h-5" /></button>
            )}
        </div>
    );

    return (
        <>
            {isCard ? (
                <motion.div
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-4"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-lg font-black text-tkd-dark dark:text-white uppercase leading-tight">{estudiante.nombres} {estudiante.apellidos}</p>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">{estudiante.numeroIdentificacion}</p>
                        </div>
                        {contenidoAcciones}
                    </div>
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <div className="flex-1 sm:flex-none">
                                <p className="text-[10px] text-gray-400 uppercase font-black mb-0.5 tracking-widest">Estado Pago</p>
                                <EstadoPagoBadge estado={estudiante.estadoPago} />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-black mb-0.5 tracking-widest">Grupo</p>
                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{estudiante.grupo}</p>
                            </div>
                        </div>
                        <div className="w-full sm:w-auto">
                            <p className="text-[10px] text-gray-400 uppercase font-black mb-1.5 tracking-widest sm:text-right">Estado Documental</p>
                            {contenidoDocumentos}
                        </div>
                    </div>
                </motion.div>
            ) : (
                <motion.tr
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-black text-tkd-dark dark:text-white uppercase">{estudiante.nombres} {estudiante.apellidos}</div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold uppercase">{estudiante.numeroIdentificacion}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700 dark:text-gray-300">{estudiante.grupo}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <EstadoPagoBadge estado={estudiante.estadoPago} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        {contenidoDocumentos}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                        {contenidoAcciones}
                    </td>
                </motion.tr>
            )}

            {/* Modal para el Carnet */}
            {modalQrAbierto && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-tkd-dark/80 p-4 animate-fade-in" onClick={() => setModalQrAbierto(false)}>
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-2xl relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-black mb-6 text-center dark:text-white uppercase tracking-tight">Carnet Digital</h2>
                        <GeneradorQR estudiante={estudiante} />
                        <p className="text-[10px] font-bold text-center text-gray-500 mt-6 px-4 uppercase leading-relaxed">
                            Optimizado para impresión en PVC (85.6mm x 54mm)
                        </p>
                        <button 
                            onClick={() => setModalQrAbierto(false)}
                            className="mt-6 w-full text-gray-500 hover:text-tkd-dark dark:hover:text-white font-black uppercase text-xs tracking-widest transition-colors"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
