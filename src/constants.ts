import { DocumentTemplate } from "./types";

export const JZF_LOGO_BASE64 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCAzMDAgODAiPgogIDxzdHlsZT4KICAgIC5qLWYgeyBmaWxsOiAjNGE1NTY4OyB9IC8qIGRhcmstZ3JheSAqLwogICAgLnogeyBmaWxsOiAjOTIyYzI2OyB9IC8qIHByaW1hcnkgKi8KICAgIC50ZXh0IHsgZm9udC1mYW1pbHk6ICdBcmlhbCcsIHNhbnMtc2VyaWY7IH0KICA8L3N0eWxlPgogIDx0ZXh0IHg9IjEwIiB5PSI2MCIgZm9udC1zaXplPSI2MCIgZm9udC13ZWlnaHQ9ImJvbGQiIGNsYXNzPSJ0ZXh0IGotZiI+SjwvdGV4dD4KICA8dGV4dCB4PSI1MCIgeT0iNjAiIGZvbnQtc2l6ZT0iNjAiIGZvbnQtd2VpZ2h0PSJib2xkIiBjbGFzcz0idGV4dCB6Ij5aPC90ZXh0PgogIDx0ZXh0IHg9Ijk1IiB5PSI2MCIgZm9udC1zaXplPSI2MCIgZm9udC13ZWlnaHQ9ImJvbGQiIGNsYXNzPSJ0ZXh0IGotZiI+RjwvdGV4dD4KICA8dGV4dCB4PSIxNjAiIHk9IjQ1IiBmb250LXNpemU9IjIwIiBmb250LXdlaWdodD0iYm9sZCIgY2xhc3M9InRleHQgai1mIj5Db250YWJpbGlkYWRlPC90ZXh0PgogIDxyZWN0IHg9IjE2MCIgeT0iNTUiIHdpZHRoPSIxMzAiIGhlaWdodD0iNSIgY2xhc3M9InoiIC8+Cjwvc3ZnPg==';

export const JZF_LOGO_BASE64_WHITE = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCAzMDAgODAiPgogIDxzdHlsZT4KICAgIC5qLWYgeyBmaWxsOiAjRjdGQUZDOyB9IC8qIGxpZ2h0LWdyYXkgKi8KICAgIC56IHsgZmlsbDogIzkzMmMzNjsgfSAgLyogcHJpbWFyeSAqLwogICAgLnRleHQgeyBmb250LWZhbWlseTogJ0FyaWFsJywgc2Fucy1zZXJpZjsgfQogIDwvc3R5bGU+CiAgPHRleHQgeD0iMTAiIHk9IjYwIiBmb250LXNpemU9IjYwIiBmb250LXdlaWdodD0iYm9sZCIgY2xhc3M9InRleHQgai1mIj5KPC90ZXh0PgogIDx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI2MCIgZm9udC13ZWlnaHQ9ImJvbGQiIGNsYXNzPSJ0ZXh0IHoiPlo8L3RleHQ+CiAgPHRleHQgeD0iOTUiIHk9IjYwIiBmb250LXNpemU9IjYwIiBmb250LXdlaWdodD0iYm9sZCIgY2xhc3M9InRleHQgai1mIj5GPC90ZXh0PgogIDx0ZXh0IHg9IjE2MCIgeT0iNDUiIGZvbnQtc2l6ZT0iMjAiIGZvbnQtd2VpZ2h0PSJib2xkIiBjbGFzcz0idGV4dCBqLWYiPkNvbnRhYmlsaWRhZGU8L3RleHQ+CiAgPHJlY3QgeD0iMTYwIiB5PSI1NSIgd2lkdGg9IjEzMCIgaGVpZ2h0PSI1IiBjbGFzcz0ieiIgLz4KPC9zdmc+';


export const documentRequestLists = {
    'RH': [
        'Admissão de Funcionário', 'Rescisão de Contrato', 'Aviso de Férias', 'Folha de Pagamento', 
        'Comprovante de Ponto', 'Recibo de Férias', 'Atestado Médico', 'Contrato de Trabalho'
    ],
    'Fiscal': [
        'Notas Fiscais de Entrada', 'Notas Fiscais de Saída (Serviços)', 'Notas Fiscais de Saída (Produtos)',
        'Comprovantes de Pagamento de Impostos (DAS, DARF)', 'Extrato do Simples Nacional', 'Arquivo SPED Fiscal'
    ],
    'Contábil': [
        'Extratos Bancários', 'Comprovantes de Despesas', 'Controle de Caixa', 
        'Relatório de Faturamento', 'Balanço Patrimonial', 'DRE - Demonstração de Resultado'
    ],
    'Societário': [
        'Contrato Social e Alterações', 'Cartão CNPJ', 'Alvará de Funcionamento', 'Inscrição Estadual/Municipal'
    ]
};

export const fileRestrictions: Record<string, string> = {
    'Notas Fiscais de Saída (Produtos)': '.xml',
    'Arquivo SPED Fiscal': '.txt',
};

export const ADMISSION_TEMPLATE: DocumentTemplate = {
    id: 'admissao-funcionario',
    name: 'Admissão de Funcionário',
    category: 'RH',
    fields: [
        { id: 'nome_completo', label: 'Nome Completo', type: 'text', required: true },
        { id: 'cpf', label: 'CPF', type: 'text', required: true },
        { id: 'rg', label: 'RG', type: 'text', required: true },
        { id: 'data_nascimento', label: 'Data de Nascimento', type: 'date', required: true },
        { id: 'endereco', label: 'Endereço Completo', type: 'textarea', required: true },
        { id: 'cargo', label: 'Cargo', type: 'text', required: true },
        { id: 'salario', label: 'Salário (R$)', type: 'number', required: true },
        { id: 'data_admissao', label: 'Data de Admissão', type: 'date', required: true },
        { id: 'tipo_contrato', label: 'Tipo de Contrato', type: 'select', options: ['CLT', 'PJ', 'Estágio'], required: true },
        { id: 'contrato_experiencia', label: 'Contrato de Experiência?', type: 'select', options: ['Não', 'Sim'], required: true },
        { id: 'dias_experiencia', label: 'Dias de Experiência', type: 'number', required: false, description: 'Preencha apenas se houver contrato de experiência' },
        { id: 'carteira_trabalho_digital', label: 'Carteira de Trabalho Digital?', type: 'checkbox', required: false },
        { id: 'ctps_numero', label: 'Nº da CTPS', type: 'text', required: false },
        { id: 'ctps_serie', label: 'Série da CTPS', type: 'text', required: false },
        { id: 'pis', label: 'PIS', type: 'text', required: true },
        { id: 'possui_filhos', label: 'Possui Filhos?', type: 'checkbox', required: false }
    ],
    fileConfig: {
        acceptedTypes: 'application/pdf,image/*',
        isRequired: true
    },
    steps: null,
};

export const TERMINATION_TEMPLATE: DocumentTemplate = {
    id: 'rescisao-contrato',
    name: 'Rescisão de Contrato',
    category: 'RH',
    fields: [
        { id: 'nome_funcionario_rescisao', label: 'Nome do Funcionário', type: 'text', required: true, step: 1 },
        { id: 'cpf_rescisao', label: 'CPF do Funcionário', type: 'text', required: true, step: 1 },
        { id: 'data_aviso_previo', label: 'Data do Aviso Prévio', type: 'date', required: true, step: 1 },
        { id: 'motivo_rescisao', label: 'Motivo da Rescisão', type: 'select', options: ['Pedido de demissão', 'Demissão sem justa causa', 'Demissão por justa causa', 'Término de contrato'], required: true, step: 1 },
        { id: 'tipo_aviso_previo', label: 'Tipo de Aviso Prévio', type: 'select', options: ['Indenizado', 'Trabalhado'], required: true, step: 1 },
    ],
    fileConfig: {
        acceptedTypes: 'application/pdf,image/*',
        isRequired: true
    },
    steps: [
        { title: 'Etapa 1: Dados para Geração do Aviso Prévio' },
        { title: 'Etapa 2: Anexar Exame Demissional e Documentos' }
    ]
};

export const AVISO_FERIAS_TEMPLATE: DocumentTemplate = {
    id: 'aviso-ferias',
    name: 'Aviso de Férias',
    category: 'RH',
    fields: [
        { id: 'nome_funcionario_ferias', label: 'Nome do Funcionário', type: 'text', required: true },
        { id: 'data_inicio_ferias', label: 'Data de Início das Férias', type: 'date', required: true },
        { id: 'quantidade_dias_ferias', label: 'Quantidade de Dias', type: 'number', required: true },
        { id: 'vender_ferias', label: 'Deseja vender 1/3 das férias?', type: 'select', options: ['Não', 'Sim'], required: true },
        { id: 'adiantar_13', label: 'Deseja adiantar 13º Salário?', type: 'select', options: ['Não', 'Sim'], required: true },
    ],
    fileConfig: null,
    steps: null,
};