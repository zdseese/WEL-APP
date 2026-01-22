const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const stripe = require('stripe')(require('./stripe-config').STRIPE_SECRET_KEY);
const stripeConfig = require('./stripe-config');

const app = express();
const PORT = 8000;

// Database (using JSON file for simplicity - can upgrade to SQL later)
const DB_FILE = path.join(__dirname, 'database.json');

function initDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: {
        admin: {
          username: 'admin',
          password: '$2b$10$rBV2kS9b3nqhP8Lw3MxMCOz8bV7W4uX7xQ8kW4vZ6yF5xH9qG7Wze', // scorecard2026
          email: 'admin@scorecard.com',
          createdAt: new Date().toISOString(),
          subscription: {
            plan: 'free',
            status: 'active',
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            currentPeriodEnd: null
          }
        }
      },
      profiles: {},
      sessions: {}
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Stripe webhook needs raw body, so we handle it before json parser
app.post('/api/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, stripeConfig.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      await handleCheckoutSessionCompleted(session);
      break;
    
    case 'customer.subscription.updated':
      const updatedSubscription = event.data.object;
      await handleSubscriptionUpdated(updatedSubscription);
      break;
    
    case 'customer.subscription.deleted':
      const deletedSubscription = event.data.object;
      await handleSubscriptionDeleted(deletedSubscription);
      break;
    
    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      await handleInvoicePaymentSucceeded(invoice);
      break;
    
    case 'invoice.payment_failed':
      const failedInvoice = event.data.object;
      await handleInvoicePaymentFailed(failedInvoice);
      break;
  }

  res.json({received: true});
});

app.use(express.static(__dirname));
app.use(session({
  secret: 'scorecard-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Initialize database
let db = initDB();

// API Routes

// Check auth status
app.get('/api/auth/status', (req, res) => {
  if (req.session.userId) {
    const user = db.users[req.session.userId];
    if (user) {
      res.json({
        loggedIn: true,
        username: user.username,
        email: user.email,
        isAdmin: user.username === 'admin',
        subscription: user.subscription || { plan: 'free', status: 'active' }
      });
      return;
    }
  }
  res.json({ loggedIn: false });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.users[username];

  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid username or password' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ success: false, error: 'Invalid username or password' });
  }

  req.session.userId = username;
  res.json({
    success: true,
    username: user.username,
    email: user.email,
    isAdmin: user.username === 'admin'
  });
});

// Signup
app.post('/api/auth/signup', async (req, res) => {
  const { username, password, email } = req.body;

  // Validation
  if (!username || username.length < 3) {
    return res.status(400).json({ success: false, error: 'Username must be at least 3 characters' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
  }
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Valid email is required' });
  }

  // Check if user exists
  if (db.users[username]) {
    return res.status(400).json({ success: false, error: 'Username already exists' });
  }

  // Check if email exists
  if (Object.values(db.users).some(u => u.email === email)) {
    return res.status(400).json({ success: false, error: 'Email already registered' });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  db.users[username] = {
    username,
    password: hashedPassword,
    email,
    createdAt: new Date().toISOString(),
    subscription: {
      plan: 'free',
      status: 'active',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodEnd: null
    }
  };

  saveDB(db);

  res.json({ success: true });
});

// Update user details
app.post('/api/auth/update-details', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  const { organization, jobTitle, phone, hearAboutUs } = req.body;
  const user = db.users[req.session.userId];

  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  user.organization = organization;
  user.jobTitle = jobTitle;
  user.phone = phone;
  user.hearAboutUs = hearAboutUs;
  user.profileCompleted = true;

  saveDB(db);

  res.json({ success: true });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get profile
app.get('/api/profile', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const profile = db.profiles[req.session.userId] || { displayName: '', bio: '', picture: null };
  res.json(profile);
});

// Update profile
app.post('/api/profile', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  const { displayName, bio, picture } = req.body;
  db.profiles[req.session.userId] = { displayName, bio, picture };
  saveDB(db);

  res.json({ success: true });
});

// Delete account
app.delete('/api/account', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  const username = req.session.userId;
  delete db.users[username];
  delete db.profiles[username];
  saveDB(db);
  
  req.session.destroy();
  res.json({ success: true });
});

// Get all users (admin only)
app.get('/api/admin/users', (req, res) => {
  if (!req.session.userId || req.session.userId !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const users = Object.values(db.users).map(u => ({
    username: u.username,
    email: u.email,
    organization: u.organization,
    jobTitle: u.jobTitle,
    phone: u.phone,
    hearAboutUs: u.hearAboutUs,
    createdAt: u.createdAt
  }));

  res.json(users);
});

// ============ STRIPE SUBSCRIPTION ROUTES ============

// Get subscription plans
app.get('/api/stripe/plans', (req, res) => {
  res.json(stripeConfig.SUBSCRIPTION_PLANS);
});

// Get Stripe publishable key
app.get('/api/stripe/config', (req, res) => {
  res.json({
    publishableKey: stripeConfig.STRIPE_PUBLISHABLE_KEY
  });
});

// Get user's subscription status
app.get('/api/subscription/status', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = db.users[req.session.userId];
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const subscription = user.subscription || {
    plan: 'free',
    status: 'active',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null
  };

  res.json({
    ...subscription,
    planDetails: stripeConfig.SUBSCRIPTION_PLANS[subscription.plan]
  });
});

// Create checkout session
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { planId } = req.body;
  const user = db.users[req.session.userId];

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const plan = stripeConfig.SUBSCRIPTION_PLANS[planId];
  if (!plan || !plan.priceId) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  try {
    // Create or retrieve Stripe customer
    let customerId = user.subscription?.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          username: user.username
        }
      });
      customerId = customer.id;
      
      // Save customer ID to database
      if (!user.subscription) {
        user.subscription = {
          plan: 'free',
          status: 'active',
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          currentPeriodEnd: null
        };
      }
      user.subscription.stripeCustomerId = customerId;
      saveDB(db);
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: stripeConfig.getSuccessUrl(),
      cancel_url: stripeConfig.getCancelUrl(),
      metadata: {
        username: user.username,
        planId: planId
      }
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe checkout session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create customer portal session (for managing subscription)
app.post('/api/stripe/create-portal-session', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = db.users[req.session.userId];
  if (!user || !user.subscription?.stripeCustomerId) {
    return res.status(400).json({ error: 'No active subscription' });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.subscription.stripeCustomerId,
      return_url: `${stripeConfig.APP_URL}/dashboard.html`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe portal session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ STRIPE WEBHOOK HANDLERS ============

async function handleCheckoutSessionCompleted(session) {
  const username = session.metadata.username;
  const planId = session.metadata.planId;
  
  const user = db.users[username];
  if (!user) return;

  try {
    // Retrieve the subscription
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    
    user.subscription = {
      plan: planId,
      status: subscription.status,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
    };
    
    saveDB(db);
    console.log(`✅ Subscription activated for ${username} (${planId})`);
  } catch (error) {
    console.error('Error handling checkout session:', error);
  }
}

async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;
  
  // Find user by customer ID
  const user = Object.values(db.users).find(u => u.subscription?.stripeCustomerId === customerId);
  if (!user) return;

  // Determine plan from price ID
  let planId = 'free';
  for (const [key, plan] of Object.entries(stripeConfig.SUBSCRIPTION_PLANS)) {
    if (plan.priceId === subscription.items.data[0]?.price.id) {
      planId = key;
      break;
    }
  }

  user.subscription = {
    ...user.subscription,
    plan: planId,
    status: subscription.status,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
  };
  
  saveDB(db);
  console.log(`🔄 Subscription updated for ${user.username} (${planId})`);
}

async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;
  
  // Find user by customer ID
  const user = Object.values(db.users).find(u => u.subscription?.stripeCustomerId === customerId);
  if (!user) return;

  user.subscription = {
    ...user.subscription,
    plan: 'free',
    status: 'canceled',
    stripeSubscriptionId: null,
    currentPeriodEnd: null
  };
  
  saveDB(db);
  console.log(`❌ Subscription canceled for ${user.username}`);
}

async function handleInvoicePaymentSucceeded(invoice) {
  const customerId = invoice.customer;
  
  // Find user by customer ID
  const user = Object.values(db.users).find(u => u.subscription?.stripeCustomerId === customerId);
  if (!user) return;

  console.log(`💰 Payment succeeded for ${user.username}`);
  // You could send an email notification here
}

async function handleInvoicePaymentFailed(invoice) {
  const customerId = invoice.customer;
  
  // Find user by customer ID
  const user = Object.values(db.users).find(u => u.subscription?.stripeCustomerId === customerId);
  if (!user) return;

  console.log(`⚠️ Payment failed for ${user.username}`);
  // You could send an email notification here
}

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${__dirname}`);
  console.log(`\nDefault admin credentials:`);
  console.log(`  Username: admin`);
  console.log(`  Password: scorecard2026\n`);
});
