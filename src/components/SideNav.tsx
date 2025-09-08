import React from 'react';
import Icon from './Icon';
import { User, UserPermissions } from '../types';
import { View } from '../App';
import { JZF_LOGO_BASE64_WHITE } from '../constants';

interface SideNavProps {
  currentView: string;
  setCurrentView: (view: View) => void;
  currentUser: User;
  onOpenQuickSend: () => void;
}

const SideNav: React.FC<SideNavProps> = ({ currentView, setCurrentView, currentUser, onOpenQuickSend }) => {
  const isMultiClient = currentUser.role === 'Cliente' && currentUser.clientIds.length > 1;

  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', permissionKey: 'canViewDashboard' },
    { id: 'multi-client-dashboard', label: 'Visão Geral', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2h10a2 2 0 012 2v2', permissionKey: 'canViewDashboard', isMultiClientOnly: true },
    { id: 'clientes', label: 'Clientes', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-5.176-5.97M15 21h3a2 2 0 002-2v-1a2 2 0 00-2-2h-3m-9-3.076A5.986 5.986 0 017 9.5a5.986 5.986 0 014.076 2.424M11 15.545A5.986 5.986 0 017 9.5a5.986 5.986 0 014.076-2.424', permissionKey: 'canManageClients'},
    { id: 'documentos', label: 'Documentos', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', permissionKey: 'canManageDocuments' },
    { id: 'cobranca', label: 'Cobrança', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H7a3 3 0 00-3 3v8a3 3 0 003 3z', permissionKey: 'canManageBilling' },
    { id: 'tarefas', label: 'Tarefas', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', permissionKey: 'canManageTasks' },
    { id: 'ponto', label: 'Folha de Ponto', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', permissionKey: 'canManageTasks' },
    { id: 'relatorios', label: 'Análise & IA', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', permissionKey: 'canViewReports' },
    { id: 'novos-relatorios', label: 'Relatórios', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H9a2 2 0 01-2-2V5z', permissionKey: 'canViewReports' },
    { id: 'simulacoes', label: 'Simulações', icon: 'M9 7h6m0 0v6m0-6l-6 6m-3.5-3.5L6 12m6-6l-1.5 1.5', permissionKey: 'canViewReports' },
    { id: 'quicksend', label: 'Envio Rápido', icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z', isAction: true }, // Action Item
    { id: 'administradores', label: 'Administradores', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', permissionKey: 'canManageAdmins' },
    { id: 'configuracoes', label: 'Configurações', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0 3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826 3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z', permissionKey: 'canManageSettings' },
  ];
  
  const getVisibleNavItems = () => {
      if(currentUser.role === 'Cliente') {
          let clientViews = ['documentos', 'cobranca', 'tarefas', 'ponto', 'relatorios', 'simulacoes', 'quicksend'];
          if (isMultiClient) {
              clientViews.unshift('multi-client-dashboard');
          } else {
              clientViews.unshift('dashboard');
          }
          return allNavItems.filter(item => clientViews.includes(item.id));
      }

      if(currentUser.role === 'AdminGeral') {
          return allNavItems.filter(item => !item.isAction && !item.isMultiClientOnly);
      }

      if(currentUser.role === 'AdminLimitado' && currentUser.permissions){
          return allNavItems.filter(item => {
              if (item.isAction || item.isMultiClientOnly) return false;
              const permissionKey = item.permissionKey as keyof UserPermissions;
              return currentUser.permissions![permissionKey];
          });
      }
      return [];
  }
  
  const navItems = getVisibleNavItems();


  const NavLink: React.FC<{
    item: typeof navItems[0];
    isActive: boolean;
    onClick: () => void;
  }> = ({ item, isActive, onClick }) => (
    <li
      className={`flex items-center p-4 my-1 font-medium rounded-lg cursor-pointer transition-all duration-200 ${
        isActive
          ? 'bg-primary text-white shadow-lg'
          : 'text-gray-100 hover:bg-black/10 hover:text-white'
      }`}
      onClick={onClick}
      role="menuitem"
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon path={item.icon} className="w-6 h-6 mr-4" />
      <span>{item.label}</span>
    </li>
  );

  return (
    <div className="w-64 bg-primary-dark text-white flex flex-col flex-shrink-0">
      <div className="flex items-center justify-center h-20 border-b border-primary px-4">
        <img src={JZF_LOGO_BASE64_WHITE} alt="JZF Contabilidade Logo" className="h-12" />
      </div>
      <nav className="flex-1 px-2 py-4" role="navigation" aria-label="Navegação Principal">
        <ul role="menu">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              item={item}
              isActive={currentView === item.id && !item.isAction}
              onClick={item.isAction ? onOpenQuickSend : () => setCurrentView(item.id as View)}
            />
          ))}
        </ul>
      </nav>
      <div className="p-4 border-t border-primary">
        <p className="text-sm text-gray-200">&copy; 2024 JZF Contabilidade</p>
      </div>
    </div>
  );
};

export default SideNav;