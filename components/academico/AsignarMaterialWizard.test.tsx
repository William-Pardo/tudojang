import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AsignarMaterialWizard, { type AsignacionDraft } from './AsignarMaterialWizard';
import type { RecursoAcademico } from '../../models/academico/recurso';
import { GradoTKD } from '../../tipos';

// Los tests del Paso 3 navegan el wizard completo con userEvent y recorren las 13 variantes
// de grado; tardan 5-10s por su cuenta y, bajo la carga del run completo (154 suites),
// cruzaban el timeout default de 5000ms de jest de forma intermitente (flake preexistente,
// no relacionado con ningun cambio de logica). 30s da holgura de sobra sin ocultar un cuelgue
// real (un cuelgue verdadero igual pasa los 30s).
jest.setTimeout(30000);

const gruposObjetivoReales = ['Infantil', 'Precadetes', 'Cadetes', 'Adultos', 'Todos'];

const materialPdf: RecursoAcademico = {
  id: 'recurso-pdf',
  tenantId: 'tenant-demo',
  proveedor: 'google_drive',
  externalFileId: 'drive-pdf-1',
  nombre: 'Fundamentos tecnicos',
  mimeType: 'application/pdf',
  ficha: {
    disciplina: 'Taekwondo',
    tipo: 'pdf',
    usos: ['estudio', 'preparacion'],
    tags: ['infantil', 'iniciacion'],
  },
  estado: 'aprobado',
  creadoPorUid: 'admin-demo',
  creadoEn: '2026-06-27T00:00:00.000Z',
  actualizadoEn: '2026-06-27T00:00:00.000Z',
};

const materialVideo: RecursoAcademico = {
  id: 'recurso-video',
  tenantId: 'tenant-demo',
  proveedor: 'google_drive',
  externalFileId: 'drive-video-1',
  nombre: 'Refuerzo patada frontal',
  mimeType: 'video/mp4',
  ficha: {
    disciplina: 'Taekwondo',
    tipo: 'video',
    usos: ['refuerzo'],
    tags: ['combate'],
  },
  estado: 'aprobado',
  creadoPorUid: 'admin-demo',
  creadoEn: '2026-06-27T00:00:00.000Z',
  actualizadoEn: '2026-06-27T00:00:00.000Z',
};

const materialesDisponibles = [materialPdf, materialVideo];
const tagsPrograma = ['infantil', 'iniciacion', 'patada frontal'];

type WizardProps = React.ComponentProps<typeof AsignarMaterialWizard>;

const renderWizard = (overrides: Partial<WizardProps> = {}) => {
  const onCancelar = jest.fn();
  const onConfirmar = jest.fn().mockResolvedValue(undefined);
  const utils = render(
    <AsignarMaterialWizard
      modo="crear"
      materialesDisponibles={materialesDisponibles}
      tagsPrograma={tagsPrograma}
      gruposObjetivo={gruposObjetivoReales}
      draftInicial={null}
      onCancelar={onCancelar}
      onConfirmar={onConfirmar}
      {...overrides}
    />
  );
  return { ...utils, onCancelar, onConfirmar };
};

const irAPaso2 = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /fundamentos tecnicos/i }));
  await user.click(screen.getByRole('button', { name: /^continuar$/i }));
};

const irAPaso3 = async (user: ReturnType<typeof userEvent.setup>) => {
  await irAPaso2(user);
  await user.click(screen.getByRole('button', { name: /^continuar$/i }));
};

describe('AsignarMaterialWizard', () => {
  describe('Paso 1: seleccion de material', () => {
    it('deshabilita Continuar sin material seleccionado y lo habilita al elegir uno', async () => {
      const user = userEvent.setup();
      renderWizard();

      expect(screen.getByRole('button', { name: /^continuar$/i })).toBeDisabled();

      await user.click(screen.getByRole('button', { name: /fundamentos tecnicos/i }));

      expect(screen.getByRole('button', { name: /^continuar$/i })).toBeEnabled();
    });

    it('muestra la cantidad de tags coincidentes con el programa por material', () => {
      renderWizard();

      // materialPdf coincide en 'infantil' e 'iniciacion' (2 de sus tags estan en tagsPrograma)
      expect(screen.getByText('2 tags')).toBeInTheDocument();
    });

    it('permite buscar material por texto', async () => {
      const user = userEvent.setup();
      renderWizard();

      await user.type(screen.getByLabelText(/buscar material/i), 'refuerzo');

      expect(screen.queryByRole('button', { name: /fundamentos tecnicos/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refuerzo patada frontal/i })).toBeInTheDocument();
    });
  });

  describe('Paso 2: configuracion', () => {
    // Fix 2 (correccion post-prueba-manual, "Sí, sacalo"): el campo
    // Destinatario (grupo|estudiante) se retiro del Paso 2 a pedido explicito
    // de producto. El asistente sigue aceptando/emitiendo `destinatario` en
    // el draft (otro codigo depende del campo, ver crearDestinatario en
    // AsignacionesView.tsx), pero ya no es seleccionable por el usuario: el
    // wizard lo fuerza a 'grupo' sin importar lo que traiga draftInicial.
    it('no expone ningun control de Destinatario en el Paso 2', async () => {
      const user = userEvent.setup();
      renderWizard();
      await irAPaso2(user);

      expect(screen.queryByLabelText(/destinatario/i)).not.toBeInTheDocument();
    });

    it('usa la lista real de grupos objetivo', async () => {
      const user = userEvent.setup();
      renderWizard();
      await irAPaso2(user);

      const grupo = screen.getByLabelText(/grupo objetivo/i) as HTMLSelectElement;
      const valores = Array.from(grupo.options).map((option) => option.value);
      expect(valores).toEqual(gruposObjetivoReales);
    });

    it('usa los valores reales de MomentoAsignacion con etiquetas en espanol', async () => {
      const user = userEvent.setup();
      renderWizard();
      await irAPaso2(user);

      const momento = screen.getByLabelText(/momento/i) as HTMLSelectElement;
      const valores = Array.from(momento.options).map((option) => option.value);
      expect(valores).toEqual(['preparacion', 'durante', 'refuerzo_posterior']);
      expect(screen.getByText('Antes de la clase')).toBeInTheDocument();
    });

    it('usa el dominio de criterio de mapearCriterioAUso', async () => {
      const user = userEvent.setup();
      renderWizard();
      await irAPaso2(user);

      const criterio = screen.getByLabelText(/criterio/i) as HTMLSelectElement;
      const valores = Array.from(criterio.options).map((option) => option.value);
      expect(valores).toEqual(['estudio', 'repaso', 'refuerzo', 'evaluacion', 'quiz']);
    });
  });

  describe('Paso 3: grados', () => {
    it('deshabilita Asignar sin ningun grado marcado y lo habilita al marcar uno', async () => {
      const user = userEvent.setup();
      renderWizard();
      await irAPaso3(user);

      expect(screen.getByRole('button', { name: /^asignar$/i })).toBeDisabled();

      await user.click(screen.getByRole('button', { name: 'Blanco' }));

      expect(screen.getByRole('button', { name: /^asignar$/i })).toBeEnabled();
    });

    it('siempre muestra los 13 grados y distingue Blanco de Blanco Punta Amarilla (familias de color)', async () => {
      const user = userEvent.setup();
      renderWizard();
      await irAPaso3(user);

      Object.values(GradoTKD).forEach((grado) => {
        expect(screen.getByRole('button', { name: grado })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Blanco' }));

      expect(screen.getByRole('button', { name: 'Blanco' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Blanco Punta Amarilla' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('"Todos los grados" selecciona y deselecciona las 13 variantes', async () => {
      const user = userEvent.setup();
      renderWizard();
      await irAPaso3(user);

      await user.click(screen.getByRole('button', { name: /todos los grados/i }));
      Object.values(GradoTKD).forEach((grado) => {
        expect(screen.getByRole('button', { name: grado })).toHaveAttribute('aria-pressed', 'true');
      });

      await user.click(screen.getByRole('button', { name: /todos los grados/i }));
      Object.values(GradoTKD).forEach((grado) => {
        expect(screen.getByRole('button', { name: grado })).toHaveAttribute('aria-pressed', 'false');
      });
    });

    it('confirma la asignacion con el draft acumulado a traves de los 3 pasos', async () => {
      const user = userEvent.setup();
      const { onConfirmar } = renderWizard();
      await irAPaso3(user);

      await user.click(screen.getByRole('button', { name: 'Blanco' }));
      await user.click(screen.getByRole('button', { name: /^asignar$/i }));

      expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({
        recursoId: 'recurso-pdf',
        grados: [GradoTKD.Blanco],
      }));
    });
  });

  describe('Modo editar', () => {
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

    it('abre directamente en Paso 2, con Paso 1 inaccesible', () => {
      renderWizard({ modo: 'editar', draftInicial: draftExistente });

      expect(screen.getByRole('heading', { name: /configurar/i })).toBeInTheDocument();
      expect(screen.queryByLabelText(/buscar material/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^atr.s$/i })).not.toBeInTheDocument();
    });

    it('muestra el material de la asignacion existente como chip de solo lectura', () => {
      renderWizard({ modo: 'editar', draftInicial: draftExistente });

      expect(screen.getByText(/fundamentos tecnicos/i)).toBeInTheDocument();
    });

    it('deshabilita Asignar hasta que algun campo difiera del snapshot inicial', async () => {
      const user = userEvent.setup();
      renderWizard({ modo: 'editar', draftInicial: draftExistente });

      await user.click(screen.getByRole('button', { name: /^continuar$/i }));
      expect(screen.getByRole('button', { name: /^asignar$/i })).toBeDisabled();

      await user.click(screen.getByRole('button', { name: 'Amarillo' }));
      expect(screen.getByRole('button', { name: /^asignar$/i })).toBeEnabled();
    });

    it('mantiene Continuar (paso 2) y Atras (paso 3) siempre habilitados aunque no haya cambios', async () => {
      const user = userEvent.setup();
      renderWizard({ modo: 'editar', draftInicial: draftExistente });

      const continuar = screen.getByRole('button', { name: /^continuar$/i });
      expect(continuar).toBeEnabled();
      await user.click(continuar);

      expect(screen.getByRole('button', { name: /^atr.s$/i })).toBeEnabled();
    });

    it('persiste con el mismo id (upsert real): confirma solo el draft, sin recrear recursoId', async () => {
      const user = userEvent.setup();
      const { onConfirmar } = renderWizard({ modo: 'editar', draftInicial: draftExistente });

      await user.click(screen.getByRole('button', { name: /^continuar$/i }));
      await user.click(screen.getByRole('button', { name: 'Amarillo' }));
      await user.click(screen.getByRole('button', { name: /^asignar$/i }));

      expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({
        recursoId: 'recurso-pdf',
        grados: expect.arrayContaining([GradoTKD.Blanco, GradoTKD.Amarillo]),
      }));
    });

    it('Fix 2: el draft de salida siempre trae destinatario "grupo", incluso si draftInicial traia "estudiante"', async () => {
      // Regresion: antes de Fix 2, el Paso 2 dejaba elegir 'estudiante'. Una
      // asignacion vieja con destinatario tipo estudiante que se abre para
      // editar no debe filtrarse tal cual: el wizard normaliza a 'grupo'
      // unconditionalmente porque ya no hay forma de mantener 'estudiante'
      // desde la UI.
      const user = userEvent.setup();
      const { onConfirmar } = renderWizard({
        modo: 'editar',
        draftInicial: { ...draftExistente, destinatario: 'estudiante' },
      });

      await user.click(screen.getByRole('button', { name: /^continuar$/i }));
      await user.click(screen.getByRole('button', { name: 'Amarillo' }));
      await user.click(screen.getByRole('button', { name: /^asignar$/i }));

      expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({
        destinatario: 'grupo',
      }));
    });

    it('en modo editar muestra un chip de reserva si el material no esta en materialesDisponibles', () => {
      // Cuando el padre excluye de materialesDisponibles el material ya
      // asignado a la clase activa (duplicado contra si mismo), este
      // componente no debe romperse: debe mostrar un chip generico en vez de
      // no renderizar nada.
      renderWizard({
        modo: 'editar',
        draftInicial: { ...draftExistente, recursoId: 'recurso-no-listado' },
        materialesDisponibles: [],
      });

      expect(screen.getByText(/material asignado/i)).toBeInTheDocument();
    });
  });
});
