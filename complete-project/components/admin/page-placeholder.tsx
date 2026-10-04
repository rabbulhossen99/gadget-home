import { AdminShell } from "@/components/admin/admin-shell"
import { Card } from "@/components/ui/card"
import { Construction } from "lucide-react"

export function PagePlaceholder({ title, desc }: { title: string; desc: string }) {
  return (
    <AdminShell>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      <Card className="grid place-items-center gap-3 p-16 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Construction className="size-7" />
        </span>
        <p className="text-lg font-semibold text-foreground">{title} coming soon</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          This section is part of the eMart admin panel and is ready to be built out next.
        </p>
      </Card>
    </AdminShell>
  )
}
