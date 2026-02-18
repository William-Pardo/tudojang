const https = require('https');

const PRIVATE_KEY = "prv_prod_hruawVEOZ8tsoL7NIEgqULsyzCx3QYBB";
const HOST = "production.wompi.co";

function request(path, method) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: HOST,
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
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, body: body });
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function checkMerchant() {
    console.log("🚀 Checking Merchant Info...");
    const res = await request('/v1/merchants/pub_prod_2XIISLESsoU3kWMce51HMChsMdr1tzVB', 'GET');
    console.log(`Status: ${res.status}`);
    console.log("Content:", JSON.stringify(res.data, null, 2));
}

checkMerchant();
