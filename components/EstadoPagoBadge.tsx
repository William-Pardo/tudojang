// components/EstadoPagoBadge.tsx
import React from 'react';
import { EstadoPago } from '../tipos';

interface Props {
  estado: EstadoPago;
}

const EstadoPagoBadge: React.FC<Props> = ({ estado }) => {
    const colorClasses = {
        [EstadoPago.AlDia]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        [EstadoPago.Pendiente]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        [EstadoPago.Vencido]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    };
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClasses[estado]}`}>{estado}</span>;
}

export default EstadoPagoBadge;
