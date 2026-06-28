import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AsistenteVirtual from './AsistenteVirtual';
import { consultarSoporte } from '../servicios/soporte/cliente';
import { crearTicketSoporte, escucharMiTicketActivo } from '../servicios/soporteApi';
import { RolUsuario } from '../tipos';

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, whileHover, whileTap, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

jest.mock('./Iconos', () => {
  const Icon = (props: any) => <svg {...props} />;
  return {
    IconoLogoOficial: Icon,
    IconoCerrar: Icon,
    IconoEnviar: Icon,
    IconoAprobar: Icon,
    IconoInformacion: Icon,
    IconoWhatsApp: Icon,
  };
});

let mockUsuario: any = null;
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ usuario: mockUsuario }),
}));

jest.mock('../servicios/soporte/cliente', () => ({
  consultarSoporte: jest.fn(),
}));

jest.mock('../servicios/soporteApi', () => ({
  crearTicketSoporte: jest.fn(),
  escucharMiTicketActivo: jest.fn(),
}));

describe('AsistenteVirtual', () => {
  const consultarSabonimVirtual = consultarSoporte as jest.Mock;
  const getRemainingQueries = jest.fn(() => 15);
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsuario = null;
    (escucharMiTicketActivo as jest.Mock).mockReturnValue(jest.fn());
  });

  it('identifica visualmente una respuesta local', async () => {
    const user = userEvent.setup();
    (consultarSoporte as jest.Mock).mockResolvedValue({
      state: 'answer', source: 'local', answer: 'Respuesta del catálogo.', remaining: null,
    });
    render(<AsistenteVirtual />);
    await user.click(screen.getByRole('button', { name: 'Abrir chat' }));
    await user.type(screen.getByPlaceholderText(/Describa su inquietud/i), 'Pregunta');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await screen.findByText('Manual verificado')).toBeInTheDocument();
  });

  it('muestra cuota agotada y ofrece soporte humano', async () => {
    const user = userEvent.setup();
    (consultarSoporte as jest.Mock).mockResolvedValue({
      state: 'quota_exhausted',
      source: 'human',
      answer: 'La cuota de IA está agotada. El manual continúa disponible.',
      canEscalate: true,
    });
    render(<AsistenteVirtual />);
    await user.click(screen.getByRole('button', { name: 'Abrir chat' }));
    await user.type(screen.getByPlaceholderText(/Describa su inquietud/i), 'Pregunta desconocida');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await screen.findByText(/cuota de IA está agotada/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Solicitar Asesor Master/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar por WhatsApp/i })).toBeInTheDocument();
  });

  it('abre WhatsApp solo después del consentimiento explícito', async () => {
    const user = userEvent.setup();
    mockUsuario = { id: 'u1', tenantId: 't1', nombreUsuario: 'Ana', email: 'ana@test.com' };
    (consultarSoporte as jest.Mock).mockResolvedValue({
      state: 'unavailable', source: 'human', answer: 'Puedo escalar tu solicitud.', canEscalate: true,
    });
    (crearTicketSoporte as jest.Mock).mockResolvedValue({
      whatsappUrl: 'https://wa.me/573001234567?text=ticket',
    });
    render(<AsistenteVirtual />);
    await user.click(screen.getByRole('button', { name: 'Abrir chat' }));
    await user.type(screen.getByPlaceholderText(/Describa su inquietud/i), 'Necesito ayuda');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    await user.click(await screen.findByRole('button', { name: /Continuar por WhatsApp/i }));

    expect(crearTicketSoporte).toHaveBeenCalledWith(expect.any(Object), { whatsappConsent: true });
    expect(await screen.findByRole('link', { name: /Abrir WhatsApp/i })).toHaveAttribute(
      'href',
      'https://wa.me/573001234567?text=ticket',
    );
  });

  it('muestra un error amigable y detiene la carga si falla la consulta', async () => {
    const user = userEvent.setup();
    (consultarSabonimVirtual as jest.Mock).mockRejectedValue(new Error('Network error'));
    render(<AsistenteVirtual />);

    await user.click(screen.getByRole('button', { name: 'Abrir chat' }));
    const input = screen.getByPlaceholderText('Describa su inquietud...');
    await user.type(input, '¿Cómo registro una asistencia?');
    await user.click(input.parentElement!.querySelector('button')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('Error al cargar la respuesta');
    await waitFor(() => expect(input).not.toBeDisabled());
  });

  it('abre el chat y muestra el saludo inicial', async () => {
    const user = userEvent.setup();
    render(<AsistenteVirtual />);
    await user.click(screen.getByRole('button', { name: 'Abrir chat' }));
    expect(await screen.findByText(/Kyeong-rye Sabonim/i)).toBeInTheDocument();
  });

  it('cierra el chat desde el botón de cerrar', async () => {
    const user = userEvent.setup();
    render(<AsistenteVirtual />);
    await user.click(screen.getByRole('button', { name: 'Abrir chat' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar asistente' }));
    expect(screen.queryByText(/Kyeong-rye Sabonim/i)).not.toBeInTheDocument();
  });

  it('muestra una respuesta normal en el historial', async () => {
    const user = userEvent.setup();
    (consultarSabonimVirtual as jest.Mock).mockResolvedValue('Esta es la respuesta del asistente.');
    render(<AsistenteVirtual />);
    await user.click(screen.getByRole('button', { name: 'Abrir chat' }));
    await user.type(screen.getByPlaceholderText(/Describa su inquietud/i), 'Mi pregunta de prueba');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await screen.findByText('Esta es la respuesta del asistente.')).toBeInTheDocument();
  });

  it('muestra el botón de escalado y elimina el marcador', async () => {
    const user = userEvent.setup();
    (consultarSabonimVirtual as jest.Mock).mockResolvedValue(
      'Necesita soporte humano. [ESCALAR_SOPORTE_MASTER]',
    );
    render(<AsistenteVirtual />);
    await user.click(screen.getByRole('button', { name: 'Abrir chat' }));
    await user.type(screen.getByPlaceholderText(/Describa su inquietud/i), 'Problema grave');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await screen.findByRole('button', { name: /Solicitar Asesor Master/i })).toBeInTheDocument();
    expect(screen.queryByText('[ESCALAR_SOPORTE_MASTER]')).not.toBeInTheDocument();
  });

  it('crea un ticket y confirma el escalado', async () => {
    const user = userEvent.setup();
    mockUsuario = {
      id: 'u1',
      tenantId: 't1',
      nombreUsuario: 'Ana',
      email: 'ana@test.com',
    };
    (consultarSabonimVirtual as jest.Mock).mockResolvedValue(
      'Necesita soporte. [ESCALAR_SOPORTE_MASTER]',
    );
    (crearTicketSoporte as jest.Mock).mockResolvedValue({});
    render(<AsistenteVirtual />);
    await user.click(screen.getByRole('button', { name: 'Abrir chat' }));
    await user.type(screen.getByPlaceholderText(/Describa su inquietud/i), 'Escalar esto');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    await user.click(await screen.findByRole('button', { name: /Solicitar Asesor Master/i }));
    expect(await screen.findByText(/canal de seguimiento prioritario/i)).toBeInTheDocument();
    expect(crearTicketSoporte).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', userId: 'u1' }),
      { whatsappConsent: false },
    );
  });

  it('mantiene disponible el manual cuando no quedan consultas de IA', async () => {
    const user = userEvent.setup();
    (getRemainingQueries as jest.Mock).mockReturnValue(0);
    (consultarSabonimVirtual as jest.Mock).mockResolvedValue('Respuesta desde el manual local.');
    render(<AsistenteVirtual />);
    await user.click(screen.getByRole('button', { name: 'Abrir chat' }));
    const input = screen.getByPlaceholderText(/Describa su inquietud/i);
    expect(input).not.toBeDisabled();
    await user.type(input, 'Como registro asistencia');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await screen.findByText('Respuesta desde el manual local.')).toBeInTheDocument();
  });

  it('envía el mensaje al presionar Enter', async () => {
    const user = userEvent.setup();
    (consultarSabonimVirtual as jest.Mock).mockResolvedValue('Respuesta via Enter.');
    render(<AsistenteVirtual />);
    await user.click(screen.getByRole('button', { name: 'Abrir chat' }));
    await user.type(screen.getByPlaceholderText(/Describa su inquietud/i), 'Pregunta via Enter{enter}');
    expect(await screen.findByText('Respuesta via Enter.')).toBeInTheDocument();
  });

  it('muestra badge verde cuando hay un ticket activo y el chat está cerrado', async () => {
    mockUsuario = { id: 'u1' };
    (escucharMiTicketActivo as jest.Mock).mockImplementation((_userId, _tenantId, callback) => {
      callback({ id: 'ticket-1234', etapa: 2, salaVideoUrl: null });
      return jest.fn();
    });
    render(<AsistenteVirtual />);
    expect(await screen.findByText('!')).toBeInTheDocument();
  });

  it('muestra el panel de etapas y el identificador del ticket', async () => {
    const user = userEvent.setup();
    mockUsuario = { id: 'u1' };
    (escucharMiTicketActivo as jest.Mock).mockImplementation((_userId, _tenantId, callback) => {
      callback({ id: 'ticket-abcd', etapa: 3, salaVideoUrl: null });
      return jest.fn();
    });
    render(<AsistenteVirtual />);
    await user.click(screen.getByRole('button', { name: 'Abrir chat' }));

    expect(await screen.findByText(/Estatus Soporte Premium/i)).toBeInTheDocument();
    expect(screen.getByText('Recibido')).toBeInTheDocument();
    expect(screen.getByText(/Diagn.*stico/i)).toBeInTheDocument();
    expect(screen.getByText(/Resoluci.*n/i)).toBeInTheDocument();
    expect(screen.getByText('Verificado')).toBeInTheDocument();
    expect(screen.getByText(/Caso: #abcd/i)).toBeInTheDocument();
  });

  it('muestra el enlace de sala de video del ticket', async () => {
    const user = userEvent.setup();
    mockUsuario = { id: 'u1' };
    (escucharMiTicketActivo as jest.Mock).mockImplementation((_userId, _tenantId, callback) => {
      callback({
        id: 'ticket-xyz9',
        etapa: 4,
        salaVideoUrl: 'https://meet.example.com/sala',
      });
      return jest.fn();
    });
    render(<AsistenteVirtual />);
    await user.click(screen.getByRole('button', { name: 'Abrir chat' }));

    const link = await screen.findByRole('link', { name: /Entrar a Sala de Video/i });
    expect(link).toHaveAttribute('href', 'https://meet.example.com/sala');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('restablece la carga si falla la creación del ticket', async () => {
    const user = userEvent.setup();
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    mockUsuario = {
      id: 'u1',
      tenantId: 't1',
      nombreUsuario: 'Ana',
      email: 'ana@test.com',
    };
    (consultarSabonimVirtual as jest.Mock).mockResolvedValue(
      'Necesita soporte. [ESCALAR_SOPORTE_MASTER]',
    );
    (crearTicketSoporte as jest.Mock).mockRejectedValue(new Error('Fallo al crear ticket'));
    render(<AsistenteVirtual />);
    await user.click(screen.getByRole('button', { name: 'Abrir chat' }));
    const input = screen.getByPlaceholderText(/Describa su inquietud/i);
    await user.type(input, 'Escalar con fallo');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    await user.click(await screen.findByRole('button', { name: /Solicitar Asesor Master/i }));

    await waitFor(() => expect(input).not.toBeDisabled());
    expect(consoleError).toHaveBeenCalled();
  });

  it('no envía el mensaje si el input está vacío', async () => {
    const user = userEvent.setup();
    render(<AsistenteVirtual />);
    await user.click(screen.getByRole('button', { name: 'Abrir chat' }));
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    expect(consultarSabonimVirtual).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Kyeong-rye Sabonim/i)).toHaveLength(1);
  });

  it('muestra el texto de fallback cuando la respuesta limpia queda vacía', async () => {
    const user = userEvent.setup();
    (consultarSabonimVirtual as jest.Mock).mockResolvedValue('[ESCALAR_SOPORTE_MASTER]');
    render(<AsistenteVirtual />);
    await user.click(screen.getByRole('button', { name: 'Abrir chat' }));
    await user.type(screen.getByPlaceholderText(/Describa su inquietud/i), 'Necesito ayuda urgente');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    expect(await screen.findByText(/Entendido.*escalar a soporte humano/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Solicitar Asesor Master/i })).toBeInTheDocument();
  });

  it('no procesa otro envío mientras una consulta está en curso', async () => {
    const user = userEvent.setup();
    let resolveFirst!: (value: string) => void;
    (consultarSabonimVirtual as jest.Mock).mockImplementationOnce(
      () => new Promise<string>(resolve => { resolveFirst = resolve; }),
    );
    render(<AsistenteVirtual />);
    await user.click(screen.getByRole('button', { name: 'Abrir chat' }));
    const input = screen.getByPlaceholderText(/Describa su inquietud/i);
    await user.type(input, 'Primera pregunta');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(input).toBeDisabled();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(consultarSabonimVirtual).toHaveBeenCalledTimes(1);

    resolveFirst('Respuesta');
    expect(await screen.findByText('Respuesta')).toBeInTheDocument();
  });

  it('envía al motor local el rol autenticado y hasta cuatro turnos previos', async () => {
    const user = userEvent.setup();
    mockUsuario = {
      id: 'u1',
      tenantId: 't1',
      nombreUsuario: 'Ana',
      email: 'ana@test.com',
      rol: RolUsuario.Admin,
    };
    (consultarSabonimVirtual as jest.Mock)
      .mockResolvedValueOnce('Primera respuesta')
      .mockResolvedValueOnce('Segunda respuesta');
    render(<AsistenteVirtual />);
    await user.click(screen.getByRole('button', { name: 'Abrir chat' }));

    const input = screen.getByPlaceholderText(/Describa su inquietud/i);
    await user.type(input, 'Primera pregunta');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    await screen.findByText('Primera respuesta');
    await user.type(input, 'Segunda pregunta');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    await screen.findByText('Segunda respuesta');

    expect(consultarSabonimVirtual).toHaveBeenLastCalledWith({
      question: 'Segunda pregunta',
      context: [
        expect.objectContaining({ role: 'assistant', text: expect.stringMatching(/Kyeong-rye/i) }),
        { role: 'user', text: 'Primera pregunta' },
        { role: 'assistant', text: 'Primera respuesta' },
      ],
      role: RolUsuario.Admin,
    });
  });
});
