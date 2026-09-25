import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useStore, useResource } from "@/lib/store";
import { api, download, money } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, ErrorBox, Empty } from "@/components/shared";
import type { Order } from "@/lib/types";
export function Login({ admin = false }: { admin?: boolean }) {
  const { user, refreshSession, refresh } = useStore(),
    [register, setRegister] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    navigate = useNavigate();
  if (user)
    return (
      <Navigate
        to={admin && user.role === "admin" ? "/admin" : "/account"}
        replace
      />
    );
  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <h1 className="mb-8 font-display text-3xl font-bold">
        {admin
          ? "Administrator sign in"
          : register
            ? "Create an account"
            : "Welcome back"}
      </h1>
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            const data = await api(
              "/auth/" + (register ? "register" : "login"),
              "POST",
              {
                email: f.get("email"),
                password: f.get("password"),
                ...(register ? { name: f.get("name") } : {}),
              },
            );
            await refreshSession();
            await refresh();
            navigate(
              data.user.role === "admin" && admin ? "/admin" : "/account",
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {register && (
          <Field label="Full name">
            <input
              className="field"
              name="name"
              minLength={2}
              maxLength={200}
              autoComplete="name"
              required
            />
          </Field>
        )}
        <Field label="Email">
          <input
            className="field"
            type="email"
            name="email"
            autoComplete="email"
            required
          />
        </Field>
        <Field
          label="Password"
          hint={register ? "Use at least 12 characters." : undefined}
        >
          <input
            className="field"
            type="password"
            name="password"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={register ? 12 : 1}
            maxLength={128}
            required
          />
        </Field>
        <ErrorBox error={error} />
        <Button className="w-full" size="shop" variant="shop" disabled={busy}>
          {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
        </Button>
      </form>
      {!admin && (
        <button
          className="mt-6 text-sm underline"
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
      )}
      <Link to="/" className="mt-6 block text-sm">
        ← Back to store
      </Link>
    </main>
  );
}
export function Account() {
  const { user, logout, notice } = useStore(),
    { data: orders, error } = useResource<Order[]>("/orders"),
    [formError, setFormError] = useState(""),
    navigate = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <div className="mb-8 flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">
            Hello, {user.name}
          </h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex gap-3">
          {user.role === "admin" && (
            <Link className="action" to="/admin">
              Admin panel
            </Link>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              await logout();
              navigate("/");
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
      <h2 className="mb-5 text-xl font-bold">Your orders</h2>
      <ErrorBox error={error} />
      <div className="space-y-3">
        {orders?.map((o) => (
          <Link
            to={"/order-success/" + o.id}
            key={o.id}
            className="flex flex-wrap justify-between gap-3 rounded-xl border bg-card p-5"
          >
            <div>
              <strong>{o.number}</strong>
              <p className="text-sm text-muted-foreground">{o.createdAt}</p>
            </div>
            <span>{o.status}</span>
            <strong>{money(o.total)}</strong>
          </Link>
        ))}
        {!orders?.length && <Empty>No orders yet.</Empty>}
      </div>
      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-xl font-bold">Security</h2>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                form = e.currentTarget;
              try {
                await api("/auth/password", "POST", Object.fromEntries(f));
                form.reset();
                notice(
                  "Password updated. Other sessions have been signed out.",
                );
              } catch (e) {
                setFormError((e as Error).message);
              }
            }}
          >
            <Field label="Current password">
              <input
                className="field"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field label="New password">
              <input
                className="field"
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
              />
            </Field>
            <ErrorBox error={formError} />
            <Button>Change password</Button>
          </form>
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-xl font-bold">Your information</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Export your account and orders, or send a deletion request to the
            store.
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                download(
                  "my-account.json",
                  JSON.stringify(await api("/account/export"), null, 2),
                  "application/json",
                );
              } catch (e) {
                notice((e as Error).message);
              }
            }}
          >
            Download my data
          </Button>
          <Button
            className="mt-3"
            variant="outline"
            onClick={async () => {
              try {
                await api("/privacy-requests", "POST", { type: "deletion" });
                notice(
                  "Deletion request submitted. The store will review retained order records.",
                );
              } catch (e) {
                notice((e as Error).message);
              }
            }}
          >
            Request data deletion
          </Button>
        </section>
      </div>
    </main>
  );
}
export function Policy() {
  const { kind } = useParams(),
    { catalog } = useStore(),
    s = catalog.settings;
  const text =
    kind === "privacy"
      ? s.privacyPolicy
      : kind === "returns"
        ? s.returnPolicy
        : kind === "delivery"
          ? s.deliveryPolicy
          : kind === "contact"
            ? `${s.name}\n${s.address}\n${s.phone}\n${s.supportEmail}`
            : "Page not found";
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="mb-8 font-display text-4xl font-bold capitalize">
        {kind}
      </h1>
      <p className="whitespace-pre-line leading-8">{text}</p>
    </main>
  );
}
