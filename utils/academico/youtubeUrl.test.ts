import { parsearYoutubeVideoId, esUrlYoutubeValida } from './youtubeUrl';

describe('parsearYoutubeVideoId', () => {
  it('extrae el ID desde una URL completa youtube.com/watch?v=ID', () => {
    expect(parsearYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extrae el ID cuando hay otros query params ademas de v', () => {
    expect(parsearYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=PL123')).toBe('dQw4w9WgXcQ');
  });

  it('extrae el ID desde la URL sin www', () => {
    expect(parsearYoutubeVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extrae el ID desde la URL corta youtu.be/ID', () => {
    expect(parsearYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extrae el ID desde youtu.be con query params extra', () => {
    expect(parsearYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe('dQw4w9WgXcQ');
  });

  it('extrae el ID desde una URL embed', () => {
    expect(parsearYoutubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extrae el ID desde una URL shorts', () => {
    expect(parsearYoutubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('acepta el ID pelado sin protocolo ni barras', () => {
    expect(parsearYoutubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('acepta una URL sin protocolo explicito', () => {
    expect(parsearYoutubeVideoId('youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('recorta espacios en blanco alrededor del texto pegado', () => {
    expect(parsearYoutubeVideoId('  https://youtu.be/dQw4w9WgXcQ  ')).toBe('dQw4w9WgXcQ');
  });

  it('devuelve null para texto vacio', () => {
    expect(parsearYoutubeVideoId('')).toBeNull();
    expect(parsearYoutubeVideoId('   ')).toBeNull();
  });

  it('devuelve null para una URL de otro dominio', () => {
    expect(parsearYoutubeVideoId('https://vimeo.com/123456789')).toBeNull();
  });

  it('devuelve null para un ID demasiado corto', () => {
    expect(parsearYoutubeVideoId('abc123')).toBeNull();
  });

  it('devuelve null para watch sin parametro v', () => {
    expect(parsearYoutubeVideoId('https://www.youtube.com/watch?list=PL123')).toBeNull();
  });

  it('devuelve null para texto que no es una URL ni un ID valido', () => {
    expect(parsearYoutubeVideoId('esto no es una url')).toBeNull();
  });
});

describe('esUrlYoutubeValida', () => {
  it('es true para una URL valida', () => {
    expect(esUrlYoutubeValida('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
  });

  it('es false para una URL invalida', () => {
    expect(esUrlYoutubeValida('https://vimeo.com/123456789')).toBe(false);
  });
});
