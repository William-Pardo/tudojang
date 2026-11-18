import {
  resolverTipoMaterial,
  type ParametrosResolucionMaterial,
  type TipoMaterialResuelto,
} from './resolverTipoMaterial';

describe('resolverTipoMaterial', () => {
  it('resuelve "quiz" cuando uso es evaluacion', () => {
    const input: ParametrosResolucionMaterial = {
      uso: 'evaluacion',
      titulo: 'Examen de cinturón',
    };
    expect(resolverTipoMaterial(input)).toBe('quiz');
  });

  it('resuelve "quiz" cuando tipoRecurso es quiz', () => {
    const input: ParametrosResolucionMaterial = {
      tipoRecurso: 'quiz',
      titulo: 'Cuestionario teórico',
    };
    expect(resolverTipoMaterial(input)).toBe('quiz');
  });

  it('resuelve "video" para un video de YouTube aunque el título no tenga extensión .mp4', () => {
    const input: ParametrosResolucionMaterial = {
      titulo: 'VIDEO TUTOR',
      youtubeVideoId: 'c5fIxtJH2Qs',
    };
    expect(resolverTipoMaterial(input)).toBe('video');
  });

  it('resuelve "video" cuando el mimeType es de video (video/mp4, video/quicktime, etc.)', () => {
    const input: ParametrosResolucionMaterial = {
      titulo: 'Poomsae 1',
      mimeType: 'video/mp4',
    };
    expect(resolverTipoMaterial(input)).toBe('video');
  });

  it('resuelve "video" si tiene duracionSegundos especificada', () => {
    const input: ParametrosResolucionMaterial = {
      titulo: 'Fundamentos de patada',
      duracionSegundos: 300,
    };
    expect(resolverTipoMaterial(input)).toBe('video');
  });

  it('resuelve "video" por extensión (.mp4, .mov, .avi, .mkv)', () => {
    expect(resolverTipoMaterial({ titulo: 'clase.mp4' })).toBe('video');
    expect(resolverTipoMaterial({ titulo: 'tecnica.mov' })).toBe('video');
  });

  it('resuelve "pdf" cuando mimeType es application/pdf', () => {
    const input: ParametrosResolucionMaterial = {
      titulo: 'Manual del Estudiante',
      mimeType: 'application/pdf',
    };
    expect(resolverTipoMaterial(input)).toBe('pdf');
  });

  it('resuelve "pdf" por extensión .pdf', () => {
    const input: ParametrosResolucionMaterial = {
      titulo: 'reglamento.pdf',
    };
    expect(resolverTipoMaterial(input)).toBe('pdf');
  });

  it('resuelve "imagen" cuando mimeType es image/* o por extensión', () => {
    expect(resolverTipoMaterial({ titulo: 'diagrama', mimeType: 'image/png' })).toBe('imagen');
    expect(resolverTipoMaterial({ titulo: 'foto.jpg' })).toBe('imagen');
    expect(resolverTipoMaterial({ titulo: 'post.webp' })).toBe('imagen');
  });

  it('resuelve "presentacion" cuando mimeType o extensión es de presentación', () => {
    expect(
      resolverTipoMaterial({
        titulo: 'Historia del Taekwondo',
        mimeType: 'application/vnd.google-apps.presentation',
      })
    ).toBe('presentacion');
    expect(resolverTipoMaterial({ titulo: 'diapositivas.pptx' })).toBe('presentacion');
  });

  it('resuelve "generico" para texto explícito (.txt, .md) y null', () => {
    expect(resolverTipoMaterial({ titulo: 'notas.txt' })).toBe('generico');
    expect(resolverTipoMaterial({ titulo: 'guia.md' })).toBe('generico');
    expect(resolverTipoMaterial(null as any)).toBe('generico');
  });

  it('resuelve "pdf" como fallback para material de estudio sin extensión (compatibilidad Drive)', () => {
    expect(resolverTipoMaterial({ titulo: 'Material base' })).toBe('pdf');
  });

  it('valida prioridad de la fuente real: youtubeVideoId y mimeType tienen precedencia sobre fallbacks', () => {
    const input: ParametrosResolucionMaterial = {
      titulo: 'documento-confuso.pdf',
      youtubeVideoId: 'dQw4w9WgXcQ',
      mimeType: 'video/mp4',
    };
    expect(resolverTipoMaterial(input)).toBe('video');
  });
});
