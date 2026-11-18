import React from 'react';
import { IconoCerrar } from '../Iconos';
import { parsearYoutubeVideoId } from '../../utils/academico/youtubeUrl';
import {
  TAGS_ACADEMICOS_ESTANDAR,
  alternarTagEnTexto,
  parsearTagsTexto,
} from '../../utils/academico/tagsAcademicos';
import { mapearErrorAcademico } from '../../utils/academico/erroresAcademicos';

export interface DatosVideoDirecto {
  titulo: string;
  videoUrl: string;
  disciplina: string;
  tags: string[];
}

export interface ModalClasificarVideoProps {
  abierto: boolean;
  onCerrar: () => void;
  onGuardar: (datos: DatosVideoDirecto) => Promise<void>;
  tagsSugeridosIniciales?: string[];
  disciplinaInicial?: string;
}

const TAGS_VACIOS_DEFAULT: string[] = [];

export const ModalClasificarVideo: React.FC<ModalClasificarVideoProps> = ({
  abierto,
  onCerrar,
  onGuardar,
  tagsSugeridosIniciales = TAGS_VACIOS_DEFAULT,
  disciplinaInicial = 'Taekwondo',
}) => {
  const [titulo, setTitulo] = React.useState('');
  const [disciplina, setDisciplina] = React.useState(disciplinaInicial);
  const [videoUrl, setVideoUrl] = React.useState('');
  const [tagsTexto, setTagsTexto] = React.useState('');
  const [errorUrl, setErrorUrl] = React.useState('');
  const [errorTitulo, setErrorTitulo] = React.useState('');
  const [guardando, setGuardando] = React.useState(false);
  const prevAbiertoRef = React.useRef(false);

  React.useEffect(() => {
    if (abierto && !prevAbiertoRef.current) {
      setTitulo('');
      setDisciplina(disciplinaInicial);
      setVideoUrl('');
      setTagsTexto(tagsSugeridosIniciales.join(', '));
      setErrorUrl('');
      setErrorTitulo('');
      setGuardando(false);
    }
    prevAbiertoRef.current = abierto;
  }, [abierto, disciplinaInicial, tagsSugeridosIniciales]);

  if (!abierto) return null;

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const tituloLimpio = titulo.trim();
    if (!tituloLimpio) {
      setErrorTitulo('El título visible es obligatorio.');
      return;
    }

    const videoId = parsearYoutubeVideoId(videoUrl);
    if (!videoId) {
      setErrorUrl('El enlace ingresado no tiene un formato de video reproducible.');
      return;
    }

    try {
      setGuardando(true);
      setErrorUrl('');
      setErrorTitulo('');
      await onGuardar({
        titulo: tituloLimpio,
        videoUrl: videoUrl.trim(),
        disciplina: disciplina.trim() || 'Taekwondo',
        tags: parsearTagsTexto(tagsTexto),
      });
      onCerrar();
    } catch (err) {
      setErrorUrl(mapearErrorAcademico(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-12 sm:py-16"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-clasificar-video-titulo"
    >
      <div className="max-h-[calc(100dvh-8rem)] w-full max-w-xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">Recurso de video</p>
            <h3 id="modal-clasificar-video-titulo" className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white">
              Clasificar recurso
            </h3>
            <p className="mt-1 text-xs font-normal text-gray-400">
              Completá la ficha académica. Al guardar, el recurso quedará aprobado y listo para asignar.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="shrink-0 rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-white transition"
            aria-label="Cerrar modal"
          >
            <IconoCerrar className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleGuardar} className="mt-5 space-y-4">
          <div>
            <label htmlFor="clasificar-video-titulo" className="block text-[10px] font-black uppercase tracking-widest text-gray-400">
              Título visible *
            </label>
            <input
              id="clasificar-video-titulo"
              value={titulo}
              onChange={(e) => {
                setTitulo(e.target.value);
                if (errorTitulo) setErrorTitulo('');
              }}
              placeholder="Ej: Patada en Hacha (Naeryo Chagi)"
              className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal dark:border-white/10 dark:bg-gray-950/40 dark:text-white"
              autoFocus
            />
            {errorTitulo && (
              <p role="alert" className="mt-2 text-xs font-bold text-red-600">
                {errorTitulo}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="clasificar-video-disciplina" className="block text-[10px] font-black uppercase tracking-widest text-gray-400">
              Disciplina
            </label>
            <input
              id="clasificar-video-disciplina"
              value={disciplina}
              onChange={(e) => setDisciplina(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal dark:border-white/10 dark:bg-gray-950/40 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="clasificar-video-tipo" className="block text-[10px] font-black uppercase tracking-widest text-gray-400">
              Tipo de recurso
            </label>
            <select
              id="clasificar-video-tipo"
              value="video"
              disabled
              className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-normal text-gray-500 dark:border-white/10 dark:bg-gray-950/40 dark:text-gray-400"
            >
              <option value="video">video</option>
            </select>
          </div>

          <div>
            <label htmlFor="clasificar-video-url" className="block text-[10px] font-black uppercase tracking-widest text-gray-400">
              URL del video *
            </label>
            <input
              id="clasificar-video-url"
              value={videoUrl}
              onChange={(e) => {
                setVideoUrl(e.target.value);
                if (errorUrl) setErrorUrl('');
              }}
              placeholder="Pegá la URL o enlace del video"
              aria-invalid={errorUrl ? 'true' : undefined}
              className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal dark:border-white/10 dark:bg-gray-950/40 dark:text-white"
            />
            <p className="mt-2 text-xs font-normal text-gray-400">
              Asegurate de que el video esté configurado como Público u Oculto, y con permisos de inserción web habilitados.
            </p>
            {errorUrl && (
              <p role="alert" className="mt-2 text-xs font-bold text-red-600">
                {errorUrl}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="clasificar-video-tags" className="block text-[10px] font-black uppercase tracking-widest text-gray-400">
              Tags (separados por coma)
            </label>
            <input
              id="clasificar-video-tags"
              value={tagsTexto}
              onChange={(e) => setTagsTexto(e.target.value)}
              placeholder="poomsae, fundamentos, combate"
              className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal dark:border-white/10 dark:bg-gray-950/40 dark:text-white"
            />
            <div className="mt-3 max-h-40 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50/50 p-3 dark:border-white/10 dark:bg-white/5">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Tags sugeridos</p>
              <div className="space-y-3">
                {TAGS_ACADEMICOS_ESTANDAR.map((grupo) => (
                  <div key={grupo.grupo}>
                    <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-tkd-blue">{grupo.grupo}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {grupo.tags.map((tag) => {
                        const seleccionado = parsearTagsTexto(tagsTexto).some(
                          (actual) => actual.toLowerCase() === tag.toLowerCase()
                        );
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setTagsTexto(alternarTagEnTexto(tagsTexto, tag))}
                            className={`rounded-full border px-2.5 py-1 text-[9px] font-bold transition ${
                              seleccionado
                                ? 'border-tkd-blue bg-blue-50 text-tkd-blue'
                                : 'border-gray-200 bg-white text-gray-500 hover:border-tkd-blue hover:text-tkd-blue'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              className="rounded-2xl border border-gray-200 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-2xl bg-tkd-blue px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-700 transition disabled:opacity-50 shadow-sm"
            >
              {guardando ? 'Guardando...' : 'Guardar y aprobar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalClasificarVideo;
