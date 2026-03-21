-- ============================================================
-- Fix created_by Column Type: UUID → TEXT
-- Purpose: Allow anonymous user IDs (non-UUID format)
-- ============================================================

-- Drop foreign key constraint if exists (projects.created_by references auth.users)
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_created_by_fkey;

-- Change column type from UUID to TEXT
ALTER TABLE projects ALTER COLUMN created_by TYPE TEXT;

-- Also change related columns in other tables
ALTER TABLE project_outlines ALTER COLUMN confirmed_by TYPE TEXT;
ALTER TABLE project_exports ALTER COLUMN created_by TYPE TEXT;

-- Update RLS policies to work with TEXT comparison
-- (Existing permissive policies should work, but let's ensure they're correct)

-- Verify the change
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'projects' AND column_name = 'created_by';
