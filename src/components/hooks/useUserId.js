// hooks/useUserId.js - CORRECT VERSION
import { useAuth } from "../AuthContext";

export const useUserId = () => {
  const { user } = useAuth();

  const userId = user?.id || null;
  const isAuthenticated = !!user;
  const userRole = user?.role;

  return {
    userId,
    isAuthenticated,
    userRole,
    user,
  };
};

// ✅ Export as default too if needed
export default useUserId;
