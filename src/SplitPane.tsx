import React, { useState, useRef, useEffect, ReactNode } from 'react';

interface SplitPaneProps {
    left: ReactNode;
    right: ReactNode;
    initialLeftWidth?: number | string;
    minLeftWidth?: number;
    minRightWidth?: number;
    className?: string;
}

export default function SplitPane({
    left,
    right,
    initialLeftWidth = '50%',
    minLeftWidth = 300,
    minRightWidth = 300,
    className = ''
}: SplitPaneProps) {
    const [leftWidth, setLeftWidth] = useState<number | string>(initialLeftWidth);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            
            let newLeftWidth = e.clientX - containerRect.left;
            
            // Constrain
            if (newLeftWidth < minLeftWidth) newLeftWidth = minLeftWidth;
            if (containerRect.width - newLeftWidth < minRightWidth) {
                newLeftWidth = containerRect.width - minRightWidth;
            }
            
            setLeftWidth(newLeftWidth);
            e.preventDefault();
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, minLeftWidth, minRightWidth]);

    return (
        <div ref={containerRef} className={`flex flex-row w-full h-full overflow-hidden ${className}`}>
            <div style={{ width: leftWidth, flexShrink: 0, height: '100%' }} className="relative flex flex-col">
                {left}
                {isDragging && <div className="absolute inset-0 z-50 cursor-col-resize user-select-none" style={{ pointerEvents: 'auto' }} />}
            </div>
            
            <div 
                className="w-2 bg-slate-200 hover:bg-teal-400 cursor-col-resize flex flex-col items-center justify-center relative z-20 flex-shrink-0 transition-colors group"
                onMouseDown={() => setIsDragging(true)}
            >
                <div className="absolute inset-y-0 -left-2 -right-2 cursor-col-resize" />
                <div className="h-8 w-1 rounded-full bg-slate-400 group-hover:bg-white" />
            </div>
            
            <div className="flex-1 min-w-0 h-full flex flex-col relative">
                {right}
                {isDragging && <div className="absolute inset-0 z-50 cursor-col-resize user-select-none" style={{ pointerEvents: 'auto' }} />}
            </div>
        </div>
    );
}
