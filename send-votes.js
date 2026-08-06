const fs = require('fs');
const path = require('path');
const https = require('https');

const API = 'https://projectagustusan-production.up.railway.app/api/votes';
const CANDIDATES = [
  'cms8sr9kh000e24utndcqcyje', // RT: SUWOYO
  'cms8srlbi000v24utouqou45n', // RW: BUDI EKO PURWANTO
  'cms8stkrm000k0outh9kjd4lc'  // Posyandu: ENITA LISTYANINGSIH
];

function postVote(voterName, voterAddress, candidateId) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ voterName, voterAddress, candidateId });
    const url = new URL(API);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'Mozilla/5.0'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else if (res.statusCode === 409) {
          // Jika sudah memilih, resolve sebagai penanda bahwa suara sudah ada (conflict)
          resolve(JSON.stringify({ conflict: true, body }));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const filePath = path.join(__dirname, 'warga.json');
  if (!fs.existsSync(filePath)) {
    console.error('File warga.json tidak ditemukan.');
    process.exit(1);
  }

  const wargaList = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const remaining = wargaList.filter(w => !w.voted);

  if (remaining.length === 0) {
    console.log('Semua warga sudah memilih.');
    return;
  }

  // Pilih satu warga secara acak
  const selectedIndex = Math.floor(Math.random() * remaining.length);
  const target = remaining[selectedIndex];

  // Cari index asli di array wargaList
  const originalIndex = wargaList.findIndex(w => w.nama === target.nama && w.alamat === target.alamat);

  // Delay acak antara 60 hingga 300 detik (1-5 menit), jika di lokal hanya 1 detik untuk testing
  const isCI = process.env.CI === 'true';
  const delaySec = isCI ? (Math.floor(Math.random() * 240) + 60) : 1;
  console.log(`Mengirim suara untuk: ${target.nama} (${target.alamat})`);
  console.log(`Menunggu delay acak selama ${delaySec} detik...`);
  await sleep(delaySec * 1000);

  try {
    const promises = CANDIDATES.map(id => postVote(target.nama, target.alamat, id));
    await Promise.all(promises);

    console.log(`Berhasil mengirim suara untuk ${target.nama}!`);
    wargaList[originalIndex].voted = true;
    fs.writeFileSync(filePath, JSON.stringify(wargaList, null, 2), 'utf8');
    console.log('Status warga.json berhasil diperbarui.');
  } catch (err) {
    console.error('Gagal mengirim suara:', err.message);
    process.exit(1);
  }
}

run();
