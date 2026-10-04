import {
  LayoutDashboard,
  Tag,
  Package,
  Percent,
  PieChart,
  BarChart3,
  Shield,
  Settings,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

export const adminTools: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Sales", href: "/sales", icon: Tag },
  { label: "Product", href: "/product", icon: Package },
  { label: "Promotions", href: "/promotions", icon: Percent },
  { label: "Analytics", href: "/analytics", icon: PieChart },
  { label: "Reports", href: "/reports", icon: BarChart3 },
]

export const configuration: NavItem[] = [
  { label: "Privacy", href: "/privacy", icon: Shield },
  { label: "Settings", href: "/settings", icon: Settings },
]
