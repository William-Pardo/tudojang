import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import { GradoTKD } from '../tipos';

const mockBookNew = jest.fn(() => ({}));
const mockAoaToSheet = jest.fn((data: unknown) => ({ data }));
const mockBookAppendSheet = jest.fn();
const mockSheetToJson = jest.fn();
const mockWriteFile = jest.fn();
const mockRead = jest.fn();

jest.mock('xlsx', () => ({
  utils: {
    book_new: (...args: unknown[]) => mockBookNew(...args),
    aoa_to_sheet: (...args: unknown[]) => mockAoaToSheet(...args),
    book_append_sheet: (...args: unknown[]) => mockBookAppendSheet(...args),
    sheet_to_json: (...args: unknown[]) => mockSheetToJson(...args),
  },
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  read: (...args: unknown[]) => mockRead(...args),
}));

import ModalImportacionMasiva from './ModalImportacionMasiva';

const mockMostrarNotificacion = jest.fn();
const mockAgregarEstudiante = jest.fn();
let mockSedesVisibles: { id: string; nombre: string }[] = [{ id: 'sede-1', nombre: 'Principal' }];

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    tr: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
  },
}));

jest.mock('../context/NotificacionContext', () => ({
  useNotificacion: () => ({ mostrarNotificacion: mockMostrarNotificacion }),
}));

jest.mock('../context/DataContext', () => ({
  useSedes: () => ({ sedesVisibles: mockSedesVisibles }),
  useEstudiantes: () => ({ agregarEstudiante: mockAgregarEstudiante }),
}));

jest.mock('./Loader', () => ({
  __esModule: true,
  default: ({ texto }: { texto: string }) => <div data-testid="loader">{texto}</div>,
}));

const mockFileReaderInstance: {
  result: ArrayBuffer | null;
  onload: ((event: { target: { result: ArrayBuffer | null } }) => void) | null;
  readAsArrayBuffer: jest.Mock;
} = {
  result: null,
  onload: null,
  readAsArrayBuffer: jest.fn(function (this: typeof mockFileReaderInstance, _file: File) {
    if (this.onload && this.result) {
      this.onload({ target: { result: this.result } });
    }
  }),
};

const filaBase = {
  Nombres: 'JUAN',
  Apellidos: 'PEREZ',
  Identificacion: '10203040',
  Fecha_Nacimiento_AAAA_MM_DD: '1990-05-10',
  Telefono: '3001234567',
  Correo: 'juan@email.com',
  Grado_Actual: GradoTKD.Blanco,
  Tutor_Nombre_Completo: '',
  Tutor_Identificacion: '',
  Tutor_Correo: '',
  Tutor_Telefono: '',
  Alergias: 'Ninguna',
  Lesiones: 'Ninguna',
  Personas_Autorizadas: 'Padre',
};

const renderModal = (props: Partial<React.ComponentProps<typeof ModalImportacionMasiva>> = {}) => {
  const onCerrar = props.onCerrar ?? jest.fn();
  const onExito = props.onExito ?? jest.fn();
  const abierto = props.abierto ?? true;
  const view = render(
    <ModalImportacionMasiva abierto={abierto} onCerrar={onCerrar} onExito={onExito} />
  );
  return { ...view, onCerrar, onExito };
};

const simularCargaExcel = async (
  container: HTMLElement,
  filas: Record<string, unknown>[]
) => {
  mockRead.mockReturnValue({
    SheetNames: ['DATOS_A_IMPORTAR'],
    Sheets: { DATOS_A_IMPORTAR: {} },
  });
  mockSheetToJson.mockReturnValue(filas);

  mockFileReaderInstance.result = new ArrayBuffer(8);
  const file = new File(['excel'], 'alumnos.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() => {
    expect(screen.getByText('Filas Cargadas')).toBeInTheDocument();
  });
};

describe('ModalImportacionMasiva', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRead.mockReset();
    mockSheetToJson.mockReset();
    mockSedesVisibles = [{ id: 'sede-1', nombre: 'Principal' }];
    mockAgregarEstudiante.mockResolvedValue(undefined);
    mockFileReaderInstance.onload = null;
    mockFileReaderInstance.result = null;
    jest.spyOn(window, 'FileReader').mockImplementation(() => mockFileReaderInstance as unknown as FileReader);
    Object.defineProperty(HTMLInputElement.prototype, 'click', {
      configurable: true,
      value: jest.fn(),
    });
  });

  it('no renderiza nada cuando abierto es false', () => {
    const { container } = renderModal({ abierto: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra el paso inicial con ayuda y acciones de plantilla y carga', () => {
    renderModal();
    expect(screen.getByText('Auditor de Carga Masiva')).toBeInTheDocument();
    expect(screen.getByText('Paso 1: Preparar Excel')).toBeInTheDocument();
    expect(screen.getByText('Paso 2: Inyectar Datos')).toBeInTheDocument();
    expect(screen.getByText(/Aviso de Seguridad Técnica/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Obtener Plantilla Inteligente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Seleccionar Archivo Lleno/i })).toBeInTheDocument();
  });

  it('llama onCerrar al pulsar el botón de cerrar del encabezado', async () => {
    const user = userEvent.setup();
    const { onCerrar } = renderModal();
    const botones = screen.getAllByRole('button');
    const cerrar = botones.find((btn) => btn.querySelector('svg'))!;
    await user.click(cerrar);
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('descarga la plantilla oficial y muestra notificación informativa', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: /Obtener Plantilla Inteligente/i }));
    expect(mockBookNew).toHaveBeenCalled();
    expect(mockAoaToSheet).toHaveBeenCalled();
    expect(mockBookAppendSheet).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledWith(expect.anything(), 'Plantilla_Oficial_Tudojang_SaaS.xlsx');
    expect(mockMostrarNotificacion).toHaveBeenCalledWith(
      'Plantilla generada con Manual de Reglas.',
      'info'
    );
  });

  it('dispara el click del input oculto al seleccionar archivo', async () => {
    const user = userEvent.setup();
    const { container } = renderModal();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = jest.spyOn(input, 'click');
    await user.click(screen.getByRole('button', { name: /Seleccionar Archivo Lleno/i }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('ignora la selección cuando no hay archivo en el input', () => {
    const { container } = renderModal();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(mockRead).not.toHaveBeenCalled();
    expect(screen.queryByText('Filas Cargadas')).not.toBeInTheDocument();
  });

  it('notifica error cuando el archivo no contiene registros', async () => {
    const { container } = renderModal();
    mockRead.mockReturnValue({
      SheetNames: ['DATOS_A_IMPORTAR'],
      Sheets: { DATOS_A_IMPORTAR: {} },
    });
    mockSheetToJson.mockReturnValue([]);
    mockFileReaderInstance.result = new ArrayBuffer(8);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(['vacio'], 'vacio.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })],
      },
    });
    await waitFor(() => {
      expect(mockMostrarNotificacion).toHaveBeenCalledWith('El archivo no contiene registros.', 'error');
    });
  });

  it('notifica error cuando la estructura del Excel no coincide con la plantilla', async () => {
    const { container } = renderModal();
    mockRead.mockReturnValue({
      SheetNames: ['DATOS_A_IMPORTAR'],
      Sheets: { DATOS_A_IMPORTAR: {} },
    });
    mockSheetToJson.mockReturnValue([{ Nombres: 'Solo una columna' }]);
    mockFileReaderInstance.result = new ArrayBuffer(8);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(['mal'], 'mal.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })],
      },
    });
    await waitFor(() => {
      expect(mockMostrarNotificacion).toHaveBeenCalledWith(
        'Estructura inválida. Por favor usa la plantilla original.',
        'error'
      );
    });
  });

  it('notifica error crítico cuando falla la lectura del archivo', async () => {
    const { container } = renderModal();
    mockRead.mockImplementation(() => {
      throw new Error('Archivo corrupto');
    });
    mockFileReaderInstance.result = new ArrayBuffer(8);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(['x'], 'corrupto.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })],
      },
    });
    await waitFor(() => {
      expect(mockMostrarNotificacion).toHaveBeenCalledWith('Error crítico al leer el archivo.', 'error');
    });
  });

  it('muestra la vista previa con auditoría de filas válidas e inválidas', async () => {
    const { container } = renderModal();
    await simularCargaExcel(container, [
      { ...filaBase, nombres: undefined, Nombres: '' },
      {
        ...filaBase,
        Nombres: 'PEDRO',
        Apellidos: 'LOPEZ',
        Identificacion: 'ABC',
        Fecha_Nacimiento_AAAA_MM_DD: '2015-05-10',
        Correo: '',
        Tutor_Nombre_Completo: '',
        Tutor_Identificacion: '',
        Tutor_Telefono: '',
        Grado_Actual: 'Grado Inventado',
        Alergias: '',
      },
      {
        ...filaBase,
        Nombres: 'ANA',
        Apellidos: 'RUIZ',
        Identificacion: '99887766',
        Fecha_Nacimiento_AAAA_MM_DD: '1988-03-15',
        Correo: '',
        Alergias: 'Ninguna',
      },
      {
        ...filaBase,
        nombres: 'lower case keys',
        NOMBRES: 'CARLOS',
        APELLIDOS: 'DIAZ',
        IDENTIFICACION: '55443322',
        FECHA_NACIMIENTO_AAAA_MM_DD: '1991-07-20',
        TELEFONO: '3001112233',
        CORREO: 'carlos@email.com',
        GRADO_ACTUAL: GradoTKD.Verde,
        ALERGIAS: 'Ninguna',
        LESIONES: 'Ninguna',
        PERSONAS_AUTORIZADAS: 'Madre',
      },
    ]);

    expect(screen.getByText('Filas Cargadas').closest('div')?.parentElement).toHaveTextContent('4');
    expect(screen.getByText('Inconsistencias').closest('div')?.parentElement).toHaveTextContent('3');
    expect(screen.getByText('Falta Nombre')).toBeInTheDocument();
    expect(screen.getByText('ID Inválido')).toBeInTheDocument();
    expect(screen.getByText('Menor sin datos de Tutor')).toBeInTheDocument();
    expect(screen.getByText(/Grado 'Grado Inventado' no reconocido/)).toBeInTheDocument();
    expect(screen.getByText('Ficha médica vacía')).toBeInTheDocument();
    expect(screen.getByText('Adulto requiere Correo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Corregir Errores/i })).toBeDisabled();
  });

  it('vuelve al paso inicial al cancelar la vista previa', async () => {
    const user = userEvent.setup();
    const { container } = renderModal();
    await simularCargaExcel(container, [{ ...filaBase }]);
    await user.click(screen.getByRole('button', { name: /^Cancelar$/i }));
    expect(screen.getByText('Paso 1: Preparar Excel')).toBeInTheDocument();
    expect(screen.queryByText('Filas Cargadas')).not.toBeInTheDocument();
  });

  it('importa filas válidas, muestra loader, notifica éxito y llama onExito', async () => {
    const user = userEvent.setup();
    const onExito = jest.fn();
    const { container } = renderModal({ onExito });
    const fechaDate = new Date('1992-11-01');
    await simularCargaExcel(container, [
      { ...filaBase, Fecha_Nacimiento_AAAA_MM_DD: fechaDate },
      {
        ...filaBase,
        Nombres: 'SOFIA',
        Apellidos: 'GOMEZ',
        Identificacion: '77665544',
        Fecha_Nacimiento_AAAA_MM_DD: '2014-02-02',
        Correo: '',
        Tutor_Nombre_Completo: 'LUIS GOMEZ',
        Tutor_Identificacion: '11223344',
        Tutor_Telefono: '3009998877',
      },
    ]);

    expect(screen.getByRole('button', { name: /Confirmar e Inyectar/i })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /Confirmar e Inyectar/i }));

    expect(screen.getByTestId('loader')).toHaveTextContent('Sincronizando expedientes masivos...');
    expect(screen.getByText(/Protocolo Aliant Bulk Sync Activo/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockAgregarEstudiante).toHaveBeenCalledTimes(2);
    });

    expect(mockAgregarEstudiante).toHaveBeenCalledWith(
      expect.objectContaining({
        nombres: 'JUAN',
        sedeId: 'sede-1',
        grado: GradoTKD.Blanco,
        tutor: undefined,
        fechaNacimiento: '1992-11-01',
      })
    );
    expect(mockAgregarEstudiante).toHaveBeenCalledWith(
      expect.objectContaining({
        nombres: 'SOFIA',
        tutor: expect.objectContaining({
          nombres: 'LUIS GOMEZ',
          numeroIdentificacion: '11223344',
          telefono: '3009998877',
        }),
      })
    );
    expect(mockMostrarNotificacion).toHaveBeenCalledWith(
      'Importación Exitosa: 2 alumnos registrados.',
      'success'
    );
    expect(onExito).toHaveBeenCalledTimes(1);
  });

  it('continúa la importación aunque una fila falle y usa sede principal por defecto', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSedesVisibles = [];
    mockAgregarEstudiante
      .mockRejectedValueOnce(new Error('Duplicado'))
      .mockResolvedValueOnce(undefined);

    const user = userEvent.setup();
    const { container } = renderModal();
    await simularCargaExcel(container, [
      { ...filaBase, Identificacion: '11111111' },
      { ...filaBase, Nombres: 'MARTA', Apellidos: 'VEGA', Identificacion: '22222222' },
    ]);

    await user.click(screen.getByRole('button', { name: /Confirmar e Inyectar/i }));

    await waitFor(() => {
      expect(mockMostrarNotificacion).toHaveBeenCalledWith(
        'Importación Exitosa: 1 alumnos registrados.',
        'success'
      );
    });

    expect(mockAgregarEstudiante).toHaveBeenCalledWith(
      expect.objectContaining({ sedeId: 'principal' })
    );
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('marca filas válidas sin advertencias como REGISTRO ÓPTIMO', async () => {
    const { container } = renderModal();
    await simularCargaExcel(container, [{ ...filaBase }]);
    expect(screen.getByText('REGISTRO ÓPTIMO')).toBeInTheDocument();
    expect(screen.getByText('Inconsistencias').closest('div')?.parentElement).toHaveTextContent('0');
  });

  it('calcula edad cero y muestra error de fecha inválida o vacía', async () => {
    const { container } = renderModal();
    await simularCargaExcel(container, [
      { ...filaBase, Fecha_Nacimiento_AAAA_MM_DD: 'fecha-invalida' },
      { ...filaBase, Nombres: 'SIN FECHA', Identificacion: '33334444', Fecha_Nacimiento_AAAA_MM_DD: '' },
    ]);
    expect(screen.getAllByText('Formato Fecha Error').length).toBeGreaterThanOrEqual(2);
  });

  it('ajusta la edad cuando el cumpleaños cae más adelante en el mismo mes', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-22T12:00:00.000Z'));
    const { container } = renderModal();
    await simularCargaExcel(container, [
      {
        ...filaBase,
        Nombres: 'CUMPLE',
        Apellidos: 'MES',
        Identificacion: '13131313',
        Fecha_Nacimiento_AAAA_MM_DD: '2006-06-25',
        Correo: 'cumple@email.com',
      },
    ]);
    expect(screen.getByText('19 Años')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('convierte fechas Date al importar estudiantes', async () => {
    const user = userEvent.setup();
    const { container } = renderModal();
    const fechaDate = new Date('1985-08-20T12:00:00.000Z');
    await simularCargaExcel(container, [
      {
        ...filaBase,
        Nombres: 'DATE',
        Apellidos: 'OBJ',
        Identificacion: '80808080',
        Fecha_Nacimiento_AAAA_MM_DD: fechaDate,
        Correo: 'date@email.com',
      },
    ]);

    await user.click(screen.getByRole('button', { name: /Confirmar e Inyectar/i }));

    await waitFor(() => {
      expect(mockAgregarEstudiante).toHaveBeenCalledWith(
        expect.objectContaining({
          fechaNacimiento: fechaDate.toISOString().split('T')[0],
        })
      );
    });
  });

  it('muestra identidad genérica cuando faltan nombres y apellidos', async () => {
    const { container } = renderModal();
    await simularCargaExcel(container, [
      {
        ...filaBase,
        Nombres: '',
        Apellidos: '',
        Identificacion: '',
      },
    ]);
    expect(screen.getByText('Fila sin Identidad')).toBeInTheDocument();
    expect(screen.getByText('Falta Nombre')).toBeInTheDocument();
    expect(screen.getByText('ID Inválido')).toBeInTheDocument();
  });

  it('aplica valores por defecto al importar filas con campos opcionales vacíos', async () => {
    const user = userEvent.setup();
    const { container } = renderModal();
    await simularCargaExcel(container, [
      {
        Nombres: 'LAURA',
        Apellidos: 'MESA',
        Identificacion: '90909090',
        Fecha_Nacimiento_AAAA_MM_DD: '1993-04-04',
        Telefono: '3005556677',
        Correo: 'laura@email.com',
        Grado_Actual: '',
        Tutor_Nombre_Completo: '',
        Tutor_Identificacion: '',
        Tutor_Telefono: '',
        Alergias: '',
        Lesiones: '',
        Personas_Autorizadas: '',
      },
    ]);

    await user.click(screen.getByRole('button', { name: /Confirmar e Inyectar/i }));

    await waitFor(() => {
      expect(mockAgregarEstudiante).toHaveBeenCalledWith(
        expect.objectContaining({
          grado: GradoTKD.Blanco,
          alergias: 'NINGUNA',
          lesiones: 'NINGUNA',
          personasAutorizadas: '',
        })
      );
    });
  });

  it('importa filas con teléfono vacío usando cadena vacía', async () => {
    const user = userEvent.setup();
    const { container } = renderModal();
    await simularCargaExcel(container, [
      {
        ...filaBase,
        Nombres: 'SIN',
        Apellidos: 'TELEFONO',
        Identificacion: '70707070',
        Telefono: '',
        Correo: 'sin@email.com',
      },
    ]);

    await user.click(screen.getByRole('button', { name: /Confirmar e Inyectar/i }));

    await waitFor(() => {
      expect(mockAgregarEstudiante).toHaveBeenCalledWith(
        expect.objectContaining({ telefono: '' })
      );
    });
  });

  it('no rompe al desmontar el modal durante la interacción', () => {
    const { unmount } = renderModal();
    expect(screen.getByText('Auditor de Carga Masiva')).toBeInTheDocument();
    unmount();
    expect(screen.queryByText('Auditor de Carga Masiva')).not.toBeInTheDocument();
  });
});
