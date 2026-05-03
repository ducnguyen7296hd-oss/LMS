import React, { useState, ChangeEvent, useEffect } from 'react';
import SplitPane from './SplitPane';

type ExamState = 'DASHBOARD' | 'SETUP_KEY' | 'QUIZ' | 'RESULT' | 'VIEW_RESULTS';

export interface AnswerKey {
    part1: { [key: number]: string };
    part2: { [key: number]: { a: boolean; b: boolean; c: boolean; d: boolean } };
    part3: { [key: number]: string };
    part4: { [key: number]: number }; // Max points
}

export interface ExamVersion {
    id: string; // Internal ID for version
    code: string; // Mã đề (VD: 101, 102)
    pdfUrl: string;
    pdfName: string;
    answerKey: AnswerKey;
}

export interface ExamConfig {
    internalId: string;
    id: string; // STT
    examCode: string; // Mã bài thi (Global)
    subject: string;
    className: string;
    examName: string;
    startTime: string;
    endTime: string;
    part1Count: number;
    part2Count: number;
    part3Count: number;
    part4Count: number;
    part1Points: number;
    part2Points: number;
    part3Points: number;
    versions: ExamVersion[];
    activeVersionId: string; // Mã đề đang được chỉnh sửa trong Setup Key
    antiCheatEnabled?: boolean; // Bật/tắt giám sát
}

export interface Answers {
    part1: { [key: number]: string };
    part2: { [key: number]: { a?: boolean; b?: boolean; c?: boolean; d?: boolean } };
    part3: { [key: number]: string };
    part4: { [key: number]: string[] };
}
import { User } from './App';
import { supabase } from './lib/supabase';
import { CustomPdfViewer } from './components/CustomPdfViewer';

const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL;

const OnlineQuiz: React.FC<{ user: User }> = ({ user }) => {
    const [state, setState] = useState<ExamState>('DASHBOARD');
    const [exams, setExams] = useState<ExamConfig[]>(() => {
        const saved = localStorage.getItem(`edutest_exams_${user.email}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.map((e: any) => ({
                    ...e,
                    internalId: e.internalId || (Date.now().toString() + Math.random().toString())
                }));
            } catch (err) { }
        }
        return [];
    });
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [currentExamId, setCurrentExamId] = useState<string | null>(null);
    const [currentStudentVersionId, setCurrentStudentVersionId] = useState<string | null>(null); // Mã đề ngẫu nhiên sinh viên làm
    const [studentAnswers, setStudentAnswers] = useState<Answers>({ part1: {}, part2: {}, part3: {}, part4: {} });
    const [isUploadingPdf, setIsUploadingPdf] = useState(false);
    const [isSyncingExams, setIsSyncingExams] = useState(false);

    interface ExamResult {
        studentId: string;
        studentName: string;
        versionCode: string;
        score: number;
        submittedAt: string;
    }
    const [examResults, setExamResults] = useState<ExamResult[]>([]);
    const [isLoadingResults, setIsLoadingResults] = useState(false);

    const openResults = async (internalId: string) => {
        setCurrentExamId(internalId);
        setState('VIEW_RESULTS');
        const exam = exams.find(e => e.internalId === internalId);
        if (exam && ADMIN_API_URL) {
            setIsLoadingResults(true);
            try {
                const res = await fetch(`${ADMIN_API_URL}?action=get_results&examId=${encodeURIComponent(exam.examCode || exam.id)}`);
                const data = await res.json();
                if (data.status === 'success') {
                    setExamResults(data.results || []);
                } else {
                    setExamResults([]);
                }
            } catch (err) {
                console.error("Lỗi tải kết quả", err);
                setExamResults([]);
            } finally {
                setIsLoadingResults(false);
            }
        }
    };

    // UI state for Setup Key
    const [activeTab, setActiveTab] = useState<'p1' | 'p2' | 'p3' | 'p4'>('p1');

    // UI state for Quiz
    const [quizActiveTab, setQuizActiveTab] = useState<'p1' | 'p2' | 'p3' | 'p4'>('p1');
    const [quizActiveQ, setQuizActiveQ] = useState<number>(1);
    const [quizTimeLeft, setQuizTimeLeft] = useState<number>(45 * 60);

    const [availableClasses, setAvailableClasses] = useState<{ id: string, className: string }[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem(`edutest_classes_${user.email}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setAvailableClasses(parsed);
            } catch (e) { }
        }
    }, [user.email]);

    // Persist exams
    useEffect(() => {
        if (exams.length > 0) {
            localStorage.setItem(`edutest_exams_${user.email}`, JSON.stringify(exams));
        }
    }, [exams, user.email]);

    // Timer Effect for Quiz
    useEffect(() => {
        if (state === 'QUIZ' && quizTimeLeft > 0) {
            const timer = setInterval(() => {
                setQuizTimeLeft(prev => prev - 1);
            }, 1000);
            return () => clearInterval(timer);
        } else if (state === 'QUIZ' && quizTimeLeft === 0) {
            setState('RESULT');
            alert("Đã hết giờ làm bài! Hệ thống tự động nộp bài.");
        }
    }, [state, quizTimeLeft]);

    // Format time (MM:SS)
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')} : ${String(s).padStart(2, '0')}`;
    };

    const getExamStatus = (exam: ExamConfig) => {
        const now = new Date().getTime();
        const start = new Date(exam.startTime).getTime();
        const end = new Date(exam.endTime).getTime();

        if (!exam.startTime || !exam.endTime || isNaN(start) || isNaN(end)) {
            return { text: 'Chưa xếp lịch', color: 'bg-slate-100 text-slate-500' };
        }

        if (now < start) return { text: 'Sắp diễn ra', color: 'bg-amber-50 text-amber-600 border-amber-200' };
        if (now >= start && now <= end) return { text: 'Đang diễn ra', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
        return { text: 'Đã kết thúc', color: 'bg-rose-50 text-rose-600 border-rose-200' };
    };

    // ============== DASHBOARD XỬ LÝ ==============
    const syncExamsToCloud = async () => {
        if (!ADMIN_API_URL) {
            alert('Chưa cấu hình API URL'); return;
        }
        setIsSyncingExams(true);
        try {
            const payload = exams.map(ex => ({
                id: ex.id,
                examName: ex.examName,
                classes: [ex.className],
                examDate: ex.startTime ? new Date(ex.startTime).toLocaleString('vi-VN') : '',
                duration: (() => {
                    const s = new Date(ex.startTime).getTime();
                    const e = new Date(ex.endTime).getTime();
                    if (!isNaN(s) && !isNaN(e) && e > s) return Math.floor((e - s) / 60000);
                    return 45;
                })(),
                status: getExamStatus(ex).text,
                config: {
                    examCode: ex.examCode,
                    subject: ex.subject,
                    part1Count: ex.part1Count,
                    part2Count: ex.part2Count,
                    part3Count: ex.part3Count,
                    part4Count: ex.part4Count,
                    part1Points: ex.part1Points,
                    part2Points: ex.part2Points,
                    part3Points: ex.part3Points,
                    antiCheatEnabled: ex.antiCheatEnabled,
                    startTime: ex.startTime,
                    endTime: ex.endTime
                },
                versions: ex.versions,
                createdAt: new Date().toISOString()
            }));

            const res = await fetch(`${ADMIN_API_URL}?action=sync_quizzes`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ email: user.email, quizzes: payload })
            });
            const result = await res.json();
            if (result.status === 'success') {
                alert('Đồng bộ danh sách bài thi lên Server thành công!');
            } else {
                alert('Lỗi đồng bộ: ' + result.message);
            }
        } catch (err: any) {
            alert('Lỗi mạng khi đồng bộ: ' + err.message);
        } finally {
            setIsSyncingExams(false);
        }
    };

    const addExam = () => {
        const initialVersionId = Date.now().toString();
        const newExam: ExamConfig = {
            internalId: Date.now().toString() + "_exam",
            id: (exams.length + 1).toString(),
            examCode: '',
            subject: '',
            className: '',
            examName: '',
            startTime: '',
            endTime: '',
            part1Count: 40,
            part2Count: 8,
            part3Count: 6,
            part4Count: 0,
            part1Points: 0.25,
            part2Points: 1.0,
            part3Points: 0.5,
            versions: [{
                id: initialVersionId,
                code: '101',
                pdfUrl: '',
                pdfName: '',
                answerKey: { part1: {}, part2: {}, part3: {}, part4: {} }
            }],
            activeVersionId: initialVersionId,
            antiCheatEnabled: true
        };
        setExams([...exams, newExam]);
    };

    const updateExamField = (internalId: string, field: keyof ExamConfig, value: any) => {
        setExams(prev => prev.map(e => e.internalId === internalId ? { ...e, [field]: value } : e));
    };

    const deleteExam = (internalId: string) => {
        setExams(prev => prev.filter(e => e.internalId !== internalId));
        setConfirmDeleteId(null);
    };

    const openSetupKey = (internalId: string) => {
        setCurrentExamId(internalId);
        setState('SETUP_KEY');
        const exam = exams.find(e => e.internalId === internalId);
        if (exam) {
            if (exam.part1Count > 0) setActiveTab('p1');
            else if (exam.part2Count > 0) setActiveTab('p2');
            else if (exam.part3Count > 0) setActiveTab('p3');
            else if (exam.part4Count > 0) setActiveTab('p4');
        }
    };

    // ============== SETUP KEY XỬ LÝ ==============
    const currentExam = exams.find(e => e.internalId === currentExamId);
    const activeVersion = currentExam?.versions.find(v => v.id === currentExam.activeVersionId) || currentExam?.versions[0];

    const handlePdfUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf' && currentExamId && activeVersion) {
            alert(`Bắt đầu tải tệp: ${file.name} lên Supabase...`);
            setIsUploadingPdf(true);
            try {
                if (!supabase) {
                    alert('LỖI: Chưa cấu hình Supabase hợp lệ trong file .env');
                    setIsUploadingPdf(false);
                    return;
                }

                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}-${Date.now()}.${fileExt}`;
                const filePath = `${fileName}`;

                const { data, error } = await supabase.storage
                    .from('pdfs')
                    .upload(filePath, file, { contentType: 'application/pdf' });

                if (error) {
                    alert('Lỗi khi tải PDF lên Supabase: ' + error.message + '\nKiểm tra xem bạn đã tạo bucket tên "pdfs" và cấu hình Public chưa!');
                    setIsUploadingPdf(false);
                    return;
                }

                const { data: publicURLData } = supabase.storage
                    .from('pdfs')
                    .getPublicUrl(filePath);

                const url = publicURLData.publicUrl;

                alert(`Thành công! Tệp đã được lưu.\nMã file: ${fileName}`);
                setExams(prev => prev.map(ex => {
                    if (ex.internalId !== currentExamId) return ex;
                    return {
                        ...ex,
                        versions: ex.versions.map(v => v.id === activeVersion.id ? { ...v, pdfUrl: url, pdfName: file.name } : v)
                    };
                }));
                setIsUploadingPdf(false);
            } catch (err: any) {
                console.error("Lỗi tải lên PDF Supabase", err);
                alert('Có lỗi phần mềm khi gửi tệp lên Supabase: ' + err.message);
                setIsUploadingPdf(false);
            }
        } else {
            alert('Vui lòng chọn một tệp PDF hợp lệ.');
        }
        e.target.value = '';
    };

    const updateKey = (part: keyof AnswerKey, qNum: number, field: string | null, val: any) => {
        if (!currentExamId || !currentExam || !activeVersion) return;
        const newKey = { ...activeVersion.answerKey };

        if (part === 'part2' && field) {
            newKey.part2 = { ...newKey.part2, [qNum]: { ...newKey.part2[qNum], [field]: val } };
        } else if (part === 'part4') {
            newKey.part4 = { ...newKey.part4, [qNum]: val };
        } else if (part === 'part1' || part === 'part3') {
            const p = newKey[part] as any;
            p[qNum] = val;
        }

        setExams(prev => prev.map(ex => {
            if (ex.internalId !== currentExamId) return ex;
            return {
                ...ex,
                versions: ex.versions.map(v => v.id === activeVersion.id ? { ...v, answerKey: newKey } : v)
            };
        }));
    };

    const addExamVersion = () => {
        if (!currentExam) return;
        const newVersionId = Date.now().toString() + Math.random().toString();
        const newCode = (currentExam.versions.length + 101).toString();
        setExams(prev => prev.map(ex => {
            if (ex.internalId !== currentExam.internalId) return ex;
            return {
                ...ex,
                activeVersionId: newVersionId,
                versions: [...ex.versions, {
                    id: newVersionId,
                    code: newCode,
                    pdfUrl: '',
                    pdfName: '',
                    answerKey: { part1: {}, part2: {}, part3: {}, part4: {} }
                }]
            };
        }));
    };

    const switchExamVersion = (versionId: string) => {
        if (!currentExam) return;
        updateExamField(currentExam.internalId, 'activeVersionId', versionId);
    };

    const deleteExamVersion = (versionId: string) => {
        if (!currentExam || currentExam.versions.length <= 1) {
            alert('Bài thi phải có ít nhất 1 mã đề!');
            return;
        }
        
        setExams(prev => prev.map(ex => {
            if (ex.internalId !== currentExam.internalId) return ex;
            const newVersions = ex.versions.filter(v => v.id !== versionId);
            return {
                ...ex,
                versions: newVersions,
                activeVersionId: ex.activeVersionId === versionId ? newVersions[0].id : ex.activeVersionId
            };
        }));
    };


    const goToQuiz = () => {
        if (!currentExam || currentExam.versions.length === 0) return;

        // Randomly pick an exam version
        const randomVersion = currentExam.versions[Math.floor(Math.random() * currentExam.versions.length)];

        if (!randomVersion.pdfUrl) {
            alert(`Mã đề ${randomVersion.code} chưa có tệp PDF đề thi! Vui lòng báo Giám thị.`);
            return;
        }

        setCurrentStudentVersionId(randomVersion.id);
        setStudentAnswers({ part1: {}, part2: {}, part3: {}, part4: {} });

        let startPart: 'p1' | 'p2' | 'p3' | 'p4' = 'p1';
        if (currentExam.part1Count > 0) startPart = 'p1';
        else if (currentExam.part2Count > 0) startPart = 'p2';
        else if (currentExam.part3Count > 0) startPart = 'p3';
        else if (currentExam.part4Count > 0) startPart = 'p4';

        let duration = 45 * 60;
        const start = new Date(currentExam.startTime).getTime();
        const end = new Date(currentExam.endTime).getTime();
        if (!isNaN(start) && !isNaN(end) && end > start) {
            duration = Math.floor((end - start) / 1000);
        }

        setQuizActiveTab(startPart);
        setQuizActiveQ(0);
        setQuizTimeLeft(duration);
        setState('QUIZ');
    };

    // ============== STUDENT XỬ LÝ ==============
    const updateAnsPart1 = (q: number, ans: string) => setStudentAnswers(prev => ({ ...prev, part1: { ...prev.part1, [q]: ans } }));
    const updateAnsPart2 = (q: number, sub: 'a' | 'b' | 'c' | 'd', val: boolean) => setStudentAnswers(prev => ({ ...prev, part2: { ...prev.part2, [q]: { ...(prev.part2[q] || {}), [sub]: val } } }));
    const updateAnsPart3 = (q: number, text: string) => setStudentAnswers(prev => ({ ...prev, part3: { ...prev.part3, [q]: text } }));
    const updateAnsPart4 = (q: number, e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        const newUrls = Array.from(files).map((f: File) => URL.createObjectURL(f));
        setStudentAnswers(prev => ({ ...prev, part4: { ...prev.part4, [q]: [...(prev.part4[q] || []), ...newUrls] } }));
        e.target.value = '';
    };
    const removePart4Image = (q: number, index: number) => {
        setStudentAnswers(prev => {
            const current = [...(prev.part4[q] || [])];
            URL.revokeObjectURL(current[index]);
            current.splice(index, 1);
            return { ...prev, part4: { ...prev.part4, [q]: current } };
        });
    };

    const quizNextQuestion = () => {
        let maxQ = 0;
        if (quizActiveTab === 'p1') maxQ = currentExam?.part1Count || 0;
        else if (quizActiveTab === 'p2') maxQ = currentExam?.part2Count || 0;
        else if (quizActiveTab === 'p3') maxQ = currentExam?.part3Count || 0;
        else if (quizActiveTab === 'p4') maxQ = currentExam?.part4Count || 0;

        if (quizActiveQ < maxQ) {
            setQuizActiveQ(prev => prev + 1);
        } else {
            // Chuyển tab nếu hết câu
            if (quizActiveTab === 'p1' && (currentExam?.part2Count || 0) > 0) { setQuizActiveTab('p2'); setQuizActiveQ(1); }
            else if ((quizActiveTab === 'p1' || quizActiveTab === 'p2') && (currentExam?.part3Count || 0) > 0) { setQuizActiveTab('p3'); setQuizActiveQ(1); }
            else if ((quizActiveTab === 'p1' || quizActiveTab === 'p2' || quizActiveTab === 'p3') && (currentExam?.part4Count || 0) > 0) { setQuizActiveTab('p4'); setQuizActiveQ(1); }
        }
    };

    const quizPrevQuestion = () => {
        if (quizActiveQ > 1) {
            setQuizActiveQ(prev => prev - 1);
        } else {
            // Lùi tab
            if (quizActiveTab === 'p4' && (currentExam?.part3Count || 0) > 0) { setQuizActiveTab('p3'); setQuizActiveQ(currentExam!.part3Count); }
            else if ((quizActiveTab === 'p4' || quizActiveTab === 'p3') && (currentExam?.part2Count || 0) > 0) { setQuizActiveTab('p2'); setQuizActiveQ(currentExam!.part2Count); }
            else if ((quizActiveTab === 'p4' || quizActiveTab === 'p3' || quizActiveTab === 'p2') && (currentExam?.part1Count || 0) > 0) { setQuizActiveTab('p1'); setQuizActiveQ(currentExam!.part1Count); }
        }
    };

    const isQuestionAnswered = (tab: string, q: number) => {
        if (tab === 'p1') return studentAnswers.part1[q] !== undefined;
        if (tab === 'p2') {
            const ans = studentAnswers.part2[q];
            return ans && (ans.a !== undefined || ans.b !== undefined || ans.c !== undefined || ans.d !== undefined);
        }
        if (tab === 'p3') return (studentAnswers.part3[q] || '').trim() !== '';
        if (tab === 'p4') return (studentAnswers.part4[q] || []).length > 0;
        return false;
    };


    // ============== RENDER DASHBOARD ==============
    if (state === 'DASHBOARD') {
        return (
            <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Quản lý Bài thi Trực tuyến</h1>
                            <p className="text-slate-500 mt-2 text-sm">Thiết lập và theo dõi trạng thái các bài thi theo môn và lớp.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={syncExamsToCloud} disabled={isSyncingExams} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-5 rounded-lg shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50">
                                <span className={`material-symbols-outlined text-[20px] ${isSyncingExams ? 'animate-spin' : ''}`}>sync</span> {isSyncingExams ? 'Đang đồng bộ...' : 'Đồng bộ Server'}
                            </button>
                            <button onClick={addExam} className="bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 px-5 rounded-lg shadow-sm flex items-center gap-2 transition-colors">
                                <span className="material-symbols-outlined text-[20px]">add_circle</span> Thêm bài thi
                            </button>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-bold">
                                        <th className="p-4 w-16 text-center">STT</th>
                                        <th className="p-4 w-32">Mã bài thi</th>
                                        <th className="p-4 w-32">Môn học</th>
                                        <th className="p-4 w-32">Lớp</th>
                                        <th className="p-4 min-w-[200px]">Tên bài thi</th>
                                        <th className="p-4 w-48">Hẹn giờ bắt đầu</th>
                                        <th className="p-4 w-48">Hẹn giờ kết thúc</th>
                                        <th className="p-4 w-28 text-center">Trạng thái</th>
                                        <th className="p-4 w-40 text-center">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {exams.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="p-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center">
                                                    <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">event_busy</span>
                                                    <p>Chưa có bài thi nào được tạo.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {exams.map((exam) => (
                                        <tr key={exam.internalId} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="p-2 text-center">
                                                <input type="text" value={exam.id} onChange={e => updateExamField(exam.internalId, 'id', e.target.value)} className="w-12 text-center py-1.5 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white outline-none font-medium" />
                                            </td>
                                            <td className="p-2">
                                                <input type="text" placeholder="Mã..." value={exam.examCode} onChange={e => updateExamField(exam.internalId, 'examCode', e.target.value)} className="w-full py-1.5 px-2 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white outline-none text-sm font-semibold text-slate-700" />
                                            </td>
                                            <td className="p-2">
                                                <input type="text" placeholder="Toán..." value={exam.subject} onChange={e => updateExamField(exam.internalId, 'subject', e.target.value)} className="w-full py-1.5 px-2 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white outline-none text-sm" />
                                            </td>
                                            <td className="p-2">
                                                <select value={exam.className} onChange={e => updateExamField(exam.internalId, 'className', e.target.value)} className="w-full py-1.5 px-2 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white outline-none text-sm appearance-none">
                                                    <option value="">Chọn lớp...</option>
                                                    {availableClasses.map(c => <option key={c.id} value={c.className}>{c.className}</option>)}
                                                </select>
                                            </td>
                                            <td className="p-2">
                                                <input type="text" placeholder="Tên bài kiểm tra..." value={exam.examName} onChange={e => updateExamField(exam.internalId, 'examName', e.target.value)} className="w-full py-1.5 px-2 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white outline-none text-sm font-semibold text-slate-800" />
                                            </td>
                                            <td className="p-2">
                                                <input type="datetime-local" value={exam.startTime} onChange={e => updateExamField(exam.internalId, 'startTime', e.target.value)} className="w-full py-1.5 px-2 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white outline-none text-xs text-slate-600" />
                                            </td>
                                            <td className="p-2">
                                                <input type="datetime-local" value={exam.endTime} onChange={e => updateExamField(exam.internalId, 'endTime', e.target.value)} className="w-full py-1.5 px-2 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white outline-none text-xs text-slate-600" />
                                            </td>
                                            <td className="p-2 text-center">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${getExamStatus(exam).color} inline-block whitespace-nowrap`}>
                                                    {getExamStatus(exam).text}
                                                </span>
                                            </td>
                                            <td className="p-2">
                                                <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => openSetupKey(exam.internalId)} title="Cấu hình Đề & Đáp án" className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors flex items-center">
                                                        <span className="material-symbols-outlined text-[20px]">settings_suggest</span>
                                                    </button>
                                                    <button onClick={() => openResults(exam.internalId)} title="Xem bảng điểm" className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-md transition-colors flex items-center">
                                                        <span className="material-symbols-outlined text-[20px]">leaderboard</span>
                                                    </button>
                                                    <button onClick={() => setConfirmDeleteId(exam.internalId)} title="Xóa bài thi" className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors flex items-center">
                                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {confirmDeleteId && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
                            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-2xl">delete_forever</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Xác nhận xóa</h3>
                            <p className="text-slate-600 mb-6 text-sm">Bạn có chắc chắn muốn xóa bài thi này? Toàn bộ mã đề, đáp án và thông tin kỳ thi sẽ bị xóa vĩnh viễn.</p>
                            <div className="flex gap-3">
                                <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
                                <button onClick={() => deleteExam(confirmDeleteId)} className="flex-1 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm shadow-red-600/30">Xóa bài thi</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ============== RENDER VIEW RESULTS ==============
    if (state === 'VIEW_RESULTS') {
        const exam = exams.find(e => e.internalId === currentExamId);
        return (
            <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
                <div className="max-w-5xl mx-auto">
                    <button onClick={() => setState('DASHBOARD')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold mb-6 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span> Quay lại Dashboard
                    </button>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-200 bg-indigo-50/30 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-indigo-600">leaderboard</span>
                                    Bảng điểm: {exam?.examName}
                                </h2>
                                <p className="text-slate-500 mt-1">Lớp: {exam?.className} | Mã kỳ thi: {exam?.examCode || exam?.id}</p>
                            </div>
                            <button onClick={() => openResults(currentExamId!)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2 px-4 rounded-lg shadow-sm font-bold flex items-center gap-2 transition-colors">
                                <span className={`material-symbols-outlined text-[20px] ${isLoadingResults ? 'animate-spin' : ''}`}>refresh</span> Làm mới
                            </button>
                        </div>

                        <div className="p-0 overflow-x-auto">
                            {isLoadingResults ? (
                                <div className="p-12 flex justify-center items-center text-slate-400">
                                    <span className="material-symbols-outlined animate-spin text-4xl">autorenew</span>
                                    <span className="ml-3 font-bold">Đang tải dữ liệu...</span>
                                </div>
                            ) : examResults.length === 0 ? (
                                <div className="p-12 text-center text-slate-500">
                                    <span className="material-symbols-outlined text-5xl opacity-20 mb-3 block">receipt_long</span>
                                    <p className="font-bold text-lg">Chưa có kết quả nào</p>
                                    <p className="text-sm">Học sinh chưa nộp bài hoặc kỳ thi chưa diễn ra.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-bold">
                                            <th className="py-4 px-6 border-b border-slate-200">Học sinh</th>
                                            <th className="py-4 px-6 border-b border-slate-200 text-center">Mã Đề</th>
                                            <th className="py-4 px-6 border-b border-slate-200 text-center">Thời gian nộp</th>
                                            <th className="py-4 px-6 border-b border-slate-200 text-right">Điểm</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {examResults.map((r, i) => (
                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="py-4 px-6">
                                                    <div className="font-bold text-slate-800">{r.studentName}</div>
                                                    <div className="text-xs text-slate-500">Mã: {r.studentId}</div>
                                                </td>
                                                <td className="py-4 px-6 text-center font-medium text-slate-600">{r.versionCode}</td>
                                                <td className="py-4 px-6 text-center text-sm text-slate-500">{new Date(r.submittedAt).toLocaleString('vi-VN')}</td>
                                                <td className="py-4 px-6 text-right">
                                                    <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 font-black rounded-lg text-lg">
                                                        {Number(r.score).toFixed(2)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ============== RENDER SETUP KEY ==============
    if (state === 'SETUP_KEY' && currentExam) {
        const renderOptBtn = (isSelected: boolean, text: string, onClick: () => void) => (
            <button
                key={text}
                onClick={onClick}
                className={`w-9 h-9 rounded-lg font-bold text-sm flex items-center justify-center transition-all border shadow-sm ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-600/30 scale-105' : 'bg-white text-slate-500 hover:bg-indigo-50 border-slate-200 hover:border-indigo-200'
                    }`}
            >
                {text}
            </button>
        );

        return (
            <div className="flex-1 flex overflow-hidden bg-white h-[calc(100vh-64px)]">
                <SplitPane
                    initialLeftWidth="50%"
                    minLeftWidth={400}
                    minRightWidth={400}
                    left={
                        /* --- BẮT ĐẦU CỘT TRÁI (PDF) --- */
                        <div className="flex flex-col h-full w-full bg-slate-100 p-2 min-h-0">
                            <div className="bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between shadow-sm z-10 mb-2 rounded-lg shrink-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded text-sm">Mã đề: {activeVersion?.code}</span>
                                </div>
                                <label className={`cursor-pointer bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-md text-sm font-bold transition-colors flex items-center gap-2 border border-indigo-200 ${isUploadingPdf ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <span className="material-symbols-outlined text-[18px]">upload_file</span> {isUploadingPdf ? 'Đang tải lên...' : (activeVersion?.pdfName ? 'Đổi tệp PDF' : 'Tải đề PDF lên')}
                                    <input type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />
                                </label>
                            </div>
                            <div style={{ flex: 1, background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
                                {activeVersion?.pdfUrl ? (
                                    <CustomPdfViewer key={activeVersion.pdfUrl} url={activeVersion.pdfUrl} heightOffset={140} />
                                ) : (
                                    <div style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 36, marginBottom: 8, opacity: 0.5 }}>note_add</span>
                                        <p>Chưa tải PDF cho mã đề này</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        /* --- KẾT THÚC CỘT TRÁI --- */
                    }
                    right={
                        /* --- BẮT ĐẦU CỘT PHẢI (FORM SETUP) --- */
                        <div className="w-full h-full bg-white flex flex-col z-10">
                            {/* Header */}
                            <div className="px-6 py-5 flex items-center justify-between border-b border-slate-200 bg-white shrink-0">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-3 text-indigo-700">
                                        <span className="material-symbols-outlined font-bold text-2xl">key</span>
                                        <h2 className="font-bold text-xl tracking-tight hidden xl:block">Cấu hình</h2>
                                    </div>

                                    <div className="flex items-center bg-slate-50 p-1.5 rounded-lg border border-slate-200 gap-2 shadow-inner">
                                        <div className="flex flex-col items-center px-3 border-r border-slate-200">
                                            <span className="text-[9px] uppercase font-bold text-slate-400 mb-1">Trắc nghiệm</span>
                                            <input type="number" min="0" value={currentExam.part1Count} onChange={e => updateExamField(currentExam.internalId, 'part1Count', Number(e.target.value))} className="w-14 bg-white border border-slate-300 rounded text-center text-sm font-bold text-slate-700 py-0.5 outline-none focus:border-indigo-500" title="Số câu Phần 1" />
                                        </div>
                                        <div className="flex flex-col items-center px-3 border-r border-slate-200">
                                            <span className="text-[9px] uppercase font-bold text-slate-400 mb-1">Đúng/Sai</span>
                                            <input type="number" min="0" value={currentExam.part2Count} onChange={e => updateExamField(currentExam.internalId, 'part2Count', Number(e.target.value))} className="w-14 bg-white border border-slate-300 rounded text-center text-sm font-bold text-slate-700 py-0.5 outline-none focus:border-indigo-500" title="Số câu Phần 2" />
                                        </div>
                                        <div className="flex flex-col items-center px-3 border-r border-slate-200">
                                            <span className="text-[9px] uppercase font-bold text-slate-400 mb-1">TL Ngắn</span>
                                            <input type="number" min="0" value={currentExam.part3Count} onChange={e => updateExamField(currentExam.internalId, 'part3Count', Number(e.target.value))} className="w-14 bg-white border border-slate-300 rounded text-center text-sm font-bold text-slate-700 py-0.5 outline-none focus:border-indigo-500" title="Số câu Phần 3" />
                                        </div>
                                        <div className="flex flex-col items-center px-3">
                                            <span className="text-[9px] uppercase font-bold text-slate-400 mb-1">Tự luận</span>
                                            <input type="number" min="0" value={currentExam.part4Count} onChange={e => updateExamField(currentExam.internalId, 'part4Count', Number(e.target.value))} className="w-14 bg-white border border-slate-300 rounded text-center text-sm font-bold text-slate-700 py-0.5 outline-none focus:border-indigo-500" title="Số câu Phần 4" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button onClick={() => setState('DASHBOARD')} className="text-slate-500 hover:bg-slate-100 font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 text-sm transition-colors border border-transparent hover:border-slate-300" title="Đóng & Trở về">
                                        <span className="material-symbols-outlined text-[18px]">close</span>
                                    </button>
                                    <button onClick={goToQuiz} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-1 text-sm shadow-md shadow-indigo-600/20 transition-all active:scale-95 ml-1 whitespace-nowrap">
                                        Thi thử <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                    </button>
                                </div>
                            </div>

                            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-2 overflow-x-auto hide-scrollbar shrink-0">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mr-2 flex-shrink-0">Các mã đề:</span>
                                {currentExam.versions.map(v => (
                                    <div key={v.id} className={`flex items-center gap-1 rounded-md border transition-all flex-shrink-0 ${v.id === activeVersion?.id ? 'bg-indigo-100 border-indigo-300 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                        <button onClick={() => switchExamVersion(v.id)} className={`px-3 py-1.5 text-sm font-bold ${v.id === activeVersion?.id ? 'text-indigo-800' : 'text-slate-600'}`}>
                                            {v.code}
                                        </button>
                                        {v.id === activeVersion?.id && (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteExamVersion(v.id); }}
                                                className="p-1 mr-1 text-red-500 hover:bg-red-100 rounded transition-colors"
                                                title="Xóa mã đề này"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={addExamVersion} className="ml-2 flex items-center gap-1 text-indigo-600 font-bold text-sm hover:bg-indigo-50 px-3 py-1.5 rounded-md border border-dashed border-indigo-300 transition-colors flex-shrink-0">
                                    <span className="material-symbols-outlined text-[18px]">add</span> Thêm mã đề
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
                                {/* Tabs */}
                                <div className="flex gap-8 border-b border-slate-200 mb-8 px-2">
                                    {currentExam.part1Count > 0 && <button onClick={() => setActiveTab('p1')} className={`pb-3 font-bold text-sm transition-colors ${activeTab === 'p1' ? 'text-indigo-700 border-b-2 border-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>Phần I (1-{currentExam.part1Count})</button>}
                                    {currentExam.part2Count > 0 && <button onClick={() => setActiveTab('p2')} className={`pb-3 font-bold text-sm transition-colors ${activeTab === 'p2' ? 'text-indigo-700 border-b-2 border-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>Phần II (Đ/S)</button>}
                                    {currentExam.part3Count > 0 && <button onClick={() => setActiveTab('p3')} className={`pb-3 font-bold text-sm transition-colors ${activeTab === 'p3' ? 'text-indigo-700 border-b-2 border-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>Phần III (Số)</button>}
                                    {currentExam.part4Count > 0 && <button onClick={() => setActiveTab('p4')} className={`pb-3 font-bold text-sm transition-colors ${activeTab === 'p4' ? 'text-indigo-700 border-b-2 border-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>Phần IV (Tự luận)</button>}
                                </div>

                                {/* Cấu hình điểm */}
                                {/* Cấu hình điểm */}
                                <div className="mb-6 flex flex-wrap items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase">Phần I:</span>
                                        <input type="number" step="0.05" value={currentExam.part1Points} onChange={e => updateExamField(currentExam.internalId, 'part1Points', Number(e.target.value))} className="w-14 border border-slate-300 rounded p-1 text-center font-bold text-indigo-700 outline-none text-sm" title="Điểm cho mỗi câu đúng" />
                                        <span className="text-xs text-slate-400 font-bold">đ</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase">Phần II (Tối đa/câu):</span>
                                        <input type="number" step="0.05" value={currentExam.part2Points} onChange={e => updateExamField(currentExam.internalId, 'part2Points', Number(e.target.value))} className="w-14 border border-slate-300 rounded p-1 text-center font-bold text-indigo-700 outline-none text-sm" />
                                        <span className="text-xs text-slate-400 font-bold">đ</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase">Phần III:</span>
                                        <input type="number" step="0.05" value={currentExam.part3Points} onChange={e => updateExamField(currentExam.internalId, 'part3Points', Number(e.target.value))} className="w-14 border border-slate-300 rounded p-1 text-center font-bold text-indigo-700 outline-none text-sm" />
                                        <span className="text-xs text-slate-400 font-bold">đ</span>
                                    </div>
                                    
                                    <div className="ml-auto flex items-center gap-3">
                                        <details className="relative text-sm text-slate-500 cursor-pointer group">
                                            <summary className="font-bold flex items-center gap-1 hover:text-indigo-600 outline-none select-none">
                                                <span className="material-symbols-outlined text-[18px]">info</span> Hướng dẫn
                                            </summary>
                                            <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 shadow-xl p-4 rounded-xl z-50 text-xs text-slate-700">
                                                <ul className="list-disc pl-4 space-y-1.5">
                                                    <li><strong>Phần I & III:</strong> Điểm nhập là cho <strong>mỗi câu đúng</strong>.</li>
                                                    <li><strong>Phần II (Đ/S):</strong> Điểm nhập là <strong>tối đa</strong>/câu. Tự động chia: đúng 1 ý (10%), 2 ý (25%), 3 ý (50%), 4 ý (100%).</li>
                                                </ul>
                                            </div>
                                        </details>
                                        <div className="bg-indigo-50 text-indigo-800 font-bold px-3 py-1.5 rounded-lg border border-indigo-200 text-sm flex items-center gap-2 shadow-sm">
                                            Tổng: <span className="text-lg">{Number((currentExam.part1Count * currentExam.part1Points + currentExam.part2Count * currentExam.part2Points + currentExam.part3Count * currentExam.part3Points + (Array.from({ length: currentExam.part4Count }).reduce((sum: number, _, idx) => sum + (activeVersion?.answerKey?.part4?.[idx + 1] !== undefined ? Number(activeVersion.answerKey.part4[idx + 1]) : 1.0), 0) as number)).toFixed(2))}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* ================= TAB CONTENTS ================= */}
                                {activeTab === 'p1' && (
                                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                        <div className="mb-5 flex items-center gap-3 bg-indigo-50 p-2.5 rounded-lg border border-indigo-100 shadow-inner">
                                            <span className="material-symbols-outlined text-indigo-600 ml-1">keyboard</span>
                                            <span className="text-[13px] font-bold text-indigo-900 whitespace-nowrap">Nhập nhanh:</span>
                                            <input 
                                                type="text" 
                                                placeholder="VD gõ: ABCDABCD..." 
                                                className="flex-1 border border-indigo-200 rounded-md px-3 py-1.5 outline-none focus:border-indigo-500 font-mono tracking-[0.25em] uppercase text-sm font-bold text-slate-800 bg-white"
                                                onChange={(e) => {
                                                    const clean = e.target.value.toUpperCase().replace(/[^A-D]/g, '');
                                                    const newPart1 = { ...activeVersion?.answerKey.part1 };
                                                    for (let i = 0; i < currentExam.part1Count; i++) {
                                                        if (clean[i]) newPart1[i + 1] = clean[i];
                                                        else delete newPart1[i + 1];
                                                    }
                                                    const newKey = { ...activeVersion?.answerKey, part1: newPart1 };
                                                    setExams(prev => prev.map(ex => ex.internalId === currentExamId ? { ...ex, versions: ex.versions.map(v => v.id === activeVersion?.id ? { ...v, answerKey: newKey as AnswerKey } : v) } : ex));
                                                }}
                                                value={Array.from({length: currentExam.part1Count}).map((_, i) => activeVersion?.answerKey.part1[i+1] || '').join('')}
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                                            {Array.from({ length: currentExam.part1Count }).map((_, idx) => {
                                                const qNum = idx + 1;
                                                const selected = activeVersion?.answerKey.part1[qNum];
                                                return (
                                                    <div key={`p1-${qNum}`} className={`flex items-center gap-3 bg-white px-2 py-2 rounded-xl border-2 transition-all ${selected ? 'border-indigo-400 shadow-md bg-indigo-50/40' : 'border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md'}`}>
                                                        <div className={`flex flex-col items-center justify-center shrink-0 w-10 border-r-2 pr-1 ${selected ? 'border-indigo-200 text-indigo-700' : 'border-slate-100 text-slate-500'}`}>
                                                            <span className="text-[9px] uppercase font-bold tracking-widest opacity-60 mb-0.5">Câu</span>
                                                            <span className="text-[15px] font-black leading-none">{qNum}</span>
                                                        </div>
                                                        <div className="flex gap-1.5 pl-1">
                                                            {['A', 'B', 'C', 'D'].map(opt => (
                                                                <button
                                                                    key={opt}
                                                                    onClick={() => updateKey('part1', qNum, null, opt)}
                                                                    className={`w-7 h-7 rounded-full font-black text-[12px] flex items-center justify-center transition-all border-2 ${selected === opt ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-110' : 'bg-white text-slate-600 hover:bg-indigo-50 border-slate-300 hover:border-indigo-400 hover:text-indigo-600'}`}
                                                                >
                                                                    {opt}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'p2' && (
                                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                            {Array.from({ length: currentExam.part2Count }).map((_, idx) => {
                                                const qNum = idx + 1;
                                                const keyObj = activeVersion?.answerKey.part2[qNum] || {};
                                                return (
                                                    <div key={`p2-${qNum}`} className={`flex items-center gap-4 bg-white p-3 rounded-xl border-2 transition-all shadow-sm hover:shadow-md ${keyObj['a'] !== undefined || keyObj['b'] !== undefined || keyObj['c'] !== undefined || keyObj['d'] !== undefined ? 'border-indigo-400 bg-indigo-50/40' : 'border-slate-100 hover:border-indigo-200'}`}>
                                                        <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-black shrink-0 border-2 transition-colors ${keyObj['a'] !== undefined || keyObj['b'] !== undefined || keyObj['c'] !== undefined || keyObj['d'] !== undefined ? 'bg-indigo-500 text-white border-indigo-600 shadow-inner' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                            <span className="text-[8px] uppercase tracking-widest opacity-90 leading-none mb-0.5">Câu</span>
                                                            <span className="text-[15px] leading-none">{qNum}</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-y-3 gap-x-6 flex-1">
                                                            {(['a', 'b', 'c', 'd'] as const).map(sub => {
                                                                const isTrue = keyObj[sub] === true;
                                                                const isFalse = keyObj[sub] === false;
                                                                return (
                                                                    <div key={sub} className="flex items-center gap-1.5">
                                                                        <span className="text-[11px] font-bold text-slate-500">{sub})</span>
                                                                        <button onClick={() => updateKey('part2', qNum, sub, true)} className={`w-7 h-7 rounded-full text-[11px] font-bold border-2 transition-all ${isTrue ? 'bg-emerald-500 text-white border-emerald-500 shadow-md scale-110' : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'}`}>Đ</button>
                                                                        <button onClick={() => updateKey('part2', qNum, sub, false)} className={`w-7 h-7 rounded-full text-[11px] font-bold border-2 transition-all ${isFalse ? 'bg-rose-500 text-white border-rose-500 shadow-md scale-110' : 'bg-white text-slate-600 border-slate-300 hover:border-rose-400 hover:text-rose-600 hover:bg-rose-50'}`}>S</button>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'p3' && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                        {Array.from({ length: currentExam.part3Count }).map((_, idx) => {
                                            const qNum = idx + 1;
                                            return (
                                                <div key={`p3-${qNum}`} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100 hover:border-slate-300 transition-colors">
                                                    <span className="text-slate-600 font-bold text-[13px] whitespace-nowrap w-12 shrink-0">Câu {qNum}</span>
                                                    <input
                                                        type="text"
                                                        value={activeVersion?.answerKey.part3[qNum] || ''}
                                                        onChange={e => updateKey('part3', qNum, null, e.target.value)}
                                                        className="w-full border border-slate-300 rounded p-1.5 outline-none focus:border-indigo-500 text-[13px] font-bold text-slate-800"
                                                        placeholder="Đáp án..."
                                                    />
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {activeTab === 'p4' && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {Array.from({ length: currentExam.part4Count }).map((_, idx) => {
                                            const qNum = idx + 1;
                                            return (
                                                <div key={`p4-${qNum}`} className="flex items-center justify-between border border-slate-200 p-3 rounded-lg bg-slate-50">
                                                    <span className="font-bold text-sm text-slate-700">Câu TL {qNum}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-500">Điểm tối đa</span>
                                                        <input
                                                            type="number" step="0.5"
                                                            value={activeVersion?.answerKey.part4[qNum] || 1.0}
                                                            onChange={e => updateKey('part4', qNum, null, Number(e.target.value))}
                                                            className="w-16 border border-slate-300 rounded p-1 text-center font-bold text-indigo-700 outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                            </div>
                        </div>
                        /* --- KẾT THÚC CỘT PHẢI --- */
                    }
                />
            </div>
        );
    }

    // ============== RENDER QUIZ ==============
    if (state === 'QUIZ' && currentExam) {
        const renderQuizOptBtn = (isSelected: boolean, text: string, onClick: () => void) => (
            <button
                key={text}
                onClick={onClick}
                className={`w-12 h-12 rounded-full font-bold text-lg flex items-center justify-center transition-all duration-200 border-2 ${isSelected ? 'bg-teal-500 border-teal-500 text-white shadow-[0_4px_12px_rgba(20,184,166,0.4)] scale-105' : 'bg-white border-slate-200 text-slate-600 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50/30'
                    }`}
            >
                {text}
            </button>
        );

        let activeCount = 0;
        if (quizActiveTab === 'p1') activeCount = currentExam.part1Count;
        else if (quizActiveTab === 'p2') activeCount = currentExam.part2Count;
        else if (quizActiveTab === 'p3') activeCount = currentExam.part3Count;
        else if (quizActiveTab === 'p4') activeCount = currentExam.part4Count;

        const studentVersion = currentExam.versions.find(v => v.id === currentStudentVersionId) || currentExam.versions[0];

        return (
            <div className="flex-1 flex overflow-hidden bg-slate-100 h-[calc(100vh-64px)] flex-row">
                <SplitPane
                    initialLeftWidth={700}
                    minLeftWidth={400}
                    minRightWidth={350}
                    left={
                        /* --- BẮT ĐẦU CỘT TRÁI (PDF) --- */
                        <div className="flex flex-col relative h-full w-full bg-slate-100 p-4 lg:p-6 min-h-0">
                            <div style={{ flex: 1, background: 'white', borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', width: '100%' }}>
                                <div className="bg-white px-6 py-4 z-10 border-b border-slate-100 flex items-center" style={{ flexShrink: 0 }}>
                                    <div className="w-1.5 h-6 bg-teal-600 rounded-full mr-3"></div>
                                    <h1 className="font-bold text-lg text-slate-800 tracking-tight">{currentExam.examName || 'Chưa cập nhật tên bài thi'}</h1>
                                </div>
                                {studentVersion?.pdfUrl ? (
                                    <CustomPdfViewer key={studentVersion.pdfUrl} url={studentVersion.pdfUrl} heightOffset={160} />
                                ) : (
                                    <div style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', background: '#f8fafc' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>picture_as_pdf</span>
                                        <p style={{ fontWeight: 700 }}>Chưa tải tệp PDF đề thi</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        /* --- KẾT THÚC CỘT TRÁI --- */
                    }
                    right={
                        /* --- BẮT ĐẦU CỘT PHẢI (FORM ĐIỀN ĐÁP ÁN) --- */
                        <div className="w-full h-full bg-white flex flex-col z-20 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] relative">
                            {/* Header Modern Tech Theme */}
                            <div className="bg-slate-900 p-4 pb-5 text-white flex flex-col items-center relative overflow-hidden rounded-bl-3xl shrink-0">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-emerald-400"></div>
                                <div className="w-full flex justify-between items-center mb-3 text-[11px] font-semibold tracking-wider opacity-90">
                                    <span className="bg-slate-800 px-3 py-1 rounded-full text-teal-400 border border-slate-700 shadow-sm flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px]">qr_code_2</span> Mã đề: {studentVersion?.code || 'MÃ ĐỀ'}
                                    </span>
                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px] text-teal-400">hourglass_top</span> Còn lại</span>
                                </div>
                                <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 px-6 py-2 rounded-2xl shadow-inner flex items-center justify-center w-full max-w-[250px]">
                                    <span className={`text-4xl font-black tracking-widest ${quizTimeLeft <= 300 ? 'text-rose-500 animate-pulse' : 'text-white'}`} style={{ fontFamily: 'monospace' }}>
                                        {formatTime(quizTimeLeft)}
                                    </span>
                                </div>
                            </div>

                            {/* Tabs (Pill style) */}
                            <div className="flex px-4 py-5 gap-2 bg-slate-50 overflow-x-auto hide-scrollbar border-b border-slate-200 shrink-0">
                                {currentExam.part1Count > 0 && (
                                    <button onClick={() => { setQuizActiveTab('p1'); setQuizActiveQ(0); }} className={`px-5 py-2.5 rounded-full font-bold text-[11px] uppercase tracking-wider whitespace-nowrap transition-all flex flex-col items-center gap-0.5 ${quizActiveTab === 'p1' ? 'bg-teal-500 text-white shadow-md shadow-teal-500/30' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                                        <span>Trắc nghiệm</span><span className="text-[10px] opacity-80 font-medium">({currentExam.part1Count})</span>
                                    </button>
                                )}
                                {currentExam.part2Count > 0 && (
                                    <button onClick={() => { setQuizActiveTab('p2'); setQuizActiveQ(0); }} className={`px-5 py-2.5 rounded-full font-bold text-[11px] uppercase tracking-wider whitespace-nowrap transition-all flex flex-col items-center gap-0.5 ${quizActiveTab === 'p2' ? 'bg-teal-500 text-white shadow-md shadow-teal-500/30' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                                        <span>Đúng/Sai</span><span className="text-[10px] opacity-80 font-medium">({currentExam.part2Count})</span>
                                    </button>
                                )}
                                {currentExam.part3Count > 0 && (
                                    <button onClick={() => { setQuizActiveTab('p3'); setQuizActiveQ(0); }} className={`px-5 py-2.5 rounded-full font-bold text-[11px] uppercase tracking-wider whitespace-nowrap transition-all flex flex-col items-center gap-0.5 ${quizActiveTab === 'p3' ? 'bg-teal-500 text-white shadow-md shadow-teal-500/30' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                                        <span>TL Ngắn</span><span className="text-[10px] opacity-80 font-medium">({currentExam.part3Count})</span>
                                    </button>
                                )}
                                {currentExam.part4Count > 0 && (
                                    <button onClick={() => { setQuizActiveTab('p4'); setQuizActiveQ(0); }} className={`px-5 py-2.5 rounded-full font-bold text-[11px] uppercase tracking-wider whitespace-nowrap transition-all flex flex-col items-center gap-0.5 ${quizActiveTab === 'p4' ? 'bg-teal-500 text-white shadow-md shadow-teal-500/30' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                                        <span>Tự luận</span><span className="text-[10px] opacity-80 font-medium">({currentExam.part4Count})</span>
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 flex flex-col bg-slate-50/50">
                                <div className="text-xs font-bold text-teal-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                                    Phần {quizActiveTab === 'p1' ? 'I. Trắc nghiệm' : quizActiveTab === 'p2' ? 'II. Đúng/Sai' : quizActiveTab === 'p3' ? 'III. Trả lời ngắn' : 'IV. Tự luận'}
                                </div>

                                {/* Question Grid Navigator */}
                                <div className="grid grid-cols-6 md:grid-cols-7 gap-y-6 gap-x-3 mb-10">
                                    {Array.from({ length: activeCount }).map((_, idx) => {
                                        const qNum = idx + 1;
                                        const isActive = quizActiveQ === qNum;
                                        const isAnswered = isQuestionAnswered(quizActiveTab, qNum);

                                        if (isActive && quizActiveTab === 'p1') {
                                            return (
                                                <div key={`nav-${qNum}`} className="col-span-full sm:col-span-4 flex items-center bg-teal-50 p-1.5 rounded-full border-2 border-teal-500 shadow-[0_5px_15px_rgba(20,184,166,0.2)] animate-in zoom-in-95 origin-left">
                                                    <div className="w-9 h-9 rounded-full bg-teal-500 text-white font-bold flex items-center justify-center shrink-0 shadow-inner">
                                                        {qNum}
                                                    </div>
                                                    <div className="flex gap-1.5 px-3">
                                                        {['A', 'B', 'C', 'D'].map(opt => (
                                                            <button 
                                                                key={opt}
                                                                onClick={(e) => { e.stopPropagation(); updateAnsPart1(qNum, opt); quizNextQuestion(); }}
                                                                className={`w-9 h-9 rounded-full font-bold text-sm transition-all flex items-center justify-center border-2 ${studentAnswers.part1[qNum] === opt ? 'bg-teal-600 text-white border-teal-600 shadow-md scale-110' : 'bg-white text-slate-600 border-slate-200 hover:bg-teal-50 hover:border-teal-300'}`}
                                                            >
                                                                {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={`nav-${qNum}`} className="flex justify-center">
                                                <button
                                                    onClick={() => setQuizActiveQ(isActive ? 0 : qNum)}
                                                    className={`w-10 h-10 rounded-full text-xs font-bold transition-all flex items-center justify-center ${isActive ? 'bg-teal-500 text-white shadow-[0_0_15px_rgba(20,184,166,0.5)] z-20 scale-110' :
                                                        isAnswered ? 'bg-teal-50 text-teal-700 border-2 border-teal-200' :
                                                            'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
                                                        }`}
                                                >
                                                    {isAnswered && quizActiveTab === 'p1' ? (
                                                        <div className="flex flex-col items-center mt-0.5">
                                                            <span className="text-[9px] opacity-60 leading-none">{qNum}</span>
                                                            <span className="text-[14px] leading-none mt-0.5">{studentAnswers.part1[qNum]}</span>
                                                        </div>
                                                    ) : (
                                                        qNum
                                                    )}
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Single Question Detail */}
                                {quizActiveTab !== 'p1' && quizActiveQ > 0 && (
                                    <div className="flex-1 flex flex-col border-t border-slate-200 pt-6">
                                        <h3 className="text-xl font-bold text-slate-800 mb-1">Câu hỏi {quizActiveQ}</h3>
                                        <p className="text-slate-500 text-sm mb-6">
                                            {quizActiveTab === 'p2' && 'Trắc nghiệm đúng/sai (4 ý)'}
                                            {quizActiveTab === 'p3' && 'Điền đáp án ngắn'}
                                            {quizActiveTab === 'p4' && 'Tải ảnh bài làm'}
                                        </p>

                                    {quizActiveTab === 'p2' && (
                                        <div className="space-y-4">
                                            {(['a', 'b', 'c', 'd'] as const).map(sub => {
                                                const val = studentAnswers.part2[quizActiveQ]?.[sub];
                                                return (
                                                    <div key={sub} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-teal-200 transition-colors">
                                                        <span className="font-black text-slate-400 text-2xl uppercase w-10 text-center">{sub}</span>
                                                        <div className="flex gap-3">
                                                            <button onClick={() => updateAnsPart2(quizActiveQ, sub, true)} className={`w-20 h-12 rounded-xl font-bold text-sm tracking-wider transition-all border-2 ${val === true ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105' : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50'}`}>ĐÚNG</button>
                                                            <button onClick={() => updateAnsPart2(quizActiveQ, sub, false)} className={`w-20 h-12 rounded-xl font-bold text-sm tracking-wider transition-all border-2 ${val === false ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/30 scale-105' : 'bg-white border-slate-200 text-slate-400 hover:border-rose-400 hover:text-rose-500 hover:bg-rose-50'}`}>SAI</button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {quizActiveTab === 'p3' && (
                                        <div>
                                            <input
                                                type="text"
                                                value={studentAnswers.part3[quizActiveQ] || ''}
                                                onChange={e => updateAnsPart3(quizActiveQ, e.target.value)}
                                                placeholder="Nhập đáp án của bạn..."
                                                className="w-full px-5 py-4 border-2 border-slate-200 rounded-2xl focus:border-teal-500 outline-none font-bold text-xl text-slate-700 bg-white shadow-inner transition-colors"
                                            />
                                        </div>
                                    )}

                                    {quizActiveTab === 'p4' && (
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center">
                                            <label className="cursor-pointer bg-white text-indigo-700 px-6 py-3 rounded-xl border-2 border-dashed border-indigo-300 hover:bg-indigo-50 font-bold flex items-center gap-2 mb-4 w-full justify-center transition-colors">
                                                <span className="material-symbols-outlined">add_a_photo</span> Tải ảnh lên
                                                <input type="file" accept="image/*" multiple onChange={e => updateAnsPart4(quizActiveQ, e)} className="hidden" />
                                            </label>

                                            {(studentAnswers.part4[quizActiveQ] || []).length > 0 && (
                                                <div className="grid grid-cols-2 gap-2 w-full">
                                                    {(studentAnswers.part4[quizActiveQ] || []).map((url, iIndex) => (
                                                        <div key={iIndex} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-[3/4] bg-white">
                                                            <img src={url} className="w-full h-full object-cover" />
                                                            <button onClick={() => removePart4Image(quizActiveQ, iIndex)} className="absolute top-1 right-1 bg-black/60 text-white w-6 h-6 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600"><span className="material-symbols-outlined text-[16px]">close</span></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    </div>
                                )}
                            </div>

                            {/* Footer Navigation */}
                            <div className="p-5 bg-white border-t border-slate-200 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] rounded-tl-3xl relative z-20 shrink-0">
                                <div className="flex justify-between gap-4 mb-4">
                                    <button onClick={quizPrevQuestion} className="flex-1 py-3 border-2 border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors flex justify-center items-center gap-1 active:scale-95">
                                        <span className="material-symbols-outlined text-[20px]">west</span> Trước
                                    </button>
                                    <button onClick={quizNextQuestion} className="flex-1 py-3 border-2 border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors flex justify-center items-center gap-1 active:scale-95">
                                        Tiếp <span className="material-symbols-outlined text-[20px]">east</span>
                                    </button>
                                </div>
                                <button onClick={() => { if (window.confirm('Bạn có chắc chắn muốn nộp bài?')) setState('RESULT'); }} className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white py-4 rounded-2xl font-black text-lg tracking-widest flex justify-center items-center gap-2 shadow-[0_10px_20px_rgba(20,184,166,0.3)] transition-all active:scale-95">
                                    NỘP BÀI THI <span className="material-symbols-outlined">send</span>
                                </button>
                            </div>

                        </div>
                        /* --- KẾT THÚC CỘT PHẢI --- */
                    }
                />
            </div>
        );
    }

    if (state === 'RESULT' && currentExam) {
        const studentVersion = currentExam.versions.find(v => v.id === currentStudentVersionId) || currentExam.versions[0];
        const answerKey = studentVersion.answerKey;

        let totalScore = 0;
        let p1Correct = 0, p2Score = 0, p3Correct = 0;

        for (let i = 1; i <= currentExam.part1Count; i++) {
            if (studentAnswers.part1[i] && studentAnswers.part1[i] === answerKey.part1[i]) {
                p1Correct++;
                totalScore += currentExam.part1Points;
            }
        }

        for (let i = 1; i <= currentExam.part2Count; i++) {
            const userAns = studentAnswers.part2[i] || {};
            const correctAns = answerKey.part2[i] || {};
            let correctSubcount = 0;
            (['a', 'b', 'c', 'd'] as const).forEach(sub => {
                if (userAns[sub] !== undefined && userAns[sub] === correctAns[sub]) correctSubcount++;
            });
            let pts = 0;
            if (correctSubcount === 1) pts = 0.1 * currentExam.part2Points;
            else if (correctSubcount === 2) pts = 0.25 * currentExam.part2Points;
            else if (correctSubcount === 3) pts = 0.5 * currentExam.part2Points;
            else if (correctSubcount === 4) pts = 1.0 * currentExam.part2Points;
            p2Score += pts;
            totalScore += pts;
        }

        for (let i = 1; i <= currentExam.part3Count; i++) {
            const userStr = (studentAnswers.part3[i] || '').trim().toLowerCase();
            const keyStr = (answerKey.part3[i] || '').trim().toLowerCase();
            if (userStr === keyStr && userStr !== '') {
                p3Correct++;
                totalScore += currentExam.part3Points;
            }
        }

        return (
            <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col items-center p-8 min-h-[calc(100vh-64px)] py-12">
                <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 border-t-8 border-indigo-600 text-center">
                    <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-5xl">task_alt</span>
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Đã nộp bài: {currentExam.examName}</h2>
                    <p className="text-slate-500 mb-6 font-bold">Mã đề: {studentVersion.code}</p>

                    <div className="my-4 inline-block">
                        <div className="w-40 h-40 rounded-full border-8 border-slate-100 flex items-center justify-center flex-col">
                            <span className="text-5xl font-black text-indigo-700">{totalScore.toFixed(2)}</span>
                            <span className="text-sm font-medium text-slate-500 mt-1">Điểm Hệ thống</span>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-xl text-left border border-slate-200 mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentExam.part1Count > 0 && <div className="bg-white p-3 border border-slate-100 rounded-lg">
                            <span className="font-bold text-slate-800 block text-sm">Phần I (Trắc nghiệm)</span>
                            <span className="text-slate-600 text-sm">Đúng: <strong className="text-indigo-600">{p1Correct}/{currentExam.part1Count}</strong> câu</span>
                        </div>}
                        {currentExam.part2Count > 0 && <div className="bg-white p-3 border border-slate-100 rounded-lg">
                            <span className="font-bold text-slate-800 block text-sm">Phần II (Đúng/Sai)</span>
                            <span className="text-slate-600 text-sm">Điểm: <strong className="text-indigo-600">{p2Score.toFixed(2)}</strong> đ</span>
                        </div>}
                        {currentExam.part3Count > 0 && <div className="bg-white p-3 border border-slate-100 rounded-lg">
                            <span className="font-bold text-slate-800 block text-sm">Phần III (Trả lời ngắn)</span>
                            <span className="text-slate-600 text-sm">Đúng: <strong className="text-indigo-600">{p3Correct}/{currentExam.part3Count}</strong> câu</span>
                        </div>}
                    </div>

                    <div className="mt-8">
                        <button onClick={() => setState('DASHBOARD')} className="bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-xl font-bold transition-colors">
                            Về trang Quản lý
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default OnlineQuiz;
