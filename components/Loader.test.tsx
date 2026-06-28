import React from 'react';
import { render, screen } from '@testing-library/react';
import Loader from './Loader';

describe('Loader', () => {
  it('renders the default loading text and accessible status', () => {
    render(<Loader />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
    expect(status.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('renders custom loading text', () => {
    render(<Loader texto="Procesando información..." />);

    expect(screen.getByText('Procesando información...')).toBeInTheDocument();
    expect(screen.queryByText('Cargando...')).not.toBeInTheDocument();
  });
});
