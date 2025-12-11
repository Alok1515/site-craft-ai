import { Home, View } from 'lucide-react'
import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Pricing from './pages/Pricing'
import Projects from './pages/Projects'
import MyProjects from './pages/MyProjects'
import Preview from './pages/preview'
import Community from './pages/community'

export const App = () => {
  return (
    <div>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/pricing' element={<Pricing />} />
        <Route path='/projects/:projectId' element={<Projects />} />
        <Route path='/projects' element={<MyProjects />} />
        <Route path='/preview/:projectId' element={<Preview />} />
        <Route path='/preview/:projectId/:versionId' element={<Preview />} />
        <Route path='community' element={<Community />} />
        <Route path='/view/:projectId' element={<View />} />
      </Routes>
    </div>
  )
}

export default App
