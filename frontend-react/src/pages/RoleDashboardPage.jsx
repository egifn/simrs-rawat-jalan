import { useEffect, useState } from 'react';
import { nodeApi, yiiApi } from '../services/api';
import { Activity, ClipboardList, DollarSign, FlaskConical, Pill, Users } from 'lucide-react';

const getToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const cardsByRole = {
  PENDAFTARAN: [
    { key: 'total', label: 'Kunjungan Hari Ini', icon: Users },
    { key: 'waiting', label: 'Menunggu Dokter', icon: ClipboardList },
    { key: 'completed', label: 'Pelayanan Selesai', icon: Activity },
  ],
  DOKTER: [
    { key: 'waiting', label: 'Antrean Menunggu', icon: ClipboardList },
    { key: 'inProgress', label: 'Sedang Diperiksa', icon: Activity },
    { key: 'completed', label: 'Pemeriksaan Selesai', icon: Users },
  ],
  LABORATORIUM: [
    { key: 'requested', label: 'Permintaan Baru', icon: FlaskConical },
    { key: 'inProgress', label: 'Sedang Diproses', icon: Activity },
    { key: 'completed', label: 'Hasil Selesai', icon: ClipboardList },
  ],
  FARMASI: [
    { key: 'waiting', label: 'Resep Menunggu', icon: Pill },
    { key: 'dispensed', label: 'Resep Diserahkan', icon: ClipboardList },
    { key: 'lowStock', label: 'Obat Stok Rendah', icon: Activity },
  ],
  KASIR: [
    { key: 'unpaid', label: 'Tagihan Belum Dibayar', icon: ClipboardList },
    { key: 'partial', label: 'Tagihan Sebagian', icon: DollarSign },
    { key: 'revenue', label: 'Pembayaran Diterima', icon: Activity, currency: true },
  ],
};

export default function RoleDashboardPage({ role }) {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      setLoading(true);
      setError('');
      try {
        let nextValues = {};
        if (role === 'PENDAFTARAN' || role === 'DOKTER') {
          const response = await yiiApi.get('/kunjungan', { params: { tanggal: getToday() } });
          const visits = response.data.data;
          nextValues = {
            total: visits.length,
            waiting: visits.filter((visit) => visit.status_antrean === 'MENUNGGU').length,
            inProgress: visits.filter((visit) => visit.status_antrean === 'DIPERIKSA' || visit.status_antrean === 'MENUNGGU_OBAT').length,
            completed: visits.filter((visit) => visit.status_antrean === 'SELESAI').length,
          };
        } else if (role === 'LABORATORIUM') {
          const response = await nodeApi.get('/lab/permintaan');
          const orders = response.data.data;
          nextValues = {
            requested: orders.filter((order) => order.status_lab === 'DIMINTA' || order.status_lab === 'PENDING_SYNC').length,
            inProgress: orders.filter((order) => order.status_lab === 'DIPROSES').length,
            completed: orders.filter((order) => order.status_lab === 'SELESAI').length,
          };
        } else if (role === 'FARMASI') {
          const [prescriptions, medicines] = await Promise.all([
            yiiApi.get('/farmasi/antrean'),
            yiiApi.get('/obat'),
          ]);
          nextValues = {
            waiting: prescriptions.data.data.filter((prescription) => prescription.status_resep === 'MENUNGGU').length,
            dispensed: prescriptions.data.data.filter((prescription) => prescription.status_resep === 'DISERAHKAN').length,
            lowStock: medicines.data.data.filter((medicine) => Number(medicine.stok) <= 5).length,
          };
        } else if (role === 'KASIR') {
          const response = await yiiApi.get('/kunjungan');
          const billings = response.data.data.map((visit) => visit.billing).filter(Boolean);
          nextValues = {
            unpaid: billings.filter((billing) => billing.status_pembayaran === 'BELUM_DIBAYAR').length,
            partial: billings.filter((billing) => billing.status_pembayaran === 'DIBAYAR_SEBAGIAN').length,
            revenue: billings.reduce((total, billing) => total + Number(billing.total_dibayar || 0), 0),
          };
        }
        if (active) setValues(nextValues);
      } catch (requestError) {
        if (active) {
          setError(requestError.response?.data?.message || 'Dashboard gagal dimuat. Periksa koneksi layanan.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDashboard();
    return () => { active = false; };
  }, [role]);

  const cards = cardsByRole[role] || [];
  const formatValue = (value, currency) => currency
    ? `Rp ${Number(value || 0).toLocaleString('id-ID')}`
    : Number(value || 0).toLocaleString('id-ID');

  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-xl font-bold text-slate-800">Dashboard {role}</h2>
        <p className="mt-1 text-sm text-slate-500">Ringkasan pekerjaan sesuai tanggung jawab role Anda.</p>
      </section>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Memuat dashboard...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ key, label, icon: Icon, currency }) => (
            <article key={key} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>{label}</span>
                <Icon size={20} className="text-teal-600" />
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-800">{formatValue(values[key], currency)}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
