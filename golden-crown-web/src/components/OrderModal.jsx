import { useEffect } from 'react';
import { CLOVER_ORDER_URL } from '../constants.js';
import { IconArrowRight } from '../icons.jsx';
import { useOrder } from '../orderContext.jsx';

export default function OrderModal() {
  const { orderOpen, closeOrder } = useOrder();
  const hasOrderUrl = Boolean(CLOVER_ORDER_URL && CLOVER_ORDER_URL.startsWith('http'));

  useEffect(() => {
    if (!orderOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeOrder();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [orderOpen, closeOrder]);

  if (!orderOpen) return null;

  return (
    <div
      className="gck-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeOrder();
      }}
    >
      <div
        className="gck-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gck-order-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gck-modal-header">
          <span id="gck-order-title">Order — Golden Crown Kitchen</span>
          <button
            type="button"
            className="gck-modal-close"
            onClick={closeOrder}
            aria-label="Close ordering"
          >
            ×
          </button>
        </div>
        <div className="gck-modal-body gck-modal-body--checkout">
          {hasOrderUrl ? (
            <div className="gck-modal-fallback">
              <p>
                You&apos;ll finish your order on Clover&apos;s secure checkout in this same window.
                Use your browser&apos;s <strong>Back</strong> button anytime to return here.
              </p>
              <a className="gck-btn-primary" href={CLOVER_ORDER_URL} style={{ textDecoration: 'none' }}>
                Continue to order
                <IconArrowRight />
              </a>
            </div>
          ) : (
            <div className="gck-modal-fallback">
              <p>
                Add your Clover ordering link: set <code>VITE_GCK_CLOVER_ORDER_URL</code> in{' '}
                <code>golden-crown-web/.env</code> locally or in Render environment variables, then rebuild.
              </p>
              <button type="button" className="gck-btn-primary" onClick={closeOrder}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
