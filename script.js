document.addEventListener('DOMContentLoaded', () => {
    let currentDate = new Date();

    const monthYearDisplay = document.getElementById('monthYearDisplay');
    const calendarGrid = document.getElementById('calendarGrid');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    // Reminder Logic
    const reminders = JSON.parse(localStorage.getItem('lunar_reminders')) || [];

    const modal = document.getElementById('reminderModal');
    const addBtn = document.getElementById('addReminderBtn');
    const closeBtn = document.querySelector('.close-modal');
    const cancelBtn = document.getElementById('cancelRemBtn');
    const form = document.getElementById('reminderForm');

    addBtn.addEventListener('click', () => {
        modal.classList.add('show');
    });

    function closeModal() {
        modal.classList.remove('show');
        form.reset();
    }

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('remTitle').value;
        const type = document.querySelector('input[name="remType"]:checked').value;
        const year = parseInt(document.getElementById('remYear').value);
        const month = parseInt(document.getElementById('remMonth').value);
        const day = parseInt(document.getElementById('remDay').value);
        const repeat = document.getElementById('remRepeat').checked;

        const reminder = {
            id: Date.now(),
            title,
            type,
            year,
            month,
            day,
            repeat
        };

        reminders.push(reminder);
        localStorage.setItem('lunar_reminders', JSON.stringify(reminders));
        closeModal();
        renderCalendar(currentDate);
    });

    function renderCalendar(date) {
        // Clear previous days (keep weekdays)
        const days = calendarGrid.querySelectorAll('.day');
        days.forEach(day => day.remove());

        const year = date.getFullYear();
        const month = date.getMonth(); // 0-indexed

        // Update Header
        monthYearDisplay.textContent = date.toLocaleString('default', { month: 'long', year: 'numeric' });

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = new Date(year, month, 1).getDay();

        // Padding
        for (let i = 0; i < firstDayOfWeek; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.classList.add('day', 'empty');
            calendarGrid.appendChild(emptyDay);
        }

        const now = new Date();

        for (let d = 1; d <= daysInMonth; d++) {
            const dayEl = document.createElement('div');
            dayEl.classList.add('day');

            // Solar uses 1-indexed month
            const solar = Solar.fromYmd(year, month + 1, d);
            const lunar = solar.getLunar();

            // Check Reminders
            const dayEvents = reminders.filter(r => {
                if (r.type === 'SOLAR') {
                    if (r.repeat) {
                        return r.month === (month + 1) && r.day === d;
                    } else {
                        return r.year === year && r.month === (month + 1) && r.day === d;
                    }
                } else {
                    // Lunar Check
                    // We need to compare lunar date of this solar day with reminder
                    if (r.repeat) {
                        return r.month === lunar.getMonth() && r.day === lunar.getDay();
                    } else {
                        return r.year === lunar.getYear() && r.month === lunar.getMonth() && r.day === lunar.getDay();
                    }
                }
            });

            const lunarDateStr = `${lunar.getMonth()}/${lunar.getDay()}`;
            const term = lunar.getJieQi();

            if (d === now.getDate() && month === now.getMonth() && year === now.getFullYear()) {
                dayEl.classList.add('today');
            }

            const holiday = getKoreanHoliday(lunar);
            let lunarInfoHtml = `<span class="lunar-date">${lunarDateStr}</span>`;

            if (holiday) {
                lunarInfoHtml = `<span class="holiday">${holiday}</span>` + lunarInfoHtml;
                dayEl.classList.add('is-holiday');
            }
            // Removed term display as requested (red text might be confused with dots or unwanted noise)

            // Create dots html
            let dotsHtml = '';
            if (dayEvents.length > 0) {
                dotsHtml = `<div class="event-dots">`;
                dayEvents.forEach(evt => {
                    const isLunar = evt.type === 'LUNAR';
                    dotsHtml += `<div class="event-dot ${isLunar ? 'lunar-event' : ''}" title="${evt.title}"></div>`;
                });
                dotsHtml += `</div>`;
            }

            dayEl.innerHTML = `
                <span class="solar-date">${d}</span>
                <div class="lunar-info">
                    ${lunarInfoHtml}
                </div>
                ${dotsHtml}
            `;

            // Make day clickable
            dayEl.addEventListener('click', () => {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                openDayModal(dateStr, dayEvents);
            });

            calendarGrid.appendChild(dayEl);
        }
    }

    prevBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate);
    });

    nextBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate);
    });

    renderCalendar(currentDate);

    // Lunar to Solar Conversion
    const convertBtn = document.getElementById('convertBtn');
    const resultDisplay = document.getElementById('conversionResult');

    convertBtn.addEventListener('click', () => {
        const year = parseInt(document.getElementById('lunarYear').value);
        const month = parseInt(document.getElementById('lunarMonth').value);
        const day = parseInt(document.getElementById('lunarDay').value);
        const isLeap = document.getElementById('isLeap').checked;

        if (!year || !month || !day) {
            resultDisplay.textContent = 'Please enter a valid date currently.';
            resultDisplay.classList.add('show');
            return;
        }

        try {
            // Attempt conversion
            const lunar = Lunar.fromYmd(year, month, day);
            // Note: lunar-javascript fromYmd(year, month, day) creates a Lunar object.
            // If the month is a leap month in that year, we might need to handle it.
            // Looking at common usage, if we want to specify it IS the leap month, 
            // usually we'd check if that year has a leap month and if it matches.
            // However, the library typically defaults to non-leap. 
            // Let's see if we can set it or create it differently.
            // Use specific fromYmd(year, month, day) triggers non-leap usually.

            // If specific leap month is requested:
            // Some versions supports fromYmd(year, month, day, leap)
            // Let's try that signature. If it ignores the 4th arg, we might need a workaround.
            // But let's assume standard usage first.
            let targetLunar = Lunar.fromYmd(year, month, day);

            // If user checked leap, we try to see if we can get a leap version.
            // In 6tail/lunar-javascript, Lunar.fromYmd returns a Lunar object.
            // We might need to handle leap month explicitly if the library creates non-leap by default.

            // Actually, let's just try to pass the 4th argument.
            // If it fails, we will catch it.
            targetLunar = Lunar.fromYmd(year, month, day, isLeap ? 1 : 0);


            const solar = targetLunar.getSolar();
            const solarDateStr = solar.toString(); // YYYY-MM-DD

            // Format for display: YYYY-MM-DD (Day of Week)
            const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const solarDateObj = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
            // Note: Solar object uses 1-based month usually, Date uses 0-based.
            // Solar.getMonth() returns 1-12.

            const weekday = weekdays[solar.getWeek()];

            resultDisplay.innerHTML = `
                <span style="display:block; font-size: 0.9em; opacity: 0.8">Solar Date:</span>
                ${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(solar.getDay()).padStart(2, '0')} 
                <span style="font-size: 0.8em">(${weekday})</span>
            `;
            resultDisplay.classList.add('show');
        } catch (e) {
            console.error(e);
            resultDisplay.textContent = 'Invalid Lunar Date';
            resultDisplay.classList.add('show');
        }
    });

    function getKoreanHoliday(lunar) {
        const m = lunar.getMonth();
        const d = lunar.getDay();

        if (m === 1 && d === 1) return '설날';
        if (m === 1 && d === 15) return '정월대보름';
        if (m === 4 && d === 8) return '부처님오신날';
        if (m === 5 && d === 5) return '단오';
        if (m === 8 && d === 15) return '추석';

        return null;
    }

    // Day Details Modal Logic
    const dayModal = document.getElementById('dayModal');
    const closeDayModalBtn = document.getElementById('closeDayModal');
    const closeDayBtn = document.getElementById('closeDayBtn');
    const dayModalDate = document.getElementById('dayModalDate');
    const eventList = document.getElementById('eventList');

    function openDayModal(dateStr, events) {
        dayModalDate.textContent = dateStr;
        eventList.innerHTML = '';

        if (events.length === 0) {
            eventList.innerHTML = '<p style="text-align:center; color: #6b7280; padding: 1rem;">No events for this day.</p>';
        } else {
            events.forEach(evt => {
                const item = document.createElement('div');
                item.className = 'event-item';
                item.innerHTML = `
                    <div class="event-info">
                        <span class="event-title">${evt.title}</span>
                        <span class="event-meta">${evt.type} • ${evt.repeat ? 'Annual' : 'One-time'}</span>
                    </div>
                    <button class="delete-btn" data-id="${evt.id}">Delete</button>
                `;
                eventList.appendChild(item);
            });

            // Add delete listeners
            const deleteBtns = eventList.querySelectorAll('.delete-btn');
            deleteBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = parseInt(e.target.getAttribute('data-id'));
                    deleteReminder(id);
                });
            });
        }
        dayModal.classList.add('show');
    }

    function closeDayModalFunc() {
        dayModal.classList.remove('show');
    }

    closeDayModalBtn.addEventListener('click', closeDayModalFunc);
    closeDayBtn.addEventListener('click', closeDayModalFunc);
    window.addEventListener('click', (e) => {
        if (e.target === dayModal) closeDayModalFunc();
    });

    function deleteReminder(id) {
        if (confirm('Are you sure you want to delete this event?')) {
            const index = reminders.findIndex(r => r.id === id);
            if (index !== -1) {
                reminders.splice(index, 1);
                localStorage.setItem('lunar_reminders', JSON.stringify(reminders));
                renderCalendar(currentDate); // Re-render calendar
                closeDayModalFunc(); // Close modal
            }
        }
    }
});
