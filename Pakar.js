const getAlarmsHistory = async ({fetch, agent = null, bustCache = true, mode = null, lang = null, fromDate = null, toDate = null, cities = []}) => {
    let fromDateStr = '';
    if (fromDate) {
        const s = fromDate.toISOString();
        fromDateStr = s.substring(0, s.length - 5);
    }

    let toDateStr = '';
    if (toDate) {
        const s = toDate.toISOString();
        toDateStr = s.substring(0, s.length - 5);
    }

    let citiesStr = '';
    for (let i = 0; i < cities.length; ++i) {
        citiesStr += `&city_${i}=${cities[i]}`;
    }

    // Remote server returns Cache-Control: public, max-age=120
    // We set a fictitious query parameter 't' to current timestamp to guarantee freshness (bust the cache)
    const bustCacheStr = bustCache ? `&t=${Date.now()}` : '';
    
    const response = await fetch(`https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx?lang=${lang}&mode=${mode}&fromDate=${fromDateStr}&toDate=${toDateStr}${citiesStr}${bustCacheStr}`, {
        agent
    });
    return await response.json();
};

const fetchAlertsByRange = async ({fetch, agent = null, bustCache = true, lang = 'he', fromDate = null, toDate = null}) => {
    return getAlarmsHistory({
        fetch,
        agent,
        bustCache,
        mode: 0,
        lang,
        fromDate,
        toDate
    });
};

const fetchAlertsLastMonth = async ({fetch, agent = null, bustCache = true, lang = 'he', cities = []}) => {
    return getAlarmsHistory({
        fetch,
        agent,
        bustCache,
        mode: 3,
        lang,
        cities
    });
};

const getCitiesMix = async ({fetch, agent = null, lang = 'he'}) => {
    const response = await fetch(`https://alerts-history.oref.org.il/Shared/Ajax/GetCitiesMix.aspx?lang=${lang}&`, {
        agent
    });
    return await response.json();
};

const getDistricts = async ({fetch, agent = null, lang = 'he'}) => {
    const response = await fetch(`https://alerts-history.oref.org.il/Shared/Ajax/GetDistricts.aspx?lang=${lang}&`, {
        agent
    });
    return await response.json();
};

export { fetchAlertsByRange, fetchAlertsLastMonth, getCitiesMix, getDistricts };
