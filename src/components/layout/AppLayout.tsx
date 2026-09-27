import React, { Suspense, useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileNav } from './MobileNav'
import { Toaster } from 'sonner'
import { useRememberWorkspacePath } from './navigation'
import { PageLoader } from '@/components/ui/Spinner'

export function AppLayout() {
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  useRememberWorkspacePath()

  // <main> is the scroll container, so the browser doesn't reset it between pages;
  // without this a new page opens at the previous page's scroll position.
  useLayoutEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="flex h-screen h-[100dvh] bg-background overflow-hidden">
      {/* 100dvh (with 100vh fallback): mobile address bars would otherwise hide the bottom of the app */}
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopBar />

        {/* Page content */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:p-6"
          id="main-content"
          tabIndex={-1}
        >
          {/* One boundary for every page: with router transitions, the current page stays
              visible while the next one loads instead of flashing a spinner. */}
          {/* The spinner fades in only after 300ms, so a quick load shows nothing at all */}
          <Suspense fallback={<div className="opacity-0 animate-[fade-in_0.2s_ease-out_300ms_forwards]"><PageLoader /></div>}>
            {/* Keyed by path so each page fades in instead of swapping abruptly */}
            <div key={pathname} className="mx-auto max-w-7xl animate-fade-in motion-reduce:animate-none">
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          classNames: {
            toast: 'rounded-xl border border-border shadow-card',
          },
        }}
        richColors
      />
    </div>
  )
}
