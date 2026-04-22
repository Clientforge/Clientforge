import { Routes, Route, Navigate } from 'react-router-dom';
import './GraceToGraceDemo.css';
import G2GLayout from './G2GLayout';
import G2GHome from './G2GHome';
import G2GOffer from './G2GOffer';
import G2GContact from './G2GContact';

const BASE = '/demo/grace-to-grace';

export default function GraceToGraceDemoPage() {
  return (
    <div className="g2g-demo-root">
      <Routes>
        <Route element={<G2GLayout />}>
          <Route index element={<G2GHome />} />
          <Route path="offer" element={<G2GOffer />} />
          <Route path="contact" element={<G2GContact />} />
          <Route path="*" element={<Navigate to={BASE} replace />} />
        </Route>
      </Routes>
    </div>
  );
}
