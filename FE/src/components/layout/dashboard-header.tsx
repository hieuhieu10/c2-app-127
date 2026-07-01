'use client'

import { BrandLogo } from './brand-logo'

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
        <BrandLogo />
      </div>
    </header>
  )
}
