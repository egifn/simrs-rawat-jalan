import { useEffect, useState } from 'react';
import { yiiApi, nodeApi } from '../services/api';
import { Plus, Stethoscope, X } from 'lucide-react';

export default function PemeriksaanDokterPage() {
  const [antrean, setAntrean] = useState([]);
  const [kunjunganList, setKunjunganList] = useState([]);
  const [tindakanMaster, setTindakanMaster] = useState([]);
  const [labMaster, setLabMaster] = useState([]);
  const [obatMaster, setObatMaster] = useState([]);
  const [hasilLabList, setHasilLabList] = useState([]);

  const [selectedKunjungan, setSelectedKunjungan] = useState('');
  const [form, setForm] = useState({ anamnesis: '', tekanan_darah: '120/80', nadi: 80, suhu_tubuh: 36.8, berat_badan: 65, pemeriksaan_fisik: '', diagnosis_utama: '', diagnosis_sekunder: '' });
  const [selectedTindakan, setSelectedTindakan] = useState([]);
  const [selectedTindakanId, setSelectedTindakanId] = useState('');
  const [selectedLab, setSelectedLab] = useState([]);
  const [selectedLabId, setSelectedLabId] = useState('');
  const [selectedObat, setSelectedObat] = useState('');
  const [obatQty, setObatQty] = useState(1);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const loadData = async () => {
    const [kRes, tRes, oRes] = await Promise.all([
      yiiApi.get('/kunjungan', { params: { limit: 500 } }),
      yiiApi.get('/tindakan'),
      yiiApi.get('/obat'),
    ]);
    setKunjunganList(kRes.data.data);
    const antreanMenunggu = kRes.data.data.filter(
      (kunjungan) => kunjungan.status_antrean === 'MENUNGGU'
    );
    setAntrean(antreanMenunggu);
    setTindakanMaster(tRes.data.data.filter((t) => t.kategori === 'MEDIS'));
    setLabMaster(tRes.data.data.filter((t) => t.kategori === 'LABORATORIUM'));
    setObatMaster(oRes.data.data);
    try {
      const labRes = await nodeApi.get('/lab/permintaan', { params: { limit: 100 } });
      setHasilLabList(labRes.data.data || []);
    } catch (error) {
      setHasilLabList([]);
      setMsg({
        type: 'error',
        text: error.response?.data?.message || 'Layanan laboratorium tidak tersedia. Pemeriksaan dapat disimpan; order lab akan tersinkronisasi dari antrean outbox.',
      });
    }
  };

  useEffect(() => { loadData(); }, []);

 const handleSimpanPemeriksaan = async (e) => {
    e.preventDefault();
    if (!selectedKunjungan) return alert('Pilih pasien terlebih dahulu!');
    try {
      const payload = {
        ...form,
        tindakan: selectedTindakan.map((tindakanId) => ({
          tindakan_id: Number(tindakanId),
          jumlah: 1,
        })),
        permintaan_lab: selectedLab.map((labId) => ({
          tindakan_id: Number(labId),
          catatan_klinis: 'Permintaan dokter poli',
        })),
        resep: selectedObat ? [{ obat_id: Number(selectedObat), dosis: '500 mg', frekuensi: '3x1 sesudah makan', jumlah: Number(obatQty) }] : [],
      };
      const response = await yiiApi.post(`/pemeriksaan/${selectedKunjungan}`, payload);
      const pendingLabIds = response.data.data.pending_sync_lab_ids || [];
      setMsg({
        type: pendingLabIds.length ? 'error' : 'success',
        text: pendingLabIds.length
          ? `Pemeriksaan, tindakan, resep, dan billing tersimpan. Order lab ${pendingLabIds.join(', ')} menunggu sinkronisasi; data aman di antrean retry.`
          : 'Pemeriksaan, Tindakan, Resep, & Billing berhasil disimpan!',
      });

      // Reset seluruh form kembali ke kondisi awal setelah berhasil disimpan
      setSelectedKunjungan('');
      setForm({
        anamnesis: '',
        tekanan_darah: '120/80',
        nadi: 80,
        suhu_tubuh: 36.8,
        berat_badan: 65,
        pemeriksaan_fisik: '',
        diagnosis_utama: '',
        diagnosis_sekunder: '',
      });
      setSelectedTindakan([]);
      setSelectedTindakanId('');
      setSelectedLab([]);
      setSelectedLabId('');
      setSelectedObat('');
      setObatQty(1);

      loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Gagal menyimpan pemeriksaan.' });
    }
  };

  const handleTambahTindakan = () => {
    if (!selectedTindakanId || selectedTindakan.includes(selectedTindakanId)) return;
    setSelectedTindakan([...selectedTindakan, selectedTindakanId]);
    setSelectedTindakanId('');
  };

  const handleTambahLab = () => {
    if (!selectedLabId || selectedLab.includes(selectedLabId)) return;
    setSelectedLab([...selectedLab, selectedLabId]);
    setSelectedLabId('');
  };

  const kunjunganDipilih = kunjunganList.find(
    (kunjungan) => String(kunjungan.id) === String(selectedKunjungan)
  );
  const riwayatPasien = kunjunganDipilih
    ? kunjunganList
      .filter((kunjungan) => kunjungan.pasien_id === kunjunganDipilih.pasien_id && kunjungan.id !== kunjunganDipilih.id)
      .sort((a, b) => new Date(b.tanggal_kunjungan) - new Date(a.tanggal_kunjungan))
    : [];

  return (
    <div className="space-y-6">
      {msg.text && (
        <div className={`p-3 rounded-lg text-sm border ${msg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Stethoscope className="text-teal-600" /> Pemeriksaan & Rekam Medis Elektronik (EMR)</h2>
        <form onSubmit={handleSimpanPemeriksaan} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Pilih Pasien dari Antrean</label>
            <select value={selectedKunjungan} onChange={(e) => setSelectedKunjungan(e.target.value)} className="w-full border rounded-lg p-2 text-sm" required>
              <option value="">-- Pilih Kunjungan Pasien --</option>
              {antrean.map((k) => (
                <option key={k.id} value={k.id}>[{k.kode_antrean}] {k.pasien?.nama_lengkap} ({k.pasien?.no_rm}) - Status: {k.status_antrean}</option>
              ))}
            </select>
          </div>
          {kunjunganDipilih && (
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-sm text-slate-800">Detail Pasien</h3>
              <p className="mt-1 text-sm text-slate-600">
                {kunjunganDipilih.pasien?.nama_lengkap} — RM {kunjunganDipilih.pasien?.no_rm}
                {' | '}Tanggal lahir: {kunjunganDipilih.pasien?.tanggal_lahir || '-'}
                {' | '}Jenis kelamin: {kunjunganDipilih.pasien?.jenis_kelamin || '-'}
              </p>
              <h4 className="mt-3 text-xs font-semibold text-slate-700">Riwayat Kunjungan Sebelumnya</h4>
              {riwayatPasien.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500">Belum ada riwayat kunjungan sebelumnya.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {riwayatPasien.slice(0, 5).map((kunjungan) => (
                    <li key={kunjungan.id} className="text-xs text-slate-600">
                      {kunjungan.tanggal_kunjungan} — {kunjungan.poli?.nama_poli} — {kunjungan.rekamMedis?.diagnosis_utama || 'Belum ada diagnosis'}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Tekanan Darah (120/80)" value={form.tekanan_darah} onChange={(e) => setForm({ ...form, tekanan_darah: e.target.value })} className="border rounded-lg p-2 text-sm" />
            <input type="number" placeholder="Nadi (x/mnt)" value={form.nadi} onChange={(e) => setForm({ ...form, nadi: e.target.value })} className="border rounded-lg p-2 text-sm" />
            <input type="number" step="0.1" placeholder="Suhu (°C)" value={form.suhu_tubuh} onChange={(e) => setForm({ ...form, suhu_tubuh: e.target.value })} className="border rounded-lg p-2 text-sm" />
            <input type="number" placeholder="Berat Badan (kg)" value={form.berat_badan} onChange={(e) => setForm({ ...form, berat_badan: e.target.value })} className="border rounded-lg p-2 text-sm" />
          </div>

          <textarea placeholder="Anamnesis & Keluhan Utama Pasien..." rows={2} value={form.anamnesis} onChange={(e) => setForm({ ...form, anamnesis: e.target.value })} className="w-full border rounded-lg p-2 text-sm" required />
          <textarea placeholder="Hasil Pemeriksaan Fisik..." rows={2} value={form.pemeriksaan_fisik} onChange={(e) => setForm({ ...form, pemeriksaan_fisik: e.target.value })} className="w-full border rounded-lg p-2 text-sm" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input placeholder="Diagnosis Utama (Wajib)" value={form.diagnosis_utama} onChange={(e) => setForm({ ...form, diagnosis_utama: e.target.value })} className="border rounded-lg p-2 text-sm" required />
            <input placeholder="Diagnosis Sekunder (Opsional)" value={form.diagnosis_sekunder} onChange={(e) => setForm({ ...form, diagnosis_sekunder: e.target.value })} className="border rounded-lg p-2 text-sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tindakan Medis</label>
              <div className="flex gap-2">
                <select value={selectedTindakanId} onChange={(e) => setSelectedTindakanId(e.target.value)} className="w-full border rounded-lg p-2 text-sm">
                  <option value="">-- Pilih Tindakan Medis --</option>
                {tindakanMaster.map((t) => <option key={t.id} value={t.id}>{t.nama_tindakan} (Rp {Number(t.tarif).toLocaleString('id-ID')})</option>)}
                </select>
                <button
                  type="button"
                  onClick={handleTambahTindakan}
                  disabled={!selectedTindakanId || selectedTindakan.includes(selectedTindakanId)}
                  className="shrink-0 flex items-center gap-1 rounded-lg bg-teal-600 px-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Tambah tindakan medis"
                >
                  <Plus size={16} /> Tambah
                </button>
              </div>
              {selectedTindakan.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {selectedTindakan.map((tindakanId) => {
                    const tindakan = tindakanMaster.find((item) => String(item.id) === tindakanId);
                    if (!tindakan) return null;

                    return (
                      <li key={tindakanId} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                        <span>{tindakan.nama_tindakan} — Rp {Number(tindakan.tarif).toLocaleString('id-ID')}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedTindakan(selectedTindakan.filter((id) => id !== tindakanId))}
                          className="text-slate-500 hover:text-red-600"
                          aria-label={`Hapus tindakan ${tindakan.nama_tindakan}`}
                        >
                          <X size={15} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Permintaan Lab (Node.js LIS)</label>
              <div className="flex gap-2">
                <select value={selectedLabId} onChange={(e) => setSelectedLabId(e.target.value)} className="w-full border rounded-lg p-2 text-sm">
                  <option value="">-- Pilih Pemeriksaan Lab --</option>
                  {labMaster.map((l) => <option key={l.id} value={l.id}>{l.nama_tindakan} (Rp {Number(l.tarif).toLocaleString('id-ID')})</option>)}
                </select>
                <button
                  type="button"
                  onClick={handleTambahLab}
                  disabled={!selectedLabId || selectedLab.includes(selectedLabId)}
                  className="shrink-0 flex items-center gap-1 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Tambah pemeriksaan laboratorium"
                >
                  <Plus size={16} /> Tambah
                </button>
              </div>
              {selectedLab.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {selectedLab.map((labId) => {
                    const lab = labMaster.find((item) => String(item.id) === labId);
                    if (!lab) return null;

                    return (
                      <li key={labId} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                        <span>{lab.nama_tindakan} — Rp {Number(lab.tarif).toLocaleString('id-ID')}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedLab(selectedLab.filter((id) => id !== labId))}
                          className="text-slate-500 hover:text-red-600"
                          aria-label={`Hapus pemeriksaan ${lab.nama_tindakan}`}
                        >
                          <X size={15} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Resep Obat & Jumlah</label>
              <div className="flex gap-2">
                <select value={selectedObat} onChange={(e) => setSelectedObat(e.target.value)} className="w-full border rounded-lg p-2 text-sm">
                  <option value="">-- Tanpa Resep --</option>
                  {obatMaster.map((o) => <option key={o.id} value={o.id}>{o.nama_obat} (Stok: {o.stok})</option>)}
                </select>
                <input type="number" min={1} value={obatQty} onChange={(e) => setObatQty(e.target.value)} className="w-20 border rounded-lg p-2 text-sm" />
              </div>
            </div>
          </div>

          <button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm cursor-pointer">
            Simpan Rekam Medis & Kirim Tagihan
          </button>
        </form>
      </div>

      {/* Hasil Pemeriksaan Penunjang / Lab dari Node.js */}
      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-3">Riwayat Hasil Laboratorium Pasien (Node.js API)</h3>
        <div className="space-y-2 text-sm">
          {hasilLabList.map((lab) => (
            <div key={lab.id} className="p-3 border rounded-lg flex justify-between items-center bg-slate-50">
              <div>
                <span className="font-bold text-teal-700">{lab.no_order_lab}</span> — {lab.nama_pasien} ({lab.nama_tindakan})
                {lab.hasil_lab && <pre className="text-xs bg-white p-2 mt-1 rounded border">{JSON.stringify(lab.hasil_lab, null, 2)}</pre>}
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">{lab.status_lab}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}