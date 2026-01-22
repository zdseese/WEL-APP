// Stripe Configuration
// IMPORTANT: Replace these with your actual Stripe keys from https://dashboard.stripe.com/apikeys

module.exports = {
  // Get these from: https://dashboard.stripe.com/apikeys
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_SECRET_KEY_HERE',
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_YOUR_PUBLISHABLE_KEY_HERE',
  
  // Webhook secret for Stripe events (get from: https://dashboard.stripe.com/webhooks)
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_YOUR_WEBHOOK_SECRET_HERE',
  
  // Subscription Plans
  // Create these products and prices in your Stripe Dashboard
  // https://dashboard.stripe.com/products
  SUBSCRIPTION_PLANS: {
    free: {
      name: 'Free',
      price: 0,
      priceId: null, // No Stripe price ID needed for free
      features: [
        'Basic progress tracking',
        'Limited to 3 goals',
        'Community support'
      ],
      limits: {
        maxGoals: 3,
        maxProjects: 1
      }
    },
    basic: {
      name: 'Basic',
      price: 9.99,
      priceId: 'price_YOUR_BASIC_PRICE_ID', // Replace with your Stripe price ID
      interval: 'month',
      features: [
        'Unlimited goals',
        'Up to 10 projects',
        'Priority email support',
        'Advanced analytics',
        'Export data'
      ],
      limits: {
        maxGoals: -1, // -1 = unlimited
        maxProjects: 10
      }
    },
    pro: {
      name: 'Pro',
      price: 29.99,
      priceId: 'price_YOUR_PRO_PRICE_ID', // Replace with your Stripe price ID
      interval: 'month',
      features: [
        'Everything in Basic',
        'Unlimited projects',
        'Team collaboration (up to 5 members)',
        'Priority chat support',
        'Custom integrations',
        'Advanced reporting'
      ],
      limits: {
        maxGoals: -1,
        maxProjects: -1,
        teamMembers: 5
      }
    }
  },
  
  // Your app's base URL (change in production)
  APP_URL: process.env.APP_URL || 'http://localhost:8000',
  
  // Success and cancel URLs
  getSuccessUrl: function() {
    return `${this.APP_URL}/dashboard.html?session_id={CHECKOUT_SESSION_ID}&success=true`;
  },
  getCancelUrl: function() {
    return `${this.APP_URL}/subscribe.html?canceled=true`;
  }
};
