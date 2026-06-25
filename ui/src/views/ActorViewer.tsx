import React, { useState, useEffect } from 'react';

interface ComponentData {
  name: string;
  folder?: string;
  isNative?: boolean;
  isParentRef?: boolean;
  info?: Record<string, any>;
  fields: Record<string, any>;
}

interface ActorData {
  ID: string;
  category: string;
  components: ComponentData[];
  rsdb: { name: string; fields: Record<string, any> }[];
}

interface ActorViewerProps {
  activeActorId: string;
  projectName: string;
}

export const ActorViewer: React.FC<ActorViewerProps> = ({ activeActorId, projectName }) => {
  const [actor, setActor] = useState<ActorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedComponent, setSelectedComponent] = useState<ComponentData | null>(null);
  
  // Local outliner state
  const [componentQuery, setComponentQuery] = useState('');
  const [showInherited, setShowInherited] = useState(true);
  const [showParentRefs, setShowParentRefs] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  // Inspector Edit State
  const [editedFields, setEditedFields] = useState<Record<string, any>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);
  const [saveError, setSaveError] = useState('');

  const toggleFolder = (folder: string) => {
    setCollapsedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const fetchActor = async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`http://127.0.0.1:8123/api/actor/${id}`);
      if (!res.ok) {
        throw new Error(`Failed to load actor. Status: ${res.status}`);
      }
      const data = await res.json();
      setActor(data);
      setSelectedComponent(null);
    } catch (err: any) {
      setError(err.message);
      setActor(null);
      setSelectedComponent(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch actor whenever activeActorId changes
  useEffect(() => {
    if (activeActorId) {
      fetchActor(activeActorId);
    }
  }, [activeActorId]);

  // Initialize edit state when selected component changes
  useEffect(() => {
    if (selectedComponent) {
      setEditedFields({ ...selectedComponent.fields });
      setIsDirty(false);
      setSaveStatus(null);
      setSaveError('');
    } else {
      setEditedFields({});
      setIsDirty(false);
    }
  }, [selectedComponent]);

  const handleFieldChange = (key: string, value: any) => {
    setEditedFields(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setSaveStatus(null);
  };

  const handleSaveChanges = async () => {
    if (!selectedComponent || !projectName || !actor) return;
    setSaving(true);
    setSaveStatus(null);
    setSaveError('');
    
    try {
      const res = await fetch(`http://127.0.0.1:8123/api/projects/${projectName}/rsdb/${actor.ID}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: selectedComponent.name,
          fields: editedFields
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to save RSDB patch');
      }
      
      setSaveStatus('success');
      setIsDirty(false);
      
      // Reload actor data so everything is perfectly synced
      fetchActor(actor.ID);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderValue = (val: any, depth = 0): React.ReactNode => {
    if (val === null) return <span className="value-null">null</span>;
    if (typeof val === 'boolean') return <span className="value-bool">{val.toString()}</span>;
    if (typeof val === 'number') return <span className="value-num">{val}</span>;
    if (typeof val === 'string') return <span className="value-str">"{val}"</span>;
    
    if (Array.isArray(val)) {
      if (val.length === 0) return <span className="value-empty">[]</span>;
      return (
        <div className="nested-block">
          {val.map((item, i) => (
            <div key={i} className="array-item">
              <span className="array-index">[{i}]</span>
              {renderValue(item, depth + 1)}
            </div>
          ))}
        </div>
      );
    }
    
    if (typeof val === 'object') {
      const keys = Object.keys(val);
      if (keys.length === 0) return <span className="value-empty">{"{}"}</span>;
      return (
        <div className="nested-block">
          {keys.map((k) => (
            <div key={k} className="object-field">
              <span className="object-key">{k}:</span>
              {renderValue(val[k], depth + 1)}
            </div>
          ))}
        </div>
      );
    }
    return String(val);
  };

  const renderEditableValue = (k: string, val: any) => {
    const currentVal = editedFields[k];
    
    if (typeof val === 'boolean') {
      return (
        <input 
          type="checkbox" 
          checked={currentVal ?? false} 
          onChange={e => handleFieldChange(k, e.target.checked)} 
          style={{ cursor: 'pointer' }}
        />
      );
    }
    
    if (typeof val === 'number' || typeof val === 'string') {
      return (
        <input 
          type="text" 
          value={currentVal ?? ''} 
          onChange={e => {
            const text = e.target.value;
            if (typeof val === 'number') {
              const num = parseFloat(text);
              handleFieldChange(k, isNaN(num) ? text : num);
            } else {
              handleFieldChange(k, text);
            }
          }}
          style={{ 
            width: '100%', 
            background: 'var(--bg-primary)', 
            border: '1px solid var(--border-color)', 
            color: 'var(--text-primary)', 
            fontFamily: 'Fira Code, monospace',
            fontSize: '12px',
            padding: '2px 6px',
            borderRadius: '3px'
          }}
        />
      );
    }

    if (typeof val === 'object' && val !== null) {
      return (
        <input 
          type="text" 
          value={JSON.stringify(currentVal)} 
          onChange={e => {
            try {
              const parsed = JSON.parse(e.target.value);
              handleFieldChange(k, parsed);
            } catch (err) {}
          }}
          style={{ 
            width: '100%', 
            background: 'var(--bg-primary)', 
            border: '1px solid var(--border-color)', 
            color: 'var(--val-key)', 
            fontFamily: 'Fira Code, monospace',
            fontSize: '11px',
            padding: '2px 6px',
            borderRadius: '3px'
          }}
        />
      );
    }

    return renderValue(val);
  };

  if (loading && !actor) {
    return (
      <div className="actor-viewer-empty">
        <div className="empty-state">Loading actor data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="actor-viewer-empty">
        <div className="error-banner">
          <p>Error loading actor "{activeActorId}": {error}</p>
          <p style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Make sure the RowID exists in the game files or has been cloned into this workspace.
          </p>
        </div>
      </div>
    );
  }

  if (!actor) {
    return (
      <div className="actor-viewer-empty">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>No actor loaded. Load an actor using the search bar above.</p>
      </div>
    );
  }

  return (
    <div className="actor-viewer-layout" style={{ height: '100%' }}>
      {/* 1. Component Outliner Pane (Middle-Left) */}
      <div className="component-outliner">
        <div className="ide-panel-header" style={{ padding: '0 8px' }}>
          <span>Hierarchy Outliner</span>
        </div>

        <input 
          type="text"
          className="comp-search-box"
          placeholder="Filter components..."
          value={componentQuery}
          onChange={e => setComponentQuery(e.target.value)}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 10px 8px', borderBottom: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input type="checkbox" checked={showInherited} onChange={e => setShowInherited(e.target.checked)} />
            Show Inherited
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input type="checkbox" checked={showParentRefs} onChange={e => setShowParentRefs(e.target.checked)} />
            Show Parent Refs
          </label>
        </div>

        {/* Tree of Components grouped by folder */}
        <div className="component-outliner-list">
          {(() => {
            const filteredComps = actor.components.filter(c => {
              if (c.isParentRef && !showParentRefs) return false;
              if (!c.isNative && !c.isParentRef && !showInherited) return false;
              if (componentQuery.trim() && !c.name.toLowerCase().includes(componentQuery.toLowerCase())) return false;
              return true;
            });

            const folderMap: Record<string, ComponentData[]> = {};
            filteredComps.forEach(c => {
              const f = c.folder || "Root";
              if (!folderMap[f]) folderMap[f] = [];
              folderMap[f].push(c);
            });

            const folders = Object.keys(folderMap).sort();

            return folders.map(folder => {
              const isCollapsed = collapsedFolders[folder] || false;
              return (
                <div key={folder} className="folder-group">
                  <div 
                    className="folder-header"
                    onClick={() => toggleFolder(folder)}
                  >
                    <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
                    {folder}
                  </div>
                  {!isCollapsed && (
                    <ul className="component-list">
                      {folderMap[folder].sort((a,b) => a.name.localeCompare(b.name)).map((comp) => (
                        <li 
                          key={comp.name + comp.isParentRef} 
                          className={`component-item ${selectedComponent === comp ? 'active' : ''} ${comp.isParentRef ? 'parent-ref' : ''} ${!comp.isNative && !comp.isParentRef ? 'inherited' : ''}`}
                          onClick={() => setSelectedComponent(comp)}
                        >
                          {comp.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            });
          })()}

          {/* RSDB Tables Section */}
          {(() => {
            const isCollapsed = collapsedFolders['rsdb'] || false;
            const filteredRsdb = actor.rsdb.filter(t => 
              !componentQuery.trim() || t.name.toLowerCase().includes(componentQuery.toLowerCase())
            );

            if (filteredRsdb.length === 0 && componentQuery.trim()) return null;

            return (
              <div className="folder-group">
                <div 
                  className="folder-header"
                  onClick={() => toggleFolder('rsdb')}
                >
                  <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
                  RSDB Tables
                </div>
                {!isCollapsed && (
                  <ul className="component-list">
                    {filteredRsdb.map((table) => (
                      <li 
                        key={table.name} 
                        className={`component-item ${selectedComponent?.name === table.name ? 'active' : ''}`}
                        onClick={() => setSelectedComponent({
                          name: table.name,
                          fields: table.fields,
                          isNative: true,
                          isParentRef: false,
                          isRsdb: true
                        } as any)}
                      >
                        {table.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* 2. Right Workspace: Property Inspector Grid */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedComponent ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Inspector Top Summary */}
            <div className="inspector-title">
              <h2>
                {selectedComponent.name} 
                <span className="actor-category-badge" style={{ marginLeft: '8px', fontSize: '9px', padding: '1px 4px' }}>
                  {(selectedComponent as any).isRsdb ? "RSDB Table" : (selectedComponent.isParentRef ? "Parent Ref" : (!selectedComponent.isNative ? "Inherited" : "Native"))}
                </span>
              </h2>
              
              {/* Save Button for RSDB Tables */}
              {(selectedComponent as any).isRsdb && (
                <button 
                  className="btn-primary" 
                  disabled={saving || !isDirty} 
                  onClick={handleSaveChanges}
                  style={{ height: '22px', padding: '0 10px', fontSize: '11px' }}
                >
                  {saving ? 'Saving...' : isDirty ? 'Save Table Patch' : 'Saved'}
                </button>
              )}
            </div>

            {/* Save Status Banners */}
            {saveStatus === 'success' && (
              <div className="cloner-success" style={{ margin: '6px 12px 0 12px', padding: '4px 8px', fontSize: '11.5px' }}>
                Successfully saved RSDB patch!
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="cloner-error" style={{ margin: '6px 12px 0 12px', padding: '4px 8px', fontSize: '11.5px' }}>
                Error: {saveError}
              </div>
            )}

            {/* Component Docs / Information */}
            {selectedComponent.info && selectedComponent.info.Description && (
              <div className="component-info">
                <div className="component-info-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                  </svg>
                </div>
                <div className="component-info-text">
                  {selectedComponent.info.Description.split('\n').map((line: string, i: number) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Property Fields Grid */}
            <div style={{ flex: 1, overflowY: 'auto' }} className="inspector-fields">
              {Object.keys(selectedComponent.fields).length === 0 ? (
                <p className="no-fields">No fields found in this component.</p>
              ) : (
                Object.keys(selectedComponent.fields).sort().map((k) => (
                  <div className="field-row" key={k}>
                    <div className="field-label" title={k}>{k}</div>
                    <div className="field-value">
                      {(selectedComponent as any).isRsdb 
                        ? renderEditableValue(k, selectedComponent.fields[k])
                        : renderValue(selectedComponent.fields[k])
                      }
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="actor-viewer-empty">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l-7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <p style={{ fontSize: '12px' }}>Select a component or table in the hierarchy outliner to view its properties.</p>
          </div>
        )}
      </section>
    </div>
  );
};
