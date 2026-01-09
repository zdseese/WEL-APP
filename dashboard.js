(function(){
  if(window.location.pathname.includes('dashboard.html')){
    const displayName = window.currentUserDisplayName || window.currentUser;
    document.getElementById('welcomeMsg').textContent = `Welcome, ${displayName}!`;
    
    // Check if user has scorecard history and show button
    const currentUser = window.currentUser;
    const viewHistoryBtn = document.getElementById('viewHistoryFromDashboard');
    
    if(currentUser && viewHistoryBtn) {
      const savedData = localStorage.getItem(`scorecard:data:${currentUser}`);
      if(savedData) {
        const data = JSON.parse(savedData);
        if(data.history && data.history.length > 0) {
          viewHistoryBtn.style.display = 'inline-block';
          
          viewHistoryBtn.addEventListener('click', function() {
            // Redirect to scorecard page with history flag
            window.location.href = 'index.html?showHistory=true';
          });
        }
      }
    }
  }
})();
