import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  LayoutDashboard,
  Tag,
  Package,
  Percent,
  PieChart,
  Shield,
  Settings,
  Truck,
  LogOut,
  X,
  Menu,
  Users,
  Layers,
  Image,
  ShoppingCart,
  MessageSquare,
  Clock,
  ExternalLink,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Login } from "@/pages/Account";
import { AdminNotifications } from "./Notifications";
const nav = [
  ["Dashboard", "/admin", LayoutDashboard],
  ["Orders & sales", "/admin/orders", Tag],
  ["Products", "/admin/products", Package],
  ["Categories", "/admin/categories", Layers],
  ["Homepage & banners", "/admin/sections", Image],
  ["Combo offers", "/admin/combos", ShoppingCart],
  ["Coupons", "/admin/coupons", Percent],
  ["Campaigns", "/admin/campaigns", PieChart],
  ["Customers", "/admin/customers", Users],
  ["Incomplete orders", "/admin/incomplete", Clock],
  ["Reviews", "/admin/reviews", MessageSquare],
  ["Analytics", "/admin/analytics", PieChart],
  ["Reports", "/admin/reports", BarChart3],
  ["Privacy", "/admin/privacy", Shield],
  ["Settings", "/admin/settings", Settings],
  ["Courier API", "/admin/couriers", Truck],
  ["Tracking & Conversion", "/admin/tracking", BarChart3],
] as const;
export function AdminLayout() {
  const { user, logout, catalog } = useStore(),
    [open, setOpen] = useState(false),
    [collapsed, setCollapsed] = useState(false),
    navigate = useNavigate();
  if (!user)
    return (
      <div className="admin-theme min-h-screen bg-background">
        <Login admin />
      </div>
    );
  if (user.role !== "admin")
    return (
      <main className="mx-auto max-w-lg p-12">
        <h1 className="text-2xl font-bold">Administrator access required</h1>
        <p className="my-5">Your current account is a customer account.</p>
        <button className="action" onClick={() => logout()}>
          Sign out
        </button>
        <Link className="ml-5 underline" to="/">
          Store home
        </Link>
      </main>
    );
  const sidebar = (
    <aside className="flex h-full w-72 flex-col bg-sidebar px-5 py-6">
      <div className="flex items-center justify-between px-2">
        <Link to="/admin" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-primary to-sky-400">
            <span className="size-4 rounded-full bg-sidebar" />
          </span>
          <span className="text-2xl font-bold tracking-tight text-white">
            {catalog.settings.name}
          </span>
        </Link>
        <button
          className="text-white lg:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
      </div>
      <nav className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto">
        <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Admin tools
        </p>
        {nav.map(([label, href, Icon]) => (
          <NavLink
            key={href}
            to={href}
            end={href === "/admin"}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${isActive ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" : "text-sidebar-foreground/80 hover:bg-sidebar-accent"}`
            }
          >
            <Icon size={19} />
            {label}
          </NavLink>
        ))}
      </nav>
      <button
        className="mt-4 flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-sidebar-foreground"
        onClick={async () => {
          await logout();
          navigate("/");
        }}
      >
        <LogOut size={19} />
        Log out
      </button>
    </aside>
  );
  return (
    <div className="admin-theme flex min-h-screen bg-background text-foreground">
      {!collapsed && (
        <div className="hidden w-72 shrink-0 lg:block">
          <div className="fixed inset-y-0 left-0">{sidebar}</div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu overlay"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0">{sidebar}</div>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/90 px-4 py-4 backdrop-blur md:px-6">
          <button
            className="grid size-10 place-items-center rounded-xl bg-card"
            aria-label="Toggle admin navigation"
            onClick={() =>
              window.innerWidth < 1024
                ? setOpen(!open)
                : setCollapsed(!collapsed)
            }
          >
            <Menu size={20} />
          </button>
          <form
            className="hidden max-w-xl flex-1 sm:block"
            onSubmit={(e) => {
              e.preventDefault();
              const query = String(
                new FormData(e.currentTarget).get("q") || "",
              );
              navigate("/admin/orders?q=" + encodeURIComponent(query));
            }}
          >
            <input
              className="field rounded-full border-transparent"
              aria-label="Search orders"
              placeholder="Search orders, customers or phone…"
              name="q"
            />
          </form>
          <Link to="/" className="ml-auto flex items-center gap-2 text-sm">
            <ExternalLink size={16} />
            View store
          </Link>
          <AdminNotifications />
          <span className="hidden text-sm md:inline">{user.name}</span>
          <span className="grid size-10 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {user.name.slice(0, 2).toUpperCase()}
          </span>
        </header>
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
