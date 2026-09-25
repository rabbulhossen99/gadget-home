import { AdminShell } from "@/components/admin/admin-shell"
import { WelcomeCard } from "@/components/dashboard/welcome-card"
import { StatCards } from "@/components/dashboard/stat-cards"
import { RevenueUpdates } from "@/components/dashboard/revenue-updates"
import { SalesOverview } from "@/components/dashboard/sales-overview"
import { MonthlyEarnings } from "@/components/dashboard/monthly-earnings"
import { WeeklyStats } from "@/components/dashboard/weekly-stats"
import { YearlySales } from "@/components/dashboard/yearly-sales"
import { PaymentGateways } from "@/components/dashboard/payment-gateways"

export default function DashboardPage() {
  return (
    <AdminShell>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <WelcomeCard />
        </div>
        <div className="xl:col-span-1">
          <StatCards />
        </div>

        <RevenueUpdates />
        <SalesOverview />
        <div className="flex flex-col gap-4">
          <MonthlyEarnings />
        </div>

        <WeeklyStats />
        <YearlySales />
        <PaymentGateways />
      </div>
    </AdminShell>
  )
}
