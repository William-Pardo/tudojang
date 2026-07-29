// components/MediosPagoResumen.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import MediosPagoResumen from './MediosPagoResumen';

describe('MediosPagoResumen', () => {
    it('no renderiza nada cuando los 4 campos están vacíos o indefinidos', () => {
        const { container } = render(<MediosPagoResumen />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renderiza solo la fila de Nequi cuando únicamente pagoNequi está definido', () => {
        render(<MediosPagoResumen pagoNequi="300 123 4567" />);

        expect(screen.getByText('Nequi')).toBeInTheDocument();
        expect(screen.getByText('300 123 4567')).toBeInTheDocument();
        expect(screen.queryByText('Daviplata')).not.toBeInTheDocument();
        expect(screen.queryByText('Bre-B')).not.toBeInTheDocument();
        expect(screen.queryByText('Banco / Transferencia')).not.toBeInTheDocument();
    });

    it('renderiza solo la fila de Daviplata cuando únicamente pagoDaviplata está definido', () => {
        render(<MediosPagoResumen pagoDaviplata="300 987 6543" />);

        expect(screen.getByText('Daviplata')).toBeInTheDocument();
        expect(screen.getByText('300 987 6543')).toBeInTheDocument();
        expect(screen.queryByText('Nequi')).not.toBeInTheDocument();
        expect(screen.queryByText('Bre-B')).not.toBeInTheDocument();
        expect(screen.queryByText('Banco / Transferencia')).not.toBeInTheDocument();
    });

    it('renderiza solo la fila de Bre-B cuando únicamente pagoBreB está definido', () => {
        render(<MediosPagoResumen pagoBreB="correo@ejemplo.com" />);

        expect(screen.getByText('Bre-B')).toBeInTheDocument();
        expect(screen.getByText('correo@ejemplo.com')).toBeInTheDocument();
        expect(screen.queryByText('Nequi')).not.toBeInTheDocument();
        expect(screen.queryByText('Daviplata')).not.toBeInTheDocument();
        expect(screen.queryByText('Banco / Transferencia')).not.toBeInTheDocument();
    });

    it('renderiza solo la fila de Banco cuando únicamente pagoBanco está definido', () => {
        render(<MediosPagoResumen pagoBanco="Bancolombia Ahorros #123" />);

        expect(screen.getByText('Banco / Transferencia')).toBeInTheDocument();
        expect(screen.getByText('Bancolombia Ahorros #123')).toBeInTheDocument();
        expect(screen.queryByText('Nequi')).not.toBeInTheDocument();
        expect(screen.queryByText('Daviplata')).not.toBeInTheDocument();
        expect(screen.queryByText('Bre-B')).not.toBeInTheDocument();
    });

    it('renderiza las 4 filas simultáneamente cuando los 4 campos están definidos', () => {
        render(
            <MediosPagoResumen
                pagoNequi="300 123 4567"
                pagoDaviplata="300 987 6543"
                pagoBreB="correo@ejemplo.com"
                pagoBanco="Bancolombia Ahorros #123"
            />
        );

        expect(screen.getByText('Nequi')).toBeInTheDocument();
        expect(screen.getByText('300 123 4567')).toBeInTheDocument();
        expect(screen.getByText('Daviplata')).toBeInTheDocument();
        expect(screen.getByText('300 987 6543')).toBeInTheDocument();
        expect(screen.getByText('Bre-B')).toBeInTheDocument();
        expect(screen.getByText('correo@ejemplo.com')).toBeInTheDocument();
        expect(screen.getByText('Banco / Transferencia')).toBeInTheDocument();
        expect(screen.getByText('Bancolombia Ahorros #123')).toBeInTheDocument();
    });
});
