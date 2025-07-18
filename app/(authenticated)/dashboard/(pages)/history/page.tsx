"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, Eye, Calendar, Clock, Image, Wand2, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { type SessionWithGenerations } from '@/lib/store/session-store'
import { STYLE_PRESETS, ROOM_TYPES } from '@/lib/constants'
import { toast } from 'sonner'

export default function SessionHistoryPage() {
  const [sessions, setSessions] = useState<SessionWithGenerations[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<SessionWithGenerations | null>(null)
  const [isCleaningUp, setIsCleaningUp] = useState(false)

  useEffect(() => {
    loadSessionHistory()
  }, [])

  const loadSessionHistory = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/sessions/history')
      
      if (!response.ok) {
        throw new Error('Failed to load session history')
      }
      
      const data = await response.json()
      setSessions(data.sessions || [])
      console.log(`✅ [History Page] Loaded ${data.sessions?.length || 0} sessions`)
      
    } catch (error) {
      console.error('❌ [History Page] Error loading sessions:', error)
      toast.error('Failed to load session history')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadImage = (url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Download started!')
  }

  const handleCleanup = async () => {
    try {
      setIsCleaningUp(true)
      const response = await fetch('/api/sessions/cleanup', {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error('Failed to cleanup old sessions')
      }
      
      const data = await response.json()
      
      if (data.summary) {
        const { summary } = data
        toast.success(
          `Cleanup completed! Removed ${summary.totalGenerationsDeleted} old generations and ${summary.oldSessionsDeleted} old sessions.`
        )
        
        // Reload session history to reflect changes
        loadSessionHistory()
      } else {
        toast.success('Cleanup completed successfully!')
      }
      
    } catch (error) {
      console.error('❌ [History Page] Cleanup error:', error)
      toast.error('Failed to cleanup old sessions')
    } finally {
      setIsCleaningUp(false)
    }
  }

  const getThumbnailUrl = (session: SessionWithGenerations): string => {
    // Priority: staged results > empty room results > original image
    if (session.stagingGenerations.length > 0) {
      const latestStaging = session.stagingGenerations[session.stagingGenerations.length - 1]
      if (latestStaging.outputImageUrls.length > 0) {
        return latestStaging.outputImageUrls[0]
      }
    }
    
    if (session.emptyRoomGenerations.length > 0) {
      const latestEmpty = session.emptyRoomGenerations[session.emptyRoomGenerations.length - 1]
      if (latestEmpty.outputImageUrls.length > 0) {
        return latestEmpty.outputImageUrls[0]
      }
    }
    
    return session.originalImageUrl
  }

  const getSessionStatus = (session: SessionWithGenerations): { label: string; color: string } => {
    const hasCompletedStaging = session.stagingGenerations.some(gen => gen.status === 'completed')
    const hasCompletedEmpty = session.emptyRoomGenerations.some(gen => gen.status === 'completed')
    
    if (hasCompletedStaging) {
      return { label: 'Completed', color: 'bg-green-100 text-green-800' }
    } else if (hasCompletedEmpty) {
      return { label: 'Empty Room Only', color: 'bg-blue-100 text-blue-800' }
    } else {
      return { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' }
    }
  }

  const formatDate = (date: Date | string) => {
    const d = new Date(date)
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Session History</h1>
          <p className="text-muted-foreground">
            View and download your previous virtual staging sessions
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-video">
                <Skeleton className="h-full w-full" />
              </div>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-6xl py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Session History</h1>
          <p className="text-muted-foreground">
            View and download your previous virtual staging sessions
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={loadSessionHistory}>
            <Clock className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            onClick={handleCleanup}
            disabled={isCleaningUp}
          >
            {isCleaningUp ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cleaning...
              </>
            ) : (
              <>
                🧹 Clean Old Data
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Sessions Grid */}
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Image className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Sessions Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start your first virtual staging session to see your history here
            </p>
            <Button onClick={() => window.location.href = '/dashboard'}>
              Create First Session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {sessions.map((session, index) => {
              const thumbnailUrl = getThumbnailUrl(session)
              const status = getSessionStatus(session)
              const totalGenerations = session.emptyRoomGenerations.length + session.stagingGenerations.length
              
              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow group cursor-pointer">
                    {/* Thumbnail */}
                    <div className="aspect-video relative overflow-hidden">
                      <img 
                        src={thumbnailUrl}
                        alt={`Session ${session.id}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      
                      {/* Overlay with actions */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedSession(session)
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {session.stagingGenerations.length > 0 && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation()
                                const latestStaging = session.stagingGenerations[session.stagingGenerations.length - 1]
                                if (latestStaging.outputImageUrls.length > 0) {
                                  handleDownloadImage(
                                    latestStaging.outputImageUrls[0], 
                                    `staging-${session.id}.jpg`
                                  )
                                }
                              }}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {/* Status Badge */}
                      <div className="absolute top-2 right-2">
                        <Badge className={`${status.color} border-0`}>
                          {status.label}
                        </Badge>
                      </div>
                    </div>

                    {/* Content */}
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Date */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4 mr-1" />
                            {formatDate(session.createdAt)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {totalGenerations} generation{totalGenerations !== 1 ? 's' : ''}
                          </div>
                        </div>

                        {/* Session Details */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {session.roomStateChoice === 'already_empty' ? 'Already Empty' : 'Generated Empty'}
                            </Badge>
                            {session.stagingGenerations.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                <Wand2 className="w-3 h-3 mr-1" />
                                Staged
                              </Badge>
                            )}
                          </div>

                          {/* Latest styling info */}
                          {session.stagingGenerations.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {(() => {
                                const latestStaging = session.stagingGenerations[session.stagingGenerations.length - 1]
                                const styleName = STYLE_PRESETS[latestStaging.style as keyof typeof STYLE_PRESETS]?.name || latestStaging.style
                                const roomName = ROOM_TYPES[latestStaging.roomType as keyof typeof ROOM_TYPES] || latestStaging.roomType
                                return `${styleName} • ${roomName}`
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Session Details</h2>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedSession(null)}
                >
                  ✕
                </Button>
              </div>

              <div className="space-y-6">
                {/* Original Image */}
                <div>
                  <h3 className="font-semibold mb-2">Original Image</h3>
                  <img 
                    src={selectedSession.originalImageUrl}
                    alt="Original"
                    className="w-full max-w-md h-48 object-cover rounded-lg border"
                  />
                </div>

                {/* Empty Room Generations */}
                {selectedSession.emptyRoomGenerations.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Empty Room Generations</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedSession.emptyRoomGenerations.map((gen, idx) => (
                        <div key={gen.id} className="space-y-2">
                          <h4 className="text-sm font-medium">Generation #{gen.generationNumber}</h4>
                          {gen.outputImageUrls.map((url, urlIdx) => (
                            <div key={urlIdx} className="relative group">
                              <img 
                                src={url}
                                alt={`Empty room ${idx + 1}.${urlIdx + 1}`}
                                className="w-full h-32 object-cover rounded border"
                              />
                              <Button
                                size="sm"
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"
                                onClick={() => handleDownloadImage(url, `empty-room-${gen.generationNumber}-${urlIdx + 1}.jpg`)}
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Staging Generations */}
                {selectedSession.stagingGenerations.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Staging Generations</h3>
                    <div className="space-y-4">
                      {selectedSession.stagingGenerations.map((gen, idx) => (
                        <div key={gen.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium">Generation #{gen.generationNumber}</h4>
                            <div className="flex space-x-2">
                              <Badge variant="outline">{STYLE_PRESETS[gen.style as keyof typeof STYLE_PRESETS]?.name || gen.style}</Badge>
                              <Badge variant="secondary">{ROOM_TYPES[gen.roomType as keyof typeof ROOM_TYPES] || gen.roomType}</Badge>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {gen.outputImageUrls.map((url, urlIdx) => (
                              <div key={urlIdx} className="relative group">
                                <img 
                                  src={url}
                                  alt={`Staging ${idx + 1}.${urlIdx + 1}`}
                                  className="w-full h-40 object-cover rounded border"
                                />
                                <Button
                                  size="sm"
                                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"
                                  onClick={() => handleDownloadImage(url, `staging-${gen.generationNumber}-${urlIdx + 1}.jpg`)}
                                >
                                  <Download className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 