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
    const [modalState, setModalState] = useState<{ type: null | 'addEmployee' | 'importBulk' | 'editEmployee' | 'importEmployee' ; data?: any }>({ type: null });

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
    
    const handleImportEmployees = async (importedEmployees: any[]) => {
        if (!clientForView) return;
        setIsLoading(true);
        try {
            // Map from CSV headers ('nome', 'cargo', etc.) to Employee type properties ('name', 'role', etc.)
            const employeesToCreate = importedEmployees.map(emp => ({
                name: emp.nome,
                role: emp.cargo,
                salary: parseFloat(String(emp.salario).replace(',', '.')) || 0,
                cbo: emp.cbo || '',
            }));

            const updatedEmployeeList = await api.createEmployeesBatch(clientForView.id, employeesToCreate);
            setEmployees(updatedEmployeeList); // API returns the full list for the client
        } catch(error) {
             console.error("Failed to import employees", error);
             alert(`Erro na importação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        } finally {
            setIsLoading(false);
            setModalState({ type: null });
        }
    }

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
        }
    };
    
    // --- Modals ---
    
    const ImportEmployeeModal: React.FC<{onSave: (employees: any[]) => void, onCancel: () => void}> = ({onSave, onCancel}) => {
        const [parsedData, setParsedData] = useState<any[]>([]);
        const [error, setError] = useState('');

        const handleDownloadTemplate = () => {
            const csvContent = "data:text/csv;charset=utf-8,nome,cargo,salario,cbo\nFuncionario Exemplo,Analista,3500.50,123456";
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "modelo_importacao_funcionarios.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        
        const handleFileParse = async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;

            setError('');
            setParsedData([]);

            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
                if (lines.length < 2) {
                    setError('O arquivo CSV precisa ter um cabeçalho e pelo menos uma linha de dados.');
                    return;
                }
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                const requiredHeaders = ['nome', 'cargo', 'salario', 'cbo'];
                
                if(!requiredHeaders.every(h => headers.includes(h))) {
                    setError(`O cabeçalho deve conter as colunas: ${requiredHeaders.join(', ')}`);
                    return;
                }
                
                const data = lines.slice(1).map(line => {
                    const values = line.split(',');
                    const obj: any = {};
                    headers.forEach((header, i) => {
                        obj[header] = values[i]?.trim();
                    });
                    return obj;
                });
                setParsedData(data);
            };
            reader.readAsText(file);
        };
        
        return (
            <div>
                 <h3 className="text-xl font-semibold mb-2 text-black">Importar Funcionários</h3>
                 <p className="text-sm text-gray-500 mb-4">
                    Envie um arquivo .csv com as colunas: `nome`, `cargo`, `salario`, `cbo`.
                    <br />O salário deve usar ponto como separador decimal (ex: 3500.50).
                 </p>
                 <button type="button" onClick={handleDownloadTemplate} className="text-sm text-primary hover:underline mb-4 flex items-center">
                    <Icon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" className="w-4 h-4 mr-2" />
                    Baixar Modelo CSV
                 </button>

                 <input type="file" accept=".csv" onChange={handleFileParse} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-dark/10 file:text-primary hover:file:bg-primary-dark/20" />
                 {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                 {parsedData.length > 0 && (
                     <div className="mt-4 max-h-60 overflow-y-auto border rounded-lg">
                         <table className="min-w-full text-sm">
                             <thead className="bg-gray-100"><tr>{Object.keys(parsedData[0]).map(k => <th key={k} className="p-2 text-left">{k}</th>)}</tr></thead>
                             <tbody>{parsedData.map((row, i) => <tr key={i} className="border-t">{Object.values(row).map((v: any, j) => <td key={j} className="p-2">{v}</td>)}</tr>)}</tbody>
                         </table>
                     </div>
                 )}
                 <div className="mt-6 flex justify-end space-x-3">
                    <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                    <button type="button" onClick={() => onSave(parsedData)} disabled={parsedData.length === 0} className="bg-primary text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">Confirmar Importação</button>
                 </div>
            </div>
        )
    }

    const EmployeeModal: React.FC<{ clientName: string, employee?: Employee, onSave: (data: any, id: number | null) => void, onCancel: () => void }> = 
    ({ clientName, employee, onSave, onCancel }) => {
        const [formData, setFormData] = useState({
            name: employee?.name || '',
            role: employee?.role || '',
            salary: employee?.salary || 0,
            cbo: employee?.cbo || '',
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
                 <input name="cbo" value={formData.cbo} onChange={handleChange} placeholder="CBO (opcional)" className="p-2 border rounded w-full" />
                <div className="mt-6 flex justify-end space-x-3">
                  <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                  <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Salvar</button>
                </div>
            </form>
        );
    };

    const BulkTimeSheetModal: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
        const [file, setFile] = useState<File | null>(null);
        const [month, setMonth] = useState(new Date().getMonth() + 1);
        const [year, setYear] = useState(new Date().getFullYear());
        const [analysisResult, setAnalysisResult] = useState<any[] | null>(null);
        const [isAnalyzing, setIsAnalyzing] = useState(false);
        const [error, setError] = useState('');
        
        const handleAnalyze = async () => {
            if (!file || !clientForView) return;
            setIsAnalyzing(true);
            setError('');
            setAnalysisResult(null);
            try {
                const base64 = await fileToBase64(file);
                const results = await api.analyzeBulkTimeSheet(base64, file.type, clientForView.id, month, year);
                setAnalysisResult(results);
            } catch (err: any) {
                setError(err.message || 'Falha na análise. Verifique o arquivo ou tente novamente.');
            } finally {
                setIsAnalyzing(false);
            }
        };

        const handleSaveAll = async () => {
            if (!analysisResult || !clientForView) return;

            const validResults = analysisResult.filter(r => r.isRegistered);
            if (validResults.length === 0) {
                alert("Nenhum funcionário válido para salvar.");
                return;
            }

            for (const result of validResults) {
                const timeSheetData: Omit<TimeSheet, 'id'> = {
                    clientId: clientForView.id,
                    employeeId: result.employeeId,
                    month,
                    year,
                    status: isClient ? 'EnviadoParaAnalise' : 'Processado',
                    totalOvertimeHours50: result.overtime50Hours || 0,
                    totalOvertimeHours100: result.overtime100Hours || 0,
                    totalNightlyHours: result.overtime60Hours || 0, // Assuming 60% is nightly for now
                    totalLatenessMinutes: 0, // Not in the new request
                    totalAbsencesDays: result.absences?.length || 0,
                    dsrValue: result.dsrValue || 0,
                    aiAnalysisNotes: result.aiAnalysisNotes || '',
                    sourceFile: null,
                };
                await handleSaveTimeSheet(timeSheetData);
            }

            if (isClient) {
                users.filter(u => u.role.includes('Admin')).forEach(admin => {
                   addNotification({
                       userId: admin.id,
                       message: `${currentUser.name} enviou o ponto de ${validResults.length} funcionário(s) para análise.`
                   });
               });
           }
            onCancel();
        };

        return (
            <div>
                <h3 className="text-xl font-semibold mb-2 text-black">Importar Ponto em Lote com IA</h3>
                
                {!analysisResult ? (
                    <div className="space-y-4">
                        <p className="text-gray-600">Selecione o período e o arquivo de ponto (PDF, imagem, etc.) contendo os dados de seus funcionários. A IA irá ler e extrair as informações automaticamente.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="p-2 border rounded w-full">
                                {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('pt-BR', { month: 'long' })}</option>)}
                            </select>
                            <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="p-2 border rounded w-full" />
                        </div>
                        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-dark/10 file:text-primary hover:file:bg-primary-dark/20" accept="image/*,application/pdf" />
                        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                        <div className="mt-6 flex justify-end space-x-3">
                            <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                            <button onClick={handleAnalyze} disabled={!file || isAnalyzing} className="bg-primary text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">
                                {isAnalyzing ? 'Analisando...' : 'Analisar com IA'}
                            </button>
                        </div>
                    </div>
                ) : (
                     <div>
                        <h4 className="font-semibold mb-4">Resultados da Análise - Revise e Salve</h4>
                        <div className="max-h-80 overflow-y-auto border rounded-lg">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-100 sticky top-0"><tr>
                                    <th className="p-2 text-left">Funcionário</th>
                                    <th className="p-2 text-center">HE 50%</th>
                                    <th className="p-2 text-center">HE 100%</th>
                                    <th className="p-2 text-center">Faltas</th>
                                    <th className="p-2 text-center">Status</th>
                                </tr></thead>
                                <tbody>
                                    {analysisResult.map((res, i) => (
                                        <tr key={i} className="border-t">
                                            <td className="p-2 font-medium">{res.employeeName}</td>
                                            <td className="p-2 text-center">{res.overtime50Hours || 0}</td>
                                            <td className="p-2 text-center">{res.overtime100Hours || 0}</td>
                                            <td className="p-2 text-center">{res.absences?.length || 0}</td>
                                            <td className="p-2 text-center">
                                                {res.isRegistered ? <span className="text-green-600 font-semibold">OK</span> : <span className="text-red-600 font-semibold">Não Cadastrado</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button type="button" onClick={() => setAnalysisResult(null)} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Analisar Outro</button>
                            <button onClick={handleSaveAll} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg">Salvar Dados Analisados</button>
                        </div>
                    </div>
                )}
            </div>
        )
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
                        <div className="flex items-center space-x-3">
                            <button onClick={() => setModalState({ type: 'importBulk'})} className="flex items-center bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-colors">
                                <Icon path="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" className="w-5 h-5 mr-2" />
                                Importar Ponto em Lote
                            </button>
                             <button onClick={() => setModalState({ type: 'importEmployee'})} className="flex items-center bg-green-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-green-700 transition-colors">
                                <Icon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" className="w-5 h-5 mr-2" />
                                Importar Planilha
                            </button>
                            <button onClick={() => setModalState({ type: 'addEmployee' })} className="flex items-center bg-primary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-primary-dark transition-colors">
                                <Icon path="M12 6v6m0 0v6m0-6h6m-6 0H6" className="w-5 h-5 mr-2" />
                                Adicionar Funcionário
                            </button>
                        </div>
                    </div>
                     <div className="overflow-x-auto">
                        <table className="min-w-full leading-normal">
                            <thead>
                                <tr className="border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    <th className="px-5 py-3">Funcionário</th>
                                    <th className="px-5 py-3">Cargo</th>
                                    <th className="px-5 py-3">Salário</th>
                                    <th className="px-5 py-3">CBO</th>
                                    <th className="px-5 py-3">Ponto (Mês Atual)</th>
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
                                        <td className="px-5 py-5 text-sm text-gray-900">{emp.cbo || '-'}</td>
                                        <td className="px-5 py-5 text-sm">
                                            {getStatusBadge(currentMonthSheet)}
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
             <Modal isOpen={modalState.type === 'importBulk'} onClose={() => setModalState({ type: null })}>
                <BulkTimeSheetModal onCancel={() => setModalState({ type: null })} />
            </Modal>
            <Modal isOpen={modalState.type === 'importEmployee'} onClose={() => setModalState({ type: null })}>
                <ImportEmployeeModal onSave={handleImportEmployees} onCancel={() => setModalState({ type: null })} />
            </Modal>
        </div>
    );
};

export default PontoView;