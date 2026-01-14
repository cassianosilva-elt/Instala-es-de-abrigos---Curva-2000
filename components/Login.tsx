import React, { useState } from 'react';
import { supabase } from '../api/supabaseClient';
import { UserRole } from '../types';
import { ShieldCheck, Building2, ArrowLeft, Mail, Lock, Loader2, User as UserIcon, Briefcase, RefreshCw, Factory } from 'lucide-react';

interface LoginProps {
    onLoginSuccess: (session: any) => void;
}

type LoginPortal = 'internal' | 'partner' | null;
type AuthMode = 'login' | 'register' | 'verify';

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [portal, setPortal] = useState<LoginPortal>(null);
    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState<string>('');
    const [partnerCompany, setPartnerCompany] = useState<string>('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resendSuccess, setResendSuccess] = useState(false);
    const [verifySuccess, setVerifySuccess] = useState(false);

    // Recovery of email if page refreshes during verification
    React.useEffect(() => {
        const savedEmail = localStorage.getItem('pending_verification_email');
        if (savedEmail) {
            setEmail(savedEmail);
            setMode('verify');
            // Try to recover portal as well
            const savedPortal = localStorage.getItem('active_portal');
            if (savedPortal) setPortal(savedPortal as LoginPortal);
        }
    }, []);

    const isInternal = portal === 'internal';

    const internalRoles = [
        { value: UserRole.TECNICO, label: 'Técnico Eletromidia' },
        { value: UserRole.LIDER, label: 'Líder Regional' },
        { value: UserRole.CHEFE, label: 'Chief of Operations' },
    ];

    const partnerRoles = [
        { value: UserRole.PARCEIRO_TECNICO, label: 'Técnico Terceiro' },
        { value: UserRole.PARCEIRO_LIDER, label: 'Supervisor Parceiro' },
        { value: UserRole.PARCEIRO_CHEFE, label: 'Gestor Parceiro' },
    ];

    const partnerCompanies = [
        { value: 'alvares', label: 'Alvares' },
        { value: 'bassi', label: 'Bassi' },
        { value: 'gf1', label: 'GF1' },
    ];

    const roles = isInternal ? internalRoles : partnerRoles;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const normalizedEmail = email.trim().toLowerCase();
            if (mode === 'login') {
                const { data, error: authError } = await supabase.auth.signInWithPassword({
                    email: normalizedEmail,
                    password,
                });
                if (authError) throw authError;

                console.log('Login successful, checking portal access...', data.user);

                // SEGURANÇA: Verificar se o usuário pertence ao portal correto
                if (data.session && data.user) {
                    const userMeta = data.user.user_metadata || {};
                    const userCompanyId = userMeta.company_id || 'internal';
                    const isUserInternal = userCompanyId === 'internal';

                    console.log('Auth Metadata:', { userCompanyId, isUserInternal, currentPortal: portal });

                    // Se o usuário é interno mas está tentando logar pelo portal parceiro
                    if (isUserInternal && !isInternal) {
                        await supabase.auth.signOut();
                        localStorage.removeItem('active_portal');
                        setLoading(false);
                        setError('Esta conta pertence ao Portal Interno. Use o Portal Interno para fazer login.');
                        return;
                    }

                    // Se o usuário é parceiro mas está tentando logar pelo portal interno
                    if (!isUserInternal && isInternal) {
                        await supabase.auth.signOut();
                        localStorage.removeItem('active_portal');
                        setLoading(false);
                        setError('Esta conta pertence ao Portal de Parceiros. Use o Portal Parceiros para fazer login.');
                        return;
                    }

                    // Login válido - salvar portal ativo para futuras restaurações de sessão
                    localStorage.setItem('active_portal', isInternal ? 'internal' : 'partner');
                    onLoginSuccess(data.session);
                }
            } else if (mode === 'register') {
                if (!role) throw new Error('Selecione sua função');
                if (!isInternal && !partnerCompany) throw new Error('Selecione sua empresa');

                // Garante sessão limpa antes de registrar novo usuário
                await supabase.auth.signOut();

                const { data, error: authError } = await supabase.auth.signUp({
                    email: normalizedEmail,
                    password,
                    options: {
                        data: {
                            name,
                            role,
                            company_id: isInternal ? 'internal' : partnerCompany,
                            company_name: isInternal ? 'Eletromidia' : partnerCompanies.find(c => c.value === partnerCompany)?.label || 'Empresa Parceira',
                            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
                        }
                    }
                });
                console.log('SignUp Success:', data);
                if (data.user || data.session) {
                    // Save email and portal for recovery
                    localStorage.setItem('pending_verification_email', normalizedEmail);
                    localStorage.setItem('active_portal', isInternal ? 'internal' : 'partner');
                    setMode('verify');
                    setError(null);
                }
            } else if (mode === 'verify') {
                console.log('Verifying OTP:', otp, 'for email:', normalizedEmail);
                const { data, error: verifyError } = await supabase.auth.verifyOtp({
                    email: normalizedEmail,
                    token: otp,
                    type: 'signup'
                });
                console.log('Verify response:', data, verifyError);
                if (verifyError) {
                    console.error('OTP Verification Error:', verifyError);
                    throw verifyError;
                }

                if (data.session) {
                    // Re-confirm portal on successful verification and CLEAR pending email
                    localStorage.setItem('active_portal', isInternal ? 'internal' : 'partner');
                    localStorage.removeItem('pending_verification_email');
                    setVerifySuccess(true);
                    onLoginSuccess(data.session);
                } else if (data.user) {
                    // If no session but user exists, it might be verified but needs login
                    // or it's a specific Supabase config. Most cases data.session is present.
                    console.log('User verified but no session yet');
                    localStorage.removeItem('pending_verification_email');
                    setVerifySuccess(true);
                    setMode('login');
                    setError('Conta verificada com sucesso! Por favor, faça o login.');
                }
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao processar solicitação');
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        setResending(true);
        setError(null);
        setResendSuccess(false);

        const normalizedEmail = email.trim().toLowerCase();

        try {
            const { error: resendError } = await supabase.auth.resend({
                type: 'signup',
                email: normalizedEmail,
            });

            if (resendError) throw resendError;
            setResendSuccess(true);
            setOtp('');
            setTimeout(() => setResendSuccess(false), 5000);
        } catch (err: any) {
            setError(err.message || 'Erro ao reenviar código');
        } finally {
            setResending(false);
        }
    };

    const handlePortalChange = (newPortal: LoginPortal) => {
        setPortal(newPortal);
        setMode('login');
        setError(null);
        setRole('');
        setPartnerCompany('');
        setOtp('');
        setResendSuccess(false);
    };

    if (!portal) {
        // ... portal selection UI (unchanged)
        return (
            <div className="min-h-screen relative flex flex-col items-center justify-center p-6 font-sans overflow-hidden bg-white">
                {/* Modern Animated Background */}
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-[10%] -left-[5%] w-[40%] h-[40%] bg-primary-100/30 rounded-full blur-[120px] animate-pulse"></div>
                    <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] bg-primary-50/20 rounded-full blur-[150px] animate-bounce" style={{ animationDuration: '8s' }}></div>
                    <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] bg-slate-50/50 rounded-full blur-[130px]"></div>
                </div>

                <div className="relative z-10 w-full max-w-5xl">
                    {/* Hero Section */}
                    <div className="text-center mb-20 space-y-6">
                        <div className="inline-flex items-center gap-3 mb-4">
                            <span className="h-[2px] w-12 bg-primary rounded-full"></span>
                            <span className="text-xs font-black uppercase tracking-[0.4em] text-primary">Concessão SP</span>
                            <span className="h-[2px] w-12 bg-primary rounded-full"></span>
                        </div>
                        <h1 className="text-6xl md:text-8xl font-black text-secondary tracking-tighter leading-none">
                            <span className="text-primary">Eletro</span>midia
                        </h1>
                        <p className="text-slate-500 text-lg md:text-xl font-bold max-w-2xl mx-auto uppercase tracking-wide">
                            Instalações de abrigos - Curva 2000
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
                        {/* Internal Portal */}
                        <button
                            onClick={() => handlePortalChange('internal')}
                            className="group relative bg-white rounded-[40px] shadow-[0_30px_100px_rgba(250,58,0,0.08)] p-10 md:p-14 overflow-hidden border border-slate-100 transition-all hover:scale-[1.02] hover:shadow-[0_50px_120px_rgba(250,58,0,0.12)] flex flex-col items-center text-center"
                        >
                            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000"></div>

                            <div className="relative z-10 mb-8">
                                <div className="inline-flex p-6 md:p-8 bg-primary rounded-[32px] text-white shadow-2xl shadow-primary/30 group-hover:rotate-6 transition-all duration-500">
                                    <ShieldCheck size={48} />
                                </div>
                            </div>

                            <div className="relative z-10 space-y-4 mb-10">
                                <h2 className="text-4xl md:text-5xl font-black text-secondary tracking-tighter uppercase">Portal <span className="text-primary">Interno</span></h2>
                                <div className="flex justify-center flex-wrap gap-2">
                                    <span className="px-3 py-1.5 bg-primary-50 text-primary-700 text-[10px] font-black uppercase tracking-widest rounded-xl">Equipe Eletromidia</span>
                                </div>
                            </div>

                            <div className="mt-auto relative z-10 w-full">
                                <span className="inline-flex items-center justify-center w-full px-8 py-5 bg-secondary text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] group-hover:bg-primary transition-all shadow-xl">
                                    Acessar Sistema
                                </span>
                            </div>
                        </button>

                        {/* Partner Portal */}
                        <button
                            onClick={() => handlePortalChange('partner')}
                            className="group relative bg-secondary rounded-[40px] shadow-[0_40px_100px_rgba(10,15,28,0.4)] p-10 md:p-14 overflow-hidden border border-slate-800 transition-all hover:scale-[1.02] hover:shadow-[0_60px_130px_rgba(10,15,28,0.5)] flex flex-col items-center text-center"
                        >
                            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000"></div>

                            <div className="relative z-10 mb-8">
                                <div className="inline-flex p-6 md:p-8 bg-slate-800 rounded-[32px] text-primary shadow-2xl shadow-black/40 group-hover:-rotate-6 transition-all duration-500">
                                    <Building2 size={48} />
                                </div>
                            </div>

                            <div className="relative z-10 space-y-4 mb-10">
                                <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase">Portal <span className="text-primary">Parceiros</span></h2>
                                <div className="flex justify-center flex-wrap gap-2">
                                    <span className="px-3 py-1.5 bg-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl">Empresas Terceiras</span>
                                </div>
                            </div>

                            <div className="mt-auto relative z-10 w-full">
                                <span className="inline-flex items-center justify-center w-full px-8 py-5 bg-primary text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] group-hover:bg-primary-600 transition-all shadow-xl">
                                    Acesso Externo
                                </span>
                            </div>
                        </button>
                    </div>

                    {/* Footer Branding */}
                    <div className="mt-24 text-center">
                        <p className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-400">© 2026 Eletromidia SA • Curva 2000</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen relative flex items-center justify-center p-6 font-sans transition-all duration-700 overflow-hidden ${isInternal ? 'bg-primary-50/30' : 'bg-secondary'}`}>

            {/* Dynamic Form Background */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className={`absolute -top-[10%] -left-[5%] w-[40%] h-[40%] rounded-full blur-[120px] animate-pulse ${isInternal ? 'bg-primary-200/40' : 'bg-primary-900/10'}`}></div>
                <div className={`absolute -bottom-[20%] right-[10%] w-[50%] h-[50%] rounded-full blur-[150px] ${isInternal ? 'bg-primary-100/30' : 'bg-blue-900/10'}`}></div>
            </div>

            <div className={`relative z-10 max-w-md w-full rounded-[48px] shadow-2xl p-12 space-y-10 border transition-all duration-500 ${isInternal
                ? 'bg-white/90 backdrop-blur-2xl border-white shadow-primary-200/50'
                : 'bg-black/40 backdrop-blur-3xl border-slate-800 shadow-black'
                }`}>

                <button
                    onClick={() => {
                        if (mode === 'verify') setMode('register');
                        else setPortal(null);
                    }}
                    className={`group flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all ${isInternal ? 'text-slate-400 hover:text-primary' : 'text-slate-500 hover:text-white'
                        }`}
                >
                    <div className={`p-2.5 rounded-xl transition-colors ${isInternal ? 'bg-slate-100 group-hover:bg-primary-100' : 'bg-slate-800 group-hover:bg-slate-700'}`}>
                        <ArrowLeft size={16} />
                    </div>
                    {mode === 'verify' ? 'Voltar para Cadastro' : 'Voltar'}
                </button>

                <div className="text-center space-y-4">
                    <div className={`inline-flex p-6 rounded-[32px] shadow-2xl mb-2 transition-all hover:scale-110 hover:rotate-3 ${isInternal ? 'bg-primary text-white shadow-primary/30' : 'bg-slate-800 text-primary shadow-black'
                        }`}>
                        {mode === 'verify' ? <ShieldCheck size={40} className="animate-bounce" /> : (isInternal ? <ShieldCheck size={40} /> : <Building2 size={40} />)}
                    </div>
                    <h1 className={`text-4xl font-black tracking-tighter uppercase ${isInternal ? 'text-secondary' : 'text-white'}`}>
                        {mode === 'login' ? 'Login' : (mode === 'register' ? 'Cadastro' : 'Verificar')}
                    </h1>
                    <p className={`font-black uppercase text-[11px] tracking-[0.3em] ${isInternal ? 'text-primary' : 'text-primary'}`}>
                        {mode === 'verify' ? 'Insira o código enviado' : (isInternal ? 'Eletromidia Oficial' : 'Equipe Terceirizada')}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {mode === 'verify' ? (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="space-y-3">
                                <label className={`block text-[10px] font-black uppercase tracking-[0.3em] ml-2 ${isInternal ? 'text-slate-400' : 'text-slate-500'}`}>Código de 8 dígitos</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        required
                                        maxLength={8}
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                        className={`w-full px-4 py-8 rounded-[24px] border border-dashed outline-none transition-all font-black text-2xl md:text-4xl text-center tracking-[0.1em] md:tracking-[0.2em] ${isInternal
                                            ? 'bg-primary-50 border-primary-200 text-primary focus:bg-white focus:border-primary ring-8 ring-transparent focus:ring-primary-50'
                                            : 'bg-slate-800/40 border-primary/20 text-white focus:bg-slate-800 focus:border-primary ring-8 ring-transparent focus:ring-primary/5'
                                            }`}
                                        placeholder="00000000"
                                    />
                                </div>
                            </div>
                            <p className="text-[10px] font-bold text-center text-slate-400 uppercase tracking-widest leading-relaxed">
                                Enviamos um código para<br /><span className="text-primary font-black">{email}</span>
                            </p>

                            {resendSuccess && (
                                <div className="p-4 rounded-[16px] bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-[0.2em] text-center">
                                    ✓ Novo código enviado com sucesso!
                                </div>
                            )}

                            {verifySuccess && (
                                <div className="p-4 rounded-[16px] bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-[0.2em] text-center animate-bounce">
                                    ✓ Verificado! Entrando...
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleResendCode}
                                disabled={resending}
                                className={`w-full py-4 rounded-[16px] border border-dashed font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${isInternal
                                    ? 'border-slate-200 text-slate-400 hover:border-primary hover:text-primary hover:bg-primary-50 disabled:opacity-50'
                                    : 'border-slate-700 text-slate-500 hover:border-primary hover:text-primary disabled:opacity-50'
                                    }`}
                            >
                                {resending ? (
                                    <Loader2 className="animate-spin" size={16} />
                                ) : (
                                    <RefreshCw size={16} />
                                )}
                                {resending ? 'Reenviando...' : 'Reenviar código'}
                            </button>
                        </div>
                    ) : (
                        <>
                            {mode === 'register' && (
                                <div className="space-y-3">
                                    <label className={`block text-[10px] font-black uppercase tracking-[0.3em] ml-2 ${isInternal ? 'text-slate-400' : 'text-slate-500'}`}>Nome Completo</label>
                                    <div className="relative group">
                                        <UserIcon className={`absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors`} size={20} />
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className={`w-full pl-14 pr-6 py-5 rounded-[24px] border outline-none transition-all font-bold ${isInternal
                                                ? 'bg-slate-100/50 border-transparent focus:bg-white focus:border-primary text-secondary ring-8 ring-transparent focus:ring-primary-50'
                                                : 'bg-slate-800/40 border-transparent focus:bg-slate-800 focus:border-primary text-white ring-8 ring-transparent focus:ring-primary/5'
                                                }`}
                                            placeholder="Nome do colaborador"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <label className={`block text-[10px] font-black uppercase tracking-[0.3em] ml-2 ${isInternal ? 'text-slate-400' : 'text-slate-500'}`}>E-mail corporativo</label>
                                <div className="relative group">
                                    <Mail className={`absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors`} size={20} />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className={`w-full pl-14 pr-6 py-5 rounded-[24px] border outline-none transition-all font-bold ${isInternal
                                            ? 'bg-slate-100/50 border-transparent focus:bg-white focus:border-primary text-secondary ring-8 ring-transparent focus:ring-primary-50'
                                            : 'bg-slate-800/40 border-transparent focus:bg-slate-800 focus:border-primary text-white ring-8 ring-transparent focus:ring-primary/5'
                                            }`}
                                        placeholder="usuario@eletromidia.com.br"
                                    />
                                </div>
                            </div>

                            {mode === 'register' && (
                                <div className="space-y-3">
                                    <label className={`block text-[10px] font-black uppercase tracking-[0.3em] ml-2 ${isInternal ? 'text-slate-400' : 'text-slate-500'}`}>Sua Função</label>
                                    <div className="relative group">
                                        <Briefcase className={`absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors`} size={20} />
                                        <select
                                            required
                                            value={role}
                                            onChange={(e) => setRole(e.target.value)}
                                            className={`w-full pl-14 pr-12 py-5 rounded-[24px] border outline-none transition-all font-bold appearance-none cursor-pointer ${isInternal
                                                ? 'bg-slate-100/50 border-transparent focus:bg-white focus:border-primary text-secondary ring-8 ring-transparent focus:ring-primary-50'
                                                : 'bg-slate-800/40 border-transparent focus:bg-slate-800 focus:border-primary text-white ring-8 ring-transparent focus:ring-primary/5'
                                                }`}
                                        >
                                            <option value="" disabled>Selecione um perfil</option>
                                            {roles.map(r => (
                                                <option key={r.value} value={r.value}>{r.label}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {mode === 'register' && !isInternal && (
                                <div className="space-y-3">
                                    <label className={`block text-[10px] font-black uppercase tracking-[0.3em] ml-2 text-slate-500`}>Sua Empresa</label>
                                    <div className="relative group">
                                        <Factory className={`absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors`} size={20} />
                                        <select
                                            required
                                            value={partnerCompany}
                                            onChange={(e) => setPartnerCompany(e.target.value)}
                                            className={`w-full pl-14 pr-12 py-5 rounded-[24px] border outline-none transition-all font-bold appearance-none cursor-pointer bg-slate-800/40 border-transparent focus:bg-slate-800 focus:border-primary text-white ring-8 ring-transparent focus:ring-primary/5`}
                                        >
                                            <option value="" disabled>Selecione sua empresa</option>
                                            {partnerCompanies.map(c => (
                                                <option key={c.value} value={c.value}>{c.label}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <label className={`block text-[10px) font-black uppercase tracking-[0.3em] ml-2 ${isInternal ? 'text-slate-400' : 'text-slate-500'}`}>Senha de acesso</label>
                                <div className="relative group">
                                    <Lock className={`absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors`} size={20} />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className={`w-full pl-14 pr-6 py-5 rounded-[24px] border outline-none transition-all font-bold ${isInternal
                                            ? 'bg-slate-100/50 border-transparent focus:bg-white focus:border-primary text-secondary ring-8 ring-transparent focus:ring-primary-50'
                                            : 'bg-slate-800/40 border-transparent focus:bg-slate-800 focus:border-primary text-white ring-8 ring-transparent focus:ring-primary/5'
                                            }`}
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {error && (
                        <div className={`p-5 rounded-[24px] text-[10px] font-black uppercase tracking-[0.2em] border flex items-center gap-4 animate-headShake ${error.includes('enviado')
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-rose-50 text-rose-700 border-rose-100'
                            }`}>
                            <div className={`w-2.5 h-2.5 rounded-full ${error.includes('enviado') ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-6 rounded-[24px] font-black text-xs uppercase tracking-[0.3em] shadow-2xl transition-all flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 bg-primary text-white shadow-primary/25`}
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={24} />
                        ) : (
                            mode === 'login' ? 'Entrar no Sistema' : (mode === 'register' ? 'Concluir Cadastro' : 'Confirmar Código')
                        )}
                    </button>
                </form>

                {mode !== 'verify' && (
                    <div className="text-center">
                        <button
                            onClick={() => {
                                setMode(mode === 'login' ? 'register' : 'login');
                                setError(null);
                            }}
                            className={`text-[10px] font-black uppercase tracking-[0.4em] transition-colors ${isInternal ? 'text-slate-400 hover:text-primary' : 'text-slate-500 hover:text-primary'
                                }`}
                        >
                            {mode === 'login' ? 'Novo por aqui? Solicite acesso' : 'Já possui conta? Faça o login'}
                        </button>
                    </div>
                )}
            </div>

            {/* Background Shapes for the form view */}
            <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[100px] -z-10 pointer-events-none opacity-20 ${isInternal ? 'bg-primary-200' : 'bg-primary-900'
                }`}></div>
        </div>
    );
};

export default Login;
