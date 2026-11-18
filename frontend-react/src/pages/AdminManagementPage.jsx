import { useCallback, useEffect, useState } from 'react';
import { yiiApi } from '../services/api';
import { Pencil, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react';

const roleOptions = [
  ['ADMIN', 'Administrator'],
  ['PENDAFTARAN', 'Petugas Pendaftaran'],
  ['DOKTER', 'Dokter'],
  ['FARMASI', 'Petugas Farmasi'],
  ['LABORATORIUM', 'Petugas Laboratorium'],
  ['KASIR', 'Kasir'],
];

const resources = {
  pasien: {
    label: 'Data Pasien',
    fields: [
      { name: 'nik', label: 'NIK', required: true },
      { name: 'nama_lengkap', label: 'Nama Lengkap', required: true },
      { name: 'tanggal_lahir', label: 'Tanggal Lahir', type: 'date', required: true },
      { name: 'jenis_kelamin', label: 'Jenis Kelamin', type: 'select', options: [['L', 'Laki-laki'], ['P', 'Perempuan']] },
      { name: 'alamat', label: 'Alamat' },
      { name: 'no_telepon', label: 'No. Telepon' },
      { name: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
    columns: ['no_rm', 'nik', 'nama_lengkap', 'tanggal_lahir', 'is_active'],
  },
  poli: {
    label: 'Data Poli',
    fields: [
      { name: 'kode_poli', label: 'Kode Poli', required: true },
      { name: 'nama_poli', label: 'Nama Poli', required: true },
      { name: 'biaya_pendaftaran', label: 'Biaya Pendaftaran', type: 'number', required: true },
      { name: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
    columns: ['kode_poli', 'nama_poli', 'biaya_pendaftaran', 'is_active'],
  },
  dokter: {
    label: 'Data Dokter',
    fields: [
      { name: 'nip', label: 'NIP', required: true },
      { name: 'nama_dokter', label: 'Nama Dokter', required: true },
      { name: 'spesialisasi', label: 'Spesialisasi', required: true },
      { name: 'poli_id', label: 'Poli', type: 'poli', required: true },
      { name: 'user_id', label: 'ID Pengguna Dokter', type: 'number' },
      { name: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
    columns: ['nip', 'nama_dokter', 'spesialisasi', 'poli.nama_poli', 'is_active'],
  },
  jadwal: {
    label: 'Jadwal Dokter',
    fields: [
      { name: 'dokter_id', label: 'Dokter', type: 'dokter', required: true },
      { name: 'hari', label: 'Hari', type: 'select', options: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((day) => [day, day]) },
      { name: 'jam_mulai', label: 'Jam Mulai', type: 'time', required: true },
      { name: 'jam_selesai', label: 'Jam Selesai', type: 'time', required: true },
      { name: 'kuota_harian', label: 'Kuota Harian', type: 'number' },
    ],
    columns: ['dokter.nama_dokter', 'hari', 'jam_mulai', 'jam_selesai', 'kuota_harian'],
  },
  tindakan: {
    label: 'Master Tindakan',
    fields: [
      { name: 'kode_tindakan', label: 'Kode Tindakan', required: true },
      { name: 'nama_tindakan', label: 'Nama Tindakan', required: true },
      { name: 'kategori', label: 'Kategori', type: 'select', options: [['MEDIS', 'Medis'], ['LABORATORIUM', 'Laboratorium']] },
      { name: 'tarif', label: 'Tarif', type: 'number', required: true },
      { name: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
    columns: ['kode_tindakan', 'nama_tindakan', 'kategori', 'tarif', 'is_active'],
  },
  obat: {
    label: 'Master Obat',
    fields: [
      { name: 'kode_obat', label: 'Kode Obat', required: true },
      { name: 'nama_obat', label: 'Nama Obat', required: true },
      { name: 'satuan', label: 'Satuan', required: true },
      { name: 'stok', label: 'Stok', type: 'number', required: true },
      { name: 'harga_satuan', label: 'Harga Satuan', type: 'number', required: true },
    ],
    columns: ['kode_obat', 'nama_obat', 'satuan', 'stok', 'harga_satuan'],
  },
  pengguna: {
    label: 'Pengguna',
    fields: [
      { name: 'username', label: 'Username', required: true },
      { name: 'nama_lengkap', label: 'Nama Lengkap', required: true },
      { name: 'role', label: 'Role', type: 'select', options: roleOptions },
      { name: 'password', label: 'Password', type: 'password', requiredOnCreate: true },
      { name: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
    columns: ['username', 'nama_lengkap', 'role', 'is_active'],
  },
};

const readValue = (record, path) => path.split('.').reduce((value, key) => value?.[key], record);
const emptyForm = (resource) => Object.fromEntries(
  (resources[resource]?.fields || []).map((field) => [
    field.name,
    field.type === 'boolean' ? true : field.name === 'jenis_kelamin' ? 'L' : '',
  ])
);

export default function AdminManagementPage({ resource }) {
  const [records, setRecords] = useState([]);
  const [poliList, setPoliList] = useState([]);
  const [dokterList, setDokterList] = useState([]);
  const [form, setForm] = useState(() => emptyForm(resource));
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingRole, setSavingRole] = useState('');
  const [permissionData, setPermissionData] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const definition = resources[resource];

  const title = definition?.label || 'Hak Akses';

  const loadData = useCallback(async () => {
    if (!definition && resource !== 'hak-akses') return;
    setLoading(true);
    try {
      if (resource === 'hak-akses') {
        const { data } = await yiiApi.get('/admin/permissions');
        setPermissionData(data.data);
        return;
      }
      const { data } = await yiiApi.get(`/admin/${resource}`);
      setRecords(data.data);
      if (resource === 'dokter' || resource === 'jadwal') {
        const poliResponse = await yiiApi.get('/poli');
        setPoliList(poliResponse.data.data);
      }
      if (resource === 'jadwal') {
        const doctorResponse = await yiiApi.get('/dokter');
        setDokterList(doctorResponse.data.data);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Gagal memuat data administrator.' });
    } finally {
      setLoading(false);
    }
  }, [definition, resource]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const startEdit = (record) => {
    setEditingId(record.id);
    setForm(Object.fromEntries(
      definition.fields.map((field) => [field.name, record[field.name] ?? (field.type === 'boolean' ? true : '')])
    ));
    setMessage({ type: '', text: '' });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const payload = { ...form };
      for (const field of definition.fields) {
        if (field.type === 'number' && payload[field.name] !== '') {
          payload[field.name] = Number(payload[field.name]);
        }
      }
      if (resource === 'pengguna' && editingId && !payload.password) delete payload.password;

      if (editingId) {
        await yiiApi.put(`/admin/${resource}/${editingId}`, payload);
      } else {
        await yiiApi.post(`/admin/${resource}`, payload);
      }
      setMessage({ type: 'success', text: `${title} berhasil ${editingId ? 'diperbarui' : 'ditambahkan'}.` });
      setForm(emptyForm(resource));
      setEditingId(null);
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || `Gagal menyimpan ${title.toLowerCase()}.` });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record) => {
    if (!window.confirm(`Hapus data ${title.toLowerCase()} ini?`)) return;
    try {
      await yiiApi.delete(`/admin/${resource}/${record.id}`);
      setMessage({ type: 'success', text: `${title} berhasil dihapus.` });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || `Gagal menghapus ${title.toLowerCase()}.` });
    }
  };

  const updateRolePermissions = async (role) => {
    setSavingRole(role);
    setMessage({ type: '', text: '' });
    try {
      const permissions = permissionData.permissions_by_role[role] || [];
      await yiiApi.put('/admin/permissions', { role, permissions });
      setMessage({
        type: 'success',
        text: `Hak akses ${role} berhasil diperbarui. Pengguna role ini perlu masuk kembali agar menu diperbarui.`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || `Gagal memperbarui hak akses ${role}.` });
    } finally {
      setSavingRole('');
    }
  };

  const togglePermission = (role, permission, checked) => {
    setPermissionData((current) => {
      const existing = current.permissions_by_role[role] || [];
      const updated = checked
        ? [...existing, permission]
        : existing.filter((item) => item !== permission);

      return {
        ...current,
        permissions_by_role: {
          ...current.permissions_by_role,
          [role]: updated,
        },
      };
    });
  };

  const renderField = (field) => {
    const options = field.type === 'poli'
      ? poliList.map((poli) => [poli.id, poli.nama_poli])
      : field.type === 'dokter'
        ? dokterList.map((dokter) => [dokter.id, `${dokter.nama_dokter} — ${dokter.poli?.nama_poli || ''}`])
        : field.options;

    return (
      <label key={field.name} className="block text-xs font-semibold text-slate-600">
        <span className="mb-1 block">{field.label}</span>
        {field.type === 'select' || field.type === 'poli' || field.type === 'dokter' || field.type === 'boolean' ? (
          <select
            value={String(form[field.name] ?? '')}
            onChange={(event) => setForm({ ...form, [field.name]: field.type === 'boolean' ? event.target.value === 'true' : event.target.value })}
            className="w-full rounded-lg border p-2 text-sm font-normal"
            required={field.required}
          >
            {field.type !== 'boolean' && <option value="">-- Pilih {field.label} --</option>}
            {(field.type === 'boolean' ? [[true, 'Aktif'], [false, 'Nonaktif']] : options).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        ) : (
          <input
            type={field.type || 'text'}
            value={form[field.name] ?? ''}
            onChange={(event) => setForm({ ...form, [field.name]: event.target.value })}
            className="w-full rounded-lg border p-2 text-sm font-normal"
            required={field.required || (field.requiredOnCreate && !editingId)}
            min={field.type === 'number' ? 0 : undefined}
            autoComplete={field.name === 'password' ? 'new-password' : undefined}
          />
        )}
      </label>
    );
  };

  if (!definition) {
    return (
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <ShieldCheck className="text-teal-600" /> Pengaturan Hak Akses
        </h2>
        <p className="text-sm text-slate-600">
          Atur menu yang dapat digunakan setiap role. Administrator selalu memiliki akses penuh dan tidak dapat dibatasi.
        </p>
        {message.text && (
          <div className={`rounded-lg border p-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}
        {loading ? <p className="text-sm text-slate-500">Memuat hak akses...</p> : !permissionData ? null : (
          <div className="space-y-5">
            {permissionData.roles.map((role) => (
              <div key={role} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">{role}</h3>
                  {role !== 'ADMIN' && (
                    <button
                      type="button"
                      onClick={() => updateRolePermissions(role)}
                      disabled={savingRole === role}
                      className="flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                    >
                      <Save size={15} /> {savingRole === role ? 'Menyimpan...' : 'Simpan Hak Akses'}
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(permissionData.available_permissions).map(([permission, label]) => (
                    <label key={permission} className="flex items-center gap-2 rounded bg-slate-50 p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={(permissionData.permissions_by_role[role] || []).includes(permission)}
                        disabled={role === 'ADMIN' || savingRole === role}
                        onChange={(event) => togglePermission(role, permission, event.target.checked)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {message.text && (
        <div className={`rounded-lg border p-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-bold text-slate-800">{editingId ? `Ubah ${title}` : `Tambah ${title}`}</h2>
        <form onSubmit={handleSave} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {definition.fields.map(renderField)}
          <div className="flex items-end gap-2">
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
              {editingId ? <Save size={16} /> : <Plus size={16} />}
              {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Data'}
            </button>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm(resource)); }} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm">
                <X size={15} /> Batal
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-lg font-bold text-slate-800">{title}</h2>
        {loading ? <p className="text-sm text-slate-500">Memuat data...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {definition.columns.map((column) => <th key={column} className="p-2.5">{column.split('.').pop().replaceAll('_', ' ')}</th>)}
                  <th className="p-2.5">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((record) => (
                  <tr key={record.id}>
                    {definition.columns.map((column) => {
                      const value = readValue(record, column);
                      return <td key={column} className="p-2.5">{typeof value === 'boolean' ? (value ? 'Aktif' : 'Nonaktif') : value ?? '-'}</td>;
                    })}
                    <td className="p-2.5">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEdit(record)} className="rounded p-1.5 text-blue-700 hover:bg-blue-50" aria-label={`Ubah ${title}`}>
                          <Pencil size={16} />
                        </button>
                        <button type="button" onClick={() => handleDelete(record)} className="rounded p-1.5 text-red-700 hover:bg-red-50" aria-label={`Hapus ${title}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && <tr><td colSpan={definition.columns.length + 1} className="p-4 text-center text-slate-500">Belum ada data.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
