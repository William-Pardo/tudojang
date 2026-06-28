import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotificacion } from '../../context/NotificacionContext';
import { useEstudiantes } from '../../context/DataContext';
import {
  linkTutorEstudiante,
  unlinkTutorEstudiante,
  listVinculos,
  VinculoTutorEstudiante
} from '../../servicios/academico/vinculoService';

const VinculosView: React.FC = () => {
  const { usuario } = useAuth();
  const { mostrarNotificacion } = useNotificacion();
  const { estudiantes } = useEstudiantes();
  
  const [vinculos, setVinculos] = useState<VinculoTutorEstudiante[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [selectedEstudianteId, setSelectedEstudianteId] = useState('');
  const [tutorEmail, setTutorEmail] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const tenantId = usuario?.tenantId || 'mock-tenant';

  const cargarVinculos = async () => {
    setCargando(true);
    try {
      const data = await listVinculos(tenantId);
      setVinculos(data);
    } catch (error: any) {
      mostrarNotificacion('Error al cargar vínculos: ' + error.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarVinculos();
  }, [tenantId]);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEstudianteId) {
      mostrarNotificacion('Por favor selecciona un estudiante', 'info');
      return;
    }
    if (!tutorEmail || !tutorEmail.includes('@')) {
      mostrarNotificacion('Por favor ingresa un correo de tutor válido', 'info');
      return;
    }

    setGuardando(true);
    try {
      await linkTutorEstudiante(tenantId, tutorEmail, selectedEstudianteId);
      mostrarNotificacion('¡Tutor vinculado con éxito!', 'success');
      setTutorEmail('');
      setSelectedEstudianteId('');
      cargarVinculos();
    } catch (error: any) {
      mostrarNotificacion('Error al vincular tutor: ' + error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const handleUnlink = async (email: string, estudianteId: string) => {
    if (!window.confirm('¿Estás seguro de desvincular a este tutor?')) return;
    try {
      await unlinkTutorEstudiante(tenantId, email, estudianteId);
      mostrarNotificacion('¡Tutor desvinculado con éxito!', 'success');
      cargarVinculos();
    } catch (error: any) {
      mostrarNotificacion('Error al desvincular tutor: ' + error.message, 'error');
    }
  };

  // Filtrar estudiantes según la búsqueda
  const estudiantesFiltrados = estudiantes.filter(e => {
    const nombreCompleto = `${e.nombres} ${e.apellidos}`.toLowerCase();
    return nombreCompleto.includes(busqueda.toLowerCase()) || e.numeroIdentificacion.includes(busqueda);
  });

  // Mapear los vínculos para asociar con la información de los estudiantes
  const vinculosConInfo = vinculos.map(v => {
    const estudiante = estudiantes.find(e => e.id === v.estudianteId);
    return {
      ...v,
      estudianteNombre: estudiante ? `${estudiante.nombres} ${estudiante.apellidos}` : 'Estudiante Desconocido',
      estudianteIdentificacion: estudiante ? estudiante.numeroIdentificacion : ''
    };
  });

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-soft border border-gray-100 dark:border-white/5 space-y-6">
      <div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
          Vínculos Tutor-Estudiante
        </h2>
        <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">
          Gestiona las relaciones de seguimiento académico entre tutores y alumnos
        </p>
      </div>

      {/* Vincular Tutor a Estudiante */}
      <form onSubmit={handleLink} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-gray-50 dark:bg-white/5 p-4 rounded-2xl">
        <div className="space-y-1">
          <label htmlFor="select-estudiante" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Seleccionar Estudiante
          </label>
          <select
            id="select-estudiante"
            value={selectedEstudianteId}
            onChange={(e) => setSelectedEstudianteId(e.target.value)}
            disabled={guardando}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-tkd-blue"
          >
            <option value="">-- Seleccionar Alumno --</option>
            {estudiantes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombres} {e.apellidos} ({e.grado})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="tutor-email-input" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Correo del Tutor
          </label>
          <input
            id="tutor-email-input"
            type="email"
            placeholder="tutor@correo.com"
            value={tutorEmail}
            onChange={(e) => setTutorEmail(e.target.value)}
            disabled={guardando}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-tkd-blue"
          />
        </div>

        <button
          type="submit"
          disabled={guardando}
          className="bg-tkd-dark hover:bg-tkd-blue text-white py-3 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 disabled:opacity-50"
        >
          {guardando ? 'Vinculando...' : 'Vincular Tutor'}
        </button>
      </form>

      {/* Listado de Vínculos */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">
            Vínculos Activos
          </h3>
          <input
            type="text"
            placeholder="Buscar por alumno..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-xs focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/5">
                <th className="py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Estudiante</th>
                <th className="py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Identificación</th>
                <th className="py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Correo Tutor</th>
                <th className="py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Fecha Vínculo</th>
                <th className="py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-sm text-gray-400">
                    Cargando vínculos...
                  </td>
                </tr>
              ) : vinculosConInfo.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-sm text-gray-400">
                    No hay vínculos registrados.
                  </td>
                </tr>
              ) : (
                vinculosConInfo
                  .filter(v => busqueda === '' || v.estudianteNombre.toLowerCase().includes(busqueda.toLowerCase()))
                  .map((v) => (
                    <tr key={v.id} className="border-b border-gray-50 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/5">
                      <td className="py-3 text-sm text-gray-900 dark:text-white font-medium">{v.estudianteNombre}</td>
                      <td className="py-3 text-sm text-gray-500 dark:text-gray-400">{v.estudianteIdentificacion}</td>
                      <td className="py-3 text-sm text-gray-900 dark:text-white">{v.tutorEmail}</td>
                      <td className="py-3 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(v.creadoEn).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleUnlink(v.tutorEmail, v.estudianteId)}
                          className="text-red-600 hover:text-tkd-red font-bold text-xs uppercase tracking-wider transition-colors"
                        >
                          Desvincular
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default VinculosView;
