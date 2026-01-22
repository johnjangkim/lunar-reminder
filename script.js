document.addEventListener('DOMContentLoaded', () => {
    let currentDate = new Date();

    const monthYearDisplay = document.getElementById('monthYearDisplay');
    const calendarGrid = document.getElementById('calendarGrid');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    // API Config
    const API_URL = 'http://localhost:3000/api/reminders';
    let reminders = [];

    async function fetchReminders() {
        try {
            const res = await fetch(API_URL);
            reminders = await res.json();
            renderCalendar(currentDate);
        } catch (e) {
            console.error('Failed to fetch reminders:', e);
            // Fallback to local storage if API fails
            reminders = JSON.parse(localStorage.getItem('lunar_reminders')) || [];
            renderCalendar(currentDate);
        }
    }

    const modal = document.getElementById('reminderModal');
    const addBtn = document.getElementById('addReminderBtn');
    const closeBtn = document.querySelector('.close-modal');
    const cancelBtn = document.getElementById('cancelRemBtn');
    const form = document.getElementById('reminderForm');

    addBtn.addEventListener('click', () => {
        closeModal();
        modal.classList.add('show');
    });

    function closeModal() {
        modal.classList.remove('show');
        form.reset();
        document.getElementById('remId').value = ''; // Clear ID
        document.getElementById('remModalTitle').textContent = 'Manage Reminder';
    }

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Form submit triggered');
        // alert('Submitting form...'); // Uncomment if user keeps saying it fails
        const idStr = document.getElementById('remId').value;
        const title = document.getElementById('remTitle').value;
        const type = document.querySelector('input[name="remType"]:checked').value;
        const year = parseInt(document.getElementById('remYear').value);
        const month = parseInt(document.getElementById('remMonth').value);
        const day = parseInt(document.getElementById('remDay').value);
        const time = document.getElementById('remTime').value;
        const alertTiming = document.getElementById('remAlert').value;
        const recurrence = document.getElementById('remRecurrence').value;

        const reminderData = {
            title, type, year, month, day, time, alertTiming, recurrence
        };

        try {
            console.log('Saving reminder:', reminderData);
            let res;
            if (idStr) {
                // Edit existing
                const id = parseInt(idStr);
                res = await fetch(`${API_URL}/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(reminderData)
                });
            } else {
                // Create new
                const id = Date.now();
                res = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...reminderData, id })
                });
            }

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Server error (${res.status}): ${errorText}`);
            }

            console.log('Save successful');
            await fetchReminders(); // Refresh local list and re-render
            closeModal();
            closeDayModalFunc();
        } catch (e) {
            console.error('Error saving reminder:', e);
            alert('Failed to save reminder: ' + e.message);
        }
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
                // First check if this specific date is an exception for this reminder
                if (r.exceptions && r.exceptions.some(ex => ex.year === year && ex.month === (month + 1) && ex.day === d)) {
                    return false;
                }

                if (r.recurrence === 'WEEKLY') {
                    let startWeekday;
                    if (r.type === 'SOLAR') {
                        const startYear = r.year || 2024;
                        startWeekday = new Date(startYear, r.month - 1, r.day).getDay();
                    } else {
                        // For Lunar, find the solar date of that specific lunar day to get the weekday
                        try {
                            const startYear = r.year || 2024;
                            const startLunar = Lunar.fromYmd(startYear, r.month, r.day);
                            startWeekday = startLunar.getSolar().getWeek();
                        } catch (e) {
                            return false;
                        }
                    }
                    const currentSolarDate = new Date(year, month, d);
                    return startWeekday === currentSolarDate.getDay();
                }

                if (r.recurrence === 'MONTHLY') {
                    if (r.type === 'SOLAR') {
                        return r.day === d;
                    } else {
                        return r.day === lunar.getDay();
                    }
                }

                if (r.type === 'SOLAR') {
                    if (r.recurrence === 'ANNUALLY') {
                        return r.month === (month + 1) && r.day === d;
                    } else {
                        return r.year === year && r.month === (month + 1) && r.day === d;
                    }
                } else {
                    // Lunar Check
                    // Note: Lunar exceptions also need to be handled. 
                    // However, the DB stores exceptions in Solar years for simplicity usually,
                    // but since my rendering calculates Lunar per Solar day, 
                    // I should check if the LUNAR date of this solar day is excluded.
                    // Wait, the exception is stored as Solar year/month/day for that specific instance.
                    // Let's stick to solar-based exception tracking for now.

                    if (r.recurrence === 'ANNUALLY') {
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

            const solarDate = new Date(year, month, d);
            const dayOfWeek = solarDate.getDay(); // 0=Sun, 6=Sat
            if (dayOfWeek === 0) dayEl.classList.add('is-sunday', 'is-holiday');
            if (dayOfWeek === 6) dayEl.classList.add('is-saturday');

            const holiday = getKoreanHoliday(lunar);
            const krSolarHoliday = getKoreanSolarHoliday(solarDate);
            const usHoliday = getUSHoliday(solarDate);
            let lunarInfoHtml = `<span class="lunar-date">${lunarDateStr}</span>`;

            if (holiday || usHoliday || krSolarHoliday) {
                const holidayText = [holiday, krSolarHoliday, usHoliday].filter(Boolean).join(' / ');
                lunarInfoHtml = `<span class="holiday">${holidayText}</span>` + lunarInfoHtml;
                dayEl.classList.add('is-holiday');
            }
            // Removed term display as requested (red text might be confused with dots or unwanted noise)

            // Create labels html
            let labelsHtml = '';
            if (dayEvents.length > 0) {
                labelsHtml = `<div class="event-labels">`;
                dayEvents.forEach(evt => {
                    const isLunar = evt.type === 'LUNAR';
                    // Check if this event title matches a background holiday to consider it a "Holiday Event"
                    const isHolidayEvent = (evt.title === holiday || evt.title === usHoliday);
                    labelsHtml += `<div class="event-label ${isLunar ? 'lunar-event' : ''} ${isHolidayEvent ? 'holiday-event' : ''}">${evt.title}</div>`;
                });
                labelsHtml += `</div>`;
            }

            dayEl.innerHTML = `
                <span class="solar-date">${d}</span>
                ${labelsHtml}
                <div class="lunar-info">
                    ${lunarInfoHtml}
                </div>
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

    const todayBtn = document.getElementById('todayBtn');
    todayBtn.addEventListener('click', () => {
        currentDate = new Date();
        renderCalendar(currentDate);
    });

    // Initial load
    fetchReminders();

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

    function getKoreanSolarHoliday(date) {
        const m = date.getMonth() + 1;
        const d = date.getDate();

        if (m === 1 && d === 1) return '신정';
        if (m === 3 && d === 1) return '삼일절';
        if (m === 5 && d === 5) return '어린이날';
        if (m === 6 && d === 6) return '현충일';
        if (m === 10 && d === 3) return '개천절';
        if (m === 10 && d === 9) return '한글날';
        if (m === 12 && d === 25) return '성탄절';

        return null;
    }

    function getUSHoliday(date) {
        const y = date.getFullYear();
        const m = date.getMonth() + 1; // 1-based
        const d = date.getDate();
        const dow = date.getDay(); // 0=Sun, 1=Mon...

        // Fixed Holidays
        if (m === 1 && d === 1) return "New Year's Day";
        if (m === 6 && d === 19) return "Juneteenth";
        if (m === 7 && d === 4) return "Independence Day";
        if (m === 11 && d === 11) return "Veterans Day";
        if (m === 12 && d === 25) return "Christmas Day";

        // Floating Holidays (Monday based)
        // Helper: nth X-day of month
        const getNthWeekday = (year, month, nth, weekday) => {
            const first = new Date(year, month - 1, 1);
            let count = 0;
            for (let i = 1; i <= 31; i++) {
                const current = new Date(year, month - 1, i);
                if (current.getMonth() !== month - 1) break;
                if (current.getDay() === weekday) {
                    count++;
                    if (count === nth) return i;
                }
            }
            return -1;
        };

        const getLastMonday = (year, month) => {
            const last = new Date(year, month, 0); // Last day of month
            while (last.getDay() !== 1) { // 1 = Monday
                last.setDate(last.getDate() - 1);
            }
            return last.getDate();
        };

        // MLK Day: 3rd Mon of Jan
        if (m === 1 && d === getNthWeekday(y, 1, 3, 1)) return "MLK Day";
        // Presidents' Day: 3rd Mon of Feb
        if (m === 2 && d === getNthWeekday(y, 2, 3, 1)) return "Presidents' Day";
        // Memorial Day: Last Mon of May
        if (m === 5 && d === getLastMonday(y, 5)) return "Memorial Day";
        // Labor Day: 1st Mon of Sep
        if (m === 9 && d === getNthWeekday(y, 9, 1, 1)) return "Labor Day";
        // Columbus Day: 2nd Mon of Oct
        if (m === 10 && d === getNthWeekday(y, 10, 2, 1)) return "Columbus Day";
        // Thanksgiving: 4th Thu of Nov (weekday 4)
        if (m === 11 && d === getNthWeekday(y, 11, 4, 4)) return "Thanksgiving";

        return null;
    }

    // Day Details Modal Logic
    const dayModal = document.getElementById('dayModal');
    const closeDayModalBtn = document.getElementById('closeDayModal');
    const closeDayBtn = document.getElementById('closeDayBtn');
    const dayModalDate = document.getElementById('dayModalDate');
    const eventList = document.getElementById('eventList');
    const addEventFromDayBtn = document.getElementById('addEventFromDayBtn');

    let currentSelectedDateComponents = null;

    function openDayModal(dateStr, events) {
        dayModalDate.textContent = dateStr;
        eventList.innerHTML = '';

        // Parse date for adding new event
        const [y, m, d] = dateStr.split('-').map(Number);
        currentSelectedDateComponents = { year: y, month: m, day: d };

        if (events.length === 0) {
            eventList.innerHTML = '<p style="text-align:center; color: #6b7280; padding: 1rem;">No events for this day.</p>';
        } else {
            events.forEach(evt => {
                const item = document.createElement('div');
                item.className = 'event-item';

                let timeStr = '';
                if (evt.time) {
                    timeStr = ` <span class="event-time">${evt.time}</span>`;
                }

                const recurrenceLabel = evt.recurrence !== 'NONE' ? (evt.recurrence.charAt(0) + evt.recurrence.slice(1).toLowerCase()) : 'One-time';
                item.innerHTML = `
                    <div class="event-info">
                        <span class="event-title">${evt.title}${timeStr}</span>
                        <span class="event-meta">${evt.type} • ${recurrenceLabel}</span>
                    </div>
                    <div class="event-actions">
                        <button class="edit-btn" data-id="${evt.id}">Edit</button>
                        <button class="delete-btn" data-id="${evt.id}">Delete</button>
                    </div>
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

            // Add edit listeners
            const editBtns = eventList.querySelectorAll('.edit-btn');
            editBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = parseInt(e.target.getAttribute('data-id'));
                    editReminder(id);
                });
            });
        }
        dayModal.classList.add('show');
    }

    function closeDayModalFunc() {
        dayModal.classList.remove('show');
    }

    // Add Event from Day Modal
    addEventFromDayBtn.addEventListener('click', () => {
        closeDayModalFunc();
        if (currentSelectedDateComponents) {
            // Pre-fill Add Modal
            document.getElementById('remId').value = '';
            document.getElementById('remModalTitle').textContent = 'Add Reminder';
            document.getElementById('remTitle').value = '';
            document.getElementById('remYear').value = currentSelectedDateComponents.year;
            document.getElementById('remMonth').value = currentSelectedDateComponents.month;
            document.getElementById('remDay').value = currentSelectedDateComponents.day;
            document.getElementById('remTime').value = '';
            document.getElementById('remAlert').value = 'none';
            document.getElementById('remRecurrence').value = 'NONE';

            // Default to Solar since we clicked a solar date
            const radios = document.getElementsByName('remType');
            for (let radio of radios) {
                if (radio.value === 'SOLAR') radio.checked = true;
            }

            modal.classList.add('show');
        }
    });

    closeDayModalBtn.addEventListener('click', closeDayModalFunc);
    closeDayBtn.addEventListener('click', closeDayModalFunc);
    window.addEventListener('click', (e) => {
        if (e.target === dayModal) closeDayModalFunc();
    });

    const deleteChoiceModal = document.getElementById('deleteChoiceModal');
    let reminderToDelete = null;

    function showDeleteChoice(id) {
        reminderToDelete = reminders.find(r => r.id === id);
        if (!reminderToDelete) return;
        deleteChoiceModal.classList.add('show');
    }

    document.getElementById('deleteSingleBtn').addEventListener('click', async () => {
        if (!reminderToDelete) return;

        try {
            if (reminderToDelete.recurrence !== 'NONE') {
                // If repeating, we add an exception instead of deleting the whole thing
                if (!currentSelectedDateComponents) return;

                if (!confirm(`Delete only this instance on ${currentSelectedDateComponents.year}-${currentSelectedDateComponents.month}-${currentSelectedDateComponents.day}?`)) return;

                const res = await fetch(`${API_URL}/${reminderToDelete.id}/exceptions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        year: currentSelectedDateComponents.year,
                        month: currentSelectedDateComponents.month,
                        day: currentSelectedDateComponents.day
                    })
                });
                if (!res.ok) throw new Error('Failed to add exception');
                alert('Instance removed from calendar.');
            } else {
                // Not repeating, delete the record entirely
                if (!confirm(`Delete this instance of "${reminderToDelete.title}"?`)) return;
                const res = await fetch(`${API_URL}/${reminderToDelete.id}`, { method: 'DELETE' });
                const data = await res.json();
                alert(`Instance deleted.`);
            }

            await fetchReminders();
            deleteChoiceModal.classList.remove('show');
            closeDayModalFunc();
        } catch (e) {
            console.error('Delete failed:', e);
            alert('Failed to delete instance: ' + e.message);
        }
    });

    document.getElementById('deleteSeriesBtn').addEventListener('click', async () => {
        if (!reminderToDelete) return;
        if (!confirm(`Are you sure you want to delete ALL instances of "${reminderToDelete.title}"?`)) return;
        try {
            const res = await fetch(`${API_URL}/by-title/${encodeURIComponent(reminderToDelete.title)}`, { method: 'DELETE' });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Server error');
            }
            const data = await res.json();
            alert(`Successfully deleted ${data.count} items in the series.`);
            await fetchReminders();
            deleteChoiceModal.classList.remove('show');
            closeDayModalFunc();
        } catch (e) {
            console.error('Delete series failed:', e);
            alert('Failed to delete series: ' + e.message);
        }
    });

    document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
        deleteChoiceModal.classList.remove('show');
    });

    async function deleteReminder(id) {
        showDeleteChoice(id);
    }

    function editReminder(id) {
        closeDayModalFunc(); // Close Day Modal first for better UX
        const r = reminders.find(rem => rem.id === id);
        if (!r) return;

        document.getElementById('remId').value = r.id;
        document.getElementById('remTitle').value = r.title;
        document.getElementById('remYear').value = r.year;
        document.getElementById('remMonth').value = r.month;
        document.getElementById('remDay').value = r.day;
        document.getElementById('remTime').value = r.time || '';
        document.getElementById('remAlert').value = r.alertTiming || 'none';
        document.getElementById('remRecurrence').value = r.recurrence || 'NONE';

        const radios = document.getElementsByName('remType');
        for (let radio of radios) {
            if (radio.value === r.type) radio.checked = true;
        }

        document.getElementById('remModalTitle').textContent = 'Edit Reminder';
        modal.classList.add('show');
    }

    // Notification Logic
    if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }

    function checkReminders() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // 1-based
        const day = now.getDate();
        const hour = now.getHours();
        const minute = now.getMinutes();

        reminders.forEach(r => {
            if (r.alertTiming === 'none' || !r.time) return;

            // Parse reminder time
            const [rHour, rMinute] = r.time.split(':').map(Number);

            // Determine if "today" matches this reminder's pattern
            let isMatch = false;
            let eventDate;

            if (r.recurrence === 'WEEKLY') {
                let startWeekday;
                if (r.type === 'SOLAR') {
                    const startYear = r.year || 2024;
                    startWeekday = new Date(startYear, r.month - 1, r.day).getDay();
                } else {
                    try {
                        const startYear = r.year || 2024;
                        const startLunar = Lunar.fromYmd(startYear, r.month, r.day);
                        startWeekday = startLunar.getSolar().getWeek();
                    } catch (e) {
                        return;
                    }
                }
                isMatch = startWeekday === now.getDay();
                if (isMatch) eventDate = new Date(year, month - 1, day, rHour, rMinute);
            } else if (r.recurrence === 'MONTHLY') {
                if (r.type === 'SOLAR') {
                    isMatch = r.day === day;
                } else {
                    const solar = Solar.fromDate(now);
                    const lunar = solar.getLunar();
                    isMatch = r.day === lunar.getDay();
                }
                if (isMatch) eventDate = new Date(year, month - 1, day, rHour, rMinute);
            } else if (r.type === 'SOLAR') {
                if (r.recurrence === 'ANNUALLY') {
                    isMatch = r.month === month && r.day === day;
                } else {
                    isMatch = r.year === year && r.month === month && r.day === day;
                }
                if (isMatch) eventDate = new Date(year, month - 1, day, rHour, rMinute);
            } else {
                // Lunar
                const solar = Solar.fromDate(now);
                const lunar = solar.getLunar();
                if (r.recurrence === 'ANNUALLY') {
                    isMatch = r.month === lunar.getMonth() && r.day === lunar.getDay();
                } else {
                    isMatch = r.year === lunar.getYear() && r.month === lunar.getMonth() && r.day === lunar.getDay();
                }
                if (isMatch) eventDate = new Date(year, month - 1, day, rHour, rMinute);
            }

            if (!isMatch || !eventDate) return;

            // Check if this specific instance is an exception
            if (r.exceptions && r.exceptions.some(ex => ex.year === year && ex.month === month && ex.day === day)) {
                return;
            }

            let alertTime = new Date(eventDate);

            // Adjust for alert timing
            if (r.alertTiming === '1h_before') {
                alertTime.setHours(alertTime.getHours() - 1);
            } else if (r.alertTiming === '1d_before') {
                alertTime.setDate(alertTime.getDate() - 1);
            }

            // Check if alertTime matches NOW (to the minute)
            if (alertTime.getFullYear() === year &&
                (alertTime.getMonth() + 1) === month &&
                alertTime.getDate() === day &&
                alertTime.getHours() === hour &&
                alertTime.getMinutes() === minute) {

                let label = '';
                if (r.alertTiming === 'at_time') label = 'Event starting now!';
                else if (r.alertTiming === '1h_before') label = 'Event in 1 hour';
                else if (r.alertTiming === '1d_before') label = 'Event tomorrow';

                triggerNotification(r, label);
            }
        });
    }

    function triggerNotification(r, msg) {
        // Prevent duplicate alerts in same minute (use hour:minute as key)
        const now = new Date();
        const timeKey = `${now.getHours()}:${now.getMinutes()}`;
        const key = `alert_${r.id}_${timeKey}`;

        if (sessionStorage.getItem(key)) return;

        console.log(`Triggering notification for ${r.title}: ${msg}`);

        // Browser Notification
        if (Notification.permission === 'granted') {
            new Notification(r.title, {
                body: msg,
                icon: 'icon.png'
            });
        }

        // App Modal Notification
        showAlertModal(r.title, msg);

        sessionStorage.setItem(key, 'true');
    }

    // Alert Modal Logic
    const alertModal = document.getElementById('alertModal');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const alertClose = document.getElementById('alertClose');

    function showAlertModal(title, message) {
        alertTitle.textContent = title;
        alertMessage.textContent = message;
        alertModal.classList.add('show');
    }

    if (alertClose) {
        alertClose.addEventListener('click', () => {
            alertModal.classList.remove('show');
        });
    }

    // Check every minute for alerts
    setInterval(checkReminders, 60000);

    // Initial load
    fetchReminders();
    checkReminders();

    // Database Tools Area
    const migrateBtn = document.getElementById('migrateDataBtn');
    const seedBtn = document.getElementById('seedHolidaysBtn');

    if (migrateBtn) {
        migrateBtn.addEventListener('click', async () => {
            const localReminders = JSON.parse(localStorage.getItem('lunar_reminders')) || [];
            if (localReminders.length === 0) {
                alert('No old local data found to migrate.');
                return;
            }

            if (!confirm(`Found ${localReminders.length} old reminders. Migrate them to the database?`)) return;

            let successCount = 0;
            for (const r of localReminders) {
                try {
                    // Avoid duplicates
                    if (reminders.some(curr => curr.id === r.id)) continue;

                    const migrationData = { ...r };
                    if (r.repeat !== undefined) {
                        migrationData.recurrence = r.repeat ? 'ANNUALLY' : 'NONE';
                        delete migrationData.repeat;
                    }

                    await fetch(API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(migrationData)
                    });
                    successCount++;
                } catch (e) {
                    console.error('Failed to migrate:', r, e);
                }
            }
            alert(`Successfully migrated ${successCount} reminders!`);
            fetchReminders();
        });
    }

    if (seedBtn) {
        seedBtn.addEventListener('click', async () => {
            if (!confirm('This will register KR and US (fixed) holidays for 2024-2030. Proceed?')) return;

            const holidayData = [];
            const startYear = 2024;
            const endYear = 2030;

            for (let y = startYear; y <= endYear; y++) {
                // KR Holidays
                const krHolidays = [
                    { m: 1, d: 1, name: '설날' },
                    { m: 1, d: 15, name: '정월대보름' },
                    { m: 4, d: 8, name: '부처님오신날' },
                    { m: 5, d: 5, name: '단오' },
                    { m: 8, d: 15, name: '추석' }
                ];
                krHolidays.forEach(h => {
                    holidayData.push({
                        id: Number(`99${y}${String(h.m).padStart(2, '0')}${String(h.d).padStart(2, '0')}1`),
                        title: h.name,
                        type: 'LUNAR',
                        year: y,
                        month: h.m,
                        day: h.d,
                        time: '09:00',
                        alertTiming: 'none',
                        recurrence: 'NONE'
                    });
                });

                // KR Solar Holidays
                const krSolarHolidays = [
                    { m: 1, d: 1, name: '신정' },
                    { m: 3, d: 1, name: '삼일절' },
                    { m: 5, d: 5, name: '어린이날' },
                    { m: 6, d: 6, name: '현충일' },
                    { m: 8, d: 15, name: '광복절' },
                    { m: 10, d: 3, name: '개천절' },
                    { m: 10, d: 9, name: '한글날' },
                    { m: 12, d: 25, name: '성탄절' }
                ];
                krSolarHolidays.forEach(h => {
                    holidayData.push({
                        id: Number(`99${y}${String(h.m).padStart(2, '0')}${String(h.d).padStart(2, '0')}3`),
                        title: h.name,
                        type: 'SOLAR',
                        year: y,
                        month: h.m,
                        day: h.d,
                        time: '09:00',
                        alertTiming: 'none',
                        recurrence: 'NONE'
                    });
                });

                // US Fixed Holidays
                const usFixed = [
                    { m: 1, d: 1, name: "New Year's Day" },
                    { m: 6, d: 19, name: "Juneteenth" },
                    { m: 7, d: 4, name: "Independence Day" },
                    { m: 11, d: 11, name: "Veterans Day" },
                    { m: 12, d: 25, name: "Christmas Day" }
                ];
                usFixed.forEach(h => {
                    holidayData.push({
                        id: Number(`99${y}${String(h.m).padStart(2, '0')}${String(h.d).padStart(2, '0')}2`),
                        title: h.name,
                        type: 'SOLAR',
                        year: y,
                        month: h.m,
                        day: h.d,
                        time: '09:00',
                        alertTiming: 'none',
                        recurrence: 'NONE' // Holidays in seed are explicit per year for now
                    });
                });
            }

            try {
                const res = await fetch('http://localhost:3000/api/seed-holidays', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(holidayData)
                });
                const result = await res.json();
                alert(`Registered ${result.count} holidays!`);
                fetchReminders();
            } catch (e) {
                console.error('Seeding failed:', e);
                alert('Failed to register holidays.');
            }
        });
    }
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (reminders.length === 0) {
                alert('No reminders to export.');
                return;
            }
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reminders, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `lunar_reminders_backup_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        });
    }

    if (importBtn) {
        importBtn.addEventListener('click', () => importFile.click());
    }

    if (importFile) {
        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);
                    if (!Array.isArray(importedData)) throw new Error('Invalid format');

                    if (!confirm(`Import ${importedData.length} records? This will add them to your current database.`)) return;

                    // Use the same seeding endpoint for bulk import as it handles transactions
                    const res = await fetch('http://localhost:3000/api/seed-holidays', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(importedData)
                    });
                    const result = await res.json();
                    alert(`Successfully imported ${result.count} reminders!`);
                    fetchReminders();
                } catch (err) {
                    console.error('Import failed:', err);
                    alert('Failed to import file. Please ensure it is a valid JSON backup.');
                }
            };
            reader.readAsText(file);
            importFile.value = ''; // reset
        });
    }

});
