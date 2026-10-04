"use client"

import { Bell, Menu, Search, ShoppingCart } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur md:px-6">
      <button
        onClick={onMenu}
        className="grid size-10 place-items-center rounded-xl bg-card text-foreground shadow-sm lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      <button
        onClick={onMenu}
        className="hidden size-10 place-items-center rounded-xl bg-card text-foreground shadow-sm lg:grid"
        aria-label="Toggle menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="relative flex-1 max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search"
          className="h-11 rounded-full border-transparent bg-card pl-11 shadow-sm focus-visible:ring-2"
          aria-label="Search"
        />
      </div>

      <div className="ml-auto flex items-center gap-2 md:gap-3">
        <span className="hidden size-10 place-items-center rounded-full bg-card text-lg shadow-sm sm:grid" aria-hidden>
          🇬🇧
        </span>
        <button className="relative grid size-10 place-items-center rounded-full bg-card text-foreground shadow-sm" aria-label="Cart">
          <ShoppingCart className="size-5" />
          <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            3
          </span>
        </button>
        <button className="grid size-10 place-items-center rounded-full bg-card text-foreground shadow-sm" aria-label="Notifications">
          <Bell className="size-5" />
        </button>
        <Avatar className="size-10 ring-2 ring-card">
          <AvatarImage src="/admin-avatar.png" alt="Mathew Anderson" />
          <AvatarFallback>MA</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
