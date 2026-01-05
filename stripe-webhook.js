const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    // Verifies that the data actually came from Stripe
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    // This matches your Supabase table columns exactly
    const { error } = await supabase
      .from('tickets')
      .insert([{ 
        customer_email: session.customer_details.email,
        customer_name: session.customer_details.name,
        stripe_session_id: session.id,
        purchase_price: session.amount_total / 100,
        status: 'paid',
        event_id: session.metadata.event_id, // Ensure you send this in your Stripe Checkout code
        ticket_type: session.metadata.ticket_type
      }]);

    if (error) return { statusCode: 500, body: 'Supabase Error' };
  }

  return { statusCode: 200, body: 'Success' };
};