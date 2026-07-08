import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import Storefront from './pages/Storefront';
import Checkout from './pages/Checkout';
import Downloads from './pages/Downloads';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';

// Main Application Component
function App() {
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('brane_cart');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Sync cart to localStorage
  useEffect(() => {
    localStorage.setItem('brane_cart', JSON.stringify(cart));
  }, [cart]);

  // Cart Management Functions
  const addToCart = (product) => {
    setCart((prevCart) => {
      const existing = prevCart.find(item => item.id === product.id);
      if (existing) {
        return prevCart.map(item =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prevCart, { ...product, qty: 1 }];
    });
    setIsCartOpen(true); // Open drawer on addition
  };

  const updateQty = (id, delta) => {
    setCart((prevCart) =>
      prevCart
        .map(item => {
          if (item.id === id) {
            const newQty = item.qty + delta;
            return { ...item, qty: newQty };
          }
          return item;
        })
        .filter(item => item.qty > 0)
    );
  };

  const removeFromCart = (id) => {
    setCart((prevCart) => prevCart.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartCount = cart.reduce((acc, item) => acc + item.qty, 0);
  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  return (
    <Router>
      <AppContent
        cart={cart}
        isCartOpen={isCartOpen}
        setIsCartOpen={setIsCartOpen}
        addToCart={addToCart}
        updateQty={updateQty}
        removeFromCart={removeFromCart}
        clearCart={clearCart}
        cartCount={cartCount}
        cartTotal={cartTotal}
      />
    </Router>
  );
}

// Subcomponent to handle routing & Conditional Header Rendering
function AppContent({
  cart,
  isCartOpen,
  setIsCartOpen,
  addToCart,
  updateQty,
  removeFromCart,
  clearCart,
  cartCount,
  cartTotal
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminPath = location.pathname.startsWith('/admin');

  // Sync body scroll lock on cart open
  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isCartOpen]);

  return (
    <div className="app-wrapper">
      {/* 1. Customer Navigation Bar (Hidden in Admin Section) */}
      {!isAdminPath && (
        <header className="navbar">
          <div className="container nav-container">
            <Link to="/" className="brand-logo">
              ⚡ <span>BRANE SHOP</span>
            </Link>
            
            <nav className="nav-links">
              <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
                Shop
              </Link>
              <Link to="/admin/login" className="nav-link">
                Admin Panel
              </Link>
              
              <button className="btn btn-cart" onClick={() => setIsCartOpen(true)}>
                🛒 Cart
                {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
              </button>
            </nav>
          </div>
        </header>
      )}

      {/* 2. Main Page Content */}
      <main>
        <Routes>
          <Route path="/" element={<Storefront addToCart={addToCart} />} />
          <Route path="/checkout" element={<Checkout cart={cart} cartTotal={cartTotal} clearCart={clearCart} />} />
          <Route path="/checkout/success" element={<Downloads />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/*" element={<AdminDashboard />} />
        </Routes>
      </main>

      {/* 3. Global Shopping Cart Drawer (Hidden in Admin) */}
      {!isAdminPath && (
        <div className={`cart-drawer-overlay ${isCartOpen ? 'open' : ''}`} onClick={() => setIsCartOpen(false)}>
          <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cart-header">
              <h2 className="cart-title">Your Download Cart</h2>
              <button className="btn-close" onClick={() => setIsCartOpen(false)}>×</button>
            </div>
            
            <div className="cart-items-list">
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '2rem', marginBottom: '1rem' }}>🛒</p>
                  <p>Your cart is empty.</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Select a game or software to start.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div className="cart-item" key={item.id}>
                    <img src={item.image_url} alt={item.title} className="cart-item-img" />
                    <div className="cart-item-info">
                      <div className="cart-item-title">{item.title}</div>
                      <div className="cart-item-price">${(item.price * item.qty).toFixed(2)}</div>
                    </div>
                    <div className="cart-qty-controls">
                      <button className="cart-qty-btn" onClick={() => updateQty(item.id, -1)}>-</button>
                      <span className="cart-qty-val">{item.qty}</span>
                      <button className="cart-qty-btn" onClick={() => updateQty(item.id, 1)}>+</button>
                    </div>
                    <button className="btn-remove-item" onClick={() => removeFromCart(item.id)}>🗑️</button>
                  </div>
                ))
              )}
            </div>

            <div className="cart-footer">
              <div className="cart-total-row">
                <span className="cart-total-label">Subtotal</span>
                <span className="cart-total-val">${cartTotal.toFixed(2)}</span>
              </div>
              {cart.length > 0 ? (
                <button
                  className="btn btn-primary pulse-primary"
                  style={{ width: '100%', padding: '1rem' }}
                  onClick={() => {
                    setIsCartOpen(false);
                    navigate('/checkout');
                  }}
                >
                  Proceed to Checkout 🚀
                </button>
              ) : (
                <button className="btn btn-primary" style={{ width: '100%', opacity: 0.5, cursor: 'not-allowed' }} disabled>
                  Cart is Empty
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
