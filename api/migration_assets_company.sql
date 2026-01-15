-- Adicionar coluna company_id na tabela assets se não existir
ALTER TABLE assets ADD COLUMN IF NOT EXISTS company_id TEXT;

-- Resetar políticas para evitar conflitos
DROP POLICY IF EXISTS "Assets are viewable by authenticated users" ON assets;
DROP POLICY IF EXISTS "Internal chiefs can manage assets" ON assets;

-- 1. Permissão de Leitura: Todos autenticados podem ver ativos
CREATE POLICY "Assets are viewable by authenticated users" 
ON assets FOR SELECT 
USING (auth.role() = 'authenticated');

-- 2. Permissão Total: Chefes e Líderes INTERNOS podem gerenciar tudo
CREATE POLICY "Internal chiefs can manage assets" 
ON assets FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.company_id = 'internal'
    AND profiles.role IN ('CHEFE', 'LIDER')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.company_id = 'internal'
    AND profiles.role IN ('CHEFE', 'LIDER')
  )
);
