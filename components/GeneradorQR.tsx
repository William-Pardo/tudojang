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

interface Props {
  estudiante: Estudiante;
}

const GeneradorQR: React.FC<Props> = ({ estudiante }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [procesando, setProcesando] = useState(false);
  const { sedesVisibles } = useSedes();
  const { configClub } = useConfiguracion();
  const { mostrarNotificacion } = useNotificacion();

  const sedeEstudiante = sedesVisibles.find(s => s.id === estudiante.sedeId);
  const visualGrado = getBeltStyle(estudiante.grado);

  // Cálculo adaptativo del nombre (Regla A)
  const NAME_BOX_PX   = 194;  // Ancho útil disponible en la fila central (324px - 22px - 74px - 14px - 18px)
  const NAME_SIZE_MAX = 18;   // px base
  const NAME_SIZE_MIN = 12;   // px mínimo legible para nombres muy largos
  const NAME_LS_MAX   = -0.3; // letter-spacing base (px)
  const NAME_LS_MIN   = -0.8; // letter-spacing condensado para aprovechar espacio

  // En Inter Black (900) en mayúsculas, el ratio ancho/alto promedio por glifo es ~0.70
  const estimarAncho = (texto: string, size: number, ls: number): number =>
      texto.length * (size * 0.70 + ls);

  let nameFontSize   = NAME_SIZE_MAX;
  let nameLetterSpacing = NAME_LS_MAX;
  let nameLineHeight = 1.18;

  const textoMasLargo = estudiante.nombres.length > estudiante.apellidos.length ? estudiante.nombres : estudiante.apellidos;
  const maxLen = textoMasLargo.length;

  if (estimarAncho(textoMasLargo, nameFontSize, nameLetterSpacing) > NAME_BOX_PX) {
      nameLetterSpacing = NAME_LS_MIN;
  }
  if (estimarAncho(textoMasLargo, nameFontSize, nameLetterSpacing) > NAME_BOX_PX) {
      nameFontSize = Math.max(NAME_SIZE_MIN, Math.floor(NAME_BOX_PX / (maxLen * 0.70)));
  }
  if (maxLen > 14) nameLineHeight = 1.12;

  const anioIngreso = estudiante.fechaIngreso ? new Date(estudiante.fechaIngreso).getFullYear() : new Date().getFullYear();

  const downloadCard = async () => {
    /* istanbul ignore next -- el botón solo existe mientras la tarjeta referenciada está montada */
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

  return (
    <div className="flex flex-col items-center space-y-6">
      <div 
        ref={cardRef}
        style={{ backgroundColor: '#211915' }}
        className="w-[324px] h-[204px] rounded-[10px] shadow-2xl overflow-hidden flex flex-col relative font-['Inter',system-ui,sans-serif]"
      >
        {/* Fila superior: club + logo */}
        <div className="flex justify-between items-start pt-[20px] px-[22px] z-10">
            <div className="text-left max-w-[240px] flex-1 pr-2">
                <h1 className="text-[13px] font-black uppercase text-white leading-[1.05] tracking-[-0.4px]">
                    {configClub.nombreClub}
                </h1>
                <p className="text-[6.5px] font-bold text-white/85 uppercase mt-[3px] tracking-[0.3px] leading-none">
                    SEDE: <span>{sedeEstudiante?.nombre || 'Sede Principal'}</span>
                </p>
            </div>
            <div className="bg-white rounded-[8px] w-[34px] h-[34px] flex-shrink-0 flex items-center justify-center overflow-hidden">
                <LogoDinamico className="w-7 h-7 object-contain" />
            </div>
        </div>

        {/* Fila central: QR + datos */}
        <div className="flex gap-[14px] items-center pt-[6px] px-[22px] z-10">
            <div className="bg-white rounded-[10px] w-[74px] h-[70px] flex-shrink-0 flex items-center justify-center p-1 box-border overflow-hidden">
                <QRCodeSVG
                    value={estudiante.id}
                    size={62}
                    level="H"
                    fgColor={configClub.colorPrimario || '#000000'}
                    bgColor="#FFFFFF"
                />
            </div>

            <div className="flex-1 max-w-[196px] text-left">
                <div 
                    style={{
                        fontSize: `${nameFontSize}px`,
                        lineHeight: nameLineHeight,
                        letterSpacing: `${nameLetterSpacing}px`
                    }}
                    className="font-black uppercase text-white whitespace-nowrap pt-[2px] pb-[1px]"
                >
                    {estudiante.nombres}
                </div>
                <div 
                    style={{
                        fontSize: `${nameFontSize}px`,
                        lineHeight: nameLineHeight,
                        letterSpacing: `${nameLetterSpacing}px`
                    }}
                    className="font-black uppercase text-white whitespace-nowrap pt-[2px] pb-[1px] mb-[3px]"
                >
                    {estudiante.apellidos}
                </div>
                <div className="h-[2.5px] w-[38px] bg-[#C34772] rounded-[2px] mb-[3px]"></div>
                <p className="text-[8.5px] font-extrabold text-white font-mono tracking-[0.2px] leading-[1.1]">
                    ID: {estudiante.numeroIdentificacion}
                </p>
            </div>
        </div>

        {/* Línea divisoria flotante */}
        <div className="absolute bottom-[36px] left-[22px] right-[17px] h-[0.5px] bg-white/15 z-5 pointer-events-none"></div>

        {/* Fila inferior: cinturón + año (anclada con posición absoluta a 10px del fondo) */}
        <div className="absolute bottom-[10px] left-[22px] right-[22px] h-[18px] flex justify-between items-center z-10">
            <div
                style={{ background: visualGrado.background, color: visualGrado.color }}
                className="h-[18px] flex items-center justify-center px-[11px] pb-[3px] rounded-[5px] border border-black/15 whitespace-nowrap max-w-[175px] box-border"
            >
                <span className="text-[8.5px] font-black uppercase tracking-[0.6px] leading-none text-center block relative -top-[5px]">
                    {estudiante.grado}
                </span>
            </div>
            <div className="text-[9px] font-bold text-white/75 tracking-[0.2px] leading-none">
                Desde: {anioIngreso}
            </div>
        </div>
      </div>

      <button 
        onClick={downloadCard}
        disabled={procesando}
        className="flex items-center space-x-3 bg-tkd-red text-white px-8 py-4 rounded-xl hover:bg-red-700 transition-all shadow-xl disabled:bg-gray-400 group"
      >
        <IconoExportar className="w-5 h-5" />
        <span className="font-black uppercase text-xs tracking-widest">
            {procesando ? 'Generando Carnet...' : 'Descargar Carnet Oficial'}
        </span>
      </button>
    </div>
  );
};

export default GeneradorQR;
