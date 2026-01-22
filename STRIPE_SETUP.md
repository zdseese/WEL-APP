# Stripe Integration Setup Guide

Your web app now has Stripe subscription integration! Here's what you need to do to complete the setup:

## 1. Get Your Stripe API Keys

1. Go to https://dashboard.stripe.com/register and create a free Stripe account
2. Once logged in, get your API keys from: https://dashboard.stripe.com/test/apikeys
3. You'll see two keys:
   - **Publishable key** (starts with `pk_test_...`)
   - **Secret key** (starts with `sk_test_...`)

## 2. Create Subscription Products in Stripe

1. Go to https://dashboard.stripe.com/test/products
2. Click "Add product" and create two products:

### Basic Plan ($9.99/month)
- Name: Basic
- Description: Unlimited goals and advanced features
- Price: $9.99 USD
- Billing period: Monthly
- Copy the **Price ID** (starts with `price_...`)

### Pro Plan ($29.99/month)
- Name: Pro
- Description: Everything in Basic plus team features
- Price: $29.99 USD
- Billing period: Monthly
- Copy the **Price ID** (starts with `price_...`)

## 3. Update Your Configuration

Open `stripe-config.js` and replace:

```javascript
STRIPE_SECRET_KEY: 'sk_test_YOUR_SECRET_KEY_HERE',
STRIPE_PUBLISHABLE_KEY: 'pk_test_YOUR_PUBLISHABLE_KEY_HERE',

// In SUBSCRIPTION_PLANS:
basic: {
  priceId: 'price_YOUR_BASIC_PRICE_ID',
  ...
},
pro: {
  priceId: 'price_YOUR_PRO_PRICE_ID',
  ...
}
```

## 4. Set Up Stripe Webhooks (Required for Production)

Webhooks notify your server when subscriptions are created, updated, or canceled.

### For Local Testing:
1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Run: `stripe listen --forward-to localhost:8000/api/stripe/webhook`
3. Copy the webhook signing secret (starts with `whsec_...`)
4. Add it to `stripe-config.js`: `STRIPE_WEBHOOK_SECRET`

### For Production:
1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter your URL: `https://yourdomain.com/api/stripe/webhook`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the webhook signing secret and update your config

## 5. Start Your Server

```bash
# Make sure you're in the project directory
cd /Users/zaneseese/Desktop/progress-tracker

# Load NVM (Node Version Manager)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Start the Node.js server
node server.js
```

The server will run on http://localhost:8000

## 6. Test Your Integration

1. Open http://localhost:8000
2. Log in (or create an account)
3. Go to the Dashboard - you'll see your subscription status
4. Click "Upgrade Plan" to go to the subscription page
5. Try subscribing to a plan (use Stripe test card: `4242 4242 4242 4242`)

## Features Implemented

### For Users:
- ✅ **Subscription Page** (`/subscribe.html`) - View and select plans
- ✅ **Stripe Checkout** - Secure payment processing
- ✅ **Dashboard Widget** - See current plan and manage subscription
- ✅ **Customer Portal** - Let users manage their subscriptions

### For You:
- ✅ **Three-tier pricing** - Free, Basic ($9.99), Pro ($29.99)
- ✅ **Webhook handling** - Automatic subscription updates
- ✅ **Database integration** - Subscription data saved with user accounts
- ✅ **Auth integration** - Access subscription info via `auth.getSubscription()`

## API Endpoints

### Client-Side:
- `GET /api/stripe/plans` - Get all subscription plans
- `GET /api/stripe/config` - Get publishable key
- `GET /api/subscription/status` - Get user's subscription
- `POST /api/stripe/create-checkout-session` - Start subscription
- `POST /api/stripe/create-portal-session` - Manage subscription

### Webhooks:
- `POST /api/stripe/webhook` - Handle Stripe events

## Checking Subscription in Your Code

```javascript
// Check if user has a plan
if (auth.hasSubscription('basic')) {
  // User has Basic or Pro plan
}

// Check specific features
if (auth.canAccessFeature('team_collaboration')) {
  // Show team features
}

// Get full subscription details
const subscription = auth.getSubscription();
console.log(subscription.plan); // 'free', 'basic', or 'pro'
console.log(subscription.status); // 'active', 'canceled', etc.
```

## Test Card Numbers

Use these in test mode:
- **Success:** 4242 4242 4242 4242
- **Declined:** 4000 0000 0000 0002
- Use any future expiration date and any 3-digit CVC

## Going Live

When ready for production:
1. Switch from test keys to live keys in Stripe dashboard
2. Update `stripe-config.js` with live keys
3. Set up production webhook endpoint
4. Update `APP_URL` in config to your production domain
5. Test thoroughly before accepting real payments!

## Support

- Stripe Documentation: https://stripe.com/docs
- Stripe Support: https://support.stripe.com
- Test your integration: https://stripe.com/docs/testing

---

**Note:** Remember to never commit your secret keys to version control! Consider using environment variables in production.
