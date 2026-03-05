function parseDateTime(dateStr, timeStr) {
    if (dateStr.includes('.')) {
        const parts = dateStr.split('.');
        if (parts.length === 3 && parts[0].length === 2) {
            dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
    }

    if (timeStr.includes(':')) {
        const [h, m] = timeStr.split(':');
        timeStr = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    }
    return new Date(`${dateStr}T${timeStr}:00`);
}

function getExamEndTime(dateStr, timeStr) {
    const startTime = parseDateTime(dateStr, timeStr);
    return new Date(startTime.getTime() + 40 * 60000); // 40 minutes duration
}

const now = new Date();
const targetTime = parseDateTime('03.03.2026', '10:50');
const endTime = getExamEndTime('03.03.2026', '10:50');

const diffMins = (targetTime - now) / 1000 / 60;
const diffEndMins = (endTime - now) / 1000 / 60;

console.log("Now:", now);
console.log("Target:", targetTime);
console.log("End:", endTime);
console.log("diffMins:", diffMins);
console.log("diffEndMins:", diffEndMins);
console.log("Condition (diffMins <= 20 && diffEndMins >= 0):", diffMins <= 20 && diffEndMins >= 0);
