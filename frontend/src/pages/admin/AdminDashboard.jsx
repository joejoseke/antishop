import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview'); // overview, products, orders, settings
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Product Edit Form State
  const [editingProduct, setEditingProduct] = useState(null);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    title: '',
    description: '',
    category: 'gaming',
    price: 0,
    image_url: '',
    download_file: '',
    license_keys: [],
    system_req: { os: '', processor: '', memory: '', graphics: '', storage: '' }
  });

  // Verify Admin Access
  useEffect(() => {
    const token = localStorage.getItem('brane_admin_token');
    if (!token) {
      navigate('/admin/login');
      return;
    }

    // Fetch initial datasets
    Promise.all([
      fetch('http://localhost:5000/api/products').then(res => res.json()),
      fetch('http://localhost:5000/api/admin/orders').then(res => res.json()),
      fetch('http://localhost:5000/api/admin/settings').then(res => res.json())
    ])
      .then(([productsData, ordersData, settingsData]) => {
        setProducts(productsData);
        setOrders(ordersData);
        setSettings(settingsData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching admin data:', err);
        setLoading(false);
      });
  }, [navigate]);

  // Log Out Handler
  const handleLogout = () => {
    localStorage.removeItem('brane_admin_token');
    localStorage.removeItem('brane_admin_user');
    navigate('/admin/login');
  };

  // Save Config Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    try {
      const response = await fetch('http://localhost:5000/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('API Gateway configurations updated successfully.');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        alert(data.error || 'Failed to update configurations');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating settings.');
    }
  };

  // Product CRUD Handlers
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      title: '',
      description: '',
      category: 'gaming',
      price: 0,
      image_url: '',
      download_file: '',
      license_keys: [],
      system_req: { os: '', processor: '', memory: '', graphics: '', storage: '' }
    });
    setIsProductFormOpen(true);
  };

  const handleOpenEditProduct = (prod) => {
    // We need to fetch license keys as the standard products list endpoint doesn't return them for performance
    fetch(`http://localhost:5000/api/products/${prod.id}`)
      .then(res => res.json())
      .then(data => {
        setEditingProduct(prod.id);
        setProductForm({
          title: data.title,
          description: data.description,
          category: data.category,
          price: data.price,
          image_url: data.image_url,
          download_file: data.download_file,
          license_keys: data.license_keys,
          system_req: data.system_req || { os: '', processor: '', memory: '', graphics: '', storage: '' }
        });
        setIsProductFormOpen(true);
      });
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const isEdit = !!editingProduct;
    const url = isEdit 
      ? `http://localhost:5000/api/products/${editingProduct}`
      : 'http://localhost:5000/api/products';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productForm)
      });

      if (response.ok) {
        // Refetch products list
        const res = await fetch('http://localhost:5000/api/products');
        const data = await res.json();
        setProducts(data);
        setIsProductFormOpen(false);
      }
    } catch (err) {
      console.error('Error saving product:', err);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product? This action is permanent.')) return;

    try {
      const response = await fetch(`http://localhost:5000/api/products/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setProducts(prev => prev.filter(p => p.id !== id));
      }
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  // Metrics Calculations
  const paidOrders = orders.filter(o => o.status === 'paid');
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const totalRevenue = paidOrders.reduce((acc, o) => acc + o.total, 0);
  const avgOrderVal = paidOrders.length > 0 ? (totalRevenue / paidOrders.length) : 0;

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '5rem 0' }}>
        <div className="pulse-primary" style={{ display: 'inline-block', width: '50px', height: '50px', borderRadius: '50%', border: '4px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Opening admin session...</p>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      
      {/* 1. Sidebar Nav */}
      <aside className="admin-sidebar">
        <div style={{ padding: '0 2rem 1.5rem 2rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '1px' }}>
              ⚡ BRANE PANEL
            </h1>
          </Link>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-success)', display: 'block', marginTop: '0.25rem' }}>
            ● Operator: {localStorage.getItem('brane_admin_user') || 'admin'}
          </span>
        </div>

        <div className={`admin-sidebar-link ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          📈 Overview Metrics
        </div>
        <div className={`admin-sidebar-link ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
          📦 Product Inventory
        </div>
        <div className={`admin-sidebar-link ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
          🧾 Customer Orders
        </div>
        <div className={`admin-sidebar-link ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          ⚙️ Payment Adapters
        </div>
        
        <div className="admin-sidebar-link" onClick={handleLogout} style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', color: 'var(--accent)' }}>
          🚪 Log Out Session
        </div>
      </aside>

      {/* 2. Main Content Board */}
      <main className="admin-content">
        
        {/* TAB 1: OVERVIEW METRICS */}
        {activeTab === 'overview' && (
          <div>
            <div className="admin-header-row">
              <h2 className="admin-page-title">Operations Control Panel</h2>
            </div>
            
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Total Revenue</span>
                <span className="stat-val revenue">KSh {totalRevenue.toFixed(2)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Paid Purchases</span>
                <span className="stat-val orders">{paidOrders.length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Pending Invoices</span>
                <span className="stat-val" style={{ color: 'var(--text-warning)' }}>{pendingOrders.length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Average Ticket Size</span>
                <span className="stat-val" style={{ color: '#fff' }}>KSh {avgOrderVal.toFixed(2)}</span>
              </div>
            </div>

            {/* Custom SVG Line/Bar Chart for Visual Polish */}
            <div className="chart-box">
              <h3 className="chart-title">Revenue Velocity Profile (Last 6 Transactions)</h3>
              <div className="chart-svg-container">
                {paidOrders.length === 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
                    No paid transaction metrics available to plot yet.
                  </div>
                ) : (
                  <svg viewBox="0 0 500 200" style={{ width: '100%', height: '100%' }}>
                    {/* Background Grid */}
                    <line x1="30" y1="20" x2="480" y2="20" stroke="rgba(255,255,255,0.05)" />
                    <line x1="30" y1="80" x2="480" y2="80" stroke="rgba(255,255,255,0.05)" />
                    <line x1="30" y1="140" x2="480" y2="140" stroke="rgba(255,255,255,0.05)" />
                    <line x1="30" y1="170" x2="480" y2="170" stroke="var(--border-color)" />
                    
                    {/* Plotting Line */}
                    {(() => {
                      const last6 = [...paidOrders].reverse().slice(0, 6);
                      if (last6.length === 1) {
                        return (
                          <circle cx="250" cy="100" r="6" fill="var(--secondary)" />
                        );
                      }
                      
                      const maxVal = Math.max(...last6.map(o => o.total), 50);
                      const points = last6.map((o, idx) => {
                        const x = 30 + (idx * (450 / (last6.length - 1)));
                        const y = 170 - ((o.total / maxVal) * 140);
                        return { x, y, total: o.total, id: o.order_id };
                      });
                      
                      const pathD = points.reduce((acc, p, idx) => {
                        return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
                      }, '');

                      return (
                        <>
                          {/* Shadow glow path */}
                          <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="6" opacity="0.3" style={{ filter: 'blur(4px)' }} />
                          <path d={pathD} fill="none" stroke="var(--secondary)" strokeWidth="3" />
                          {points.map((p, idx) => (
                            <g key={idx}>
                              <circle cx={p.x} cy={p.y} r="5" fill="var(--primary)" stroke="#fff" strokeWidth="1.5" />
                              <text x={p.x} y={p.y - 12} fill="var(--text-muted)" fontSize="9" textAnchor="middle">
                                KSh {p.total.toFixed(0)}
                              </text>
                              <text x={p.x} y="190" fill="var(--text-muted)" fontSize="8" textAnchor="middle">
                                {p.id.substring(12) || p.id}
                              </text>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PRODUCT INVENTORY */}
        {activeTab === 'products' && (
          <div>
            <div className="admin-header-row">
              <h2 className="admin-page-title">Digital Products Catalog</h2>
              <button className="btn btn-primary" onClick={handleOpenAddProduct}>
                + Add Digital Product
              </button>
            </div>

            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Cover</th>
                    <th>Product Title</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Download File Name</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td>
                        <img src={p.image_url} alt="" style={{ width: '45px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.title}</td>
                      <td style={{ textTransform: 'capitalize' }}>{p.category}</td>
                      <td style={{ color: 'var(--secondary)', fontWeight: 700 }}>KSh {p.price.toFixed(2)}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.download_file}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', marginRight: '0.5rem' }} onClick={() => handleOpenEditProduct(p)}>
                          Edit
                        </button>
                        <button className="btn btn-accent" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={() => handleDeleteProduct(p.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Product Add/Edit Dialog modal overlay */}
            {isProductFormOpen && (
              <div className="modal-overlay" onClick={() => setIsProductFormOpen(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '2rem', maxWidth: '650px' }}>
                  <button className="modal-close-btn" onClick={() => setIsProductFormOpen(false)}>×</button>
                  <h2 className="checkout-section-title">
                    {editingProduct ? 'Modify Digital Product' : 'Add New Digital Product'}
                  </h2>
                  
                  <form onSubmit={handleSaveProduct}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Product Name</label>
                        <input
                          type="text"
                          className="form-input"
                          required
                          value={productForm.title}
                          onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Price (KES)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-input"
                          required
                          value={productForm.price}
                          onChange={(e) => setProductForm({ ...productForm, price: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Category</label>
                        <select
                          className="form-input"
                          value={productForm.category}
                          onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                        >
                          <option value="gaming">Gaming</option>
                          <option value="software">Software</option>
                        </select>
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Installer File Name</label>
                        <input
                          type="text"
                          className="form-input"
                          required
                          placeholder="e.g. installer.exe"
                          value={productForm.download_file}
                          onChange={(e) => setProductForm({ ...productForm, download_file: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-input"
                        rows="3"
                        required
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                        style={{ resize: 'vertical' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Cover Image URL</label>
                      <input
                        type="url"
                        className="form-input"
                        required
                        value={productForm.image_url}
                        onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">License Keys Pool (comma separated)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="KEY-1, KEY-2, KEY-3"
                        value={Array.isArray(productForm.license_keys) ? productForm.license_keys.join(', ') : ''}
                        onChange={(e) => setProductForm({
                          ...productForm,
                          license_keys: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        })}
                      />
                    </div>

                    <h4 className="req-title" style={{ fontSize: '0.9rem', marginTop: '1.5rem', marginBottom: '0.75rem' }}>System Requirements</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="OS"
                          value={productForm.system_req.os || ''}
                          onChange={(e) => setProductForm({
                            ...productForm,
                            system_req: { ...productForm.system_req, os: e.target.value }
                          })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="CPU"
                          value={productForm.system_req.processor || ''}
                          onChange={(e) => setProductForm({
                            ...productForm,
                            system_req: { ...productForm.system_req, processor: e.target.value }
                          })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="RAM"
                          value={productForm.system_req.memory || ''}
                          onChange={(e) => setProductForm({
                            ...productForm,
                            system_req: { ...productForm.system_req, memory: e.target.value }
                          })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="GPU"
                          value={productForm.system_req.graphics || ''}
                          onChange={(e) => setProductForm({
                            ...productForm,
                            system_req: { ...productForm.system_req, graphics: e.target.value }
                          })}
                        />
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary pulse-primary" style={{ width: '100%', padding: '1rem', marginTop: '1.5rem' }}>
                      Publish Product Details ⚡
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CUSTOMER ORDERS */}
        {activeTab === 'orders' && (
          <div>
            <div className="admin-header-row">
              <h2 className="admin-page-title">Customer Order Registry</h2>
            </div>

            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer Email</th>
                    <th>Total Price</th>
                    <th>Payment Method</th>
                    <th>Payment Status</th>
                    <th>Transaction Reference</th>
                    <th>Downloads</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{o.order_id}</td>
                      <td>{o.email}</td>
                      <td style={{ color: 'var(--secondary)', fontWeight: 700 }}>KSh {o.total.toFixed(2)}</td>
                      <td style={{ textTransform: 'uppercase', fontSize: '0.8rem' }}>{o.payment_method}</td>
                      <td>
                        <span className={`status-badge ${o.status}`}>
                          {o.status}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {o.payment_ref ? o.payment_ref.substring(0, 15) : '—'}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{o.download_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: API ADAPTER KEYS SETTINGS */}
        {activeTab === 'settings' && (
          <div>
            <div className="admin-header-row">
              <h2 className="admin-page-title">Payment API Gateways Config</h2>
            </div>

            {successMsg && (
              <div style={{ padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--text-success)', color: 'var(--text-success)', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 600 }}>
                ✓ {successMsg}
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="checkout-card">
              
              {/* SECTION: MPESA */}
              <h3 className="req-title" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>M-Pesa Daraja STK Push Integration</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Consumer Key</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.MPESA_CONSUMER_KEY || ''}
                    onChange={(e) => setSettings({ ...settings, MPESA_CONSUMER_KEY: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Consumer Secret</label>
                  <input
                    type="password"
                    className="form-input"
                    value={settings.MPESA_CONSUMER_SECRET || ''}
                    onChange={(e) => setSettings({ ...settings, MPESA_CONSUMER_SECRET: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Business Shortcode</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.MPESA_SHORTCODE || ''}
                    onChange={(e) => setSettings({ ...settings, MPESA_SHORTCODE: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Online Passkey</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.MPESA_PASSKEY || ''}
                    onChange={(e) => setSettings({ ...settings, MPESA_PASSKEY: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Environment</label>
                  <select
                    className="form-input"
                    value={settings.MPESA_ENV || 'sandbox'}
                    onChange={(e) => setSettings({ ...settings, MPESA_ENV: e.target.value })}
                  >
                    <option value="sandbox">Sandbox (Testing)</option>
                    <option value="live">Live (Production)</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">M-Pesa Callback URL</label>
                <input
                  type="url"
                  className="form-input"
                  value={settings.MPESA_CALLBACK_URL || ''}
                  onChange={(e) => setSettings({ ...settings, MPESA_CALLBACK_URL: e.target.value })}
                />
              </div>

              {/* SECTION: PAYPAL */}
              <h3 className="req-title" style={{ fontSize: '1.1rem', marginTop: '2rem', marginBottom: '1rem' }}>PayPal REST Integration</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Client ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.PAYPAL_CLIENT_ID || ''}
                    onChange={(e) => setSettings({ ...settings, PAYPAL_CLIENT_ID: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Client Secret</label>
                  <input
                    type="password"
                    className="form-input"
                    value={settings.PAYPAL_CLIENT_SECRET || ''}
                    onChange={(e) => setSettings({ ...settings, PAYPAL_CLIENT_SECRET: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">PayPal Mode</label>
                <select
                  className="form-input"
                  value={settings.PAYPAL_ENV || 'sandbox'}
                  onChange={(e) => setSettings({ ...settings, PAYPAL_ENV: e.target.value })}
                >
                  <option value="sandbox">Sandbox (Testing)</option>
                  <option value="live">Live (Production)</option>
                </select>
              </div>

              {/* SECTION: PAYSTACK */}
              <h3 className="req-title" style={{ fontSize: '1.1rem', marginTop: '2rem', marginBottom: '1rem' }}>Paystack Credit Cards Integration</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Public Key</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.PAYSTACK_PUBLIC_KEY || ''}
                    onChange={(e) => setSettings({ ...settings, PAYSTACK_PUBLIC_KEY: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Secret Key</label>
                  <input
                    type="password"
                    className="form-input"
                    value={settings.PAYSTACK_SECRET_KEY || ''}
                    onChange={(e) => setSettings({ ...settings, PAYSTACK_SECRET_KEY: e.target.value })}
                  />
                </div>
              </div>

              {/* SECTION: KOPO KOPO */}
              <h3 className="req-title" style={{ fontSize: '1.1rem', marginTop: '2rem', marginBottom: '1rem' }}>Kopo Kopo STK Push Integration</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Application ID / Client ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.KOPOKOPO_CLIENT_ID || ''}
                    onChange={(e) => setSettings({ ...settings, KOPOKOPO_CLIENT_ID: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Client Secret</label>
                  <input
                    type="password"
                    className="form-input"
                    value={settings.KOPOKOPO_CLIENT_SECRET || ''}
                    onChange={(e) => setSettings({ ...settings, KOPOKOPO_CLIENT_SECRET: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <input
                    type="password"
                    className="form-input"
                    value={settings.KOPOKOPO_API_KEY || ''}
                    onChange={(e) => setSettings({ ...settings, KOPOKOPO_API_KEY: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Till / Service Co. Ref</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.KOPOKOPO_SERVICE_CO_REF || ''}
                    onChange={(e) => setSettings({ ...settings, KOPOKOPO_SERVICE_CO_REF: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Environment</label>
                  <select
                    className="form-input"
                    value={settings.KOPOKOPO_ENV || 'sandbox'}
                    onChange={(e) => setSettings({ ...settings, KOPOKOPO_ENV: e.target.value })}
                  >
                    <option value="sandbox">Sandbox (Testing)</option>
                    <option value="live">Live (Production)</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="btn btn-primary pulse-primary" style={{ width: '100%', padding: '1rem', marginTop: '2rem' }}>
                Save Encryption Credentials 🔒
              </button>
            </form>
          </div>
        )}

      </main>
    </div>
  );
}

export default AdminDashboard;
