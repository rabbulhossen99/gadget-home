import { CreditCard, Wallet, Landmark, Banknote } from "lucide-react"
import { Card } from "@/components/ui/card"

const gateways = [
  { name: "PayPal", note: "Big Brands", amount: "+$7,852", icon: Landmark, tone: "bg-sky-500/10 text-sky-500" },
  { name: "Wallet", note: "Bill payment", amount: "+$325", icon: Wallet, tone: "bg-primary/10 text-primary" },
  { name: "Credit card", note: "Money reversed", amount: "+$3,546", icon: CreditCard, tone: "bg-amber-500/10 text-amber-500" },
  { name: "Bank", note: "Bank transfer", amount: "+$1,230", icon: Banknote, tone: "bg-emerald-500/10 text-emerald-500" },
]

export function PaymentGateways() {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold text-foreground">Payment Gateways</h3>
      <p className="text-sm text-muted-foreground">Platform for income</p>

      <div className="mt-4 space-y-4">
        {gateways.map((g) => {
          const Icon = g.icon
          return (
            <div key={g.name} className="flex items-center gap-3">
              <span className={`grid size-10 place-items-center rounded-xl ${g.tone}`}>
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{g.name}</p>
                <p className="truncate text-xs text-muted-foreground">{g.note}</p>
              </div>
              <span className="text-sm font-semibold text-emerald-500">{g.amount}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
