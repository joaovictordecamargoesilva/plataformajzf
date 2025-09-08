import React, { useState, useEffect, useRef } from 'react';
import { User, Client, Opportunity, ComplianceFinding } from '../types';
import * as api from '../services/api';
import Icon from './Icon';

interface ReportsViewProps {
  currentUser: User;
  clients: Client[];
  opportunities: Opportunity[];
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>;
  complianceFindings: ComplianceFinding[];
  setComplianceFindings: React.Dispatch<React.SetStateAction<ComplianceFinding[]>>;
  isRadarRunning: boolean;
  activeClientId: number | null;
}

const ReportsView: React.FC<ReportsViewProps> = ({ currentUser, clients, opportunities, setOpportunities, complianceFindings, setComplianceFindings, isRadarRunning, activeClientId }) => {
    const [isLoadingOpps, setIsLoadingOpps] = useState(false);
    const [isCheckingCompliance, setIsCheckingCompliance] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const timerRef = useRef<number | null>(null);

    // Cooldown timer effect
    useEffect(() => {
        if (cooldown > 0) {
            timerRef.current = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
        }
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [cooldown]);

    const handleManualSearch = async () => {
        if (!activeClientId || isLoadingOpps || isRadarRunning || cooldown > 0) return;
        
        const client = clients.find(c => c.id === activeClientId);
        if (!client) return;

        setIsLoadingOpps(true);
        try {
            const foundOpps: Omit<Opportunity, 'id' | 'clientId' | 'dateFound'>[] = await api.findFinancialOpportunities(client);
            const newOpportunities: Opportunity[] = foundOpps.filter(found => 
                !opportunities.some(existing => 
                    existing.clientId === client.id && 
                    existing.title === found.title && 
                    existing.source === found.source
                )
            ).map((opp) => ({
                ...opp,
                id: `OPP-${Date.now()}-${Math.random()}`,
                clientId: client.id,
                dateFound: new Date().toISOString(),
            } as Opportunity));

            if(newOpportunities.length > 0) {
                setOpportunities(prev => [...prev, ...newOpportunities]);
            } else {
                alert("Nenhuma oportunidade *nova* foi encontrada para sua empresa no momento.");
            }

        } catch (error) {
            console.error("Error during manual search:", error);
            alert("Ocorreu um erro ao buscar oportunidades. A API pode estar temporariamente indisponível ou os limites de uso foram atingidos.");
        } finally {
            setIsLoadingOpps(false);
            setCooldown(60);
        }
    };
    
    const handleCheckCompliance = async () => {
        if (!activeClientId || isCheckingCompliance) return;
        
        const client = clients.find(c => c.id === activeClientId);
        if (!client) return;
    
        setIsCheckingCompliance(true);
    
        try {
            const foundFindings: Omit<ComplianceFinding, 'id' | 'clientId' | 'dateChecked'>[] = await api.checkCompliance(client);
            
            const newFindings: ComplianceFinding[] = foundFindings.map(finding => ({
                ...finding,
                id: `CF-${Date.now()}-${Math.random()}`,
                clientId: client.id,
                dateChecked: new Date().toISOString(),
            } as ComplianceFinding));
            
            setComplianceFindings(prev => [...prev.filter(f => f.clientId !== activeClientId), ...newFindings]);
    
        } catch (error: any) {
            console.error("Error during compliance check:", error);
            alert(`Ocorreu um erro ao verificar as pendências: ${error.message}`);
        } finally {
            setIsCheckingCompliance(false);
        }
    };

    const clientOpportunities = activeClientId ? opportunities.filter(o => o.clientId === activeClientId) : [];
    const clientComplianceFindings = activeClientId ? complianceFindings.filter(f => f.clientId === activeClientId) : [];
    
    const oppsButtonIsDisabled = !activeClientId || isLoadingOpps || isRadarRunning || cooldown > 0;
    const getOppsButtonText = () => {
        if (isLoadingOpps) return 'Buscando...';
        if (isRadarRunning) return 'Radar Automático Ativo';
        if (cooldown > 0) return `Aguarde (${cooldown}s)`;
        return 'Buscar Oportunidades';
    };

    const getDeadlineInfo = (deadline: string | undefined): { text: string, color: string } | null => {
        if (!deadline) return null;
        const deadlineDate = new Date(deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize today's date
        deadlineDate.setHours(23, 59, 59, 999); // Normalize deadline to end of day
        
        const diffTime = deadlineDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const formattedDate = deadlineDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' });

        if (diffDays < 0) {
            return { text: `Expirado em ${formattedDate}`, color: 'text-red-600' };
        }
        if (diffDays <= 7) {
            return { text: `Expira em ${diffDays} dia(s) (${formattedDate})`, color: 'text-yellow-600' };
        }
        return { text: `Prazo: ${formattedDate}`, color: 'text-gray-600' };
    };
    
    const ComplianceCard: React.FC<{finding: ComplianceFinding}> = ({ finding }) => {
        const getStatusInfo = (status: ComplianceFinding['status']) => {
            switch(status) {
                case 'OK': return { badge: 'bg-green-100 text-green-800', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', iconColor: 'text-green-500' };
                case 'Atencao': return { badge: 'bg-yellow-100 text-yellow-800', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', iconColor: 'text-yellow-500' };
                case 'Pendencia': return { badge: 'bg-red-100 text-red-800', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636', iconColor: 'text-red-500' };
                default: return { badge: 'bg-blue-100 text-blue-800', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', iconColor: 'text-blue-500' };
            }
        }
        const statusInfo = getStatusInfo(finding.status);
        
        return (
            <div className="bg-white p-6 rounded-lg shadow-lg flex items-start space-x-4">
                <Icon path={statusInfo.icon} className={`w-8 h-8 ${statusInfo.iconColor} flex-shrink-0 mt-1`} />
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                        <h4 className="text-lg font-bold text-black">{finding.title}</h4>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusInfo.badge} flex-shrink-0`}>{finding.status}</span>
                    </div>
                    <p className="text-text-secondary mt-2">{finding.summary}</p>
                    <div className="text-xs text-gray-500 mt-3 flex items-center">
                        <Icon path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" className="w-4 h-4 mr-1.5" />
                        Verificado em: {new Date(finding.dateChecked).toLocaleString('pt-BR')}
                    </div>
                    <div className="mt-4 pt-3 border-t">
                        <a href={finding.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center break-all">
                            Verificar Fonte <Icon path="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" className="w-4 h-4 ml-1 flex-shrink-0" />
                        </a>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
                <h2 className="text-3xl font-bold text-black mb-4 md:mb-0">Análise e Oportunidades com IA</h2>
                <div className="flex items-center space-x-2">
                     <button
                        onClick={handleCheckCompliance}
                        disabled={!activeClientId || isCheckingCompliance}
                        className="flex items-center bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Icon path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" className={`w-5 h-5 mr-2 ${isCheckingCompliance ? 'animate-pulse' : ''}`} />
                        {isCheckingCompliance ? 'Verificando...' : 'Verificar Pendências'}
                    </button>
                    <button
                        onClick={handleManualSearch}
                        disabled={oppsButtonIsDisabled}
                        className="flex items-center bg-primary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Icon path="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" className={`w-5 h-5 mr-2 ${isLoadingOpps ? 'animate-spin' : ''}`} />
                        {getOppsButtonText()}
                    </button>
                </div>
            </div>
            
             <p className="text-text-secondary mb-8">
                Utilize nossa IA para buscar ativamente por pendências fiscais e legais em fontes públicas ou para encontrar novas oportunidades financeiras, como incentivos e licitações.
            </p>

            {activeClientId ? (
                <>
                <div className="mt-8">
                    <h3 className="text-2xl font-bold text-black mb-4">Radar de Conformidade</h3>
                     <div className="space-y-4">
                        {isCheckingCompliance && 
                            <div className="text-center py-10 bg-white rounded-lg shadow-lg">
                                 <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
                                <p className="text-text-secondary">Buscando em fontes públicas, isso pode levar um momento...</p>
                            </div>
                        }
                        {clientComplianceFindings.length > 0 ? (
                           clientComplianceFindings.map(finding => <ComplianceCard key={finding.id} finding={finding} />)
                        ) : !isCheckingCompliance && (
                            <div className="text-center py-10 bg-white rounded-lg shadow-lg">
                                <p className="text-text-secondary">Nenhuma pendência encontrada. Clique em "Verificar Pendências" para fazer uma nova busca.</p>
                             </div>
                        )}
                    </div>
                </div>

                <div className="mt-8">
                   <h3 className="text-2xl font-bold text-black mb-4">Radar de Oportunidades</h3>
                   <div className="space-y-4">
                      {isLoadingOpps && 
                           <div className="text-center py-10 bg-white rounded-lg shadow-lg">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
                               <p className="text-text-secondary">Buscando novas oportunidades...</p>
                           </div>
                      }
                      {clientOpportunities.length > 0 ? (
                          clientOpportunities.map(opp => (
                              <div key={opp.id} className="bg-white p-6 rounded-lg shadow-lg">
                                  <div className="flex justify-between items-start">
                                      <h4 className="text-lg font-bold text-black flex-1 pr-4">{opp.title}</h4>
                                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${opp.type === 'IncentivoFiscal' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{opp.type}</span>
                                  </div>
                                  <p className="text-text-secondary mt-2">{opp.description}</p>
                                  <div className="mt-4 pt-3 border-t flex justify-between items-center">
                                      <a href={opp.source} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center">
                                          Ver Fonte <Icon path="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" className="w-4 h-4 ml-1" />
                                      </a>
                                      {getDeadlineInfo(opp.submissionDeadline) && (
                                          <span className={`text-sm font-semibold ${getDeadlineInfo(opp.submissionDeadline)!.color}`}>{getDeadlineInfo(opp.submissionDeadline)!.text}</span>
                                      )}
                                  </div>
                              </div>
                          ))
                      ) : !isLoadingOpps && (
                          <div className="text-center py-10 bg-white rounded-lg shadow-lg">
                              <p className="text-text-secondary">Nenhuma oportunidade encontrada. Clique em "Buscar Oportunidades" para fazer uma nova busca.</p>
                          </div>
                      )}
                   </div>
                </div>
               </>
            ) : (
                <div className="text-center py-20 bg-white rounded-lg shadow-lg">
                    <Icon path="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-5.176-5.97M15 21h3a2 2 0 002-2v-1a2 2 0 00-2-2h-3m-9-3.076A5.986 5.986 0 017 9.5a5.986 5.986 0 014.076 2.424M11 15.545A5.986 5.986 0 017 9.5a5.986 5.986 0 014.076-2.424" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-black mb-2">Selecione uma Empresa</h3>
                    <p className="text-text-secondary">Para usar as ferramentas de IA, por favor selecione uma empresa no menu superior.</p>
                </div>
            )}
        </div>
    );
};

export default ReportsView;