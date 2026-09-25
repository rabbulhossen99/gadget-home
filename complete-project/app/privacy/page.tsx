import { AdminShell } from "@/components/admin/admin-shell"
import { PrivacyContent } from "@/components/privacy/privacy-content"

export default function PrivacyPage() {
  return (
    <AdminShell>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">Privacy</h1>
        <p className="text-sm text-muted-foreground">Data protection and consent settings.</p>
      </div>
      <PrivacyContent />
    </AdminShell>
  )
}
