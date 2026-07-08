const { getSettings } = require('../db');

// Helper to check if credentials are set
function hasCredentials(config) {
  return config.MPESA_CONSUMER_KEY && config.MPESA_CONSUMER_SECRET;
}

// Get Daraja API Base URL
function getBaseUrl(config) {
  return config.MPESA_ENV === 'live'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

// Generate OAuth Token
async function getOAuthToken(config) {
  const baseUrl = getBaseUrl(config);
  const auth = Buffer.from(`${config.MPESA_CONSUMER_KEY}:${config.MPESA_CONSUMER_SECRET}`).toString('base64');
  
  try {
    const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Daraja OAuth failed: ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('M-Pesa getOAuthToken error:', error.message);
    throw error;
  }
}

// Initiate STK Push
async function initiateSTKPush({ orderId, amount, phone }) {
  const config = await getSettings();
  
  // Format phone to 2547XXXXXXXX or 2541XXXXXXXX
  let formattedPhone = phone.replace(/\D/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '254' + formattedPhone.substring(1);
  } else if (formattedPhone.startsWith('+')) {
    formattedPhone = formattedPhone.substring(1);
  }
  if (!formattedPhone.startsWith('254')) {
    formattedPhone = '254' + formattedPhone;
  }

  // Fallback to MOCK mode if credentials are missing
  if (!hasCredentials(config)) {
    console.log(`[MOCK MPESA] Initiating Mock STK Push for Order: ${orderId}, Amount: ${amount}, Phone: ${formattedPhone}`);
    
    // Simulate Daraja response
    const mockResponse = {
      MerchantRequestID: `mock-req-${Math.random().toString(36).substring(2, 9)}`,
      CheckoutRequestID: `ws_CO_${Math.random().toString(36).substring(2, 9)}`,
      ResponseCode: "0",
      ResponseDescription: "Success. Request accepted for processing",
      CustomerMessage: "Success. Request accepted for processing",
      isMock: true
    };

    // Simulate async network callback in 3 seconds to approve the order
    setTimeout(async () => {
      try {
        console.log(`[MOCK MPESA CALLBACK] Simulating successful payment callback for order ${orderId}`);
        const callbackUrl = config.MPESA_CALLBACK_URL || 'http://localhost:5000/api/payments/mpesa/callback';
        
        const callbackPayload = {
          Body: {
            stkCallback: {
              MerchantRequestID: mockResponse.MerchantRequestID,
              CheckoutRequestID: mockResponse.CheckoutRequestID,
              ResultCode: 0,
              ResultDesc: "The service request is processed successfully.",
              CallbackMetadata: {
                Item: [
                  { Name: "Amount", Value: amount },
                  { Name: "MpesaReceiptNumber", Value: `MOCK${Math.random().toString(36).substring(2, 10).toUpperCase()}` },
                  { Name: "TransactionDate", Value: new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14) },
                  { Name: "PhoneNumber", Value: formattedPhone }
                ]
              }
            }
          }
        };

        await fetch(callbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(callbackPayload)
        });
      } catch (err) {
        console.error('[MOCK MPESA CALLBACK ERROR]', err.message);
      }
    }, 4000);

    return mockResponse;
  }

  // Real Daraja STK Push implementation
  const baseUrl = getBaseUrl(config);
  const token = await getOAuthToken(config);
  
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
  const password = Buffer.from(config.MPESA_SHORTCODE + config.MPESA_PASSKEY + timestamp).toString('base64');
  
  const payload = {
    BusinessShortCode: config.MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline", // Or CustomerBuyGoodsOnline
    Amount: Math.round(amount), // Daraja only accepts integers for sandbox / standard billing
    PartyA: formattedPhone,
    PartyB: config.MPESA_SHORTCODE,
    PhoneNumber: formattedPhone,
    CallBackURL: config.MPESA_CALLBACK_URL,
    AccountReference: orderId.substring(0, 12),
    TransactionDesc: `Brane Shop Purchase`
  };

  try {
    const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.errorMessage || 'STK Push failed');
    }
    return data;
  } catch (error) {
    console.error('M-Pesa STK Push error:', error.message);
    throw error;
  }
}

module.exports = {
  initiateSTKPush
};
