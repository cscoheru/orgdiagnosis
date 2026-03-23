'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, from 'next/navigation';
import Link from 'next/link';
import {
  Upload,
  FolderPlus,
  ChevronRight,
  Home,
  File,
  ArrowLeft,
  Loader2,
  Trash2
} from 'lucide-react';
import FolderTree, { type Folder } from '@/components/file-manager';
import FileList from '@/components/file-manager';
import FileUploadZone from '@/components/file-manager';
import { Button } from '@/components/ui/button';
import {
  getProjects,
  type Project
} from '@/lib/knowledge-v2-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function FileManagerPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch projects on mount
  useEffect(() => {
    async function fetchProjectsData() {
      try {
        setLoading(true);
        const data = await getProjects();
        setProjects(data);
        // Auto-select first project if available
        if (data.length > 0 && !selectedProject) {
          setSelectedProject(data[0]);
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProjectsData();
  }, []);

  // Handle folder selection
  const handleSelectFolder = useCallback((folder: Folder) => {
    setSelectedFolder(folder);
  }, []);

  // Handle project selection
  const handleSelectProject = useCallback((project: Project) => {
    setSelectedProject(project);
    setSelectedFolder(null);
    router.push(`/knowledge/files?project=${project.id}`);
  }, [router]);

  // Refresh handlers
  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleUploadComplete = useCallback(() => {
    setShowUpload(false);
    handleRefresh();
  }, []);

  // Toggle upload view
  const toggleUploadView = useCallback(() => {
    if (!selectedFolder) {
      // If no folder selected, show a alert
      return;
    }
    setShowUpload(!showUpload);
  }, [showUpload, selectedFolder]);

  // Get breadcrumb path
  const getBreadcrumbPath = useCallback(() => {
    if (!selectedFolder) return [];
    const parts = selectedFolder.path.split('/').filter(Boolean(p => p));
    return parts;
  }, [selectedFolder]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          <p className="text-gray-500 mt-2">Loading projects...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (projects.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <File className="w-12 h-12 text-gray-400 mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">No Projects</h2>
          <p className="text-sm text-gray-500 mb-4">Create a project first to manage files</p>
          <Link
            href="/projects?new=true"
            className="text-blue-600 hover:text-blue-700"
          >
            Create Project
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left sidebar - Folder Tree */}
      <div className="w-64 border-r border-gray-200 flex flex-col bg-white">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">Projects</h2>
        </div>

        {/* Project Selector */}
        <div className="p-2">
          <select
            value={selectedProject?.id || ''}
            onChange={(e) => {
              const project = projects.find((p) => p.id === e.target.value);
              if (project) {
                handleSelectProject(project);
              }
            }}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a project...</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* Folder Tree */}
        <div className="flex-1 overflow-y-auto">
          {selectedProject ? (
            <FolderTree
              projectId={selectedProject.id}
              selectedFolderId={selectedFolder?.id || null}
              onSelectFolder={handleSelectFolder}
              onRefresh={handleRefresh}
            />
          ) : (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <p className="text-sm">Select a project to view folders</p>
            </div>
          )}
        </div>

        {/* New Folder Button */}
        <div className="p-4 border-t border-gray-200 mt-auto">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              // This would need to be implemented at the component level
              // For now, trigger refresh
              if (selectedProject) {
                alert('New folder will be created in the root. You can also right-click a folder to create subfolders.');
              }
            }}
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            New Folder
          </Button>
        </div>
      </div>

      {/* Right panel - File List */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/knowledge/dashboard"
              className="text-gray-500 hover:text-gray-700"
            >
              <Home className="w-4 h-4" />
            </Link>
            <Link
              href="/knowledge/files"
              className="text-blue-600 font-medium"
            >
              Files
            </Link>
            {selectedFolder && (
              <>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                {getBreadcrumbPath().map((part, index) => (
                  <span
                    key={part}
                    className={index === getBreadcrumbPath().length - 1 ? 'text-gray-700 font-medium' : 'text-gray-500'}
                  >
                    {part}
                  </span>
                ))}
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleUploadView}
              disabled={!selectedFolder}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Trigger folder creation through FolderTree component
                // by calling the global refresh
                if (selectedProject) {
                  handleRefresh();
                }
              }}
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              New Folder
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {showUpload ? (
            <div className="p-4">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Files</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Upload files to {selectedFolder?.name || 'selected folder'}
                </p>
                {selectedProject && selectedFolder && (
                  <FileUploadZone
                    projectId={selectedProject.id}
                    folderId={selectedFolder.id}
                    onUploadComplete={handleUploadComplete}
                  />
                )}
              </div>
            </div>
          ) : selectedFolder ? (
            <FileList
              key={refreshKey}
              folderId={selectedFolder.id}
              onRefresh={handleRefresh}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <Folder className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 mb-1">No folder selected</p>
              <p className="text-xs text-gray-400">Select a folder from the left sidebar to view its files</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
