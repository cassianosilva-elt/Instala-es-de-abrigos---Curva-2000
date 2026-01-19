-- =====================================================
-- 4 REGRAS DE OURO - Daily Reports Enhancement
-- Execute este script no Supabase SQL Editor
-- =====================================================

-- =====================================================
-- REGRA 3: Colunas de Rastreabilidade (Lider_Responsavel)
-- =====================================================
ALTER TABLE daily_activities 
ADD COLUMN IF NOT EXISTS lider_responsavel UUID REFERENCES auth.users(id);

ALTER TABLE daily_activities 
ADD COLUMN IF NOT EXISTS lider_name TEXT;

-- Migra dados existentes: preenche com user_id do relatório pai
UPDATE daily_activities da
SET lider_responsavel = dr.user_id,
    lider_name = (SELECT name FROM profiles WHERE id = dr.user_id)
FROM daily_reports dr
WHERE da.report_id = dr.id AND da.lider_responsavel IS NULL;

-- =====================================================
-- REGRA 2: RLS para Visualização Consolidada
-- Chefes e Líderes veem TODOS os relatórios da empresa
-- =====================================================

-- Remove políticas antigas para recriar com nova lógica
DROP POLICY IF EXISTS "Daily reports are viewable by company" ON daily_reports;
DROP POLICY IF EXISTS "Daily activities are viewable by report access" ON daily_activities;
DROP POLICY IF EXISTS "Daily activities are manageable by report owner" ON daily_activities;

-- Política de SELECT para daily_reports
-- Líderes/Chefes veem TUDO da empresa (consolidado)
-- Técnicos veem apenas relatórios da sua equipe
CREATE POLICY "daily_reports_select_consolidated" ON daily_reports
FOR SELECT USING (
    -- Chefes e Líderes veem TODOS os relatórios da empresa (CONSOLIDADO)
    (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'LIDER', 'PARCEIRO_CHEFE', 'PARCEIRO_LIDER')
        AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
    OR
    -- Técnicos veem apenas relatórios da sua equipe
    (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('TECNICO', 'PARCEIRO_TECNICO')
        AND (
            user_id = auth.uid()
            OR team_id IN (SELECT id FROM teams WHERE technician_ids @> ARRAY[auth.uid()::text])
        )
    )
);

-- Política de SELECT para daily_activities
-- Herda visibilidade do relatório pai via RLS
CREATE POLICY "daily_activities_select_consolidated" ON daily_activities
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM daily_reports dr
        WHERE dr.id = daily_activities.report_id
    )
);

-- Política de INSERT para atividades (apenas líderes/chefes podem inserir)
CREATE POLICY "daily_activities_insert" ON daily_activities
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM daily_reports dr
        WHERE dr.id = report_id
        AND (
            dr.user_id = auth.uid()
            OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'PARCEIRO_CHEFE')
        )
    )
);

-- Política de DELETE para atividades (append-only: só admins podem deletar)
CREATE POLICY "daily_activities_delete_admin_only" ON daily_activities
FOR DELETE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'PARCEIRO_CHEFE')
);

-- =====================================================
-- REGRA 4: Habilitar Realtime para a tabela
-- =====================================================
DO $$
BEGIN
    -- Verifica se a tabela já está na publicação antes de adicionar
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'daily_activities'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE daily_activities;
    END IF;
END $$;

-- =====================================================
-- Verificação: mostra as políticas criadas
-- =====================================================
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('daily_reports', 'daily_activities')
ORDER BY tablename, policyname;
