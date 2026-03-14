import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    position?: 'top' | 'bottom';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div
            className="relative flex items-center gap-1 cursor-pointer group"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
            style={{ overflow: 'visible' }}
        >
            {children}
            <Info className="w-3 h-3 text-zinc-500 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />

            {isVisible && (
                <div className={`absolute z-50 left-1/2 -translate-x-1/2 w-64 p-3 bg-black/95 backdrop-blur-xl border border-primary/20 rounded-lg shadow-[0_0_20px_rgba(223,254,0,0.1)] pointer-events-none overflow-visible ${position === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'
                    }`}>
                    <div className="text-[10px] font-mono text-zinc-400 normal-case leading-relaxed">
                        {content}
                    </div>
                    {/* Arrow */}
                    <div className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${position === 'bottom' ? 'bottom-full border-b-primary/20' : 'top-full border-t-primary/20'
                        }`} />
                </div>
            )}
        </div>
    );
}
