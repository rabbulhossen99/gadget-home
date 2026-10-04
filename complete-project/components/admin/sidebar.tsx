"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { adminTools, configuration, type NavItem } from "./nav-items"

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-5 shrink-0" />
      <span>{item.label}</span>
    </Link>
  )
}

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  return (
    <aside className="flex h-full w-72 flex-col bg-sidebar px-5 py-6">
      <div className="flex items-center justify-between px-2">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-primary to-sky-400">
            <span className="size-4 rounded-full bg-sidebar" />
          </span>
          <span className="text-2xl font-bold tracking-tight text-white">eMart</span>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent lg:hidden"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto">
        <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Admin Tools
        </p>
        {adminTools.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}

        <p className="mt-6 px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Configuration
        </p>
        {configuration.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>

      <button className="mt-4 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
        <LogOut className="size-5" />
        <span>Log out</span>
      </button>
    </aside>
  )
}
