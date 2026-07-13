#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

function usage() {
  console.log('Usage: node add_product.js --file product.json');
  console.log('Or: node add_product.js --title "Name" --price 9.99 --category gaming --image_url URL --download_file filename.exe --license_keys KEY1,KEY2');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) usage();

const opts = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--file' && args[i+1]) { opts.file = args[++i]; }
  else if (a.startsWith('--') && args[i+1]) { opts[a.replace(/^--/, '')] = args[++i]; }
}

let product = null;
if (opts.file) {
  const p = path.resolve(process.cwd(), opts.file);
  if (!fs.existsSync(p)) {
    console.error('File not found:', p);
    process.exit(2);
  }
  try {
    product = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error('Failed to parse JSON file:', e.message);
    process.exit(3);
  }
} else {
  if (!opts.title || !opts.price) usage();
  product = {
    title: opts.title,
    description: opts.description || '',
    category: opts.category || 'software',
    price: parseFloat(opts.price) || 0,
    image_url: opts.image_url || '',
    download_file: opts.download_file || 'installer.exe',
    license_keys: (opts.license_keys || '').split(',').map(s => s.trim()).filter(Boolean),
    system_req: {}
  };
}

// Normalize fields
product.license_keys = Array.isArray(product.license_keys) ? product.license_keys : [];
product.system_req = typeof product.system_req === 'object' ? product.system_req : {};

const dbPath = path.join(__dirname, 'data', 'shop.db');
const db = new sqlite3.Database(dbPath);

db.run(
  "INSERT INTO products (title, description, category, price, image_url, download_file, license_keys, system_req) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  [
    product.title,
    product.description || '',
    product.category || 'software',
    product.price || 0,
    product.image_url || '',
    product.download_file || 'installer.exe',
    JSON.stringify(product.license_keys || []),
    JSON.stringify(product.system_req || {})
  ],
  function (err) {
    if (err) {
      console.error('Failed to insert product:', err.message);
      process.exit(4);
    }
    console.log('Product inserted with id:', this.lastID);
    process.exit(0);
  }
);
