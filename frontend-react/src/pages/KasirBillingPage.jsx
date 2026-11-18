import { useEffect, useRef, useState } from 'react';
import { yiiApi, nodeApi } from '../services/api';
import { Receipt, Printer } from 'lucide-react';

export default function KasirBillingPage() {
  const [kunjunganList, setKunjunganList] = useState([]);
  const [selectedKunjunganId, setSelectedKunjunganId] = useState('');
  const [billingDetail, setBillingDetail] = useState(null);
  const [jumlahBayar, setJumlahBayar] = useState('');
  const [metode, setMetode] = useState('TUNAI');
  const [msg, setMsg] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const idempotencyRef = useRef(null);
  const kunjunganDipilih = kunjunganList.find((kunjungan) => String(kunjungan.id) === selectedKunjunganId);
  const sudahDiperiksa = Boolean(kunjunganDipilih?.rekamMedis);

  // Tagihan tetap ditampilkan sampai lunas, meskipun pelayanan pasien sudah selesai.
  const loadKunjunganBelumBayar = async () => {
    const res = await yiiApi.get('/kunjungan');
    const belumLunas = res.data.data.filter(
      (k) => k.status_antrean !== 'BATAL' && k.billing?.status_pembayaran !== 'LUNAS'
    );
    setKunjunganList(belumLunas);
  };

  useEffect(() => {
    loadKunjunganBelumBayar();
  }, []);

  const loadBilling = async (kId) => {
    setSelectedKunjunganId(kId);
    if (!kId) return setBillingDetail(null);
    const [res, kunjunganRes] = await Promise.all([
      yiiApi.get(`/billing/kunjungan/${kId}`),
      yiiApi.get(`/kunjungan/${kId}`),
    ]);
    setKunjunganList((current) =>
      current.map((kunjungan) =>
        String(kunjungan.id) === String(kId)
          ? { ...kunjungan, ...kunjunganRes.data.data }
          : kunjungan
      )
    );
    setBillingDetail(res.data.data);
    const b = res.data.data.billing;
    setJumlahBayar(Number(b.total_tagihan) - Number(b.total_dibayar));
  };

  const handleBayar = async (e) => {
    e.preventDefault();
    const b = billingDetail.billing;
    if (savingPayment) return;
    if (!idempotencyRef.current || idempotencyRef.current.billingId !== b.id) {
      idempotencyRef.current = { billingId: b.id, key: crypto.randomUUID() };
    }

    setSavingPayment(true);
    try {
      let response;
      try {
        response = await yiiApi.post(`/billing/bayar/${b.id}`, {
          idempotency_key: idempotencyRef.current.key,
          metode_pembayaran: metode,
          jumlah_bayar: Number(jumlahBayar),
        });
      } catch (err) {
        alert(err.response?.data?.message || 'Gagal memproses pembayaran');
        return;
      }

      const billingTerbaru = response.data.data.billing;
      idempotencyRef.current = null;
      setMsg(response.data.data.message);
      setBillingDetail((current) => ({ ...current, billing: billingTerbaru }));
      setJumlahBayar(Number(billingTerbaru.total_tagihan) - Number(billingTerbaru.total_dibayar));

      try {
        await loadKunjunganBelumBayar();
      } catch {
        setMsg('Pembayaran berhasil dicatat, tetapi daftar tagihan gagal diperbarui.');
      }
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDownloadPdf = async () => {
    const res = await nodeApi.get(`/pdf/invoice/${selectedKunjunganId}`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    window.open(url, '_blank');
  };

  const formatRp = (v) => `Rp ${Number(v || 0).toLocaleString('id-ID')}`;

  return (
    <div className="space-y-6">
      {msg && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm">{msg}</div>}

      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Receipt className="text-teal-600" /> Kasir & Billing Pelayanan Rawat Jalan
        </h2>
        <select
          value={selectedKunjunganId}
          onChange={(e) => loadBilling(e.target.value)}
          className="w-full border rounded-lg p-2.5 text-sm"
          disabled={savingPayment}
        >
          <option value="">-- Pilih Pasien Belum Bayar ({kunjunganList.length} Antrean Tagihan) --</option>
          {kunjunganList.map((k) => (
            <option key={k.id} value={k.id}>
              {k.no_registrasi} — {k.pasien?.nama_lengkap} ({k.poli?.nama_poli}){k.rekamMedis ? '' : ' — Belum diperiksa'}
            </option>
          ))}
        </select>
      </div>

      {billingDetail && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <h3 className="font-bold text-lg text-slate-800">Invoice: {billingDetail.billing.no_invoice}</h3>
              <p className="text-xs text-slate-500">
                Status: <span className="font-bold text-teal-700">{billingDetail.billing.status_pembayaran}</span>
              </p>
            </div>
            <button
              onClick={handleDownloadPdf}
              className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={15} /> Cetak PDF Invoice
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm bg-slate-50 p-4 rounded-lg">
            <div><span className="text-slate-500 block text-xs">Pendaftaran</span><b>{formatRp(billingDetail.billing.biaya_pendaftaran)}</b></div>
            <div><span className="text-slate-500 block text-xs">Tindakan Medis</span><b>{formatRp(billingDetail.billing.biaya_tindakan)}</b></div>
            <div><span className="text-slate-500 block text-xs">Pemeriksaan Lab</span><b>{formatRp(billingDetail.billing.biaya_lab)}</b></div>
            <div><span className="text-slate-500 block text-xs">Obat Farmasi</span><b>{formatRp(billingDetail.billing.biaya_obat)}</b></div>
          </div>

          <div className="flex justify-between items-center text-base font-bold pt-2">
            <span>Total Tagihan: {formatRp(billingDetail.billing.total_tagihan)}</span>
            <span className="text-emerald-700">Sudah Dibayar: {formatRp(billingDetail.billing.total_dibayar)}</span>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h4 className="font-semibold text-sm text-slate-700">Rincian Tagihan</h4>
            {[
              {
                label: 'Tindakan Medis',
                items: billingDetail.rincian?.tindakan || [],
                getName: (item) => item.tindakan?.nama_tindakan,
              },
              {
                label: 'Pemeriksaan Lab',
                items: billingDetail.rincian?.laboratorium || [],
                getName: (item) => item.tindakan?.nama_tindakan,
              },
              {
                label: 'Obat',
                items: billingDetail.rincian?.obat || [],
                getName: (item) => item.obat?.nama_obat,
              },
            ].map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-slate-500">{group.label}</p>
                {group.items.length === 0 ? (
                  <p className="text-xs text-slate-400">Tidak ada rincian.</p>
                ) : (
                  group.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-3 text-sm">
                      <span>{group.getName(item) || '-'} × {item.jumlah || 1}</span>
                      <span>{formatRp(item.subtotal ?? item.tindakan?.tarif ?? item.obat?.harga_satuan)}</span>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>

          {billingDetail.billing.pembayaran?.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm text-slate-700 mb-2">Riwayat Pembayaran</h4>
              <div className="space-y-1">
                {billingDetail.billing.pembayaran.map((payment) => (
                  <div key={payment.id} className="flex justify-between gap-3 text-sm">
                    <span>{payment.no_kwitansi} — {payment.metode_pembayaran}</span>
                    <span>{formatRp(payment.jumlah_bayar)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {billingDetail.billing.status_pembayaran !== 'LUNAS' && !sudahDiperiksa && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Pembayaran belum dapat diproses. Selesaikan pemeriksaan dokter terlebih dahulu.
            </div>
          )}

          {billingDetail.billing.status_pembayaran !== 'LUNAS' && sudahDiperiksa && (
            <form onSubmit={handleBayar} className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t">
              <select value={metode} onChange={(e) => setMetode(e.target.value)} className="border rounded-lg p-2 text-sm">
                <option value="TUNAI">Pembayaran Tunai</option>
                <option value="NON_TUNAI">Non-Tunai (QRIS / Debit / Transfer)</option>
              </select>
              <input
                type="number"
                value={jumlahBayar}
                onChange={(e) => setJumlahBayar(e.target.value)}
                placeholder="Nominal Bayar"
                className="border rounded-lg p-2 text-sm"
                required
              />
              <button type="submit" disabled={savingPayment} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg py-2 text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                {savingPayment ? 'Memproses Pembayaran...' : 'Proses Pembayaran (Idempotent)'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}