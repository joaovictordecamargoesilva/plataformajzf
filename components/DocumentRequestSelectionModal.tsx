

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Icon from './Icon';
import { documentRequestLists } from '../constants';

type Category = keyof typeof documentRequestLists;

const categories: Category[] = ['RH', 'Fiscal', 'Contábil', 'Societário'];

interface DocumentRequestSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (documentName: string) => void;
  title?: string;
}

const DocumentRequestSelectionModal: React.FC<DocumentRequestSelectionModalProps> = ({ isOpen, onClose, onSelect, title }) => {
    const [step, setStep] = useState<'categories' | 'list'>('categories');
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const handleCategorySelect = (category: Category) => {
        setSelectedCategory(category);
        setStep('list');
    };

    const handleBack = () => {
        setStep('categories');
        setSelectedCategory(null);
        setSearchTerm('');
    };
    
    const handleClose = () => {
        handleBack();
        onClose();
    }
    
    useEffect(() => {
        if(isOpen) {
            handleBack();
        }
    }, [isOpen]);

    const filteredDocuments = selectedCategory ? documentRequestLists[selectedCategory].filter(doc => 
        doc.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];
    
    const categoryIcons: Record<Category, string> = {
        'RH': 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
        'Fiscal': 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 14l-6-6m5.5.5h.01M9 19h.01M14 19h.01M5 14h.01M5 9h.01',
        'Contábil': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H9a2 2 0 01-2-2V5z',
        'Societário': 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m-1 4h1m5-4h1m-1 4h1'
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} size="lg">
            <div>
                {step === 'categories' ? (
                    <>
                        <h3 className="text-xl font-bold text-black mb-4">{title || 'Solicitar Documento'}</h3>
                        <p className="text-gray-600 mb-6">Selecione a área do documento que você precisa.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {categories.map((cat) => (
                                <button key={cat} onClick={() => handleCategorySelect(cat)} className="flex flex-col items-center justify-center p-6 bg-gray-50 hover:bg-primary-dark/10 rounded-lg transition-colors border">
                                    <Icon path={categoryIcons[cat]} className="w-10 h-10 text-primary mb-3" />
                                    <span className="font-semibold text-text-primary">{cat}</span>
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                       <div className="flex items-center mb-4">
                           <button onClick={handleBack} className="text-primary p-2 rounded-full hover:bg-gray-100 mr-2">
                               <Icon path="M10 19l-7-7m0 0l7-7m-7 7h18" className="w-6 h-6"/>
                           </button>
                           <h3 className="text-xl font-bold text-black">{title || 'Solicitar Documento'}: {selectedCategory}</h3>
                       </div>
                       <div className="relative mb-4">
                            <input
                            type="text"
                            placeholder="Buscar na lista..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Icon path="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" className="w-5 h-5 text-gray-400" />
                            </div>
                        </div>

                       <ul className="space-y-2 max-h-96 overflow-y-auto">
                           {filteredDocuments.map(docName => (
                               <li key={docName}>
                                   <button onClick={() => onSelect(docName)} className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors text-sm text-gray-800">
                                       {docName}
                                   </button>
                               </li>
                           ))}
                       </ul>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default DocumentRequestSelectionModal;