"use client"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger
} from "@/components/ui/sidebar"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import { AppSidebar } from "./app-sidebar"
import { useCreditSync } from "@/lib/sync-credits"
import { useAuth } from "@clerk/nextjs"
import { useRealTimeSync } from "@/lib/realtime/sync"
import { useSessionStore } from "@/lib/store/session-store"
import { useCreditsStore } from "@/lib/store/credits-store"
import { useJobsStore } from "@/lib/store/jobs-store"
import { useAppStore } from "@/lib/store/app-store"
import { clearAllUserData, setupAuthListeners } from "@/lib/store/middleware/auth-aware-persistence"

export default function DashboardClientLayout({
  children,
  userData
}: {
  children: React.ReactNode
  userData: {
    name: string
    email: string
    avatar: string
    membership: string
  }
}) {
  const pathname = usePathname()
  const { startPeriodicSync, stopPeriodicSync, forceSyncNow } = useCreditSync()
  const { isSignedIn, userId } = useAuth()
  const realTimeSync = useRealTimeSync()

  // Store reset functions
  const resetSession = useSessionStore((state) => state.resetAll)
  const resetCredits = useCreditsStore((state) => state.reset)
  const resetJobs = useJobsStore((state) => state.reset)
  const resetApp = useAppStore((state) => state.reset)
  
  // Track previous user ID to detect changes
  const previousUserIdRef = useRef<string | null>(null)

  // Setup auth listeners once
  useEffect(() => {
    setupAuthListeners()
  }, [])

  // Handle user authentication changes and cleanup
  useEffect(() => {
    const currentUserId = userId || null
    const previousUserId = previousUserIdRef.current

    console.log('🔄 [Layout] Auth state:', { 
      isSignedIn, 
      currentUserId, 
      previousUserId 
    })

    // User switching detection
    if (previousUserId && currentUserId && previousUserId !== currentUserId) {
      console.log('🔄 [Layout] User switch detected:', { 
        from: previousUserId, 
        to: currentUserId 
      })
      
      // Clear all stores and localStorage
      resetSession()
      resetCredits()
      resetJobs()
      resetApp()
      clearAllUserData()
      
      // Force page reload to ensure clean state
      setTimeout(() => {
        window.location.reload()
      }, 100)
      
      return
    }

    // User signed out
    if (previousUserId && !currentUserId) {
      console.log('🛑 [Layout] User signed out, clearing all data')
      
      resetSession()
      resetCredits()
      resetJobs()
      resetApp()
      clearAllUserData()
      
      stopPeriodicSync()
      realTimeSync.stop()
    }

    // User signed in (first time or after sign out)
    if (!previousUserId && currentUserId && isSignedIn) {
      console.log('🚀 [Layout] User signed in, starting all sync processes.')
      
      // Start sync processes
      startPeriodicSync()
      realTimeSync.start()
    }

    // Update tracking
    previousUserIdRef.current = currentUserId

    // Cleanup function for component unmount
    return () => {
      if (!isSignedIn) {
      stopPeriodicSync()
      realTimeSync.stop()
    }
    }
  }, [isSignedIn, userId, startPeriodicSync, stopPeriodicSync, realTimeSync, resetSession, resetCredits, resetJobs, resetApp])

  // Read the sidebar state from cookie on initial load
  const getCookieValue = (name: string) => {
    if (typeof document === "undefined") return null
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop()?.split(";").shift()
    return null
  }

  const savedState = getCookieValue("sidebar_state")
  const defaultOpen = savedState === null ? true : savedState === "true"

  const getBreadcrumbs = () => {
    const paths = pathname.split("/").filter(Boolean)
    const breadcrumbs = []

    if (paths[0] === "dashboard") {
      breadcrumbs.push({ name: "Dashboard", href: "/dashboard" })

      if (paths[1]) {
        const pageName = paths[1].charAt(0).toUpperCase() + paths[1].slice(1)

        if (paths[1] === "tracks" && paths[2]) {
          // Add Tracks breadcrumb
          breadcrumbs.push({ name: "Tracks", href: "/dashboard/tracks" })

          // Add specific track breadcrumb
          // For now, we'll use a placeholder. In a real app, you'd fetch the track name
          const trackNames: Record<string, string> = {
            "ai-engineer": "AI Engineer Track",
            "full-stack": "Full Stack Developer Track",
            "data-scientist": "Data Scientist Track"
          }
          const trackName = trackNames[paths[2]] || "Track Details"
          breadcrumbs.push({ name: trackName, href: pathname, current: true })
        } else if (paths[1] === "courses") {
          breadcrumbs.push({ name: "Courses", href: "/dashboard/courses" })

          // Handle course detail pages
          if (paths[2]) {
            // Format course slug to readable name
            const courseName = paths[2]
              .split("-")
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")

            // Check if we're on a section or lesson page
            if (paths[3]) {
              // Add course breadcrumb
              breadcrumbs.push({
                name: courseName,
                href: `/dashboard/courses/${paths[2]}`
              })

              // Add section name (formatted from slug)
              const sectionName = paths[3]
                .split("-")
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ")

              if (paths[4]) {
                // We're on a lesson page
                breadcrumbs.push({
                  name: sectionName,
                  href: `/dashboard/courses/${paths[2]}/${paths[3]}`
                })

                // Add lesson name (formatted from slug)
                const lessonName = paths[4]
                  .split("-")
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" ")
                breadcrumbs.push({
                  name: lessonName,
                  href: pathname,
                  current: true
                })
              } else {
                // We're on a section page
                breadcrumbs.push({
                  name: sectionName,
                  href: pathname,
                  current: true
                })
              }
            } else {
              // Just course detail page
              breadcrumbs.push({
                name: courseName,
                href: pathname,
                current: true
              })
            }
          }
        } else {
          breadcrumbs.push({ name: pageName, href: pathname, current: true })
        }
      }
    }

    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar userData={userData} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            {breadcrumbs.length > 0 && (
              <Breadcrumb>
                <BreadcrumbList>
                  {breadcrumbs.map((crumb, index) => (
                    <div
                      key={`${crumb.href}-${index}`}
                      className="flex items-center"
                    >
                      {index > 0 && <BreadcrumbSeparator className="mx-2" />}
                      <BreadcrumbItem>
                        {crumb.current ? (
                          <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink href={crumb.href}>
                            {crumb.name}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </div>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            )}
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
