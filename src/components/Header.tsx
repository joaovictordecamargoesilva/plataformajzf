import React from 'react';
import Icon from './Icon';
import { User, AppNotification, Client } from '../types';
import NotificationBell from './NotificationBell';

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
  title: string;
  notifications: AppNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
  activeClientId: number | null;
  handleSwitchClient: (clientId: number) => void;
  clients: Client[];
  setIsLoading: (loading: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ currentUser, onLogout, title, notifications, setNotifications, activeClientId, handleSwitchClient, clients, setIsLoading }) => {
  const canSwitchClients = currentUser.role === 'Cliente' && currentUser.clientIds && currentUser.clientIds.length > 1;

  return (
    <header className="flex items-center justify-between h-20 px-8 bg-white border-b border-gray-200 flex-shrink-0">
      <h2 className="text-2xl font-semibold text-black">{title}</h2>
      <div className="flex items-center space-x-6">
        
        {canSwitchClients && (
            <div className="relative">
                <Icon path="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m-1 4h1m5-4h1m-1 4h1" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"/>
                <select
                    id="client-switcher"
                    value={activeClientId ?? ''}
                    onChange={(e) => handleSwitchClient(Number(e.target.value))}
                    className="appearance-none block w-full pl-10 pr-8 py-2 text-base border border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                    aria-label="Selecionar Empresa"
                >
                    {currentUser.clientIds!.map(id => {
                        const client = clients.find(c => c.id === id);
                        return client ? <option key={id} value={id}>{client.company}</option> : null;
                    })}
                </select>
            </div>
        )}

        <NotificationBell 
            currentUser={currentUser}
            notifications={notifications}
            setNotifications={setNotifications}
            setIsLoading={setIsLoading}
        />

        <div className="flex items-center">
          <img
            className="h-10 w-10 rounded-full object-cover"
            src={`https://ui-avatars.com/api/?name=${currentUser.name.replace(' ', '+')}&background=922c26&color=fff`}
            alt="User avatar"
          />
          <div className="ml-3 text-right">
            <p className="text-sm font-medium text-text-primary">{currentUser.name}</p>
            <p className="text-xs text-gray-600">{currentUser.email}</p>
          </div>
           <button onClick={onLogout} className="ml-4 text-gray-500 hover:text-primary" aria-label="Sair">
             <Icon path="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" className="w-6 h-6" />
           </button>
        </div>
      </div>
    </header>
  );
};

export default Header;