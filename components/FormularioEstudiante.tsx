
// components/FormularioEstudiante.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { Estudiante, InscripcionPrograma } from '../tipos';
import { GrupoEdad, EstadoPago, GradoTKD, TipoCobroPrograma } from '../tipos';
import { IconoCerrar, IconoGuardar, IconoInformacion, IconoLogoOficial, IconoCasa, IconoAprobar } from './Iconos';
import FormInputError from './FormInputError';
import { useAutosave } from '../hooks/useAutosave';
import AutosavePrompt from './AutosavePrompt';
import { useSedes, useProgramas, useConfiguracion } from '../context/DataContext';
import { formatearPrecio } from '../utils/formatters';
import { calcularTarifaBaseEstudiante, calcularSumaProgramasRecurrentes } from '../utils/calculations';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onGuardar: (estudiante: Estudiante) => Promise<void>;
  estudianteActual: Estudiante | null;
  cargando: boolean;
}

const calcularEdadYGrupo = (fechaNacimiento: string): { edad: number, grupo: GrupoEdad } => {
    if (!fechaNacimiento) return { edad: 0, grupo: GrupoEdad.NoAsignado };
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    if (isNaN(nacimiento.getTime())) return { edad: 0, grupo: GrupoEdad.NoAsignado };
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
    if (edad >= 3 && edad <= 6) return { edad, grupo: GrupoEdad.Infantil };
    if (edad >= 7 && edad <= 12) return { edad, grupo: GrupoEdad.Precadetes };
    if (edad >= 13) return { edad, grupo: GrupoEdad.Cadetes };
    return { edad, grupo: GrupoEdad.NoAsignado };
};

const schema = yup.object({
    nombres: yup.string().trim().required('Los nombres son obligatorios.'),
    apellidos: yup.string().trim().required('Los apellidos son obligatorios.'),
    numeroIdentificacion: yup.string().trim().required('La identificación es obligatoria.'),
    fechaNacimiento: yup.string().required('La fecha de nacimiento es obligatoria.'),
    grado: yup.string().oneOf(Object.values(GradoTKD)).required('El grado es obligatorio.'),
    grupo: yup.string().oneOf(Object.values(GrupoEdad)).required(),
    horasAcumuladasGrado: yup.number().typeError('Debe ser un número.').min(0).required(),
    sedeId: yup.string().required('Debe seleccionar una sede.'),
    telefono: yup.string().trim().optional(),
    correo: yup.string().trim().email('Correo inválido.'),
    fechaIngreso: yup.string().required(),
    estadoPago: yup.string().oneOf(Object.values(EstadoPago)).required(),
    saldoDeudor: yup.number().default(0),
    consentimientoInformado: yup.boolean().default(false),
    contratoServiciosFirmado: yup.boolean().default(false),
    consentimientoImagenFirmado: yup.boolean().default(false),
    consentimientoFotosVideos: yup.boolean().default(false),
    alergias: yup.string().optional(),
    lesiones: yup.string().optional(),
    programasInscritos: yup.array().optional().default([]),
    tutor: yup.object().optional().nullable()
}).required();

const FormularioEstudiante: React.FC<Props> = ({ abierto, onCerrar, onGuardar, estudianteActual, cargando }) => {
  const { sedes } = useSedes();
  const { programas } = useProgramas();
  const { configClub } = useConfiguracion();

  const { register, handleSubmit, formState: { errors, isValid }, watch, setValue, reset } = useForm<any>({
    resolver: yupResolver(schema),
    mode: 'onChange',
    defaultValues: estudianteActual || { grado: GradoTKD.Blanco, grupo: GrupoEdad.NoAsignado, estadoPago: EstadoPago.AlDia, programasInscritos: [] }
  });
  
  const watchedSedeId = watch('sedeId');
  const watchedProgramas = watch('programasInscritos') || [];

  // Cálculos dinámicos de facturación para el resumen
  const resumenCobros = useMemo(() => {
      const base = calcularTarifaBaseEstudiante({ sedeId: watchedSedeId } as any, configClub, sedes);
      const extras = calcularSumaProgramasRecurrentes({ programasInscritos: watchedProgramas } as any, programas);
      return { base, extras, total: base + extras };
  }, [watchedSedeId, watchedProgramas, configClub, sedes, programas]);

  const togglePrograma = (prog: any) => {
    const yaInscrito = watchedProgramas.find((i: any) => i.idPrograma === prog.id);
    if (yaInscrito) {
        setValue('programasInscritos', watchedProgramas.filter((i: any) => i.idPrograma !== prog.id), { shouldValidate: true });
    } else {
        const nueva = { idPrograma: prog.id, nombrePrograma: prog.nombre, fechaInscripcion: new Date().toISOString().split('T')[0] };
        setValue('programasInscritos', [...watchedProgramas, nueva], { shouldValidate: true });
    }
  };

  useEffect(() => { if (abierto) reset(estudianteActual || { grado: GradoTKD.Blanco, grupo: GrupoEdad.NoAsignado, estadoPago: EstadoPago.AlDia, programasInscritos: [] }); }, [abierto, estudianteActual, reset]);

  const onSubmit = async (data: any) => { await onGuardar(data); onCerrar(); };

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tkd-dark/80 p-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-white/10">
        <header className="p-8 border-b dark:border-gray-800 flex justify-between items-center">
          <h2 className="text-2xl font-black uppercase text-tkd-dark dark:text-white tracking-tighter">{estudianteActual ? 'Editar Ficha' : 'Nuevo Registro Técnico'}</h2>
          <button onClick={onCerrar} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all"><IconoCerrar className="w-6 h-6 text-gray-400" /></button>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-10 no-scrollbar">
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <input {...register('nombres')} placeholder="NOMBRES" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white" />
                    <input {...register('apellidos')} placeholder="APELLIDOS" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white" />
                </div>
                <input {...register('numeroIdentificacion')} placeholder="ID / DOCUMENTO" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white" />
                
                <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30">
                    <label className="text-[10px] font-black uppercase text-tkd-blue mb-2 block tracking-widest">Sede y Tarifa Base</label>
                    <select {...register('sedeId')} className="w-full bg-white dark:bg-gray-800 border-none rounded-xl p-4 text-sm font-black dark:text-white">
                        <option value="">Seleccionar Sede...</option>
                        {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.ciudad})</option>)}
                    </select>
                </div>

                <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Programas Extra (Recurrentes)</label>
                    <div className="grid gap-3">
                        {programas.map(p => {
                            const isSelected = watchedProgramas.some((i: any) => i.idPrograma === p.id);
                            return (
                                <div key={p.id} onClick={() => togglePrograma(p)} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex justify-between items-center ${isSelected ? 'bg-tkd-blue/5 border-tkd-blue' : 'bg-gray-50 dark:bg-gray-800 border-transparent opacity-60'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-tkd-blue text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}><IconoLogoOficial className="w-4 h-4" /></div>
                                        <div>
                                            <p className="text-[11px] font-black uppercase dark:text-white leading-none">{p.nombre}</p>
                                            <p className="text-[9px] font-bold text-gray-400 mt-1">{p.tipoCobro}</p>
                                        </div>
                                    </div>
                                    <p className="text-xs font-black text-tkd-blue">+{formatearPrecio(p.valor)}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* RESUMEN DE COBROS TOTALIZADOS */}
            <div className="space-y-8">
                <div className="bg-tkd-dark text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-white/5">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red mb-6">Proyección Mensual de Facturación</h3>
                    <div className="space-y-4 relative z-10">
                        <div className="flex justify-between items-center text-gray-400">
                            <span className="text-[10px] font-bold uppercase tracking-widest">Membresía Base (Sede)</span>
                            <span className="font-black text-xs">{formatearPrecio(resumenCobros.base)}</span>
                        </div>
                        <div className="flex justify-between items-center text-gray-400">
                            <span className="text-[10px] font-bold uppercase tracking-widest">Extras Programas</span>
                            <span className="font-black text-xs">+{formatearPrecio(resumenCobros.extras)}</span>
                        </div>
                        <div className="h-px bg-white/10 my-4"></div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-black uppercase text-tkd-blue tracking-widest">Total Mensualidad</span>
                            <span className="text-3xl font-black tracking-tighter text-white">{formatearPrecio(resumenCobros.total)}</span>
                        </div>
                    </div>
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-tkd-blue/10 rounded-full blur-3xl"></div>
                </div>

                <div className="p-8 bg-gray-50 dark:bg-gray-800/50 rounded-[2.5rem] space-y-6">
                    <div className="flex items-center gap-3">
                        <IconoInformacion className="w-5 h-5 text-gray-400" />
                        <p className="text-[10px] font-bold text-gray-500 uppercase leading-relaxed">Este valor se generará como cobro recurrente cada día {configClub.diasSuspension / 6} de mes.</p>
                    </div>
                    <button type="submit" disabled={!isValid || cargando} className="w-full bg-tkd-red text-white py-6 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-red-700 transition-all flex items-center justify-center gap-3">
                        {cargando ? <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : <IconoAprobar className="w-6 h-6" />}
                        Finalizar y Registrar
                    </button>
                </div>
            </div>
        </form>
      </div>
    </div>
  );
};

export default FormularioEstudiante;
