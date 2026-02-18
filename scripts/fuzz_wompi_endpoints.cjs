const https = require('https');

const PRIVATE_KEY = "prv_prod_hruawVEOZ8tsoL7NIEgqULsyzCx3QYBB";
const HOSTS = ["production.wompi.co", "api.wompi.co", "sandbox.wompi.co"];

const endpoints = [
    '/v1/plans',
    '/v1/subscription_plans',
    '/v1/subscription-plans'
];

function request(host, path, method, data = null) {
    return new Promise((resolve, reject) => {
        const postData = data ? JSON.stringify(data) : '';
        const options = {
            hostname: host,
            path: path,
            method: method,
            headers: {
                'Authorization': `Bearer ${PRIVATE_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (d) => body += d);
            res.on('end', () => {
                try {
                    const json = body ? JSON.parse(body) : {};
                    resolve({ status: res.statusCode, data: json, path: path, host: host });
                } catch (e) {
                    resolve({ status: res.statusCode, body: body, path: path, host: host });
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (postData) req.write(postData);
        req.end();
    });
}

async function fuzzer() {
    console.log("🚀 Fuzzing endpoints and hosts for Wompi Plans...");
    for (const host of HOSTS) {
        for (const endpoint of endpoints) {
            console.log(`Checking https://${host}${endpoint}...`);
            const res = await request(host, endpoint, 'GET');
            console.log(`Result ${host}${endpoint}: ${res.status}`);
            if (res.status === 200) {
                console.log("✅ FOUND! Content:", JSON.stringify(res.data, null, 2));
                return; // Stop if found
            }
        }
    }
}

fuzzer();
