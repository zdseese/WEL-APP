(function(){
  const CALENDAR_KEY = 'scorecard:calendar';

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
  }

  function deleteEvent(eventId){
    if(!confirm('Delete this event?')) return;
    let events = getEvents();
    events = events.filter(e => e.id !== eventId);
    saveEvents(events);
    loadEvents();
  }

  function renderCalendar(year, month){
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    let html = `<div class="calendar-grid">`;
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    html += `<h4>${monthNames[month]} ${year}</h4>`;
    html += `<div class="weekdays"><div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div></div>`;
    html += `<div class="calendar-days">`;

    const events = getEvents();
    for(let i = firstDay - 1; i >= 0; i--){
      html += `<div class="day prev-month">${daysInPrevMonth - i}</div>`;
    }

    for(let day = 1; day <= daysInMonth; day++){
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const hasEvent = events.some(e => e.date === dateStr);
      html += `<div class="day ${hasEvent ? 'has-event' : ''}" onclick="window.selectDate('${dateStr}')">${day}</div>`;
    }

    const remaining = 42 - (firstDay + daysInMonth);
    for(let i = 1; i <= remaining; i++){
      html += `<div class="day next-month">${i}</div>`;
    }
    html += `</div></div>`;
    return html;
  }

  function loadEvents(selectedDate = null){
    const container = document.getElementById('eventsContainer');
    if(!container) return;

    const events = getEvents().sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const today = new Date().toISOString().split('T')[0];
    const filteredEvents = selectedDate ? events.filter(e => e.date === selectedDate) : events;

    let html = '<div class="events-list">';
    if(filteredEvents.length === 0){
      html += '<p class="no-events">No events scheduled.</p>';
    } else {
      filteredEvents.forEach(event => {
        const eventDate = new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        html += `
          <div class="event-item">
            <div class="event-date">${eventDate}</div>
            <div class="event-title">${event.title}</div>
            <div class="event-desc">${event.description || ''}</div>
            ${window.isAdmin ? `<button class="btn-delete-event" onclick="window.deleteCalendarEvent('${event.id}')">Delete</button>` : ''}
          </div>
        `;
      });
    }
    html += '</div>';
    container.innerHTML = html;
  }

  if(window.location.pathname.includes('calendar.html')){
    const today = new Date();
    const calContainer = document.getElementById('miniCalendar');
    if(calContainer){
      calContainer.innerHTML = renderCalendar(today.getFullYear(), today.getMonth());
    }

    const adminForm = document.getElementById('adminEventForm');
    const eventForm = document.getElementById('eventForm');

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
  }

  window.deleteCalendarEvent = deleteEvent;
  window.selectDate = (date) => { loadEvents(date); };
})();
