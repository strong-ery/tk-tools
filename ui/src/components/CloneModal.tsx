import React, { useState, useEffect } from 'react';
import './CloneModal.css';

interface CloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalRowId: string;
}

export const CloneModal: React.FC<CloneModalProps> = ({ isOpen, onClose, originalRowId }) => {
  const [newRowId, setNewRowId] = useState('');
  const [directories, setDirectories] = useState<string[]>([]);
  const [selectedDirs, setSelectedDirs] = useState<Set<string>>(new Set(['Actor']));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && originalRowId) {
      setNewRowId('');
      setError(null);
      setSuccessMsg(null);
      setLoading(true);
      
      // Fetch directories
      fetch(`http://127.0.0.1:8123/api/actor/${originalRowId}/directories`)
        .then(res => res.json())
        .then(data => {
          if (data.directories) {
            setDirectories(data.directories);
            setSelectedDirs(new Set(['Actor']));
          }
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [isOpen, originalRowId]);

  const toggleDir = (dir: string) => {
    if (dir === 'Actor') return; // Cannot toggle Actor
    
    const newSet = new Set(selectedDirs);
    if (newSet.has(dir)) {
      newSet.delete(dir);
    } else {
      newSet.add(dir);
    }
    setSelectedDirs(newSet);
  };

  const handleClone = async () => {
    if (!newRowId.trim()) {
      setError('Please enter a new RowID');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    
    try {
      const response = await fetch('http://127.0.0.1:8123/api/actor/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_row_id: originalRowId,
          new_row_id: newRowId.trim(),
          directories_to_rename: Array.from(selectedDirs)
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to clone actor');
      }
      
      setSuccessMsg(`Successfully cloned! Saved to: ${data.output_path}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Clone Actor</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label>Original Actor:</label>
            <input type="text" value={originalRowId} disabled className="disabled-input" />
          </div>
          
          <div className="form-group">
            <label>New Actor RowID (e.g. Enemy_MyCustomBoss):</label>
            <input 
              type="text" 
              value={newRowId} 
              onChange={e => setNewRowId(e.target.value)} 
              placeholder="Enemy_MyCustomBoss"
            />
          </div>
          
          <div className="form-group directories-group">
            <label>Directories to Rename / Rewrite internal paths:</label>
            <div className="checkbox-list">
              {directories.map(dir => (
                <label key={dir} className={`checkbox-item ${dir === 'Actor' ? 'disabled' : ''}`}>
                  <input 
                    type="checkbox" 
                    checked={selectedDirs.has(dir)}
                    onChange={() => toggleDir(dir)}
                    disabled={dir === 'Actor'}
                  />
                  {dir}
                </label>
              ))}
            </div>
            <p className="help-text">Only the selected folders will have their bgyml files renamed to match the new actor.</p>
          </div>
          
          {error && <div className="modal-error">{error}</div>}
          {successMsg && <div className="modal-success">{successMsg}</div>}
        </div>
        
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={handleClone} disabled={loading || !!successMsg}>
            {loading ? 'Cloning...' : 'Clone Actor'}
          </button>
        </div>
      </div>
    </div>
  );
};
