// Script para reparar el registro usando curl
const { exec } = require('child_process');

const url = 'https://us-central1-tudojang.cloudfunctions.net/repararRegistroManual?email=gengepardo@gmail.com';

console.log('🔧 Ejecutando reparación de registro...\n');
console.log('URL:', url);
console.log('='.repeat(60));

exec(`curl "${url}"`, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Error ejecutando curl:', error.message);
        return;
    }

    if (stderr) {
        console.error('⚠️ Advertencia:', stderr);
    }

    console.log('\n📋 RESPUESTA DE LA FUNCIÓN:\n');
    console.log(stdout);
    console.log('\n' + '='.repeat(60));

    try {
        const response = JSON.parse(stdout);
        if (response.success) {
            console.log('\n✅ REPARACIÓN EXITOSA!');
            console.log('\n📋 DATOS DE ACCESO:');
            console.log('   Email:', response.datos.email);
            console.log('   Contraseña:', response.datos.password);
            console.log('   Slug:', response.datos.slug);
            console.log('   TenantID:', response.datos.tenantId);
            console.log('\n🚀 AHORA PUEDES INGRESAR A:');
            console.log('   https://tudojang.web.app/#/login');
        } else {
            console.log('\n❌ ERROR EN REPARACIÓN:');
            console.log('   ', response.error);
        }
    } catch (e) {
        console.log('\n⚠️ No se pudo parsear la respuesta como JSON');
        console.log('Respuesta cruda:', stdout);
    }
});
