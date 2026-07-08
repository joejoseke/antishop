import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    const token = localStorage.getItem('brane_admin_token');
    if (token) {
      navigate('/admin');
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('brane_admin_token', data.token);
      localStorage.setItem('brane_admin_user', data.username);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 100px)', padding: '2rem 0' }}>
      <div className="checkout-card" style={{ width: '100%', maxWidth: '420px', backdropFilter: 'blur(16px)', border: '1px solid var(--primary)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', textTransform: 'uppercase', background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '2px', fontWeight: 'bold' }}>
            BRANE ADMIN
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            AUTHORIZED OPERATIONS GATEWAY ONLY
          </p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', backgroundColor: 'rgba(244, 63, 94, 0.15)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1.25rem', textAlign: 'center', fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Operator Username</label>
            <input
              type="text"
              className="form-input"
              required
              placeholder="e.g. admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Access Passphrase</label>
            <input
              type="password"
              className="form-input"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary pulse-primary"
            style={{ width: '100%', padding: '1rem', marginTop: '1.5rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Establish Secure Connection ⚡'}
          </button>
        </form>
        
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← Back to Storefront
          </Link>
        </div>
      </div>
    </div>
  );
}

// Inline Link fallback import helper
import { Link } from 'react-router-dom';

export default AdminLogin;
