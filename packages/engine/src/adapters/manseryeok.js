const { splitPillar } = require("../domain/ganzhi");

const DATA_SOURCE = {
  authority: "KASI",
  authorityKo: "한국천문연구원",
  library: "@fullstackfamily/manseryeok",
};

async function getLib() {
  return import("@fullstackfamily/manseryeok");
}

function normalizeSajuResult(sajuRaw, meta = {}) {
  const year = splitPillar(sajuRaw.yearPillar);
  const month = splitPillar(sajuRaw.monthPillar);
  const day = splitPillar(sajuRaw.dayPillar);
  const hour = splitPillar(sajuRaw.hourPillar);

  return {
    pillars: {
      year: { ...year, text: sajuRaw.yearPillar },
      month: { ...month, text: sajuRaw.monthPillar },
      day: { ...day, text: sajuRaw.dayPillar },
      hour: { ...hour, text: sajuRaw.hourPillar },
    },
    meta: {
      dataSource: DATA_SOURCE,
      calendarType: meta.calendarType || "solar",
      solarDateUsed: meta.solarDateUsed || null,
      convertedFromLunar: meta.convertedFromLunar || null,
      isTimeCorrected: !!sajuRaw.isTimeCorrected,
      correctedTime: sajuRaw.correctedTime || null,
    },
  };
}

async function calculateSajuSolar(input) {
  const {
    year,
    month,
    day,
    hour,
    minute,
    longitude,
    applyTimeCorrection,
    calendarType,
    isLeapMonth,
  } = input;
  const lib = await getLib();
  const isLunarInput = calendarType === "lunar";
  let solarDateUsed = { year, month, day };
  let convertedFromLunar = null;

  if (isLunarInput) {
    const lunarToSolarResult = lib.lunarToSolar(year, month, day, isLeapMonth === true);
    solarDateUsed = {
      year: lunarToSolarResult.solar.year,
      month: lunarToSolarResult.solar.month,
      day: lunarToSolarResult.solar.day,
    };
    convertedFromLunar = { year, month, day, isLeapMonth: isLeapMonth === true };
  }

  const sajuRaw = lib.calculateSaju(solarDateUsed.year, solarDateUsed.month, solarDateUsed.day, hour ?? 0, minute ?? 0, {
    longitude: typeof longitude === "number" ? longitude : 127,
    applyTimeCorrection: applyTimeCorrection !== false,
  });
  return normalizeSajuResult(sajuRaw, {
    calendarType: isLunarInput ? "lunar" : "solar",
    solarDateUsed,
    convertedFromLunar,
  });
}

async function getSolarTermsByYear(year) {
  const lib = await getLib();
  return lib.getSolarTermsByYear(year);
}

module.exports = {
  calculateSajuSolar,
  getSolarTermsByYear,
};
