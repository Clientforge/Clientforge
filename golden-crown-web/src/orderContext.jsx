import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const OrderContext = createContext(null);

export function OrderProvider({ children }) {
  const [orderOpen, setOrderOpen] = useState(false);
  const openOrder = useCallback(() => setOrderOpen(true), []);
  const closeOrder = useCallback(() => setOrderOpen(false), []);

  const value = useMemo(
    () => ({ orderOpen, openOrder, closeOrder }),
    [orderOpen, openOrder, closeOrder],
  );

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrder() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrder must be used within OrderProvider');
  return ctx;
}
