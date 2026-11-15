import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Compass, Calendar, MessageSquare, User } from 'lucide-react';
import './BottomNavigation.css';

const NAV_ITEMS = [
    { path: '/matcher', label: 'Tìm kiếm', icon: Compass },
    { path: '/sessions', label: 'Lịch học', icon: Calendar },
    { path: '/messages', label: 'Tin nhắn', icon: MessageSquare },
    { path: '/profile', label: 'Cá nhân', icon: User },
];

export default function BottomNav() {
    const location = useLocation();
    const demoId = new URLSearchParams(location.search).get('as');
    const demoSearch = import.meta.env.VITE_BOOKING_DEMO === 'true' && demoId ? `?as=${encodeURIComponent(demoId)}` : '';
    return (
        <nav className="bottom-nav">
            {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                    <NavLink
                        key={item.path}
                        to={`${item.path}${demoSearch}`}
                        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
                    >
                        <Icon size={22} className="bottom-nav-icon" />
                        <span className="bottom-nav-label">{item.label}</span>
                    </NavLink>
                );
            })}
        </nav>
    );
}
