-- ============================================================
-- DeepConsult Project Management System
-- Created: 2026-03-21
-- Purpose: Solve data loss issues by persisting all user input
-- ============================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. Projects Table - Core project metadata
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    client_name VARCHAR(255),
    client_industry VARCHAR(100),

    -- Project status workflow
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'requirement', 'outline', 'slides', 'export', 'completed', 'archived')),
    current_step VARCHAR(50) DEFAULT 'requirement' CHECK (current_step IN ('requirement', 'outline', 'slides', 'export')),

    -- LangGraph workflow integration
    langgraph_thread_id VARCHAR(255),
    langgraph_checkpoint VARCHAR(255),

    -- Ownership
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_name CHECK (length(trim(name)) >= 1)
);

-- Index for fast user project lookup
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_updated_at ON projects(updated_at DESC);

-- ============================================================
-- 2. Project Requirements Table - Auto-saved requirement data
-- ============================================================
CREATE TABLE IF NOT EXISTS project_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Form progress tracking
    form_step INTEGER DEFAULT 1 CHECK (form_step BETWEEN 1 AND 4),
    form_completed BOOLEAN DEFAULT FALSE,

    -- Step 1: Basic Info
    client_name VARCHAR(255),
    industry VARCHAR(100),
    company_stage VARCHAR(50),
    employee_count INTEGER,

    -- Step 2: Diagnosis Context
    diagnosis_session_id UUID REFERENCES diagnosis_sessions(id),
    pain_points JSONB DEFAULT '[]'::jsonb,  -- Array of strings
    goals JSONB DEFAULT '[]'::jsonb,         -- Array of strings
    timeline VARCHAR(100),

    -- Step 3: Deliverables
    report_type VARCHAR(50) DEFAULT 'comprehensive',
    slide_count INTEGER DEFAULT 20,
    focus_areas JSONB DEFAULT '[]'::jsonb,   -- MDS dimensions
    reference_materials JSONB DEFAULT '[]'::jsonb,

    -- Step 4: Style Preferences
    tone VARCHAR(50) DEFAULT 'professional',
    language VARCHAR(20) DEFAULT 'zh-CN',
    template_style VARCHAR(50) DEFAULT 'consulting',
    special_requirements TEXT,

    -- Auto-save metadata
    last_saved_at TIMESTAMPTZ,
    last_saved_field VARCHAR(100),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One requirement per project
    CONSTRAINT unique_project_requirement UNIQUE (project_id)
);

CREATE INDEX idx_requirements_project ON project_requirements(project_id);
CREATE INDEX idx_requirements_saved_at ON project_requirements(last_saved_at DESC);

-- ============================================================
-- 3. Project Outlines Table - Multi-level outline structure
-- ============================================================
CREATE TABLE IF NOT EXISTS project_outlines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Outline content (matches LangGraph structure)
    sections JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Version control
    version INTEGER DEFAULT 1,
    is_confirmed BOOLEAN DEFAULT FALSE,
    confirmed_at TIMESTAMPTZ,
    confirmed_by UUID REFERENCES profiles(id),

    -- AI generation metadata
    generation_model VARCHAR(100),
    generation_tokens INTEGER,
    rag_sources JSONB DEFAULT '[]'::jsonb,  -- Referenced KB documents

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outlines_project ON project_outlines(project_id);
CREATE INDEX idx_outlines_version ON project_outlines(project_id, version DESC);

-- ============================================================
-- 4. Project Slides Table - Individual slide content
-- ============================================================
CREATE TABLE IF NOT EXISTS project_slides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Slide identification
    slide_index INTEGER NOT NULL,           -- 0-based position
    section_id VARCHAR(100),                -- References outline section

    -- Content (matches PPTXRenderer schema)
    title VARCHAR(500) NOT NULL,
    subtitle TEXT,
    key_message TEXT,                       -- Action-oriented headline
    content JSONB DEFAULT '{}'::jsonb,      -- Layout-specific content

    -- Layout
    layout_type VARCHAR(50) DEFAULT 'bullet_points',
    -- Supported: title_slide, section_divider, bullet_points, two_columns,
    --            data_chart, swot_matrix, process_flow, gantt_chart

    -- Model reference (Gamma-style)
    model_id VARCHAR(100),                  -- Reference to slide_models table
    model_params JSONB DEFAULT '{}'::jsonb, -- Customizations

    -- Status
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'edited', 'approved')),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_project_slide UNIQUE (project_id, slide_index)
);

CREATE INDEX idx_slides_project ON project_slides(project_id);
CREATE INDEX idx_slides_section ON project_slides(project_id, section_id);

-- ============================================================
-- 5. Project Exports Table - Export history
-- ============================================================
CREATE TABLE IF NOT EXISTS project_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Export details
    format VARCHAR(20) DEFAULT 'pptx',
    file_path TEXT,                         -- MinIO path or local path
    file_size_kb INTEGER,
    download_url TEXT,

    -- Generation metadata
    slide_count INTEGER,
    generation_time_ms INTEGER,

    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- User who triggered export
    created_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_exports_project ON project_exports(project_id);
CREATE INDEX idx_exports_status ON project_exports(status);

-- ============================================================
-- 6. Slide Models Table - Predefined templates (Gamma-style)
-- ============================================================
CREATE TABLE IF NOT EXISTS slide_models (
    id VARCHAR(100) PRIMARY KEY,            -- e.g., 'title-modern', 'bullets-minimal'

    -- Model info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),                   -- title, section, content, data, closing

    -- Layout type mapping
    layout_type VARCHAR(50) NOT NULL,

    -- Default configuration
    default_config JSONB DEFAULT '{}'::jsonb,

    -- Preview
    preview_image_url TEXT,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default slide models
INSERT INTO slide_models (id, name, description, category, layout_type, default_config) VALUES
-- Title slides
('title-modern', '现代标题页', '简洁现代的标题页设计', 'title', 'title_slide', '{"show_date": true, "show_logo": true}'),
('title-bold', '醒目标题页', '大字体醒目标题设计', 'title', 'title_slide', '{"font_size": "large", "accent_color": "#0066CC"}'),

-- Section dividers
('section-minimal', '极简章节页', '极简风格章节过渡页', 'section', 'section_divider', '{"show_number": true}'),
('section-gradient', '渐变章节页', '带渐变背景的章节页', 'section', 'section_divider', '{"gradient": true}'),

-- Content slides
('bullets-minimal', '极简要点', '清晰的要点列表布局', 'content', 'bullet_points', '{"bullet_style": "dot"}'),
('bullets-numbered', '编号列表', '带编号的要点列表', 'content', 'bullet_points', '{"bullet_style": "numbered"}'),
('two-column', '双栏对比', '左右对比布局', 'content', 'two_columns', '{"divider": true}'),

-- Data visualization
('chart-bar', '柱状图', '数据柱状图展示', 'data', 'data_chart', '{"chart_type": "bar"}'),
('chart-pie', '饼图', '数据饼图展示', 'data', 'data_chart', '{"chart_type": "pie"}'),
('swot-standard', 'SWOT矩阵', '标准SWOT分析矩阵', 'data', 'swot_matrix', '{}'),

-- Process
('process-timeline', '时间轴流程', '水平时间轴流程展示', 'data', 'process_flow', '{"orientation": "horizontal"}'),
('process-vertical', '垂直流程', '垂直步骤流程展示', 'data', 'process_flow', '{"orientation": "vertical"}'),

-- Gantt
('gantt-simple', '甘特图', '项目甘特图展示', 'data', 'gantt_chart', '{}')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_outlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE slide_models ENABLE ROW LEVEL SECURITY;

-- Projects: Users can only see their own projects
CREATE POLICY "Users can view own projects"
    ON projects FOR SELECT
    USING (created_by = auth.uid() OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can create projects"
    ON projects FOR INSERT
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own projects"
    ON projects FOR UPDATE
    USING (created_by = auth.uid() OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can delete own projects"
    ON projects FOR DELETE
    USING (created_by = auth.uid() OR auth.jwt() ->> 'role' = 'admin');

-- Project Requirements: Same as projects
CREATE POLICY "Users can view own requirements"
    ON project_requirements FOR SELECT
    USING (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()));

CREATE POLICY "Users can manage own requirements"
    ON project_requirements FOR ALL
    USING (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()));

-- Project Outlines: Same as projects
CREATE POLICY "Users can view own outlines"
    ON project_outlines FOR SELECT
    USING (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()));

CREATE POLICY "Users can manage own outlines"
    ON project_outlines FOR ALL
    USING (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()));

-- Project Slides: Same as projects
CREATE POLICY "Users can view own slides"
    ON project_slides FOR SELECT
    USING (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()));

CREATE POLICY "Users can manage own slides"
    ON project_slides FOR ALL
    USING (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()));

-- Project Exports: Same as projects
CREATE POLICY "Users can view own exports"
    ON project_exports FOR SELECT
    USING (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()));

CREATE POLICY "Users can manage own exports"
    ON project_exports FOR ALL
    USING (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()));

-- Slide Models: Everyone can read, only admins can modify
CREATE POLICY "Anyone can view slide models"
    ON slide_models FOR SELECT
    USING (is_active = true OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Only admins can modify slide models"
    ON slide_models FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- 8. Triggers for updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requirements_updated_at
    BEFORE UPDATE ON project_requirements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outlines_updated_at
    BEFORE UPDATE ON project_outlines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slides_updated_at
    BEFORE UPDATE ON project_slides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slide_models_updated_at
    BEFORE UPDATE ON slide_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 9. Helper Functions
-- ============================================================

-- Get project with all related data
CREATE OR REPLACE FUNCTION get_project_full(project_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'project', p.*,
        'requirement', pr.*,
        'outline', po.*,
        'slides', (
            SELECT jsonb_agg(s.*)
            FROM project_slides s
            WHERE s.project_id = p.id
            ORDER BY s.slide_index
        ),
        'exports', (
            SELECT jsonb_agg(e.*)
            FROM project_exports e
            WHERE e.project_id = p.id
            ORDER BY e.created_at DESC
        )
    ) INTO result
    FROM projects p
    LEFT JOIN project_requirements pr ON pr.project_id = p.id
    LEFT JOIN project_outlines po ON po.project_id = p.id
    WHERE p.id = project_uuid;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update project status based on workflow progress
CREATE OR REPLACE FUNCTION update_project_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update project's updated_at and potentially status
    UPDATE projects
    SET updated_at = NOW()
    WHERE id = NEW.project_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_on_requirement_change
    AFTER INSERT OR UPDATE ON project_requirements
    FOR EACH ROW EXECUTE FUNCTION update_project_status();

-- ============================================================
-- 10. Comments for documentation
-- ============================================================

COMMENT ON TABLE projects IS 'Core project metadata with workflow status tracking';
COMMENT ON TABLE project_requirements IS 'Auto-saved requirement form data with step tracking';
COMMENT ON TABLE project_outlines IS 'Multi-level outline structure with version control';
COMMENT ON TABLE project_slides IS 'Individual slide content and layout configuration';
COMMENT ON TABLE project_exports IS 'Export history and file references';
COMMENT ON TABLE slide_models IS 'Predefined slide templates (Gamma-style reusable models)';
