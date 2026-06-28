import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventoPublico from './EventoPublico';

jest.mock('../firebase/config', () => ({
  db: {},
  isFirebaseConfigured: false,
}));

jest.mock('../components/LogoDinamico', () => () => <div data-testid="logo-dinamico" />);

describe('EventoPublico', () => {
  it('permite acceder a la landing publica del evento y abrir el formulario de inscripcion', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/evento/evento-demo']}>
        <Routes>
          <Route path="/evento/:id" element={<EventoPublico />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: /torneo interdepartamental de taekwondo/i })).toBeInTheDocument();
    expect(screen.getByText(/evento oficial/i)).toBeInTheDocument();
    expect(screen.getByText(/coliseo municipal/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /inscribirme ahora/i }));

    expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/celular \/ whatsapp/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar registro/i })).toBeInTheDocument();
  });
});
