(function(){
  const CALENDAR_KEY = 'scorecard:calendar';
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();

  function getEvents(){
    try {
      return JSON.parse(localStorage.getItem(CALENDAR_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveEvents(events){
    localStorage.setItem(CALENDAR_KEY, JSON.stringify(events));
  }

  function addEvent(title, date, description){
    const events = getEvents();
    events.push({
      id: Date.now().toString(),
      title: title,
      date: date,
      description: description
    });
    saveEvents(events);
    loadEvents();
    renderCalendar(currentYear, currentMonth);
  }

  function deleteEvent(eventId){
    if(!confirm('Delete this event?')) return;
    let events = getEvents();
    events = events.filter(e => e.id !== eventId);
    saveEvents(events);
    loadEvents();
    renderCalendar(currentYear, currentMonth);
  }

  function renderCalendar(year, month){
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    
    let html = `
      <div class="calendar-header">
        <button onclick="window.changeMonth(-1)" class="calendar-nav-btn">‹</button>
        <h3 class="calendar-title">${monthNames[month]} ${year}</h3>
        <button onclick="window.changeMonth(1)" class="calendar-nav-btn">›</button>
      </div>
      <div class="calendar-weekdays">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>
      <div class="calendar-days">`;

    const events = getEvents();
    
    // Previous month days
    for(let i = firstDay - 1; i >= 0; i--){
      html += `<div class="calendar-day other-month">${daysInPrevMonth - i}</div>`;
    }

    // Current month days
    for(let day = 1; day <= daysInMonth; day++){
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const hasEvent = events.some(e => e.date === dateStr);
      const isToday = dateStr === todayStr;
      const classes = ['calendar-day'];
      if (isToday) classes.push('today');
      if (hasEvent) classes.push('has-event');
      
      html += `<div class="${classes.join(' ')}" onclick="window.selectDate('${dateStr}')">
        <span class="day-number">${day}</span>
        ${hasEvent ? '<span class="event-indicator"></span>' : ''}
      </div>`;
    }

    // Next month days
    const totalCells = firstDay + daysInMonth;
    const remaining = totalCells > 35 ? 42 - totalCells : 35 - totalCells;
    for(let i = 1; i <= remaining; i++){
      html += `<div class="calendar-day other-month">${i}</div>`;
    }
    
    html += `</div>`;
    
    const calContainer = document.getElementById('miniCalendar');
    if(calContainer){
      calContainer.innerHTML = html;
    }
  }

  function changeMonth(direction){
    currentMonth += direction;
    if(currentMonth > 11){
      currentMonth = 0;
      currentYear++;
    } else if(currentMonth < 0){
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar(currentYear, currentMonth);
  }

  function loadEvents(selectedDate = null){
    const container = document.getElementById('eventsContainer');
    if(!container) return;

    const events = getEvents().sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const today = new Date().toISOString().split('T')[0];
    const filteredEvents = selectedDate ? events.filter(e => e.date === selectedDate) : events;

    let html = '';
    if(filteredEvents.length === 0){
      html += '<p style="text-align: center; color: #999; padding: 40px;">No events scheduled.</p>';
    } else {
      filteredEvents.forEach(event => {
        const eventDate = new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        html += `
          <div class="event-item">
            <div class="event-title">${event.title}</div>
            <div class="event-date">${eventDate}</div>
            ${event.description ? `<div class="event-desc" style="color: #666; margin-top: 8px;">${event.description}</div>` : ''}
            ${window.isAdmin ? `<div class="event-actions"><button class="event-delete" onclick="window.deleteCalendarEvent('${event.id}')">Delete Event</button></div>` : ''}
          </div>
        `;
      });
    }
    container.innerHTML = html;
  }

  if(window.location.pathname.includes('calendar.html')){
    // Wait for auth to be ready before initializing calendar
    const initCalendar = () => {
      renderCalendar(currentYear, currentMonth);

      const adminForm = document.getElementById('adminEventForm');
      const eventForm = document.getElementById('eventForm');

      // Show admin form only if user is admin
      if(window.isAdmin){
        adminForm.style.display = 'block';
        eventForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const title = document.getElementById('eventTitle').value;
          const date = document.getElementById('eventDate').value;
          const description = document.getElementById('eventDescription').value;
          
          addEvent(title, date, description);
          eventForm.reset();
        });
      }

      loadEvents();
    };

    // Wait for auth to be initialized
    if(typeof window.isAdmin !== 'undefined'){
      initCalendar();
    } else {
      // If auth not ready, wait a bit and try again
      setTimeout(initCalendar, 100);
    }
  }

  window.deleteCalendarEvent = deleteEvent;
  window.selectDate = (date) => { loadEvents(date); };
  window.changeMonth = changeMonth;
})();
