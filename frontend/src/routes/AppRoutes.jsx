import { BrowserRouter, Routes, Route } from "react-router-dom";
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

export function AppRoutes() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <RouteSkeleton />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:slug" element={<ProductDetails />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-success/:orderId" element={<OrderSuccess />} />
        <Route path="/account" element={<Account />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}