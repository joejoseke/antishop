const { getSettings } = require('../db');

function hasCredentials(config) {
  return config.KOPOKOPO_CLIENT_ID && config.KOPOKOPO_CLIENT_SECRET;
}

function getBaseUrl(config) {
  return config.KOPOKOPO_ENV === 'live'
    ? 'https://api.kopokopo.com'
    : 'https://sandbox.kopokopo.com';
}

async function getAccessToken(config) {
  const baseUrl = getBaseUrl(config);
  
  const payload = {
    client_id: config.KOPOKOPO_CLIENT_ID,
    client_secret: config.KOPOKOPO_CLIENT_SECRET,
    grant_type: "client_credentials"
  };

  try {
    const response = await fetch(`${baseUrl}/oauth/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Kopo Kopo Auth failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Kopo Kopo Token Error:', error.message);
    throw error;
  }
}

async function initiatePayment({ orderId, amount, phone, email }) {
  const config = await getSettings();

  // Format phone to +254XXXXXXXXX
  let formattedPhone = phone.replace(/\D/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '254' + formattedPhone.substring(1);
  }
  if (!formattedPhone.startsWith('+') && !formattedPhone.startsWith('254')) {
    formattedPhone = '254' + formattedPhone;
  }
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+' + formattedPhone;
  }

  if (!hasCredentials(config)) {
    console.log(`[MOCK KOPO KOPO] Initiating Mock STK Push for Order: ${orderId}, Amount: ${amount}, Phone: ${formattedPhone}`);
    
    const mockLocation = `https://sandbox.kopokopo.com/api/v1/incoming_payments/mock-id-${Math.random().toString(36).substring(2, 8)}`;
    
    // Simulate callback in 4 seconds
    setTimeout(async () => {
      try {
        console.log(`[MOCK KOPO KOPO CALLBACK] Simulating successful payment webhook for order ${orderId}`);
        const callbackUrl = `http://localhost:5000/api/payments/kopokopo/callback`;
        
        const callbackPayload = {
          topic: "payment_received",
          id: `mock-k2-txn-${Math.random().toString(36).substring(2, 10)}`,
          attributes: {
            event: {
              type: "payment",
              id: `evt-${Math.random().toString(36).substring(2, 8)}`
            },
            amount: amount,
            status: "Success",
            system: "M-PESA",
            sender_phone_number: formattedPhone,
            sender_first_name: "John",
            sender_last_name: "Doe",
            transaction_reference: `K2_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            metadata: {
              order_id: orderId
            }
          }
        };

        await fetch(callbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(callbackPayload)
        });
      } catch (err) {
        console.error('[MOCK KOPO KOPO CALLBACK ERROR]', err.message);
      }
    }, 4000);

    return {
      status: "Success",
      location: mockLocation,
      isMock: true
    };
  }

  const baseUrl = getBaseUrl(config);
  const token = await getAccessToken(config);

  const payload = {
    payment_channel: "m-pesa",
    till_number: config.KOPOKOPO_SERVICE_CO_REF || "", // Service/Till reference
    subscriber: {
      first_name: "Customer",
      last_name: "BraneShop",
      phone_number: formattedPhone,
      email: email
    },
    amount: {
      currency: "KES",
      value: amount
    },
    metadata: {
      order_id: orderId
    },
    _links: {
      callback_url: `http://localhost:5000/api/payments/kopokopo/callback`
    }
  };

  try {
    const response = await fetch(`${baseUrl}/api/v1/incoming_payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Kopo Kopo payment request failed: ${response.statusText} - ${errText}`);
    }

    // Kopo Kopo returns 201 Created with Location header pointing to the status check URL
    const location = response.headers.get('Location');
    return {
      status: "Success",
      location: location
    };
  } catch (error) {
    console.error('Kopo Kopo Payment Request Error:', error.message);
    throw error;
  }
}

module.exports = {
  initiatePayment
};
