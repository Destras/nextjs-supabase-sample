'use client'

import { Suspense } from 'react'
import { useVideosTabViewModel } from './controllers'
import { VideosView } from './VideosView'

function VideosContent() {
  const vm = useVideosTabViewModel()
  return <VideosView {...vm} />
}

export default function VideosPage() {
  return (
    <Suspense fallback={null}>
      <VideosContent />
    </Suspense>
  )
}
