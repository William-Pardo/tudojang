
// components/GeneradorQR.tsx
import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { Estudiante } from '../tipos';
import { IconoExportar } from './Iconos';
import { exportarCarnetAPdf } from '../utils/pdfGenerator';
import { useSedes, useConfiguracion } from '../context/DataContext';
import { useNotificacion } from '../context/NotificacionContext';
import LogoDinamico from './LogoDinamico';
import { getBeltStyle } from '../utils/beltStyles';
import { applyCarnetReadabilityRules } from '../utils/carnetReadability';

interface Props {
    estudiante: Estudiante;
}

const GeneradorQR: React.FC<Props> = ({ estudiante }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [procesando, setProcesando] = useState(false);
    const { sedes } = useSedes();
    const { configClub } = useConfiguracion();
    const { mostrarNotificacion } = useNotificacion();

    const sedeEstudiante = sedes.find(s => s.id === estudiante.sedeId);
    const visualGrado = getBeltStyle(estudiante.grado);

    const downloadCard = async () => {
        if (!cardRef.current) return;
        setProcesando(true);
        try {
            await exportarCarnetAPdf(cardRef.current, `Carnet_${estudiante.nombres}_${estudiante.apellidos}`);
            mostrarNotificacion("Carnet generado con éxito", "success");
        } catch (error) {
            mostrarNotificacion("Error al generar el carnet", "error");
        } finally {
            setProcesando(false);
        }
    };

    const carnetStyle = applyCarnetReadabilityRules({
        primary: configClub.colorPrimario || '#111111',
        secondary: configClub.colorSecundario || '#0047A0',
        accent: configClub.colorAcento || '#CD2E3A'
    });

    return (
        <div className="flex flex-col items-center space-y-6">
            <div
                ref={cardRef}
                style={{ backgroundColor: carnetStyle.backgroundColor, color: carnetStyle.textColor }}
                className="w-[340px] h-[215px] rounded-xl shadow-2xl overflow-hidden flex flex-col relative pt-[19px] px-[19px] pb-[32px] border border-white/20"
            >
                <div className="flex justify-between items-start z-10 mb-3">
                    <div className="text-left max-w-[190px]">
                        <h1
                            style={{ color: carnetStyle.textColor }}
                            className="text-[14px] font-black uppercase tracking-tight leading-[1.2] drop-shadow-md"
                        >
                            {configClub.nombreClub}
                        </h1>
                        <p
                            style={{ color: carnetStyle.textColor, opacity: 0.6 }}
                            className="text-[9px] font-bold uppercase mt-0.5"
                        >
                            {sedeEstudiante?.nombre || 'Sede Principal'}
                        </p>
                    </div>
                    <div className="bg-white p-1 rounded-lg shadow-md flex-shrink-0">
                        <LogoDinamico className="w-9 h-9" />
                    </div>
                </div>

                <div className="flex gap-4 items-center flex-grow z-10">
                    <div className="bg-white p-1.5 rounded-xl shadow-lg flex-shrink-0">
                        <QRCodeSVG
                            value={estudiante.id}
                            size={70}
                            level="H"
                            fgColor="#000000"
                            bgColor="#FFFFFF"
                        />
                    </div>

                    <div style={{ color: carnetStyle.textColor }} className="flex flex-col justify-center">
                        <span style={{ color: carnetStyle.textColor, opacity: 0.4 }} className="text-[7px] font-black uppercase tracking-[0.2em] mb-1.5">Identificación Alumno</span>
                        <h2 className="text-[17px] font-black uppercase leading-[1.4]">
                            {estudiante.nombres}
                        </h2>
                        <h2 className="text-[17px] font-black uppercase leading-[1.4] mb-2">
                            {estudiante.apellidos}
                        </h2>
                        <div className="h-[2px] w-10 mb-2" style={{ backgroundColor: configClub.colorSecundario }}></div>
                        <p className="text-[10px] font-bold" style={{ color: carnetStyle.textColor, opacity: 0.9 }}>ID: {estudiante.numeroIdentificacion}</p>
                    </div>
                </div>

                <div style={{ borderColor: `${carnetStyle.textColor}1A` }} className="mt-2 pt-2 border-t z-10">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span style={{ color: carnetStyle.textColor, opacity: 0.5 }} className="text-[8px] font-black uppercase">Grado:</span>
                            <div
                                style={{ background: visualGrado.background, color: visualGrado.color }}
                                className="px-3 py-0.5 rounded-md text-[10px] font-black uppercase shadow-sm border border-black/10 transition-colors"
                            >
                                {estudiante.grado}
                            </div>
                        </div>
                        <div className="text-right">
                            <span style={{ color: carnetStyle.textColor, opacity: 0.4 }} className="text-[7px] font-black uppercase block">Ingreso</span>
                            <p style={{ color: carnetStyle.textColor, opacity: 0.9 }} className="text-[9px] font-bold">{estudiante.fechaIngreso}</p>
                        </div>
                    </div>
                </div>

                <div style={{ backgroundColor: `${carnetStyle.textColor}0D` }} className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-2xl"></div>
            </div>

            <button
                onClick={downloadCard}
                disabled={procesando}
                className="flex items-center space-x-3 bg-tkd-red text-white px-8 py-4 rounded-xl hover:bg-red-700 transition-all shadow-xl disabled:bg-gray-400 group"
            >
                <IconoExportar className="w-5 h-5" />
                <span className="font-black uppercase text-xs tracking-widest">Descargar Carnet Oficial</span>
            </button>
        </div>
    );
};

export default GeneradorQR;
