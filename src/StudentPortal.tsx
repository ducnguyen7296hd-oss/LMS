import React, { useState, useEffect, ChangeEvent } from 'react';
import { User } from './App';
import { ExamConfig, Answers } from './OnlineQuiz';
import { LogOut, BookOpen, Clock, AlertCircle } from 'lucide-react';
import { CustomPdfViewer } from './components/CustomPdfViewer';

const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL;

interface StudentPortalProps {
    user: User;
    onLogout: () => void;
}

export default function StudentPortal({ user, onLogout }: StudentPortalProps) {
    const [exams, setExams] = useState<ExamConfig[]>([]);
    const [state, setState] = useState<'DASHBOARD' | 'QUIZ' | 'RESULT'>('DASHBOARD');
    const [confirmSubmit, setConfirmSubmit] = useState(false);
    const [currentExam, setCurrentExam] = useState<ExamConfig | null>(null);
    const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
    const [studentAnswers, setStudentAnswers] = useState<Answers>({ part1: {}, part2: {}, part3: {}, part4: {} });
    
    // Quiz state
    const [quizActiveTab, setQuizActiveTab] = useState<'p1'|'p2'|'p3'|'p4'>('p1');
    const [quizActiveQ, setQuizActiveQ] = useState<number | null>(null);
    const [quizTimeLeft, setQuizTimeLeft] = useState<number>(0);
    
    // Anti-cheat state
    const [cheatWarnings, setCheatWarnings] = useState<number>(0);
    const [isExamViolated, setIsExamViolated] = useState<boolean>(false);
    const hiddenTimeRef = React.useRef<number | null>(null);

    useEffect(() => {
        const loadExams = async () => {
            if (!ADMIN_API_URL) return;
            try {
                const res = await fetch(`${ADMIN_API_URL}?action=get_quizzes&email=${encodeURIComponent(user.email)}`);
                const data = await res.json();
                if (data.status === 'success' && data.quizzes) {
                    const mappedExams = data.quizzes.map((q: any) => {
                         const config = q.config || {};
                         return {
                             internalId: q.id + "_" + Date.now(),
                             id: q.id,
                             examCode: config.examCode || '',
                             subject: config.subject || '',
                             className: (q.classes && q.classes[0]) ? q.classes[0] : '',
                             examName: q.examName || '',
                             startTime: config.startTime || '',
                             endTime: config.endTime || '',
                             part1Count: config.part1Count || 0,
                             part2Count: config.part2Count || 0,
                             part3Count: config.part3Count || 0,
                             part4Count: config.part4Count || 0,
                             part1Points: config.part1Points || 0.25,
                             part2Points: config.part2Points || 1.0,
                             part3Points: config.part3Points || 0.5,
                             antiCheatEnabled: config.antiCheatEnabled !== false,
                             versions: q.versions || []
                         };
                    });
                    const myExams = mappedExams.filter((e: ExamConfig) => e.className === user.className);
                    setExams(myExams);
                }
            } catch (e) {
                console.error('Lỗi tải danh sách bài thi', e);
            }
        };
        loadExams();
    }, [user.email, user.className]);

    useEffect(() => {
        if (state === 'QUIZ' && quizTimeLeft > 0) {
            const timer = setInterval(() => {
                setQuizTimeLeft(prev => prev - 1);
            }, 1000);
            return () => clearInterval(timer);
        } else if (state === 'QUIZ' && quizTimeLeft <= 0) {
            submitQuizAndSync();
            alert("Đã hết giờ làm bài! Hệ thống tự động nộp bài.");
        }
    }, [state, quizTimeLeft]);

    const submitQuizAndSync = () => {
        if (!currentExam) return;
        const studentVersion = currentExam.versions.find(v => v.id === currentVersionId) || currentExam.versions[0];
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

        // Call sync
        if (ADMIN_API_URL && !ADMIN_API_URL.includes('YOUR_APPS_SCRIPT')) {
            const resultData = {
                examId: currentExam.examCode || currentExam.id,
                studentId: user.studentId || user.email,
                studentName: user.name,
                versionCode: studentVersion.code,
                score: totalScore,
                submittedAt: new Date().toISOString(),
                submissionDetails: studentAnswers
            };
            fetch(`${ADMIN_API_URL}?action=sync_results`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ email: user.email, results: [resultData] })
            }).catch(console.error);
        }
        
        setState('RESULT');
    };

    // Anti-cheat visibility change listener
    useEffect(() => {
        if (state !== 'QUIZ' || currentExam?.antiCheatEnabled === false) return;

        const handleVisibilityChange = (e: Event) => {
            const isAway = document.hidden || e.type === 'blur';
            
            if (isAway) {
                if (!hiddenTimeRef.current) {
                    hiddenTimeRef.current = new Date().getTime();
                }
            } else {
                if (hiddenTimeRef.current) {
                    const awayTimeSeconds = (new Date().getTime() - hiddenTimeRef.current) / 1000;
                    hiddenTimeRef.current = null;
                    
                    if (awayTimeSeconds > 5) {
                        setCheatWarnings(prev => {
                            const newCount = prev + 1;
                            
                            // Report cheat to backend
                            if (ADMIN_API_URL && !ADMIN_API_URL.includes('YOUR_APPS_SCRIPT')) {
                                fetch(`${ADMIN_API_URL}?action=report_cheat`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                                    body: JSON.stringify({
                                        teacherEmail: currentExam?.examCode || user.className, // examCode có thể lưu teacher email tạm, hoặc truyền thêm từ config
                                        // Wait, currentExam doesn't contain teacherEmail directly. 
                                        examName: currentExam?.examName,
                                        className: user.className,
                                        studentId: user.studentId || user.email,
                                        studentName: user.name,
                                        violationCount: newCount
                                    })
                                }).catch(console.error);
                            }

                            if (newCount >= 3) {
                                setIsExamViolated(true);
                                submitQuizAndSync();
                                alert("BÀI THI BỊ HỦY: Bạn đã ra khỏi màn hình làm bài quá 3 lần! Hệ thống tự động thu bài.");
                            } else {
                                alert(`CẢNH BÁO VI PHẠM (${newCount}/3): Bạn đã rời màn hình làm bài hơn 5 giây! Nếu vi phạm 3 lần bài thi sẽ tự động kết thúc.`);
                            }
                            return newCount;
                        });
                    }
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleVisibilityChange);
        window.addEventListener('focus', handleVisibilityChange);
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleVisibilityChange);
            window.removeEventListener('focus', handleVisibilityChange);
        };
    }, [state, currentExam]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) {
            return `${String(h).padStart(2, '0')} : ${String(m).padStart(2, '0')} : ${String(s).padStart(2, '0')}`;
        }
        return `${String(m).padStart(2, '0')} : ${String(s).padStart(2, '0')}`;
    };

    const getExamStatus = (exam: ExamConfig) => {
        const now = new Date().getTime();
        const start = new Date(exam.startTime).getTime();
        const end = new Date(exam.endTime).getTime();
        
        if (isNaN(start) || isNaN(end)) return { status: 'unknown', text: 'Chưa rõ', color: 'bg-slate-100 text-slate-500' };
        
        if (now < start) return { status: 'upcoming', text: 'Sắp diễn ra', color: 'bg-amber-100 text-amber-700 border-amber-200' };
        if (now >= start && now <= end) return { status: 'ongoing', text: 'Đang diễn ra', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
        return { status: 'ended', text: 'Đã kết thúc', color: 'bg-rose-100 text-rose-700 border-rose-200' };
    };

    const enterExam = (exam: ExamConfig) => {
        const status = getExamStatus(exam).status;
        if (status === 'upcoming') {
            alert('Bài thi chưa tới giờ bắt đầu!');
            return;
        }
        if (status === 'ended') {
            alert('Bài thi đã kết thúc!');
            return;
        }

        if (exam.versions.length === 0) {
            alert('Bài thi chưa có mã đề!');
            return;
        }

        // Chọn mã đề ngẫu nhiên
        const randomVersion = exam.versions[Math.floor(Math.random() * exam.versions.length)];
        
        setCurrentExam(exam);
        setCurrentVersionId(randomVersion.id);
        setStudentAnswers({ part1: {}, part2: {}, part3: {}, part4: {} });
        setCheatWarnings(0);
        setIsExamViolated(false);
        hiddenTimeRef.current = null;
        
        let startPart: 'p1'|'p2'|'p3'|'p4' = 'p1';
        if (exam.part1Count > 0) startPart = 'p1';
        else if (exam.part2Count > 0) startPart = 'p2';
        else if (exam.part3Count > 0) startPart = 'p3';
        else if (exam.part4Count > 0) startPart = 'p4';
        
        setQuizActiveTab(startPart);
        setQuizActiveQ(1);
        
        // Tính thời gian còn lại từ thời điểm hiện tại đến lúc kết thúc bài thi
        const now = new Date().getTime();
        const end = new Date(exam.endTime).getTime();
        const timeLeftSeconds = Math.max(0, Math.floor((end - now) / 1000));
        setQuizTimeLeft(timeLeftSeconds);
        
        setState('QUIZ');
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

    const updateAnsPart1 = (q: number, ans: string) => setStudentAnswers(prev => ({ ...prev, part1: { ...prev.part1, [q]: ans }}));
    const updateAnsPart2 = (q: number, sub: 'a'|'b'|'c'|'d', val: boolean) => setStudentAnswers(prev => ({ ...prev, part2: { ...prev.part2, [q]: { ...(prev.part2[q] || {}), [sub]: val } } }));
    const updateAnsPart3 = (q: number, text: string) => setStudentAnswers(prev => ({ ...prev, part3: { ...prev.part3, [q]: text }}));
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

    if (state === 'DASHBOARD') {
        return (
            <div className="font-sans text-slate-900 bg-slate-50 min-h-screen flex flex-col">
                <header className="flex justify-between items-center px-6 h-16 bg-white border-b border-slate-200 shadow-sm shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center"><BookOpen size={16} className="text-white"/></div>
                        <span className="text-xl font-black text-blue-700 tracking-tight">EduTest Pro</span>
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded ml-2 uppercase tracking-widest border border-amber-200">Cổng Học Sinh</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <p className="text-sm font-bold text-slate-800">{user.name}</p>
                            <p className="text-[11px] font-medium text-slate-500">Mã HS: {user.studentId} | Lớp: {user.className}</p>
                        </div>
                        <button onClick={onLogout} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors font-bold text-sm border border-red-100">
                            <LogOut size={16} /> Thoát
                        </button>
                    </div>
                </header>

                <main className="flex-1 p-6 lg:p-10 max-w-6xl mx-auto w-full">
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Clock className="text-blue-600" /> Bài thi của tôi
                        </h1>
                        <p className="text-slate-500 mt-1">Danh sách các bài thi được giao cho lớp {user.className}</p>
                    </div>

                    {exams.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                <BookOpen size={32} className="text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700 mb-1">Chưa có bài thi nào</h3>
                            <p className="text-slate-500">Hiện tại giáo viên chưa giao bài thi nào cho lớp của bạn.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {exams.map(exam => {
                                const { status, text, color } = getExamStatus(exam);
                                return (
                                    <div key={exam.internalId} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all hover:border-blue-200 group flex flex-col">
                                        <div className="p-5 border-b border-slate-100 flex-1">
                                            <div className="flex justify-between items-start mb-3">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${color}`}>
                                                    {text}
                                                </span>
                                                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{exam.subject}</span>
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-800 mb-2 leading-tight group-hover:text-blue-700 transition-colors">{exam.examName}</h3>
                                            <div className="space-y-1.5 mt-4">
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                    <strong>Bắt đầu:</strong> {new Date(exam.startTime).toLocaleString('vi-VN')}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                    <strong>Kết thúc:</strong> {new Date(exam.endTime).toLocaleString('vi-VN')}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-slate-50 border-t border-slate-100">
                                            <button 
                                                onClick={() => enterExam(exam)}
                                                disabled={status !== 'ongoing'}
                                                className={`w-full py-2.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-sm ${status === 'ongoing' ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                                            >
                                                {status === 'ongoing' ? 'Vào Thi Ngay' : status === 'upcoming' ? 'Chưa tới giờ' : 'Đã kết thúc'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>
        );
    }

    if (state === 'QUIZ' && currentExam) {
        let activeCount = 0;
        if (quizActiveTab === 'p1') activeCount = currentExam.part1Count;
        else if (quizActiveTab === 'p2') activeCount = currentExam.part2Count;
        else if (quizActiveTab === 'p3') activeCount = currentExam.part3Count;
        else if (quizActiveTab === 'p4') activeCount = currentExam.part4Count;

        const studentVersion = currentExam.versions.find(v => v.id === currentVersionId) || currentExam.versions[0];

        const renderQuizOptBtn = (isSelected: boolean, text: string, onClick: () => void) => (
            <button 
                key={text}
                onClick={onClick}
                className={`w-12 h-12 rounded-full font-bold text-lg flex items-center justify-center transition-all duration-200 border-2 ${
                    isSelected ? 'bg-teal-500 border-teal-500 text-white shadow-[0_4px_12px_rgba(20,184,166,0.4)] scale-105' : 'bg-white border-slate-200 text-slate-600 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50/30'
                }`}
            >
                {text}
            </button>
        );

        return (
            <div className="flex-1 flex overflow-hidden bg-slate-200 h-screen flex-row">
                {/* Left: PDF */}
                <div className="flex-1 bg-slate-500 flex flex-col relative min-h-0">
                    <div className="bg-white/95 backdrop-blur shadow-sm px-6 py-3 z-10 border-b border-slate-200 flex items-center">
                        <div className="w-2 h-6 bg-teal-500 rounded-full mr-3"></div>
                        <h1 className="font-black text-lg text-slate-800 tracking-tight">{currentExam.examName}</h1>
                    </div>
                    <div style={{ flex: 1, margin: '8px', overflow: 'hidden', background: 'white', borderRadius: 12 }}>
                        {studentVersion?.pdfUrl ? (
                            <CustomPdfViewer url={studentVersion.pdfUrl} heightOffset={120} />
                        ) : (
                            <div style={{ height: 'calc(100vh - 160px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>picture_as_pdf</span>
                                    <p style={{ fontWeight: 700 }}>Chưa tải tệp PDF đề thi</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Quiz Control Panel */}
                <div className="w-[350px] lg:w-[420px] bg-white flex flex-col z-10 shadow-2xl border-l border-slate-200 h-full">
                    
                    {/* Header Modern Tech Theme */}
                    <div className="bg-slate-900 p-4 pb-5 text-white flex flex-col items-center relative overflow-hidden rounded-bl-3xl shrink-0">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-emerald-400"></div>
                        <div className="w-full flex justify-between items-center mb-3 text-[11px] font-semibold tracking-wider opacity-90">
                            <div className="flex items-center gap-2">
                                <span className="bg-slate-800 px-3 py-1 rounded-full text-teal-400 border border-slate-700 shadow-sm flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px]">qr_code_2</span> Mã đề: {studentVersion?.code || 'MÃ ĐỀ'}
                                </span>
                                {currentExam.antiCheatEnabled !== false && (
                                    <span className={`bg-slate-800 px-2 py-1 flex items-center gap-1 rounded-full border shadow-sm cursor-help transition-colors ${cheatWarnings > 0 ? 'text-rose-400 border-rose-500/50' : 'text-slate-400 border-slate-700'}`} title={cheatWarnings > 0 ? `Đã cảnh báo vi phạm ${cheatWarnings} lần. 3 lần sẽ hủy bài.` : 'Hệ thống giám sát gian lận đang kích hoạt'}>
                                        <span className="material-symbols-outlined text-[13px]">{cheatWarnings > 0 ? 'warning' : 'shield_person'}</span>
                                        Vi phạm: {cheatWarnings}/3
                                    </span>
                                )}
                            </div>
                            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px] text-teal-400">hourglass_top</span> Còn lại</span>
                        </div>
                        <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 px-6 py-2 rounded-2xl shadow-inner flex items-center justify-center w-full max-w-[250px]">
                            <span className={`text-4xl font-black tracking-widest ${quizTimeLeft <= 300 ? 'text-rose-500 animate-pulse' : 'text-white'}`} style={{fontFamily: 'monospace'}}>
                                {formatTime(quizTimeLeft)}
                            </span>
                        </div>
                    </div>

                    {/* Tabs (Pill style) */}
                    <div className="flex px-4 py-5 gap-2 bg-slate-50 overflow-x-auto hide-scrollbar border-b border-slate-200 shrink-0">
                        {currentExam.part1Count > 0 && (
                            <button onClick={() => { setQuizActiveTab('p1'); setQuizActiveQ(null); }} className={`px-5 py-2.5 rounded-full font-bold text-[11px] uppercase tracking-wider whitespace-nowrap transition-all flex flex-col items-center gap-0.5 ${quizActiveTab === 'p1' ? 'bg-teal-500 text-white shadow-md shadow-teal-500/30' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                                <span>Trắc nghiệm</span><span className="text-[10px] opacity-80 font-medium">({currentExam.part1Count})</span>
                            </button>
                        )}
                        {currentExam.part2Count > 0 && (
                            <button onClick={() => { setQuizActiveTab('p2'); setQuizActiveQ(null); }} className={`px-5 py-2.5 rounded-full font-bold text-[11px] uppercase tracking-wider whitespace-nowrap transition-all flex flex-col items-center gap-0.5 ${quizActiveTab === 'p2' ? 'bg-teal-500 text-white shadow-md shadow-teal-500/30' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                                <span>Đúng/Sai</span><span className="text-[10px] opacity-80 font-medium">({currentExam.part2Count})</span>
                            </button>
                        )}
                        {currentExam.part3Count > 0 && (
                            <button onClick={() => { setQuizActiveTab('p3'); setQuizActiveQ(null); }} className={`px-5 py-2.5 rounded-full font-bold text-[11px] uppercase tracking-wider whitespace-nowrap transition-all flex flex-col items-center gap-0.5 ${quizActiveTab === 'p3' ? 'bg-teal-500 text-white shadow-md shadow-teal-500/30' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                                <span>TL Ngắn</span><span className="text-[10px] opacity-80 font-medium">({currentExam.part3Count})</span>
                            </button>
                        )}
                        {currentExam.part4Count > 0 && (
                            <button onClick={() => { setQuizActiveTab('p4'); setQuizActiveQ(null); }} className={`px-5 py-2.5 rounded-full font-bold text-[11px] uppercase tracking-wider whitespace-nowrap transition-all flex flex-col items-center gap-0.5 ${quizActiveTab === 'p4' ? 'bg-teal-500 text-white shadow-md shadow-teal-500/30' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                                <span>Tự luận</span><span className="text-[10px] opacity-80 font-medium">({currentExam.part4Count})</span>
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 flex flex-col bg-slate-50/50">
                        <div className="text-xs font-bold text-teal-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                            Phần {quizActiveTab === 'p1' ? 'I. Trắc nghiệm' : quizActiveTab === 'p2' ? 'II. Đúng/Sai' : quizActiveTab === 'p3' ? 'III. Trả lời ngắn' : 'IV. Tự luận'}
                        </div>

                        {/* Question Grid Navigator with Inline Popovers */}
                        <div className="grid grid-cols-6 md:grid-cols-7 gap-3 mb-6 relative">
                            {Array.from({length: activeCount}).map((_, idx) => {
                                const qNum = idx + 1;
                                const isActive = quizActiveQ === qNum;
                                const isAnswered = isQuestionAnswered(quizActiveTab, qNum);
                                
                                // Simple positioning heuristic to prevent off-screen popovers
                                const popoverPosClass = (idx % 6 < 2) ? 'left-[-10px]' : (idx % 6 > 3) ? 'right-[-10px]' : 'left-1/2 -translate-x-1/2';

                                return (
                                    <div key={`nav-${qNum}`} className="relative flex justify-center">
                                        <button 
                                            onClick={() => setQuizActiveQ(isActive ? null : qNum)}
                                            className={`w-10 h-10 rounded-full text-xs font-bold transition-all flex items-center justify-center ${
                                                isActive ? 'bg-teal-500 text-white shadow-[0_0_15px_rgba(20,184,166,0.5)] scale-110 z-10 relative' : 
                                                isAnswered ? 'bg-teal-50 text-teal-700 border-2 border-teal-200' : 
                                                'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
                                            }`}
                                        >
                                            {qNum}
                                        </button>

                                        {isActive && (
                                            <div className={`absolute top-12 z-50 bg-white p-4 rounded-xl border border-slate-200 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] w-[280px] sm:w-[320px] ${popoverPosClass} origin-top animate-in fade-in zoom-in-95 duration-200`}>
                                                
                                                <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                                                    <span className="font-bold text-slate-700 text-sm">Câu {qNum}</span>
                                                    <button onClick={() => setQuizActiveQ(null)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                        <span className="material-symbols-outlined text-[18px]">close</span>
                                                    </button>
                                                </div>

                                                {/* Part 1 */}
                                                {quizActiveTab === 'p1' && (
                                                    <div className="flex justify-between gap-2">
                                                        {['A', 'B', 'C', 'D'].map(opt => (
                                                            <button 
                                                                key={opt}
                                                                onClick={() => { 
                                                                    updateAnsPart1(qNum, opt); 
                                                                    // Tự động đóng sau khi chọn Part 1
                                                                    setTimeout(() => setQuizActiveQ(null), 150);
                                                                }}
                                                                className={`flex-1 aspect-square rounded-xl font-bold text-lg transition-all border-2 ${studentAnswers.part1[qNum] === opt ? 'bg-teal-500 border-teal-500 text-white shadow-md scale-105' : 'bg-white border-slate-200 text-slate-600 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-600'}`}
                                                            >
                                                                {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Part 2 */}
                                                {quizActiveTab === 'p2' && (
                                                    <div className="space-y-2">
                                                        {(['a', 'b', 'c', 'd'] as const).map(sub => {
                                                            const val = studentAnswers.part2[qNum]?.[sub];
                                                            return (
                                                                <div key={sub} className="flex items-center justify-between gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                                    <span className="font-bold text-slate-600 text-lg uppercase w-6 text-center">{sub}</span>
                                                                    <div className="flex gap-2">
                                                                        <button onClick={() => updateAnsPart2(qNum, sub, true)} className={`w-14 h-9 rounded-md font-bold text-sm transition-colors border ${val === true ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-400 hover:text-emerald-500'}`}>ĐÚNG</button>
                                                                        <button onClick={() => updateAnsPart2(qNum, sub, false)} className={`w-14 h-9 rounded-md font-bold text-sm transition-colors border ${val === false ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-rose-400 hover:text-rose-500'}`}>SAI</button>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                        <div className="flex justify-end mt-3">
                                                            <button onClick={() => setQuizActiveQ(null)} className="w-full text-sm bg-teal-500 hover:bg-teal-600 text-white px-3 py-2 rounded-lg font-bold transition-colors">Xong</button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Part 3 */}
                                                {quizActiveTab === 'p3' && (
                                                    <div className="flex flex-col gap-3">
                                                        <input 
                                                            type="text" 
                                                            value={studentAnswers.part3[qNum] || ''} 
                                                            onChange={e => updateAnsPart3(qNum, e.target.value)} 
                                                            placeholder="Nhập đáp án ngắn..." 
                                                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-teal-500 outline-none font-bold text-lg text-slate-700 bg-white"
                                                            autoFocus
                                                        />
                                                        <button onClick={() => setQuizActiveQ(null)} className="w-full text-sm bg-teal-500 hover:bg-teal-600 text-white px-3 py-2 rounded-lg font-bold transition-colors">Lưu & Đóng</button>
                                                    </div>
                                                )}

                                                {/* Part 4 */}
                                                {quizActiveTab === 'p4' && (
                                                    <div className="flex flex-col items-center">
                                                        <label className="cursor-pointer bg-slate-50 text-indigo-600 px-4 py-3 rounded-lg border-2 border-dashed border-indigo-300 hover:bg-indigo-50 font-bold flex items-center gap-2 mb-3 w-full justify-center transition-colors text-sm">
                                                            <span className="material-symbols-outlined text-[20px]">add_a_photo</span> Tải hình ảnh bài làm
                                                            <input type="file" accept="image/*" multiple onChange={e => updateAnsPart4(qNum, e)} className="hidden" />
                                                        </label>
                                                        
                                                        {(studentAnswers.part4[qNum] || []).length > 0 && (
                                                            <div className="grid grid-cols-3 gap-2 w-full mb-3 max-h-[200px] overflow-y-auto pr-1">
                                                                {(studentAnswers.part4[qNum] || []).map((url, iIndex) => (
                                                                    <div key={iIndex} className="relative group rounded-md overflow-hidden border border-slate-200 aspect-square bg-white shrink-0">
                                                                         <img src={url} className="w-full h-full object-cover" />
                                                                         <button onClick={() => removePart4Image(qNum, iIndex)} className="absolute top-1 right-1 bg-black/60 text-white w-5 h-5 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600"><span className="material-symbols-outlined text-[12px]">close</span></button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <button onClick={() => setQuizActiveQ(null)} className="w-full text-sm bg-teal-500 hover:bg-teal-600 text-white px-3 py-2 rounded-lg font-bold transition-colors">Hoàn tất</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Footer Navigation */}
                    <div className="p-5 bg-white border-t border-slate-200 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] rounded-tl-3xl relative z-20 shrink-0">
                        {confirmSubmit ? (
                            <div className="flex flex-col gap-2 w-full">
                                <div className="text-sm font-bold text-slate-600 text-center mb-1">Xác nhận nộp bài?</div>
                                <div className="flex gap-2">
                                    <button onClick={() => setConfirmSubmit(false)} className="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">Hủy</button>
                                    <button onClick={() => { setConfirmSubmit(false); submitQuizAndSync(); }} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-2xl font-black tracking-wide transition-colors">Nộp</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setConfirmSubmit(true)} className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white py-4 rounded-2xl font-black text-lg tracking-widest flex justify-center items-center gap-2 shadow-[0_10px_20px_rgba(20,184,166,0.3)] transition-all active:scale-95">
                                NỘP BÀI THI <span className="material-symbols-outlined">send</span>
                            </button>
                        )}
                    </div>

                </div>
            </div>
        );
    }

    if (state === 'RESULT' && currentExam) {
        const studentVersion = currentExam.versions.find(v => v.id === currentVersionId) || currentExam.versions[0];
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
            <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col items-center justify-center p-8 min-h-screen py-12">
                <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 border-t-8 border-indigo-600 text-center">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isExamViolated ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                        <span className="material-symbols-outlined text-5xl">{isExamViolated ? 'warning' : 'task_alt'}</span>
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">{isExamViolated ? 'Hủy BÀI THI' : 'Đã nộp bài:'} {currentExam.examName}</h2>
                    <p className="text-slate-500 mb-6 font-bold">Mã đề: {studentVersion.code} | Lớp: {user.className}</p>
                    
                    {isExamViolated && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
                            Bài thi của bạn đã bị buộc kết thúc do vi phạm quy chế (ra khỏi màn hình làm bài &gt;= 3 lần).
                        </div>
                    )}
                    
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

                    <div className="mt-8 flex justify-center gap-4">
                        <button 
                            onClick={() => {
                                setState('DASHBOARD');
                                setCurrentExam(null);
                                setCurrentVersionId(null);
                                setStudentAnswers({ part1: {}, part2: {}, part3: {}, part4: {} });
                                setQuizActiveTab('p1');
                                setQuizActiveQ(null);
                                setQuizTimeLeft(0);
                                setCheatWarnings(0);
                                setIsExamViolated(false);
                            }} 
                            className="bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-xl font-bold transition-colors"
                        >
                            Về trang Chủ
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen text-slate-500 bg-slate-50">
            <div className="text-center">
                <span className="material-symbols-outlined text-4xl mb-2 text-slate-400">error_outline</span>
                <p className="font-bold">Đã xảy ra lỗi hiển thị (Trạng thái không hợp lệ: {state}).</p>
                <button onClick={() => setState('DASHBOARD')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">Quay lại Dashboard</button>
            </div>
        </div>
    );
}
