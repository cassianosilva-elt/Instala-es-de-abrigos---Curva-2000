-- Complete Daily Reports Setup (including technician manual selection support)

-- 1. Daily Reports Table with technician_ids support
CREATE TABLE IF NOT EXISTS daily_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    user_id UUID REFERENCES auth.users(id),
    team_id TEXT,
    technician_ids UUID[],
    car_plate TEXT,
    opec_id TEXT,
    notes TEXT,
    company_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Partial unique indexes (no hard constraint on team_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_reports_team_date 
    ON daily_reports (date, team_id, company_id) 
    WHERE team_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_reports_user_date 
    ON daily_reports (date, user_id, company_id) 
    WHERE team_id IS NULL;

-- 3. Daily Activities Table
CREATE TABLE IF NOT EXISTS daily_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES daily_reports(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    asset_codes TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS Policies
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activities ENABLE ROW LEVEL SECURITY;

-- Reports: viewable by company or chiefs
CREATE POLICY "Daily reports are viewable by company" ON daily_reports
    FOR SELECT USING (
        company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()) 
        OR 
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'PARCEIRO_CHEFE')
    );

CREATE POLICY "Daily reports are insertable by leaders and chiefs" ON daily_reports
    FOR INSERT WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'CHEFE', 'PARCEIRO_LIDER', 'PARCEIRO_CHEFE')
    );

CREATE POLICY "Daily reports are editable same day or by chiefs" ON daily_reports
    FOR UPDATE USING (
        (date = CURRENT_DATE AND user_id = auth.uid())
        OR 
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'PARCEIRO_CHEFE')
    );

-- Activities: cascade access from reports
CREATE POLICY "Daily activities are viewable by report access" ON daily_activities
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM daily_reports WHERE id = report_id)
    );

CREATE POLICY "Daily activities are insertable" ON daily_activities
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM daily_reports WHERE id = report_id)
    );

CREATE POLICY "Daily activities are deletable" ON daily_activities
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM daily_reports WHERE id = report_id)
    );
