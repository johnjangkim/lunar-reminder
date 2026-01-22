
const API_URL = 'http://localhost:3000/api/reminders';

async function testRegistration() {
    console.log("Testing API Registration...");
    const testData = {
        id: Date.now(),
        title: "API Test Task",
        type: "SOLAR",
        year: 2026,
        month: 1,
        day: 22,
        time: "10:00",
        alertTiming: "at_time",
        recurrence: "NONE"
    };

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testData)
        });

        if (res.ok) {
            console.log("SUCCESS: Reminder registered via API.");
            const data = await res.json();
            console.log("Response:", data);
        } else {
            const error = await res.text();
            console.error("FAILURE: Server returned", res.status, error);
        }
    } catch (e) {
        console.error("FAILURE: Could not connect to API:", e.message);
    }
}

testRegistration();
