import React, { useState, useEffect, useCallback } from 'react';
import { Client, Employee, TimeSheet, User, AppNotification } from '../types';
import Icon from './Icon';
import Modal from './Modal';
import * as api from '../services/api';

interface PontoViewProps {
    clients: Client[];
    employees: Employee[];
    setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
    timeSheets: TimeSheet[];
    setTimeSheets: React.Dispatch<React.SetStateAction<TimeSheet[]>>;
    currentUser: User;
    addNotification: (notification: Omit<AppNotification, 'id' | 'date' | 'read'>) => void;
    users: User[];
    activeClientId: number | null;
    setIsLoading: (loading: boolean) => void;
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const PontoView: React.FC<PontoViewProps> = ({ clients, employees, setEmployees, timeSheets, setTimeSheets, currentUser, addNotification, users, activeClientId, setIsLoading }) => {
    const isClient = currentUser.role === 'Cliente';
    const [selectedClientForAdmin, setSelectedClientForAdmin] = useState<Client | null>(!isClient ? (clients[0] || null) : null);
    const [modalState, setModalState] = useState<{ type: null | 'addEmployee' | 'addTimeSheet' | 'editEmployee'; data?: any }>({ type: null });

    const clientForView = isClient ? clients.find(c => c.id === activeClientId) : selectedClientForAdmin;

    const handleSaveEmployee = async (employeeData: Omit<Employee, 'id' | 'clientId' | 'status'>, editingId: number | null) => {
        if (!clientForView) return;
        setIsLoading(true);
        try {
            if (editingId) {
                const updatedEmployee = await api.updateEmployee(editingId, { ...employeeData, clientId: clientForView.id });
                setEmployees(prev => prev.map(e => e.id === editingId ? updatedEmployee : e));
            } else {
                const newEmployee = await api.createEmployee({ ...employeeData, clientId: clientForView.id });
                setEmployees(prev => [...prev, newEmployee]);
            }
        } catch(error) {
            console.error("Failed to save employee", error);
        } finally {
            setIsLoading(false);
            setModalState({ type: null });
        }
    };

    const handleSaveTimeSheet = async (timeSheetData: Omit<TimeSheet, 'id'>) => {
        setIsLoading(true);
        try {
            const newTimeSheet = await api.saveTimeSheet(timeSheetData);
            setTimeSheets(prev => {
                const existingIndex = prev.findIndex(ts => ts.id === newTimeSheet.id);
                if (existingIndex > -1) {
                    const updated = [...prev];
                    updated[existingIndex] = newTimeSheet;
                    return updated;
                }
                return [...prev, newTimeSheet];
            });
            
            if (isClient && timeSheetData.status === 'EnviadoParaAnalise') {
                const employeeName = employees.find(e => e.id === timeSheetData.employeeId)?.name || '';
                 users.filter(u => u.role.includes('Admin')).forEach(admin => {
                    addNotification({
                        userId: admin.id,
                        message: `${currentUser.name} enviou o ponto de ${employeeName} para análise.`
                    });
                });
            }
        } catch(error) {
            console.error("Failed to save timesheet", error);
        } finally {
            setIsLoading(false);
            setModalState({ type: null });
        }
    };

    const EmployeeModal: React.FC<{ clientName: string, employee?: Employee, onSave: (data: any, id: number | null) => void, onCancel: () => void }> = 
    ({ clientName, employee, onSave, onCancel }) => {
        const [formData, setFormData] = useState({
            name: employee?.name || '',
            role: employee?.role || '',
            salary: employee?.salary || 0,
        });

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const { name, value, type } = e.target;
            setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
        };

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            onSave(formData, employee?.id || null);
        };
        
        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-xl font-semibold mb-2 text-black">{employee ? 'Editar' : 'Adicionar'} Funcionário</h3>
                <p className="text-sm text-gray-500">Cliente: {clientName}</p>
                <input name="name" value={formData.name} onChange={handleChange} placeholder="Nome Completo" className="p-2 border rounded w-full" required />
                <input name="role" value={formData.role} onChange={handleChange} placeholder="Cargo" className="p-2 border rounded w-full" required />
                <input name="salary" type="number" step="0.01" value={formData.salary} onChange={handleChange} placeholder="Salário Base (R$)" className="p-2 border rounded w-full" required />
                <div className="mt-6 flex justify-end space-x-3">
                  <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                  <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Salvar</button>
                </div>
            </form>
        );
    };

    const TimeSheetModal: React.FC<{ employee: Employee, existingSheet?: TimeSheet, onSave: (data: any) => void, onCancel: () => void }> =
    ({ employee, existingSheet, onSave, onCancel }) => {
        const [activeTab, setActiveTab] = useState<'import' | 'manual'>(existingSheet ? 'manual' : 'import');
        const [file, setFile] = useState<File | null>(null);
        const [isAnalyzing, setIsAnalyzing] = useState(false);
        const [error, setError] = useState('');
        const [formData, setFormData] = useState<Omit<TimeSheet, 'id' | 'clientId' | 'employeeId' | 'status'>>({
            month: existingSheet?.month || new Date().getMonth() + 1,
            year: existingSheet?.year || new Date().getFullYear(),
            totalOvertimeHours50: existingSheet?.totalOvertimeHours50 || 0,
            totalOvertimeHours100: existingSheet?.totalOvertimeHours100 || 0,
            totalNightlyHours: existingSheet?.totalNightlyHours || 0,
            totalLatenessMinutes: existingSheet?.totalLatenessMinutes || 0,
            totalAbsencesDays: existingSheet?.totalAbsencesDays || 0,
            dsrValue: existingSheet?.dsrValue || 0,
            aiAnalysisNotes: existingSheet?.aiAnalysisNotes || '',
            sourceFile: existingSheet?.sourceFile
        });
        
        const calculateDsr = useCallback((data: typeof formData) => {
            const businessDays = 22; // Simplified
            const sundaysAndHolidays = 4; // Simplified
            const hourlyRate = employee.salary / 220;
            const overtime50Value = data.totalOvertimeHours50 * hourlyRate * 1.5;
            const overtime100Value = data.totalOvertimeHours100 * hourlyRate * 2.0;
            const nightlyBonusValue = data.totalNightlyHours * hourlyRate * 0.2;
            const totalVariablePay = overtime50Value + overtime100Value + nightlyBonusValue;
            return (totalVariablePay / businessDays) * sundaysAndHolidays;
        }, [employee.salary]);
        
        useEffect(() => {
            if(activeTab === 'manual') {
                const newDsr = calculateDsr(formData);
                setFormData(prev => ({...prev, dsrValue: newDsr}));
            }
        }, [formData.totalOvertimeHours50, formData.totalOvertimeHours100, formData.totalNightlyHours, activeTab, calculateDsr]);

        const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files?.[0]) {
                setFile(e.target.files[0]);
            }
        };

        const handleAnalyze = async () => {
            if (!file) return;
            setIsAnalyzing(true);
            setError('');
            try {
                const fileContent = await fileToBase64(file);
                const result = await api.analyzeTimeSheet(fileContent, file.type, { name: employee.name, salary: employee.salary }, formData.month, formData.year);
                setFormData(prev => ({
                    ...prev,
                    ...result,
                    sourceFile: { name: file.name, type: file.type, content: fileContent }
                }));
                setActiveTab('manual'); // Switch to manual tab to show results
            } catch (err: any) {
                setError(err.message || 'Falha na análise.');
            } finally {
                setIsAnalyzing(false);
            }
        };

        const handleSubmit = () => {
             onSave({
                ...formData,
                clientId: employee.clientId,
                employeeId: employee.id,
                status: isClient ? 'EnviadoParaAnalise' : 'Processado'
             });
        };

        return (
            <div>
                 <h3 className="text-xl font-semibold mb-2 text-black">{existingSheet ? 'Visualizar' : 'Lançar'} Folha de Ponto</h3>
                 <p className="text-sm text-gray-500 mb-4">Funcionário: {employee.name}</p>
                 <div className="border-b border-gray-200 mb-4">
                     <nav className="-mb-px flex space-x-8">
                         <button onClick={() => setActiveTab('import')} className={`${activeTab === 'import' ? 'border-primary text-primary' : 'border-transparent text-gray-500'} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}>Importar com IA</button>
                         <button onClick={() => setActiveTab('manual')} className={`${activeTab === 'manual' ? 'border-primary text-primary' : 'border-transparent text-gray-500'} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}>Entrada Manual</button>
                     </nav>
                 </div>
                 {activeTab === 'import' && (
                     <div className="space-y-4 text-center p-4">
                         <p className="text-gray-600">Importe o cartão de ponto (PDF ou imagem) e nossa IA irá extrair os valores e calcular o DSR automaticamente.</p>
                         <input type="file" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-dark/10 file:text-primary hover:file:bg-primary-dark/20" accept="image/*,application/pdf" />
                         {file && <p className="text-sm">Arquivo selecionado: {file.name}</p>}
                         <button onClick={handleAnalyze} disabled={!file || isAnalyzing} className="bg-primary text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">
                            {isAnalyzing ? 'Analisando...' : 'Analisar com IA'}
                         </button>
                         {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                         <div className="mt-6 flex justify-end space-x-3">
                           <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                         </div>
                     </div>
                 )}
                 {activeTab === 'manual' && (
                     <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Horas Extras 50%</label><input type="number" name="totalOvertimeHours50" value={formData.totalOvertimeHours50} onChange={e => setFormData({...formData, totalOvertimeHours50: +e.target.value})} className="p-2 border rounded w-full" /></div>
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Horas Extras 100%</label><input type="number" name="totalOvertimeHours100" value={formData.totalOvertimeHours100} onChange={e => setFormData({...formData, totalOvertimeHours100: +e.target.value})} className="p-2 border rounded w-full" /></div>
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Adic. Noturno (horas)</label><input type="number" name="totalNightlyHours" value={formData.totalNightlyHours} onChange={e => setFormData({...formData, totalNightlyHours: +e.target.value})} className="p-2 border rounded w-full" /></div>
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Atrasos (minutos)</label><input type="number" name="totalLatenessMinutes" value={formData.totalLatenessMinutes} onChange={e => setFormData({...formData, totalLatenessMinutes: +e.target.value})} className="p-2 border rounded w-full" /></div>
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Faltas (dias)</label><input type="number" name="totalAbsencesDays" value={formData.totalAbsencesDays} onChange={e => setFormData({...formData, totalAbsencesDays: +e.target.value})} className="p-2 border rounded w-full" /></div>
                        </div>
                        <div className="bg-gray-100 p-3 rounded-lg">
                            <p className="font-semibold">DSR Calculado: <span className="text-primary">R$ {formData.dsrValue.toFixed(2)}</span></p>
                        </div>
                        {formData.aiAnalysisNotes && <p className="text-sm text-gray-600 italic">Nota da IA: "{formData.aiAnalysisNotes}"</p>}
                         <div className="mt-6 flex justify-end space-x-3">
                           <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                           <button type="button" onClick={handleSubmit} className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Salvar/Enviar</button>
                         </div>
                     </div>
                 )}
            </div>
        );
    }
    
    const getStatusBadge = (sheet: TimeSheet | undefined) => {
        if (!sheet) return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pendente de Envio</span>;
        switch(sheet.status) {
            case 'EnviadoParaAnalise': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Enviado para Análise</span>;
            case 'Processado': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Processado</span>;
            case 'ErroNaAnalise': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Erro na Análise</span>;
            default: return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{sheet.status}</span>;
        }
    }
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-black">Gestão de Folha de Ponto</h2>
                {!isClient && (
                    <select
                        value={selectedClientForAdmin?.id || ''}
                        onChange={(e) => setSelectedClientForAdmin(clients.find(c => c.id === Number(e.target.value)) || null)}
                        className="w-full md:w-64 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="">Selecione um cliente</option>
                        {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.company}</option>
                        ))}
                    </select>
                )}
            </div>
            
            {clientForView ? (
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-black">{clientForView.company}</h3>
                        <button onClick={() => setModalState({ type: 'addEmployee' })} className="flex items-center bg-primary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-primary-dark transition-colors">
                            <Icon path="M12 6v6m0 0v6m0-6h6m-6 0H6" className="w-5 h-5 mr-2" />
                            Adicionar Funcionário
                        </button>
                    </div>
                     <div className="overflow-x-auto">
                        <table className="min-w-full leading-normal">
                            <thead>
                                <tr className="border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    <th className="px-5 py-3">Funcionário</th>
                                    <th className="px-5 py-3">Cargo</th>
                                    <th className="px-5 py-3">Salário</th>
                                    <th className="px-5 py-3">Ponto (Mês Atual)</th>
                                    <th className="px-5 py-3">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.filter(e => e.clientId === clientForView.id).map(emp => {
                                    const currentMonthSheet = timeSheets.find(ts => ts.employeeId === emp.id && ts.month === new Date().getMonth()+1 && ts.year === new Date().getFullYear());
                                    return (
                                    <tr key={emp.id} className="border-b border-gray-200 hover:bg-gray-50">
                                        <td className="px-5 py-5 text-sm text-gray-900">{emp.name}</td>
                                        <td className="px-5 py-5 text-sm text-gray-900">{emp.role}</td>
                                        <td className="px-5 py-5 text-sm text-gray-900">R$ {emp.salary.toFixed(2)}</td>
                                        <td className="px-5 py-5 text-sm">
                                            {getStatusBadge(currentMonthSheet)}
                                        </td>
                                        <td className="px-5 py-5 text-sm">
                                            <button onClick={() => setModalState({ type: 'addTimeSheet', data: {employee: emp, sheet: currentMonthSheet} })} className="text-primary hover:text-primary-dark font-semibold">
                                                {currentMonthSheet ? 'Ver/Editar' : 'Lançar Ponto'}
                                            </button>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : <p className="text-center text-gray-500">{isClient ? 'Empresa não encontrada. Entre em contato com o suporte.' : 'Selecione um cliente para começar.'}</p>}

            <Modal isOpen={modalState.type === 'addEmployee' || modalState.type === 'editEmployee'} onClose={() => setModalState({ type: null })}>
                {clientForView && <EmployeeModal clientName={clientForView.name} employee={modalState.type === 'editEmployee' ? modalState.data : undefined} onSave={handleSaveEmployee} onCancel={() => setModalState({ type: null })} />}
            </Modal>
             <Modal isOpen={modalState.type === 'addTimeSheet'} onClose={() => setModalState({ type: null })}>
                {modalState.data && <TimeSheetModal employee={modalState.data.employee} existingSheet={modalState.data.sheet} onSave={handleSaveTimeSheet} onCancel={() => setModalState({ type: null })} />}
            </Modal>
        </div>
    );
};

export default PontoView;