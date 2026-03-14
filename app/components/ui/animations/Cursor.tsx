'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function Cursor() {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = useState(false);

    useEffect(() => {
        const updateMousePosition = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (
                target.tagName.toLowerCase() === 'button' ||
                target.tagName.toLowerCase() === 'a' ||
                target.closest('button') ||
                target.closest('a') ||
                target.closest('.group')
            ) {
                setIsHovering(true);
            } else {
                setIsHovering(false);
            }
        };

        window.addEventListener('mousemove', updateMousePosition);
        window.addEventListener('mouseover', handleMouseOver);

        return () => {
            window.removeEventListener('mousemove', updateMousePosition);
            window.removeEventListener('mouseover', handleMouseOver);
        };
    }, []);

    const variants = {
        default: {
            x: mousePosition.x - 10,
            y: mousePosition.y - 10,
            scale: 1,
        },
        hover: {
            x: mousePosition.x - 20,
            y: mousePosition.y - 20,
            scale: 2,
            backgroundColor: 'rgba(255, 255, 255, 1)',
            mixBlendMode: 'difference' as any,
        },
    };

    return (
        <motion.div
            className="fixed top-0 left-0 w-5 h-5 bg-primary rounded-full pointer-events-none z-[100] mix-blend-difference hidden md:block"
            variants={variants}
            animate={isHovering ? "hover" : "default"}
            transition={{
                type: "tween",
                ease: "backOut",
                duration: 0.15
            }}
        />
    );
}
