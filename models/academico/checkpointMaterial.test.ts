import {
  resumirCoberturaClase,
  type CheckpointMaterialJornada,
  type EstadoCheckpointMaterial,
} from './checkpointMaterial';

const materiales = (...ids: string[]) => ids.map((id) => ({ asignacionId: id, titulo: `Material ${id}` }));

const cp = (asignacionId: string, estado: EstadoCheckpointMaterial): CheckpointMaterialJornada => ({
  asignacionId, jornadaId: 'j', tenantId: 't', estado, registradoPorUid: 'u', actualizadoEn: 'x',
});

describe('resumirCoberturaClase', () => {
  it('sin materiales => 0% y total 0', () => {
    const r = resumirCoberturaClase([], []);
    expect(r.total).toBe(0);
    expect(r.coberturaPorcentaje).toBe(0);
  });

  it('material sin checkpoint => sin_marcar, peso 0', () => {
    const r = resumirCoberturaClase(materiales('a'), []);
    expect(r.detalle[0].estado).toBe('sin_marcar');
    expect(r.coberturaPorcentaje).toBe(0);
    expect(r.porEstado.sin_marcar).toBe(1);
  });

  it('usado/explicado/practicado pesan 1 (cobertura plena)', () => {
    const r = resumirCoberturaClase(materiales('a', 'b', 'c'), [
      cp('a', 'usado'), cp('b', 'explicado'), cp('c', 'practicado'),
    ]);
    expect(r.coberturaPorcentaje).toBe(100);
  });

  it('parcial y mencionado pesan 0.5', () => {
    const r = resumirCoberturaClase(materiales('a', 'b'), [cp('a', 'parcial'), cp('b', 'mencionado')]);
    // (0.5 + 0.5) / 2 = 50%
    expect(r.coberturaPorcentaje).toBe(50);
  });

  it('no_usado y pendiente pesan 0 pero SI cuentan en el denominador', () => {
    const r = resumirCoberturaClase(materiales('a', 'b'), [cp('a', 'usado'), cp('b', 'no_usado')]);
    // (1 + 0) / 2 = 50%
    expect(r.coberturaPorcentaje).toBe(50);
  });

  it('no_aplica se EXCLUYE del denominador (no baja la cobertura)', () => {
    const r = resumirCoberturaClase(materiales('a', 'b'), [cp('a', 'usado'), cp('b', 'no_aplica')]);
    // solo 'a' aplica: 1/1 = 100%
    expect(r.coberturaPorcentaje).toBe(100);
    expect(r.porEstado.no_aplica).toBe(1);
  });

  it('todos no_aplica => 0% (denominador vacio, sin dividir por cero)', () => {
    const r = resumirCoberturaClase(materiales('a', 'b'), [cp('a', 'no_aplica'), cp('b', 'no_aplica')]);
    expect(r.coberturaPorcentaje).toBe(0);
  });

  it('mezcla realista redondea el porcentaje', () => {
    // usado(1) + parcial(0.5) + sin_marcar(0) sobre 3 aplicables = 1.5/3 = 50%
    const r = resumirCoberturaClase(materiales('a', 'b', 'c'), [cp('a', 'usado'), cp('b', 'parcial')]);
    expect(r.coberturaPorcentaje).toBe(50);
  });
});
