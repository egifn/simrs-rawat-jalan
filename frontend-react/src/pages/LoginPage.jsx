import { useState } from 'react';
import { yiiApi } from '../services/api';
import { Activity, Lock, User } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { role: 'ADMIN', username: 'admin', label: 'Admin' },
  { role: 'PENDAFTARAN', username: 'daftar1', label: 'Pendaftaran' },
  { role: 'DOKTER', username: 'dokter1', label: 'Dokter' },
  { role: 'LABORATORIUM', username: 'lab1', label: 'Laboratorium' },
  { role: 'KASIR', username: 'kasir1', label: 'Kasir' },
  { role: 'FARMASI', username: 'farmasi1', label: 'Farmasi' },
];

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await yiiApi.post('/auth/login', { username, password });
      const { token, user, permissions } = res.data.data;
      const authenticatedUser = { ...user, permissions };
      localStorage.setItem('simrs_token', token);
      localStorage.setItem('simrs_user', JSON.stringify(authenticatedUser));
      onLoginSuccess(authenticatedUser);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal terhubung ke server Yii2.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-teal-600 p-3 rounded-xl text-white">
            <Activity size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">SIMRS Rawat Jalan</h1>
            <p className="text-xs text-slate-500">Sistem Pelayanan Terintegrasi (Yii2 + Node.js)</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 rounded-lg transition cursor-pointer"
          >
            {loading ? 'Memproses...' : 'Masuk ke Sistem'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-2 font-medium">Akses Cepat Akun Pengujian (Password: password123):</p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.username}
                type="button"
                onClick={() => { setUsername(acc.username); setPassword('password123'); }}
                className="text-xs py-1.5 px-2 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 rounded border border-slate-200 font-medium transition cursor-pointer"
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}