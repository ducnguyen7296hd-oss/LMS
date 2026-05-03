import React, { useState, useEffect } from 'react';
import { Users, UserPlus, BookOpen, Trash2, Edit, Save, PlusCircle, Link, RefreshCcw, Download, Upload, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { User } from './App';

export interface Student {
    id: string;
    fullName: string;
    dob: string;
    parentPhone: string;
    address: string;
}

export interface ClassData {
    id: string;
    className: string;
    students: Student[];
}

const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('T')) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        }
    } else if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }
    return dateStr;
};

const formatDateInput = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('T')) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
    }
    return dateStr;
};

const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL;

// Dữ liệu mẫu ban đầu
const initialClasses: ClassData[] = [];

export default function ClassManagement({ user }: { user: User }) {
    const [classes, setClasses] = useState<ClassData[]>(() => {
        const saved = localStorage.getItem(`edutest_classes_${user.email}`);
        return saved ? JSON.parse(saved) : initialClasses;
    });

    const [activeClassId, setActiveClassId] = useState<string | null>(classes.length > 0 ? classes[0].id : null);
    
    // State for editing student
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [isAddingStudent, setIsAddingStudent] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    
    // State cho thêm lớp
    const [isAddingClass, setIsAddingClass] = useState(false);
    const [newClassName, setNewClassName] = useState('');

    const isFetchingRef = React.useRef(false);
    const isInitialMount = React.useRef(true);

    useEffect(() => {
        localStorage.setItem(`edutest_classes_${user.email}`, JSON.stringify(classes));

        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        if (isFetchingRef.current) {
            isFetchingRef.current = false;
            return;
        }

        // Auto-sync khi có thay đổi
        if (ADMIN_API_URL) {
            syncToGoogleSheets(classes, true);
        }
    }, [classes, user.email]);

    useEffect(() => {
        // Auto-fetch khi mở trang
        if (ADMIN_API_URL) {
            fetchFromGoogleSheets(true);
        }
    }, [user.email]); // Trigger again if user changes

    const activeClass = classes.find(c => c.id === activeClassId);

    // Xử lý Excel
    const downloadTemplate = () => {
        const templateData = [
            ["Mã Lớp", "Tên Lớp", "Mã Học Sinh", "Họ và Tên", "Ngày Sinh (DD/MM/YYYY)", "SĐT Phụ Huynh", "Địa Chỉ"],
            ["1", "12A1", "s1", "Nguyễn Văn A", "12/05/2006", "0901234567", "Hà Nội"],
            ["1", "12A1", "s2", "Trần Thị B", "22/08/2006", "0912345678", "Hải Phòng"],
            ["2", "10A2", "s3", "Lê Hoàng C", "15/01/2008", "0987654321", "Đà Nẵng"],
        ];
        const ws = XLSX.utils.aoa_to_sheet(templateData);
        ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 22 }, { wch: 15 }, { wch: 30 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DanhSachHocSinh");
        XLSX.writeFile(wb, "Mau_Danh_Sach_Hoc_Sinh.xlsx");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                // Data starts from index 1 (skipping header)
                const rows = data.slice(1);
                const newClassesMap: Record<string, ClassData> = {};

                rows.forEach(row => {
                    const classId = row[0] ? String(row[0]).trim() : '';
                    const className = row[1] ? String(row[1]).trim() : '';
                    if (!classId) return;

                    if (!newClassesMap[classId]) {
                        newClassesMap[classId] = {
                            id: classId,
                            className: className,
                            students: []
                        };
                    }

                    const studentId = row[2] ? String(row[2]).trim() : '';
                    if (studentId) {
                        let dob = row[4] ? String(row[4]).trim() : '';
                        if (row[4] instanceof Date) {
                            const date = row[4];
                            dob = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                        } else if (dob.includes('/')) {
                            const parts = dob.split('/');
                            if (parts.length === 3) dob = `${parts[2]}-${parts[1]}-${parts[0]}`;
                        }

                        newClassesMap[classId].students.push({
                            id: studentId,
                            fullName: row[3] ? String(row[3]).trim() : '',
                            dob: dob,
                            parentPhone: row[5] ? String(row[5]).trim() : '',
                            address: row[6] ? String(row[6]).trim() : ''
                        });
                    }
                });

                const importedClasses = Object.values(newClassesMap);
                if (importedClasses.length > 0) {
                    setClasses(importedClasses);
                    setActiveClassId(importedClasses[0].id);
                    alert(`Nhập thành công ${importedClasses.length} lớp từ file Excel!`);
                } else {
                    alert('Không tìm thấy dữ liệu hợp lệ trong file!');
                }
            } catch (error) {
                console.error(error);
                alert('Có lỗi xảy ra khi đọc file Excel!');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const syncToGoogleSheets = async (dataToSync: ClassData[] = classes, isAuto: boolean = false) => {
        if (!ADMIN_API_URL || ADMIN_API_URL.includes('YOUR_APPS_SCRIPT_WEB_APP_URL_HERE')) {
            if (!isAuto) alert('Chưa cấu hình máy chủ đồng bộ!');
            return;
        }

        setIsSyncing(true);
        try {
            const response = await fetch(`${ADMIN_API_URL}?action=sync_students&email=${encodeURIComponent(user.email)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ classes: dataToSync })
            });

            const result = await response.json();

            if (!isAuto) {
                if (result.status === 'success') {
                    alert('Đồng bộ lên Cloud thành công!');
                } else {
                    alert('Lỗi: ' + (result.message || 'Không thể đồng bộ.'));
                }
            }
        } catch (error) {
            console.error('Sync Error:', error);
            if (!isAuto) alert('Lỗi kết nối máy chủ. Không thể đồng bộ.');
        } finally {
            setIsSyncing(false);
        }
    };

    const fetchFromGoogleSheets = async (isAuto: boolean = false) => {
        if (!ADMIN_API_URL || ADMIN_API_URL.includes('YOUR_APPS_SCRIPT_WEB_APP_URL_HERE')) {
            return;
        }

        setIsSyncing(true);
        try {
            const response = await fetch(`${ADMIN_API_URL}?action=get_classes&email=${encodeURIComponent(user.email)}`);
            const result = await response.json();
            
            if (result.status === 'success') {
                const fetchedClasses = result.data || result.classes || [];
                isFetchingRef.current = true;
                setClasses(fetchedClasses);
                setActiveClassId(prevId => {
                    if (prevId && fetchedClasses.some((c: any) => c.id === prevId)) {
                        return prevId;
                    }
                    return fetchedClasses.length > 0 ? fetchedClasses[0].id : null;
                });
                if (!isAuto && fetchedClasses.length > 0) alert('Tải dữ liệu từ máy chủ thành công!');
            } else {
                if (!isAuto) alert('Lỗi tải dữ liệu: ' + result.message);
            }
        } catch (error) {
            console.error('Fetch Error:', error);
            if (!isAuto) alert('Lỗi kết nối. Không thể tải dữ liệu.');
        } finally {
            setIsSyncing(false);
        }
    };

    // Xử lý Lớp
    const handleAddClassSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newClassName.trim() !== '') {
            const newClass: ClassData = {
                id: Date.now().toString(),
                className: newClassName.trim(),
                students: []
            };
            setClasses([...classes, newClass]);
            setActiveClassId(newClass.id);
            setIsAddingClass(false);
            setNewClassName('');
        }
    };

    const deleteClass = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newClasses = classes.filter(c => c.id !== id);
        setClasses(newClasses);
        if (activeClassId === id) {
            setActiveClassId(newClasses.length > 0 ? newClasses[0].id : null);
        }
    };

    // Xử lý Học sinh
    const saveStudent = (student: Student) => {
        if (!activeClassId) return;

        setClasses(prev => prev.map(c => {
            if (c.id === activeClassId) {
                const existingIndex = c.students.findIndex(s => s.id === student.id);
                if (existingIndex >= 0) {
                    // Update
                    const updatedStudents = [...c.students];
                    updatedStudents[existingIndex] = student;
                    return { ...c, students: updatedStudents };
                } else {
                    // Add
                    return { ...c, students: [...c.students, student] };
                }
            }
            return c;
        }));
        setEditingStudent(null);
        setIsAddingStudent(false);
    };

    const deleteStudent = (studentId: string) => {
        if (!activeClassId) return;
        setClasses(prev => prev.map(c => {
            if (c.id === activeClassId) {
                return { ...c, students: c.students.filter(s => s.id !== studentId) };
            }
            return c;
        }));
    };

    return (
        <div className="max-w-7xl mx-auto w-full h-[calc(100vh-120px)] flex flex-col relative">
            {/* Modal Thêm Lớp */}
            {isAddingClass && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><BookOpen className="text-blue-600" size={24}/> Thêm Lớp Mới</h3>
                            <button onClick={() => setIsAddingClass(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors">
                                <span className="font-bold text-lg leading-none">&times;</span>
                            </button>
                        </div>
                        <form onSubmit={handleAddClassSubmit} className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Tên Lớp *</label>
                                <input 
                                    autoFocus
                                    type="text" 
                                    value={newClassName} 
                                    onChange={e => setNewClassName(e.target.value)}
                                    placeholder="VD: Toán 9A"
                                    className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsAddingClass(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">Hủy</button>
                                <button type="submit" disabled={!newClassName.trim()} className="px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-md shadow-blue-600/20">Thêm Lớp</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="mb-6 flex justify-between items-end shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <Users className="text-blue-600" size={32} /> Lớp học & Học sinh
                    </h1>
                    <p className="text-slate-500 mt-2 text-sm">Quản lý danh sách lớp, hồ sơ học sinh và đồng bộ dữ liệu.</p>
                </div>

                <div className="flex gap-4">
                    {/* Excel Widget */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm w-72">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                            <FileSpreadsheet size={14} /> Nhập từ Excel
                        </span>
                        <div className="flex gap-2">
                            <button onClick={downloadTemplate} className="flex-1 text-xs bg-slate-50 text-slate-700 font-semibold px-2 py-2 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center gap-1 transition-colors">
                                <Download size={14} /> File mẫu
                            </button>
                            <label className="flex-1 text-xs bg-emerald-50 text-emerald-700 font-semibold px-2 py-2 rounded border border-emerald-200 hover:bg-emerald-100 flex items-center justify-center gap-1 transition-colors cursor-pointer">
                                <Upload size={14} /> Tải lên
                                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                            </label>
                        </div>
                    </div>

                    {/* Cloud Sync Widget */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm w-64 relative overflow-hidden">
                        {ADMIN_API_URL && !ADMIN_API_URL.includes('YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') && (
                            <div className="absolute top-0 right-0 bg-green-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg tracking-wider">
                                AUTO SYNC BẬT
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                <Link size={14} /> Đồng bộ Cloud
                                {isSyncing && <RefreshCcw size={12} className="animate-spin text-blue-500" />}
                            </span>
                        </div>
                        <button 
                            onClick={() => fetchFromGoogleSheets(false)} 
                            disabled={isSyncing || !ADMIN_API_URL || ADMIN_API_URL.includes('YOUR_APPS_SCRIPT')}
                            className="w-full text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-3 py-2 rounded-lg flex justify-center items-center gap-2 transition-colors border border-blue-200 disabled:opacity-50"
                        >
                            <RefreshCcw size={14} className={isSyncing ? "animate-spin" : ""} />
                            {isSyncing ? 'Đang đồng bộ...' : 'Tải lại dữ liệu Cloud'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area: 2 Columns */}
            <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex min-h-0">

                {/* Left Column: Classes */}
                <div className="w-64 border-r border-slate-200 bg-slate-50 flex flex-col">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
                        <span className="font-bold text-slate-800">Danh sách Lớp</span>
                        <button disabled={isSyncing} onClick={() => setIsAddingClass(true)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors disabled:opacity-50" title="Thêm lớp mới">
                            <PlusCircle size={20} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {classes.map(c => (
                            <div
                                key={c.id}
                                onClick={() => { setActiveClassId(c.id); setIsAddingStudent(false); setEditingStudent(null); }}
                                className={`flex justify-between items-center px-4 py-3 rounded-xl cursor-pointer transition-all border ${activeClassId === c.id ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:shadow-sm'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <BookOpen size={16} className={activeClassId === c.id ? 'text-blue-200' : 'text-slate-400'} />
                                    <span className="font-bold">{c.className}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${activeClassId === c.id ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{c.students.length}</span>
                                    <button onClick={(e) => deleteClass(c.id, e)} className={`p-1 rounded opacity-50 hover:opacity-100 transition-opacity ${activeClassId === c.id ? 'text-white hover:bg-blue-700' : 'text-red-500 hover:bg-red-50'}`} title="Xóa lớp">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {classes.length === 0 && (
                            <div className="text-center p-6 text-slate-400 text-sm">Chưa có lớp nào.</div>
                        )}
                    </div>
                </div>

                {/* Right Column: Students */}
                <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
                    {activeClass ? (
                        <>
                            <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Lớp {activeClass.className}</h2>
                                    <p className="text-sm text-slate-500">Tổng số: {activeClass.students.length} học sinh</p>
                                </div>
                                <button onClick={() => { setIsAddingStudent(true); setEditingStudent(null); }} className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors border border-blue-200">
                                    <UserPlus size={18} /> Thêm Học sinh
                                </button>
                            </div>

                            <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
                                {isAddingStudent || editingStudent ? (
                                    <StudentForm
                                        initialData={editingStudent}
                                        onSave={saveStudent}
                                        onCancel={() => { setIsAddingStudent(false); setEditingStudent(null); }}
                                    />
                                ) : (
                                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] uppercase tracking-wider font-bold">
                                                    <th className="px-4 py-3 text-center w-12">STT</th>
                                                    <th className="px-4 py-3">Họ và Tên</th>
                                                    <th className="px-4 py-3 w-32">Ngày sinh</th>
                                                    <th className="px-4 py-3 w-36">SĐT Phụ huynh</th>
                                                    <th className="px-4 py-3">Địa chỉ</th>
                                                    <th className="px-4 py-3 w-24 text-center">Thao tác</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {activeClass.students.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="text-center py-10 text-slate-400">Chưa có học sinh nào trong lớp.</td>
                                                    </tr>
                                                ) : (
                                                    activeClass.students.map((student, idx) => (
                                                        <tr key={student.id} className="hover:bg-blue-50/30 transition-colors group">
                                                            <td className="px-4 py-4 text-center text-slate-500 font-medium text-sm">{idx + 1}</td>
                                                            <td className="px-4 py-4 font-bold text-slate-800">{student.fullName}</td>
                                                            <td className="px-4 py-4 text-slate-600 text-sm">
                                                                {formatDateDisplay(student.dob)}
                                                            </td>
                                                            <td className="px-4 py-4 text-slate-600 text-sm font-medium">{student.parentPhone}</td>
                                                            <td className="px-4 py-4 text-slate-600 text-sm truncate max-w-[200px]" title={student.address}>{student.address}</td>
                                                            <td className="px-4 py-4 text-center">
                                                                <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={() => setEditingStudent(student)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors" title="Sửa">
                                                                        <Edit size={16} />
                                                                    </button>
                                                                    <button onClick={() => deleteStudent(student.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Xóa">
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                            <BookOpen size={64} className="text-slate-300 mb-4" />
                            <p className="text-lg font-medium text-slate-500">Vui lòng chọn một lớp hoặc thêm lớp mới</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StudentForm({ initialData, onSave, onCancel }: { initialData: Student | null, onSave: (s: Student) => void, onCancel: () => void }) {
    const [formData, setFormData] = useState<Student>(initialData || {
        id: Date.now().toString(),
        fullName: '',
        dob: '',
        parentPhone: '',
        address: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.fullName) return alert('Vui lòng nhập họ tên!');
        onSave(formData);
    };

    return (
        <div className="max-w-2xl bg-white border border-slate-200 rounded-xl p-6 shadow-sm mx-auto mt-4">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                {initialData ? <Edit className="text-blue-600" size={20} /> : <UserPlus className="text-blue-600" size={20} />}
                {initialData ? 'Sửa thông tin Học sinh' : 'Thêm Học sinh mới'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Họ và Tên *</label>
                        <input autoFocus required type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-800" placeholder="VD: Nguyễn Văn A" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ngày sinh</label>
                        <input type="date" value={formatDateInput(formData.dob)} onChange={e => setFormData({ ...formData, dob: e.target.value })} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-800" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SĐT Phụ huynh</label>
                        <input type="text" value={formData.parentPhone} onChange={e => setFormData({ ...formData, parentPhone: e.target.value })} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-800" placeholder="VD: 0987..." />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Địa chỉ</label>
                        <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-800" placeholder="Số nhà, Quận/Huyện..." />
                    </div>
                </div>

                <div className="pt-5 mt-6 border-t border-slate-100 flex justify-end gap-3">
                    <button type="button" onClick={onCancel} className="px-6 py-2.5 rounded-lg font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                        Hủy
                    </button>
                    <button type="submit" className="px-6 py-2.5 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-600/20">
                        <Save size={18} /> Lưu thông tin
                    </button>
                </div>
            </form>
        </div>
    );
}
