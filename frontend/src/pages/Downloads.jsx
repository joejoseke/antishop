import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

function Downloads() {
  const [searchParams] = useSearchParams();
  const orderIdFromUrl = searchParams.get('orderId') || searchParams.get('reference'); // paystack uses reference
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderIdFromUrl) {
      setError('Missing order identifier in URL path.');
      setLoading(false);
      return;
    }

    const fetchOrder = () => {
      // If it's a paystack redirect, we first hit verify to clear the pending order, then fetch
      const gateway = searchParams.get('gateway');
      const isPaystack = gateway === 'paystack';
      
      const endpoint = isPaystack 
        ? `http://localhost:5000/api/payments/paystack/verify/${orderIdFromUrl}` 
        : `http://localhost:5000/api/orders/${orderIdFromUrl}`;

      fetch(endpoint)
        .then(res => {
          if (!res.ok) throw new Error('Order verification failed.');
          return res.json();
        })
        .then(data => {
          // If we called verify, it returns {status: 'success', reference}
          if (isPaystack) {
            // Refetch standard order
            return fetch(`http://localhost:5000/api/orders/${orderIdFromUrl}`)
              .then(r => r.json())
              .then(orderData => {
                setOrder(orderData);
                setLoading(false);
              });
          } else {
            setOrder(data);
            setLoading(false);
          }
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    };

    fetchOrder();
  }, [orderIdFromUrl, searchParams]);

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '5rem 0' }}>
        <div className="pulse-primary" style={{ display: 'inline-block', width: '50px', height: '50px', borderRadius: '50%', border: '4px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Verifying digital credentials...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container" style={{ padding: '3rem 0', maxWidth: '600px' }}>
        <div className="checkout-card" style={{ borderLeft: '4px solid var(--accent)', textAlign: 'center' }}>
          <p style={{ fontSize: '3rem', margin: '1rem 0' }}>⚠️</p>
          <h2 style={{ color: 'var(--text-primary)' }}>Access Denied</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>{error || 'The requested order details could not be found.'}</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
            <Link to="/" className="btn btn-primary">Return To Store</Link>
            <button className="btn btn-outline" onClick={() => window.location.reload()}>Retry Access</button>
          </div>
        </div>
      </div>
    );
  }

  const isPaid = order.status === 'paid';

  return (
    <div className="container" style={{ paddingBottom: '5rem', paddingTop: '2rem' }}>
      
      {isPaid ? (
        <>
          <div className="success-hero">
            <div className="success-icon">✓</div>
            <h1 className="hero-title" style={{ fontSize: '2.5rem' }}>Payment Cleared successfully</h1>
            <p className="hero-subtitle" style={{ fontSize: '1.1rem', margin: '0.5rem auto' }}>
              Order ID: <span style={{ color: 'var(--secondary)', fontFamily: 'monospace' }}>{order.order_id}</span>
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              A download confirmation email has been routed to <strong>{order.email}</strong>.
            </p>
          </div>

          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 className="checkout-section-title">Your Digital Software & Game Downloads</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
              {order.items && order.items.map(item => (
                <div className="download-box" key={item.id}>
                  <div className="download-meta-info">
                    <span className="download-product-title">{item.product_title}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Licence Cost: KSh {item.price.toFixed(2)}
                    </span>
                    <div>
                      <span className="download-key-badge">
                        🔑 Key: {item.license_key || 'Processing activation key...'}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <a
                      href={`http://localhost:5000/api/download/${order.order_id}/${item.product_id}`}
                      className="btn btn-secondary pulse-primary"
                      style={{ textDecoration: 'none' }}
                      download
                    >
                      📥 Download Installer
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <div className="checkout-card" style={{ marginTop: '3rem' }}>
              <h3 className="req-title" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>General Activation Instructions</h3>
              <ul style={{ color: 'var(--text-muted)', paddingLeft: '1.5rem', lineHeight: '1.8', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>Download and run the installer executable binary on your Windows machine.</li>
                <li>When prompted during installation or launching, copy and paste the license key provided above.</li>
                <li>Ensure you meet the system requirements listed on the store pages for smooth operation.</li>
                <li>Digital downloads are single-license keys and tied to the email address used during checkout.</li>
              </ul>
            </div>
          </div>
        </>
      ) : (
        <div className="checkout-card" style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center', borderLeft: '4px solid var(--text-warning)' }}>
          <p style={{ fontSize: '4rem', margin: '0' }}>⏳</p>
          <h2>Payment Still Pending</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
            We are waiting for authorization from your payment provider ({order.payment_method.toUpperCase()}).
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            This page will automatically update once payment is confirmed. Please do not close this window.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
            <Link to="/" className="btn btn-outline">Back to Home</Link>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Refresh Payment Status</button>
          </div>
        </div>
      )}

    </div>
  );
}

export default Downloads;
