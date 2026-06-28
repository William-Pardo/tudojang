const https = require('https');

const PRIVATE_KEY = process.env.WOMPI_PRIVATE_KEY;
if (!PRIVATE_KEY) throw new Error("Configura WOMPI_PRIVATE_KEY en el entorno.");
const HOST = "production.wompi.co";

const planes = [
    {
        id_local: 'starter',
        name: "Tudojang Starter (Mensual)",
        description: "Plan Starter: 50 alumnos, 2 instr, 1 sede",
        amount_in_cents: 16000000,
        currency: "COP",
        interval: "MONTH",
        interval_count: 1
    },
    {
        id_local: 'growth',
        name: "Tudojang Growth (Mensual)",
        description: "Plan Growth: 150 alumnos, 5 instr, 2 sedes",
        amount_in_cents: 34000000,
        currency: "COP",
        interval: "MONTH",
        interval_count: 1
    },
    {
        id_local: 'pro',
        name: "Tudojang Pro (Mensual)",
        description: "Plan Pro: 350 alumnos, 10 instr, 5 sedes",
        amount_in_cents: 58000000,
        currency: "COP",
        interval: "MONTH",
        interval_count: 1
    }
];

function request(path, method, data = null) {
    return new Promise((resolve, reject) => {
        const postData = data ? JSON.stringify(data) : '';
        const options = {
            hostname: HOST,
            path: path,
            method: method,
            headers: {
                'Authorization': `Bearer ${PRIVATE_KEY}`,
                'Content-Type': 'application/json'
            }
        };
        if (postData) {
            options.headers['Content-Length'] = postData.length;
        }

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
        if (postData) req.write(postData);
        req.end();
    });
}

async function crearPlanes() {
    console.log("🚀 Probando conexión con Wompi API...");

    // Probar primero el endpoint de merchants para validar la llave
    const merchantCheck = await request('/v1/merchants/pub_prod_2XIISLESsoU3kWMce51HMChsMdr1tzVB', 'GET');
    console.log(`📡 Merchant status: ${merchantCheck.status}`);

    if (merchantCheck.status !== 200) {
        console.error("❌ Error de comunicación o llave inválida.");
        return;
    }

    // Intentar con /v1/subscription_plans (Guion bajo)
    console.log("\n🚀 Intentando crear planes con /v1/subscription_plans...");
    const resultados = {};

    for (const plan of planes) {
        console.log(`Enviando plan: ${plan.name}...`);
        const res = await request('/v1/subscription_plans', 'POST', {
            name: plan.name,
            description: plan.description,
            amount_in_cents: plan.amount_in_cents,
            currency: plan.currency,
            interval: plan.interval,
            interval_count: plan.interval_count
        });

        if (res.status === 201 || res.status === 200) {
            console.log(`✅ Éxito! ID: ${res.data.data.id}`);
            resultados[plan.id_local] = res.data.data.id;
        } else {
            console.error(`❌ Falló (${res.status}):`, res.data || res.body);

            // Si dio 404, intentar con guion medio /v1/subscription-plans
            if (res.status === 404) {
                console.log("🔄 Reintentando con guion medio: /v1/subscription-plans...");
                const res2 = await request('/v1/subscription-plans', 'POST', {
                    name: plan.name,
                    description: plan.description,
                    amount_in_cents: plan.amount_in_cents,
                    currency: plan.currency,
                    interval: plan.interval,
                    interval_count: plan.interval_count
                });
                if (res2.status === 201 || res2.status === 200) {
                    console.log(`✅ Éxito con guion medio! ID: ${res2.data.data.id}`);
                    resultados[plan.id_local] = res2.data.data.id;
                } else {
                    console.error(`❌ Falló también con guion medio (${res2.status})`);
                }
            }
        }
    }

    console.log("\n📋 RESUMEN DE IDS:");
    console.log(JSON.stringify(resultados, null, 2));
}

crearPlanes();
