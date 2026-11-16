// AI citation: drafted with OpenAI Codex; applies to this file.
"use strict";

const form = document.querySelector("#city-form");
const cityInput = document.querySelector("#city");
const submission = document.querySelector("#submission");
const cityEcho = document.querySelector("#city-echo");
const status = document.querySelector("#lookup-status");
const details = document.querySelector("#weather-details");
const observedCity = document.querySelector("#observed-city");
const observationTime = document.querySelector("#observation-time");
const temperature = document.querySelector("#temperature-value");
const humidity = document.querySelector("#humidity-value");
const wind = document.querySelector("#wind-value");

const displayNumber = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const displayTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

let pendingLookup;

function cityKey(value) {
  return typeof value === "string" ? value.trim().normalize("NFC").toLowerCase() : "";
}

async function readJson(url, signal) {
  try {
    const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

async function getWeather(city, signal) {
  const key = cityKey(city);
  const search = new URLSearchParams({ city });
  const response = await readJson(`api/weather?${search}`, signal);
  if (cityKey(response?.city) === key) {
    return { weather: response, archive: false };
  }

  if (signal.aborted) {
    return null;
  }
  const archive = await readJson("data/latest-weather.json", signal);
  if (!Array.isArray(archive)) {
    return null;
  }
  const weather = archive.find(record => cityKey(record?.city) === key);
  return weather ? { weather, archive: true } : null;
}

function writeMetric(element, value) {
  const valid = Number.isFinite(value);
  element.textContent = valid ? displayNumber.format(value) : "—";
  element.nextElementSibling.hidden = !valid;
}

function renderWeather(result) {
  const { weather, archive } = result;
  observedCity.textContent = weather.city;
  const time = new Date(weather.observed_at ?? Number.NaN);
  if (Number.isFinite(time.getTime())) {
    observationTime.dateTime = time.toISOString();
    observationTime.textContent = `${displayTime.format(time)} UTC`;
    observationTime.hidden = false;
  } else {
    observationTime.hidden = true;
  }
  writeMetric(temperature, weather.temperature_c);
  writeMetric(humidity, weather.humidity_pct);
  writeMetric(wind, weather.wind_speed_kmh);
  details.hidden = false;
  status.textContent = archive ? "From the saved weather archive." : "Latest available observation.";
}

cityInput.addEventListener("input", () => cityInput.setCustomValidity(""));

form.addEventListener("submit", async event => {
  event.preventDefault();
  const entered = cityInput.value;
  const city = entered.trim();
  if (!city) {
    cityInput.setCustomValidity("Enter a city name.");
    cityInput.reportValidity();
    return;
  }

  pendingLookup?.abort();
  const lookup = new AbortController();
  pendingLookup = lookup;
  cityEcho.textContent = entered;
  submission.hidden = false;
  details.hidden = true;
  status.textContent = "Looking up weather…";

  const timeout = window.setTimeout(() => {
    lookup.abort();
    if (pendingLookup === lookup) {
      status.textContent = "Weather lookup timed out. Try again.";
    }
  }, 8000);
  const result = await getWeather(city, lookup.signal);
  window.clearTimeout(timeout);
  if (lookup.signal.aborted) {
    return;
  }

  if (result) {
    renderWeather(result);
  } else {
    status.textContent = "No weather snapshot found for this city.";
  }
});
