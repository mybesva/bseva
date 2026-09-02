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
import AdminLegal from "./pages/admin/Legal";
import AdminSupport from "./pages/admin/Support";
import AdminEmailTemplates from "./pages/admin/EmailTemplates";
import AdminSMSTemplates from "./pages/admin/SMSTemplates";
import AdminReports from "./pages/admin/Reports";
import Book from "./pages/Book";
import BookingConfirmation from "./pages/BookingConfirmation";
import BookingReceipt from "./pages/BookingReceipt";
import MyBookings from "./pages/MyBookings";
import SatyanarayanPuja from "./pages/SatyanarayanPuja";
import GrihaPraveshPuja from "./pages/GrihaPraveshPuja";
import PujariDashboard from "./pages/pujari/Dashboard";
import PujariProfilePage from "./pages/pujari/Profile";
import PujariDocumentsPage from "./pages/pujari/Documents";
import AngikaraPage from "./pages/pujari/Angikara";
import PujariOnboarding from "./pages/pujari/Onboarding";
import PujariAddressPage from "./pages/pujari/AddressPage";
import PujariBankPage from "./pages/pujari/BankPage";
import PujariAvailabilityPage from "./pages/pujari/AvailabilityPage";
import PujariServicesPage from "./pages/pujari/ServicesPage";
import PujariExperiencePage from "./pages/pujari/ExperiencePage";
import PujariChangePasswordPage from "./pages/pujari/ChangePasswordPage";
import Services from "./pages/Services";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Register from "./pages/Register";
import TermsPage from "./pages/Terms";
import PrivacyPage from "./pages/Privacy";
import CustomerDashboard from "./pages/customer/Dashboard";
import CustomerProfilePage from "./pages/customer/Profile";
import CustomerAddressPage from "./pages/customer/Address";
import CustomerWalletPage from "./pages/customer/WalletPage";
import CustomerBookingsPage from "./pages/customer/BookingsPage";
import CustomerHistoryPage from "./pages/customer/HistoryPage";
import CustomerChangePasswordPage from "./pages/customer/ChangePasswordPage";
import { AuthProvider } from "./lib/AuthContext";
import LogoWatermark from "./components/LogoWatermark";
import AdminSettlements from "./pages/admin/Settlements";
import AdminPricingRules from "./pages/admin/PricingRules";
import AdminPermissionsPage from "./pages/admin/AdminPermissions";
import SupportPage from "./pages/Support";
import HeadRatingsPage from "./pages/HeadRatings";
import CustomerInvoicesPage from "./pages/customer/InvoicesPage";
import CustomerRewardsPage from "./pages/customer/RewardsPage";
import PublicPujariProfile from "./pages/PublicPujariProfile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/customer" component={CustomerDashboard} />
      <Route path="/customer/profile" component={CustomerProfilePage} />
      <Route path="/customer/address" component={CustomerAddressPage} />
      <Route path="/customer/wallet" component={CustomerWalletPage} />
      <Route path="/customer/bookings" component={CustomerBookingsPage} />
      <Route path="/customer/history" component={CustomerHistoryPage} />
      <Route path="/customer/change-password" component={CustomerChangePasswordPage} />
      <Route path="/customer/support" component={SupportPage} />
      <Route path="/customer/invoices" component={CustomerInvoicesPage} />
      <Route path="/customer/rewards" component={CustomerRewardsPage} />
      <Route path="/pujari-profile/:id" component={PublicPujariProfile} />
      <Route path="/pujari" component={PujariDashboard} />
      <Route path="/pujari/head-ratings" component={HeadRatingsPage} />
      <Route path="/admin/head-ratings" component={HeadRatingsPage} />
      <Route path="/admin/permissions" component={AdminPermissionsPage} />
      <Route path="/pujari/onboarding" component={PujariOnboarding} />
      <Route path="/pujari/profile" component={PujariProfilePage} />
      <Route path="/pujari/address" component={PujariAddressPage} />
      <Route path="/pujari/documents" component={PujariDocumentsPage} />
      <Route path="/pujari/angikara" component={AngikaraPage} />
      <Route path="/pujari/services" component={PujariServicesPage} />
      <Route path="/pujari/experience" component={PujariExperiencePage} />
      <Route path="/pujari/availability" component={PujariAvailabilityPage} />
      <Route path="/pujari/bank" component={PujariBankPage} />
      <Route path="/pujari/change-password" component={PujariChangePasswordPage} />
      <Route path="/pujari/support" component={SupportPage} />
      <Route path="/support" component={SupportPage} />
      <Route path="/pujaris" component={PujariDashboard} />
      <Route path="/book/:slug" component={Book} />
      <Route path="/my-bookings" component={MyBookings} />
      <Route path="/booking/:id" component={BookingReceipt} />
      <Route path="/booking-confirmation" component={BookingConfirmation} />
      <Route path="/services/satyanarayan-puja" component={SatyanarayanPuja} />
      <Route path="/services/griha-pravesh-puja" component={GrihaPraveshPuja} />
      <Route path="/services" component={Services} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/customers" component={AdminCustomers} />
      <Route path="/admin/pujaris" component={AdminPujaris} />
      <Route path="/admin/temples" component={AdminTemples} />
      <Route path="/admin/services" component={AdminServices} />
      <Route path="/admin/bulk-import" component={AdminBulkImport} />
      <Route path="/admin/bookings" component={AdminBookings} />
      <Route path="/admin/settlements" component={AdminSettlements} />
      <Route path="/admin/payments" component={AdminPayments} />
      <Route path="/admin/reviews" component={AdminReviews} />
      <Route path="/admin/samagri" component={AdminSamagri} />
      <Route path="/admin/notifications" component={AdminNotifications} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/pricing" component={AdminPricingRules} />
      <Route path="/admin/support" component={AdminSupport} />
      <Route path="/admin/legal" component={AdminLegal} />
      <Route path="/admin/email-templates" component={AdminEmailTemplates} />
      <Route path="/admin/sms-templates" component={AdminSMSTemplates} />
      <Route path="/admin/reports" component={AdminReports} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <LogoWatermark />
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
