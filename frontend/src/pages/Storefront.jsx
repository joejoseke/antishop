import React, { useState, useEffect } from 'react';

function Storefront({ addToCart }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch Products from Backend
  useEffect(() => {
    fetch('http://localhost:5000/api/products')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load store products.');
        return res.json();
      })
      .then(data => {
        setProducts(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Filter Logic
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.title.toLowerCase().includes(search.toLowerCase()) ||
                          product.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'all' || product.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="container" style={{ paddingBottom: '5rem' }}>
      
      {/* Hero Section */}
      <section className="hero">
        <h1 className="hero-title">NEXT-GEN DIGITAL STORE</h1>
        <p className="hero-subtitle">
          Instantly purchase, download, and activate premium game binaries, enterprise software licenses, and developer utilities. Secure checkout powered by M-Pesa, PayPal, and credit cards.
        </p>
      </section>

      {/* Search and Filters */}
      <div className="store-controls">
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search game titles, license software, compilers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="filter-tabs">
          <button
            className={`filter-tab ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            All Products
          </button>
          <button
            className={`filter-tab ${activeCategory === 'gaming' ? 'active' : ''}`}
            onClick={() => setActiveCategory('gaming')}
          >
            Gaming
          </button>
          <button
            className={`filter-tab ${activeCategory === 'software' ? 'active' : ''}`}
            onClick={() => setActiveCategory('software')}
          >
            Software
          </button>
        </div>
      </div>

      {/* Loading States */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-muted)' }}>
          <div className="pulse-primary" style={{ display: 'inline-block', width: '50px', height: '50px', borderRadius: '50%', border: '4px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: '1.5rem', fontWeight: 600 }}>Loading catalog from server...</p>
        </div>
      )}

      {error && (
        <div className="checkout-card" style={{ borderLeft: '4px solid var(--accent)', margin: '2rem 0', textAlign: 'center' }}>
          <p style={{ color: 'var(--accent)', fontWeight: 'bold' }}>⚠️ Connection Error</p>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>{error}</p>
          <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => window.location.reload()}>Retry Connection</button>
        </div>
      )}

      {/* Product Display Grid */}
      {!loading && !error && (
        <>
          {filteredProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-muted)' }}>
              <h3>No products found matching your search.</h3>
              <p style={{ marginTop: '0.5rem' }}>Try clearing filters or search terms.</p>
            </div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map(p => (
                <div className="product-card" key={p.id}>
                  <div className="product-img-container" onClick={() => setSelectedProduct(p)} style={{ cursor: 'pointer' }}>
                    <img src={p.image_url} alt={p.title} className="product-img" />
                    <span className="product-category-tag">{p.category}</span>
                  </div>
                  
                  <div className="product-info">
                    <h3 className="product-title" onClick={() => setSelectedProduct(p)} style={{ cursor: 'pointer' }}>
                      {p.title}
                    </h3>
                    <p className="product-desc">
                      {p.description.length > 120 ? `${p.description.substring(0, 115)}...` : p.description}
                    </p>
                    
                    <div className="product-meta">
                      <div className="product-price">${p.price.toFixed(2)}</div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-outline" style={{ padding: '0.5rem 1rem' }} onClick={() => setSelectedProduct(p)}>
                          Details
                        </button>
                        <button className="btn btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={() => addToCart(p)}>
                          + Cart
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Product Detail Modal overlay */}
      {selectedProduct && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '2rem' }}>
            <button className="modal-close-btn" onClick={() => setSelectedProduct(null)}>×</button>
            
            <div className="product-detail-layout">
              <div>
                <img src={selectedProduct.image_url} alt={selectedProduct.title} className="product-detail-img" />
              </div>
              
              <div className="product-detail-info">
                <h2 className="product-detail-title">{selectedProduct.title}</h2>
                <div className="product-detail-price">${selectedProduct.price.toFixed(2)}</div>
                
                <p className="product-detail-description">
                  {selectedProduct.description}
                </p>
                
                {selectedProduct.system_req && Object.keys(selectedProduct.system_req).length > 0 && (
                  <div>
                    <h4 className="req-title">System Requirements</h4>
                    <div className="req-grid">
                      {selectedProduct.system_req.os && <span><strong>OS:</strong> {selectedProduct.system_req.os}</span>}
                      {selectedProduct.system_req.processor && <span><strong>CPU:</strong> {selectedProduct.system_req.processor}</span>}
                      {selectedProduct.system_req.memory && <span><strong>RAM:</strong> {selectedProduct.system_req.memory}</span>}
                      {selectedProduct.system_req.graphics && <span><strong>GPU:</strong> {selectedProduct.system_req.graphics}</span>}
                      {selectedProduct.system_req.storage && <span><strong>DISK:</strong> {selectedProduct.system_req.storage}</span>}
                    </div>
                  </div>
                )}
                
                <button
                  className="btn btn-primary pulse-primary"
                  style={{ width: '100%', marginTop: 'auto', padding: '1rem' }}
                  onClick={() => {
                    addToCart(selectedProduct);
                    setSelectedProduct(null);
                  }}
                >
                  Add To Download Cart 🚀
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Storefront;
