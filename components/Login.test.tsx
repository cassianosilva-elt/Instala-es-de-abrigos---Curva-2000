import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from './Login';

// Mock Clerk hooks
vi.mock('@clerk/clerk-react', () => ({
    useSignIn: () => ({
        signIn: {
            create: vi.fn().mockResolvedValue({ status: 'complete', createdSessionId: 'session_123' }),
        },
        setActive: vi.fn().mockResolvedValue(undefined),
        isLoaded: true,
    }),
    useSignUp: () => ({
        signUp: {
            create: vi.fn().mockResolvedValue({ status: 'complete', createdSessionId: 'session_123' }),
            prepareEmailAddressVerification: vi.fn().mockResolvedValue(undefined),
            attemptEmailAddressVerification: vi.fn().mockResolvedValue({ status: 'complete', createdSessionId: 'session_123' }),
        },
        setActive: vi.fn().mockResolvedValue(undefined),
        isLoaded: true,
    }),
}));

describe('Login Component', () => {
    const mockOnLoginSuccess = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('renders portal selection by default', () => {
        render(<Login onLoginSuccess={mockOnLoginSuccess} />);
        // Use a more specific text that is likely to be a single node
        expect(screen.getByText(/Concessao SP/i)).toBeInTheDocument();
    });

    it('navigates to the internal login form when clicking Internal Portal', () => {
        render(<Login onLoginSuccess={mockOnLoginSuccess} />);
        const internalBtn = screen.getByText(/Interno/i).closest('button');
        if (internalBtn) fireEvent.click(internalBtn);

        expect(screen.getByText(/Login/i)).toBeInTheDocument();
    });

    it('navigates to the partner login form when clicking Partner Portal', () => {
        render(<Login onLoginSuccess={mockOnLoginSuccess} />);
        const partnerBtn = screen.getByText(/Parceiros/i).closest('button');
        if (partnerBtn) fireEvent.click(partnerBtn);

        expect(screen.getByText(/Login/i)).toBeInTheDocument();
    });

    it('shows registration form when clicking register link', () => {
        render(<Login onLoginSuccess={mockOnLoginSuccess} />);
        
        // Click internal portal
        const internalBtn = screen.getByText(/Interno/i).closest('button');
        if (internalBtn) fireEvent.click(internalBtn);
        
        // Click register link
        const registerLink = screen.getByText(/Novo por aqui/i);
        fireEvent.click(registerLink);

        // Use getByRole to find the heading specifically
        expect(screen.getByRole('heading', { name: /Cadastro/i })).toBeInTheDocument();
    });
});
