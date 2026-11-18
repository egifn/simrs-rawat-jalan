import { useEffect, useState } from 'react';
import { nodeApi } from '../services/api';
import { Users, DollarSign, Pill, Activity, Filter } from 'lucide-react';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await nodeApi.get(`/dashboard/summary?start_date=${startDate}&end_date=${endDate}`);
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const formatRp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

  if (loading || !data) return <div className="p-6 text-slate-500">Memuat analitik dari Node.js Service...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Dashboard Operasional Rawat Jalan</h2>
          <p className="text-xs text-slate-500">Sumber Data: Node.js Analytics & Reporting Engine</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
          <span className="text-slate-400">s/d</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
          <button onClick={fetchDashboard} className="bg-teal-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 hover:bg-teal-700 cursor-pointer">
            <Filter size={15} /> Filter
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="flex justify-between items-center text-slate-500 text-sm mb-2">
            <span>Total Kunjungan</span> <Users className="text-teal-600" size={20} />
          </div>
          <div className="text-2xl font-bold text-slate-800">{data.kunjungan.total_kunjungan}</div>
          <div className="text-xs text-slate-500 mt-1">Selesai: {data.kunjungan.selesai} | Aktif: {data.kunjungan.aktif}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="flex justify-between items-center text-slate-500 text-sm mb-2">
            <span>Pendapatan Diterima</span> <DollarSign className="text-emerald-600" size={20} />
          </div>
          <div className="text-xl font-bold text-emerald-700">{formatRp(data.pendapatan.pendapatan_diterima)}</div>
          <div className="text-xs text-slate-500 mt-1">Piutang: {formatRp(data.pendapatan.piutang_belum_bayar)}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="flex justify-between items-center text-slate-500 text-sm mb-2">
            <span>Tindakan Medis</span> <Activity className="text-blue-600" size={20} />
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {data.tindakan_medis.reduce((acc, item) => acc + item.total_dilakukan, 0)}
          </div>
          <div className="text-xs text-slate-500 mt-1">{data.tindakan_medis.length} jenis tindakan tercatat</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="flex justify-between items-center text-slate-500 text-sm mb-2">
            <span>Obat Tersalurkan</span> <Pill className="text-amber-600" size={20} />
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {data.rekap_obat.reduce((acc, item) => acc + item.total_keluar, 0)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Total unit item resep selesai</div>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-3">Kunjungan per Poliklinik</h3>
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600">
              <tr><th className="p-2.5">Nama Poli</th><th className="p-2.5 text-right">Jumlah Pasien</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.kunjungan_per_poli.map((p, i) => (
                <tr key={i}><td className="p-2.5 font-medium">{p.nama_poli}</td><td className="p-2.5 text-right font-bold text-teal-700">{p.jumlah}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-3">Status Pembayaran Kasir</h3>
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600">
              <tr><th className="p-2.5">Status</th><th className="p-2.5">Jumlah</th><th className="p-2.5 text-right">Total Nominal</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.status_pembayaran.map((s, i) => (
                <tr key={i}>
                  <td className="p-2.5 font-medium">{s.status_pembayaran}</td>
                  <td className="p-2.5">{s.jumlah_transaksi} trx</td>
                  <td className="p-2.5 text-right font-semibold">{formatRp(s.nominal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-3">Rekap Penggunaan & Sisa Stok Obat</h3>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600">
            <tr><th className="p-2.5">Kode</th><th className="p-2.5">Nama Obat</th><th className="p-2.5 text-right">Keluar</th><th className="p-2.5 text-right">Sisa Stok</th></tr>
          </thead>
          <tbody className="divide-y">
            {data.rekap_obat.map((o, i) => (
              <tr key={i}>
                <td className="p-2.5 font-mono text-xs">{o.kode_obat}</td>
                <td className="p-2.5 font-medium">{o.nama_obat}</td>
                <td className="p-2.5 text-right">{o.total_keluar} {o.satuan}</td>
                <td className={`p-2.5 text-right font-bold ${o.sisa_stok <= 5 ? 'text-red-600' : 'text-slate-700'}`}>
                  {o.sisa_stok} {o.satuan}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}