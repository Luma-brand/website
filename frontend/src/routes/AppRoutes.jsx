import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ScrollToTop } from "../components/layout/ScrollToTop";
import { RouteSkeleton } from "../components/layout/RouteSkeleton";
import { PageSkeleton } from "../components/layout/PageSkeleton";
import { GrowthTracker } from "../components/marketing/GrowthTracker";
import { RouteIndexingGuard } from "../components/seo/RouteIndexingGuard";

function lazyNamed(loader, exportName) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] })));
}

const Home = lazyNamed(() => import("../pages/Home"), "Home");
const Products = lazyNamed(() => import("../pages/Products"), "Products");
const ProductDetails = lazyNamed(() => import("../pages/ProductDetails"), "ProductDetails");
const Wishlist = lazyNamed(() => import("../pages/Wishlist"), "Wishlist");
const Cart = lazyNamed(() => import("../pages/Cart"), "Cart");
const Checkout = lazyNamed(() => import("../pages/CheckoutPaystack"), "Checkout");
const OrderSuccess = lazyNamed(() => import("../pages/OrderSuccess"), "OrderSuccess");
const PaystackCallback = lazyNamed(() => import("../pages/PaystackCallback"), "PaystackCallback");
const Account = lazyNamed(() => import("../pages/Account"), "Account");
const CompleteProfile = lazyNamed(() => import("../pages/CompleteProfile"), "CompleteProfile");
const Settings = lazyNamed(() => import("../pages/Settings"), "Settings");
const About = lazyNamed(() => import("../pages/About"), "About");
const Contact = lazyNamed(() => import("../pages/Contact"), "Contact");
const PrivacyPolicy = lazyNamed(() => import("../pages/PrivacyPolicy"), "PrivacyPolicy");
const TermsConditions = lazyNamed(() => import("../pages/TermsConditions"), "TermsConditions");
const Forbidden = lazyNamed(() => import("../pages/Forbidden"), "Forbidden");
const NotFound = lazyNamed(() => import("../pages/NotFound"), "NotFound");

const AdminLayout = lazyNamed(() => import("../admin/components/AdminLayout"), "AdminLayout");
const AdminLogin = lazyNamed(() => import("../admin/pages/AdminLogin"), "AdminLogin");
const AdminDashboard = lazyNamed(() => import("../admin/pages/AdminDashboard"), "AdminDashboard");
const AdminWaitlist = lazyNamed(() => import("../admin/pages/AdminWaitlist"), "AdminWaitlist");
const AdminEnquiries = lazyNamed(() => import("../admin/pages/AdminEnquiries"), "AdminEnquiries");
const AdminProducts = lazyNamed(() => import("../admin/pages/AdminProducts"), "AdminProducts");
const AdminProductSales = lazyNamed(() => import("../admin/pages/AdminProductSales"), "AdminProductSales");
const AdminOrders = lazyNamed(() => import("../admin/pages/AdminOrders"), "AdminOrders");
const AdminSettings = lazyNamed(() => import("../admin/pages/AdminSettings"), "AdminSettings");
const AdminInventory = lazyNamed(() => import("../admin/pages/AdminInventory"), "AdminInventory");
const AdminDelivery = lazyNamed(() => import("../admin/pages/AdminDelivery"), "AdminDelivery");
const AdminCustomers = lazyNamed(() => import("../admin/pages/AdminCustomers"), "AdminCustomers");
const AdminAnalytics = lazyNamed(() => import("../admin/pages/AdminAnalytics"), "AdminAnalytics");
const AdminGrowth = lazyNamed(() => import("../admin/pages/AdminGrowth"), "AdminGrowth");
const AdminEmailBroadcasts = lazyNamed(() => import("../admin/pages/AdminEmailBroadcasts"), "AdminEmailBroadcasts");
const AdminAutomations = lazyNamed(() => import("../admin/pages/AdminAutomations"), "AdminAutomations");
const AdminAbandonedCarts = lazyNamed(() => import("../admin/pages/AdminAbandonedCarts"), "AdminAbandonedCarts");
const AdminAbandonedCheckouts = lazyNamed(() => import("../admin/pages/AdminAbandonedCheckouts"), "AdminAbandonedCheckouts");
const AdminBackInStock = lazyNamed(() => import("../admin/pages/AdminBackInStock"), "AdminBackInStock");
const AdminDiscounts = lazyNamed(() => import("../admin/pages/AdminDiscounts"), "AdminDiscounts");
const AdminCurrencyRates = lazyNamed(() => import("../admin/pages/AdminCurrencyRates"), "AdminCurrencyRates");

export function AppRoutes() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <RouteIndexingGuard />
      <RouteSkeleton />
      <GrowthTracker />

      <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:slug" element={<ProductDetails />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-success" element={<OrderSuccess />} />
        <Route path="/order-success/:orderId" element={<OrderSuccess />} />
        <Route path="/payment/paystack/callback" element={<PaystackCallback />} />
        <Route path="/account" element={<Account initialMode="signin" />} />
        <Route path="/login" element={<Account initialMode="signin" />} />
        <Route path="/register" element={<Account initialMode="signup" />} />
        <Route path="/signup" element={<Account initialMode="signup" />} />
        <Route path="/forgot-password" element={<Account initialMode="forgot" />} />
        <Route path="/reset-password" element={<Account initialMode="reset" />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsConditions />} />

        <Route path="/admin" element={<Forbidden />} />
        <Route path="/admin/*" element={<Forbidden />} />
        <Route path="/luma-control-room/login" element={<AdminLogin />} />

        <Route path="/luma-control-room" element={<AdminLayout />}>
          <Route index element={<Navigate to="/luma-control-room/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="waitlist" element={<AdminWaitlist />} />
          <Route path="enquiries" element={<AdminEnquiries />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="product-sales" element={<AdminProductSales />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="delivery" element={<AdminDelivery />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="growth" element={<AdminGrowth />} />
          <Route path="growth-tools" element={<Navigate to="/luma-control-room/growth" replace />} />
          <Route path="email-broadcasts" element={<AdminEmailBroadcasts />} />
          <Route path="automations" element={<AdminAutomations />} />
          <Route path="email-automation" element={<Navigate to="/luma-control-room/abandoned-carts" replace />} />
          <Route path="abandoned-carts" element={<AdminAbandonedCarts />} />
          <Route path="abandoned-checkouts" element={<AdminAbandonedCheckouts />} />
          <Route path="product-waitlists" element={<AdminBackInStock />} />
          <Route path="back-in-stock" element={<Navigate to="/luma-control-room/product-waitlists" replace />} />
          <Route path="discounts" element={<AdminDiscounts />} />
          <Route path="currency-rates" element={<AdminCurrencyRates />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
