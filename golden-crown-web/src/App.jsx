import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop.jsx';
import SiteLayout from './layout/SiteLayout.jsx';
import { OrderProvider } from './orderContext.jsx';
import AboutPage from './pages/AboutPage.jsx';
import CateringPage from './pages/CateringPage.jsx';
import ContactPage from './pages/ContactPage.jsx';
import HomePage from './pages/HomePage.jsx';
import ReviewFeedbackPage from './pages/ReviewFeedbackPage.jsx';
import ReviewGooglePage from './pages/ReviewGooglePage.jsx';
import ReviewPage from './pages/ReviewPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <OrderProvider>
        <ScrollToTop />
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/catering" element={<CateringPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/review/feedback" element={<ReviewFeedbackPage />} />
            <Route path="/review/google" element={<ReviewGooglePage />} />
          </Route>
        </Routes>
      </OrderProvider>
    </BrowserRouter>
  );
}
