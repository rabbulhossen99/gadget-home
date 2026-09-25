import { AdminShell } from "@/components/admin/admin-shell"
import { PromotionsContent } from "@/components/promotions/promotions-content"

export default function PromotionsPage() {
  return (
    <AdminShell>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">Promotions</h1>
        <p className="text-sm text-muted-foreground">Manage discount codes and ad campaigns.</p>
      </div>
      <PromotionsContent />
    </AdminShell>
  )
}
