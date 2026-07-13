const mysql = require('mysql2');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Ensure directories exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create mock downloadable files if they don't exist
const mockFiles = {
  'cyberquest_2077_installer.exe': 'CyberQuest 2077 Full Game Installer Content',
  'astroriders_setup.exe': 'AstroRiders Setup Binary Content',
  'codebreaker_level_editor.exe': 'CodeBreaker Sandbox Edition Setup',
  'braneos_dev_suite_x64.zip': 'BraneOS Developer Suite Enterprise ISO',
  'antivirus_pro_2026.msi': 'Antivirus Pro 2026 Core Protection Installer',
  'officegrid_pro.msi': 'OfficeGrid Suite Suite Setup Utility'
};

Object.entries(mockFiles).forEach(([filename, content]) => {
  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
  }
});

// Configure MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || '37.139.17.247',
  user: 'zgfqgdok_sa',
  password: 'Brane@2025#',
  database: 'zqfqgdok_shopdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// SQL translator utility
function translateSql(sql) {
  if (typeof sql !== 'string') return sql;
  let translated = sql.replace(/INSERT OR REPLACE INTO/gi, 'REPLACE INTO');
  translated = translated.replace(/\bwhere\s+key\b/gi, 'WHERE `key`');
  translated = translated.replace(/\bsettings\s*\(\s*key\b/gi, 'settings (`key`');
  translated = translated.replace(/\bselect\s+key\s*,/gi, 'SELECT `key`,');
  translated = translated.replace(/\border\s+by\s+key\b/gi, 'ORDER BY `key`');
  translated = translated.replace(/\bkey\s*=\s*\?/gi, '`key` = ?');
  return translated;
}

// SQLite compatibility layer
const db = {
  get: function(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    const translated = translateSql(sql);
    pool.query(translated, params, (err, results) => {
      if (err) {
        if (callback) callback(err);
      } else {
        if (callback) callback(null, results && results.length > 0 ? results[0] : null);
      }
    });
  },

  all: function(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    const translated = translateSql(sql);
    pool.query(translated, params, (err, results) => {
      if (err) {
        if (callback) callback(err);
      } else {
        if (callback) callback(null, results || []);
      }
    });
  },

  run: function(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    const translated = translateSql(sql);
    pool.query(translated, params, function(err, results) {
      if (err) {
        if (callback) callback(err);
      } else {
        if (callback) {
          const context = results ? { lastID: results.insertId, changes: results.affectedRows } : {};
          callback.call(context, null);
        }
      }
    });
  },

  prepare: function(sql) {
    const translated = translateSql(sql);
    return {
      run: function(...args) {
        let params = args;
        let cb = null;
        if (typeof args[args.length - 1] === 'function') {
          cb = params.pop();
        }
        if (params.length === 1 && Array.isArray(params[0])) {
          params = params[0];
        }
        pool.query(translated, params, function(err, results) {
          if (cb) {
            const context = results ? { lastID: results.insertId, changes: results.affectedRows } : {};
            cb.call(context, err);
          }
        });
      },
      finalize: function(cb) {
        if (cb) cb();
      }
    };
  },

  serialize: function(callback) {
    if (callback) callback();
  }
};

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Initialise DB Schema in serial sequence
const queries = [
  // 1. Admin Users Table
  `CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE,
    password TEXT
  )`,
  
  // 2. Products Table
  `CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    category VARCHAR(100),
    price DECIMAL(10,2),
    image_url TEXT,
    download_file VARCHAR(255),
    license_keys TEXT,
    system_req TEXT
  )`,

  // 3. Orders Table
  `CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(255) UNIQUE,
    email VARCHAR(255),
    phone VARCHAR(50),
    total DECIMAL(10,2),
    status VARCHAR(50),
    payment_method VARCHAR(50),
    payment_ref VARCHAR(255),
    download_count INT DEFAULT 0,
    created_at VARCHAR(100)
  )`,

  // 4. Order Items Table
  `CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(255),
    product_id INT,
    product_title VARCHAR(255),
    price DECIMAL(10,2),
    license_key VARCHAR(255)
  )`,

  // 5. Payment Settings Table
  `CREATE TABLE IF NOT EXISTS settings (
    \`key\` VARCHAR(255) PRIMARY KEY,
    value TEXT
  )`
];

function runInitQueries(index = 0) {
  if (index >= queries.length) {
    seedData();
    return;
  }
  pool.query(queries[index], (err) => {
    if (err) {
      console.error(`Error initializing schema query ${index}:`, err.message);
    }
    runInitQueries(index + 1);
  });
}

function seedData() {
  // Seed Default Admin
  db.get("SELECT * FROM admin_users WHERE username = 'admin'", (err, row) => {
    if (err) console.error(err);
    if (!row) {
      const defaultPass = hashPassword('admin123');
      db.run("INSERT INTO admin_users (username, password) VALUES (?, ?)", ['admin', defaultPass], (err) => {
        if (err) console.error('Error seeding admin user:', err.message);
        else console.log('Default admin seeded (admin/admin123)');
      });
    }
  });

  // Seed Initial Products
  db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
    if (err) console.error(err);
    if (row && row.count === 0) {
      const initialProducts = [
        {
          title: 'CyberQuest 2077',
          description: 'A premium sci-fi open-world action RPG set in the mega-city of the future. Customize your cybernetics, explore endless neon streets, and make choices that shape the narrative.',
          category: 'gaming',
          price: 7800,
          image_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop',
          download_file: 'cyberquest_2077_installer.exe',
          license_keys: JSON.stringify(['CYBER-Q98A-38X1-KLS8', 'CYBER-27X9-10PA-LQ92', 'CYBER-77PL-99AA-ZZ01']),
          system_req: JSON.stringify({
            os: 'Windows 10/11 64-bit',
            processor: 'Intel Core i7-8700K or AMD Ryzen 5 3600X',
            memory: '16 GB RAM',
            graphics: 'NVIDIA GeForce RTX 2060 or AMD Radeon RX 5700 XT',
            storage: '70 GB available space'
          })
        },
        {
          title: 'AstroRiders',
          description: 'High-speed multiplayer anti-gravity racing across neon tracks suspended in deep space. Experience extreme physics, custom spacecraft, and a pumping electronic soundtrack.',
          category: 'gaming',
          price: 2600,
          image_url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=600&auto=format&fit=crop',
          download_file: 'astroriders_setup.exe',
          license_keys: JSON.stringify(['ASTRO-RIDER-8902', 'ASTRO-RIDER-7711', 'ASTRO-RIDER-3498']),
          system_req: JSON.stringify({
            os: 'Windows 10 64-bit',
            processor: 'Intel Core i5-4590 or AMD FX 8350',
            memory: '8 GB RAM',
            graphics: 'NVIDIA GeForce GTX 970 or AMD Radeon R9 290',
            storage: '12 GB available space'
          })
        },
        {
          title: 'CodeBreaker',
          description: 'A hacking and grid-decryption puzzle game. Write short logic commands, bypass security firewalls, and uncover a dark corporate conspiracy in a stylized terminal-style UI.',
          category: 'gaming',
          price: 1300,
          image_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=600&auto=format&fit=crop',
          download_file: 'codebreaker_level_editor.exe',
          license_keys: JSON.stringify(['CDB-FREE-KEY-888', 'CDB-LICENSE-999', 'CDB-DEV-KEY-111']),
          system_req: JSON.stringify({
            os: 'Windows 7/8/10/11',
            processor: '1.6 GHz Dual Core',
            memory: '4 GB RAM',
            graphics: 'Intel HD Graphics 4000',
            storage: '500 MB available space'
          })
        },
        {
          title: 'BraneOS Dev Suite',
          description: 'The ultimate power environment for web and systems developers. Comes with built-in virtualization containers, an offline syntax documentation database, and a highly customizable GPU-accelerated terminal.',
          category: 'software',
          price: 16900,
          image_url: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?q=80&w=600&auto=format&fit=crop',
          download_file: 'braneos_dev_suite_x64.zip',
          license_keys: JSON.stringify(['BRN-DEV-98X2-K9A1', 'BRN-DEV-77P1-LK88', 'BRN-DEV-34MM-QQ91']),
          system_req: JSON.stringify({
            os: 'Windows 10/11 Pro 64-bit',
            processor: 'Intel Core i7 or AMD Ryzen 7',
            memory: '32 GB RAM',
            graphics: 'Integrated or Dedicated GPU (supports Vulkan)',
            storage: '15 GB available space'
          })
        },
        {
          title: 'Antivirus Pro 2026',
          description: 'Real-time AI-powered protection against malware, ransomware, and network intrusions. Features lightweight background scans and a secure sandbox environment for running suspicious executables.',
          category: 'software',
          price: 3900,
          image_url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=600&auto=format&fit=crop',
          download_file: 'antivirus_pro_2026.msi',
          license_keys: JSON.stringify(['AV-PRO-2026-X1', 'AV-PRO-2026-Y2', 'AV-PRO-2026-Z3']),
          system_req: JSON.stringify({
            os: 'Windows 10/11',
            processor: '1 GHz Processor',
            memory: '2 GB RAM',
            graphics: 'DirectX 9 or later',
            storage: '2 GB available space'
          })
        },
        {
          title: 'OfficeGrid Suite',
          description: 'A fully offline-first alternative to document, spreadsheet, and slide creation. Includes advanced mathematical modelling sheets and exports to all open standards securely.',
          category: 'software',
          price: 6500,
          image_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=600&auto=format&fit=crop',
          download_file: 'officegrid_pro.msi',
          license_keys: JSON.stringify(['OG-SUITE-45A9-BB22', 'OG-SUITE-12L9-MM38', 'OG-SUITE-99V0-PZ10']),
          system_req: JSON.stringify({
            os: 'Windows 8.1/10/11',
            processor: '1.4 GHz Processor',
            memory: '4 GB RAM',
            graphics: 'DirectX 10 compatible',
            storage: '4 GB available space'
          })
        }
      ];

      const stmt = db.prepare("INSERT INTO products (title, description, category, price, image_url, download_file, license_keys, system_req) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      initialProducts.forEach(p => {
        stmt.run(p.title, p.description, p.category, p.price, p.image_url, p.download_file, p.license_keys, p.system_req);
      });
      stmt.finalize();
      console.log('Initial products seeded successfully.');
    }
  });

  // Seed Default Configuration Settings
  db.get("SELECT COUNT(*) as count FROM settings", (err, row) => {
    if (err) console.error(err);
    if (row && row.count === 0) {
      const defaultSettings = {
        'MPESA_CONSUMER_KEY': 'OX1elcYFod17uQfvMj6AWRifd7kpEhBIzc8QMhMAg00ZxTtv',
        'MPESA_CONSUMER_SECRET': '9iOLeWLBAnS6n3GtbzD7cUJsVHYk8I4sDBP4bCsHGxFxMpQuTyJ874IR5nsHuQ9S',
        'MPESA_SHORTCODE': '6211272',
        'MPESA_PASSKEY': 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
        'MPESA_CALLBACK_URL': 'http://localhost:5000/api/payments/mpesa/callback',
        'MPESA_ENV': 'sandbox',
        
        'PAYPAL_CLIENT_ID': '',
        'PAYPAL_CLIENT_SECRET': '',
        'PAYPAL_ENV': 'sandbox',

        'PAYSTACK_PUBLIC_KEY': '',
        'PAYSTACK_SECRET_KEY': '',

        'KOPOKOPO_CLIENT_ID': '',
        'KOPOKOPO_CLIENT_SECRET': '',
        'KOPOKOPO_API_KEY': '',
        'KOPOKOPO_ENV': 'sandbox',
        'KOPOKOPO_SERVICE_CO_REF': ''
      };

      const stmt = db.prepare("INSERT INTO settings (`key`, value) VALUES (?, ?)");
      Object.entries(defaultSettings).forEach(([k, v]) => {
        stmt.run(k, v);
      });
      stmt.finalize();
      console.log('Payment configurations initialized.');
    }
  });
}

// Start database initialization
runInitQueries(0);

function getSetting(key) {
  return new Promise((resolve, reject) => {
    db.get("SELECT value FROM settings WHERE `key` = ?", [key], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.value : null);
    });
  });
}

function getSettings() {
  return new Promise((resolve, reject) => {
    db.all("SELECT `key`, value FROM settings", (err, rows) => {
      if (err) reject(err);
      else {
        const config = {};
        rows.forEach(r => { config[r.key] = r.value; });
        resolve(config);
      }
    });
  });
}

module.exports = {
  db,
  hashPassword,
  getSetting,
  getSettings
};
