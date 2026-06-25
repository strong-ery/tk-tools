import React, { useState, useEffect } from 'react';

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileNode[];
}

interface ProjectBrowserProps {
  projectName: string;
  refreshTrigger: number;
  onSelectActor: (rowId: string) => void;
}

const formatBytes = (bytes: number, decimals = 1) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

interface FileTreeNodeProps {
  node: FileNode;
  defaultOpen?: boolean;
  onFileClick: (fileName: string) => void;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, defaultOpen = false, onFileClick }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggle = () => {
    if (node.type === 'directory') {
      setIsOpen(!isOpen);
    } else {
      onFileClick(node.name);
    }
  };

  const isActorFile = node.name.endsWith('_Patch.json') || node.name.endsWith('.pack.zs');

  return (
    <div className="tree-node">
      <div 
        className={`tree-node-label ${node.type} ${isActorFile ? 'active' : ''}`} 
        onClick={toggle}
        title={node.type === 'file' ? 'Click to load in Actor Viewer' : undefined}
      >
        <span className="tree-icon">
          {node.type === 'directory' ? (
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="12" height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.1s ease' }}
            >
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          ) : (
            <span style={{ width: '12px', display: 'inline-block' }}></span>
          )}
          
          {node.type === 'directory' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-hover)', marginLeft: '4px' }}>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: isActorFile ? 'var(--accent-hover)' : 'var(--text-muted)', marginLeft: '4px' }}>
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
              <polyline points="13 2 13 9 20 9"></polyline>
            </svg>
          )}
        </span>
        <span className="tree-name" style={{ marginLeft: '4px', cursor: node.type === 'file' ? 'pointer' : 'default' }}>
          {node.name}
        </span>
        {node.type === 'file' && node.size !== undefined && (
          <span className="tree-size">{formatBytes(node.size)}</span>
        )}
      </div>
      
      {node.type === 'directory' && isOpen && node.children && (
        <div className="tree-children">
          {node.children.map((child, idx) => (
            <FileTreeNode 
              key={`${child.name}-${idx}`} 
              node={child} 
              defaultOpen={false} 
              onFileClick={onFileClick}
            />
          ))}
          {node.children.length === 0 && (
            <div className="tree-empty">Empty</div>
          )}
        </div>
      )}
    </div>
  );
};

export const ProjectBrowser: React.FC<ProjectBrowserProps> = ({ projectName, refreshTrigger, onSelectActor }) => {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchFiles = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`http://127.0.0.1:8123/api/projects/${projectName}/files`);
      if (!res.ok) {
        throw new Error('Failed to load workspace files');
      }
      const data = await res.json();
      setFiles(data.files);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [projectName, refreshTrigger]);

  const handleFileClick = (fileName: string) => {
    let rowId = '';
    if (fileName.endsWith('_Patch.json')) {
      rowId = fileName.replace('_Patch.json', '');
    } else if (fileName.endsWith('.pack.zs')) {
      rowId = fileName.replace('.pack.zs', '');
    }
    
    if (rowId) {
      onSelectActor(rowId);
    }
  };

  return (
    <div className="sidebar-panel-split" style={{ height: '100%' }}>
      <div className="ide-panel-header">
        <span>Project Explorer</span>
        <button 
          className="btn-secondary" 
          onClick={fetchFiles} 
          disabled={loading}
          style={{ height: '18px', padding: '0 6px', fontSize: '10px', textTransform: 'none' }}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="ide-panel-content" style={{ padding: '8px' }}>
        {error ? (
          <div className="error-banner" style={{ margin: '4px' }}>
            <p>{error}</p>
          </div>
        ) : loading && files.length === 0 ? (
          <div className="empty-state" style={{ fontSize: '11.5px' }}>Loading files...</div>
        ) : files.length === 0 ? (
          <div className="empty-state" style={{ fontSize: '11.5px', padding: '16px', textAlign: 'center' }}>
            <p>Workspace is empty. Use the Cloner below to copy a base game actor.</p>
          </div>
        ) : (
          <div className="file-tree-root">
            {files.map((file, idx) => (
              <FileTreeNode 
                key={`${file.name}-${idx}`} 
                node={file} 
                defaultOpen={true} 
                onFileClick={handleFileClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
