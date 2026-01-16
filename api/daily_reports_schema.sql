-- Daily Reports Table
CREATE TABLE IF NOT EXISTS daily_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    user_id UUID REFERENCES auth.users(id), -- Reporter (Leader or Chief)
    team_id TEXT, -- ID of the team being reported
    car_plate TEXT,
    opec_id TEXT,
    notes TEXT,
    company_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, team_id, company_id)
);

-- Daily Activities Table (linked to a report)
CREATE TABLE IF NOT EXISTS daily_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES daily_reports(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    asset_codes TEXT[], -- Array of assets worked on
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Absences Table (can be standalone or linked to a report)
CREATE TABLE IF NOT EXISTS daily_absences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES daily_reports(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES auth.users(id), -- Employee who missed
    employee_name TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT NOT NULL,
    notes TEXT,
    company_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_absences ENABLE ROW LEVEL SECURITY;

-- Reports: Leaders see their own company, Chiefs see everything
CREATE POLICY "Daily reports are viewable by company" ON daily_reports
    FOR SELECT USING (
        company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()) 
        OR 
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'CHEFE'
    );

CREATE POLICY "Daily reports are insertable by leaders and chiefs" ON daily_reports
    FOR INSERT WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'CHEFE', 'PARCEIRO_LIDER', 'PARCEIRO_CHEFE')
    );

CREATE POLICY "Daily reports are editable same day only" ON daily_reports
    FOR UPDATE USING (
        date = CURRENT_DATE 
        AND (
            user_id = auth.uid() 
            OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'CHEFE'
        )
    );

-- Activities: cascade view from reports
CREATE POLICY "Daily activities are viewable by report access" ON daily_activities
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM daily_reports WHERE id = report_id)
    );

CREATE POLICY "Daily activities are manageable by report owner" ON daily_activities
    FOR ALL USING (
        EXISTS (SELECT 1 FROM daily_reports WHERE id = report_id AND (user_id = auth.uid() OR date = CURRENT_DATE))
    );

-- Absences: Leader only sees their own team/company, Chief sees all
CREATE POLICY "Absences viewable by company" ON daily_absences
    FOR SELECT USING (
        company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()) 
        OR 
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'CHEFE'
    );

CREATE POLICY "Absences insertable by leaders and chiefs" ON daily_absences
    FOR INSERT WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'CHEFE', 'PARCEIRO_LIDER', 'PARCEIRO_CHEFE')
    );
