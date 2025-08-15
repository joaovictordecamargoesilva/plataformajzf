import React, { useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
    const [email, setEmail] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // In a real application, you would call an API to send a reset email.
        console.log(`Password reset requested for: ${email}`);
        setIsSubmitted(true);
    };

    // Resets the modal state when it's closed
    const handleClose = () => {
        setIsSubmitted(false);
        setEmail('');
        onClose();
    }

    return (
        <Modal isOpen={isOpen} onClose={handleClose}>
            {!isSubmitted ? (
                <form onSubmit={handleSubmit}>
                    <h3 className="text-xl font-semibold mb-2 text-black">Recuperar Senha</h3>
                    <p className="text-gray-600 mb-6">Por favor, insira seu endereço de e-mail. Enviaremos um link para você redefinir sua senha.</p>
                    <div className="relative mb-4">
                        <label htmlFor="email-reset" className="sr-only">Email</label>
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Icon path="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" className="w-5 h-5 text-gray-400"/>
                        </div>
                        <input
                            id="email-reset"
                            name="email"
                            type="email"
                            required
                            className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="seu-email@exemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={handleClose} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                        <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Enviar Link</button>
                    </div>
                </form>
            ) : (
                <div className="text-center p-4">
                    <Icon path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" className="w-16 h-16 text-green-500 mx-auto mb-4"/>
                    <h3 className="text-xl font-semibold mb-2 text-black">Verifique seu E-mail</h3>
                    <p className="text-gray-600 mb-6">Se uma conta com o e-mail <strong>{email}</strong> existir em nosso sistema, um link para redefinição de senha foi enviado.</p>
                    <button onClick={handleClose} className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Ok</button>
                </div>
            )}
        </Modal>
    );
};

export default ForgotPasswordModal;