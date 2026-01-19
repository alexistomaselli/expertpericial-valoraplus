import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import AppLayout from "./pages/AppLayout";
import NewAnalysis from "./pages/NewAnalysis";
import Verification from "./pages/Verification";
import WorkshopCosts from "./pages/WorkshopCosts";
import Results from "./pages/Results";
import MyAccount from "./pages/MyAccount";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import PaymentTest from "./pages/PaymentTest";
import PaymentHistory from "./pages/PaymentHistory";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import AdminLayout from "./pages/AdminLayout";
import AdminDashboard from "./pages/AdminDashboard";
import AdminWorkshops from "./pages/AdminWorkshops";
import AdminAnalyses from "./pages/AdminAnalyses";
import AdminWorkshopAnalyses from "./pages/AdminWorkshopAnalyses";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminProtectedRoute } from "./components/AdminProtectedRoute";
import Unauthorized from "./pages/Unauthorized";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={
              <AdminProtectedRoute>
                <AdminLayout />
              </AdminProtectedRoute>
            }>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="workshops" element={<AdminWorkshops />} />
              <Route path="workshops/:id/analisis" element={<AdminWorkshopAnalyses />} />
              <Route path="analisis" element={<AdminAnalyses />} />
            </Route>
            <Route path="/app" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/app/micuenta" replace />} />
              <Route path="nuevo" element={<NewAnalysis />} />
              <Route path="verificacion/:caseId" element={<Verification />} />
              <Route path="costes/:caseId" element={<WorkshopCosts />} />
              <Route path="resultados/:caseId" element={<Results />} />
              <Route path="micuenta" element={<MyAccount />} />
              <Route path="historial-pagos" element={<PaymentHistory />} />
            </Route>
            <Route path="/payment/success" element={
              <ProtectedRoute>
                <PaymentSuccess />
              </ProtectedRoute>
            } />
            <Route path="/payment-success" element={
              <ProtectedRoute>
                <PaymentSuccess />
              </ProtectedRoute>
            } />
            <Route path="/payment/cancel" element={
              <ProtectedRoute>
                <PaymentCancel />
              </ProtectedRoute>
            } />
            <Route path="/payment-cancel" element={
              <ProtectedRoute>
                <PaymentCancel />
              </ProtectedRoute>
            } />
            <Route path="/payment-test" element={
              <ProtectedRoute>
                <PaymentTest />
              </ProtectedRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
