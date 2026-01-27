-- =====================================================
-- FIX DAILY REPORTS RLS - FINAL CONSOLIDATION
-- Permite que líderes editem qualquer relatório da sua empresa no dia atual.
-- =====================================================

-- 1. Limpeza de políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "daily_reports_select_consolidated" ON daily_reports;
DROP POLICY IF EXISTS "Daily reports are editable same day or by chiefs" ON daily_reports;
DROP POLICY IF EXISTS "daily_activities_insert" ON daily_activities;
DROP POLICY IF EXISTS "daily_activities_delete_admin_only" ON daily_activities;
DROP POLICY IF EXISTS "daily_activities_update" ON daily_activities; -- Tentativa de remover se existir

-- 2. Políticas do Relatório Diário (daily_reports)

-- SELECT: Líderes/Chefes veem tudo da empresa, técnicos veem o próprio ou da equipe
CREATE POLICY "daily_reports_select_v2" ON daily_reports
FOR SELECT USING (
    (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'LIDER', 'PARCEIRO_CHEFE', 'PARCEIRO_LIDER')
        AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
    OR
    (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('TECNICO', 'PARCEIRO_TECNICO')
        AND (
            user_id = auth.uid()
            OR team_id IN (SELECT id FROM teams WHERE technician_ids @> ARRAY[auth.uid()::text])
        )
    )
);

-- UPDATE: Chefes editam tudo. Líderes editam qualquer um da empresa SE for HOJE.
CREATE POLICY "daily_reports_update_v2" ON daily_reports
FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'PARCEIRO_CHEFE')
    OR
    (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'PARCEIRO_LIDER')
        AND date = CURRENT_DATE
        AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
);

-- 3. Políticas das Atividades Diárias (daily_activities)

-- INSERT: Permite inserir se tiver acesso de edição ao relatório pai
CREATE POLICY "daily_activities_insert_v2" ON daily_activities
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM daily_reports dr
        WHERE dr.id = report_id
        AND (
            (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'PARCEIRO_CHEFE')
            OR
            (
                (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'PARCEIRO_LIDER')
                AND dr.date = CURRENT_DATE
                AND dr.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
            )
        )
    )
);

-- UPDATE: Permite atualizar quantidades (novo)
CREATE POLICY "daily_activities_update_v2" ON daily_activities
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM daily_reports dr
        WHERE dr.id = report_id
        AND (
            (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'PARCEIRO_CHEFE')
            OR
            (
                (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'PARCEIRO_LIDER')
                AND dr.date = CURRENT_DATE
                AND dr.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
            )
        )
    )
);

-- DELETE: Permite deletar se for chefe ou líder no dia atual
CREATE POLICY "daily_activities_delete_v2" ON daily_activities
FOR DELETE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'PARCEIRO_CHEFE')
    OR
    (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'PARCEIRO_LIDER')
        AND EXISTS (
            SELECT 1 FROM daily_reports dr
            WHERE dr.id = report_id
            AND dr.date = CURRENT_DATE
            AND dr.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
        )
    )
);
