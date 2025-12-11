import React from 'react'
import { Route, Routes } from 'react-router-dom'

import HomePage from './pages/Home'     
import Pricing from './pages/Pricing'
import Projects from './pages/Projects'
import MyProjects from './pages/MyProjects'
import Preview from './pages/preview'
import Community from './pages/community'


import { View } from "lucide-react";
import Navbar from './components/Navbar'

const App = () => {
  return (
    <div>
      <Navbar />
    <Routes>
      <Route path='/' element={<HomePage />} />       {/* ✅ fixed */}
      <Route path='/pricing' element={<Pricing />} />
      <Route path='/projects/:projectId' element={<Projects />} />
      <Route path='/projects' element={<MyProjects />} />
      <Route path='/preview/:projectId' element={<Preview />} />
      <Route path='/preview/:projectId/:versionId' element={<Preview />} />
      <Route path='/community' element={<Community />} />
      <Route path='/view/:projectId' element={<View />} /> {/* icon route? */}
    </Routes>
    </div>
  )
}

export default App
