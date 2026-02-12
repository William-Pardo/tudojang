// components/ModalContratoUsuario.tsx
import React, { useState } from 'react';
import type { Usuario } from '../tipos';
import { TipoVinculacionColaborador } from '../tipos';
import { IconoCerrar, IconoContrato, IconoAprobar, IconoWhatsApp, IconoCopiar, IconoInformacion } from './Iconos';
import { formatearPrecio, generarUrlAbsoluta } from '../utils/formatters';
import { validarIntegridadLegalTenant, validarIntegridadContratoUsuario } from '../utils/validaciones';
import type { ConfiguracionClub } from '../tipos';
import ModalVerFirma from './ModalVerFirma';

interface Props {
    abierto: boolean;
    usuario: Usuario;
    configClub: ConfiguracionClub;
    onCerrar: () => void;
    onGuardar: (usuario: Usuario) => void;
}

const ModalContratoUsuario: React.FC<Props> = ({ abierto, usuario, configClub, onCerrar, onGuardar }) => {
    const [contrato, setContrato] = useState(usuario.contrato || {
        valorPago: 0,
        tipoVinculacion: TipoVinculacionColaborador.Mes,
        tipoVinculacionOtro: '',
        fechaInicio: new Date().toISOString().split('T')[0],
        lugarEjecucion: '',
        firmado: false,
        firmaDigital: '',
        fechaFirma: '',
    });
    const [verFirma, setVerFirma] = useState(false);
    const [copiado, setCopiado] = useState(false);

    const integridadLegal = validarIntegridadLegalTenant(configClub);
    const integridadContrato = validarIntegridadContratoUsuario(usuario);

    if (!abierto) return null;

    const estadoContrato = contrato.firmado ? 'Firmado' : (usuario.contrato ? 'Pendiente' : 'Sin configurar');

    const coloresEstado: Record<string, { bg: string; text: string; border: string; dot: string }> = {
        'Firmado': { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400', border: 'border-green-200 dark:border-green-800', dot: 'bg-green-500' },
        'Pendiente': { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-500 animate-pulse' },
        'Sin configurar': { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-400', border: 'border-gray-200 dark:border-gray-700', dot: 'bg-gray-300' },
    };

    const estiloEstado = coloresEstado[estadoContrato];

    const handleGuardarContrato = () => {
        const usuarioActualizado: Usuario = {
            ...usuario,
            contrato: {
                ...contrato,
                tipoVinculacion: contrato.tipoVinculacion as TipoVinculacionColaborador,
            },
            estadoContrato: contrato.firmado ? 'Firmado' : 'Pendiente',
        };
        onGuardar(usuarioActualizado);
    };

    const urlContratoColaborador = generarUrlAbsoluta(`/contrato-colaborador/${usuario.id}`);

    const compartirWhatsApp = () => {
        const tel = usuario.whatsapp?.replace(/\s+/g, '') || '';
        const mensaje = `📄 Hola ${usuario.nombreUsuario}, por favor firma tu Contrato de Vinculación Laboral:\n\n${urlContratoColaborador}`;
        window.open(`https://wa.me/57${tel}?text=${encodeURIComponent(mensaje)}`, '_blank');
    };

    const copiarEnlace = async () => {
        try {
            await navigator.clipboard.writeText(urlContratoColaborador);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch { }
    };

    const inputStyle = "w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-4 text-sm font-black text-gray-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner transition-all placeholder:text-gray-300";
    const selectStyle = "w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-4 text-sm font-black text-gray-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner appearance-none cursor-pointer";

    return (
        <>
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-tkd-dark/95 p-4 animate-fade-in backdrop-blur-sm" onClick={onCerrar}>
                <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-8 sm:p-10 space-y-6 relative border border-gray-100 dark:border-white/5" onClick={e => e.stopPropagation()}>

                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-tkd-blue/10 rounded-2xl flex items-center justify-center">
                                <IconoContrato className="w-6 h-6 text-tkd-blue" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Vínculo Legal</h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{usuario.nombreUsuario}</p>
                            </div>
                        </div>
                        <button onClick={onCerrar} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                            <IconoCerrar className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Alerta de Integridad Institucional */}
                    {!integridadLegal.valido && (
                        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-tkd-red/20 space-y-2 animate-shake">
                            <div className="flex items-center gap-2 text-tkd-red font-black uppercase text-[10px]">
                                <IconoInformacion className="w-4 h-4" /> Academia Incompleta Legalmente
                            </div>
                            <p className="text-[9px] font-bold text-gray-500 uppercase leading-tight">
                                Antes de emitir este contrato, debe completar los datos de la academia en Configuración:
                                <ul className="mt-1 list-disc ml-4">
                                    {integridadLegal.faltantes.map(f => <li key={f}>{f}</li>)}
                                </ul>
                            </p>
                        </div>
                    )}

                    {/* Estado Badge */}
                    <div className={`flex items-center gap-3 p-4 rounded-2xl border ${estiloEstado.bg} ${estiloEstado.border}`}>
                        <div className={`w-3 h-3 rounded-full ${estiloEstado.dot}`}></div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${estiloEstado.text}`}>
                            Estado del Contrato: {estadoContrato}
                        </span>
                        {contrato.fechaFirma && (
                            <span className="ml-auto text-[9px] font-bold text-gray-400">
                                {new Date(contrato.fechaFirma).toLocaleDateString('es-CO')}
                            </span>
                        )}
                    </div>

                    {/* Firma Digital - si está firmado */}
                    {contrato.firmado && contrato.firmaDigital && (
                        <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Firma del Colaborador</p>
                            <button
                                onClick={() => setVerFirma(true)}
                                className="w-full bg-green-50 dark:bg-green-900/10 border-2 border-dashed border-green-200 dark:border-green-800 rounded-2xl p-4 flex items-center gap-4 hover:bg-green-100 dark:hover:bg-green-900/20 transition-all group"
                            >
                                <div className="w-20 h-14 bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-green-200 dark:border-green-700 flex-shrink-0 shadow-inner">
                                    <img src={contrato.firmaDigital} alt="Firma" className="w-full h-full object-contain" />
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-black text-green-700 dark:text-green-400 uppercase">Firma Verificada ✓</p>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">Haz clic para ver en tamaño completo</p>
                                </div>
                            </button>
                        </div>
                    )}

                    {/* Formulario de Contrato */}
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-2 block tracking-widest">Tipo Vinculación</label>
                                <select
                                    value={contrato.tipoVinculacion}
                                    onChange={e => setContrato(prev => ({ ...prev, tipoVinculacion: e.target.value as TipoVinculacionColaborador }))}
                                    className={selectStyle}
                                    disabled={contrato.firmado}
                                >
                                    <option value={TipoVinculacionColaborador.Mes}>Por Mes</option>
                                    <option value={TipoVinculacionColaborador.Hora}>Por Hora</option>
                                    <option value={TipoVinculacionColaborador.Evento}>Por Evento</option>
                                    <option value={TipoVinculacionColaborador.Otro}>Otro</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-2 block tracking-widest">Valor Pago (COP)</label>
                                <input
                                    type="number"
                                    value={contrato.valorPago}
                                    onChange={e => setContrato(prev => ({ ...prev, valorPago: Number(e.target.value) }))}
                                    placeholder="0"
                                    className={inputStyle}
                                    disabled={contrato.firmado}
                                />
                            </div>
                        </div>

                        {contrato.tipoVinculacion === TipoVinculacionColaborador.Otro && (
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-2 block tracking-widest">Especifique Tipo</label>
                                <input
                                    type="text"
                                    value={contrato.tipoVinculacionOtro || ''}
                                    onChange={e => setContrato(prev => ({ ...prev, tipoVinculacionOtro: e.target.value }))}
                                    placeholder="Ej: Prestación de servicios..."
                                    className={inputStyle}
                                    disabled={contrato.firmado}
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-2 block tracking-widest">Fecha Inicio</label>
                                <input
                                    type="date"
                                    value={contrato.fechaInicio}
                                    onChange={e => setContrato(prev => ({ ...prev, fechaInicio: e.target.value }))}
                                    className={inputStyle}
                                    disabled={contrato.firmado}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-2 block tracking-widest">Lugar Ejecución</label>
                                <input
                                    type="text"
                                    value={contrato.lugarEjecucion}
                                    onChange={e => setContrato(prev => ({ ...prev, lugarEjecucion: e.target.value }))}
                                    placeholder="Ej: Bogotá D.C."
                                    className={inputStyle}
                                    disabled={contrato.firmado}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Resumen del Contrato si tiene datos */}
                    {contrato.valorPago > 0 && (
                        <div className="bg-tkd-blue/5 p-4 rounded-2xl border border-tkd-blue/10 space-y-2">
                            <p className="text-[10px] font-black text-tkd-blue uppercase tracking-widest">Resumen del Contrato</p>
                            <div className="flex justify-between text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">
                                <span>{contrato.tipoVinculacion === TipoVinculacionColaborador.Otro ? (contrato.tipoVinculacionOtro || 'Otro') : `Por ${contrato.tipoVinculacion}`}</span>
                                <span className="text-tkd-blue font-black">{formatearPrecio(contrato.valorPago)}</span>
                            </div>
                            <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase">
                                <span>Desde: {contrato.fechaInicio}</span>
                                <span>{contrato.lugarEjecucion || 'Sin ubicación'}</span>
                            </div>
                        </div>
                    )}

                    {/* Acciones de envío - solo si contrato configurado pero no firmado */}
                    {!contrato.firmado && contrato.valorPago > 0 && (
                        <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Enviar para Firma</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={compartirWhatsApp}
                                    className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md hover:bg-green-600 transition-all active:scale-95"
                                >
                                    <IconoWhatsApp className="w-4 h-4" /> WhatsApp
                                </button>
                                <button
                                    onClick={copiarEnlace}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md transition-all active:scale-95 ${copiado ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    <IconoCopiar className="w-4 h-4" /> {copiado ? '¡Copiado!' : 'Copiar Enlace'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Botones principales */}
                    <div className="space-y-3 pt-2">
                        {!contrato.firmado && (
                            <button
                                onClick={handleGuardarContrato}
                                disabled={!integridadLegal.valido}
                                className="w-full bg-tkd-red text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-red-700 transition-all active:scale-95 disabled:bg-gray-400 disabled:shadow-none"
                            >
                                <IconoAprobar className="w-6 h-6" /> {usuario.contrato ? 'Actualizar Contrato' : 'Configurar Contrato'}
                            </button>
                        )}
                        <button onClick={onCerrar} className="w-full text-gray-400 font-black uppercase text-[10px] tracking-widest py-2 hover:text-gray-600 transition-colors">Cerrar</button>
                    </div>

                </div>
            </div>

            {/* Modal para ver firma en grande */}
            {verFirma && contrato.firmaDigital && (
                <ModalVerFirma
                    abierto={verFirma}
                    onCerrar={() => setVerFirma(false)}
                    firmaDigital={contrato.firmaDigital}
                    nombreTutor={usuario.nombreUsuario}
                />
            )}
        </>
    );
};

export default ModalContratoUsuario;
