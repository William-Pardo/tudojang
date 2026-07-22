import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PestanaMaterialesJornada, {
  prepararMaterialesJornada,
  type PestanaMaterialesJornadaProps,
} from './PestanaMaterialesJornada';
import type { AsignacionDraft } from './AsignarMaterialWizard';
import type { RecursoAcademico } from '../../models/academico/recurso';
import { GradoTKD } from '../../tipos';

// Subtarea 12.7 (Parte 2): PestanaMaterialesJornada envuelve AsignarMaterialWizard para UNA
// jornada especifica, sin depender del estado del carrusel de AsignacionesView.tsx. Este
// archivo lo testea aislado (props mock via RTL), sin montar AsignacionesView.tsx completo,
// tal como pide el alcance de la tarea. Todavia no tiene consumidor real en produccion — eso
// es intencional, ver comentario en el componente (12.9 lo va a consumir).

const gruposObjetivoReales = ['Infantil', 'Precadetes', 'Cadetes', 'Adultos', 'Todos'];

function crearRecurso(overrides: Partial<RecursoAcademico> = {}): RecursoAcademico {
  return {
    id: 'recurso-1',
    tenantId: 'tenant-demo',
    proveedor: 'google_drive',
    externalFileId: 'drive-1',
    nombre: 'Recurso',
    mimeType: 'application/pdf',
    ficha: {
      disciplina: 'Taekwondo',
      tipo: 'pdf',
      usos: ['estudio'],
      tags: [],
    },
    estado: 'aprobado',
    creadoPorUid: 'admin-demo',
    creadoEn: '2026-07-01T00:00:00.000Z',
    actualizadoEn: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

const materialPdf = crearRecurso({
  id: 'recurso-pdf',
  nombre: 'Fundamentos tecnicos',
  mimeType: 'application/pdf',
  ficha: { disciplina: 'Taekwondo', tipo: 'pdf', usos: ['estudio'], tags: ['infantil', 'iniciacion'] },
});

const materialVideo = crearRecurso({
  id: 'recurso-video',
  nombre: 'Refuerzo patada frontal',
  mimeType: 'video/mp4',
  ficha: { disciplina: 'Taekwondo', tipo: 'video', usos: ['refuerzo'], tags: ['combate'] },
});

const materialYaAsignado = crearRecurso({
  id: 'recurso-ya-asignado',
  nombre: 'Material duplicado de esta clase',
});

const recursosDisponibles = [materialPdf, materialVideo, materialYaAsignado];

const renderPestana = (overrides: Partial<PestanaMaterialesJornadaProps> = {}) => {
  const onCancelar = jest.fn();
  const onConfirmar = jest.fn().mockResolvedValue(undefined);
  const utils = render(
    <PestanaMaterialesJornada
      jornadaId="jornada-1"
      modo="crear"
      recursosDisponibles={recursosDisponibles}
      tagsPrograma={['infantil', 'iniciacion']}
      gruposObjetivo={gruposObjetivoReales}
      recursoIdsAsignados={['recurso-ya-asignado']}
      onCancelar={onCancelar}
      onConfirmar={onConfirmar}
      {...overrides}
    />
  );
  return { ...utils, onCancelar, onConfirmar };
};

describe('prepararMaterialesJornada (helper puro)', () => {
  it('excluye los recursos ya asignados a la jornada', () => {
    const resultado = prepararMaterialesJornada(recursosDisponibles, [], ['recurso-ya-asignado']);

    expect(resultado.map((r) => r.id)).toEqual(['recurso-pdf', 'recurso-video']);
  });

  it('prioriza (no filtra) los recursos que matchean tags del programa', () => {
    const resultado = prepararMaterialesJornada([materialVideo, materialPdf], ['infantil']);

    expect(resultado.map((r) => r.id)).toEqual(['recurso-pdf', 'recurso-video']);
  });

  it('sin tags de programa conserva el orden original', () => {
    const resultado = prepararMaterialesJornada([materialVideo, materialPdf], []);

    expect(resultado.map((r) => r.id)).toEqual(['recurso-video', 'recurso-pdf']);
  });

  it('sin recursoIdsAsignados no excluye nada', () => {
    const resultado = prepararMaterialesJornada(recursosDisponibles, []);

    expect(resultado).toHaveLength(3);
  });
});

describe('PestanaMaterialesJornada', () => {
  it('renderiza el wizard con los materiales de la jornada ya excluidos y priorizados', () => {
    // tagsPrograma=[] para aislar la exclusion de duplicados del comportamiento de
    // "match de tags" del propio AsignarMaterialWizard (que oculta los "sin match" detras
    // de un toggle cuando hay al menos un match) — eso no es responsabilidad de este wrapper.
    renderPestana({ tagsPrograma: [] });

    // El ya asignado a esta jornada no debe ofrecerse en el Paso 1.
    expect(screen.queryByRole('button', { name: /material duplicado de esta clase/i })).not.toBeInTheDocument();
    // Los que si estan disponibles, si.
    expect(screen.getByRole('button', { name: /fundamentos tecnicos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refuerzo patada frontal/i })).toBeInTheDocument();
  });

  it('pasa gruposObjetivo reales al wizard (Paso 2)', async () => {
    const user = userEvent.setup();
    renderPestana();

    await user.click(screen.getByRole('button', { name: /fundamentos tecnicos/i }));
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));

    const grupo = screen.getByLabelText(/grupo objetivo/i) as HTMLSelectElement;
    expect(Array.from(grupo.options).map((option) => option.value)).toEqual(gruposObjetivoReales);
  });

  it('el flujo completo de onConfirmar llega con el draft acumulado (RED original: onConfirmar debe fluir)', async () => {
    const user = userEvent.setup();
    const { onConfirmar } = renderPestana();

    await user.click(screen.getByRole('button', { name: /fundamentos tecnicos/i }));
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));
    await user.click(screen.getByRole('button', { name: 'Blanco' }));
    await user.click(screen.getByRole('button', { name: /^asignar$/i }));

    expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({
      recursoId: 'recurso-pdf',
      grados: [GradoTKD.Blanco],
    }));
  });

  it('onCancelar se dispara al cerrar el wizard', async () => {
    const user = userEvent.setup();
    const { onCancelar } = renderPestana();

    await user.click(screen.getByRole('button', { name: /cerrar asistente/i }));

    expect(onCancelar).toHaveBeenCalledTimes(1);
  });

  it('modo editar: abre directamente en Paso 2 con el draftInicial de la jornada', () => {
    const draftExistente: AsignacionDraft = {
      recursoId: 'recurso-pdf',
      destinatario: 'grupo',
      grupoObjetivo: 'Infantil',
      momento: 'preparacion',
      criterio: 'estudio',
      fechaApertura: '2026-07-01',
      fechaCierre: '2026-09-30',
      grados: [GradoTKD.Blanco],
    };

    renderPestana({ modo: 'editar', draftInicial: draftExistente, recursoIdsAsignados: [] });

    expect(screen.getByRole('heading', { name: /configurar/i })).toBeInTheDocument();
    expect(screen.getByText(/fundamentos tecnicos/i)).toBeInTheDocument();
  });

  it('sin recursoIdsAsignados (jornada sin materiales previos) no excluye nada', () => {
    renderPestana({ recursoIdsAsignados: undefined, tagsPrograma: [] });

    expect(screen.getByRole('button', { name: /material duplicado de esta clase/i })).toBeInTheDocument();
  });
});
