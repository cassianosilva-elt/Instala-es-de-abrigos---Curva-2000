-- Add missing "Instalação Completa de Totem" activity for all companies

INSERT INTO measurement_prices (id, company_id, category, description, unit, price, created_at, updated_at)
SELECT 
    'totem_instalacao_completa', -- New unique ID part
    c.id as company_id,
    'TOTEM',
    'Instalação Completa de Totem, incluindo a execução do piso podotátil',
    'UN',
    480.69, -- Price from the user's screenshot
    NOW(),
    NOW()
FROM (VALUES 
    ('gf1'), 
    ('alvares'), 
    ('bassi'), 
    ('afn_nogueira')
) as c(id)
ON CONFLICT (id, company_id) DO UPDATE SET
    description = EXCLUDED.description,
    price = EXCLUDED.price;
