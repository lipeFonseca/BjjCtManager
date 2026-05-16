import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getActiveCtSubscription, getUserCtId, getUserRole, hasCtBillingHistory } from "@/services/billing";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requireSubscription?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin = false, requireSubscription = false }: ProtectedRouteProps) => {
  const [loading, setLoading] = useState(true);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setRedirectTo("/login");
        setLoading(false);
        return;
      }

      const role = await getUserRole(session.user.id);

      if (requireAdmin && role !== "admin") {
        setRedirectTo("/dashboard");
        setLoading(false);
        return;
      }

      if (requireSubscription && role !== "admin") {
        const ctId = await getUserCtId(session.user.id);
        if (ctId) {
          const hasBillingHistory = await hasCtBillingHistory(ctId);

          if (hasBillingHistory) {
            const activeSubscription = await getActiveCtSubscription(ctId);
            if (!activeSubscription) {
              setRedirectTo(`/planos?required=1&from=${encodeURIComponent(location.pathname)}`);
              setLoading(false);
              return;
            }
          }
        }
      }

      setLoading(false);
    };

    void run();
  }, [location.pathname, requireAdmin, requireSubscription]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
