import { AdminShell } from "@/components/admin/admin-shell"
import { SettingsContent } from "@/components/settings/settings-content"

export default function SettingsPage() {
  return (
    <AdminShell>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Store and account configuration.</p>
      </div>
      <SettingsContent />
    </AdminShell>
  )
}
