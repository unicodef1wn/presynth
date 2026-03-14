'use client';

declare global {
    interface Window {
        ethereum?: any;
    }
}

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from 'next/navigation';
import { cn } from "../../lib/utils";
import {
    Dna,
    LayoutDashboard,
    BarChart3,
    Activity,
    Menu,
    X,
} from "lucide-react";
import Magnetic from "./animations/Magnetic";

const navItems = [
    { name: 'Home', path: '/', icon: LayoutDashboard },
    { name: 'Markets', path: '/markets', icon: BarChart3 },
    { name: 'Radar', path: '/leaderboard', icon: Activity },
    // { name: 'Traders', path: '/profile', icon: CircleUser }, // Temporarily hidden
];

export function NavBar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
            <nav className="w-full max-w-5xl rounded-full border border-white/10 bg-black/40 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] pb-0">
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-14 w-full relative">
                        <div className="flex items-center gap-8 z-10">
                            <Link href="/" className="flex items-center gap-2 group">
                                <div className="p-1.5 rounded-full bg-white/5 group-hover:bg-primary/20 group-hover:border-primary/50 transition-all border border-white/10">
                                    {mounted && <Dna className="h-5 w-5 text-white group-hover:scale-110 group-hover:text-primary transition-transform" />}
                                </div>
                                <span className="text-xl font-mono font-bold tracking-tighter text-white uppercase">
                                    Pre<span className="text-primary opacity-80">Synth</span>
                                </span>
                            </Link>
                        </div>

                        {/* Desktop Navigation (Centered) */}
                        <div className="hidden md:flex absolute inset-0 justify-center items-center pointer-events-none">
                            <div className="flex items-baseline space-x-1 pointer-events-auto">
                                {navItems.map((item) => {
                                    const isActive = pathname === item.path;
                                    const Icon = item.icon;
                                    return (
                                        <Magnetic key={item.name}>
                                            <button
                                                onClick={() => {
                                                    router.push(item.path);
                                                }}
                                                className={cn(
                                                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300",
                                                    isActive
                                                        ? "text-black bg-white"
                                                        : "text-zinc-400 hover:text-white hover:bg-white/10"
                                                )}
                                            >
                                                {mounted && <Icon className="h-4 w-4" />}
                                                {item.name}
                                            </button>
                                        </Magnetic>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Mobile Menu Button */}
                            <div className="md:hidden">
                                <button
                                    onClick={() => setIsOpen(!isOpen)}
                                    className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    {mounted && (isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />)}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </nav>

            {/* Mobile Navigation */}
            {isOpen && (
                <div className="absolute top-[80px] left-4 right-4 md:hidden bg-[#111114] border border-white/10 rounded-[2rem] p-4 shadow-2xl animate-in slide-in-from-top-4 duration-300">
                    <div className="flex flex-col gap-2">
                        {navItems.map((item) => {
                            const isActive = pathname === item.path;
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.name}
                                    onClick={() => {
                                        setIsOpen(false);
                                        router.push(item.path);
                                    }}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left",
                                        isActive
                                            ? "text-black bg-white"
                                            : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                    )}
                                >
                                    {mounted && <Icon className="h-5 w-5" />}
                                    {item.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
