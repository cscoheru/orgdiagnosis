-- ============================================================
-- Create Missing Project Tables
-- ============================================================

-- 1. Project Requirements Table
CREATE TABLE IF NOT EXISTS project_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Form progress
    form_step INTEGER DEFAULT 1,
    form_completed BOOLEAN DEFAULT FALSE,

    -- Step 1: Client Info
    client_name TEXT,
    industry TEXT,
    company_stage TEXT,
    employee_count INTEGER,

    -- Step 2: Diagnosis
    diagnosis_session_id UUID,
    pain_points JSONB DEFAULT '[]',
    goals JSONB DEFAULT '[]',
    timeline TEXT,

    -- Step 3: Deliverables
    report_type TEXT DEFAULT 'comprehensive',
    slide_count INTEGER DEFAULT 20,
    focus_areas JSONB DEFAULT '[]',
    reference_materials JSONB DEFAULT '[]',

    -- Step 4: Style
    tone TEXT DEFAULT 'professional',
    language TEXT DEFAULT 'zh-CN',
    template_style TEXT DEFAULT 'consulting',
    special_requirements TEXT,

    -- Auto-save metadata
    last_saved_at TIMESTAMPTZ,
    last_saved_field TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_project_requirement UNIQUE (project_id)
);

-- 2. Project Outlines Table
CREATE TABLE IF NOT EXISTS project_outlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sections JSONB NOT NULL DEFAULT '[]',
    version INTEGER DEFAULT 1,
    is_confirmed BOOLEAN DEFAULT FALSE,
    confirmed_at TIMESTAMPTZ,
    confirmed_by TEXT,
    generation_model TEXT,
    generation_tokens INTEGER,
    rag_sources JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Project Slides Table
CREATE TABLE IF NOT EXISTS project_slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    slide_index INTEGER NOT NULL,
    section_id TEXT,
    title TEXT NOT NULL,
    subtitle TEXT,
    key_message TEXT,
    content JSONB DEFAULT '{}',
    layout_type TEXT DEFAULT 'bullet_points',
    model_id TEXT,
    model_params JSONB DEFAULT '{}',
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_project_slide UNIQUE (project_id, slide_index)
);

-- 4. Project Exports Table
CREATE TABLE IF NOT EXISTS project_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    format TEXT DEFAULT 'pptx',
    file_path TEXT,
    file_size_kb INTEGER,
    download_url TEXT,
    slide_count INTEGER,
    generation_time_ms INTEGER,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_by TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_requirements_project ON project_requirements(project_id);
CREATE INDEX IF NOT EXISTS idx_outlines_project ON project_outlines(project_id);
CREATE INDEX IF NOT EXISTS idx_slides_project ON project_slides(project_id);
CREATE INDEX IF NOT EXISTS idx_exports_project ON project_exports(project_id);

-- Enable RLS
ALTER TABLE project_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_outlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_exports ENABLE ROW LEVEL SECURITY;

-- Permissive policies for development
CREATE POLICY "Allow all on requirements" ON project_requirements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on outlines" ON project_outlines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on slides" ON project_slides FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on exports" ON project_exports FOR ALL USING (true) WITH CHECK (true);

-- Update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_requirements_updated_at ON project_requirements;
CREATE TRIGGER update_requirements_updated_at
    BEFORE UPDATE ON project_requirements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_outlines_updated_at ON project_outlines;
CREATE TRIGGER update_outlines_updated_at
    BEFORE UPDATE ON project_outlines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_slides_updated_at ON project_slides;
CREATE TRIGGER update_slides_updated_at
    BEFORE UPDATE ON project_slides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
