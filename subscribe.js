(async function() {
  let stripePublishableKey = null;
  let currentUser = null;
  let currentSubscription = null;
  let plans = {};

  // Show alert message
  function showAlert(message, type = 'success') {
    const alertsDiv = document.getElementById('alerts');
    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    alert.textContent = message;
    alertsDiv.appendChild(alert);
    
    setTimeout(() => {
      alert.remove();
    }, 5000);
  }

  // Check URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('success') === 'true') {
    showAlert('🎉 Subscription successful! Welcome to your new plan.');
  } else if (urlParams.get('canceled') === 'true') {
    showAlert('Subscription canceled. You can try again anytime.', 'error');
  }

  // Load Stripe configuration
  async function loadStripeConfig() {
    try {
      const response = await fetch('/api/stripe/config');
      const data = await response.json();
      stripePublishableKey = data.publishableKey;
    } catch (error) {
      console.error('Error loading Stripe config:', error);
      showAlert('Error loading payment configuration', 'error');
    }
  }

  // Load subscription plans
  async function loadPlans() {
    try {
      const response = await fetch('/api/stripe/plans');
      plans = await response.json();
      return plans;
    } catch (error) {
      console.error('Error loading plans:', error);
      showAlert('Error loading subscription plans', 'error');
      return {};
    }
  }

  // Load current user's subscription
  async function loadCurrentSubscription() {
    try {
      const response = await fetch('/api/subscription/status');
      if (response.ok) {
        currentSubscription = await response.json();
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  }

  // Create checkout session and redirect to Stripe
  async function subscribe(planId) {
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ planId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      showAlert('Error starting checkout: ' + error.message, 'error');
    }
  }

  // Open customer portal to manage subscription
  async function manageSubscription() {
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open billing portal');
      }

      // Redirect to Stripe Customer Portal
      window.location.href = data.url;
    } catch (error) {
      console.error('Error opening customer portal:', error);
      showAlert('Error opening billing portal: ' + error.message, 'error');
    }
  }

  // Render pricing cards
  function renderPricingCards() {
    const container = document.getElementById('pricing-cards');
    container.innerHTML = '';

    const currentPlan = currentSubscription?.plan || 'free';

    for (const [planId, plan] of Object.entries(plans)) {
      const card = document.createElement('div');
      card.className = 'pricing-card';
      
      // Mark featured plan
      if (planId === 'basic') {
        card.classList.add('featured');
      }

      // Mark current plan
      if (planId === currentPlan) {
        card.classList.add('current');
      }

      // Plan name
      const name = document.createElement('div');
      name.className = 'plan-name';
      name.textContent = plan.name;
      card.appendChild(name);

      // Plan price
      const price = document.createElement('div');
      price.className = 'plan-price';
      if (plan.price === 0) {
        price.innerHTML = 'Free';
      } else {
        price.innerHTML = `<span class="currency">$</span>${plan.price}<span class="period">/month</span>`;
      }
      card.appendChild(price);

      // Plan features
      const features = document.createElement('ul');
      features.className = 'plan-features';
      plan.features.forEach(feature => {
        const li = document.createElement('li');
        li.textContent = feature;
        features.appendChild(li);
      });
      card.appendChild(features);

      // Subscribe button
      const button = document.createElement('button');
      button.className = 'subscribe-btn';
      
      if (planId === currentPlan) {
        button.textContent = 'Current Plan';
        button.classList.add('current-plan');
        button.disabled = true;
      } else if (planId === 'free') {
        // Can't "subscribe" to free plan, but could downgrade
        if (currentPlan !== 'free') {
          button.textContent = 'Downgrade to Free';
          button.classList.add('manage-plan');
          button.onclick = () => manageSubscription();
        } else {
          button.textContent = 'Current Plan';
          button.disabled = true;
        }
      } else {
        button.textContent = currentPlan === 'free' ? 'Upgrade Now' : 'Switch Plan';
        button.onclick = () => subscribe(planId);
      }
      
      card.appendChild(button);

      // Add manage subscription button for current paid plan
      if (planId === currentPlan && planId !== 'free') {
        const manageButton = document.createElement('button');
        manageButton.className = 'subscribe-btn manage-plan';
        manageButton.textContent = 'Manage Subscription';
        manageButton.style.marginTop = '10px';
        manageButton.onclick = () => manageSubscription();
        card.appendChild(manageButton);
      }

      container.appendChild(card);
    }
  }

  // Initialize the page
  async function init() {
    // Check authentication
    const authStatus = await auth.checkAuthStatus();
    if (!authStatus.loggedIn) {
      window.location.href = 'login.html';
      return;
    }

    currentUser = authStatus;

    // Show loading
    document.getElementById('loading').style.display = 'block';

    // Load everything
    await Promise.all([
      loadStripeConfig(),
      loadPlans(),
      loadCurrentSubscription()
    ]);

    // Hide loading
    document.getElementById('loading').style.display = 'none';

    // Render the pricing cards
    renderPricingCards();
  }

  // Start when page loads
  init();
})();
