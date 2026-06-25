import React, { useState } from 'react';
import { ActorViewer } from './ActorViewer';
import { ActorCloner } from './ActorCloner';
import { ProjectBrowser } from './ProjectBrowser';

interface ProjectViewProps {
  projectName: string;
  onGoHome: () => void;
}

export const ProjectView: React.FC<ProjectViewProps> = ({ projectName, onGoHome }) => {
  const [activeActorId, setActiveActorId] = useState<string>('Enemy_Bokoblin_Junior');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setActiveActorId(searchQuery.trim());
    }
  };

  const handleSelectFileActor = (rowId: string) => {
    setActiveActorId(rowId);
    setSearchQuery(rowId);
  };

  const handleCloneSuccess = () => {
    // Increment trigger to force ProjectBrowser to reload files
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="viewer-container">
      {/* IDE Top Header Bar */}
      <header className="ide-header">
        <div className="ide-logo-area">
          <h1>TK TOOLS STUDIO</h1>
          <span className="ide-version-badge">IDE v1.0.0</span>
        </div>

        {/* Global Actor Search in Header */}
        <div className="ide-search-container">
          <form onSubmit={handleGlobalSearch}>
            <input 
              type="text" 
              placeholder="Load Actor (RowID, e.g. Enemy_Bokoblin_Junior)..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn-primary">Load</button>
          </form>
        </div>

        <div className="ide-header-right">
          <div className="ide-project-badge">
            Workspace: <span>{projectName}</span>
          </div>
          <button className="btn-secondary" onClick={onGoHome} style={{ height: '26px' }}>
            ← Launcher
          </button>
        </div>
      </header>

      {/* Main Split IDE Workspace */}
      <div className="ide-workspace">
        {/* Left Sidebar (Files + Cloner Stack) */}
        <aside className="ide-left-sidebar">
          <div className="sidebar-panel-split">
            {/* Top: Project Explorer */}
            <div className="sidebar-top-section">
              <ProjectBrowser 
                projectName={projectName} 
                refreshTrigger={refreshTrigger}
                onSelectActor={handleSelectFileActor}
              />
            </div>

            {/* Bottom: Actor Cloner */}
            <div className="sidebar-bottom-section">
              <ActorCloner 
                projectName={projectName} 
                onCloneSuccess={handleCloneSuccess}
              />
            </div>
          </div>
        </aside>

        {/* Center & Right Workspace: Actor Viewer (which has component outliner + inspector) */}
        <main className="ide-center-canvas">
          <ActorViewer activeActorId={activeActorId} projectName={projectName} />
        </main>
      </div>

      {/* Bottom Status Bar */}
      <footer className="ide-status-bar">
        <div className="status-left">
          <div className="status-item">
            <span className="status-dot"></span>
            API Server: <span>127.0.0.1:8123</span>
          </div>
          <div className="status-item">
            Active Workspace: <span>projects/{projectName}</span>
          </div>
        </div>
        <div className="status-right">
          <div className="status-item">
            Active Actor: <span style={{ color: 'var(--accent-hover)', fontFamily: 'Fira Code, monospace', fontWeight: 600 }}>{activeActorId}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
