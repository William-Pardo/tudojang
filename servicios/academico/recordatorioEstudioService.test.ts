// servicios/academico/recordatorioEstudioService.test.ts

import {
  determinarSituacionAsignacion,
  detectarInactividadProlongada,
  elegirComentario,
  type SituacionRecordatorio,
} from './recordatorioEstudioService';

const AHORA = new Date('2026-07-18T12:00:00Z');

function horasDesdeAhora(horas: number): string {
  return new Date(AHORA.getTime() + horas * 60 * 60 * 1000).toISOString();
}

describe('determinarSituacionAsignacion', () => {
  it('devuelve null si ya completo la asignacion (100%)', () => {
    const situacion = determinarSituacionAsignacion(
      { fechaApertura: horasDesdeAhora(-100), fechaCierre: horasDesdeAhora(10), porcentajeConsumo: 100 },
      AHORA
    );
    expect(situacion).toBeNull();
  });

  it('devuelve null si la asignacion todavia no abre', () => {
    const situacion = determinarSituacionAsignacion(
      { fechaApertura: horasDesdeAhora(5), porcentajeConsumo: 0 },
      AHORA
    );
    expect(situacion).toBeNull();
  });

  it('devuelve "por_vencer_sin_iniciar" cuando cierra en menos de 48h y no la abrio', () => {
    const situacion = determinarSituacionAsignacion(
      { fechaApertura: horasDesdeAhora(-100), fechaCierre: horasDesdeAhora(30), porcentajeConsumo: 0 },
      AHORA
    );
    expect(situacion).toBe('por_vencer_sin_iniciar');
  });

  it('devuelve "por_vencer_medio_camino" cuando cierra en menos de 48h y va <50%', () => {
    const situacion = determinarSituacionAsignacion(
      { fechaApertura: horasDesdeAhora(-100), fechaCierre: horasDesdeAhora(30), porcentajeConsumo: 35 },
      AHORA
    );
    expect(situacion).toBe('por_vencer_medio_camino');
  });

  it('devuelve null cuando cierra en menos de 48h pero ya va >=50% (encaminada)', () => {
    const situacion = determinarSituacionAsignacion(
      { fechaApertura: horasDesdeAhora(-100), fechaCierre: horasDesdeAhora(30), porcentajeConsumo: 60 },
      AHORA
    );
    expect(situacion).toBeNull();
  });

  it('devuelve null cuando la asignacion ya cerro', () => {
    const situacion = determinarSituacionAsignacion(
      { fechaApertura: horasDesdeAhora(-100), fechaCierre: horasDesdeAhora(-1), porcentajeConsumo: 0 },
      AHORA
    );
    expect(situacion).toBeNull();
  });

  it('devuelve "recien_disponible_sin_iniciar" cuando abrio hace <=48h y no la toco', () => {
    const situacion = determinarSituacionAsignacion(
      { fechaApertura: horasDesdeAhora(-20), porcentajeConsumo: 0 },
      AHORA
    );
    expect(situacion).toBe('recien_disponible_sin_iniciar');
  });

  it('devuelve null cuando abrio hace mucho, no hay cierre urgente, y no la toco (no es una situacion puntual)', () => {
    const situacion = determinarSituacionAsignacion(
      { fechaApertura: horasDesdeAhora(-500), porcentajeConsumo: 0 },
      AHORA
    );
    expect(situacion).toBeNull();
  });
});

describe('detectarInactividadProlongada', () => {
  it('devuelve false si no hay ultima actividad registrada', () => {
    expect(detectarInactividadProlongada(undefined, AHORA)).toBe(false);
  });

  it('devuelve false con menos de 14 dias de inactividad', () => {
    const hace10Dias = new Date(AHORA.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(detectarInactividadProlongada(hace10Dias, AHORA)).toBe(false);
  });

  it('devuelve true con 14 dias o mas de inactividad', () => {
    const hace14Dias = new Date(AHORA.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    expect(detectarInactividadProlongada(hace14Dias, AHORA)).toBe(true);
  });
});

describe('elegirComentario', () => {
  const situaciones: SituacionRecordatorio[] = [
    'por_vencer_sin_iniciar',
    'por_vencer_medio_camino',
    'recien_disponible_sin_iniciar',
    'inactividad_prolongada',
  ];

  it.each(situaciones)('devuelve un comentario no vacio para %s', (situacion) => {
    const comentario = elegirComentario(situacion, 'Poomsae Taegeuk Il Jang');
    expect(typeof comentario).toBe('string');
    expect(comentario.length).toBeGreaterThan(0);
  });

  it('sustituye {material} por el titulo real', () => {
    const comentario = elegirComentario('por_vencer_sin_iniciar', 'Poomsae Taegeuk Il Jang');
    expect(comentario).toContain('Poomsae Taegeuk Il Jang');
    expect(comentario).not.toContain('{material}');
  });

  it('no rompe cuando la situacion no usa {material} (inactividad_prolongada) sin titulo', () => {
    const comentario = elegirComentario('inactividad_prolongada', undefined);
    expect(comentario.length).toBeGreaterThan(0);
  });

  it('nunca repite el ultimo comentario mostrado, en muchas elecciones sucesivas', () => {
    let ultimo: string | undefined;
    for (let i = 0; i < 200; i++) {
      const elegido = elegirComentario('por_vencer_sin_iniciar', undefined, ultimo);
      if (ultimo) expect(elegido).not.toBe(ultimo);
      ultimo = elegido;
    }
  });

  it('elige entre las 5 variantes de la libreria a lo largo de muchas llamadas', () => {
    const vistos = new Set<string>();
    let ultimo: string | undefined;
    for (let i = 0; i < 200; i++) {
      const elegido = elegirComentario('recien_disponible_sin_iniciar', 'Material X', ultimo);
      vistos.add(elegido);
      ultimo = elegido;
    }
    expect(vistos.size).toBe(5);
  });
});
