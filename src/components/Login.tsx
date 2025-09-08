import React, { useState } from 'react';
import { User } from '../types';
import Icon from './Icon';
import ForgotPasswordModal from './ForgotPasswordModal';
import { JZF_LOGO_BASE64 } from '../constants';

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<void>;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotPasswordModalOpen, setForgotPasswordModalOpen] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await onLogin(username, password);
      // On success, App component will reload the page.
    } catch (err: any) {
      setError(err.message || 'Nome de usuário ou senha inválidos.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-center min-h-screen bg-secondary">
        <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-xl">
          <div className="text-center">
              <img src={JZF_LOGO_BASE64} alt="JZF Contabilidade Logo" className="w-48 mx-auto mb-4" />
              <p className="mt-1 text-gray-600">Acesse sua conta para continuar.</p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="relative">
               <label htmlFor="username" className="sr-only">Nome de usuário</label>
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icon path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" className="w-5 h-5 text-gray-400"/>
               </div>
               <input
                id="username"
                name="username"
                type="text"
                required
                className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Nome de usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>
             <div className="relative">
               <label htmlFor="password"className="sr-only">Senha</label>
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icon path="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" className="w-5 h-5 text-gray-400" />
               </div>
               <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-dark transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
             <div className="text-center">
              <button
                type="button"
                onClick={() => setForgotPasswordModalOpen(true)}
                className="font-medium text-sm text-primary hover:text-primary-dark"
              >
                Esqueceu sua senha?
              </button>
            </div>
          </form>
        </div>
      </div>
      <ForgotPasswordModal
        isOpen={isForgotPasswordModalOpen}
        onClose={() => setForgotPasswordModalOpen(false)}
      />
    </>
  );
};

export default Login;