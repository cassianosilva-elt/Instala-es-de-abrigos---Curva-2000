import React, { useState, useRef } from 'react';
import { User } from '../types';
import { X, Camera, Loader2, Save, User as UserIcon } from 'lucide-react';
import { updateUserProfile, uploadAvatar } from '../api/fieldManagerApi';

interface ProfileSettingsProps {
    user: User;
    onClose: () => void;
    onUpdate: (updatedUser: User) => void;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ user, onClose, onUpdate }) => {
    const [name, setName] = useState(user.name);
    const [avatarUrl, setAvatarUrl] = useState(user.avatar);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Simple validation
        if (!file.type.startsWith('image/')) {
            setError('Por favor, selecione uma imagem válida.');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setError('A imagem deve ter no máximo 2MB.');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            const url = await uploadAvatar(user.id, file);
            setAvatarUrl(url);
        } catch (err: any) {
            console.error('Error uploading avatar:', err);
            setError('Erro ao fazer upload da imagem.');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError('O nome não pode estar vazio.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const updatedUser = await updateUserProfile(user.id, {
                name: name.trim(),
                avatar: avatarUrl
            });
            onUpdate(updatedUser);
            onClose();
        } catch (err: any) {
            console.error('Error updating profile:', err);
            setError('Erro ao salvar as alterações.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Meu Perfil</h2>
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Personalize sua conta</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 space-y-8">
                    {/* Avatar Upload */}
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-[32px] overflow-hidden border-4 border-white shadow-xl bg-slate-100 flex items-center justify-center relative">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon size={48} className="text-slate-300" />
                                )}

                                {uploading && (
                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="absolute -bottom-2 -right-2 p-3 bg-primary text-white rounded-2xl shadow-lg shadow-primary/30 hover:scale-110 active:scale-95 transition-all"
                            >
                                <Camera size={20} />
                            </button>

                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                        </div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">
                            Toque no ícone para alterar sua foto<br />
                            <span className="opacity-50">(Sugestão: Quadrada, máx 2MB)</span>
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Nome Completo</label>
                            <div className="relative group">
                                <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full pl-14 pr-6 py-5 rounded-[24px] bg-slate-50 border-transparent focus:bg-white focus:border-primary border outline-none transition-all font-bold text-slate-900 ring-8 ring-transparent focus:ring-primary-50"
                                    placeholder="Seu nome"
                                />
                            </div>
                        </div>

                        <div className="space-y-3 opacity-50">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">E-mail (Não editável)</label>
                            <div className="w-full px-6 py-5 rounded-[24px] bg-slate-100 font-bold text-slate-500 text-sm">
                                {user.email}
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={loading || uploading}
                        className="w-full py-6 rounded-[24px] bg-primary text-white font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
        </div>
    );
};
