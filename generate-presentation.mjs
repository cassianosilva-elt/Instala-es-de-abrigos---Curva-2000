import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType, PageBreak, Footer, Header, PageNumber, convertInchesToTwip } from 'docx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cores da marca Eletromidia
const BRAND_ORANGE = "FF5500";
const BRAND_DARK = "1A1A1A";
const BRAND_GRAY = "666666";

async function generatePresentation() {
    // Carregar logo
    const logoPath = path.join(__dirname, 'public', 'assets', 'logo_full.png');
    const logoBuffer = fs.readFileSync(logoPath);

    const doc = new Document({
        creator: "Eletromidia",
        title: "OOH Ops - Sistema de Gestão de Operações de Campo",
        description: "Apresentação institucional do sistema OOH Ops - Eletromidia Curva 2000",
        styles: {
            default: {
                heading1: {
                    run: {
                        size: 56,
                        bold: true,
                        color: BRAND_ORANGE,
                        font: "Arial"
                    },
                    paragraph: {
                        spacing: { after: 400 }
                    }
                },
                heading2: {
                    run: {
                        size: 36,
                        bold: true,
                        color: BRAND_DARK,
                        font: "Arial"
                    },
                    paragraph: {
                        spacing: { after: 200, before: 400 }
                    }
                },
                heading3: {
                    run: {
                        size: 28,
                        bold: true,
                        color: BRAND_ORANGE,
                        font: "Arial"
                    },
                    paragraph: {
                        spacing: { after: 150, before: 200 }
                    }
                },
                document: {
                    run: {
                        size: 24,
                        font: "Arial"
                    },
                    paragraph: {
                        spacing: { line: 360 }
                    }
                }
            }
        },
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: convertInchesToTwip(1),
                        right: convertInchesToTwip(1),
                        bottom: convertInchesToTwip(1),
                        left: convertInchesToTwip(1)
                    }
                }
            },
            headers: {
                default: new Header({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                                new TextRun({
                                    text: "OOH Ops - Eletromidia",
                                    size: 18,
                                    color: BRAND_GRAY,
                                    font: "Arial"
                                })
                            ]
                        })
                    ]
                })
            },
            footers: {
                default: new Footer({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({
                                    children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES],
                                    size: 18,
                                    color: BRAND_GRAY,
                                    font: "Arial"
                                })
                            ]
                        })
                    ]
                })
            },
            children: [
                // ========== CAPA ==========
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 2000 },
                    children: [
                        new ImageRun({
                            data: logoBuffer,
                            transformation: {
                                width: 350,
                                height: 85
                            }
                        })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 1500 },
                    children: [
                        new TextRun({
                            text: "OOH OPS",
                            bold: true,
                            size: 96,
                            color: BRAND_ORANGE,
                            font: "Arial"
                        })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 200 },
                    children: [
                        new TextRun({
                            text: "Sistema de Gestão de Operações de Campo",
                            size: 40,
                            color: BRAND_DARK,
                            font: "Arial"
                        })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 300 },
                    children: [
                        new TextRun({
                            text: "Curva 2000 - Monitoramento em Tempo Real",
                            size: 28,
                            color: BRAND_GRAY,
                            font: "Arial",
                            italics: true
                        })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 2500 },
                    children: [
                        new TextRun({
                            text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
                            color: BRAND_ORANGE,
                            size: 24
                        })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 400 },
                    children: [
                        new TextRun({
                            text: "Apresentação Institucional",
                            size: 28,
                            color: BRAND_DARK,
                            font: "Arial"
                        })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 100 },
                    children: [
                        new TextRun({
                            text: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase()),
                            size: 24,
                            color: BRAND_GRAY,
                            font: "Arial"
                        })
                    ]
                }),

                // ========== PÁGINA 2 - SOBRE O SISTEMA ==========
                new Paragraph({
                    children: [new PageBreak()]
                }),
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    text: "Sobre o Sistema"
                }),
                new Paragraph({
                    spacing: { before: 200, after: 300 },
                    children: [
                        new TextRun({
                            text: "O ",
                            size: 24,
                            font: "Arial"
                        }),
                        new TextRun({
                            text: "OOH Ops",
                            size: 24,
                            font: "Arial",
                            bold: true,
                            color: BRAND_ORANGE
                        }),
                        new TextRun({
                            text: " é uma plataforma completa de monitoramento e gestão de operações de campo para ativos de mídia Out-of-Home (OOH), desenvolvida para atender às necessidades operacionais da Eletromidia.",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),
                new Paragraph({
                    heading: HeadingLevel.HEADING_2,
                    text: "Objetivo Principal"
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Automatizar e otimizar o gerenciamento de instalações, manutenções e operações de campo, garantindo:",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),
                new Paragraph({
                    spacing: { before: 200 },
                    bullet: { level: 0 },
                    children: [
                        new TextRun({
                            text: "Rastreamento em tempo real de equipes e tarefas",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({
                            text: "Registro obrigatório de evidências fotográficas",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({
                            text: "Gestão hierárquica de visualizações por perfil",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({
                            text: "Cálculo automatizado de medições e relatórios",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                // ========== PÁGINA 3 - FUNCIONALIDADES PRINCIPAIS ==========
                new Paragraph({
                    children: [new PageBreak()]
                }),
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    text: "Funcionalidades Principais"
                }),

                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    text: "📋 Gestão de Ordens de Serviço (OS)"
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Criação, atribuição e acompanhamento completo de ordens de serviço com fluxos de trabalho otimizados para cada tipo de operação.",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    text: "👥 Gestão de Equipes e Colaboradores"
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Gerenciamento completo de técnicos, líderes, chefes e parceiros terceirizados com sistema de convites e perfis diferenciados.",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    text: "🗺️ Mapa em Tempo Real"
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Visualização geográfica de todos os ativos e atividades com rastreamento de localização das equipes em campo.",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    text: "📊 Medições e Relatórios"
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Sistema automatizado de medição de serviços com integração de planilhas Excel e cálculos de valores.",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    text: "🚗 Controle de Frota"
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Gerenciamento completo de veículos com registro de check-in/check-out e histórico de utilização.",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    text: "📱 Gestão de OPECs"
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Controle de equipamentos de operação com atribuição de responsáveis e rastreamento de patrimônio.",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                // ========== PÁGINA 4 - ARQUITETURA E TECNOLOGIA ==========
                new Paragraph({
                    children: [new PageBreak()]
                }),
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    text: "Arquitetura e Tecnologia"
                }),
                new Paragraph({
                    spacing: { before: 300 },
                    heading: HeadingLevel.HEADING_2,
                    text: "Stack Tecnológico"
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({
                            text: "Frontend: ",
                            size: 24,
                            font: "Arial",
                            bold: true
                        }),
                        new TextRun({
                            text: "React + TypeScript + Vite",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({
                            text: "Backend: ",
                            size: 24,
                            font: "Arial",
                            bold: true
                        }),
                        new TextRun({
                            text: "Supabase (PostgreSQL + Auth + Storage)",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({
                            text: "Interface: ",
                            size: 24,
                            font: "Arial",
                            bold: true
                        }),
                        new TextRun({
                            text: "Design moderno e responsivo com CSS customizado",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({
                            text: "Integração: ",
                            size: 24,
                            font: "Arial",
                            bold: true
                        }),
                        new TextRun({
                            text: "API Gemini para inteligência artificial",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                new Paragraph({
                    spacing: { before: 400 },
                    heading: HeadingLevel.HEADING_2,
                    text: "Características de Segurança"
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({
                            text: "Autenticação robusta com Supabase Auth",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({
                            text: "Row Level Security (RLS) para isolamento de dados por empresa",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({
                            text: "Controle de acesso baseado em perfis (RBAC)",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [
                        new TextRun({
                            text: "Sistema de convites com tokens seguros",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                // ========== PÁGINA 5 - PERFIS DE USUÁRIO ==========
                new Paragraph({
                    children: [new PageBreak()]
                }),
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    text: "Perfis de Usuário"
                }),
                new Paragraph({
                    spacing: { before: 200, after: 300 },
                    children: [
                        new TextRun({
                            text: "O sistema oferece diferentes níveis de acesso e visualizações personalizadas para cada perfil:",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    text: "🔧 Técnico"
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Visualização das próprias tarefas atribuídas, registro de evidências fotográficas, atualização de status e comunicação via chat interno.",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    text: "👔 Líder"
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Gestão de equipe local, atribuição de tarefas, monitoramento de progresso e supervisão de técnicos.",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    text: "👑 Chefe"
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Visão executiva completa, dashboard de performance, gestão de todas as equipes, relatórios consolidados e auditoria de evidências.",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    text: "🤝 Parceiros"
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Acesso restrito à visualização de operações da própria empresa parceira, com funcionalidades limitadas.",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                // ========== PÁGINA 6 - BENEFÍCIOS ==========
                new Paragraph({
                    children: [new PageBreak()]
                }),
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    text: "Benefícios"
                }),

                new Paragraph({
                    spacing: { before: 400 },
                    heading: HeadingLevel.HEADING_3,
                    text: "✅ Eficiência Operacional"
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Redução significativa no tempo de gestão de operações com automação de processos e fluxos digitais.",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    text: "✅ Rastreabilidade Completa"
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Histórico completo de todas as operações com evidências fotográficas e geolocalização.",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    text: "✅ Transparência"
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Visibilidade em tempo real do status de cada operação para todas as partes envolvidas.",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    text: "✅ Integração com Parceiros"
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Portal dedicado para empresas terceirizadas com acesso controlado e seguro.",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    text: "✅ Mobilidade"
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Interface responsiva que funciona perfeitamente em dispositivos móveis para uso em campo.",
                            size: 24,
                            font: "Arial"
                        })
                    ]
                }),

                // ========== PÁGINA 7 - CONTATO ==========
                new Paragraph({
                    children: [new PageBreak()]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 2000 },
                    children: [
                        new ImageRun({
                            data: logoBuffer,
                            transformation: {
                                width: 280,
                                height: 68
                            }
                        })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 800 },
                    children: [
                        new TextRun({
                            text: "OOH Ops - Curva 2000",
                            size: 48,
                            bold: true,
                            color: BRAND_ORANGE,
                            font: "Arial"
                        })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 600 },
                    children: [
                        new TextRun({
                            text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
                            color: BRAND_ORANGE,
                            size: 24
                        })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 600 },
                    children: [
                        new TextRun({
                            text: "Transformando a gestão de operações de campo",
                            size: 32,
                            color: BRAND_DARK,
                            font: "Arial",
                            italics: true
                        })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 200 },
                    children: [
                        new TextRun({
                            text: "em uma experiência digital completa.",
                            size: 32,
                            color: BRAND_DARK,
                            font: "Arial",
                            italics: true
                        })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 1200 },
                    children: [
                        new TextRun({
                            text: "eletromidia.com.br",
                            size: 28,
                            color: BRAND_ORANGE,
                            font: "Arial",
                            bold: true
                        })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 1500 },
                    children: [
                        new TextRun({
                            text: "© 2026 Eletromidia. Todos os direitos reservados.",
                            size: 20,
                            color: BRAND_GRAY,
                            font: "Arial"
                        })
                    ]
                })
            ]
        }]
    });

    // Gerar e salvar o documento
    const buffer = await Packer.toBuffer(doc);
    const outputPath = path.join(__dirname, 'OOH_Ops_Apresentacao.docx');
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ Documento gerado com sucesso: ${outputPath}`);
}

generatePresentation().catch(console.error);
