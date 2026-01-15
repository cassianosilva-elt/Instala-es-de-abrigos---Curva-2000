import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from './Login';
import { supabase } from '../api/supabaseClient';

describe('Login Component', () => {
    const mockOnLoginSuccess = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('renders portal selection by default', () => {
        render(<Login onLoginSuccess={mockOnLoginSuccess} />);
        // Use a more specific text that is likely to be a single node
        expect(screen.getByText(/Concessão SP/i)).toBeInTheDocument();
    });

    it('navigates to the internal login form when clicking Internal Portal', () => {
        render(<Login onLoginSuccess={mockOnLoginSuccess} />);
        const internalBtn = screen.getByText(/Interno/i).closest('button');
        if (internalBtn) fireEvent.click(internalBtn);

        expect(screen.getByText(/Login/i)).toBeInTheDocument();
    });
});
