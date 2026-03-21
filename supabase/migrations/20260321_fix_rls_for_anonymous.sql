-- ============================================================
-- Fix RLS Policies for Anonymous User Support
-- Created: 2026-03-21
-- Purpose: Allow anonymous users (with localStorage IDs) to manage projects
-- ============================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can create projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

DROP POLICY IF EXISTS "Users can view own requirements" ON project_requirements;
DROP POLICY IF EXISTS "Users can manage own requirements" ON project_requirements;

DROP POLICY IF EXISTS "Users can view own outlines" ON project_outlines;
DROP POLICY IF EXISTS "Users can manage own outlines" ON project_outlines;

DROP POLICY IF EXISTS "Users can view own slides" ON project_slides;
DROP POLICY IF EXISTS "Users can manage own slides" ON project_slides;

DROP POLICY IF EXISTS "Users can view own exports" ON project_exports;
DROP POLICY IF EXISTS "Users can manage own exports" ON project_exports;

-- ============================================================
-- Projects: Permissive policies for development
-- ============================================================

-- Allow all reads (anonymous users can view all projects)
CREATE POLICY "Allow read access"
    ON projects FOR SELECT
    USING (true);

-- Allow all inserts (anonymous users can create projects)
CREATE POLICY "Allow insert access"
    ON projects FOR INSERT
    WITH CHECK (true);

-- Allow all updates
CREATE POLICY "Allow update access"
    ON projects FOR UPDATE
    USING (true);

-- Allow all deletes
CREATE POLICY "Allow delete access"
    ON projects FOR DELETE
    USING (true);

-- ============================================================
-- Project Requirements: Permissive policies
-- ============================================================

CREATE POLICY "Allow requirements read"
    ON project_requirements FOR SELECT
    USING (true);

CREATE POLICY "Allow requirements insert"
    ON project_requirements FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow requirements update"
    ON project_requirements FOR UPDATE
    USING (true);

CREATE POLICY "Allow requirements delete"
    ON project_requirements FOR DELETE
    USING (true);

-- ============================================================
-- Project Outlines: Permissive policies
-- ============================================================

CREATE POLICY "Allow outlines read"
    ON project_outlines FOR SELECT
    USING (true);

CREATE POLICY "Allow outlines insert"
    ON project_outlines FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow outlines update"
    ON project_outlines FOR UPDATE
    USING (true);

CREATE POLICY "Allow outlines delete"
    ON project_outlines FOR DELETE
    USING (true);

-- ============================================================
-- Project Slides: Permissive policies
-- ============================================================

CREATE POLICY "Allow slides read"
    ON project_slides FOR SELECT
    USING (true);

CREATE POLICY "Allow slides insert"
    ON project_slides FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow slides update"
    ON project_slides FOR UPDATE
    USING (true);

CREATE POLICY "Allow slides delete"
    ON project_slides FOR DELETE
    USING (true);

-- ============================================================
-- Project Exports: Permissive policies
-- ============================================================

CREATE POLICY "Allow exports read"
    ON project_exports FOR SELECT
    USING (true);

CREATE POLICY "Allow exports insert"
    ON project_exports FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow exports update"
    ON project_exports FOR UPDATE
    USING (true);

CREATE POLICY "Allow exports delete"
    ON project_exports FOR DELETE
    USING (true);

-- ============================================================
-- Note: These permissive policies are for development only.
-- In production, replace with proper auth.uid() based policies
-- or implement Supabase anonymous auth properly.
-- ============================================================
