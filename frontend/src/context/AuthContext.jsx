import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

const USER_STORAGE_KEY = "luma_user";

function getStoredUser() {
  try {
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [user]);

  function signUp(formData) {
    const newUser = {
      name: formData.name,
      email: formData.email,
      beautyFocus: formData.beautyFocus,
      createdAt: new Date().toISOString(),
    };

    setUser(newUser);
    return newUser;
  }

  function signIn(formData) {
    const existingUser = {
      name: formData.email.split("@")[0],
      email: formData.email,
      beautyFocus: "Brows",
      createdAt: new Date().toISOString(),
    };

    setUser(existingUser);
    return existingUser;
  }

  function updateUser(updates) {
    setUser((currentUser) => ({
      ...currentUser,
      ...updates,
    }));
  }

  function signOut() {
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      signUp,
      signIn,
      updateUser,
      signOut,
    }),
    [user]
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