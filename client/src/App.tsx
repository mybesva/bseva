import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminCustomers from "./pages/admin/Customers";
import AdminPujaris from "./pages/admin/Pujaris";
import AdminTemples from "./pages/admin/Temples";
import AdminServices from "./pages/admin/ServicesAdmin";
import AdminBulkImport from "./pages/admin/BulkImport";
import AdminBookings from "./pages/admin/Bookings";
import AdminPayments from "./pages/admin/Payments";
import AdminReviews from "./pages/admin/Reviews";
import AdminSamagri from "./pages/admin/Samagri";
import AdminNotifications from "./pages/admin/Notifications";
import AdminSettings from "./pages/admin/Settings";
import AdminEmailTemplates from "./pages/admin/EmailTemplates";
import AdminSMSTemplates from "./pages/admin/SMSTemplates";
import AdminReports from "./pages/admin/Reports";
import Book from "./pages/Book";
import BookingConfirmation from "./pages/BookingConfirmation";
import MyBookings from "./pages/MyBookings";
import SatyanarayanPuja from "./pages/SatyanarayanPuja";
import GrihaPraveshPuja from "./pages/GrihaPraveshPuja";
import PujariDashboard from "./pages/pujari/Dashboard";
import Services from "./pages/Services";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import CustomerDashboard from "./pages/customer/Dashboard";

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/customer"} component={CustomerDashboard} />
      <Route path={"/pujari"} component={PujariDashboard} />
      <Route path={"/pujaris"} component={PujariDashboard} />
      <Route path={"/book/:slug"} component={Book} />
      <Route path={"/my-bookings"} component={MyBookings} />
      <Route path={"/booking-confirmation"} component={BookingConfirmation} />
      <Route path={"/services/satyanarayan-puja"} component={SatyanarayanPuja} />
      <Route path={"/services/griha-pravesh-puja"} component={GrihaPraveshPuja} />
      <Route path={"/services"} component={Services} />
      <Route path={"/about"} component={About} />
      <Route path={"/contact"} component={Contact} />
      
      {/* Admin Routes */}
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/admin/customers"} component={AdminCustomers} />
      <Route path={"/admin/pujaris"} component={AdminPujaris} />
      <Route path={"/admin/temples"} component={AdminTemples} />
      <Route path={"/admin/services"} component={AdminServices} />
      <Route path={"/admin/bulk-import"} component={AdminBulkImport} />
      <Route path={"/admin/bookings"} component={AdminBookings} />
      <Route path={"/admin/payments"} component={AdminPayments} />
      <Route path={"/admin/reviews"} component={AdminReviews} />
      <Route path={"/admin/samagri"} component={AdminSamagri} />
      <Route path={"/admin/notifications"} component={AdminNotifications} />
      <Route path={"/admin/settings"} component={AdminSettings} />
      <Route path={"/admin/email-templates"} component={AdminEmailTemplates} />
      <Route path={"/admin/sms-templates"} component={AdminSMSTemplates} />
      <Route path={"/admin/reports"} component={AdminReports} />
      
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
