import { Component, type ReactNode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Link,
  Navigate,
} from "react-router-dom";
import { StoreProvider, useStore } from "./lib/store";
import { StoreLayout } from "./components/shared";
import { Home, Shop } from "./pages/Home";
import { Product } from "./pages/Product";
import { Cart, Checkout, OrderSuccess, Track } from "./pages/Checkout";
import { Account, Login, Policy } from "./pages/Account";
import { AdminLayout } from "./admin/AdminLayout";
import { Products } from "./admin/Products";
import { Orders, Incomplete } from "./admin/Orders";
import { Content } from "./admin/Content";
import { Dashboard, Customers, Reviews, Privacy } from "./admin/Dashboard";
import "./styles.css";
import "@fontsource-variable/fredoka";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/noto-sans-bengali";
class Boundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="p-12">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <button className="action mt-5" onClick={() => location.reload()}>
          Reload the page
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function Scroll() {
  const { catalog } = useStore();
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      setTimeout(
        () => document.getElementById(hash.slice(1))?.scrollIntoView(),
        50,
      );
    } else window.scrollTo(0, 0);
  }, [pathname, hash]);
  useEffect(() => {
    const product = catalog.products.find(
      (p) => pathname === "/product/" + p.slug,
    );
    document.title = `${pathname.startsWith("/admin") ? "Admin · " : product ? product.name + " · " : ""}${catalog.settings.name}`;
  }, [pathname, hash, catalog.settings.name, catalog.products]);
  return null;
}
createRoot(document.getElementById("root")!).render(
  <Boundary>
    <BrowserRouter>
      <StoreProvider>
        <Scroll />
        <Routes>
          <Route element={<StoreLayout />}>
            <Route index element={<Home />} />
            <Route path="shop" element={<Shop />} />
            <Route path="category/:slug" element={<Shop />} />
            <Route path="product/:slug" element={<Product />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="order-success/:id" element={<OrderSuccess />} />
            <Route path="track" element={<Track />} />
            <Route path="account" element={<Account />} />
            <Route path="login" element={<Login />} />
            <Route path="policy/:kind" element={<Policy />} />
          </Route>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="orders" element={<Orders />} />
            <Route
              path="sales"
              element={<Navigate to="/admin/orders" replace />}
            />
            <Route
              path="product"
              element={<Navigate to="/admin/products" replace />}
            />
            <Route
              path="promotions"
              element={<Navigate to="/admin/coupons" replace />}
            />
            {[
              "categories",
              "sections",
              "combos",
              "coupons",
              "campaigns",
              "settings",
            ].map((kind) => (
              <Route
                key={kind}
                path={kind}
                element={<Content key={kind} kind={kind} />}
              />
            ))}
            <Route path="customers" element={<Customers />} />
            <Route path="incomplete" element={<Incomplete />} />
            <Route path="analytics" element={<Dashboard mode="analytics" />} />
            <Route path="reports" element={<Dashboard mode="reports" />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="privacy" element={<Privacy />} />
          </Route>
          <Route
            path="*"
            element={
              <main className="p-12 text-center">
                <h1 className="text-3xl font-bold">Page not found</h1>
                <Link className="mt-6 inline-block underline" to="/">
                  Return to the store
                </Link>
              </main>
            }
          />
        </Routes>
      </StoreProvider>
    </BrowserRouter>
  </Boundary>,
);
