
// components/FilaEstudiante.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { Estudiante } from '../tipos';
import { RolUsuario } from '../tipos';
import { useAuth } from '../context/AuthContext';
import { normalizarEstadoMatricula } from '../utils/facturacion';
import type { AlertaContactoDuplicado } from '../utils/contactoDuplicado';
import EstadoPagoBadge from './EstadoPagoBadge';
import ModalRegistrarPago from './ModalRegistrarPago';
import {
    IconoContrato,
    IconoImagen,
    IconoEditar,
    IconoEliminar,
    IconoFirma,
    IconoLogoOficial,
    IconoBillete,
    IconoLogout,
    IconoAprobar,
    IconoAlertaTriangulo,
} from './Iconos';
import GeneradorQR from './GeneradorQR';

interface Props {
    estudiante: Estudiante;
    // Precalculadas por TablaEstudiantes.tsx (detectarContactoDuplicado) -- FilaEstudiante no
    // conoce al resto del Directorio, solo pinta lo que ya le llega resuelto.
    alertasContacto?: AlertaContactoDuplicado[];
    onEditar: (estudiante: Estudiante) => void;
    onEliminar: (estudiante: Estudiante) => void;
    onVerFirma: (firma: string, tutor: Estudiante['tutor']) => void;
    onCompartirLink: (tipo: 'firma' | 'contrato' | 'imagen', idEstudiante: string) => void;
    // SDD pricing-cupo-real (Bloque 4, matricula-estado-estudiante): retiro/reactivación de
    // matrícula -- conecta la UI a servicios/estudiantesApi.ts::retirarEstudiante/
    // reactivarEstudiante (ya implementadas y probadas en el Bloque 1, no se reabre esa
    // lógica acá).
    onRetirar: (estudiante: Estudiante) => void;
    onReactivar: (estudiante: Estudiante) => void;
    isCard: boolean;
}

export const FilaEstudiante: React.FC<Props> = ({
    estudiante,
    alertasContacto = [],
    onEditar,
    onEliminar,
    onVerFirma,
    onCompartirLink,
    onRetirar,
    onReactivar,
    isCard,
}) => {
    const { usuario } = useAuth();
    const alertaTelefono = alertasContacto.find(a => a.campo === 'telefono');
    const alertaCorreo = alertasContacto.find(a => a.campo === 'correo');
    const [modalQrAbierto, setModalQrAbierto] = useState(false);
    const [modalPagoAbierto, setModalPagoAbierto] = useState(false);
    const esAdmin = usuario?.rol === RolUsuario.Admin;
    // normalizarEstadoMatricula (utils/facturacion.ts, Bloque 2/D3): ausencia total ⇒
    // 'activo' -- único lugar del repo donde vive esa regla de default, reusada acá para no
    // reintroducir un chequeo disperso (`!== 'retirado'`) del mismo tipo que D8/task 1.7 ya
    // marcaron como el patrón a evitar.
    const estaRetirado = normalizarEstadoMatricula(estudiante) === 'retirado';

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
            <button
                onClick={() => setModalPagoAbierto(true)}
                className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                title="Gestión Financiera"
            >
                <IconoBillete className="w-5 h-5" />
            </button>
            <button onClick={() => onEditar(estudiante)} className="p-2 text-tkd-blue hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Editar"><IconoEditar className="w-5 h-5" /></button>
            {esAdmin && (
                estaRetirado ? (
                    <button onClick={() => onReactivar(estudiante)} className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors" title="Reactivar matrícula"><IconoAprobar className="w-5 h-5" /></button>
                ) : (
                    <button onClick={() => onRetirar(estudiante)} className="p-2 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors" title="Retirar (conserva historial)"><IconoLogout className="w-5 h-5" /></button>
                )
            )}
            {esAdmin && (
                <button onClick={() => onEliminar(estudiante)} className="p-2 text-tkd-red hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Eliminar"><IconoEliminar className="w-5 h-5" /></button>
            )}
        </div>
    );

    // Teléfono/correo del estudiante -- antes invisibles en el Directorio. Se muestran acá
    // para que el tenant pueda IDENTIFICAR el dato, no solo saber que hay una alerta: si
    // coincide con otro estudiante (detectarContactoDuplicado, calculado en TablaEstudiantes),
    // el valor se resalta en ámbar (mismo color que ya usa CensoPublico.tsx para este mismo
    // aviso) con el ícono y el nombre del otro estudiante en el title -- nunca bloquea nada,
    // es solo para que decidan si hace falta gestionarlo (típico en hermanos que comparten el
    // WhatsApp del tutor, o un tutor que también está inscrito como alumno).
    const lineaContacto = (valor: string, alerta?: AlertaContactoDuplicado) => (
        <div className="flex items-center gap-1.5" title={alerta?.mensaje}>
            {alerta && <IconoAlertaTriangulo className="w-3 h-3 flex-shrink-0 text-amber-600 dark:text-amber-500" />}
            <span className={`text-[10px] font-bold ${alerta ? 'uppercase tracking-wide text-amber-600 dark:text-amber-500' : 'text-gray-500 dark:text-gray-400'}`}>{valor}</span>
        </div>
    );

    const contenidoContacto = (
        <div className="mt-1 space-y-0.5">
            {estudiante.telefono && lineaContacto(estudiante.telefono, alertaTelefono)}
            {estudiante.correo && lineaContacto(estudiante.correo, alertaCorreo)}
        </div>
    );

    return (
        <>
            <ModalRegistrarPago
                estudiante={estudiante}
                abierto={modalPagoAbierto}
                onCerrar={() => setModalPagoAbierto(false)}
                onPagoExitoso={() => {
                    // Opcional: recargar datos si fuera necesario, pero el estado local se actualiza solo si el padre lo maneja
                    // Podríamos llamar a una prop onRefresh si existiera
                }}
            />
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
                            <p className="text-lg font-black text-tkd-dark dark:text-white uppercase leading-tight">
                                {estudiante.nombres} {estudiante.apellidos}
                                {estaRetirado && <span className="ml-2 align-middle px-2 py-0.5 text-[9px] font-black uppercase rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">Retirado</span>}
                            </p>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">{estudiante.numeroIdentificacion}</p>
                            {contenidoContacto}
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
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-black mb-0.5 tracking-widest">Grado</p>
                                <span className="px-2 py-1 inline-flex text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                    {estudiante.grado}
                                </span>
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
                        <div className="text-sm font-black text-tkd-dark dark:text-white uppercase">
                            {estudiante.nombres} {estudiante.apellidos}
                            {estaRetirado && <span className="ml-2 align-middle px-2 py-0.5 text-[9px] font-black uppercase rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">Retirado</span>}
                        </div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold uppercase">{estudiante.numeroIdentificacion}</div>
                        {contenidoContacto}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{estudiante.grupo}</div>
                        <span className="mt-1 px-2 py-1 inline-flex text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                            {estudiante.grado}
                        </span>
                    </td>
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
