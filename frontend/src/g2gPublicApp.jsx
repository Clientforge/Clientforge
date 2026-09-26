import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import G2GContact from './pages/demos/graceToGrace/G2GContact';
import G2GHome from './pages/demos/graceToGrace/G2GHome';
import G2GLayout from './pages/demos/graceToGrace/G2GLayout';
import G2GOffer from './pages/demos/graceToGrace/G2GOffer';
import { g2gPath } from './pages/demos/graceToGrace/g2gBase';

const routerBasename = import.meta.env.VITE_G2G_ROUTER_BASENAME;
const basename =
  !routerBasename || routerBasename === '/' ? undefined : routerBasename.replace(/\/$/, '');

export default function G2gPublicApp() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<G2GLayout />}>
          <Route index element={<G2GHome />} />
          <Route path="offer" element={<G2GOffer />} />
          <Route path="contact" element={<G2GContact />} />
          <Route path="*" element={<Navigate to={g2gPath()} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
