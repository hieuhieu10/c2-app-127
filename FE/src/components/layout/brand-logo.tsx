'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'

export function BrandLogo() {
  return (
    <Link
      href="/dashboard"
      className="group inline-flex items-center gap-3 rounded-2xl px-1 py-1 transition hover:-translate-y-0.5 hover:opacity-95"
      aria-label="Về trang Học Mà Chơi"
    >
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#5b7cfa_0%,#4f46e5_48%,#12b8a6_100%)] text-white shadow-[0_10px_22px_rgba(79,70,229,0.2)] ring-1 ring-white/60">
        <Sparkles className="relative h-4 w-4" strokeWidth={2.4} />
      </span>
      <span className="flex flex-col leading-none">
        <span className="bg-[linear-gradient(100deg,#315bbd_0%,#4f46e5_45%,#0f9f8f_100%)] bg-clip-text text-xl font-black tracking-[-0.04em] text-transparent sm:text-2xl">
          Học Mà Chơi
        </span>
        <span className="mt-1 hidden text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400 sm:block">
          Trình tạo trò chơi AI
        </span>
      </span>
    </Link>
  )
}
