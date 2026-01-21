const express = require('express');
const { Solar } = require('lunar-javascript');
const path = require('path');

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    const now = new Date();
    // Use current year/month or query params
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1); // JS Month is 0-indexed, Solar uses 1-indexed

    // Calculate days in the month
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 (Sun) - 6 (Sat)

    const calendarDays = [];

    // Padding for days before the 1st
    for (let i = 0; i < firstDayOfWeek; i++) {
        calendarDays.push(null);
    }

    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
        const solar = Solar.fromYmd(year, month, d);
        const lunar = solar.getLunar();

        // Numeric Lunar Date Format: M/D
        const lunarDateStr = `${lunar.getMonth()}/${lunar.getDay()}`;

        calendarDays.push({
            solarDay: d,
            lunarDateStr: lunarDateStr,
            isToday: (d === now.getDate() && month === (now.getMonth() + 1) && year === now.getFullYear()),
            term: lunar.getJieQi() // Solar term if any
        });
    }

    // Next/Prev logic
    const prevMonthDate = new Date(year, month - 1 - 1, 1);
    const nextMonthDate = new Date(year, month - 1 + 1, 1);

    // Month display name
    const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });

    res.render('index', {
        year,
        month,
        monthName,
        calendarDays,
        prevYear: prevMonthDate.getFullYear(),
        prevMonth: prevMonthDate.getMonth() + 1,
        nextYear: nextMonthDate.getFullYear(),
        nextMonth: nextMonthDate.getMonth() + 1
    });
});

app.listen(port, () => {
    console.log(`Lunar Reminder app listening at http://localhost:${port}`);
});
