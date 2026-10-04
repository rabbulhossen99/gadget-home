import { AdminShell } from "@/components/admin/admin-shell"
import { AnalyticsContent } from "@/components/analytics/analytics-content"

export default function AnalyticsPage() {
  return (
    <AdminShell>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">Performance and Meta Pixel insights.</p>
      </div>
      <AnalyticsContent />
    </AdminShell>
  )
}
