import { useCallback, useEffect, useState } from 'react';
import { yiiApi } from '../services/api';
import { UserPlus, ClipboardList, Clock, Users, Search } from 'lucide-react';

const getLocalDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const getDayName = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][
    new Date(year, month - 1, day).getDay()
  ];
};

export default function PendaftaranPage() {
  const [tanggalKunjungan, setTanggalKunjungan] = useState(getLocalDate);
  const todayStr = tanggalKunjungan;
  const todayName = getDayName(tanggalKunjungan);
  const [pasienList, setPasienList] = useState([]);
  const [poliList, setPoliList] = useState([]);
  const [dokterList, setDokterList] = useState([]);
  const [kunjunganList, setKunjunganList] = useState([]);
  const [riwayatKunjungan, setRiwayatKunjungan] = useState([]);

  const [pasienSearch, setPasienSearch] = useState('');
  const [pasienId, setPasienId] = useState('');
  const [poliId, setPoliId] = useState('');
  const [dokterId, setDokterId] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingPasien, setSavingPasien] = useState(false);
  const [savingKunjungan, setSavingKunjungan] = useState(false);
  const [newPasien, setNewPasien] = useState({
    nik: '',
    nama_lengkap: '',
    tanggal_lahir: '',
    jenis_kelamin: 'L',
    alamat: '',
    no_telepon: '',
  });
  const [msg, setMsg] = useState({ type: '', text: '' });

  // State untuk tick hitung mundur tiap 1 detik
  const [now, setNow] = useState(() => Date.now());

  const loadData = useCallback(async () => {
    try {
      const [poliRes, dokRes, kunjRes] = await Promise.all([
        yiiApi.get('/poli'),
        yiiApi.get('/dokter'),
        yiiApi.get('/kunjungan', { params: { tanggal: todayStr, limit: 500 } }),
      ]);
      setPoliList(poliRes.data.data);
      setDokterList(dokRes.data.data);
      setKunjunganList(kunjRes.data.data);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Gagal memuat data pendaftaran.' });
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadData();
    // Auto-refresh data antrean setiap 15 detik
    const poll = setInterval(() => loadData(), 15000);
    // Tick detik untuk live countdown estimasi
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(timer);
    };
  }, [loadData]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const response = await yiiApi.get('/pasien', {
          params: pasienSearch.trim() ? { q: pasienSearch.trim() } : {},
          signal: controller.signal,
        });
        setPasienList(response.data.data);
      } catch (err) {
        if (err.code !== 'ERR_CANCELED') {
          setMsg({ type: 'error', text: err.response?.data?.message || 'Gagal mencari data pasien.' });
        }
      }
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [pasienSearch]);

  useEffect(() => {
    if (!pasienId) {
      setRiwayatKunjungan([]);
      return undefined;
    }

    const controller = new AbortController();
    const loadRiwayat = async () => {
      try {
        const response = await yiiApi.get('/kunjungan', {
          params: { pasien_id: pasienId, limit: 100 },
          signal: controller.signal,
        });
        setRiwayatKunjungan(response.data.data);
      } catch (err) {
        if (err.code !== 'ERR_CANCELED') {
          setMsg({ type: 'error', text: err.response?.data?.message || 'Gagal memuat riwayat kunjungan pasien.' });
        }
      }
    };

    loadRiwayat();
    return () => controller.abort();
  }, [pasienId]);

  const handleCreatePasien = async (e) => {
    e.preventDefault();
    setSavingPasien(true);
    try {
      const response = await yiiApi.post('/pasien', {
        ...newPasien,
        nik: newPasien.nik.trim(),
        nama_lengkap: newPasien.nama_lengkap.trim(),
      });
      setMsg({ type: 'success', text: 'Pasien baru berhasil ditambahkan!' });
      setPasienId(String(response.data.data.id));
      setPasienSearch(response.data.data.no_rm || response.data.data.nik);
      setNewPasien({
        nik: '',
        nama_lengkap: '',
        tanggal_lahir: '',
        jenis_kelamin: 'L',
        alamat: '',
        no_telepon: '',
      });
      await loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Gagal menambah pasien.' });
    } finally {
      setSavingPasien(false);
    }
  };

  const handleDaftarKunjungan = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    setSavingKunjungan(true);
    try {
      const res = await yiiApi.post('/kunjungan', {
        pasien_id: Number(pasienId),
        poli_id: Number(poliId),
        dokter_id: Number(dokterId),
        tanggal_kunjungan: tanggalKunjungan,
      });
      setMsg({
        type: 'success',
        text: `Pendaftaran berhasil! Nomor Antrean: ${res.data.data.kode_antrean}`,
      });

      // Reset dropdown pilihan kembali ke awal setelah berhasil daftar
      setPasienId('');
      setPoliId('');
      setDokterId('');

      await loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Terjadi kesalahan pendaftaran.' });
    } finally {
      setSavingKunjungan(false);
    }
  };

  const filteredDokter = dokterList.filter(
    (dokter) =>
      String(dokter.poli_id) === String(poliId) &&
      dokter.jadwal?.some((jadwal) => jadwal.hari === todayName)
  );
  const getJadwalDokter = (dokter) => dokter.jadwal?.find((jadwal) => jadwal.hari === todayName);
  const getJumlahAntreanDokter = (dokterId) =>
    kunjunganList.filter(
      (kunjungan) =>
        String(kunjungan.dokter_id) === String(dokterId) &&
        kunjungan.status_antrean !== 'BATAL'
    ).length;
  const isDokterPenuh = (dokter) => {
    const kuota = Number(getJadwalDokter(dokter)?.kuota_harian || 0);
    return kuota > 0 && getJumlahAntreanDokter(dokter.id) >= kuota;
  };
  const dokterTerpilih = filteredDokter.find((dokter) => String(dokter.id) === String(dokterId));

  // 1. Filter khusus kunjungan HARI INI saja
  const kunjunganHariIni = kunjunganList.filter((k) =>
    String(k.tanggal_kunjungan).startsWith(todayStr)
  );
  const kunjunganHariIniTerbaru = [...kunjunganHariIni].sort(
    (a, b) => Number(b.id) - Number(a.id)
  );

  // 2. Pasien yang benar-benar masih MENUNGGU dipanggil dokter (diurutkan dari antrean terawal)
  const antreanMenunggu = kunjunganHariIni
    .filter((k) => k.status_antrean === 'MENUNGGU')
    .sort((a, b) => Number(a.no_antrean) - Number(b.no_antrean));

  // 3. Pasien yang sedang/sudah diperiksa dokter namun belum selesai bayar di kasir
  const waktuAntreanPertama = antreanMenunggu[0]?.created_at
    ? new Date(antreanMenunggu[0].created_at).getTime()
    : now;
  const antreanMulai = Number.isFinite(waktuAntreanPertama) ? waktuAntreanPertama : now;

  // Hitung countdown waktu tunggu (asumsi rata-rata 10 menit per pasien di depan)
  const formatCountdown = (urutanDiDepan, antreanMulai) => {
    if (urutanDiDepan < 0) return '-';
    if (urutanDiDepan === 0) return 'Giliran Sekarang';
    const targetPanggil = antreanMulai + urutanDiDepan * 10 * 60 * 1000;
    const sisaMs = Math.max(0, targetPanggil - now);

    if (sisaMs === 0) return 'Segera Dipanggil';
    const menit = Math.floor(sisaMs / 60000);
    const detik = Math.floor((sisaMs % 60000) / 1000);
    return `${String(menit).padStart(2, '0')}:${String(detik).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {msg.text && (
        <div
          className={`p-3 rounded-lg text-sm border ${
            msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {msg.text}
        </div>
      )}
      {loading && (
        <div className="p-3 rounded-lg text-sm bg-slate-50 border border-slate-200 text-slate-600">
          Memuat data pendaftaran...
        </div>
      )}

      {/* BANNER LIVE MONITOR & COUNTDOWN ANTREAN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-teal-700 text-white p-5 rounded-xl shadow-sm">
          <div className="flex justify-between items-center text-teal-100 text-xs font-semibold uppercase">
            <span>Giliran Dipanggil Berikutnya</span>
            <Users size={18} />
          </div>
          <div className="text-3xl font-extrabold mt-2">
            {antreanMenunggu.length > 0 ? antreanMenunggu[0].kode_antrean : '-'}
          </div>
          <div className="text-xs text-teal-100 mt-1">
            {antreanMenunggu.length > 0
              ? `${antreanMenunggu[0].pasien?.nama_lengkap} (${antreanMenunggu[0].poli?.nama_poli})`
              : 'Semua antrean poli sudah dipanggil'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="flex justify-between items-center text-slate-500 text-xs font-semibold uppercase">
            <span>Sisa Antrean Menunggu</span>
            <ClipboardList size={18} className="text-amber-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-800 mt-2">
            {antreanMenunggu.length} <span className="text-sm font-normal text-slate-500">Pasien</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Total hari ini: {kunjunganHariIni.length}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="flex justify-between items-center text-slate-500 text-xs font-semibold uppercase">
            <span>Estimasi Tunggu Pasien Baru</span>
            <Clock size={18} className="text-blue-600" />
          </div>
          <div className="text-3xl font-extrabold text-blue-700 mt-2">
            ± {antreanMenunggu.length * 10} <span className="text-sm font-normal text-slate-500">Menit</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Asumsi ±10 menit per konsultasi poli</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Pendaftaran Kunjungan */}
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <ClipboardList size={18} className="text-teal-600" /> Pendaftaran Kunjungan Rawat Jalan
          </h3>
          <form onSubmit={handleDaftarKunjungan} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Pilih Pasien (No. RM / Nama)</label>
              <div className="relative mb-2">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={pasienSearch}
                  onChange={(e) => {
                    setPasienSearch(e.target.value);
                    setPasienId('');
                  }}
                  placeholder="Cari No. RM, NIK, atau nama pasien"
                  className="w-full border rounded-lg py-2 pl-9 pr-3 text-sm"
                  aria-label="Cari pasien berdasarkan nomor rekam medis, NIK, atau nama"
                />
              </div>
              <select
                value={pasienId}
                onChange={(e) => setPasienId(e.target.value)}
                className="w-full border rounded-lg p-2 text-sm"
                required
                disabled={loading}
              >
                <option value="">-- Pilih Pasien --</option>
                {pasienList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.no_rm} - {p.nama_lengkap} (NIK: {p.nik})
                  </option>
                ))}
              </select>
              {pasienId && riwayatKunjungan.length > 0 && (
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-1 text-xs font-semibold text-slate-600">Riwayat kunjungan pasien</p>
                  <ul className="space-y-1">
                    {riwayatKunjungan.slice(0, 5).map((kunjungan) => (
                      <li key={kunjungan.id} className="text-xs text-slate-600">
                        {kunjungan.tanggal_kunjungan} — {kunjungan.poli?.nama_poli} — {kunjungan.status_antrean}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal Kunjungan</label>
              <input
                type="date"
                value={tanggalKunjungan}
                min={getLocalDate()}
                onChange={(e) => {
                  setTanggalKunjungan(e.target.value);
                  setDokterId('');
                }}
                className="w-full border rounded-lg p-2 text-sm"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Pilih Poliklinik</label>
              <select
                value={poliId}
                onChange={(e) => {
                  setPoliId(e.target.value);
                  setDokterId('');
                }}
                className="w-full border rounded-lg p-2 text-sm"
                required
                disabled={loading}
              >
                <option value="">-- Pilih Poli --</option>
                {poliList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama_poli} (Biaya Daftar: Rp {Number(p.biaya_pendaftaran).toLocaleString('id-ID')})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Pilih Dokter Praktik</label>
              <select
                value={dokterId}
                onChange={(e) => setDokterId(e.target.value)}
                className="w-full border rounded-lg p-2 text-sm"
                required
                disabled={!poliId || loading}
              >
                <option value="">-- Pilih Dokter --</option>
                {filteredDokter.map((d) => {
                  const jadwal = getJadwalDokter(d);
                  const jumlahAntrean = getJumlahAntreanDokter(d.id);
                  const kuotaPenuh = isDokterPenuh(d);
                  return (
                    <option key={d.id} value={d.id} disabled={kuotaPenuh}>
                      {d.nama_dokter} ({d.spesialisasi}) — {jadwal.jam_mulai}–{jadwal.jam_selesai}
                      {jadwal.kuota_harian ? ` (${jumlahAntrean}/${jadwal.kuota_harian})` : ''}
                      {kuotaPenuh ? ' — Kuota penuh' : ''}
                    </option>
                  );
                })}
              </select>
              {dokterTerpilih && isDokterPenuh(dokterTerpilih) && (
                <p className="mt-1 text-xs text-red-700">Kuota dokter untuk tanggal ini sudah penuh.</p>
              )}
              {poliId && filteredDokter.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">Tidak ada dokter dengan jadwal praktik di poli ini pada tanggal yang dipilih.</p>
              )}
            </div>
            <button
              type="submit"
              disabled={savingKunjungan || loading || !dokterTerpilih || isDokterPenuh(dokterTerpilih)}
              className="w-full bg-teal-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-teal-700 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingKunjungan ? 'Mendaftarkan...' : 'Daftarkan & Cetak Nomor Antrean'}
            </button>
          </form>
        </div>

        {/* Form Pasien Baru */}
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <UserPlus size={18} className="text-blue-600" /> Registrasi Pasien Baru (Auto No. RM)
          </h3>
          <form onSubmit={handleCreatePasien} className="grid grid-cols-2 gap-3">
            <input
              placeholder="NIK (16 digit)"
              maxLength={16}
              value={newPasien.nik}
              onChange={(e) => setNewPasien({ ...newPasien, nik: e.target.value })}
              className="border rounded-lg p-2 text-sm"
              inputMode="numeric"
              pattern="[0-9]{16}"
              title="NIK harus terdiri dari 16 angka."
              required
            />
            <input
              placeholder="Nama Lengkap"
              value={newPasien.nama_lengkap}
              onChange={(e) => setNewPasien({ ...newPasien, nama_lengkap: e.target.value })}
              className="border rounded-lg p-2 text-sm"
              required
            />
            <input
              type="date"
              value={newPasien.tanggal_lahir}
              onChange={(e) => setNewPasien({ ...newPasien, tanggal_lahir: e.target.value })}
              className="border rounded-lg p-2 text-sm"
              required
            />
            <select
              value={newPasien.jenis_kelamin}
              onChange={(e) => setNewPasien({ ...newPasien, jenis_kelamin: e.target.value })}
              className="border rounded-lg p-2 text-sm"
            >
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
            <input
              placeholder="No. Telepon"
              value={newPasien.no_telepon}
              onChange={(e) => setNewPasien({ ...newPasien, no_telepon: e.target.value })}
              className="border rounded-lg p-2 text-sm"
            />
            <input
              placeholder="Alamat"
              value={newPasien.alamat}
              onChange={(e) => setNewPasien({ ...newPasien, alamat: e.target.value })}
              className="border rounded-lg p-2 text-sm"
            />
            <button
              type="submit"
              disabled={savingPasien}
              className="col-span-2 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingPasien ? 'Menyimpan...' : 'Simpan Data Pasien Baru'}
            </button>
          </form>
        </div>
      </div>

      {/* Tabel Antrean & Live Countdown */}
      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-3">Daftar Antrean & Live Countdown Estimasi Panggil</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2.5">Antrean</th>
                <th className="p-2.5">No. Reg</th>
                <th className="p-2.5">Pasien</th>
                <th className="p-2.5">Poli & Dokter</th>
                <th className="p-2.5">Countdown Panggil</th>
                <th className="p-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {kunjunganHariIniTerbaru.map((k) => {
                const indexMenunggu = antreanMenunggu.findIndex((item) => item.id === k.id);
                const isSelesai = k.status_antrean === 'SELESAI' || k.status_antrean === 'BATAL';
                const isMenunggu = k.status_antrean === 'MENUNGGU';

                return (
                  <tr key={k.id}>
                    <td className="p-2.5 font-bold text-teal-700">{k.kode_antrean}</td>
                    <td className="p-2.5 font-mono text-xs">{k.no_registrasi}</td>
                    <td className="p-2.5">
                      {k.pasien?.nama_lengkap} <span className="text-xs text-slate-400">({k.pasien?.no_rm})</span>
                    </td>
                    <td className="p-2.5">
                      {k.poli?.nama_poli} — {k.dokter?.nama_dokter}
                    </td>
                    <td className="p-2.5 font-mono font-semibold text-blue-700">
                      {isMenunggu ? (
                        formatCountdown(indexMenunggu, antreanMulai)
                      ) : (
                        <span className="text-slate-400 font-sans text-xs">
                          {isSelesai ? '-' : 'Sudah Diperiksa'}
                        </span>
                      )}
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          isSelesai
                            ? 'bg-emerald-100 text-emerald-800'
                            : isMenunggu
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {k.status_antrean}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!loading && kunjunganHariIni.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-slate-500">
                    Belum ada pendaftaran untuk hari ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}