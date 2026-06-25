import React, { useState } from 'react';

interface DirTreeNode {
  name: string;
  fullPath: string;
  children: Record<string, DirTreeNode>;
}

const buildDirTree = (dirs: string[]): DirTreeNode => {
  const root: DirTreeNode = { name: 'root', fullPath: '', children: {} };
  dirs.forEach(dirPath => {
    const parts = dirPath.split('/');
    let current = root;
    let pathSoFar = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      pathSoFar = pathSoFar ? `${pathSoFar}/${part}` : part;
      if (!current.children[part]) {
        current.children[part] = { name: part, fullPath: pathSoFar, children: {} };
      }
      current = current.children[part];
    }
  });
  return root;
};

interface DirectoryNodeProps {
  node: DirTreeNode;
  selectedDirs: Set<string>;
  toggleDir: (dir: string) => void;
  defaultOpen?: boolean;
}

const DirectoryNode: React.FC<DirectoryNodeProps> = ({ node, selectedDirs, toggleDir, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isActor = node.fullPath === 'Actor';

  return (
    <div className="clone-tree-node">
      <div className="clone-tree-label">
        {Object.keys(node.children).length > 0 ? (
          <svg 
            xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ cursor: 'pointer', marginRight: '4px', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.1s ease' }}
            onClick={() => setIsOpen(!isOpen)}
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        ) : (
          <span style={{ width: '14px', display: 'inline-block' }}></span>
        )}
        
        <label className="clone-checkbox-label" style={{ fontSize: '11.5px' }}>
          <input 
            type="checkbox" 
            checked={selectedDirs.has(node.fullPath)}
            onChange={() => toggleDir(node.fullPath)}
            disabled={isActor}
            style={{ marginRight: '6px' }}
          />
          <span className={isActor ? 'required-dir' : ''}>{node.name}</span>
          {isActor && <span className="dir-badge">Required</span>}
        </label>
      </div>
      
      {isOpen && Object.keys(node.children).length > 0 && (
        <div className="clone-tree-children">
          {Object.values(node.children).map(child => (
            <DirectoryNode 
              key={child.fullPath} 
              node={child} 
              selectedDirs={selectedDirs} 
              toggleDir={toggleDir} 
              defaultOpen={true}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ActorClonerProps {
  projectName: string;
  onCloneSuccess: () => void;
}

export const ActorCloner: React.FC<ActorClonerProps> = ({ projectName, onCloneSuccess }) => {
  const [originalRowId, setOriginalRowId] = useState('');
  const [newRowId, setNewRowId] = useState('');
  
  const [loadingDirs, setLoadingDirs] = useState(false);
  const [directories, setDirectories] = useState<string[]>([]);
  const [selectedDirs, setSelectedDirs] = useState<Set<string>>(new Set(['Actor']));
  const [error, setError] = useState('');
  
  const [cloning, setCloning] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleFetchDirectories = async () => {
    if (!originalRowId.trim()) return;
    setLoadingDirs(true);
    setError('');
    setSuccessMsg('');
    setDirectories([]);
    try {
      const res = await fetch(`http://127.0.0.1:8123/api/actor/${originalRowId.trim()}/directories`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to fetch actor directories');
      }
      const data = await res.json();
      if (data.directories) {
        setDirectories(data.directories);
        setSelectedDirs(new Set(['Actor']));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingDirs(false);
    }
  };

  const toggleDir = (dir: string) => {
    if (dir === 'Actor') return;
    const next = new Set(selectedDirs);
    if (next.has(dir)) next.delete(dir);
    else next.add(dir);
    setSelectedDirs(next);
  };

  const selectAll = () => {
    setSelectedDirs(new Set(directories));
  };

  const selectNone = () => {
    setSelectedDirs(new Set(['Actor']));
  };

  const handleClone = async () => {
    if (!originalRowId.trim() || !newRowId.trim()) {
      setError('Provide both original and new Row IDs');
      return;
    }
    
    setCloning(true);
    setError('');
    setSuccessMsg('');
    
    try {
      const res = await fetch('http://127.0.0.1:8123/api/actor/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_row_id: originalRowId.trim(),
          new_row_id: newRowId.trim(),
          directories_to_rename: Array.from(selectedDirs),
          project_name: projectName
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Cloning failed');
      }
      
      setSuccessMsg(`Cloned to ${newRowId}!`);
      setOriginalRowId('');
      setNewRowId('');
      setDirectories([]);
      
      // Trigger callback to refresh the file tree
      onCloneSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="sidebar-panel-split" style={{ height: '100%' }}>
      <div className="ide-panel-header">
        <span>Actor Cloner Wizard</span>
      </div>

      <div className="ide-panel-content cloner-panel" style={{ padding: '10px' }}>
        {/* Source Row ID Scan */}
        <div className="form-group">
          <label>Original Actor RowID</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            <input 
              type="text" 
              value={originalRowId} 
              onChange={e => setOriginalRowId(e.target.value)}
              placeholder="e.g. Enemy_Bokoblin_Junior"
              style={{ flex: 1, height: '26px' }}
            />
            <button 
              className="btn-secondary" 
              onClick={handleFetchDirectories} 
              disabled={loadingDirs || !originalRowId.trim()}
              style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
            >
              {loadingDirs ? 'Scanning...' : 'Scan'}
            </button>
          </div>
        </div>

        {/* New Row ID */}
        <div className="form-group">
          <label>New Custom RowID</label>
          <input 
            type="text" 
            value={newRowId} 
            onChange={e => setNewRowId(e.target.value)}
            placeholder="e.g. Enemy_Bokoblin_New"
            style={{ height: '26px' }}
          />
        </div>

        {/* Scanned Directories Checklist */}
        {directories.length > 0 && (
          <div className="directories-section" style={{ flex: 1 }}>
            <div className="directories-header">
              <label>Folders to Decouple</label>
              <div className="dir-controls">
                <button type="button" onClick={selectAll}>All</button>
                <button type="button" onClick={selectNone}>None</button>
              </div>
            </div>
            <div className="clone-tree-root">
              {Object.values(buildDirTree(directories).children).map(child => (
                <DirectoryNode 
                  key={child.fullPath} 
                  node={child} 
                  selectedDirs={selectedDirs} 
                  toggleDir={toggleDir}
                  defaultOpen={true}
                />
              ))}
            </div>
          </div>
        )}

        {error && <div className="cloner-error" style={{ margin: '4px 0 0 0', padding: '4px 8px' }}>{error}</div>}
        {successMsg && <div className="cloner-success" style={{ margin: '4px 0 0 0', padding: '4px 8px' }}>{successMsg}</div>}

        <div className="cloner-actions" style={{ marginTop: 'auto', paddingTop: '8px' }}>
          <button 
            className="btn-primary clone-submit-btn" 
            onClick={handleClone}
            disabled={cloning || !originalRowId || !newRowId || directories.length === 0}
            style={{ height: '28px' }}
          >
            {cloning ? 'Cloning Actor...' : 'Execute Decoupled Clone'}
          </button>
        </div>
      </div>
    </div>
  );
};
