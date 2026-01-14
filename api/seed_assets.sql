-- Seed real assets for Eletromidia Field Manager
-- Cities: São Paulo, Rio de Janeiro, Belo Horizonte, Curitiba, Salvador

TRUNCATE TABLE assets CASCADE;

INSERT INTO assets (id, code, type, address, lat, lng, city) VALUES
-- São Paulo
('asset_sp_001', 'ABR-SP-001', 'Abrigo de Ônibus', 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP', -23.5615, -46.6623, 'São Paulo'),
('asset_sp_002', 'ABR-SP-002', 'Abrigo de Ônibus', 'Av. Brigadeiro Faria Lima, 2000 - Itaim Bibi, São Paulo - SP', -23.5855, -46.6815, 'São Paulo'),
('asset_sp_003', 'TOT-SP-001', 'Totem', 'Rua Oscar Freire, 500 - Cerqueira César, São Paulo - SP', -23.5661, -46.6673, 'São Paulo'),
('asset_sp_004', 'PAN-SP-001', 'Painel Digital', 'Av. das Nações Unidas, 12551 - Brooklin Novo, São Paulo - SP', -23.6088, -46.6967, 'São Paulo'),

-- Rio de Janeiro
('asset_rj_001', 'ABR-RJ-001', 'Abrigo de Ônibus', 'Av. Atlântica, 1702 - Copacabana, Rio de Janeiro - RJ', -22.9644, -43.1731, 'Rio de Janeiro'),
('asset_rj_002', 'ABR-RJ-002', 'Abrigo de Ônibus', 'Av. Vieira Souto, 100 - Ipanema, Rio de Janeiro - RJ', -22.9864, -43.1932, 'Rio de Janeiro'),
('asset_rj_003', 'TOT-RJ-001', 'Totem', 'Av. Mem de Sá, 100 - Lapa, Rio de Janeiro - RJ', -22.9134, -43.1852, 'Rio de Janeiro'),

-- Belo Horizonte
('asset_bh_001', 'ABR-BH-001', 'Abrigo de Ônibus', 'Av. Afonso Pena, 1500 - Centro, Belo Horizonte - MG', -19.9245, -43.9352, 'Belo Horizonte'),
('asset_bh_002', 'ABR-BH-002', 'Abrigo de Ônibus', 'Av. do Contorno, 6000 - Savassi, Belo Horizonte - MG', -19.9392, -43.9398, 'Belo Horizonte'),

-- Curitiba
('asset_ct_001', 'ABR-CT-001', 'Abrigo de Ônibus', 'Rua XV de Novembro, 500 - Centro, Curitiba - PR', -25.4284, -49.2733, 'Curitiba'),
('asset_ct_002', 'PAN-CT-001', 'Painel Estático', 'Av. Sete de Setembro, 3000 - Rebouças, Curitiba - PR', -25.4391, -49.2689, 'Curitiba'),

-- Salvador
('asset_sv_001', 'ABR-SV-001', 'Abrigo de Ônibus', 'Av. Oceanográfica, 500 - Barra, Salvador - BA', -13.0042, -38.5311, 'Salvador');
