import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileNav } from './MobileNav'
import { Toaster } from 'sonner'

export function AppLayout() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopBar />

        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6"
          id="main-content"
          tabIndex={-1}
        >
          <div className="mx-auto max-w-7xl animate-fade-in">
            <Outlet />
          </div>
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
