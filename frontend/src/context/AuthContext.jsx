import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  completeCustomerProfile,
  clearStoredCustomerToken,
  getCustomerMe,
  getStoredCustomerToken,
  loginCustomer,
  logoutCustomer,
  registerCustomer,
  requestPasswordReset,
  resetCustomerPassword,
  storeCustomerToken,
  updateCustomerProfile,
  verifyResetCode,
} from "../services/authApi";

const AuthContext = createContext(null);

function getNameFromEmail(email) {
  const localPart = String(email || "").split("@")[0] || "";
  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeCustomer(customer) {
  if (!customer) return null;

  const fullName =
    customer.full_name ||
    customer.fullName ||
    customer.name ||
    customer.user_metadata?.name ||
    getNameFromEmail(customer.email);
  const phone = customer.phone || customer.user_metadata?.phone || "";

  return {
    ...customer,
    full_name: fullName,
    name: fullName,
    phone,
    phone_country_name: customer.phone_country_name || "",
    phone_country_iso2: customer.phone_country_iso2 || "",
    phone_country_code: customer.phone_country_code || "",
    phone_e164: customer.phone_e164 || phone,
    whatsapp_number: customer.whatsapp_number || "",
    whatsapp_e164: customer.whatsapp_e164 || "",
    whatsapp_country_name: customer.whatsapp_country_name || "",
    whatsapp_country_iso2: customer.whatsapp_country_iso2 || "",
    whatsapp_country_code: customer.whatsapp_country_code || "",
    whatsapp_is_account_phone: customer.whatsapp_is_account_phone === true,
    customer_type: customer.customer_type || customer.customerType || "regular_customer",
    luma_use_case: customer.luma_use_case || customer.lumaUseCase || "",
    referral_source: customer.referral_source || customer.referralSource || "",
    marketing_opt_in: customer.marketing_opt_in !== false,
    profile_completed: true,
    onboarding_completed: true,
    user_metadata: {
      ...(customer.user_metadata || {}),
      name: fullName,
      full_name: fullName,
      phone,
    },
  };
}

function getCustomerFromResponse(response) {
  return normalizeCustomer(response.customer || response.user || response.data);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadCustomerSession() {
      const token = getStoredCustomerToken();

      if (!token) {
        if (mounted) setIsAuthLoading(false);
        return;
      }

      try {
        const response = await getCustomerMe(token);
        const customer = getCustomerFromResponse(response);

        if (!customer) throw new Error("Customer session could not be loaded.");

        if (mounted) {
          setUser(customer);
          setSession({ token, user: customer });
        }
      } catch {
        clearStoredCustomerToken();
        if (mounted) {
          setUser(null);
          setSession(null);
        }
      } finally {
        if (mounted) setIsAuthLoading(false);
      }
    }

    loadCustomerSession();
    return () => {
      mounted = false;
    };
  }, []);

  const applyCustomerSession = useCallback((response) => {
    const token = response.token;
    const customer = getCustomerFromResponse(response);

    if (!token || !customer) {
      throw new Error("Customer auth response was incomplete.");
    }

    storeCustomerToken(token);
    setUser(customer);
    setSession({ token, user: customer });

    return { token, customer };
  }, []);

  const signUp = useCallback(
    async (payload) => {
      const email = String(payload.email || "").trim();
      const password = payload.password;
      const response = await registerCustomer({
        fullName: payload.name || payload.fullName || getNameFromEmail(email),
        email,
        password,
        confirmPassword: payload.confirmPassword || password,
        marketingOptIn: payload.marketingOptIn !== false,
      });

      return applyCustomerSession(response);
    },
    [applyCustomerSession]
  );

  const signIn = useCallback(
    async ({ email, password }) => {
      const response = await loginCustomer({ email, password });
      return applyCustomerSession(response);
    },
    [applyCustomerSession]
  );

  const signOut = useCallback(async () => {
    await logoutCustomer(session?.token).catch(() => {});
    clearStoredCustomerToken();
    setUser(null);
    setSession(null);
  }, [session?.token]);

  const completeProfile = useCallback(
    async (profile) => {
      const token = session?.token;
      if (!token) throw new Error("You need to sign in before updating your profile.");

      const response = await completeCustomerProfile(profile, token);
      const customer = getCustomerFromResponse(response);
      setUser(customer);
      setSession({ token, user: customer });
      return customer;
    },
    [session?.token]
  );

  const updateUser = useCallback(
    async (profile) => {
      const token = session?.token;
      if (!token) throw new Error("You need to sign in before updating your profile.");

      const response = await updateCustomerProfile(
        {
          fullName: profile.name || profile.fullName,
          phone: profile.phone,
          customerType: profile.customerType,
          lumaUseCase: profile.lumaUseCase,
          referralSource: profile.referralSource,
          marketingOptIn: profile.marketing,
        },
        token
      );
      const customer = getCustomerFromResponse(response);
      setUser(customer);
      setSession({ token, user: customer });
      return customer;
    },
    [session?.token]
  );

  const forgotPassword = useCallback((payload) => requestPasswordReset(payload), []);
  const verifyPasswordResetCode = useCallback((payload) => verifyResetCode(payload), []);
  const resetPassword = useCallback((payload) => resetCustomerPassword(payload), []);

  const displayName =
    user?.full_name || user?.name || user?.email?.split("@")[0] || "";

  const value = useMemo(
    () => ({
      user,
      session,
      isAuthLoading,
      isAuthConfigured: true,
      authConfigError: "",
      isAuthenticated: Boolean(session?.token && user),
      needsProfileCompletion: false,
      displayName,
      signUp,
      signIn,
      signOut,
      updateUser,
      completeProfile,
      forgotPassword,
      verifyPasswordResetCode,
      resetPassword,
    }),
    [
      user,
      session,
      isAuthLoading,
      displayName,
      signUp,
      signIn,
      signOut,
      updateUser,
      completeProfile,
      forgotPassword,
      verifyPasswordResetCode,
      resetPassword,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
