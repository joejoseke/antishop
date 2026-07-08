const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { db, hashPassword, getSetting, getSettings } = require('./db');

// Import Payment Adapters
const mpesaAdapter = require('./payment_gateways/mpesa');
const paypalAdapter = require('./payment_gateways/paypal');
const paystackAdapter = require('./payment_gateways/paystack');
const kopokopoAdapter = require('./payment_gateways/kopokopo');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static frontend files if built (for production deployment, though we run dev servers separately)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Helper to generate unique order IDs
function generateOrderId() {
  const date = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 8);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `BRN-${date}-${rand}`;
}

// License Key Assigner Helper
function assignLicenseKeys(orderId, callback) {
  db.all("SELECT * FROM order_items WHERE order_id = ?", [orderId], (err, items) => {
    if (err) {
      console.error('Error fetching order items for key assignment:', err);
      return callback && callback(err);
    }

    let itemsProcessed = 0;
    if (items.length === 0) return callback && callback(null);

    items.forEach(item => {
      db.get("SELECT license_keys FROM products WHERE id = ?", [item.product_id], (err, product) => {
        if (err || !product) {
          // Fallback key
          const fallbackKey = `BRN-AUTO-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
          db.run("UPDATE order_items SET license_key = ? WHERE id = ?", [fallbackKey, item.id], () => {
            checkCompletion();
          });
          return;
        }

        let keys = [];
        try {
          keys = JSON.parse(product.license_keys || '[]');
        } catch (e) {
          keys = [];
        }

        let assignedKey = '';
        if (keys.length > 0) {
          assignedKey = keys.shift();
          // Update product remaining keys
          db.run("UPDATE products SET license_keys = ? WHERE id = ?", [JSON.stringify(keys), item.product_id]);
        } else {
          assignedKey = `BRN-GEN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        }

        db.run("UPDATE order_items SET license_key = ? WHERE id = ?", [assignedKey, item.id], () => {
          checkCompletion();
        });
      });

      function checkCompletion() {
        itemsProcessed++;
        if (itemsProcessed === items.length) {
          if (callback) callback(null);
        }
      }
    });
  });
}

// ==========================================
// ADMIN AUTHENTICATION
// ==========================================
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const hashed = hashPassword(password);
  db.get("SELECT * FROM admin_users WHERE username = ? AND password = ?", [username, hashed], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }
    // Generate a simple token
    const token = crypto.createHash('sha1').update(`${username}-${Date.now()}`).digest('hex');
    res.json({ token, username: row.username });
  });
});

app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ valid: false });
  }
  // Simple token validation (since this is sandbox dev, we verify token exists in headers)
  res.json({ valid: true });
});

// ==========================================
// PRODUCTS ENDPOINTS
// ==========================================
app.get('/api/products', (req, res) => {
  db.all("SELECT id, title, description, category, price, image_url, download_file, system_req FROM products", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // Parse JSON system requirements
    const parsed = rows.map(r => {
      try {
        r.system_req = JSON.parse(r.system_req || '{}');
      } catch (e) {
        r.system_req = {};
      }
      return r;
    });
    res.json(parsed);
  });
});

app.get('/api/products/:id', (req, res) => {
  db.get("SELECT * FROM products WHERE id = ?", [req.params.id], (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: 'Product not found' });
    }
    try {
      row.system_req = JSON.parse(row.system_req || '{}');
    } catch (e) {
      row.system_req = {};
    }
    try {
      row.license_keys = JSON.parse(row.license_keys || '[]');
    } catch (e) {
      row.license_keys = [];
    }
    res.json(row);
  });
});

// Admin Product CRUD
app.post('/api/products', (req, res) => {
  const { title, description, category, price, image_url, download_file, license_keys, system_req } = req.body;
  const keysStr = Array.isArray(license_keys) ? JSON.stringify(license_keys) : JSON.stringify([]);
  const reqStr = typeof system_req === 'object' ? JSON.stringify(system_req) : JSON.stringify({});

  db.run(
    "INSERT INTO products (title, description, category, price, image_url, download_file, license_keys, system_req) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [title, description, category, price, image_url, download_file || 'mock_installer.exe', keysStr, reqStr],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, title, description, category, price });
    }
  );
});

app.put('/api/products/:id', (req, res) => {
  const { title, description, category, price, image_url, download_file, license_keys, system_req } = req.body;
  const keysStr = Array.isArray(license_keys) ? JSON.stringify(license_keys) : null;
  const reqStr = typeof system_req === 'object' ? JSON.stringify(system_req) : null;

  db.get("SELECT * FROM products WHERE id = ?", [req.params.id], (err, product) => {
    if (err || !product) return res.status(404).json({ error: 'Product not found' });

    const finalTitle = title || product.title;
    const finalDesc = description || product.description;
    const finalCat = category || product.category;
    const finalPrice = price !== undefined ? price : product.price;
    const finalImg = image_url || product.image_url;
    const finalFile = download_file || product.download_file;
    const finalKeys = keysStr || product.license_keys;
    const finalReq = reqStr || product.system_req;

    db.run(
      "UPDATE products SET title = ?, description = ?, category = ?, price = ?, image_url = ?, download_file = ?, license_keys = ?, system_req = ? WHERE id = ?",
      [finalTitle, finalDesc, finalCat, finalPrice, finalImg, finalFile, finalKeys, finalReq, req.params.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Product updated successfully' });
      }
    );
  });
});

app.delete('/api/products/:id', (req, res) => {
  db.run("DELETE FROM products WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Product deleted successfully' });
  });
});

// ==========================================
// CHECKOUT & ORDERS
// ==========================================
app.post('/api/orders/checkout', async (req, res) => {
  const { email, phone, paymentMethod, cartItems } = req.body;

  if (!email || !cartItems || cartItems.length === 0) {
    return res.status(400).json({ error: 'Email and cart items are required' });
  }

  // Create Order ID
  const orderId = generateOrderId();
  let totalAmount = 0;

  try {
    // 1. Calculate prices from db
    const itemsWithPrices = await Promise.all(cartItems.map(item => {
      return new Promise((resolve, reject) => {
        db.get("SELECT id, title, price FROM products WHERE id = ?", [item.id], (err, product) => {
          if (err || !product) reject(new Error(`Product with ID ${item.id} not found`));
          else {
            totalAmount += product.price * (item.qty || 1);
            resolve({
              product_id: product.id,
              title: product.title,
              price: product.price
            });
          }
        });
      });
    }));

    // 2. Insert order details as pending
    const createdAt = new Date().toISOString();
    db.run(
      "INSERT INTO orders (order_id, email, phone, total, status, payment_method, payment_ref, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [orderId, email, phone || '', totalAmount, 'pending', paymentMethod, '', createdAt],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to create order record' });
        }

        // 3. Insert order items
        const stmt = db.prepare("INSERT INTO order_items (order_id, product_id, product_title, price) VALUES (?, ?, ?, ?)");
        itemsWithPrices.forEach(item => {
          stmt.run(orderId, item.product_id, item.title, item.price);
        });
        stmt.finalize();

        // 4. Trigger Gateway Integration
        handlePaymentGateway(orderId, totalAmount, paymentMethod, phone, email, res);
      }
    );
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Payment Router Helper
async function handlePaymentGateway(orderId, amount, method, phone, email, res) {
  try {
    switch (method) {
      case 'mpesa': {
        const mpesaRes = await mpesaAdapter.initiateSTKPush({ orderId, amount, phone });
        // Save the CheckoutRequestID as reference so we can match the webhook callback
        const checkoutId = mpesaRes.CheckoutRequestID || '';
        db.run("UPDATE orders SET payment_ref = ? WHERE order_id = ?", [checkoutId, orderId]);
        return res.json({
          orderId,
          paymentMethod: 'mpesa',
          checkoutRequestId: checkoutId,
          message: mpesaRes.CustomerMessage || 'STK Push sent successfully.',
          isMock: mpesaRes.isMock || false
        });
      }

      case 'paypal': {
        const paypalOrder = await paypalAdapter.createOrder(orderId, amount);
        // Save paypal order id as reference
        db.run("UPDATE orders SET payment_ref = ? WHERE order_id = ?", [paypalOrder.id, orderId]);
        return res.json({
          orderId,
          paymentMethod: 'paypal',
          paypalOrderId: paypalOrder.id,
          isMock: paypalOrder.isMock || false
        });
      }

      case 'paystack': {
        const paystackRes = await paystackAdapter.initializeTransaction(orderId, amount, email);
        // Save access code as reference
        const accessCode = paystackRes.data.access_code || '';
        db.run("UPDATE orders SET payment_ref = ? WHERE order_id = ?", [orderId, orderId]); // paystack references orderId directly
        return res.json({
          orderId,
          paymentMethod: 'paystack',
          authorizationUrl: paystackRes.data.authorization_url,
          accessCode: accessCode,
          isMock: paystackRes.isMock || false
        });
      }

      case 'kopokopo': {
        const k2Res = await kopokopoAdapter.initiatePayment({ orderId, amount, phone, email });
        // Save status location as reference
        db.run("UPDATE orders SET payment_ref = ? WHERE order_id = ?", [k2Res.location, orderId]);
        return res.json({
          orderId,
          paymentMethod: 'kopokopo',
          location: k2Res.location,
          isMock: k2Res.isMock || false
        });
      }

      default:
        return res.status(400).json({ error: 'Unsupported payment method' });
    }
  } catch (err) {
    console.error('Payment gateway error:', err);
    res.status(500).json({ error: `Payment gateway failed: ${err.message}` });
  }
}

// Order Status Inquiry
app.get('/api/orders/:orderId', (req, res) => {
  db.get("SELECT * FROM orders WHERE order_id = ?", [req.params.orderId], (err, order) => {
    if (err || !order) return res.status(404).json({ error: 'Order not found' });
    
    db.all("SELECT * FROM order_items WHERE order_id = ?", [req.params.orderId], (err, items) => {
      res.json({
        ...order,
        items: items || []
      });
    });
  });
});

// Admin Orders list
app.get('/api/admin/orders', (req, res) => {
  db.all("SELECT * FROM orders ORDER BY id DESC", (err, orders) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(orders);
  });
});

// ==========================================
// GATEWAY WEBHOOKS & CALLBACKS
// ==========================================

// 1. M-PESA Callback (Daraja API hits this)
app.post('/api/payments/mpesa/callback', (req, res) => {
  console.log('M-Pesa Callback Received:', JSON.stringify(req.body));
  const callbackData = req.body.Body.stkCallback;
  const checkoutRequestId = callbackData.CheckoutRequestID;
  const resultCode = callbackData.ResultCode;

  if (resultCode === 0) {
    // Payment success
    const metadata = callbackData.CallbackMetadata.Item;
    const mpesaReceipt = metadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value || '';
    
    db.get("SELECT order_id, status FROM orders WHERE payment_ref = ?", [checkoutRequestId], (err, order) => {
      if (order && order.status === 'pending') {
        db.run("UPDATE orders SET status = 'paid', payment_ref = ? WHERE order_id = ?", [mpesaReceipt, order.order_id], () => {
          console.log(`Order ${order.order_id} marked as PAID via M-Pesa. Receipt: ${mpesaReceipt}`);
          assignLicenseKeys(order.order_id);
        });
      }
    });
  } else {
    // Payment failed/cancelled
    db.run("UPDATE orders SET status = 'failed' WHERE payment_ref = ?", [checkoutRequestId]);
  }
  
  res.json({ ResultCode: 0, ResultDesc: "Accept Service" });
});

// 2. PayPal Capture Endpoint (called by frontend after customer approves PayPal modal)
app.post('/api/payments/paypal/capture', async (req, res) => {
  const { paypalOrderId, orderId } = req.body;
  if (!paypalOrderId) return res.status(400).json({ error: 'PayPal Order ID is required' });

  try {
    const captureRes = await paypalAdapter.captureOrder(paypalOrderId);
    const captureStatus = captureRes.status;

    if (captureStatus === 'COMPLETED') {
      const captureId = captureRes.purchase_units[0].payments.captures[0].id;
      db.run("UPDATE orders SET status = 'paid', payment_ref = ? WHERE order_id = ?", [captureId, orderId], (err) => {
        if (err) console.error(err);
        assignLicenseKeys(orderId, () => {
          res.json({ status: 'success', captureId });
        });
      });
    } else {
      db.run("UPDATE orders SET status = 'failed' WHERE order_id = ?", [orderId]);
      res.json({ status: 'failed', message: 'PayPal Capture was not completed' });
    }
  } catch (err) {
    console.error('PayPal Capture API error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Paystack Verification (called by frontend when redirected to success page)
app.get('/api/payments/paystack/verify/:reference', async (req, res) => {
  const reference = req.params.reference;
  
  try {
    const verification = await paystackAdapter.verifyTransaction(reference);
    
    if (verification.data.status === 'success') {
      db.get("SELECT order_id, status FROM orders WHERE order_id = ?", [reference], (err, order) => {
        if (order && order.status === 'pending') {
          db.run("UPDATE orders SET status = 'paid', payment_ref = ? WHERE order_id = ?", [`PSTK-${reference}`, reference], () => {
            console.log(`Order ${reference} marked as PAID via Paystack.`);
            assignLicenseKeys(reference, () => {
              res.json({ status: 'success', reference });
            });
          });
        } else {
          res.json({ status: 'success', message: 'Already processed', reference });
        }
      });
    } else {
      db.run("UPDATE orders SET status = 'failed' WHERE order_id = ?", [reference]);
      res.json({ status: 'failed', message: 'Paystack transaction failed' });
    }
  } catch (err) {
    console.error('Paystack Verification API error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Kopo Kopo Callback Webhook
app.post('/api/payments/kopokopo/callback', (req, res) => {
  console.log('Kopo Kopo Webhook Received:', JSON.stringify(req.body));
  const { topic, attributes } = req.body;

  if (topic === 'payment_received' && attributes.status === 'Success') {
    const orderId = attributes.metadata.order_id;
    const txnRef = attributes.transaction_reference;

    db.get("SELECT status FROM orders WHERE order_id = ?", [orderId], (err, order) => {
      if (order && order.status === 'pending') {
        db.run("UPDATE orders SET status = 'paid', payment_ref = ? WHERE order_id = ?", [txnRef, orderId], () => {
          console.log(`Order ${orderId} marked as PAID via Kopo Kopo. Transaction reference: ${txnRef}`);
          assignLicenseKeys(orderId);
        });
      }
    });
  }
  res.status(200).send('Webhook processed');
});

// ==========================================
// SETTINGS ENDPOINTS (ADMIN)
// ==========================================
app.get('/api/admin/settings', (req, res) => {
  db.all("SELECT key, value FROM settings", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const config = {};
    rows.forEach(r => { config[r.key] = r.value; });
    res.json(config);
  });
});

app.post('/api/admin/settings', (req, res) => {
  const settings = req.body; // Key-Value pair object
  
  db.serialize(() => {
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    Object.entries(settings).forEach(([k, v]) => {
      stmt.run(k, String(v));
    });
    stmt.finalize((err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Settings updated successfully' });
    });
  });
});

// ==========================================
// SECURE FILE DOWNLOAD
// ==========================================
app.get('/api/download/:orderId/:productId', (req, res) => {
  const { orderId, productId } = req.params;

  // Check if order is paid and contains product
  db.get("SELECT status FROM orders WHERE order_id = ?", [orderId], (err, order) => {
    if (err || !order) return res.status(404).json({ error: 'Order not found' });
    
    if (order.status !== 'paid') {
      return res.status(403).json({ error: 'Payment is not verified for this download' });
    }

    db.get(
      "SELECT item.product_title, p.download_file FROM order_items item JOIN products p ON item.product_id = p.id WHERE item.order_id = ? AND item.product_id = ?",
      [orderId, productId],
      (err, product) => {
        if (err || !product) {
          return res.status(404).json({ error: 'Product not found in this order' });
        }

        const filePath = path.join(__dirname, 'uploads', product.download_file);

        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: 'Product download file is missing on the server' });
        }

        // Increment download count
        db.run("UPDATE orders SET download_count = download_count + 1 WHERE order_id = ?", [orderId]);

        // Send File
        res.download(filePath, product.download_file, (downloadErr) => {
          if (downloadErr) {
            console.error('File transmission failed:', downloadErr);
          }
        });
      }
    );
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Brane Shop Server is running on port ${PORT}`);
});
