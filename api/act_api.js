// Vercel Serverless Function: Act API (Firebase RTDB Backend for Etkinlik Yönetimi)
import fs from 'fs';
import path from 'path';
import { seedData } from './act_seed_data.js';

const FIREBASE_DB_URL = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";

function sinifIsmiTemizle(s) {
  if (!s) return "";
  return String(s).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

async function fb(endpoint, method = 'GET', data = null) {
  const secret = process.env.FIREBASE_SECRET || '';
  const authQuery = secret ? `?auth=${encodeURIComponent(secret)}` : '';
  const url = `${FIREBASE_DB_URL}/app_store/act_store/${endpoint}.json${authQuery}`;

  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (data !== null && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    opts.body = JSON.stringify(data);
  }

  try {
    const res = await fetch(url, opts);
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Firebase error [${method} ${endpoint}]:`, res.status, errText);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`Firebase fetch exception [${method} ${endpoint}]:`, err.message);
    return null;
  }
}

// Auto-seed if database is empty or explicitly requested
async function ensureSeeded() {
  try {
    const currentStudies = await fb('studies');
    if (!currentStudies || Object.keys(currentStudies).length === 0) {
      console.log('Seeding initial data to Firebase...');
      if (seedData) {
        if (seedData.studies) await fb('studies', 'PUT', seedData.studies);
        if (seedData.assignments) await fb('assignments', 'PUT', seedData.assignments);
        if (seedData.evaluations) await fb('evaluations', 'PUT', seedData.evaluations);
        if (seedData.study_groups) await fb('study_groups', 'PUT', seedData.study_groups);
        if (seedData.class_groups) await fb('class_groups', 'PUT', seedData.class_groups);
        if (seedData.students) await fb('students', 'PUT', seedData.students);
        if (seedData.json_files) await fb('json_files', 'PUT', seedData.json_files);
        console.log('Seed completed successfully!');
        return true;
      }
    }
  } catch (e) {
    console.error('Seed check error:', e);
  }
  return false;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const urlObj = new URL(req.url, 'http://localhost');
  let pathname = urlObj.pathname;
  // Strip query and /api/ prefix if present
  let routeName = pathname.replace(/^\/api\//, '').replace(/^\//, '');
  if (!routeName || routeName === 'act_api.js' || routeName === 'act_api') {
    routeName = req.query.action || (req.body && req.body.action) || '';
  }

  // Handle explicit seed command
  if (req.query.action === 'seed' || req.query.seed === 'true') {
    if (seedData) {
      if (seedData.studies) await fb('studies', 'PUT', seedData.studies);
      if (seedData.assignments) await fb('assignments', 'PUT', seedData.assignments);
      if (seedData.evaluations) await fb('evaluations', 'PUT', seedData.evaluations);
      if (seedData.study_groups) await fb('study_groups', 'PUT', seedData.study_groups);
      if (seedData.class_groups) await fb('class_groups', 'PUT', seedData.class_groups);
      if (seedData.students) await fb('students', 'PUT', seedData.students);
      if (seedData.json_files) await fb('json_files', 'PUT', seedData.json_files);
      return res.status(200).json({ status: 'ok', seeded: true });
    }
    return res.status(500).json({ error: 'Seed data not loaded' });
  }

  // Lazy seed check on first read operations
  if (req.method === 'GET') {
    await ensureSeeded();
  }

  try {
    // ----------------------------------------------------
    // 1. /calismaGetir?isim=...
    // ----------------------------------------------------
    if (routeName === 'calismaGetir') {
      const isim = req.query.isim;
      if (!isim) return res.status(400).json({ error: 'Missing isim' });

      // Case A: qwx (Study Content)
      if (isim.startsWith('qwx')) {
        const name = isim.replace(/^qwx/, '').replace(/\.json$/, '');
        const studies = await fb('studies') || {};
        const found = studies[name] || Object.values(studies).find(s => s.name === name);
        if (found && found.content) {
          return res.status(200).json(found.content);
        }
        return res.status(404).send('Not Found');
      }

      // Case B: qqq (Assignment)
      if (isim.startsWith('qqq')) {
        const assignments = await fb('assignments') || {};
        const cleanSearch = isim.replace(/\.json$/, '').toLowerCase();
        let found = null;
        for (const a of Object.values(assignments)) {
          const c1 = `qqq${a.class_name}${a.study_name}`.replace(/\s/g, '').toLowerCase();
          const c2 = `qqq${a.class_name}${a.study_name}`.toLowerCase();
          if (c1 === cleanSearch || c2 === cleanSearch || cleanSearch.includes(c1)) {
            found = a;
            break;
          }
        }
        if (found) {
          return res.status(200).json({
            id: found.id || 0,
            sinif: found.class_name,
            calisma: found.study_name,
            yontem: found.method,
            ...(found.settings || {})
          });
        }
        return res.status(404).send('Not Found');
      }

      // Case C: www_ (Evaluations for a study)
      if (isim.startsWith('www_')) {
        const name = isim.replace(/^www_/, '').replace(/\.json$/, '').trim();
        const evalsNode = await fb(`evaluations/${encodeURIComponent(name)}`) || {};
        const list = [];
        for (const [key, row] of Object.entries(evalsNode)) {
          if (key === 'AYARLAR' || row.student_school_no === 'AYARLAR') {
            list.push(row.answers || row);
          } else {
            let cev = [];
            if (row.answers) {
              if (Array.isArray(row.answers)) cev = row.answers;
              else if (row.answers.cevaplar && Array.isArray(row.answers.cevaplar)) cev = row.answers.cevaplar;
              else if (row.answers.answers && Array.isArray(row.answers.answers)) cev = row.answers.answers;
            }
            list.push({
              ogrenciNo: row.student_school_no || key,
              adSoyad: row.student_name || row.adSoyad || '',
              sinif: row.class_name || '',
              cevaplar: cev,
              puanlar: row.scores || {},
              girisSayisi: row.entry_count || 0,
              degerlendirme: row.evaluation || {}
            });
          }
        }
        return res.status(200).json(list);
      }

      // Case D: Groups (ggg... or ...Grupları.json)
      if (isim.startsWith('ggg')) {
        const cleanSearch = isim.replace(/\.json$/, '').toLowerCase();
        const studyGroups = await fb('study_groups') || {};
        let found = null;
        for (const g of Object.values(studyGroups)) {
          const c1 = `ggg${g.study_name}${g.class_name}`.replace(/\s/g, '').toLowerCase();
          const c2 = `ggg${g.study_name}${g.class_name}`.toLowerCase();
          if (c1 === cleanSearch || c2 === cleanSearch || cleanSearch.includes(c1)) {
            found = g;
            break;
          }
        }
        if (found) return res.status(200).json(found.groups_data || []);
        return res.status(404).send('Not Found');
      }

      if (isim.endsWith('Grupları.json')) {
        const cName = isim.replace('Grupları.json', '').trim();
        const classGroups = await fb('class_groups') || {};
        const found = classGroups[cName] || Object.values(classGroups).find(cg => cg.class_name === cName || sinifIsmiTemizle(cg.class_name) === sinifIsmiTemizle(cName));
        if (found) return res.status(200).json(found.groups_data || []);
        return res.status(404).send('Not Found');
      }

      // Case E: veritabani.json
      if (isim === 'veritabani.json') {
        const students = await fb('students') || {};
        const grouped = {};
        for (const s of Object.values(students)) {
          const cName = s.class_name || 'GENEL';
          if (!grouped[cName]) grouped[cName] = [];
          grouped[cName].push({
            "Okul Numaranız": s.school_no,
            "Adınız Soyadınız": s.name,
            "Sınıfınız": s.class_name,
            "Telefon numaranız": s.phone,
            "Velinizin telefon numarası": s.parent_phone,
            "E-Posta Adresiniz": s.email,
            "Drive Klasörünüzün linki": s.drive_link,
            ...(s.extra_info || {})
          });
        }
        return res.status(200).json(grouped);
      }

      return res.status(404).send('Not Found');
    }

    // ----------------------------------------------------
    // 2. /listeCalismalar
    // ----------------------------------------------------
    if (routeName === 'listeCalismalar') {
      const files = [];
      const studies = await fb('studies') || {};
      for (const s of Object.values(studies)) {
        if (!s.is_archived) {
          files.push(`qwx${s.name}.json`);
        }
      }

      const assignments = await fb('assignments') || {};
      for (const a of Object.values(assignments)) {
        const st = studies[a.study_name] || Object.values(studies).find(s => s.name === a.study_name);
        if (!st || !st.is_archived) {
          files.push(`qqq${String(a.class_name).replace(/\s/g, '')}${a.study_name}.json`);
        }
      }

      const evals = await fb('evaluations') || {};
      for (const studyName of Object.keys(evals)) {
        files.push(`www_${studyName}.json`);
      }

      const sGroups = await fb('study_groups') || {};
      for (const g of Object.values(sGroups)) {
        files.push(`ggg${g.study_name}${String(g.class_name).replace(/\s/g, '')}.json`);
      }

      const cGroups = await fb('class_groups') || {};
      for (const cg of Object.values(cGroups)) {
        files.push(`${cg.class_name}Grupları.json`);
      }

      return res.status(200).json(files);
    }

    // ----------------------------------------------------
    // 3. /grupListesiGetir?sinif=...&calisma=...
    // ----------------------------------------------------
    if (routeName === 'grupListesiGetir') {
      const rawSinif = req.query.sinif;
      const calisma = req.query.calisma;
      const normSinif = sinifIsmiTemizle(rawSinif);

      if (calisma) {
        const studyGroups = await fb('study_groups') || {};
        for (const g of Object.values(studyGroups)) {
          if (g.study_name === calisma && (g.class_name === rawSinif || sinifIsmiTemizle(g.class_name) === normSinif)) {
            return res.status(200).json(g.groups_data || []);
          }
        }
      }

      const classGroups = await fb('class_groups') || {};
      for (const cg of Object.values(classGroups)) {
        if (cg.class_name === rawSinif || sinifIsmiTemizle(cg.class_name) === normSinif) {
          return res.status(200).json(cg.groups_data || []);
        }
      }

      return res.status(200).json([]);
    }

    // ----------------------------------------------------
    // 4. /api/ogrenciPaneli?sinif=...&schoolNo=...
    // ----------------------------------------------------
    if (routeName === 'ogrenciPaneli') {
      const sinif = req.query.sinif;
      const schoolNo = String(req.query.schoolNo).trim();
      if (!sinif || !schoolNo) return res.status(400).json({ error: 'Missing params' });

      const studies = await fb('studies') || {};
      const assignments = await fb('assignments') || {};
      const normSinif = sinifIsmiTemizle(sinif);

      const matchedAssignments = Object.values(assignments).filter(a => {
        const matchClass = a.class_name === sinif || sinifIsmiTemizle(a.class_name) === normSinif;
        const st = studies[a.study_name] || Object.values(studies).find(s => s.name === a.study_name);
        const notArchived = !st || !st.is_archived;
        return matchClass && notArchived;
      });

      if (matchedAssignments.length === 0) {
        return res.status(200).json({ assignments: [] });
      }

      const results = [];
      for (const a of matchedAssignments) {
        const studyEvals = await fb(`evaluations/${encodeURIComponent(a.study_name)}`) || {};
        const ayarlarObj = studyEvals['AYARLAR'] ? (studyEvals['AYARLAR'].answers || studyEvals['AYARLAR']) : null;
        const studentRec = studyEvals[schoolNo] || null;

        results.push({
          id: a.id || 0,
          study_id: a.study_id || 0,
          class_name: a.class_name,
          method: a.method,
          settings: a.settings || {},
          study_name: a.study_name,
          calisma: a.study_name,
          ayarlar: ayarlarObj,
          ogrenciKaydi: studentRec ? {
            cevaplar: studentRec.answers ? (studentRec.answers.cevaplar || studentRec.answers || []) : [],
            puanlar: studentRec.scores || {},
            degerlendirme: studentRec.evaluation || {},
            girisSayisi: studentRec.entry_count || 0
          } : null
        });
      }

      return res.status(200).json({ assignments: results });
    }

    // ----------------------------------------------------
    // 5. /calismaKaydet (POST)
    // ----------------------------------------------------
    if (routeName === 'calismaKaydet') {
      const { calismaIsmi, sorular } = req.body;
      if (!calismaIsmi) return res.status(400).json({ status: 'eksik' });

      if (calismaIsmi.startsWith('qqq')) {
        const assignment = sorular;
        const studyName = assignment.calisma;
        const className = assignment.sinif;
        const key = `${studyName}___${className}`;
        const data = {
          study_name: studyName,
          class_name: className,
          method: assignment.yontem || 'Grup',
          settings: {
            gorme: assignment.gorme || false,
            aciklamaIzni: assignment.aciklamaIzni || false,
            soruIzni: assignment.soruIzni || false,
            yapma: assignment.yapma || false,
            degerl: assignment.degerl || false,
            sure: assignment.sure || 0,
            bitis: assignment.bitis || null,
            karisikSoru: assignment.karisikSoru || false,
            odakModu: assignment.odakModu || false
          }
        };
        await fb(`assignments/${encodeURIComponent(key)}`, 'PUT', data);
        return res.status(200).json({ status: 'ok' });
      } else {
        const name = calismaIsmi.replace(/^qwx/, '').replace(/\.json$/, '');
        const data = {
          name,
          content: sorular,
          is_archived: false,
          created_at: new Date().toISOString()
        };
        await fb(`studies/${encodeURIComponent(name)}`, 'PUT', data);
        return res.status(200).json({ status: 'ok' });
      }
    }

    // ----------------------------------------------------
    // 6. /kaydet (POST)
    // ----------------------------------------------------
    if (routeName === 'kaydet') {
      const { dosyaAdi, veri, sinif, gruplar, calisma } = req.body;

      if (sinif && gruplar) {
        if (calisma) {
          const key = `${calisma}___${sinif}`;
          await fb(`study_groups/${encodeURIComponent(key)}`, 'PUT', {
            study_name: calisma,
            class_name: sinif,
            groups_data: gruplar
          });
        } else {
          await fb(`class_groups/${encodeURIComponent(sinif)}`, 'PUT', {
            class_name: sinif,
            groups_data: gruplar
          });
        }
        return res.status(200).json({ status: 'ok', saved: true });
      }

      if (dosyaAdi && veri) {
        if (dosyaAdi.startsWith('www_')) {
          const studyName = dosyaAdi.replace(/^www_/, '').replace(/\.json$/, '').trim();
          const items = Array.isArray(veri) ? veri : [veri];

          for (const item of items) {
            if (item.ogrenciNo === 'AYARLAR') {
              await fb(`evaluations/${encodeURIComponent(studyName)}/AYARLAR`, 'PUT', {
                answers: item
              });
            } else {
              const studentNo = String(item.ogrenciNo).trim();
              const existing = await fb(`evaluations/${encodeURIComponent(studyName)}/${encodeURIComponent(studentNo)}`) || {};

              const updatedRecord = {
                study_name: studyName,
                student_school_no: studentNo,
                student_name: item.adSoyad || existing.student_name || '',
                class_name: item.sinif || existing.class_name || '',
                answers: item.cevaplar !== undefined ? { cevaplar: item.cevaplar } : (existing.answers || { cevaplar: [] }),
                scores: item.puanlar !== undefined ? item.puanlar : (existing.scores || {}),
                evaluation: item.degerlendirme !== undefined ? item.degerlendirme : (existing.evaluation || { bitti: false }),
                entry_count: item.girisSayisi !== undefined ? item.girisSayisi : (existing.entry_count || 0),
                last_updated: new Date().toISOString()
              };

              await fb(`evaluations/${encodeURIComponent(studyName)}/${encodeURIComponent(studentNo)}`, 'PUT', updatedRecord);
            }
          }
          return res.status(200).json({ status: 'ok' });
        }

        if (dosyaAdi.startsWith('qwx')) {
          const name = dosyaAdi.replace(/^qwx/, '').replace(/\.json$/, '');
          await fb(`studies/${encodeURIComponent(name)}`, 'PUT', {
            name,
            content: veri,
            is_archived: false,
            created_at: new Date().toISOString()
          });
          return res.status(200).json({ status: 'ok' });
        }

        if (dosyaAdi === 'veritabani.json') {
          const allStudents = [];
          Object.values(veri).forEach(g => { if (Array.isArray(g)) allStudents.push(...g); });
          for (const s of allStudents) {
            const sNo = String(s['Okul Numaranız']).trim();
            await fb(`students/${encodeURIComponent(sNo)}`, 'PUT', {
              school_no: sNo,
              name: s['Adınız Soyadınız'],
              class_name: s['Sınıfınız'],
              phone: s['Telefon numaranız'],
              parent_phone: s['Velinizin telefon numarası'],
              email: s['E-Posta Adresiniz'],
              drive_link: s['Drive Klasörünüzün linki'],
              extra_info: s
            });
          }
          return res.status(200).json({ status: 'ok' });
        }
      }

      return res.status(400).json({ status: 'eksik' });
    }

    // ----------------------------------------------------
    // 7. /puanKaydet (POST)
    // ----------------------------------------------------
    if (routeName === 'puanKaydet') {
      const { dosyaAdi, ogrenciNo, sinif, soruIndex, cevapIndex, puan } = req.body;
      const studyName = dosyaAdi.replace('www_', '').replace(/\.json$/, '').trim();
      const studentNo = String(ogrenciNo).trim();

      const existing = await fb(`evaluations/${encodeURIComponent(studyName)}/${encodeURIComponent(studentNo)}`) || {
        study_name: studyName,
        student_school_no: studentNo,
        class_name: sinif,
        scores: {}
      };

      const scores = existing.scores || {};
      if (!scores[soruIndex]) scores[soruIndex] = [];
      scores[soruIndex][cevapIndex] = parseInt(puan, 10);

      await fb(`evaluations/${encodeURIComponent(studyName)}/${encodeURIComponent(studentNo)}/scores`, 'PUT', scores);
      return res.status(200).json({ status: 'ok' });
    }

    // ----------------------------------------------------
    // 8. /degerlendirmeBitir (POST)
    // ----------------------------------------------------
    if (routeName === 'degerlendirmeBitir') {
      const { dosyaAdi, ogrenciNo, sinif, toplam: bodyToplam, degerlendirildi, puanlar } = req.body;
      const studyName = dosyaAdi.replace('www_', '').replace(/\.json$/, '').trim();
      const studentNo = String(ogrenciNo).trim();

      const existing = await fb(`evaluations/${encodeURIComponent(studyName)}/${encodeURIComponent(studentNo)}`) || {
        study_name: studyName,
        student_school_no: studentNo,
        class_name: sinif
      };

      let toplam = bodyToplam;
      if (typeof toplam === 'undefined' || toplam === null) {
        const scores = puanlar || existing.scores || {};
        toplam = 0;
        Object.values(scores).forEach(arr => {
          if (Array.isArray(arr)) {
            arr.forEach(p => { if (p) toplam += parseInt(p, 10); });
          }
        });
      }

      const evaluation = {
        toplam,
        degerlendirildi: typeof degerlendirildi !== 'undefined' ? degerlendirildi : true,
        bitti: true
      };

      existing.evaluation = evaluation;
      if (puanlar) existing.scores = puanlar;

      await fb(`evaluations/${encodeURIComponent(studyName)}/${encodeURIComponent(studentNo)}`, 'PUT', existing);
      return res.status(200).json({ status: 'ok' });
    }

    // ----------------------------------------------------
    // 9. /degerlendirmeSifirla (ALL)
    // ----------------------------------------------------
    if (routeName === 'degerlendirmeSifirla') {
      const { calisma, dosyaAdi, sinif } = { ...req.query, ...req.body };
      const studyName = (calisma || (dosyaAdi ? dosyaAdi.replace('www_', '') : '')).trim();
      if (!studyName || !sinif) return res.status(400).json({ status: 'eksik_parametre' });

      const evals = await fb(`evaluations/${encodeURIComponent(studyName)}`) || {};
      for (const [sNo, rec] of Object.entries(evals)) {
        if (rec.class_name === sinif || sinifIsmiTemizle(rec.class_name) === sinifIsmiTemizle(sinif)) {
          rec.scores = {};
          rec.evaluation = {};
          await fb(`evaluations/${encodeURIComponent(studyName)}/${encodeURIComponent(sNo)}`, 'PUT', rec);
        }
      }
      return res.status(200).json({ status: 'ok' });
    }

    // ----------------------------------------------------
    // 10. /tumCevaplariTemizle (POST)
    // ----------------------------------------------------
    if (routeName === 'tumCevaplariTemizle') {
      const { calismaIsmi } = req.body;
      const cleanName = calismaIsmi.replace(/^www_/, '').replace(/\.json$/, '').trim();
      await fb(`evaluations/${encodeURIComponent(cleanName)}`, 'DELETE');
      return res.status(200).json({ status: 'ok' });
    }

    // ----------------------------------------------------
    // 11. /calismaSil (POST)
    // ----------------------------------------------------
    if (routeName === 'calismaSil') {
      const { calismaIsmi, dosyaAdi } = req.body;
      const target = (calismaIsmi || dosyaAdi || '').trim();

      if (target.startsWith('qqq')) {
        const cleanSearch = target.replace(/\.json$/, '').toLowerCase();
        const assignments = await fb('assignments') || {};
        for (const [key, a] of Object.entries(assignments)) {
          const c1 = `qqq${a.class_name}${a.study_name}`.replace(/\s/g, '').toLowerCase();
          if (c1 === cleanSearch || cleanSearch.includes(c1)) {
            await fb(`assignments/${encodeURIComponent(key)}`, 'DELETE');
          }
        }
        return res.status(200).json({ status: 'ok' });
      }

      const name = target.replace(/^qwx|^www_/, '').replace(/\.json$/, '').trim();
      await fb(`studies/${encodeURIComponent(name)}`, 'DELETE');
      await fb(`evaluations/${encodeURIComponent(name)}`, 'DELETE');

      const assignments = await fb('assignments') || {};
      for (const [key, a] of Object.entries(assignments)) {
        if (a.study_name === name) {
          await fb(`assignments/${encodeURIComponent(key)}`, 'DELETE');
        }
      }

      const studyGroups = await fb('study_groups') || {};
      for (const [key, g] of Object.entries(studyGroups)) {
        if (g.study_name === name) {
          await fb(`study_groups/${encodeURIComponent(key)}`, 'DELETE');
        }
      }

      return res.status(200).json({ status: 'ok' });
    }

    // ----------------------------------------------------
    // 12. /arsivle /arsivdenGeriYukle /arsivGuncelle (POST)
    // ----------------------------------------------------
    if (routeName === 'arsivle') {
      const name = req.body.calismaIsmi ? req.body.calismaIsmi.replace(/^qwx/, '').replace(/\.json$/, '') : '';
      await fb(`studies/${encodeURIComponent(name)}/is_archived`, 'PUT', true);
      return res.status(200).json({ status: 'ok' });
    }

    if (routeName === 'arsivdenGeriYukle') {
      const name = req.body.dosyaIsmi ? req.body.dosyaIsmi.replace(/^qwx/, '').replace(/\.json$/, '') : '';
      await fb(`studies/${encodeURIComponent(name)}/is_archived`, 'PUT', false);
      return res.status(200).json({ status: 'ok' });
    }

    if (routeName === 'arsivGuncelle') {
      const { dosyaIsmi, durum } = req.body;
      const name = dosyaIsmi ? dosyaIsmi.replace(/^qwx/, '').replace(/\.json$/, '') : '';
      await fb(`studies/${encodeURIComponent(name)}/is_archived`, 'PUT', Boolean(durum));
      return res.status(200).json({ status: 'ok' });
    }

    if (routeName === 'arsivListesi') {
      const studies = await fb('studies') || {};
      const list = [];
      for (const s of Object.values(studies)) {
        if (s.is_archived) list.push(`qwx${s.name}.json`);
      }
      return res.status(200).json(list);
    }

    // ----------------------------------------------------
    // 13. /yonetimDosyaListesi
    // ----------------------------------------------------
    if (routeName === 'yonetimDosyaListesi') {
      const result = [];
      const studies = await fb('studies') || {};
      for (const s of Object.values(studies)) {
        result.push({ dosya_adi: `qwx${s.name}.json`, arsivde: Boolean(s.is_archived) });
        result.push({ dosya_adi: `www_${s.name}.json`, arsivde: false });
      }

      const assignments = await fb('assignments') || {};
      for (const a of Object.values(assignments)) {
        result.push({
          dosya_adi: `qqq${String(a.class_name).replace(/\s/g, '')}${a.study_name}.json`,
          arsivde: false
        });
      }

      const studyGroups = await fb('study_groups') || {};
      for (const g of Object.values(studyGroups)) {
        result.push({
          dosya_adi: `ggg${g.study_name}${String(g.class_name).replace(/\s/g, '')}.json`,
          arsivde: false
        });
      }

      const classGroups = await fb('class_groups') || {};
      for (const cg of Object.values(classGroups)) {
        result.push({
          dosya_adi: `${cg.class_name}Grupları.json`,
          arsivde: false
        });
      }

      result.push({ dosya_adi: 'veritabani.json', arsivde: false });
      return res.status(200).json(result);
    }

    // ----------------------------------------------------
    // 14. /yedekAl & /yedekYukle & /restart
    // ----------------------------------------------------
    if (routeName === 'yedekAl') {
      const wholeDb = await fb('') || {};
      res.setHeader('Content-Disposition', 'attachment; filename="etkinlik_yedek.json"');
      return res.status(200).json(wholeDb);
    }

    if (routeName === 'yedekYukle') {
      if (req.body) {
        await fb('', 'PUT', req.body);
        return res.status(200).json({ status: 'ok' });
      }
      return res.status(400).json({ error: 'Missing body' });
    }

    if (routeName === 'restart') {
      return res.status(200).json({ status: 'ok', message: 'Vercel serverless platform is active.' });
    }

    // Default fallback
    return res.status(404).json({ error: 'Endpoint not found', route: routeName });

  } catch (err) {
    console.error('Act API Server Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
