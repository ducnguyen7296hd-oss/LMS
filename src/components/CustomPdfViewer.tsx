import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Dùng Vite để import đường dẫn tĩnh của file worker từ node_modules
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Cấu hình Worker PDF.js dùng file cục bộ, không phụ thuộc CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface CustomPdfViewerProps {
  url: string;
  heightOffset?: number;
}

export function CustomPdfViewer({ url, heightOffset = 140 }: CustomPdfViewerProps) {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const renderTasksRef = useRef<{ [key: number]: any }>({});

  // Chiều cao khung viewer
  const viewerHeight = `calc(100vh - ${heightOffset + 52}px)`;

  // ======= Tải PDF =======
  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: url,
          cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
        });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
        setPageInputValue('1');
        setIsLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Lỗi tải PDF:', err);
        setError(err?.message || 'Không thể tải tệp PDF');
        setIsLoading(false);
      }
    };

    if (url) loadPdf();
    return () => { cancelled = true; };
  }, [url]);

  // ======= Render một trang =======
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || renderedPages.has(pageNum)) return;

    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const container = canvasContainerRefs.current[pageNum];
      if (!container) return;

      // Xóa nội dung cũ
      container.innerHTML = '';

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';
      container.appendChild(canvas);

      // Hủy render task cũ nếu có
      if (renderTasksRef.current[pageNum]) {
        renderTasksRef.current[pageNum].cancel();
      }

      const renderTask = page.render({
        canvasContext: context,
        viewport: viewport,
      });
      renderTasksRef.current[pageNum] = renderTask;

      await renderTask.promise;
      setRenderedPages(prev => new Set(prev).add(pageNum));
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error(`Lỗi render trang ${pageNum}:`, err);
      }
    }
  }, [pdfDoc, scale, renderedPages]);

  // ======= Render tất cả trang khi PDF loaded hoặc zoom thay đổi =======
  useEffect(() => {
    if (!pdfDoc) return;
    setRenderedPages(new Set()); // Reset khi scale thay đổi

    const renderAll = async () => {
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale });
        const container = canvasContainerRefs.current[i];
        if (!container) continue;

        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        container.appendChild(canvas);

        try {
          await page.render({ canvasContext: context, viewport }).promise;
        } catch (err: any) {
          if (err?.name !== 'RenderingCancelledException') {
            console.error(`Lỗi render trang ${i}:`, err);
          }
        }
      }
    };

    // Delay nhỏ để đảm bảo refs đã gắn
    const timer = setTimeout(renderAll, 50);
    return () => clearTimeout(timer);
  }, [pdfDoc, scale]);

  // ======= Theo dõi trang hiện tại khi scroll =======
  useEffect(() => {
    const container = containerRef.current;
    if (!container || totalPages === 0) return;

    const handleScroll = () => {
      const containerTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const midPoint = containerTop + containerHeight / 3;

      for (let i = 1; i <= totalPages; i++) {
        const pageEl = canvasContainerRefs.current[i];
        if (!pageEl) continue;
        const pageTop = pageEl.offsetTop - container.offsetTop;
        const pageBottom = pageTop + pageEl.offsetHeight;

        if (midPoint >= pageTop && midPoint < pageBottom) {
          if (currentPage !== i) {
            setCurrentPage(i);
            setPageInputValue(String(i));
          }
          break;
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [totalPages, currentPage]);

  // ======= Điều hướng trang =======
  const goToPage = (page: number) => {
    const p = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(p);
    setPageInputValue(String(p));
    const pageEl = canvasContainerRefs.current[p];
    if (pageEl && containerRef.current) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePageInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = parseInt(pageInputValue);
      if (!isNaN(val)) goToPage(val);
    }
  };

  // ======= Zoom =======
  const zoomIn = () => setScale(s => Math.min(s + 0.2, 3.0));
  const zoomOut = () => setScale(s => Math.max(s - 0.2, 0.4));
  const zoomFit = () => {
    if (!pdfDoc || !containerRef.current) return;
    pdfDoc.getPage(1).then((page: any) => {
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = containerRef.current!.clientWidth - 40; // padding
      const newScale = containerWidth / viewport.width;
      setScale(Math.min(newScale, 2.5));
    });
  };

  // ======= RENDER: Loading =======
  if (isLoading) {
    return (
      <div style={{ width: '100%', height: `calc(100vh - ${heightOffset}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ width: 44, height: 44, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'pdfspin 0.8s linear infinite' }} />
        <p style={{ marginTop: 16, fontWeight: 700, color: '#64748b', fontSize: 14 }}>Đang tải tài liệu PDF...</p>
        <style>{`@keyframes pdfspin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ======= RENDER: Error =======
  if (error) {
    return (
      <div style={{ width: '100%', height: `calc(100vh - ${heightOffset}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', padding: 24, textAlign: 'center' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#ef4444', marginBottom: 12 }}>error</span>
        <p style={{ fontWeight: 700, color: '#991b1b', marginBottom: 8, fontSize: 16 }}>Không thể hiển thị PDF</p>
        <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 20, maxWidth: 400 }}>{error}</p>
        <a href={url} target="_blank" rel="noopener noreferrer"
          style={{ padding: '10px 24px', background: '#6366f1', color: 'white', fontWeight: 600, borderRadius: 8, textDecoration: 'none', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
          Mở trong tab mới
        </a>
      </div>
    );
  }

  // ======= RENDER: PDF Viewer =======
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ===== TOOLBAR ===== */}
      <div style={{
        background: '#323639',
        padding: '4px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 52,
        boxSizing: 'border-box',
        gap: 8,
        flexShrink: 0,
      }}>
        {/* Bên trái: Điều hướng trang */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}
            style={{ ...toolbarBtnStyle, opacity: currentPage <= 1 ? 0.3 : 1 }} title="Trang trước">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_left</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#d1d5db', fontSize: 13, fontWeight: 600 }}>
            <input
              value={pageInputValue}
              onChange={e => setPageInputValue(e.target.value)}
              onKeyDown={handlePageInput}
              onBlur={() => { const v = parseInt(pageInputValue); if (!isNaN(v)) goToPage(v); }}
              style={{ width: 36, textAlign: 'center', background: '#4a4d50', color: 'white', border: '1px solid #5f6368', borderRadius: 4, padding: '2px 4px', fontSize: 13, fontWeight: 600, outline: 'none' }}
            />
            <span>của {totalPages}</span>
          </div>
          <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}
            style={{ ...toolbarBtnStyle, opacity: currentPage >= totalPages ? 0.3 : 1 }} title="Trang sau">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_right</span>
          </button>
        </div>

        {/* Giữa: Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={zoomOut} style={toolbarBtnStyle} title="Thu nhỏ">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>remove</span>
          </button>
          <span style={{ color: '#d1d5db', fontSize: 12, fontWeight: 600, minWidth: 44, textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          <button onClick={zoomIn} style={toolbarBtnStyle} title="Phóng to">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          </button>
          <div style={{ width: 1, height: 20, background: '#5f6368', margin: '0 4px' }} />
          <button onClick={zoomFit} style={toolbarBtnStyle} title="Vừa chiều rộng">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>fit_width</span>
          </button>
        </div>

        {/* Bên phải: Tiện ích */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <a href={url} download style={toolbarBtnStyle as any} title="Tải xuống">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
          </a>
          <a href={url} target="_blank" rel="noopener noreferrer" style={toolbarBtnStyle as any} title="Mở tab mới">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span>
          </a>
        </div>
      </div>

      {/* ===== VÙNG HIỂN THỊ PDF (SCROLL) ===== */}
      <div
        ref={containerRef}
        style={{
          height: viewerHeight,
          overflowY: 'auto',
          overflowX: 'auto',
          background: '#525659',
          padding: '16px 0',
        }}
      >
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
          <div
            key={pageNum}
            ref={el => { canvasContainerRefs.current[pageNum] = el; }}
            style={{
              marginBottom: 12,
              background: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginLeft: 'auto',
              marginRight: 'auto',
              position: 'relative',
            }}
          >
            {/* Số trang nhỏ góc dưới */}
          </div>
        ))}
      </div>
    </div>
  );
}

// Style cho các nút trên toolbar
const toolbarBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#d1d5db',
  cursor: 'pointer',
  borderRadius: 4,
  padding: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  transition: 'background 0.15s',
};
