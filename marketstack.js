//###########################################################
//region Throttled Request Queue
// MarketStack rate limit: 5 requests/second
// Strategy: allow bursts of 5, only wait if the burst was faster than 1s
// Deduplication: identical URLs are coalesced — fetched once, result shared
const maxPerWindow = 5
const windowMS = 1001 // 1s + 1ms safety margin

const queue = []
const pending = new Map() // url → [{resolve, reject}, ...]

var processing = false
var windowStart = 0
var windowCount = 0

//###########################################################
function queueRequest(url) {
    return new Promise(function(resolve, reject) {
        
        if (pending.has(url)) {
            pending.get(url).push({resolve, reject})
            return
        }
        
        pending.set(url, [{resolve, reject}])
        queue.push(url)
        
        if (!processing) {
            return processQueue()
        }
    })
}

//###########################################################
async function processQueue() {
    var body, elapsed, err, i, j, len, len1, remaining, response, text, url, w, waiters;

    if (processing || queue.length === 0) {
        return;
    }

    processing = true;
    while (queue.length > 0) {
        // Start new measurement window
        if (windowCount === 0) {
        windowStart = performance.now();
        }
        windowCount++;
        url = queue.shift();
        waiters = pending.get(url);
        try {
        response = (await fetch(url));
        if (!response.ok) {
            text = (await response.text());
            throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
        }
        body = (await response.json());
        pending.delete(url);
        for (i = 0, len = waiters.length; i < len; i++) {
            w = waiters[i];
            w.resolve(body);
        }
        } catch (error) {
        err = error;
        pending.delete(url);
        for (j = 0, len1 = waiters.length; j < len1; j++) {
            w = waiters[j];
            w.reject(err);
        }
        }
        // After 5 requests, check if we need to slow down
        if (windowCount >= maxPerWindow) {
        elapsed = performance.now() - windowStart;
        remaining = windowMS - elapsed;
        if (remaining > 0) {
            await waitMS(remaining);
        }
        windowCount = 0;
        }
    }
    processing = false;
};

//###########################################################
function waitMS(ms) {
    return new Promise(function(res) { return setTimeout(res, ms) })
}

function getEoDFetchURL(params) {
    params.sort = "DESC"
    const urlParams = new URLSearchParams(params)
    return "https://api.marketstack.com/v2/eod?" + urlParams.toString()
}

//###########################################################
export async function eodsAroundSplitRequest(symbol, date, access_key) {
    var dateHelper = new Date(date)
    dateHelper.setDate(dateHelper.getDate() - 14)
    const date_from = dateHelper.toISOString().slice(0,10)

    var dateHelper = new Date(date)
    dateHelper.setDate(dateHelper.getDate() + 14)
    const date_to = dateHelper.toISOString().slice(0, 10)
    
    // console.log(symbol+": "+date_from+" "+date+" "+date_to)

    const params = { symbols: symbol, access_key, date_from, date_to }
    const url = getEoDFetchURL(params)
    // log clean URL
    params.access_key = "accssky"
    console.log(getEoDFetchURL(params))
    return await queueRequest(url)
}