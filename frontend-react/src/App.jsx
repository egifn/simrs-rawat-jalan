import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PendaftaranPage from './pages/PendaftaranPage';
import PemeriksaanDokterPage from './pages/PemeriksaanDokterPage';
import FarmasiLabPage from './pages/FarmasiLabPage';
import KasirBillingPage from './pages/KasirBillingPage';
import AdminManagementPage from './pages/AdminManagementPage';
import RoleDashboardPage from './pages/RoleDashboardPage';
import { yiiApi } from './services/api';
import { Activity, LogOut } from 'lucide-react';

const defaultTabByRole = {
  ADMIN: 'dashboard',
  PENDAFTARAN: 'dept-dashboard',
  DOKTER: 'dept-dashboard',
  FARMASI: 'dept-dashboard',
  LABORATORIUM: 'dept-dashboard',
  KASIR: 'dept-dashboard',
};

const adminMenus = [
  { id: 'dashboard', label: 'Dashboard & Laporan', permission: ['dashboard', 'laporan'] },
  { id: 'master-pasien', label: 'Data Pasien', resource: 'pasien', permission: 'pasien' },
  { id: 'master-dokter', label: 'Data Dokter', resource: 'dokter', permission: 'dokter' },
  { id: 'master-poli', label: 'Data Poli', resource: 'poli', permission: 'poli' },
  { id: 'master-jadwal', label: 'Jadwal Dokter', resource: 'jadwal', permission: 'jadwal' },
  { id: 'master-tindakan', label: 'Master Tindakan', resource: 'tindakan', permission: 'tindakan' },
  { id: 'master-obat', label: 'Master Obat', resource: 'obat', permission: 'obat' },
  { id: 'master-pengguna', label: 'Pengguna', resource: 'pengguna', permission: 'pengguna' },
  { id: 'hak-akses', label: 'Hak Akses', permission: 'hak-akses' },
  { id: 'pendaftaran', label: 'Pendaftaran & Antrean', permission: 'pendaftaran' },
  { id: 'pemeriksaan', label: 'Pemeriksaan Dokter', permission: 'pemeriksaan' },
  { id: 'laboratorium', label: 'Permintaan & Hasil Lab', permission: 'laboratorium' },
  { id: 'kasir', label: 'Billing & Kasir', permission: 'kasir' },
  { id: 'farmasi', label: 'Farmasi & Penyerahan Obat', permission: 'farmasi' },
];

const roleMenus = {
  PENDAFTARAN: [
    { id: 'dept-dashboard', label: 'Dashboard Pendaftaran', permission: 'dashboard', requires: 'pendaftaran' },
    { id: 'pendaftaran', label: 'Data Pasien, Antrean & Riwayat', permission: 'pendaftaran' },
  ],
  DOKTER: [
    { id: 'dept-dashboard', label: 'Dashboard Dokter', permission: 'dashboard', requires: 'pemeriksaan' },
    { id: 'pemeriksaan', label: 'Antrean & Pemeriksaan Dokter', permission: 'pemeriksaan' },
  ],
  FARMASI: [
    { id: 'dept-dashboard', label: 'Dashboard Farmasi', permission: 'dashboard', requires: 'farmasi' },
    { id: 'farmasi', label: 'Resep & Penyerahan Obat', permission: 'farmasi' },
  ],
  LABORATORIUM: [
    { id: 'dept-dashboard', label: 'Dashboard Laboratorium', permission: 'dashboard', requires: 'laboratorium' },
    { id: 'laboratorium', label: 'Permintaan & Hasil Lab', permission: 'laboratorium' },
  ],
  KASIR: [
    { id: 'dept-dashboard', label: 'Dashboard Kasir', permission: 'dashboard', requires: 'kasir' },
    { id: 'kasir', label: 'Tagihan, Pembayaran & Invoice', permission: 'kasir' },
  ],
};

const operationalMenus = [
  { id: 'pendaftaran', label: 'Pendaftaran & Antrean', permission: 'pendaftaran' },
  { id: 'pemeriksaan', label: 'Antrean & Pemeriksaan Dokter', permission: 'pemeriksaan' },
  { id: 'farmasi', label: 'Resep & Penyerahan Obat', permission: 'farmasi' },
  { id: 'laboratorium', label: 'Permintaan & Hasil Lab', permission: 'laboratorium' },
  { id: 'kasir', label: 'Tagihan, Pembayaran & Invoice', permission: 'kasir' },
];

const getAvailableMenus = (user) => {
  const menus = user.role === 'ADMIN'
    ? adminMenus
    : [...(roleMenus[user.role] || []), ...operationalMenus];
  const permissions = new Set(user.permissions || []);
  return menus.filter((menu, index, list) => (
    list.findIndex((candidate) => candidate.id === menu.id) === index
    && (Array.isArray(menu.permission)
      ? menu.permission.some((permission) => permissions.has(permission))
      : permissions.has(menu.permission))
    && (!menu.requires || permissions.has(menu.requires))
  ));
};

export default function App() {
  // 1. SEMUA HOOK WAJIB DI ATAS SEBELUM EARLY RETURN
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('simrs_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [authRefreshing, setAuthRefreshing] = useState(Boolean(user));
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('simrs_user');
    return saved ? defaultTabByRole[JSON.parse(saved).role] || 'dashboard' : 'dashboard';
  });
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;

    yiiApi.get('/auth/me')
      .then(({ data }) => {
        if (!active) return;
        const refreshedUser = { ...data.data.user, permissions: data.data.permissions };
        localStorage.setItem('simrs_user', JSON.stringify(refreshedUser));
        setUser(refreshedUser);
        setAuthError('');
      })
      .catch((error) => {
        if (!active) return;
        if (error.response?.status === 401) {
          localStorage.removeItem('simrs_token');
          localStorage.removeItem('simrs_user');
          setUser(null);
        } else {
          setAuthError(error.response?.data?.message || 'Gagal memperbarui hak akses pengguna.');
        }
      })
      .finally(() => {
        if (active) setAuthRefreshing(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  // 2. BARU BOLEH EARLY RETURN SETELAH SEMUA HOOK DIPANGGIL
  if (!user) {
    return (
      <LoginPage
        onLoginSuccess={(u) => {
          setUser(u);
          setActiveTab(defaultTabByRole[u.role] || 'dashboard');
        }}
      />
    );
  }

  const handleLogout = () => {
    localStorage.removeItem('simrs_token');
    localStorage.removeItem('simrs_user');
    setUser(null);
  };

  const menus = getAvailableMenus(user);
  const visibleTab = menus.some((menu) => menu.id === activeTab) ? activeTab : menus[0]?.id;
  const activeMenu = menus.find((menu) => menu.id === visibleTab);

  if (authRefreshing) {
    return <main className="p-8 text-center text-slate-600">Memuat hak akses...</main>;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-teal-600 p-2 rounded-lg text-white">
              <Activity size={20} />
            </div>
            <span className="font-bold text-slate-800">SIMRS Rawat Jalan</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-slate-800">{user.nama_lengkap}</div>
              <div className="text-xs font-bold text-teal-600">{user.role}</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-red-600 rounded-lg border border-slate-200 cursor-pointer"
              title="Keluar"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Role Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-2 overflow-x-auto py-2 bg-slate-50 border-t border-slate-100">
          {menus.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveTab(m.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition cursor-pointer ${
                visibleTab === m.id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {authError && <p className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">{authError}</p>}
        {!visibleTab && <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Role ini belum memiliki hak akses ke menu aplikasi. Hubungi administrator.</p>}
        {visibleTab === 'dashboard' && <DashboardPage />}
        {visibleTab === 'dept-dashboard' && <RoleDashboardPage role={user.role} />}
        {visibleTab === 'pendaftaran' && <PendaftaranPage />}
        {visibleTab === 'pemeriksaan' && <PemeriksaanDokterPage />}
        {(visibleTab === 'farmasi' || visibleTab === 'laboratorium') && (
          <FarmasiLabPage role={visibleTab === 'farmasi' ? 'FARMASI' : visibleTab === 'laboratorium' ? 'LABORATORIUM' : user.role} />
        )}
        {visibleTab === 'kasir' && <KasirBillingPage />}
        {activeMenu?.resource && <AdminManagementPage key={activeMenu.resource} resource={activeMenu.resource} />}
        {visibleTab === 'hak-akses' && <AdminManagementPage key="hak-akses" resource="hak-akses" />}
      </main>
    </div>
  );
}