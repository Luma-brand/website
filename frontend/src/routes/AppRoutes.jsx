import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ScrollToTop } from "../components/layout/ScrollToTop";
import { Home } from "../pages/Home";
import { Products } from "../pages/Products";
import { ProductDetails } from "../pages/ProductDetails";
import { Wishlist } from "../pages/Wishlist";
import { Cart } from "../pages/Cart";
import { Checkout } from "../pages/Checkout";
import { OrderSuccess } from "../pages/OrderSuccess";
import { Account } from "../pages/Account";
import { Settings } from "../pages/Settings";
import { NotFound } from "../pages/NotFound";
import { RouteSkeleton } from "../components/layout/RouteSkeleton";

import { AdminLayout } from "../admin/components/AdminLayout";
import { AdminLogin } from "../admin/pages/AdminLogin";
import { AdminDashboard } from "../admin/pages/AdminDashboard";
import { AdminWaitlist } from "../admin/pages/AdminWaitlist";
import { AdminEnquiries } from "../admin/pages/AdminEnquiries";
import { AdminProducts } from "../admin/pages/AdminProducts";
import { AdminOrders } from "../admin/pages/AdminOrders";
import { AdminContent } from "../admin/pages/AdminContent";
import { AdminSettings } from "../admin/pages/AdminSettings";

export function AppRoutes() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <RouteSkeleton />

      <Routes>
        {/* Public website routes */}
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:slug" element={<ProductDetails />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-success/:orderId" element={<OrderSuccess />} />
        <Route path="/account" element={<Account />} />
        <Route path="/settings" element={<Settings />} />

        {/* Admin routes */}
        <Route path="/admin/login" element={<AdminLogin />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="waitlist" element={<AdminWaitlist />} />
          <Route path="enquiries" element={<AdminEnquiries />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}