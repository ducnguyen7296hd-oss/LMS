import React, { useState, useEffect } from 'react';
import { Users, CheckCircle, Clock, ShieldCheck, RefreshCcw, Loader2, UserPlus, X } from 'lucide-react';
import { User } from './App';

const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL;

interface GiaoVien {
  email: string;
  name: string;
  status: string;
  role: string;
  createdAt: string;
}

export default function UserManagement({ user }: { user: User }) {
  const [usersList, setUsersList] = useState<GiaoVien[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  
  // Modal state
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('teacher');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const fetchUsers = async () => {
    if (!ADMIN_API_URL) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${ADMIN_API_URL}?action=get_users`);
      const result = await res.json();
      if (result.status === 'success') {
        setUsersList(result.data);
      } else {
        alert('Lỗi tải danh sách người dùng: ' + result.message);
      }
    } catch (error) {
      alert('Lỗi kết nối máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApprove = async (targetEmail: string, newStatus: string) => {
    if (!ADMIN_API_URL) return;
    setIsUpdating(targetEmail);
    try {
      const res = await fetch(`${ADMIN_API_URL}?action=update_user_status`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ email: targetEmail, status: newStatus })
      });
      const result = await res.json();
      if (result.status === 'success') {
        setUsersList(prev => prev.map(u => u.email === targetEmail ? { ...u, status: newStatus } : u));
      } else {
        alert('Lỗi: ' + result.message);
      }
    } catch (error) {
      alert('Lỗi kết nối máy chủ.');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ADMIN_API_URL) return;
    if (newPassword.length < 8) {
       alert("Mật khẩu phải từ 8 ký tự trở lên.");
       return;
    }
    setIsCreatingUser(true);
    try {
      const res = await fetch(`${ADMIN_API_URL}?action=create_user_manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ 
          email: newEmail.trim().toLowerCase(), 
          name: newName.trim(), 
          password: newPassword, 
          role: newRole 
        })
      });
      const result = await res.json();
      if (result.status === 'success') {
        alert('Tạo người dùng thành công!');
        setIsAddUserModalOpen(false);
        setNewEmail(''); setNewName(''); setNewPassword(''); setNewRole('teacher');
        fetchUsers();
      } else {
        alert('Lỗi: ' + result.message);
      }
    } catch (error) {
      alert('Lỗi kết nối máy chủ.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full h-[calc(100vh-120px)] flex flex-col relative">
      <div className="mb-6 flex justify-between items-end shrink-0">
        <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                <ShieldCheck className="text-blue-600" size={32} /> Quản lý Người dùng
            </h1>
            <p className="text-slate-500 mt-2 text-sm">Quản lý và tạo tài khoản (Admin/Giáo viên) thủ công.</p>
        </div>
        <div className="flex items-center gap-3">
            <button 
                onClick={fetchUsers} 
                disabled={isLoading}
                className="text-sm bg-white hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors border border-slate-200 shadow-sm"
            >
                <RefreshCcw size={16} className={isLoading ? "animate-spin text-blue-500" : ""} />
                Làm mới
            </button>
            <button 
                onClick={() => setIsAddUserModalOpen(true)}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors shadow-sm"
            >
                <UserPlus size={16} />
                Thêm tài khoản
            </button>
        </div>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-bold">
                <th className="px-6 py-4 w-16 text-center">STT</th>
                <th className="px-6 py-4">Tài khoản Google (Email)</th>
                <th className="px-6 py-4">Tên hiển thị</th>
                <th className="px-6 py-4 w-40">Vai trò</th>
                <th className="px-6 py-4 w-40">Trạng thái</th>
                <th className="px-6 py-4 w-40">Ngày đăng ký</th>
                <th className="px-6 py-4 w-40 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    {isLoading ? 'Đang tải dữ liệu...' : 'Chưa có người dùng nào đăng ký.'}
                  </td>
                </tr>
              ) : (
                usersList.map((u, idx) => (
                  <tr key={u.email} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 text-center text-slate-500 font-medium text-sm">{idx + 1}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800">{u.email}</td>
                    <td className="px-6 py-4 text-slate-600">{u.name}</td>
                    <td className="px-6 py-4">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
                          Quản trị viên
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          Giáo viên
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {u.status === 'Approved' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-green-100 text-green-700">
                          <CheckCircle size={14} /> Đã Duyệt
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-700">
                          <Clock size={14} /> Chờ duyệt
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-sm">
                      {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {u.email !== user.email ? (
                        u.status === 'Approved' ? (
                          <button 
                            disabled={isUpdating === u.email}
                            onClick={() => handleApprove(u.email, 'Pending')}
                            className="text-xs bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-70 disabled:cursor-not-allowed font-bold px-3 py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 min-w-[90px]"
                          >
                            {isUpdating === u.email ? <><Loader2 size={14} className="animate-spin" /> Xử lý</> : 'Hủy quyền'}
                          </button>
                        ) : (
                          <button 
                            disabled={isUpdating === u.email}
                            onClick={() => handleApprove(u.email, 'Approved')}
                            className="text-xs bg-green-500 text-white hover:bg-green-600 disabled:opacity-70 disabled:cursor-not-allowed font-bold px-3 py-1.5 rounded transition-colors shadow-sm shadow-green-500/20 flex items-center justify-center gap-1.5 min-w-[90px]"
                          >
                            {isUpdating === u.email ? <><Loader2 size={14} className="animate-spin" /> Xử lý</> : 'Phê duyệt'}
                          </button>
                        )
                      ) : (
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded">Tài khoản của bạn</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Create User Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
            <button 
                onClick={() => setIsAddUserModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                disabled={isCreatingUser}
            >
                <X size={20} />
            </button>
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="text-blue-600" size={24} /> Thêm tài khoản thủ công
              </h2>
            </div>
            
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Email / Tên đăng nhập</label>
                <input 
                    required 
                    type="email" 
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800" 
                    placeholder="VD: admin@thptvu.edu.vn" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Tên hiển thị</label>
                <input 
                    required 
                    type="text" 
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800" 
                    placeholder="Nguyễn Văn A" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Mật khẩu</label>
                <input 
                    required 
                    type="password" 
                    minLength={8}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800" 
                    placeholder="••••••••" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Vai trò</label>
                <select 
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800"
                >
                    <option value="teacher">Giáo viên</option>
                    <option value="admin">Quản trị viên (Admin)</option>
                </select>
              </div>
              
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsAddUserModalOpen(false)}
                  disabled={isCreatingUser}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  disabled={isCreatingUser}
                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-md shadow-blue-500/20 flex justify-center items-center gap-2"
                >
                  {isCreatingUser ? <Loader2 size={18} className="animate-spin" /> : null} Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}