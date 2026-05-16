import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Component, ReactNode, useEffect } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import Planos from "./pages/Planos";
import AdminFinanceiro from "./pages/AdminFinanceiro";
import { errorLogger } from "@/lib/errorLogger";
import { GlobalErrorNotifier } from "@/components/GlobalErrorNotifier";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      onError: (error: any) => {
        errorLogger.log({
          message: error?.message || "Query error",
          stack: error?.stack,
          timestamp: new Date(),
          context: {
            type: "query_error",
            status: error?.status,
          },
        });
      },
    },
    mutations: {
      onError: (error: any) => {
        errorLogger.log({
          message: error?.message || "Mutation error",
          stack: error?.stack,
          timestamp: new Date(),
          context: {
            type: "mutation_error",
            status: error?.status,
          },
        });
      },
    },
  },
});

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    errorLogger.log({
      message: error.message,
      stack: error.stack,
      timestamp: new Date(),
      context: {
        type: "react_error_boundary",
        errorId: this.state.errorId,
        componentStack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href,
      },
    });

    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "exception", {
        description: "frontend_error",
        fatal: false,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", backgroundColor: "#121212", display: "flex", alignItems: "center", justifyContent: "center", color: "#f2f2f2", padding: "20px" }}>
          <div style={{ textAlign: "center", maxWidth: "500px" }}>
            <h1>Erro na aplicacao</h1>
            <p style={{ marginTop: "10px", opacity: 0.7 }}>Algo saiu do esperado. Tente recarregar a pagina.</p>
            <div style={{ marginTop: "20px", display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                onClick={() => window.location.reload()}
                style={{ padding: "10px 20px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
              >
                Recarregar pagina
              </button>
              <button
                onClick={() => window.location.href = "/"}
                style={{ padding: "10px 20px", backgroundColor: "#dc2626", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
              >
                Voltar ao inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const InspectionDeterrent = () => {
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const blockedKeys =
        event.key === "F12" ||
        (event.ctrlKey && event.shiftKey && ["I", "J", "C"].includes(event.key.toUpperCase())) ||
        (event.ctrlKey && event.key.toUpperCase() === "U");

      if (blockedKeys) {
        event.preventDefault();
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
};

const RouterComponent = import.meta.env.VITE_ROUTER_MODE === "hash" ? HashRouter : BrowserRouter;

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <InspectionDeterrent />
        <RouterComponent>
          <GlobalErrorNotifier />
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/planos" element={<Planos />} />
            <Route
              path="/admin/financeiro"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminFinanceiro />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/financeiro/planos"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminFinanceiro />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/financeiro/integracoes"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminFinanceiro />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/financeiro/pagina"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminFinanceiro />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/financeiro/checkout"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminFinanceiro />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/*"
              element={
                <ProtectedRoute requireSubscription>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </RouterComponent>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
