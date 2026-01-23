// Clear old localStorage data on page load
(function() {
  // Clear all old scorecard localStorage keys
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('scorecard:') || key.includes('scorecard'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    console.log('Clearing old localStorage key:', key);
    localStorage.removeItem(key);
  });
  
  // Don't clear sessionStorage - it's needed for proper session management
  // sessionStorage.clear();
  
  console.log('✓ Cleared old localStorage data. Now using backend database.');
})();
