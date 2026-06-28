// components/EstadoPagoBadge.tsx
import React from 'react';
import { useEstadoPago } from '../hooks/useEstadoPago';
import type { EstadoPago } from '../tipos';

interface Props {
  status?: string;
  /** @deprecated Usar `status`. Se conserva para consumidores existentes. */
  estado?: EstadoPago;
}

const EstadoPagoBadge: React.FC<Props> = ({ status, estado }) => {
  const { label, color } = useEstadoPago(status ?? estado ?? '');

  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${color}`}>
      {label}
    </span>
  );
};

export default React.memo(EstadoPagoBadge);
