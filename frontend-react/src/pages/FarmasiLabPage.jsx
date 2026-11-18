import { useEffect, useState } from 'react';
import { yiiApi, nodeApi } from '../services/api';
import { Pill, FlaskConical } from 'lucide-react';

export default function FarmasiLabPage({ role }) {
  const [resepList, setResepList] = useState([]);
  const [labList, setLabList] = useState([]);
  const [hasilInput, setHasilInput] = useState('{"Hemoglobin": "14.1 g/dL", "Leukosit": "8200 /uL"}');
  const [msg, setMsg] = useState('');

  const loadData = async () => {
    if (role === 'FARMASI' || role === 'ADMIN') {
      const rRes = await yiiApi.get('/farmasi/antrean');
      setResepList(rRes.data.data);
    }
    if (role === 'LABORATORIUM' || role === 'ADMIN') {
      const lRes = await nodeApi.get('/lab/permintaan');
      setLabList(lRes.data.data);
    }
  };

  useEffect(() => { loadData(); }, [role]);

  const handleSerahkanObat = async (resepId) => {
    try {
      const res = await yiiApi.post(`/farmasi/serahkan/${resepId}`);
      setMsg(res.data.data.message);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menyerahkan obat');
    }
  };

  const handleSimpanLab = async (labId) => {
    try {
      await nodeApi.put(`/lab/hasil/${labId}`, { hasil_lab: JSON.parse(hasilInput) });
      setMsg('Hasil laboratorium berhasil disimpan!');
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Format JSON hasil lab tidak valid');
    }
  };

  return (
    <div className="space-y-6">
      {msg && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm">{msg}</div>}

      {(role === 'FARMASI' || role === 'ADMIN') && (
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Pill className="text-amber-600" /> Antrean Resep Farmasi (Pessimistic Stock Lock)</h3>
          <div className="space-y-3">
            {resepList.map((r) => (
              <div key={r.id} className="p-4 border rounded-lg flex flex-wrap justify-between items-center gap-4">
                <div>
                  <div className="font-bold text-slate-800">{r.no_resep} — {r.kunjungan?.pasien?.nama_lengkap}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {r.details?.map((d) => `${d.obat?.nama_obat} (${d.jumlah}x - ${d.frekuensi})`).join(', ')}
                  </div>
                </div>
                {r.status_resep === 'DISERAHKAN' ? (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">DISERAHKAN</span>
                ) : r.kunjungan?.billing?.status_pembayaran !== 'LUNAS' ? (
                  <div className="text-right">
                    <span className="block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                      MENUNGGU PEMBAYARAN
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Obat diserahkan setelah tagihan lunas di kasir.
                    </span>
                  </div>
                ) : (
                  <button onClick={() => handleSerahkanObat(r.id)} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">
                    Proses & Serahkan Obat
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(role === 'LABORATORIUM' || role === 'ADMIN') && (
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><FlaskConical className="text-blue-600" /> Permintaan Pemeriksaan Laboratorium (Node.js Service)</h3>
          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Template Input Hasil Lab (JSON):</label>
            <input value={hasilInput} onChange={(e) => setHasilInput(e.target.value)} className="w-full border rounded-lg p-2 text-xs font-mono" />
          </div>
          <div className="space-y-3">
            {labList.map((l) => (
              <div key={l.id} className="p-4 border rounded-lg flex flex-wrap justify-between items-center gap-4">
                <div>
                  <div className="font-bold text-slate-800">{l.no_order_lab} — {l.nama_tindakan}</div>
                  <div className="text-xs text-slate-500">Pasien: {l.nama_pasien} ({l.no_rm}) | Dokter: {l.nama_dokter}</div>
                </div>
                {l.status_lab === 'SELESAI' ? (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">SELESAI</span>
                ) : (
                  <button onClick={() => handleSimpanLab(l.id)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">
                    Input & Selesaikan Hasil
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}