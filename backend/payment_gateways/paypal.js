const { getSettings } = require('../db');

function hasCredentials(config) {
  return config.PAYPAL_CLIENT_ID && config.PAYPAL_CLIENT_SECRET;
}

function getBaseUrl(config) {
  return config.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken(config) {
  const baseUrl = getBaseUrl(config);
  const auth = Buffer.from(`${config.PAYPAL_CLIENT_ID}:${config.PAYPAL_CLIENT_SECRET}`).toString('base64');
  
  try {
    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    
    if (!response.ok) {
      throw new Error(`PayPal Auth failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('PayPal Access Token Error:', error.message);
    throw error;
  }
}

async function createOrder(orderId, amount) {
  const config = await getSettings();
  
  if (!hasCredentials(config)) {
    console.log(`[MOCK PAYPAY] Creating Mock Order: ${orderId}, Amount: ${amount}`);
    return {
      id: `MOCK-PAYPAL-${Math.random().toString(36).substring(2, 12).toUpperCase()}`,
      status: "CREATED",
      isMock: true
    };
  }

  const baseUrl = getBaseUrl(config);
  const token = await getAccessToken(config);

  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: orderId,
        amount: {
          currency_code: "USD",
          value: parseFloat(amount).toFixed(2)
        }
      }
    ]
  };

  try {
    const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'PayPal Create Order failed');
    }
    return data;
  } catch (error) {
    console.error('PayPal Create Order Error:', error.message);
    throw error;
  }
}

async function captureOrder(paypalOrderId) {
  const config = await getSettings();

  if (paypalOrderId.startsWith('MOCK-PAYPAL-')) {
    console.log(`[MOCK PAYPAL] Capturing Mock Order: ${paypalOrderId}`);
    return {
      id: paypalOrderId,
      status: "COMPLETED",
      purchase_units: [
        {
          payments: {
            captures: [
              {
                id: `MOCK-CAP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                status: "COMPLETED"
              }
            ]
          }
        }
      ],
      isMock: true
    };
  }

  const baseUrl = getBaseUrl(config);
  const token = await getAccessToken(config);

  try {
    const response = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'PayPal Capture Order failed');
    }
    return data;
  } catch (error) {
    console.error('PayPal Capture Order Error:', error.message);
    throw error;
  }
}

module.exports = {
  createOrder,
  captureOrder
};
