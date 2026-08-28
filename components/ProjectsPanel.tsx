import React, { useEffect, useState, useCallback } from 'react';
import { X, FolderOpen, Save, Trash2, Loader2, Layers, Clock } from 'lucide-react';
import type { Project } from '../types';
import { saveProject, listProjects, loadProject, deleteProject, type SavedProjectSummary } from '../services/firebase/projectsService';

interface ProjectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentProject: Project | null;
  onLoadProject: (project: Project) => void;
}

const formatDate = (date: Date | null): string => {
  if (!date) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const ProjectsPanel: React.FC<ProjectsPanelProps> = ({ isOpen, onClose, userId, currentProject, onLoadProject }) => {
  const [projects, setProjects] = useState<SavedProjectSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoadingList(true);
    setError(null);
    try {
      const list = await listProjects(userId);
      setProjects(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load projects.');
    } finally {
      setIsLoadingList(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  if (!isOpen) return null;

  const handleSaveCurrent = async () => {
    if (!currentProject) return;
    setIsSaving(true);
    setError(null);
    try {
      await saveProject(userId, currentProject);
      setSaveFeedback(true);
      setTimeout(() => setSaveFeedback(false), 2000);
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to save project.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoad = async (projectId: string) => {
    setLoadingProjectId(projectId);
    setError(null);
    try {
      const project = await loadProject(projectId);
      onLoadProject(project);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to load project.');
    } finally {
      setLoadingProjectId(null);
    }
  };

  const handleDelete = async (projectId: string) => {
    setDeletingProjectId(projectId);
    setError(null);
    try {
      await deleteProject(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
    } catch (err: any) {
      setError(err?.message || 'Failed to delete project.');
    } finally {
      setDeletingProjectId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-xl text-white shadow-lg shadow-slate-300">
              <FolderOpen className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-black text-slate-900 leading-tight">My Projects</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <button
            onClick={handleSaveCurrent}
            disabled={!currentProject || isSaving}
            className="w-full py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saveFeedback ? 'Saved!' : 'Save Current Project'}
          </button>
          {!currentProject && (
            <p className="text-center text-[11px] font-medium text-slate-400 mt-2">Open or create a project first.</p>
          )}
        </div>

        {error && (
          <p className="mx-6 mt-4 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoadingList ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 text-slate-400 px-6">
              <FolderOpen className="w-10 h-10 stroke-[1.5] text-slate-200" />
              <p className="text-xs font-medium leading-relaxed">No saved projects yet. Save your current work to see it here.</p>
            </div>
          ) : (
            projects.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-800 truncate">{p.name}</h3>
                  <div className="flex items-center gap-3 text-[10px] font-medium text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{p.elementsCount} elements</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(p.updatedAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleLoad(p.id)}
                  disabled={loadingProjectId === p.id}
                  className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loadingProjectId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Load'}
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={deletingProjectId === p.id}
                  className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  title="Delete project"
                >
                  {deletingProjectId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
