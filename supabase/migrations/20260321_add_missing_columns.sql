-- Add missing columns to project_requirements table

-- Check and add missing columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'last_saved_at') THEN
        ALTER TABLE project_requirements ADD COLUMN last_saved_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'last_saved_field') THEN
        ALTER TABLE project_requirements ADD COLUMN last_saved_field TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'form_step') THEN
        ALTER TABLE project_requirements ADD COLUMN form_step INTEGER DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'form_completed') THEN
        ALTER TABLE project_requirements ADD COLUMN form_completed BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'client_name') THEN
        ALTER TABLE project_requirements ADD COLUMN client_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'industry') THEN
        ALTER TABLE project_requirements ADD COLUMN industry TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'company_stage') THEN
        ALTER TABLE project_requirements ADD COLUMN company_stage TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'employee_count') THEN
        ALTER TABLE project_requirements ADD COLUMN employee_count INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'diagnosis_session_id') THEN
        ALTER TABLE project_requirements ADD COLUMN diagnosis_session_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'pain_points') THEN
        ALTER TABLE project_requirements ADD COLUMN pain_points JSONB DEFAULT '[]';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'goals') THEN
        ALTER TABLE project_requirements ADD COLUMN goals JSONB DEFAULT '[]';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'timeline') THEN
        ALTER TABLE project_requirements ADD COLUMN timeline TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'report_type') THEN
        ALTER TABLE project_requirements ADD COLUMN report_type TEXT DEFAULT 'comprehensive';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'slide_count') THEN
        ALTER TABLE project_requirements ADD COLUMN slide_count INTEGER DEFAULT 20;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'focus_areas') THEN
        ALTER TABLE project_requirements ADD COLUMN focus_areas JSONB DEFAULT '[]';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'reference_materials') THEN
        ALTER TABLE project_requirements ADD COLUMN reference_materials JSONB DEFAULT '[]';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'tone') THEN
        ALTER TABLE project_requirements ADD COLUMN tone TEXT DEFAULT 'professional';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'language') THEN
        ALTER TABLE project_requirements ADD COLUMN language TEXT DEFAULT 'zh-CN';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'template_style') THEN
        ALTER TABLE project_requirements ADD COLUMN template_style TEXT DEFAULT 'consulting';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'special_requirements') THEN
        ALTER TABLE project_requirements ADD COLUMN special_requirements TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'created_at') THEN
        ALTER TABLE project_requirements ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_requirements' AND column_name = 'updated_at') THEN
        ALTER TABLE project_requirements ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Verify columns
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'project_requirements' ORDER BY ordinal_position;
