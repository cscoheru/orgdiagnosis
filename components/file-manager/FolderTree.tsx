'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  FolderPlus
} from 'lucide-react';

// ==================== Types ====================

export interface Folder {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  path: string;
  created_at: string;
  updated_at: string;
  children?: Folder[];
}

interface FolderTreeProps {
  projectId: string;
  selectedFolderId: string | null;
  onSelectFolder: (folder: Folder) => void;
  onRefresh?: () => void;
}

// ==================== API Functions ====================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function fetchFolders(projectId: string): Promise<Folder[]> {
  const response = await fetch(`${API_BASE}/api/knowledge/folders?project_id=${projectId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch folders');
  }
  const data = await response.json();
  return data.tree || [];
}

async function createFolder(
  projectId: string,
  name: string,
  parentId: string | null = null
): Promise<Folder> {
  const response = await fetch(`${API_BASE}/api/knowledge/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      name,
      parent_id: parentId,
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create folder');
  }
  const data = await response.json();
  return data.folder;
}

async function updateFolder(folderId: string, name: string): Promise<Folder> {
  const response = await fetch(`${API_BASE}/api/knowledge/folders/${folderId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update folder');
  }
  const data = await response.json();
  return data.folder;
}

async function deleteFolder(folderId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/knowledge/folders/${folderId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete folder');
  }
}

// ==================== Context Menu Component ====================

interface ContextMenuProps {
  folder: Folder;
  position: { x: number; y: number };
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function ContextMenu({ folder, position, onClose, onRename, onDelete }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      onClose();
    }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]"
      style={{ left: position.x, top: position.y }}
    >
      <button
        onClick={(e) => {
        e.stopPropagation();
        onRename();
        onClose();
      }}
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
      >
        <Pencil size={14} className="text-gray-500" />
        <span>Rename</span>
      </button>
      <button
        onClick={(e) => {
        e.stopPropagation();
        onDelete();
        onClose();
      }}
        className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
      >
        <Trash2 size={14} className="text-gray-400" />
        <span>Delete</span>
      </button>
    </div>
  );
}

// ==================== Create Folder Modal ====================

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
  parentFolder?: Folder | null;
}

function CreateFolderModal({
  isOpen,
  onClose,
  onCreate,
  parentFolder,
}: CreateFolderModalProps) {
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setName('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
    await onCreate(name.trim());
    setName('');
    onClose();
  } catch (error) {
    console.error('Failed to create folder:', error);
    alert(error instanceof Error ? error.message : 'Failed to create folder');
  } finally {
    setIsCreating(false);
  }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-[90vw]">
        <h3 className="text-lg font-semibold mb-4">
          {parentFolder ? `Create subfolder in "${parentFolder.name}"` : 'Create New Folder'}
        </h3>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isCreating}
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={!name.trim() || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== Rename Folder Modal ====================

interface RenameFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newName: string) => void;
  folder: Folder;
}

function RenameFolderModal({
  isOpen,
  onClose,
  onRename,
  folder,
}: RenameFolderModalProps) {
  const [name, setName] = useState(folder.name);
  const [isRenaming, setIsRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(folder.name);
  }, [folder.name]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name === folder.name) {
      onClose();
      return;
    }

    setIsRenaming(true);
    try {
      await onRename(name.trim());
      onClose();
    } catch (error) {
        console.error('Failed to rename folder:', error);
        alert(error instanceof Error ? error.message : 'Failed to rename folder');
    } finally {
      setIsRenaming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-[90vw]">
        <h3 className="text-lg font-semibold mb-4">Rename Folder</h3>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isRenaming}
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
              disabled={isRenaming}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={!name.trim() || name === folder.name || isRenaming}
            >
              {isRenaming ? 'Renaming...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== Tree Node Component ====================

interface TreeNodeProps {
  folder: Folder;
  level: number;
  selectedFolderId: string | null;
  expandedIds: Set<string>;
  onSelectFolder: (folder: Folder) => void;
  onToggleExpand: (folderId: string) => void;
  onContextMenu: (e: React.MouseEvent, folder: Folder) => void;
  onCreateSubfolder: (folder: Folder) => void;
}

function TreeNode({
  folder,
  level,
  selectedFolderId,
  expandedIds,
  onSelectFolder,
  onToggleExpand,
  onContextMenu,
  onCreateSubfolder,
}: TreeNodeProps) {
  const hasChildren = folder.children && folder.children.length > 0;
  const isExpanded = expandedIds.has(folder.id);
  const isSelected = selectedFolderId === folder.id;

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1.5 px-2 rounded cursor-pointer group transition-colors ${
          isSelected
            ? 'bg-blue-100 text-blue-800'
            : 'hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelectFolder(folder)}
        onContextMenu={(e) => onContextMenu(e, folder)}
      >
        {/* Expand/Collapse Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(folder.id);
          }}
          className={`w-5 h-5 flex items-center justify-center ${
            hasChildren ? 'hover:bg-gray-200 rounded' : ''
          }`}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={14} className="text-gray-500" />
            ) : (
              <ChevronRight size={14} className="text-gray-500" />
            )
          ) : (
            <span className="w-3.5" />
          )}
        </button>

        {/* Folder Icon */}
        {isExpanded ? (
          <FolderOpen size={16} className="text-yellow-500 flex-shrink-0" />
        ) : (
          <Folder size={16} className="text-yellow-500 flex-shrink-0" />
        )}

        {/* Folder Name */}
        <span className="flex-1 truncate text-sm">{folder.name}</span>

        {/* Add Subfolder Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCreateSubfolder(folder);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
          title="Create subfolder"
        >
          <FolderPlus size={14} className="text-gray-400" />
        </button>

        {/* More Options Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e, folder);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
          title="More options"
        >
          <MoreVertical size={14} className="text-gray-400" />
        </button>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {folder.children!.map((child) => (
            <TreeNode
              key={child.id}
              folder={child}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              expandedIds={expandedIds}
              onSelectFolder={onSelectFolder}
              onToggleExpand={onToggleExpand}
              onContextMenu={onContextMenu}
              onCreateSubfolder={onCreateSubfolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== Main FolderTree Component ====================

export default function FolderTree({
  projectId,
  selectedFolderId,
  onSelectFolder,
  onRefresh,
}: FolderTreeProps) {
  // State
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    folder: Folder;
    position: { x: number; y: number };
  } | null>(null);

  // Modal States
  const [createModal, setCreateModal] = useState<{
    isOpen: boolean;
    parentFolder: Folder | null;
  }>({ isOpen: false, parentFolder: null });
  const [renameModal, setRenameModal] = useState<{
    isOpen: boolean;
    folder: Folder | null;
  }>({ isOpen: false, folder: null });

  // Fetch folders on mount and when projectId changes
  const loadFolders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tree = await fetchFolders(projectId);
      setFolders(tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders');
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  // Notify parent to refresh
  useEffect(() => {
    if (onRefresh) {
      // Store loadFolders so parent can call it
      (window as any).__folderTreeReload = loadFolders;
    }
  }, [loadFolders, onRefresh]);

  // Toggle expand/collapse
  const handleToggleExpand = useCallback((folderId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, folder: Folder) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      folder,
      position: { x: e.clientX, y: e.clientY },
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Handle create folder
  const handleCreateFolder = useCallback(
    async (name: string) => {
      const parent = createModal.parentFolder;
      const parentId = parent?.id || null;
      await createFolder(projectId, name, parentId);
      await loadFolders();
      // Expand parent folder
      if (parent) {
        setExpandedIds((prev) => new Set(prev).add(parent.id));
      }
    },
    [projectId, createModal.parentFolder, loadFolders]
  );

  // Handle rename folder
  const handleRenameFolder = useCallback(
    async (newName: string) => {
      if (!renameModal.folder) return;
      await updateFolder(renameModal.folder.id, newName);
      await loadFolders();
    },
    [renameModal.folder, loadFolders]
  );

  // Handle delete folder
  const handleDeleteFolder = useCallback(
    async (folder: Folder) => {
      if (!confirm(`Delete "${folder.name}" and all its contents?`)) return;
      try {
        await deleteFolder(folder.id);
        await loadFolders();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to delete folder');
      }
    },
    [loadFolders]
  );

  // Open create subfolder modal
  const handleCreateSubfolder = useCallback((folder: Folder) => {
    setCreateModal({ isOpen: true, parentFolder: folder });
  }, []);

  // Open rename modal
  const openRenameModal = useCallback(() => {
    if (contextMenu) {
      setRenameModal({ isOpen: true, folder: contextMenu.folder });
      setContextMenu(null);
    }
  }, [contextMenu]);

  // Delete from context menu
  const handleDeleteFromContextMenu = useCallback(() => {
    if (contextMenu) {
      handleDeleteFolder(contextMenu.folder);
      setContextMenu(null);
    }
  }, [contextMenu, handleDeleteFolder]);

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading folders...</span>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="py-4 px-3">
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={loadFolders}
          className="mt-2 text-sm text-blue-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // Render empty state
  if (folders.length === 0) {
    return (
      <div className="py-4 px-3">
        <p className="text-sm text-gray-500 mb-3">No folders yet</p>
        <button
          onClick={() => setCreateModal({ isOpen: true, parentFolder: null })}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
        >
          <Plus size={16} />
          Create folder
        </button>
      </div>
    );
  }

  return (
    <div className="py-2">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Folders</h3>
        <button
          onClick={() => setCreateModal({ isOpen: true, parentFolder: null })}
          className="p-1 hover:bg-gray-100 rounded"
          title="Create new folder"
        >
          <Plus size={16} className="text-gray-500" />
        </button>
      </div>

      {/* Tree */}
      <div className="space-y-0.5">
        {folders.map((folder) => (
          <TreeNode
            key={folder.id}
            folder={folder}
            level={0}
            selectedFolderId={selectedFolderId}
            expandedIds={expandedIds}
            onSelectFolder={onSelectFolder}
            onToggleExpand={handleToggleExpand}
            onContextMenu={handleContextMenu}
            onCreateSubfolder={handleCreateSubfolder}
          />
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          folder={contextMenu.folder}
          position={contextMenu.position}
          onClose={closeContextMenu}
          onRename={openRenameModal}
          onDelete={handleDeleteFromContextMenu}
        />
      )}

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={createModal.isOpen}
        onClose={() => setCreateModal({ isOpen: false, parentFolder: null })}
        onCreate={handleCreateFolder}
        parentFolder={createModal.parentFolder}
      />

      {/* Rename Folder Modal */}
      {renameModal.folder && (
        <RenameFolderModal
          isOpen={renameModal.isOpen}
          onClose={() => setRenameModal({ isOpen: false, folder: null })}
          onRename={handleRenameFolder}
          folder={renameModal.folder}
        />
      )}
    </div>
  );
}
