import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChiefView from './ChiefView';
import { UserRole, AssetType, ServiceType } from '../types';

describe('ChiefView Component', () => {
    const mockChief = { id: 'chief1', name: 'Chief User', role: UserRole.CHEFE, companyId: 'internal' };
    const mockTasks = [];
    const mockTeams = [];
    const mockUsers = [
        { id: 'tech1', name: 'Tech User', role: UserRole.TECNICO, companyId: 'internal' }
    ];
    const mockOnCreateTask = vi.fn();
    const mockOnUpdateTask = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders dashboard with stats', () => {
        render(<ChiefView
            chief={mockChief as any}
            tasks={mockTasks}
            teams={mockTeams}
            users={mockUsers as any}
            onCreateTask={mockOnCreateTask}
            onUpdateTask={mockOnUpdateTask}
        />);
        expect(screen.getByText(/Dashboard Executivo/i)).toBeInTheDocument();
        expect(screen.getByText(/Nova OS/i)).toBeInTheDocument();
    });

    it('opens "Nova OS" modal when clicking the button', async () => {
        render(<ChiefView
            chief={mockChief as any}
            tasks={mockTasks}
            teams={mockTeams}
            users={mockUsers as any}
            onCreateTask={mockOnCreateTask}
            onUpdateTask={mockOnUpdateTask}
        />);

        fireEvent.click(screen.getByText(/Nova OS/i));

        expect(screen.getByText(/Nova Ordem de Serviço/i)).toBeInTheDocument();
    });
});
