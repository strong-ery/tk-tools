import { useState } from 'react'
import { HomeView } from './views/HomeView'
import { ProjectView } from './views/ProjectView'
import './App.css'

function App() {
  const [currentView, setCurrentView] = useState<'home' | 'project'>('home')
  const [activeProject, setActiveProject] = useState<string | null>(null)

  const handleOpenProject = (projectName: string) => {
    setActiveProject(projectName)
    setCurrentView('project')
  }

  const handleGoHome = () => {
    setActiveProject(null)
    setCurrentView('home')
  }

  return (
    <>
      {currentView === 'home' && (
        <HomeView onOpenProject={handleOpenProject} />
      )}
      
      {currentView === 'project' && activeProject && (
        <ProjectView 
          projectName={activeProject} 
          onGoHome={handleGoHome} 
        />
      )}
    </>
  )
}

export default App
