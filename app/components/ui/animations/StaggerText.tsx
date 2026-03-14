'use client';

import { motion } from 'framer-motion';

interface StaggerTextProps {
    text: string;
    className?: string;
    delay?: number;
    highlightWords?: string[];
    highlightClass?: string;
}

export const StaggerText = ({
    text,
    className = "",
    delay = 0,
    highlightWords = [],
    highlightClass = ""
}: StaggerTextProps) => {
    // Split text into words, taking care of spaces
    const words = text.split(" ");

    const container = {
        hidden: { opacity: 0 },
        visible: (i = 1) => ({
            opacity: 1,
            transition: { staggerChildren: 0.05, delayChildren: delay * i },
        }),
    };

    const child = {
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: "spring",
                damping: 12,
                stiffness: 100,
            },
        },
        hidden: {
            opacity: 0,
            y: 50,
            transition: {
                type: "spring",
                damping: 12,
                stiffness: 100,
            },
        },
    };

    return (
        <motion.div
            style={{ overflow: "hidden", display: "flex", flexWrap: "wrap", justifyContent: "center" }}
            variants={container}
            initial="hidden"
            animate="visible"
            className={className}
        >
            {words.map((word, index) => {
                // Strip trailing punctuation for highlight matching, if needed
                const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
                const isHighlight = highlightWords.includes(cleanWord) || highlightWords.includes(word);

                return (
                    <motion.span
                        variants={child}
                        key={index}
                        className={`mr-[0.25em] inline-block ${isHighlight ? highlightClass : ''}`}
                    >
                        {word}
                    </motion.span>
                );
            })}
        </motion.div>
    );
};
