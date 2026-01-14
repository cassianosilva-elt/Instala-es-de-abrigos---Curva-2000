import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

export interface SelectOption {
    value: string;
    label: string;
    sublabel?: string;
}

interface SearchableSelectProps {
    options: SelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
    isLoading?: boolean;
    icon?: React.ReactNode;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Selecionar...',
    required = false,
    isLoading = false,
    icon
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opt.sublabel?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSearchTerm('');
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Hidden input for form validation */}
            {required && (
                <input
                    type="text"
                    value={value}
                    onChange={() => { }}
                    required
                    className="absolute opacity-0 pointer-events-none h-0 w-0"
                    tabIndex={-1}
                />
            )}

            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs text-left flex items-center justify-between gap-2 hover:border-slate-300 transition-colors"
            >
                <span className={selectedOption ? 'text-slate-800' : 'text-slate-400'}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <div className="flex items-center gap-1">
                    {value && (
                        <span
                            onClick={handleClear}
                            className="p-0.5 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
                        >
                            <X size={12} className="text-slate-400" />
                        </span>
                    )}
                    {icon || <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
                </div>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Search Input */}
                    <div className="p-2 border-b border-slate-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Pesquisar código..."
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-48 overflow-y-auto">
                        {isLoading ? (
                            <div className="px-4 py-6 text-center">
                                <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-xs text-slate-400 mt-2 font-bold">Carregando ativos...</p>
                            </div>
                        ) : filteredOptions.length === 0 ? (
                            <div className="px-4 py-6 text-center">
                                <p className="text-xs text-slate-400 font-bold">
                                    {searchTerm ? 'Nenhum ativo encontrado' : 'Nenhum ativo disponível'}
                                </p>
                            </div>
                        ) : (
                            filteredOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleSelect(option.value)}
                                    className={`w-full px-4 py-3 text-left hover:bg-primary/5 transition-colors flex items-center justify-between ${value === option.value ? 'bg-primary/10' : ''
                                        }`}
                                >
                                    <div>
                                        <p className={`text-xs font-black ${value === option.value ? 'text-primary' : 'text-slate-700'}`}>
                                            {option.label}
                                        </p>
                                        {option.sublabel && (
                                            <p className="text-[10px] text-slate-400 font-bold">{option.sublabel}</p>
                                        )}
                                    </div>
                                    {value === option.value && (
                                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
