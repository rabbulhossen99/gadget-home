import { AdminShell } from "@/components/admin/admin-shell"
import { SalesContent } from "@/components/sales/sales-content"

export default function SalesPage() {
  return (
    <AdminShell>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">Sales</h1>
        <p className="text-sm text-muted-foreground">Track orders and revenue across your store.</p>
      </div>
      <SalesContent />
    </AdminShell>
  )
}
