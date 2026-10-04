import { AdminShell } from "@/components/admin/admin-shell"
import { ReportsContent } from "@/components/reports/reports-content"

export default function ReportsPage() {
  return (
    <AdminShell>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Generate and download store reports.</p>
      </div>
      <ReportsContent />
    </AdminShell>
  )
}
