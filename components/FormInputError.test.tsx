import React from 'react';
import { render, screen } from '@testing-library/react';
import FormInputError from './FormInputError';

jest.mock('./Iconos', () => ({
  IconoAlertaTriangulo: ({ className }: { className?: string }) => (
    <svg data-testid="warning-icon" className={className} aria-label="Warning" />
  ),
}));

describe('FormInputError', () => {
  it.each([
    ['undefined', undefined],
    ['empty string', ''],
  ])('renders an empty DOM when mensaje is %s', (_, mensaje) => {
    const { container } = render(<FormInputError mensaje={mensaje} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the exact message and warning icon inside an alert', () => {
    const mensaje = 'Este campo es obligatorio.';
    render(<FormInputError mensaje={mensaje} />);

    const alert = screen.getByRole('alert');
    const icon = screen.getByTestId('warning-icon');

    expect(alert).toHaveTextContent(mensaje);
    expect(screen.getByText(mensaje)).toBeInTheDocument();
    expect(alert).toContainElement(icon);
    expect(icon).toHaveClass('w-4', 'h-4', 'mr-1', 'flex-shrink-0');
  });
});
