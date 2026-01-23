(function(){
  if(window.location.pathname.includes('dashboard.html')){
    // Wait for auth to be ready before accessing user info
    setTimeout(() => {
      const displayName = window.currentUserDisplayName || window.currentUser;
      if(displayName) {
        document.getElementById('welcomeMsg').textContent = `Welcome, ${displayName}!`;
      }
      
      // Show user management card for admins only
      if(window.isAdmin) {
        const userMgmtCard = document.getElementById('userManagementCard');
        if(userMgmtCard) {
          userMgmtCard.style.display = 'block';
        }
      }
    }, 100);
    
    // Check if user has scorecard history and show button
    setTimeout(async () => {
      const currentUser = window.currentUser;
      const viewHistoryBtn = document.getElementById('viewHistoryFromDashboard');
      
      if(currentUser && viewHistoryBtn) {
        // Check backend for saved scorecard data
        try {
          const authToken = localStorage.getItem('authToken');
          const response = await fetch('/api/scorecard', { 
            credentials: 'same-origin',
            headers: authToken ? { 'Authorization': authToken } : {}
          });
          if (response.ok) {
            const data = await response.json();
            if(data && data.history && data.history.length > 0) {
              viewHistoryBtn.style.display = 'inline-block';
              
              viewHistoryBtn.addEventListener('click', function() {
                // Redirect to scorecard page with history flag
                window.location.href = 'index.html?showHistory=true';
              });
            }
          }
        } catch (error) {
          console.error('Error checking scorecard history:', error);
        }
      }
    }, 200);

    // Load and display subscription information
    loadSubscriptionInfo();
  }

  async function loadSubscriptionInfo() {
    try {
      const response = await fetch('/api/subscription/status');
      if (!response.ok) {
        console.error('Failed to load subscription');
        return;
      }

      const subscription = await response.json();
      displaySubscriptionCard(subscription);
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  }

  function displaySubscriptionCard(subscription) {
    const card = document.getElementById('subscriptionCard');
    const planName = document.getElementById('subPlanName');
    const statusBadge = document.getElementById('subStatusBadge');
    const description = document.getElementById('subDescription');
    const periodInfo = document.getElementById('subPeriodInfo');
    const upgradeBtn = document.getElementById('upgradeBtn');
    const manageBtn = document.getElementById('manageSubBtn');

    if (!card) return;

    // Show the card
    card.style.display = 'block';

    // Update plan name
    const planDetails = subscription.planDetails || {};
    planName.textContent = planDetails.name || 'Free Plan';

    // Update status badge
    statusBadge.textContent = subscription.status === 'active' ? 'Active' : subscription.status;
    if (subscription.status !== 'active') {
      statusBadge.style.background = 'rgba(255, 87, 34, 0.8)';
    }

    // Update description
    if (planDetails.features && planDetails.features.length > 0) {
      description.textContent = planDetails.features[0];
    }

    // Update period info
    if (subscription.currentPeriodEnd) {
      const endDate = new Date(subscription.currentPeriodEnd);
      periodInfo.textContent = `Renews on ${endDate.toLocaleDateString()}`;
      periodInfo.style.display = 'block';
    } else {
      periodInfo.style.display = 'none';
    }

    // Show/hide buttons based on plan
    if (subscription.plan === 'free') {
      upgradeBtn.textContent = 'Upgrade Plan';
      upgradeBtn.style.display = 'inline-block';
      manageBtn.style.display = 'none';
    } else {
      upgradeBtn.textContent = 'Change Plan';
      upgradeBtn.style.display = 'inline-block';
      manageBtn.style.display = 'inline-block';
    }
  }

  // Make function global so button onclick can access it
  window.manageSubscription = async function() {
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
      alert('Error opening billing portal. Please try again.');
    }
  };
})();
