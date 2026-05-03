import React, { useState, useRef } from 'react';
import {
  Search, Bell, Settings, School, Users, FileText, HelpCircle, LogOut, Loader2, ShieldCheck, Mail, LogIn, CheckCircle
} from 'lucide-react';
import OnlineQuiz from './OnlineQuiz';
import ClassManagement from './ClassManagement';
import UserManagement from './UserManagement';
import StudentPortal from './StudentPortal';
import SettingsPage from './Settings';

type Tab = 'CLASS_STUDENTS' | 'QUIZ' | 'USER_MANAGEMENT' | 'SETTINGS';

export interface User {
  email: string;
  name: string;
  picture?: string;
  role: 'admin' | 'teacher' | 'student';
  studentId?: string;
  className?: string;
  phone?: string;
  dob?: string;
}

const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL;

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('CLASS_STUDENTS');
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('edutest_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginMessage, setLoginMessage] = useState<{type: 'success'|'error'|'info', text: string} | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  
  const [authMode, setAuthMode] = useState<'teacher_login' | 'teacher_register' | 'student_login'>('teacher_login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [passwordConfirmInput, setPasswordConfirmInput] = useState('');
  const [studentIdInput, setStudentIdInput] = useState('');
  const [studentDobInput, setStudentDobInput] = useState('');

  const switchMode = (mode: typeof authMode) => {
    setAuthMode(mode);
    setLoginMessage(null);
    setEmailInput('');
    setPasswordInput('');
    setPhoneInput('');
    setPasswordConfirmInput('');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('edutest_user');
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.length < 8 || passwordInput.length > 20) {
        setLoginMessage({type: 'error', text: 'Mật khẩu phải từ 8 đến 20 ký tự.'});
        return;
    }
    setIsLoggingIn(true);
    setLoginMessage(null);
    try {
      if (!ADMIN_API_URL || ADMIN_API_URL.includes('YOUR_APPS_SCRIPT_WEB_APP_URL_HERE')) {
         setLoginMessage({type: 'error', text: 'Chưa cấu hình VITE_ADMIN_API_URL. Vui lòng kiểm tra lại file .env và khởi động lại web (tắt terminal đi chạy lại lệnh).'});
         setIsLoggingIn(false);
         return;
      }
      const res = await fetch(`${ADMIN_API_URL}?action=register_teacher`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ email: emailInput, name: emailInput.split('@')[0], password: passwordInput, phone: phoneInput })
      });
      const result = await res.json();
      if (result.status === 'pending') {
          switchMode('teacher_login');
          setLoginMessage({type: 'success', text: 'Đăng ký thành công! Đang chờ Admin duyệt.'});
      } else {
          setLoginMessage({type: 'error', text: result.message});
      }
    } catch (error) {
      setLoginMessage({type: 'error', text: 'Lỗi mạng.'});
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePasswordLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginMessage(null);
    try {
      if (!ADMIN_API_URL || ADMIN_API_URL.includes('YOUR_APPS_SCRIPT_WEB_APP_URL_HERE')) {
         setLoginMessage({type: 'error', text: 'Chưa cấu hình VITE_ADMIN_API_URL. Vui lòng kiểm tra lại file .env và khởi động lại web.'});
         setIsLoggingIn(false);
         return;
      }
      const res = await fetch(`${ADMIN_API_URL}?action=login_password`, {
          method: 'POST',
          body: JSON.stringify({ email: emailInput, password: passwordInput })
      });
      const result = await res.json();
      
      if (result.status === 'success') {
          // --- FIX LỖI Ở ĐÂY: Lấy role từ API, ép kiểu chữ thường ---
          const userRole = result.user.role ? (result.user.role.toLowerCase() === 'admin' ? 'admin' : 'teacher') : 'teacher';
          
          const userData = { 
              email: result.user.email, 
              name: result.user.name, 
              role: userRole as 'admin' | 'teacher', 
              phone: result.user.phone, 
              dob: result.user.dob 
          };
          setUser(userData);
          localStorage.setItem('edutest_user', JSON.stringify(userData));
      } else if (result.status === 'pending') {
          setLoginMessage({type: 'info', text: result.message});
      } else {
          setLoginMessage({type: 'error', text: result.message});
      }
    } catch (error) {
      setLoginMessage({type: 'error', text: 'Lỗi mạng.'});
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleStudentLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginMessage(null);
    try {
      if (!ADMIN_API_URL || ADMIN_API_URL.includes('YOUR_APPS_SCRIPT_WEB_APP_URL_HERE')) {
         setLoginMessage({type: 'error', text: 'Chưa cấu hình VITE_ADMIN_API_URL trong file .env. Vui lòng liên hệ Admin.'});
         setIsLoggingIn(false);
         return;
      }
      const res = await fetch(`${ADMIN_API_URL}?action=login_student`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ studentId: studentIdInput, dob: studentDobInput })
      });
      const result = await res.json();
      if (result.status === 'success') {
          const studentData = result.student || result.user;
          const userData = { 
              email: studentData.teacherEmail || '', 
              name: studentData.name, 
              role: 'student' as const, 
              studentId: studentData.id, 
              className: studentData.className 
          };
          setUser(userData);
          localStorage.setItem('edutest_user', JSON.stringify(userData));
      } else {
          setLoginMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setLoginMessage({ type: 'error', text: 'Lỗi mạng khi kết nối máy chủ.' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="bg-blue-600 p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-blue-500 opacity-20 transform -skew-y-12 scale-125"></div>
            <div className="relative z-10 w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-900/20 border border-white/30">
              <School className="text-white" size={40} />
            </div>
            <h1 className="relative z-10 text-3xl font-extrabold text-white mb-2 tracking-tight">EduTest Pro</h1>
            <p className="relative z-10 text-blue-100 text-sm font-medium">Hệ thống Quản lý Dành cho Đăng nhập</p>
          </div>
          
          <div className="flex border-b border-slate-200">
             <button 
               type="button"
               onClick={() => switchMode('teacher_login')}
               className={`flex-1 py-4 text-sm font-bold text-center transition-colors ${
                 authMode.startsWith('teacher_') ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 bg-slate-50'
               }`}
             >
               Giáo viên
             </button>
             <button 
               type="button"
               onClick={() => switchMode('student_login')}
               className={`flex-1 py-4 text-sm font-bold text-center transition-colors ${
                 authMode === 'student_login' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 bg-slate-50'
               }`}
             >
               Cổng học sinh
             </button>
          </div>
          
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">
               {authMode === 'teacher_login' && 'Đăng nhập'}
               {authMode === 'teacher_register' && 'Đăng ký tài khoản'}
               {authMode === 'student_login' && 'Đăng nhập Học sinh'}
            </h2>
            
            {loginMessage && (
              <div className={`p-4 rounded-xl mb-6 text-sm flex items-start gap-3 shadow-sm ${
                loginMessage.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 
                loginMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                'bg-blue-50 text-blue-800 border border-blue-200'
              }`}>
                {loginMessage.type === 'error' ? <ShieldCheck className="shrink-0 mt-0.5" size={18} /> : 
                 loginMessage.type === 'success' ? <CheckCircle className="shrink-0 mt-0.5" size={18} /> : 
                 <Mail className="shrink-0 mt-0.5" size={18} />}
                <span className="font-medium leading-relaxed">{loginMessage.text}</span>
              </div>
            )}

            {authMode === 'teacher_login' && (
              <form onSubmit={handlePasswordLoginSubmit} className="space-y-4">
                 <p className="text-center text-slate-500 text-sm mb-6 -mt-4">Chào mừng bạn quay trở lại</p>
                 <div>
                   <label className="block text-xs font-bold text-slate-700 mb-2">Tên tài khoản (Gmail)</label>
                   <input required type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800" placeholder="admin@gmail.com" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-700 mb-2">Mật khẩu</label>
                   <input required type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800" placeholder="••••••••" />
                 </div>
                 <div className="flex justify-end">
                    <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-800">Quên mật khẩu?</button>
                 </div>
                 <button type="submit" disabled={isLoggingIn} className="w-full bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-[0.98] flex justify-center items-center gap-2 mt-2">
                   {isLoggingIn ? <Loader2 className="animate-spin" size={20} /> : null} Đăng nhập ngay
                 </button>

                 <p className="text-center text-sm font-medium mt-4">
                    Chưa có tài khoản? <button type="button" onClick={() => switchMode('teacher_register')} className="text-blue-600 hover:underline">Đăng ký ngay</button>
                 </p>
              </form>
            )}

            {authMode === 'teacher_register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                 <p className="text-center text-slate-500 text-sm mb-6 -mt-4">Tạo tài khoản mới để trải nghiệm hệ thống</p>
                 <div>
                   <label className="block text-xs font-bold text-slate-700 mb-2">Tên tài khoản (Gmail)</label>
                   <input required type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800" placeholder="admin@gmail.com" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-700 mb-2">Mật khẩu (8-20 ký tự)</label>
                   <input required type="password" minLength={8} maxLength={20} value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800" placeholder="••••••••" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-700 mb-2">Số điện thoại</label>
                   <input required type="tel" value={phoneInput} onChange={e => setPhoneInput(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800" placeholder="Nhập số điện thoại của bạn" />
                 </div>
                 <button type="submit" disabled={isLoggingIn} className="w-full bg-emerald-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-emerald-700 transition-all shadow-md active:scale-[0.98] mt-2 flex justify-center items-center gap-2">
                   {isLoggingIn ? <Loader2 className="animate-spin" size={20} /> : null} Đăng ký ngay
                 </button>

                 <p className="text-center text-sm font-medium mt-4">
                    Đã có tài khoản? <button type="button" onClick={() => switchMode('teacher_login')} className="text-blue-600 hover:underline">Đăng nhập</button>
                 </p>
              </form>
            )}

            {authMode === 'student_login' && (
              <form onSubmit={handleStudentLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Mã học sinh</label>
                  <input required autoFocus type="text" value={studentIdInput} onChange={e => setStudentIdInput(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800" placeholder="VD: HS01" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Ngày sinh</label>
                  <input required type="date" value={studentDobInput} onChange={e => setStudentDobInput(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800" />
                </div>
                
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-[0.98] mt-2">
                  Vào Cổng Học Sinh
                </button>
                
              </form>
            )}

          </div>
        </div>
      </div>
    );
  }

  if (user.role === 'student') {
      return <StudentPortal user={user} onLogout={handleLogout} />;
  }

  const renderContent = () => {
    if (activeTab === 'QUIZ') return <OnlineQuiz user={user} />;
    if (activeTab === 'CLASS_STUDENTS') return <ClassManagement user={user} />;
    if (activeTab === 'USER_MANAGEMENT' && user.role === 'admin') return <UserManagement user={user} />;
    if (activeTab === 'SETTINGS') return <SettingsPage user={user} />;
    return null;
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdatingProfile(true);
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem('profile_name') as HTMLInputElement).value;
    const phone = (form.elements.namedItem('profile_phone') as HTMLInputElement).value;
    const dob = (form.elements.namedItem('profile_dob') as HTMLInputElement).value;
    
    try {
      const res = await fetch(`${ADMIN_API_URL}?action=update_profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ email: user.email, name, phone, dob })
      });
      const result = await res.json();
      if (result.status === 'success') {
        const updatedUser = { ...user, name, phone, dob };
        setUser(updatedUser);
        localStorage.setItem('edutest_user', JSON.stringify(updatedUser));
        setIsProfileModalOpen(false);
      } else {
        alert('Lỗi cập nhật: ' + result.message);
      }
    } catch (error) {
      alert('Lỗi kết nối máy chủ');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const navItemClass = (tab: Tab) => {
    return activeTab === tab
      ? "flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 text-blue-700 font-bold border-r-4 border-blue-600 text-sm w-full text-left transition-all shadow-sm"
      : "flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all font-medium text-sm w-full text-left";
  };

  return (
    <div className="font-sans text-slate-900 bg-slate-50 min-h-screen">
      {/* Top Navbar */}
      <header className="flex justify-between items-center px-6 h-16 w-full fixed top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-8">
          <span className="text-xl font-black text-blue-700 tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center"><School size={16} className="text-white"/></div>
            EduTest Pro
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block mr-2">
            <p className="text-sm font-bold text-slate-800 leading-tight">{user.name}</p>
            <p className="text-[11px] font-medium text-slate-500">{user.email}</p>
          </div>
          <div className="relative">
            <div 
              onClick={() => setIsProfileModalOpen(true)}
              className="h-10 w-10 rounded-full bg-slate-200 overflow-hidden ring-2 ring-white border border-slate-200 shadow-sm cursor-pointer hover:ring-blue-100 transition-all relative"
            >
              {user.picture ? (
                 <img alt="Profile" className="w-full h-full object-cover" src={user.picture} />
              ) : (
                 <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 text-white font-bold">{user.name.charAt(0)}</div>
              )}
              {user.role === 'admin' && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></div>
              )}
            </div>
            
            {isProfileModalOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                 <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                       {user.picture ? <img src={user.picture} alt="Profile" /> : user.name.charAt(0)}
                    </div>
                    <div>
                       <p className="font-bold text-slate-800">{user.name}</p>
                       <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                 </div>
                 <form onSubmit={handleUpdateProfile} className="p-4 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tên hiển thị</label>
                      <input name="profile_name" defaultValue={user.name} required type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 text-sm outline-none focus:border-blue-500 focus:bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại</label>
                      <input name="profile_phone" defaultValue={user.phone || ''} type="tel" className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 text-sm outline-none focus:border-blue-500 focus:bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Ngày sinh</label>
                      <input name="profile_dob" defaultValue={user.dob || ''} type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 text-sm outline-none focus:border-blue-500 focus:bg-white" />
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                       <button type="button" onClick={() => setIsProfileModalOpen(false)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg transition-colors">
                          Hủy
                       </button>
                       <button type="submit" disabled={isUpdatingProfile} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors flex justify-center items-center gap-2">
                          {isUpdatingProfile ? <Loader2 size={16} className="animate-spin" /> : 'Cập nhật'}
                       </button>
                    </div>
                 </form>
                 <div className="border-t border-slate-200 p-2">
                    <button onClick={handleLogout} className="w-full py-2 flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 text-sm font-bold rounded-lg transition-colors">
                       <LogOut size={16} /> Đăng xuất
                    </button>
                 </div>
              </div>
            )}
            
            {/* Backdrop for modal */}
            {isProfileModalOpen && (
              <div className="fixed inset-0 z-40" onClick={() => setIsProfileModalOpen(false)}></div>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <nav className="fixed left-0 h-full w-64 pt-20 pb-6 px-4 bg-white border-r border-slate-200 hidden md:flex flex-col z-40">
        <div className={`mb-6 px-2 py-4 rounded-xl border flex items-center gap-3 ${user.role === 'admin' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-md ${user.role === 'admin' ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/20' : 'bg-gradient-to-br from-indigo-500 to-blue-600 shadow-blue-500/20'}`}>
              <ShieldCheck className="text-white" size={20} />
            </div>
            <div>
              <h3 className="text-[13px] font-bold text-slate-800 leading-tight">
                {user.role === 'admin' ? 'Quản trị viên' : 'Giáo viên'}
              </h3>
              <p className="text-[10px] text-green-600 uppercase tracking-widest font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Đã xác thực
              </p>
            </div>
        </div>

        <div className="space-y-2 flex-1">
          <button onClick={() => setActiveTab('CLASS_STUDENTS')} className={navItemClass('CLASS_STUDENTS')}>
            <Users size={18} className={activeTab === 'CLASS_STUDENTS' ? 'text-blue-600' : ''} />
            Quản lý Lớp & HS
          </button>
          <button onClick={() => setActiveTab('QUIZ')} className={navItemClass('QUIZ')}>
            <FileText size={18} className={activeTab === 'QUIZ' ? 'text-blue-600' : ''} />
            Quản lý Kỳ thi
          </button>
          
          {user.role === 'admin' && (
              <button onClick={() => setActiveTab('USER_MANAGEMENT')} className={navItemClass('USER_MANAGEMENT')}>
                <ShieldCheck size={18} className={activeTab === 'USER_MANAGEMENT' ? 'text-blue-600' : ''} />
                Quản lý Người dùng
              </button>
          )}

          <button onClick={() => setActiveTab('SETTINGS')} className={navItemClass('SETTINGS')}>
            <Settings size={18} className={activeTab === 'SETTINGS' ? 'text-blue-600' : ''} />
            Cài đặt
          </button>
        </div>

        <div className="mt-auto space-y-2 border-t border-slate-100 pt-6">
          <button className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors font-medium text-sm w-full text-left">
            <HelpCircle size={18} />
            Trung tâm hỗ trợ
          </button>
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors font-bold text-sm w-full text-left">
            <LogOut size={18} />
            Đăng xuất
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className={`md:ml-64 pt-20 pb-12 px-6 lg:px-8 min-h-screen flex flex-col`}>
        {renderContent()}
      </main>
    </div>
  );
}