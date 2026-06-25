import React, { useState, useEffect } from 'react';

interface Project {
  name: string;
  created_at?: string;
}

interface HomeViewProps {
  onOpenProject: (projectName: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onOpenProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProjectName, setNewProjectName] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8123/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      setError('Project name cannot be empty');
      return;
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(newProjectName.trim())) {
      setError('Name can only contain letters, numbers, underscores, and dashes');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const res = await fetch('http://127.0.0.1:8123/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim() })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create project');
      }
      
      setNewProjectName('');
      onOpenProject(data.project.name);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="home-container">
      <div className="launcher-main">
        {/* Left Panel: Projects Explorer & Creation */}
        <aside className="launcher-left">
          <div className="launcher-header">
            <h1>TK TOOLS STUDIO</h1>
            <p>TotK Actor & Parameter Workspace</p>
          </div>

          <div className="projects-section">
            <h2>Active Workspaces</h2>
            
            {loading ? (
              <div className="empty-state">Loading workspaces...</div>
            ) : projects.length === 0 ? (
              <div className="empty-state">
                <p>No active workspaces found.</p>
              </div>
            ) : (
              <div className="projects-list-container">
                {projects.map(p => (
                  <div key={p.name} className="project-card" onClick={() => onOpenProject(p.name)}>
                    <div className="project-icon">📁</div>
                    <div className="project-details">
                      <h3>{p.name}</h3>
                      <span className="project-date">
                        Created: {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Unknown'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <h2 style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Create New Workspace
            </h2>
            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <input 
                  type="text" 
                  placeholder="e.g. MyCustomEnemyMod" 
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  disabled={creating}
                  style={{ height: '30px' }}
                />
              </div>
              {error && <div className="modal-error" style={{ margin: '0 0 12px 0' }}>{error}</div>}
              <button 
                type="submit" 
                className="btn-primary" 
                style={{ width: '100%', height: '30px' }}
                disabled={creating || !newProjectName.trim()}
              >
                {creating ? 'Creating...' : 'Initialize Workspace'}
              </button>
            </form>
          </div>
        </aside>

        {/* Right Panel: Developer Quickstart Guide */}
        <main className="launcher-right">
          <div className="launcher-card">
            <h2>TotK Modding Toolkit Guide</h2>
            <div className="quickstart-guide">
              <p>Welcome to the Zelda: Tears of the Kingdom Actor Modding Workspace. This tool provides a professional interface to inspect base-game actors, decouple their parameter files, and safely clone them into custom standalone packages.</p>
              
              <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '16px', marginBottom: '8px' }}>
                Key Capabilities
              </h3>
              <ol>
                <li>
                  <strong>Actor Inspector:</strong> Search and load any actor RowID (e.g., <code>Enemy_Bokoblin_Junior</code>) to explore its compiled SARC components and RSDB (Row Structure Database) properties.
                </li>
                <li>
                  <strong>Decoupling & Cloning:</strong> Clone a base actor into your active workspace. Select which subdirectories (e.g., <code>Model</code>, <code>Animation</code>, <code>Physics</code>) to duplicate and decouple, automatically rewriting internal YAML links.
                </li>
                <li>
                  <strong>RSDB Patch Generation:</strong> The tool automatically generates clean, standalone RSDB JSON patches that are ready to merge or build into your final mod.
                </li>
              </ol>

              <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '16px', marginBottom: '8px' }}>
                Getting Started
              </h3>
              <p>To begin, select an existing workspace from the left panel or initialize a new one. Once inside, use the <strong>Actor Cloner</strong> in the sidebar to copy a base game actor, or click on files in the <strong>Project Explorer</strong> to view your customized actor files!</p>
            </div>
          </div>

          <div className="launcher-card" style={{ opacity: 0.85 }}>
            <h2>Workspace Configuration</h2>
            <div className="quickstart-guide">
              <p>Your workspace links directly to your unpacked game files. Make sure your <code>config.json</code> points to a valid RomFS directory:</p>
              <pre style={{ fontFamily: 'Fira Code, monospace', fontSize: '11.5px', background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)', marginTop: '8px', color: 'var(--val-str)' }}>
{`{
  "romfs_path": "C:/romfs"
}`}
              </pre>
            </div>
          </div>
        </main>
      </div>

      {/* Bottom Status Bar */}
      <footer className="ide-status-bar">
        <div className="status-left">
          <div className="status-item">
            <span className="status-dot"></span>
            Server Status: <span>Connected</span>
          </div>
        </div>
        <div className="status-right">
          <div className="status-item">
            API Version: <span>v1.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
