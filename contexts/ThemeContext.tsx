import React, { createContext, useContext, useEffect, useMemo } from 'react';

// Theme configuration per company
export interface CompanyTheme {
    primary: string;
    primaryShades: {
        50: string;
        100: string;
        200: string;
        300: string;
        400: string;
        500: string;
        600: string;
        700: string;
        800: string;
        900: string;
    };
    secondary: string;
    accent: string;
    name: string;
    logoUrl?: string;
}

export const companyThemes: Record<string, CompanyTheme> = {
    // Eletromidia (internal) - Orange
    internal: {
        name: 'Eletromidia',
        primary: '#FA3A00',
        primaryShades: {
            50: '#FFF1ED',
            100: '#FFE1D6',
            200: '#FFC2AD',
            300: '#FFA385',
            400: '#FF845C',
            500: '#FA3A00',
            600: '#D63100',
            700: '#AD2800',
            800: '#851E00',
            900: '#5C1500',
        },
        secondary: '#0A0F1C',
        accent: '#FF4E00',
    },
    // Alvares - Blue/White
    alvares: {
        name: 'Alvares',
        primary: '#002c4d',
        primaryShades: {
            50: '#e6f3ff',
            100: '#cce7ff',
            200: '#99cfff',
            300: '#66b0ff',
            400: '#3391ff',
            500: '#002c4d',
            600: '#002744',
            700: '#00223b',
            800: '#001d32',
            900: '#001829',
        },
        secondary: '#FFFFFF',
        accent: '#004a80',
        logoUrl: '/assets/logo_alvares.png',
    },
    // Bassi - Red/Black
    bassi: {
        name: 'Bassi',
        primary: '#DC2626',
        primaryShades: {
            50: '#FEF2F2',
            100: '#FEE2E2',
            200: '#FECACA',
            300: '#FCA5A5',
            400: '#F87171',
            500: '#DC2626',
            600: '#B91C1C',
            700: '#991B1B',
            800: '#7F1D1D',
            900: '#450A0A',
        },
        secondary: '#0A0F1C',
        accent: '#EF4444',
        logoUrl: '/assets/logo_bassi.png',
    },
    // GF1 - Green/White
    gf1: {
        name: 'GF1',
        primary: '#16A34A',
        primaryShades: {
            50: '#F0FDF4',
            100: '#DCFCE7',
            200: '#BBF7D0',
            300: '#86EFAC',
            400: '#4ADE80',
            500: '#16A34A',
            600: '#15803D',
            700: '#166534',
            800: '#14532D',
            900: '#052E16',
        },
        secondary: '#FFFFFF',
        accent: '#22C55E',
    },
    // AFNogueira - Purple/Violet
    afnogueira: {
        name: 'AFNogueira',
        primary: '#7C3AED',
        primaryShades: {
            50: '#F5F3FF',
            100: '#EDE9FE',
            200: '#DDD6FE',
            300: '#C4B5FD',
            400: '#A78BFA',
            500: '#7C3AED',
            600: '#6D28D9',
            700: '#5B21B6',
            800: '#4C1D95',
            900: '#2E1065',
        },
        secondary: '#FFFFFF',
        accent: '#8B5CF6',
    },
};

interface ThemeContextType {
    theme: CompanyTheme;
    companyId: string;
    isDarkSecondary: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: companyThemes.internal,
    companyId: 'internal',
    isDarkSecondary: true,
});

export const useTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
    companyId: string;
    children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ companyId, children }) => {
    const theme = useMemo(() => companyThemes[companyId] || companyThemes.internal, [companyId]);

    // Check if secondary color is dark
    const isDarkSecondary = useMemo(() => {
        const hex = theme.secondary.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5;
    }, [theme.secondary]);

    // Apply theme to CSS variables & Tailwind config
    useEffect(() => {
        const root = document.documentElement;

        // Set CSS custom properties
        root.style.setProperty('--color-primary', theme.primary);
        root.style.setProperty('--color-primary-50', theme.primaryShades[50]);
        root.style.setProperty('--color-primary-100', theme.primaryShades[100]);
        root.style.setProperty('--color-primary-200', theme.primaryShades[200]);
        root.style.setProperty('--color-primary-300', theme.primaryShades[300]);
        root.style.setProperty('--color-primary-400', theme.primaryShades[400]);
        root.style.setProperty('--color-primary-500', theme.primaryShades[500]);
        root.style.setProperty('--color-primary-600', theme.primaryShades[600]);
        root.style.setProperty('--color-primary-700', theme.primaryShades[700]);
        root.style.setProperty('--color-primary-800', theme.primaryShades[800]);
        root.style.setProperty('--color-primary-900', theme.primaryShades[900]);
        root.style.setProperty('--color-secondary', theme.secondary);
        root.style.setProperty('--color-accent', theme.accent);

        // Update Tailwind config dynamically
        if ((window as any).tailwind) {
            (window as any).tailwind.config = {
                theme: {
                    extend: {
                        colors: {
                            primary: {
                                DEFAULT: theme.primary,
                                50: theme.primaryShades[50],
                                100: theme.primaryShades[100],
                                200: theme.primaryShades[200],
                                300: theme.primaryShades[300],
                                400: theme.primaryShades[400],
                                500: theme.primaryShades[500],
                                600: theme.primaryShades[600],
                                700: theme.primaryShades[700],
                                800: theme.primaryShades[800],
                                900: theme.primaryShades[900],
                            },
                            secondary: theme.secondary,
                            accent: theme.accent,
                        },
                        fontFamily: {
                            sans: ['Inter', 'sans-serif'],
                        },
                    },
                },
            };
        }
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, companyId, isDarkSecondary }}>
            {children}
        </ThemeContext.Provider>
    );
};
