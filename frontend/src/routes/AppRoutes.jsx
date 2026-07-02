import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ScrollToTop } from "../components/layout/ScrollToTop";
import { Home } from "../pages/Home";
import { Products } from "../pages/Products";
import { ProductDetails } from "../pages/ProductDetails";
import { Wishlist } from "../pages/Wishlist";
import { Cart } from "../pages/Cart";
import { Checkout } from "../pages/Checkout";
import { OrderSuccess } from "../pages/OrderSuccess";
import { FlutterwaveCallback } from "../pages/FlutterwaveCallback";
import { Account } from "../pages/Account";
import { CompleteProfile } from "../pages/CompleteProfile";
import { Settings } from "../pages/Settings";
import { About } from "../pages/About";
import { Contact } from "../pages/Contact";
import { PrivacyPolicy } from "../pages/PrivacyPolicy";
import { TermsConditions } from "../pages/TermsConditions";
import { Forbidden } from "../pages/Forbidden";
import { NotFound } from "../pages/NotFound";
import { RouteSkeleton } from "../components/layout/RouteSkeleton";

import { AdminLayout } from "../admin/components/AdminLayout";
import { AdminLogin } from "../admin/pages/AdminLogin";
import { AdminDashboard } from "../admin/pages/AdminDashboard";
import { AdminWaitlist } from "../admin/pages/AdminWaitlist";
import { AdminEnquiries } from "../admin/pages/AdminEnquiries";
import { AdminProducts } from "../admin/pages/AdminProducts";
import { AdminProductSales } from "../admin/pages/AdminProductSales";
import { AdminOrders } from "../admin/pages/AdminOrders";
import { AdminContent } from "../admin/pages/AdminContent";
import { AdminSettings } from "../admin/pages/AdminSettings";
import { AdminInventory } from "../admin/pages/AdminInventory";
import { AdminDelivery } from "../admin/pages/AdminDelivery";
import { AdminCustomers } from "../admin/pages/AdminCustomers";
import { AdminAnalytics } from "../admin/pages/AdminAnalytics";
import { AdminGrowth } from "../admin/pages/AdminGrowth";
import { AdminEmailBroadcasts } from "../admin/pages/AdminEmailBroadcasts";
import { AdminAutomations } from "../admin/pages/AdminAutomations";
import { AdminMail } from "../admin/pages/AdminMail";
import { AdminAbandonedCarts } from "../admin/pages/AdminAbandonedCarts";
import { AdminAbandonedCheckouts } from "../admin/pages/AdminAbandonedCheckouts";
import { AdminBackInStock } from "../admin/pages/AdminBackInStock";
import { AdminDiscounts } from "../admin/pages/AdminDiscounts";
import { AdminCurrencyRates } from "../admin/pages/AdminCurrencyRates";
import { GrowthTracker } from "../components/marketing/GrowthTracker";

export function AppRoutes() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <RouteSkeleton />
      <GrowthTracker />

      <Routes>
        {/* Public website routes */}
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:slug" element={<ProductDetails />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-success" element={<OrderSuccess />} />
        <Route path="/order-success/:orderId" element={<OrderSuccess />} />
        <Route path="/payment/flutterwave/callback" element={<FlutterwaveCallback />} />
        <Route path="/account" element={<Account />} />
        <Route path="/login" element={<Account initialMode="signin" />} />
        <Route path="/register" element={<Account initialMode="signup" />} />
        <Route path="/signup" element={<Account initialMode="signup" />} />
        <Route path="/forgot-password" element={<Account initialMode="forgot" />} />
        <Route path="/reset-password" element={<Account initialMode="reset" />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />

        {/* Legal pages */}
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsConditions />} />

        {/* Public admin route is blocked */}
        <Route path="/admin" element={<Forbidden />} />
        <Route path="/admin/*" element={<Forbidden />} />

        {/* Hidden admin login route */}
        <Route path="/luma-control-room/login" element={<AdminLogin />} />

        {/* Hidden admin dashboard routes */}
        <Route path="/luma-control-room" element={<AdminLayout />}>
          <Route
            index
            element={<Navigate to="/luma-control-room/dashboard" replace />}
          />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="waitlist" element={<AdminWaitlist />} />
          <Route path="enquiries" element={<AdminEnquiries />} />
          <Route path="mail" element={<AdminMail />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="product-sales" element={<AdminProductSales />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="delivery" element={<AdminDelivery />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="growth" element={<AdminGrowth />} />
          <Route path="growth-tools" element={<AdminGrowth />} />
          <Route path="email-broadcasts" element={<AdminEmailBroadcasts />} />
          <Route path="automations" element={<AdminAutomations />} />
          <Route path="email-automation" element={<Navigate to="/luma-control-room/abandoned-carts" replace />} />
          <Route path="abandoned-carts" element={<AdminAbandonedCarts />} />
          <Route
            path="abandoned-checkouts"
            element={<AdminAbandonedCheckouts />}
          />
          <Route path="product-waitlists" element={<AdminBackInStock />} />
          <Route path="back-in-stock" element={<AdminBackInStock />} />
          <Route path="discounts" element={<AdminDiscounts />} />
          <Route path="currency-rates" element={<AdminCurrencyRates />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="website-content" element={<AdminContent />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}







