const { getSettings } = require('../db');

function hasCredentials(config) {
  return config.PAYSTACK_SECRET_KEY && config.PAYSTACK_PUBLIC_KEY;
}

async function initializeTransaction(orderId, amount, email) {
  const config = await getSettings();

  if (!hasCredentials(config)) {
    console.log(`[MOCK PAYSTACK] Initializing Mock Transaction for Order: ${orderId}, Amount: ${amount}, Email: ${email}`);
    return {
      status: true,
      message: "Authorization URL created",
      data: {
        authorization_url: `http://localhost:5173/checkout/success?reference=${orderId}&gateway=paystack&mock=true`,
        access_code: `mock-paystack-code-${Math.random().toString(36).substring(2, 8)}`,
        reference: orderId
      },
      isMock: true
    };
  }

  const payload = {
    email: email,
    amount: Math.round(amount * 100), // Paystack expects amount in kobo/cents
    reference: orderId,
    callback_url: `http://localhost:5173/checkout/success?gateway=paystack`
  };

  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok || !data.status) {
      throw new Error(data.message || 'Paystack initialization failed');
    }
    return data;
  } catch (error) {
    console.error('Paystack Initialize Error:', error.message);
    throw error;
  }
}

async function verifyTransaction(reference) {
  const config = await getSettings();

  if (!hasCredentials(config) || reference.startsWith('mock_') || reference.length < 15) {
    // If it's a mock checkout reference
    console.log(`[MOCK PAYSTACK] Verifying Mock Reference: ${reference}`);
    return {
      status: true,
      message: "Verification successful",
      data: {
        id: Math.floor(Math.random() * 100000),
        domain: "test",
        status: "success",
        reference: reference,
        amount: 5000,
        gateway_response: "Successful",
        channel: "card",
        customer: { email: "customer@brane.com" }
      },
      isMock: true
    };
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.PAYSTACK_SECRET_KEY}`
      }
    });

    const data = await response.json();
    if (!response.ok || !data.status) {
      throw new Error(data.message || 'Paystack verification failed');
    }
    return data;
  } catch (error) {
    console.error('Paystack Verification Error:', error.message);
    throw error;
  }
}

module.exports = {
  initializeTransaction,
  verifyTransaction
};
