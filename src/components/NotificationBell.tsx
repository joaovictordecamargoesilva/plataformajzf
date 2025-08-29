import React, { useState, useEffect, useRef } from 'react';
import { User, AppNotification } from '../types';
import Icon from './Icon';
import * as api from '../services/api';

interface NotificationBellProps {
    currentUser: User;
    notifications: AppNotification[];
    setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
    setIsLoading: (loading: boolean) => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ currentUser, notifications, setNotifications, setIsLoading }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const userNotifications = notifications.filter(n => 
        (n.userId === currentUser.id) || // Direct message to user
        (currentUser.role.includes('Admin') && !n.userId) // Broadcast to all admins
    );

    const unreadCount = userNotifications.filter(n => !n.read).length;

    const handleToggle = () => {
        setIsOpen(!isOpen);
    };
    
    const handleMarkAsRead = async (id: number) => {
        setIsLoading(true);
        try {
            const updatedNotifications = await api.markNotificationAsRead(id);
            setNotifications(updatedNotifications);
        } catch(e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleMarkAllAsRead = async () => {
        setIsLoading(true);
        try {
            const updatedNotifications = await api.markAllNotificationsAsRead();
            setNotifications(updatedNotifications);
        } catch(e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={handleToggle} className="relative cursor-pointer" aria-label="Notificações">
                <Icon path="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" className="w-6 h-6 text-gray-500 hover:text-primary" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center ring-2 ring-white">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl z-20">
                    <div className="p-4 flex justify-between items-center border-b">
                        <h4 className="font-bold text-text-primary">Notificações</h4>
                        {unreadCount > 0 && (
                            <button onClick={handleMarkAllAsRead} className="text-sm text-primary hover:underline">Marcar todas como lidas</button>
                        )}
                    </div>
                    <ul className="max-h-96 overflow-y-auto">
                        {userNotifications.length > 0 ? (
                            userNotifications.map(n => (
                                <li key={n.id} className={`p-4 border-b hover:bg-gray-50 ${!n.read ? 'bg-blue-50' : ''}`}>
                                    <p className="text-sm text-gray-700">{n.message}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-xs text-gray-400">{new Date(n.date).toLocaleString('pt-BR')}</p>
                                        {!n.read && (
                                            <button onClick={() => handleMarkAsRead(n.id)} className="text-xs text-blue-500 hover:underline">Marcar como lida</button>
                                        )}
                                    </div>
                                </li>
                            ))
                        ) : (
                            <li className="p-4 text-center text-sm text-gray-500">Nenhuma notificação nova.</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;