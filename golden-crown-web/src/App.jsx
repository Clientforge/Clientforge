import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop.jsx';
import SiteLayout from './layout/SiteLayout.jsx';
import { OrderProvider } from './orderContext.jsx';
import AboutPage from './pages/AboutPage.jsx';
import CateringPage from './pages/CateringPage.jsx';
import ContactPage from './pages/ContactPage.jsx';
import HomePage from './pages/HomePage.jsx';

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
          </Route>
        </Routes>
      </OrderProvider>
    </BrowserRouter>
  );
}
