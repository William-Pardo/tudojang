// components/PrecioCalculadora.tsx
// SDD pricing-cupo-real (Bloque 4, precio-publico-calculadora): componente presentacional
// puro. Recibe el `ResultadoFacturacion` ya calculado por el padre (calcularFacturacionMensual,
// utils/facturacion.ts, Bloque 2) y solo emite hacia arriba los contadores crudos que el
// usuario mueve (slider de estudiantes, steppers de sedes/equipo técnico extra). Nunca
// importa ni llama calcularFacturacionMensual/calcularCapacidad -- no duplica la fórmula
// (spec precio-publico-calculadora: "MUST NOT existir una segunda fórmula de precios").
//
// IMPORTANTE (nota dejada por el Bloque 2): `resultado.estudiantes.tramos` es un array
// DISPERSO -- solo incluye los tramos con cantidad>0, no tiene longitud fija de 4. Este
// componente itera el array tal cual llega, sin asumir índices ni longitud.
import React from 'react';
import type { ResultadoFacturacion } from '../utils/facturacion';
import { formatearPrecio } from '../utils/formatters';

export interface PrecioCalculadoraProps {
    estudiantes: number;
    sedesExtra: number;
    equipoTecnicoExtra: number;
    resultado: ResultadoFacturacion;
    onEstudiantesChange: (cantidad: number) => void;
    onSedesExtraChange: (cantidad: number) => void;
    onEquipoTecnicoExtraChange: (cantidad: number) => void;
}

const MAX_ESTUDIANTES_SLIDER = 500;
const MAX_EXTRA_STEPPER = 20;

const PrecioCalculadora: React.FC<PrecioCalculadoraProps> = ({
    estudiantes,
    sedesExtra,
    equipoTecnicoExtra,
    resultado,
    onEstudiantesChange,
    onSedesExtraChange,
    onEquipoTecnicoExtraChange,
}) => {
    const restarSedeExtra = () => { if (sedesExtra > 0) onSedesExtraChange(sedesExtra - 1); };
    const sumarSedeExtra = () => { if (sedesExtra < MAX_EXTRA_STEPPER) onSedesExtraChange(sedesExtra + 1); };
    const restarEquipoExtra = () => { if (equipoTecnicoExtra > 0) onEquipoTecnicoExtraChange(equipoTecnicoExtra - 1); };
    const sumarEquipoExtra = () => { if (equipoTecnicoExtra < MAX_EXTRA_STEPPER) onEquipoTecnicoExtraChange(equipoTecnicoExtra + 1); };

    return (
        <div className="bg-white rounded-[3rem] border-4 border-tkd-blue/10 shadow-[0_40px_80px_-15px_rgba(31,62,144,0.15)] p-8 md:p-12 space-y-10">
            {/* ENTRADAS: slider de estudiantes + steppers de extras */}
            <div className="space-y-8">
                <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                        <label htmlFor="calc-estudiantes" className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                            Estudiantes activos
                        </label>
                        <span className="text-2xl font-black text-tkd-blue">{estudiantes}</span>
                    </div>
                    <input
                        id="calc-estudiantes"
                        type="range"
                        min={0}
                        max={MAX_ESTUDIANTES_SLIDER}
                        step={1}
                        value={estudiantes}
                        onChange={(e) => onEstudiantesChange(Number(e.target.value))}
                        className="w-full accent-tkd-blue"
                        aria-label="Cantidad de estudiantes activos"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Sedes extra</span>
                        <div className="flex items-center gap-3">
                            <button type="button" aria-label="Restar sede extra" onClick={restarSedeExtra} className="w-8 h-8 rounded-full bg-white border border-gray-200 font-black text-tkd-blue">-</button>
                            <span className="w-6 text-center font-black">{sedesExtra}</span>
                            <button type="button" aria-label="Sumar sede extra" onClick={sumarSedeExtra} className="w-8 h-8 rounded-full bg-white border border-gray-200 font-black text-tkd-blue">+</button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Equipo técnico extra</span>
                        <div className="flex items-center gap-3">
                            <button type="button" aria-label="Restar equipo técnico extra" onClick={restarEquipoExtra} className="w-8 h-8 rounded-full bg-white border border-gray-200 font-black text-tkd-blue">-</button>
                            <span className="w-6 text-center font-black">{equipoTecnicoExtra}</span>
                            <button type="button" aria-label="Sumar equipo técnico extra" onClick={sumarEquipoExtra} className="w-8 h-8 rounded-full bg-white border border-gray-200 font-black text-tkd-blue">+</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* DESGLOSE: tramos (disperso) + extras + total */}
            <div className="border-t border-gray-100 pt-8 space-y-3">
                {resultado.estudiantes.tramos.map((tramo) => (
                    <div key={tramo.desde} data-testid="tramo-fila" className="flex justify-between text-xs font-bold text-gray-500 uppercase">
                        <span>
                            {tramo.cantidad} alumno{tramo.cantidad === 1 ? '' : 's'} ({tramo.desde}-{tramo.hasta ?? '+'}) × {formatearPrecio(tramo.tarifa)}
                        </span>
                        <span className="text-gray-900">{formatearPrecio(tramo.subtotal)}</span>
                    </div>
                ))}

                {resultado.sedesExtra.cantidad > 0 && (
                    <div className="flex justify-between text-xs font-bold text-gray-500 uppercase">
                        <span>{resultado.sedesExtra.cantidad} sede(s) extra</span>
                        <span className="text-gray-900">{formatearPrecio(resultado.sedesExtra.subtotal)}</span>
                    </div>
                )}

                {resultado.equipoTecnicoExtra.cantidad > 0 && (
                    <div className="flex justify-between text-xs font-bold text-gray-500 uppercase">
                        <span>{resultado.equipoTecnicoExtra.cantidad} cupo(s) de equipo técnico extra</span>
                        <span className="text-gray-900">{formatearPrecio(resultado.equipoTecnicoExtra.subtotal)}</span>
                    </div>
                )}

                <div className="flex justify-between items-baseline pt-4 border-t border-gray-100">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total mensual estimado</span>
                    <span data-testid="precio-total" className="text-4xl font-black text-tkd-blue">{formatearPrecio(resultado.totalPesos)}</span>
                </div>
            </div>
        </div>
    );
};

export default PrecioCalculadora;
