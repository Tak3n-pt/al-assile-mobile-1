import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

const CartContext = createContext(null);

const STORAGE_KEY = 'mobile_cart';

// Resolve the unit price for the chosen tarif. Falls back to tarif 1 if the
// product doesn't carry a value for the requested tier (server returns 0 in
// that case via COALESCE).
export function getPriceForTarif(product, tarif) {
  if (!product) return 0;
  if (tarif === 2 && (product.selling_price2 || 0) > 0) return product.selling_price2;
  if (tarif === 3 && (product.selling_price3 || 0) > 0) return product.selling_price3;
  return product.selling_price || 0;
}

export function getAvailableTarifs(product) {
  if (!product) return [1];
  return [1, 2, 3].filter(n =>
    n === 1 ||
    (n === 2 && (product.selling_price2 || 0) > 0) ||
    (n === 3 && (product.selling_price3 || 0) > 0)
  );
}

export function resolveTarifForProduct(product, requestedTarif) {
  const tarif = (requestedTarif === 2 || requestedTarif === 3) ? requestedTarif : 1;
  return getAvailableTarifs(product).includes(tarif) ? tarif : 1;
}

function loadCart() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: new Map(), client: null, saleTarif: 1 };
    const parsed = JSON.parse(raw);
    return {
      items: new Map(parsed.items || []),
      client: parsed.client || null,
      saleTarif: parsed.saleTarif || 1,
    };
  } catch {
    return { items: new Map(), client: null, saleTarif: 1 };
  }
}

function saveCart(items, client, saleTarif) {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ items: Array.from(items.entries()), client, saleTarif })
    );
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function CartProvider({ children }) {
  const initial = loadCart();
  const [items, setItems] = useState(() => initial.items);
  const [client, setClientState] = useState(() => initial.client);
  const [saleTarif, setSaleTarifState] = useState(() => initial.saleTarif);

  // Persist whenever items, client, or saleTarif change
  useEffect(() => {
    saveCart(items, client, saleTarif);
  }, [items, client, saleTarif]);

  const addItem = useCallback((product, quantity = 1) => {
    setItems(prev => {
      const next = new Map(prev);
      const existing = next.get(product.id);
      if (existing) {
        const newQty = Math.min(existing.quantity + quantity, product.quantity ?? Infinity);
        next.set(product.id, { ...existing, quantity: newQty });
      } else {
        // New lines inherit the current sale-level tarif; the user can override
        // per-line afterward via setLineTarif.
        const lineTarif = resolveTarifForProduct(product, saleTarif);
        next.set(product.id, {
          product,
          quantity: Math.min(quantity, product.quantity ?? Infinity),
          tarif: lineTarif,
        });
      }
      return next;
    });

    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(30);
  }, [saleTarif]);

  // Set sale-level tarif AND re-tag every existing cart line so users don't
  // end up with a mixed-tarif cart when they flip the tab "for the whole sale".
  const setSaleTarif = useCallback((n) => {
    const tarif = (n === 2 || n === 3) ? n : 1;
    setSaleTarifState(tarif);
    setItems(prev => {
      const next = new Map();
      for (const [id, line] of prev) {
        next.set(id, { ...line, tarif: resolveTarifForProduct(line.product, tarif) });
      }
      return next;
    });
  }, []);

  // Per-line override — leaves the sale-level tarif untouched
  const setLineTarif = useCallback((productId, n) => {
    const tarif = (n === 2 || n === 3) ? n : 1;
    setItems(prev => {
      const next = new Map(prev);
      const existing = next.get(productId);
      if (!existing) return prev;
      next.set(productId, { ...existing, tarif: resolveTarifForProduct(existing.product, tarif) });
      return next;
    });
  }, []);

  const removeItem = useCallback((productId) => {
    setItems(prev => {
      const next = new Map(prev);
      next.delete(productId);
      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId, quantity) => {
    if (quantity <= 0) {
      setItems(prev => {
        const next = new Map(prev);
        next.delete(productId);
        return next;
      });
      return;
    }
    setItems(prev => {
      const next = new Map(prev);
      const existing = next.get(productId);
      if (!existing) return prev;
      const maxQty = existing.product.quantity ?? Infinity;
      next.set(productId, { ...existing, quantity: Math.min(quantity, maxQty) });
      return next;
    });
  }, []);

  const setClient = useCallback((clientData) => {
    setClientState(clientData);
  }, []);

  const clear = useCallback(() => {
    setItems(new Map());
    setClientState(null);
    setSaleTarifState(1);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  // Resolve the unit price for a cart line — accounts for per-line tarif override
  const getLineUnitPrice = useCallback((line) => {
    return getPriceForTarif(line.product, line.tarif || saleTarif);
  }, [saleTarif]);

  const getTotal = useCallback(() => {
    let total = 0;
    for (const line of items.values()) {
      total += getLineUnitPrice(line) * line.quantity;
    }
    return total;
  }, [items, getLineUnitPrice]);

  const getItemCount = useCallback(() => {
    let count = 0;
    for (const { quantity } of items.values()) {
      count += quantity;
    }
    return count;
  }, [items]);

  const getItemsArray = useCallback(() => {
    return Array.from(items.values());
  }, [items]);

  const isInCart = useCallback((productId) => items.has(productId), [items]);

  // Memoize value to prevent all consumers from re-rendering on every provider render
  const value = useMemo(() => ({
    items,
    client,
    saleTarif,
    addItem,
    removeItem,
    updateQuantity,
    setClient,
    setSaleTarif,
    setLineTarif,
    clear,
    getTotal,
    getItemCount,
    getItemsArray,
    getLineUnitPrice,
    isInCart,
  }), [items, client, saleTarif, addItem, removeItem, updateQuantity, setClient, setSaleTarif, setLineTarif, clear, getTotal, getItemCount, getItemsArray, getLineUnitPrice, isInCart]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
