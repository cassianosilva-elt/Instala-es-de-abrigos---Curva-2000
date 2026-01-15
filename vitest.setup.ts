import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mocking Supabase Client
vi.mock('./api/supabaseClient', () => ({
    supabase: {
        auth: {
            signInWithPassword: vi.fn(),
            signOut: vi.fn(),
            getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
            getUser: vi.fn(),
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        },
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            single: vi.fn().mockReturnThis(),
        })),
        storage: {
            from: vi.fn(() => ({
                upload: vi.fn(),
                getPublicUrl: vi.fn(),
            })),
        },
    },
}));

// Mocking fieldManagerApi
vi.mock('./api/fieldManagerApi', () => ({
    getAssets: vi.fn(() => Promise.resolve([])),
    getMeasurementPrices: vi.fn(() => Promise.resolve([])),
    getEvidenceByAssetId: vi.fn(() => Promise.resolve([])),
    bulkUpdateMeasurementPrices: vi.fn(() => Promise.resolve()),
    getTasksByUserId: vi.fn(() => Promise.resolve([])),
    getTeams: vi.fn(() => Promise.resolve([])),
    getAllUsers: vi.fn(() => Promise.resolve([])),
    createTeam: vi.fn(() => Promise.resolve()),
    updateTeam: vi.fn(() => Promise.resolve()),
    deleteTeam: vi.fn(() => Promise.resolve()),
    uploadEvidence: vi.fn(() => Promise.resolve({})),
    completeTask: vi.fn(() => Promise.resolve({})),
    updateTaskStatus: vi.fn(() => Promise.resolve({})),
}));

// Mocking window.navigator
Object.defineProperty(global.navigator, 'geolocation', {
    value: {
        getCurrentPosition: vi.fn((success) => success({
            coords: {
                latitude: -23.5505,
                longitude: -46.6333,
            }
        })),
        watchPosition: vi.fn(),
    },
    configurable: true
});
