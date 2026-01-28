
// components/FormularioEstudiante.tsx
// Este es un formulario modal completo para crear y editar estudiantes.

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import type { Estudiante, InscripcionPrograma } from '../tipos';
import { GrupoEdad, EstadoPago, GradoTKD, TipoCobroPrograma } from '../tipos';
import { IconoCerrar, IconoGuardar, IconoInformacion, IconoLogoOficial, IconoCasa } from './Iconos';
import FormInputError from './FormInputError';
import { useAutosave } from '../hooks/useAutosave';
import AutosavePrompt from './AutosavePrompt';
import { useSedes, useProgramas, useConfiguracion } from '../context/DataContext';
import { formatearPrecio } from '../utils/formatters';

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
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
        edad--;
    }

    if (edad >= 3 && edad <= 6) return { edad, grupo: GrupoEdad.Infantil };
    if (edad >= 7 && edad <= 12) return { edad, grupo: GrupoEdad.Precadetes };
    if (edad >= 13) return { edad, grupo: GrupoEdad.Cadetes };
    
    return { edad, grupo: GrupoEdad.NoAsignado };
};

const checkEsMenor = (fechaNacimiento: string): boolean => {
    if (!fechaNacimiento) return false;
    const { edad } = calcularEdadYGrupo(fechaNacimiento);
    return edad > 0 && edad < 18;
};

const schema = yup.object({
    nombres: yup.string().trim().required('Los nombres son obligatorios.'),
    apellidos: yup.string().trim().required('Los apellidos son obligatorios.'),
    numeroIdentificacion: yup.string().trim().required('La identificación es obligatoria.'),
    fechaNacimiento: yup.string().required('La fecha de nacimiento es obligatoria.'),
    grado: yup.string().oneOf(Object.values(GradoTKD)).required('El grado es obligatorio.'),
    grupo: yup.string().oneOf(Object.values(GrupoEdad)).required(),
    horasAcumuladasGrado: yup.number()
        .typeError('Debe ser un número válido.')
        .min(0, 'No puede ser negativo.')
        .required('Las horas son obligatorias.'),
    sedeId: yup.string().required('Debe seleccionar una sede para el estudiante.'),
    telefono: yup.string().trim().optional().default(''),
    correo: yup.string().trim().email('Correo inválido.')
        .when('fechaNacimiento', {
            is: (fecha: string) => !checkEsMenor(fecha),
            then: (s) => s.required('Correo obligatorio para mayores de edad.'),
            otherwise: (s) => s.optional().default(''),
        }),
    fechaIngreso: yup.string().required('La fecha de ingreso es obligatoria.'),
    estadoPago: yup.string().oneOf(Object.values(EstadoPago)).required(),
    saldoDeudor: yup.number().typeError('Debe ser un número.').default(0),
    consentimientoInformado: yup.boolean().default(false),
    contratoServiciosFirmado: yup.boolean().default(false),
    consentimientoFotosVideos: yup.boolean().default(false),
    consentimientoImagenFirmado: yup.boolean().default(false),
    alergias: yup.string().optional().default(''),
    lesiones: yup.string().optional().default(''),
    programasInscritos: yup.array().optional().default([]),
    tutor: yup.object().when('fechaNacimiento', {
        is: (fecha: string) => checkEsMenor(fecha),
        then: (s) => s.shape({
            nombres: yup.string().required('Nombre tutor obligatorio.'),
            apellidos: yup.string().required('Apellido tutor obligatorio.'),
            numeroIdentificacion: yup.string().required('ID tutor obligatoria.'),
            telefono: yup.string().required('Teléfono tutor obligatorio.'),
            correo: yup.string().email('Email tutor inválido.').required('Email tutor obligatorio.'),
        }).required(),
        otherwise: (s) => s.optional().nullable(),
    }),
}).required();

const FormularioEstudiante: React.FC<Props> = ({ abierto, onCerrar, onGuardar, estudianteActual, cargando }) => {
  const [visible, setVisible] = useState(false);
  const { sedes } = useSedes();
  const { programas } = useProgramas();
  const { configClub } = useConfiguracion();
  const [resetearHoras, setResetearHoras] = useState(false);

  const defaultValues: any = useMemo(() => ({
    id: '',
    nombres: '',
    apellidos: '',
    numeroIdentificacion: '',
    fechaNacimiento: '',
    grado: GradoTKD.Blanco,
    grupo: GrupoEdad.NoAsignado,
    horasAcumuladasGrado: 0,
    sedeId: '',
    telefono: '',
    correo: '',
    fechaIngreso: new Date().toISOString().split('T')[0],
    estadoPago: EstadoPago.AlDia,
    saldoDeudor: 0,
    consentimientoInformado: false,
    contratoServiciosFirmado: false,
    consentimientoImagenFirmado: false,
    consentimientoFotosVideos: false,
    carnetGenerado: false,
    alergias: '',
    lesiones: '',
    programasInscritos: [],
    tutor: { nombres: '', apellidos: '', numeroIdentificacion: '', telefono: '', correo: '' }
  }), []);

  const { register, handleSubmit, formState: { errors, isValid }, watch, setValue, reset } = useForm<any>({
    resolver: yupResolver(schema),
    mode: 'all', 
    defaultValues: estudianteActual || defaultValues
  });
  
  const watchedFechaNacimiento = watch('fechaNacimiento');
  const watchedGrado = watch('grado');
  const watchedSedeId = watch('sedeId');
  const inscritosActuales: InscripcionPrograma[] = watch('programasInscritos') || [];
  const esMenorDeEdad = useMemo(() => checkEsMenor(watchedFechaNacimiento), [watchedFechaNacimiento]);

  const sedeSeleccionada = useMemo(() => sedes.find(s => s.id === watchedSedeId), [sedes, watchedSedeId]);
  const precioFinalSede = (sedeSeleccionada?.valorMensualidad && sedeSeleccionada.valorMensualidad > 0) 
    ? sedeSeleccionada.valorMensualidad 
    : configClub.valorMensualidad;

  const formKey = `draft-estudiante-${estudianteActual?.id || 'nuevo'}`;
  const { status: autosaveStatus, hasDraft, restoreDraft, clearDraft } = useAutosave({ formKey, watch, reset });

  useEffect(() => {
    if (abierto && !hasDraft) reset(estudianteActual || defaultValues);
  }, [abierto, estudianteActual, reset, hasDraft, defaultValues]);

  useEffect(() => {
    if (abierto) {
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    }
  }, [abierto]);

  useEffect(() => {
    if (estudianteActual && watchedGrado !== estudianteActual.grado && resetearHoras) {
        setValue('horasAcumuladasGrado', 0, { shouldValidate: true });
    }
  }, [watchedGrado, resetearHoras, estudianteActual, setValue]);

  useEffect(() => {
    const { grupo: grupoSugerido } = calcularEdadYGrupo(watchedFechaNacimiento);
    if(grupoSugerido !== watch('grupo')) setValue('grupo', grupoSugerido, { shouldValidate: true });
  }, [watchedFechaNacimiento, setValue, watch]);

  const togglePrograma = (prog: any) => {
    const yaInscrito = inscritosActuales.find(i => i.idPrograma === prog.id);
    if (yaInscrito) {
        setValue('programasInscritos', inscritosActuales.filter(i => i.idPrograma !== prog.id), { shouldValidate: true });
    } else {
        const nueva: InscripcionPrograma = {
            idPrograma: prog.id,
            nombrePrograma: prog.nombre,
            fechaInscripcion: new Date().toISOString().split('T')[0]
        };
        setValue('programasInscritos', [...inscritosActuales, nueva], { shouldValidate: true });
    }
  };

  const onSubmit = async (data: any) => {
    const estudianteCompleto: Estudiante = {
        ...(estudianteActual || { id: '', historialPagos: [], carnetGenerado: false }),
        ...data,
        tutor: esMenorDeEdad ? data.tutor : undefined,
    };
    try {
        await onGuardar(estudianteCompleto);
        clearDraft();
    } catch (error) {
        console.error("Error al guardar:", error);
    }
  };

  if (!abierto) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-200 ease-out ${visible ? 'bg-opacity-60' : 'bg-opacity-0'}`} aria-modal="true" role="dialog" onClick={onCerrar}>
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[95vh] flex flex-col transform transition-all duration-200 ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-bold text-tkd-dark dark:text-white">
            {estudianteActual ? `Ficha Técnica: ${estudianteActual.nombres}` : 'Nuevo Estudiante'}
          </h2>
          <button onClick={onCerrar} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:text-gray-400"><IconoCerrar className="w-6 h-6" /></button>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 overflow-y-auto space-y-6">
            {hasDraft && <AutosavePrompt onRestore={restoreDraft} onDiscard={clearDraft} />}
            
            <fieldset className="border border-gray-200 dark:border-gray-700 p-4 rounded-lg">
                <legend className="text-sm font-black uppercase text-tkd-blue px-2 bg-white dark:bg-gray-800">Identificación Básica</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Nombres *</label>
                        <input type="text" {...register('nombres')} className={`w-full border rounded-md p-2 dark:bg-gray-700 dark:text-white ${errors.nombres ? 'border-red-500' : 'border-gray-300'}`}/>
                        <FormInputError mensaje={errors.nombres?.message} />
                    </div>
                     <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Apellidos *</label>
                        <input type="text" {...register('apellidos')} className={`w-full border rounded-md p-2 dark:bg-gray-700 dark:text-white ${errors.apellidos ? 'border-red-500' : 'border-gray-300'}`}/>
                        <FormInputError mensaje={errors.apellidos?.message} />
                    </div>
                     <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">ID / Documento *</label>
                        <input type="text" {...register('numeroIdentificacion')} className={`w-full border rounded-md p-2 dark:bg-gray-700 dark:text-white ${errors.numeroIdentificacion ? 'border-red-500' : 'border-gray-300'}`}/>
                        <FormInputError mensaje={errors.numeroIdentificacion?.message} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Fecha Nacimiento *</label>
                        <input type="date" {...register('fechaNacimiento')} className="w-full border-gray-300 rounded-md p-2 dark:bg-gray-700 dark:text-white"/>
                    </div>
                </div>
            </fieldset>

            {/* SECCIÓN NUEVA: PROGRAMAS ADICIONALES */}
            <fieldset className="border border-tkd-blue/20 p-4 rounded-lg bg-blue-50/20 dark:bg-blue-900/5">
                <legend className="text-sm font-black uppercase text-tkd-blue px-2 bg-white dark:bg-gray-800">Programas & Modalidades Extra</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    {programas.map(p => {
                        const inscrito = inscritosActuales.some(i => i.idPrograma === p.id);
                        return (
                            <div 
                                key={p.id} 
                                onClick={() => togglePrograma(p)}
                                className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${inscrito ? 'bg-tkd-blue text-white border-tkd-blue shadow-md' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 opacity-60 hover:opacity-100'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded-lg ${inscrito ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                        <IconoLogoOficial className={`w-4 h-4 ${inscrito ? 'text-white' : 'text-tkd-blue'}`} />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-tight leading-none">{p.nombre}</p>
                                        <p className={`text-[8px] font-bold mt-1 ${inscrito ? 'text-blue-100' : 'text-gray-400'}`}>
                                            {p.tipoCobro === TipoCobroPrograma.Recurrente ? `+${formatearPrecio(p.valor)}/mes` : `Valor: ${formatearPrecio(p.valor)}`}
                                        </p>
                                    </div>
                                </div>
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${inscrito ? 'border-white bg-tkd-red' : 'border-gray-300'}`}>
                                    {inscrito && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                </div>
                            </div>
                        );
                    })}
                    {programas.length === 0 && <p className="text-[10px] text-gray-400 italic">No hay programas adicionales configurados en la academia.</p>}
                </div>
            </fieldset>

            <fieldset className="border border-gray-200 dark:border-gray-700 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/20">
                <legend className="text-sm font-black uppercase text-tkd-red px-2 bg-white dark:bg-gray-800">Grado y Sede</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Sede *</label>
                        <select {...register('sedeId')} className={`w-full border rounded-md p-2 dark:bg-gray-700 dark:text-white ${errors.sedeId ? 'border-red-500' : 'border-gray-300'}`}>
                            <option value="">Seleccione Sede...</option>
                            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                        <FormInputError mensaje={errors.sedeId?.message} />
                        {watchedSedeId && (
                            <div className="mt-2 flex items-center gap-2 px-1 text-[9px] font-bold text-tkd-blue uppercase animate-fade-in">
                                <IconoCasa className="w-3 h-3" />
                                Tarifa Mensual en esta Sede: {formatearPrecio(precioFinalSede)}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Cinturón *</label>
                        <select {...register('grado')} className="w-full border-gray-300 rounded-md p-2 dark:bg-gray-700 dark:text-white">
                            {Object.values(GradoTKD).map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                </div>
            </fieldset>

            {esMenorDeEdad && (
              <fieldset className="p-4 border border-blue-200 dark:border-blue-900 rounded-lg bg-blue-50/50 dark:bg-blue-900/10">
                <legend className="text-sm font-black uppercase text-blue-600 px-2 bg-white dark:bg-gray-800">Acudiente</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Nombres Tutor *</label>
                        <input type="text" {...register('tutor.nombres')} className={`w-full border rounded-md p-2 dark:bg-gray-700 dark:text-white ${errors.tutor?.nombres ? 'border-red-500' : 'border-gray-300'}`}/>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Teléfono Tutor *</label>
                        <input type="tel" {...register('tutor.telefono')} className={`w-full border rounded-md p-2 dark:bg-gray-700 dark:text-white ${errors.tutor?.telefono ? 'border-red-500' : 'border-gray-300'}`}/>
                    </div>
                </div>
              </fieldset>
            )}

            <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-lg border border-yellow-100">
                <p className="text-[10px] text-yellow-800 dark:text-yellow-400 font-bold uppercase mb-2">⚠ Documentación</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2"><input type="checkbox" {...register('consentimientoInformado')} /> Consentimiento</label>
                    <label className="flex items-center gap-2"><input type="checkbox" {...register('contratoServiciosFirmado')} /> Contrato</label>
                </div>
            </div>
        </form>

        <footer className="p-4 border-t flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
          <div className="flex-grow">
            {autosaveStatus === 'saving' && <span className="text-[10px] text-gray-400 uppercase font-black animate-pulse">Guardando...</span>}
          </div>
          <div className="flex space-x-3">
            <button type="button" onClick={onCerrar} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase">Cancelar</button>
            <button 
                type="button" 
                onClick={handleSubmit(onSubmit)} 
                disabled={!isValid || cargando} 
                className="bg-tkd-red text-white px-6 py-2 rounded-lg font-black uppercase text-xs shadow-lg hover:bg-red-700 disabled:bg-gray-400 flex items-center gap-2"
            >
              <IconoGuardar className="w-4 h-4"/>
              <span>{cargando ? 'Procesando...' : 'Guardar Ficha'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default FormularioEstudiante;
