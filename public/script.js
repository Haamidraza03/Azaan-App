let prayerTimings = {};
let scheduledTimers = [];
let countdownInterval = null;

async function fetchPrayerTimings() {
  try {
    // Use a relative URL instead of an absolute localhost URL.
    const response = await fetch("/api/namaz_timings");
    const data = await response.json();
    prayerTimings = data;
    updateTimingsUI();
    scheduleAzaanAlarms();
  } catch (error) {
    console.error("Error fetching prayer timings:", error);
  }
}


function updateTimingsUI() {
  const tbody = document.querySelector("#timingsTable tbody");
  tbody.innerHTML = "";
  for (const [prayer, time] of Object.entries(prayerTimings)) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${prayer}</td><td>${time}</td>`;
    tbody.appendChild(row);
  }
}

function clearScheduledTimers() {
  scheduledTimers.forEach(timer => clearTimeout(timer));
  scheduledTimers = [];
}

function timeStringToDate(timeStr) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
}

function scheduleAzaanAlarms() {
  clearScheduledTimers();
  const now = new Date();
  Object.entries(prayerTimings).forEach(([prayer, timeStr]) => {
    let alarmTime = timeStringToDate(timeStr);
    if (alarmTime <= now) alarmTime.setDate(alarmTime.getDate() + 1);
    const timeDiff = alarmTime - now;
    const timerId = setTimeout(() => {
      playAzaan();
      updateNextPrayerInfo();
    }, timeDiff);
    scheduledTimers.push(timerId);
  });
  updateNextPrayerInfo();
}

function updateNextPrayerInfo() {
  clearInterval(countdownInterval);
  const now = new Date();
  let nextPrayer = null;
  let nextTime = null;
  for (const [prayer, timeStr] of Object.entries(prayerTimings)) {
    let prayerTime = timeStringToDate(timeStr);
    if (prayerTime <= now) prayerTime.setDate(prayerTime.getDate() + 1);
    if (!nextTime || prayerTime < nextTime) {
      nextTime = prayerTime;
      nextPrayer = prayer;
    }
  }
  if (nextPrayer && nextTime) {
    document.getElementById("nextPrayerName").innerText = nextPrayer;
    document.getElementById("nextPrayerTime").innerText = nextTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    countdownInterval = setInterval(() => {
      const diff = nextTime - new Date();
      if (diff <= 0) {
        document.getElementById("timeLeft").innerText = "00:00:00";
        clearInterval(countdownInterval);
      } else {
        document.getElementById("timeLeft").innerText = formatTime(diff);
      }
    }, 1000);
  }
}

function formatTime(ms) {
  let totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function pad(num) {
  return num.toString().padStart(2, "0");
}

function playAzaan() {
  const audio = document.getElementById("azaanAudio");
  audio.play().catch(err => console.error("Audio playback failed:", err));
}

document.addEventListener("DOMContentLoaded", () => {
  fetchPrayerTimings();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  setInterval(fetchPrayerTimings, oneWeek);
});
