import { useState, useEffect } from 'react'
import './App.css'

interface ComponentData {
  name: string
  folder?: string
  isNative?: boolean
  isParentRef?: boolean
  fields: Record<string, any>
}

interface ActorData {
  ID: string
  category: string
  components: ComponentData[]
  rsdb: ComponentData[]
}

function App() {
  const [rowId, setRowId] = useState('Enemy_Bokoblin_Junior')
  const [actor, setActor] = useState<ActorData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedComponent, setSelectedComponent] = useState<ComponentData | null>(null)
  
  const [showInherited, setShowInherited] = useState(true)
  const [showParentRefs, setShowParentRefs] = useState(false)
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({})

  const toggleFolder = (folder: string) => {
    setCollapsedFolders(prev => ({ ...prev, [folder]: !prev[folder] }))
  }

  const fetchActor = async () => {
    if (!rowId.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`http://127.0.0.1:8123/api/actor/${rowId}`)
      if (!res.ok) {
        throw new Error(`Failed to load actor. Status: ${res.status}`)
      }
      const data: ActorData = await res.json()
      setActor(data)
      if (data.components && data.components.length > 0) {
        setSelectedComponent(data.components[0])
      } else {
        setSelectedComponent(null)
      }
    } catch (err: any) {
      if (err.message.includes('Failed to fetch')) {
        setError('Failed to reach Python server. It might still be starting up. Please try again.')
      } else {
        setError(err.message || 'Unknown error')
      }
      setActor(null)
      setSelectedComponent(null)
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchActor()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      fetchActor()
    }
  }

  const renderValue = (val: any, depth = 0): React.ReactNode => {
    if (val === null || val === undefined) return <span className="value-null">null</span>
    if (typeof val === 'boolean') return <span className="value-bool">{val ? 'true' : 'false'}</span>
    if (typeof val === 'number') return <span className="value-num">{val}</span>
    if (typeof val === 'string') return <span className="value-str">"{val}"</span>

    if (Array.isArray(val)) {
      if (val.length === 0) return <span className="value-empty">[]</span>
      return (
        <div className="nested-block" style={{ paddingLeft: depth === 0 ? 0 : 16 }}>
          {val.map((item, idx) => (
            <div key={idx} className="array-item">
              <span className="array-index">[{idx}]</span> {renderValue(item, depth + 1)}
            </div>
          ))}
        </div>
      )
    }

    if (typeof val === 'object') {
      const keys = Object.keys(val)
      if (keys.length === 0) return <span className="value-empty">{"{}"}</span>
      return (
        <div className="nested-block" style={{ paddingLeft: depth === 0 ? 0 : 16 }}>
          {keys.map((k) => (
            <div key={k} className="object-field">
              <span className="object-key">{k}:</span> {renderValue(val[k], depth + 1)}
            </div>
          ))}
        </div>
      )
    }

    return String(val)
  }

  return (
    <div className="app-container">
      {/* Header Toolbar */}
      <header className="toolbar">
        <div className="logo-area">
          <h1>TK Tools</h1>
        </div>
        <div className="search-area">
          <input
            type="text"
            placeholder="Enter Actor RowID (e.g. Enemy_Bokoblin_Junior)"
            value={rowId}
            onChange={(e) => setRowId(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button onClick={fetchActor} disabled={loading}>
            {loading ? 'Loading...' : 'Load'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {error && (
          <div className="error-banner">
            <p>Error: {error}</p>
          </div>
        )}

        {actor ? (
          <div className="inspector-layout">
            {/* Sidebar: Component List */}
            <aside className="sidebar">
              <div className="sidebar-header">
                <h2>{actor.ID}</h2>
                <span className="badge">{actor.category}</span>
                
                <div className="sidebar-controls">
                  <label className="toggle-label">
                    <input 
                      type="checkbox" 
                      checked={showInherited} 
                      onChange={(e) => setShowInherited(e.target.checked)} 
                    />
                    Show Inherited
                  </label>
                  <label className="toggle-label">
                    <input 
                      type="checkbox" 
                      checked={showParentRefs} 
                      onChange={(e) => setShowParentRefs(e.target.checked)} 
                    />
                    Show Parent Refs
                  </label>
                </div>
              </div>
              
              <div className="sidebar-scroll-area">
                {Object.entries(
                actor.components
                .filter(comp => {
                  if (comp.isParentRef) return showParentRefs;
                  if (!comp.isNative) return showInherited;
                  return true;
                })
                .reduce((acc, comp) => {
                  const folder = comp.folder || 'ROOT'
                  if (!acc[folder]) acc[folder] = []
                  acc[folder].push(comp)
                  return acc
                }, {} as Record<string, ComponentData[]>)
              ).sort(([fA], [fB]) => {
                if (fA === 'Component' && fB !== 'Component') return -1;
                if (fB === 'Component' && fA !== 'Component') return 1;
                return fA.localeCompare(fB);
              }).map(([folder, comps]) => {
                const isCollapsed = collapsedFolders[folder]
                return (
                  <div key={`folder-${folder}`}>
                    <div 
                      className="sidebar-section-title clickable-title"
                      onClick={() => toggleFolder(folder)}
                    >
                      <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
                      {folder.toUpperCase()}
                    </div>
                    {!isCollapsed && (
                      <ul className="component-list">
                        {comps.map((comp) => {
                          let itemClass = 'item-native'
                          if (comp.isParentRef) itemClass = 'item-parent-ref'
                          else if (!comp.isNative) itemClass = 'item-inherited'
                          
                          return (
                            <li
                              key={`${folder}-${comp.name}`}
                              className={`
                                ${selectedComponent?.name === comp.name ? 'active' : ''} 
                                ${itemClass}
                              `}
                              onClick={() => setSelectedComponent(comp)}
                            >
                              {comp.name}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}

              {actor.rsdb && actor.rsdb.length > 0 && (() => {
                const isCollapsed = collapsedFolders['RSDB_TABLES']
                return (
                  <div>
                    <div 
                      className="sidebar-section-title clickable-title"
                      onClick={() => toggleFolder('RSDB_TABLES')}
                    >
                      <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
                      RSDB TABLES
                    </div>
                    {!isCollapsed && (
                      <ul className="component-list">
                        {actor.rsdb.map((table) => (
                          <li
                            key={`rsdb-${table.name}`}
                            className={`${selectedComponent?.name === table.name ? 'active' : ''} item-native`}
                            onClick={() => setSelectedComponent(table)}
                          >
                            {table.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })()}
              </div>
            </aside>

            {/* Inspector Details */}
            <section className="inspector">
              {selectedComponent ? (
                <>
                  <div className="inspector-title">
                    <h3>{selectedComponent.name}</h3>
                  </div>
                  <div className="inspector-fields">
                    {Object.keys(selectedComponent.fields).length === 0 ? (
                      <p className="no-fields">No fields in this component.</p>
                    ) : (
                      Object.keys(selectedComponent.fields).map((k) => (
                        <div className="field-row" key={k}>
                          <div className="field-label">{k}</div>
                          <div className="field-value">{renderValue(selectedComponent.fields[k])}</div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state">Select a component to view properties</div>
              )}
            </section>
          </div>
        ) : (
          !loading && !error && (
            <div className="empty-state">
              <p>Enter an Actor RowID to begin inspecting</p>
            </div>
          )
        )}
      </main>
    </div>
  )
}

export default App
