"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // The preview/HMR harness can emit "unhandled promise rejection" events with
    // no reason (empty rejections) that surface in the error panel but originate
    // outside app code. Swallow only those; re-log any rejection with a real reason.
    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason
      const isEmpty =
        reason == null ||
        (typeof reason === "object" && Object.keys(reason).length === 0 && !(reason instanceof Error))
      if (isEmpty) {
        event.preventDefault()
        return
      }
      console.error("[v0] Unhandled rejection:", reason)
    }
    window.addEventListener("unhandledrejection", onRejection)
    return () => window.removeEventListener("unhandledrejection", onRejection)
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div
        className={cn(
          "hidden shrink-0 lg:block",
          collapsed ? "lg:w-0 lg:overflow-hidden" : "lg:w-72",
        )}
      >
        <div className="fixed inset-y-0 left-0 w-72">
          <Sidebar />
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onMenu={() =>
            typeof window !== "undefined" && window.innerWidth < 1024
              ? setMobileOpen(true)
              : setCollapsed((c) => !c)
          }
        />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
