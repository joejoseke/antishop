import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Checkout({ cart, cartTotal, clearCart }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethod] = useState('mpesa'); // mpesa, paypal, paystack, kopokopo
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [orderId, setOrderId] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const [mockModeText, setMockModeText] = useState('');

  // Redirect if cart is empty
  useEffect(() => {
    if (cart.length === 0 && !isPolling) {
      navigate('/');
    }
  }, [cart, isPolling, navigate]);

  // Polling order status
  useEffect(() => {
    let timer;
    if (isPolling && orderId) {
      const checkStatus = () => {
        fetch(`http://localhost:5000/api/orders/${orderId}`)
          .then(res => res.json())
          .then(data => {
            if (data.status === 'paid') {
              setIsPolling(false);
              clearCart();
              navigate(`/checkout/success?orderId=${orderId}`);
            } else if (data.status === 'failed') {
              setIsPolling(false);
              setLoading(false);
              setStatusMessage('Payment verification failed or cancelled. Please try again.');
            } else {
              // Keep polling
              timer = setTimeout(checkStatus, 2500);
            }
          })
          .catch(err => {
            console.error('Error polling order status:', err);
            timer = setTimeout(checkStatus, 3000);
          });
      };
      
      timer = setTimeout(checkStatus, 2000);
    }

    return () => clearTimeout(timer);
  }, [isPolling, orderId, navigate, clearCart]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setLoading(true);
    setStatusMessage('Initiating transaction secured tunnel...');
    setMockModeText('');

    const payload = {
      email,
      phone,
      paymentMethod,
      cartItems: cart.map(item => ({ id: item.id, qty: item.qty }))
    };

    try {
      const response = await fetch('http://localhost:5000/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to checkout.');
      }

      setOrderId(data.orderId);
      
      if (data.isMock) {
        setMockModeText('🔑 API Keys not configured. Running in Mock Testing Mode (Auto-completing in 5s).');
      }

      // Handle individual payment gateways
      if (paymentMethod === 'mpesa') {
        setStatusMessage(`M-Pesa STK Push sent to ${phone}. Enter your M-Pesa PIN on your phone to complete purchase.`);
        setIsPolling(true);
      }
    } catch (err) {
      setLoading(false);
      setStatusMessage(err.message);
    }
  };

  return (
    <div className="container">
      <div className="checkout-layout">
        
        {/* Left Hand side form */}
        <div className="checkout-card">
          <h2 className="checkout-section-title">Billing & Payment details</h2>
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <div className="pulse-primary" style={{ display: 'inline-block', width: '60px', height: '60px', borderRadius: '50%', border: '4px solid var(--secondary)', borderTopColor: 'transparent', animation: 'spin 1.2s linear infinite' }}></div>
              <p style={{ marginTop: '2rem', fontWeight: 600, color: 'var(--text-primary)', fontSize: '1.1rem' }}>{statusMessage}</p>
              {mockModeText && (
                <p style={{ marginTop: '1rem', color: 'var(--text-warning)', fontSize: '0.85rem', maxWidth: '400px', margin: '1rem auto' }}>
                  {mockModeText}
                </p>
              )}

            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email Address (for download link delivery)</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">M-Pesa Mobile Number</label>
                <input
                  type="tel"
                  className="form-input"
                  required
                  placeholder="e.g. 254712345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Must begin with Country Code (e.g., 254 for Kenya).
                </small>
              </div>

              <div style={{ margin: '2rem 0' }}>
                <label className="form-label">Payment Gateway</label>
                <div className="payment-method-card active" style={{ cursor: 'default' }}>
                  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/M-PESA_LOGO-01.svg/512px-M-PESA_LOGO-01.svg.png" alt="M-Pesa" className="payment-method-logo" />
                  <span className="payment-method-name">M-Pesa Daraja STK Push</span>
                </div>
              </div>

              <button type="submit" className="btn btn-primary pulse-primary" style={{ width: '100%', padding: '1rem' }}>
                Secure Checkout - KSh {(cartTotal).toFixed(2)} 🔒
              </button>
            </form>
          )}
        </div>

        {/* Right Hand side order summary */}
        <div className="checkout-card" style={{ height: 'fit-content' }}>
          <h2 className="checkout-section-title">Order Summary</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {cart.map(item => (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} key={item.id}>
                <div>
                  <span style={{ fontWeight: 600 }}>{item.title}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '0.5rem' }}>x{item.qty}</span>
                </div>
                <div style={{ fontWeight: 700 }}>KSh {(item.price * item.qty).toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div className="summary-item-row">
            <span>License activation key delivery</span>
            <span style={{ color: 'var(--text-success)' }}>Free / Instant</span>
          </div>
          
          <div className="summary-item-row">
            <span>Platform Tax / VAT</span>
            <span>KSh 0.00</span>
          </div>

          <div className="summary-item-row total">
            <span>Total Payable</span>
            <span>KSh {cartTotal.toFixed(2)}</span>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Checkout;
