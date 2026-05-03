import React, { useState } from 'react';
import { User } from './App';
import { Settings as SettingsIcon, Key, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL;

export default function Settings({ user }: { user: User }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ADMIN_API_URL) return;
    
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 8 ký tự.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' });
      return;
    }

    setIsUpdating(true);
    setMessage(null);

    try {
      const res = await fetch(`${ADMIN_API_URL}?action=change_password`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ 
           email: user.email, 
           oldPassword: oldPassword, 
           newPassword: newPassword 
        })
      });
      const result = await res.json();
      
      if (result.status === 'success') {
        setMessage({ type: 'success', text: 'Đổi mật khẩu thành công!' });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: result.message || 'Lỗi khi đổi mật khẩu.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Lỗi mạng khi kết nối máy chủ.' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full h-full flex flex-col pt-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <SettingsIcon className="text-blue-600" size={32} /> Cài đặt tài khoản
        </h1>
        <p className="text-slate-500 mt-2 text-sm">Quản lý bảo mật và thông tin đăng nhập của bạn.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-2xl">
         <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
             <Key className="text-slate-600" size={20} />
             <h2 className="text-lg font-bold text-slate-800">Đổi mật khẩu</h2>
         </div>
         
         <div className="p-6 md:p-8">
            {message && (
               <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${
                 message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
               }`}>
                  {message.type === 'success' ? <CheckCircle size={20} className="shrink-0" /> : <AlertCircle size={20} className="shrink-0" />}
                  <span className="text-sm font-medium">{message.text}</span>
               </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-5">
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Mật khẩu hiện tại</label>
                  <input 
                      required 
                      type="password" 
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800"
                      placeholder="••••••••" 
                  />
               </div>
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Mật khẩu mới</label>
                  <input 
                      required 
                      type="password"
                      minLength={8} 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800"
                      placeholder="Ít nhất 8 ký tự" 
                  />
               </div>
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Xác nhận mật khẩu mới</label>
                  <input 
                      required 
                      type="password" 
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800"
                      placeholder="Nhập lại mật khẩu mới" 
                  />
               </div>
               
               <div className="pt-4">
                  <button 
                     type="submit"
                     disabled={isUpdating}
                     className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-md shadow-blue-500/20 flex justify-center items-center gap-2"
                  >
                     {isUpdating ? <Loader2 size={18} className="animate-spin" /> : null} Đổi mật khẩu
                  </button>
               </div>
            </form>
         </div>
      </div>
    </div>
  );
}
