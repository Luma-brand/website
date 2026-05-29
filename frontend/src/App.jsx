import { AppRoutes } from "./routes/AppRoutes";
import { Preloader } from "./components/layout/Preloader";
import { ScrollProgress } from "./components/layout/ScrollProgress";
import { Toasts } from "./components/layout/Toasts";
import { CartProvider } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";
import { WishlistProvider } from "./context/WishlistContext";
import { ToastProvider } from "./context/ToastContext";
import "./styles/global.css";

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <ToastProvider>
            <Preloader />
            <ScrollProgress />
            <AppRoutes />
            <Toasts />
          </ToastProvider>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}