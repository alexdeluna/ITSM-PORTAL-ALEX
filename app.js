import {
    auth,
    db,
    googleProvider,
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    setDoc,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    onAuthStateChanged,
    signOut
} from './auth.js';

/* API local: a automação futura poderá chamar createTicket(payload) ou adaptar esta função para uma rota HTTP. */
const users=[
 {id:'u1',email:'solicitante@teste.local',password:'123456',name:'Alexsandro Luna',username:'alexsandro.luna',role:'requester',department:'Financeiro',unit:'Matriz'},
 {id:'t1',email:'tecnico1@teste.local',password:'123456',name:'Rafael Mendes',username:'rafael.mendes',role:'technician'},
 {id:'t2',email:'tecnico2@teste.local',password:'123456',name:'Maria Costa',username:'maria.costa',role:'technician'}
];
const catalog={
 'Impressora':['Instalação','Impressora não funciona','Sem impressão','Troca de toner','Falta de papel','Mudança de local'],
 'Desktop e Notebooks':['Computador não liga','Lentidão','Tela/monitor','Teclado ou mouse','Instalação de software','Troca de equipamento'],
 'Acesso e senha':['Redefinição de senha','Bloqueio de conta','Novo acesso','Alteração de permissão','VPN'],
 'E-mail e colaboração':['E-mail não envia/recebe','Caixa cheia','Criação de e-mail','Lista de distribuição','Microsoft Teams'],
 'Rede e internet':['Sem conexão','Internet lenta','Wi‑Fi','Cabo de rede','VPN'],
 'Sistemas corporativos':['Erro no sistema','Novo acesso','Permissão','Lentidão','Dúvida de uso'],
 'Telefonia':['Ramal sem funcionar','Criação/alteração de ramal','Chamadas','Headset'],
 'Solicitações gerais':['Dúvida','Orientação técnica','Visita técnica','Outro']
};
const requisitions=['Instalação','Troca de toner','Mudança de local','Instalação de software','Troca de equipamento','Redefinição de senha','Novo acesso','Alteração de permissão','Criação de e-mail','Lista de distribuição','Criação/alteração de ramal','Orientação técnica','Visita técnica'];
const slas={Requisição:{Baixa:18,Média:10,Alta:6},Incidente:{Baixa:6,Média:4,Alta:2}};
const seeded=[
 {id:1001,requester:'ana.souza',service:'Impressora',subcategory:'Impressora não funciona',type:'Incidente',priority:'Alta',sla:2,status:'Aberto',responsible:null,openedAt:'2026-09-02T08:20:00',description:'A impressora do almoxarifado não imprime documentos.'},
 {id:1002,requester:'carlos.lima',service:'Acesso e senha',subcategory:'Novo acesso',type:'Requisição',priority:'Alta',sla:6,status:'Aberto',responsible:null,openedAt:'2026-09-02T09:05:00',description:'Necessário acesso ao sistema corporativo.'},
 {id:1003,requester:'beatriz.rocha',service:'E-mail e colaboração',subcategory:'E-mail não envia/recebe',type:'Incidente',priority:'Média',sla:4,status:'Em análise',responsible:'Maria Costa',openedAt:'2026-09-02T09:22:00',description:'Mensagens permanecem na caixa de saída.'},
 {id:1004,requester:'alexsandro.luna',service:'Desktop e Notebooks',subcategory:'Lentidão',type:'Incidente',priority:'Baixa',sla:6,status:'Concluído',responsible:'Rafael Mendes',openedAt:'2026-09-02T07:00:00',closedAt:'2026-09-02T15:30:00',description:'Notebook está lento para executar as atividades.'},
 {id:1005,requester:'ana.souza',service:'Rede e internet',subcategory:'Sem conexão',type:'Incidente',priority:'Alta',sla:2,status:'Concluído',responsible:'Maria Costa',openedAt:'2026-09-02T10:00:00',closedAt:'2026-09-02T11:20:00',description:'Estação sem acesso à rede.'}
];
const directorySeed=[
 {username:'alexsandro.luna',name:'Alexsandro Luna',password:'123456',unit:'Matriz',department:'Financeiro'},
 {username:'ana.souza',name:'Ana Souza',password:'123456',unit:'Matriz',department:'Administrativo'},
 {username:'carlos.lima',name:'Carlos Lima',password:'123456',unit:'Filial São Paulo',department:'Comercial'},
 {username:'beatriz.rocha',name:'Beatriz Rocha',password:'123456',unit:'Matriz',department:'Recursos Humanos'}
];
let state={
    user:null,
    view:'new',
    selected:null,
    message:'',
    tickets:[],
    users:[],
    services:[]
};
const $=s=>document.querySelector(s); const pad=n=>String(n).padStart(2,'0');
async function loadTickets(){

    const snapshot = await getDocs(
        collection(db,'tickets')
    );

    state.tickets = snapshot.docs.map(doc => ({
        firestoreId: doc.id,
        ...doc.data()
    }));

    return state.tickets;
}

function tickets(){

    return state.tickets;
}

async function loadUsers(){

    const snapshot = await getDocs(
        collection(db,'users')
    );

    state.users = snapshot.docs.map(userDoc => ({
        firestoreId: userDoc.id,
        ...userDoc.data()
    }));

    return state.users;
}

async function loadServices(){

    const snapshot = await getDocs(
        collection(db,'services')
    );

    if(snapshot.empty){

        for(const service of Object.keys(catalog)){

            await setDoc(
                doc(db,'services',service),
                {
                    name:service,
                    subcategories:catalog[service],
                    active:true
                }
            );

        }

        return loadServices();
    }

    state.services = snapshot.docs.map(serviceDoc => {

    const data = serviceDoc.data();

    const subcategoryStatus =
        data.subcategoryStatus ||
        Object.fromEntries(
            (data.subcategories || []).map(
                subcategory => [
                    subcategory,
                    true
                ]
            )
        );

    return {
        firestoreId: serviceDoc.id,
        ...data,
        subcategoryStatus
    };
});

return state.services;
}

function directory(){const stored=localStorage.getItem('itsm-demo-users');if(!stored){localStorage.setItem('itsm-demo-users',JSON.stringify(directorySeed));return [...directorySeed]}const list=JSON.parse(stored),migrated=list.map(u=>({...u,password:u.password||'123456'}));if(JSON.stringify(list)!==JSON.stringify(migrated))localStorage.setItem('itsm-demo-users',JSON.stringify(migrated));return migrated}
function saveDirectory(list){localStorage.setItem('itsm-demo-users',JSON.stringify(list))}
function formatDate(v){const d=new Date(v);return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${String(d.getFullYear()).slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`}

function deadline(t){

    if(
        !t ||
        !t.openedAt ||
        !Number.isFinite(
            Number(t.sla)
        ) ||
        Number(t.sla) <= 0
    ){

        return null;
    }

    return new Date(
        new Date(t.openedAt).getTime() +
        Number(t.sla) * 60 * 60 * 1000
    );
}

function slaResult(t){

    const limit =
        deadline(t);

    if(
        !t.closedAt ||
        !limit
    ){

        return null;
    }

    return new Date(t.closedAt) <= limit
        ? 'Dentro da SLA'
        : 'Em atraso';
}

function slaInfo(t){

    const result =
        slaResult(t);

    if(result){

        return `
            <strong class="${result === 'Dentro da SLA'
                ? 'sla-ok'
                : 'sla-late'}">
                ${result}
            </strong>

            <br>

            <span class="muted">
                Encerrado:
                ${formatDate(t.closedAt)}
            </span>
        `;
    }

    const limit =
        deadline(t);

    if(!limit){

        return `
            <span class="muted">
                SLA não definida
            </span>
        `;
    }

    return `
        <span class="muted">
            Limite:
            ${formatDate(limit)}
        </span>
    `;
}

function typeFor(sub){return requisitions.includes(sub)?'Requisição':'Incidente'}
function badge(status){return `<span class="badge ${status==='Aberto'?'open':status==='Em análise'?'analysis':'done'}">${status}</span>`}
function login(){
    return `
        <main class="login">
            <section class="login-card">

                <div class="brand">
                    <div class="mark">TI</div>
                    <div>
                        <h1>Portal de Serviços</h1>
                        <p>Ambiente de atendimento</p>
                    </div>
                </div>

                <h2>Acessar portal</h2>

                <p class="hint">
                    Entre com seu e-mail corporativo ou utilize sua conta Google.
                </p>

                <form id="login-form">

                    <label>E-mail</label>
                    <input
                        id="email"
                        type="email"
                        required
                        autocomplete="email"
                        placeholder="seu.email@empresa.com"
                    >

                    <label style="margin-top:16px">
                        Senha
                    </label>

                    <input
                        id="password"
                        type="password"
                        required
                        autocomplete="current-password"
                        placeholder="••••••"
                    >

                    <div id="login-error"></div>

                    <button
                        type="submit"
                        class="primary"
                        style="width:100%;margin-top:22px"
                    >
                        Entrar
                    </button>

                </form>

                <button
    id="create-account"
    class="secondary"
    type="button"
    style="width:100%;margin-top:12px"
>
    Criar conta
</button>

                <div style="display:flex;align-items:center;gap:12px;margin:20px 0">
                    <div style="height:1px;background:#ddd;flex:1"></div>
                    <span class="muted">ou</span>
                    <div style="height:1px;background:#ddd;flex:1"></div>
                </div>

                <button
                    id="google-login"
                    class="secondary"
                    type="button"
                    style="width:100%"
                >
                    Entrar com Google
                </button>

                <p style="text-align:center;margin:16px 0 0">
                    <a
                        href="chatbot.html"
                        style="color:#0870bc;font-weight:700"
                    >
                        Experimentar assistente de TI →
                    </a>
                </p>

            </section>
        </main>
    `;
}

function cadastro(){
    return `
        <main class="login">
            <section class="login-card">

                <div class="brand">
                    <div class="mark">TI</div>
                    <div>
                        <h1>Portal de Serviços</h1>
                        <p>Criação de conta</p>
                    </div>
                </div>

                <h2>Criar conta</h2>

                <p class="hint">
                    Crie sua conta para acessar o Portal de Serviços.
                </p>

                <form id="register-form">

                    <label>Nome</label>
                    <input
                        id="register-name"
                        type="text"
                        required
                        autocomplete="name"
                        placeholder="Seu nome completo"
                    >

                    <label style="margin-top:16px">
                        E-mail
                    </label>

                    <input
                        id="register-email"
                        type="email"
                        required
                        autocomplete="email"
                        placeholder="seu.email@empresa.com"
                    >

                    <label style="margin-top:16px">
                        Senha
                    </label>

                    <input
                        id="register-password"
                        type="password"
                        required
                        minlength="6"
                        autocomplete="new-password"
                        placeholder="Mínimo de 6 caracteres"
                    >

                    <label style="margin-top:16px">
                        Confirmar senha
                    </label>

                    <input
                        id="register-password-confirm"
                        type="password"
                        required
                        minlength="6"
                        autocomplete="new-password"
                        placeholder="Digite a senha novamente"
                    >

                    <div id="register-error"></div>

                    <button
                        type="submit"
                        class="primary"
                        style="width:100%;margin-top:22px"
                    >
                        Criar conta
                    </button>

                </form>

                <button
                    id="back-to-login"
                    class="secondary"
                    type="button"
                    style="width:100%;margin-top:12px"
                >
                    Voltar para o login
                </button>

            </section>
        </main>
    `;
}
function shell(content){

    const tech = state.user.role === 'technician';
    const admin = state.user.role === 'admin';

    let navigation = '';

    if(admin){

        navigation = `
            <button
                class="nav ${state.view === 'admin' ? 'active' : ''}"
                data-view="admin"
            >
                Administração
            </button>
        `;

    }else if(tech){

        navigation = `
            <button
                class="nav ${state.view === 'queue' ? 'active' : ''}"
                data-view="queue"
            >
                Fila de chamados
            </button>
        `;

    }else{

        navigation = `
            <button
                class="nav ${state.view === 'new' ? 'active' : ''}"
                data-view="new"
            >
                Abrir novo chamado
            </button>

            <button
                class="nav ${state.view === 'mine' ? 'active' : ''}"
                data-view="mine"
            >
                Meus chamados
            </button>
        `;
    }

    const label =
        admin
            ? 'ADMINISTRAÇÃO'
            : tech
                ? 'EQUIPE DE SUPORTE'
                : 'SOLICITANTE';

    return `
        <div class="shell">

            <header class="topbar">

                <div class="brand">
                    <div class="mark">TI</div>

                    <div>
                        <h1>Portal de Serviços</h1>
                        <p>Ambiente local de demonstração</p>
                    </div>
                </div>

                <div class="userbar">
                    <span>${state.user.name}</span>
                    <button class="logout" id="logout">
                        Sair
                    </button>
                </div>

            </header>

            <div class="layout">

                <aside class="sidebar">

                    <div class="nav-label">
                        ${label}
                    </div>

                    ${navigation}

                </aside>

                <main class="main">
                    ${content}
                </main>

            </div>

        </div>
    `;
}
function newTicket(){

    const services = state.services
        .filter(service => service.active !== false)
        .sort((a,b) =>
            (a.name || '').localeCompare(
                b.name || '',
                'pt-BR'
            )
        )
        .map(service => `
            <option value="${service.name}">
                ${service.name}
            </option>
        `)
        .join('');
        return shell(`<div class="page-head"><div><h2>Abrir novo chamado</h2><p>Informe os dados para registrar sua solicitação.</p></div></div><section class="card"><form id="ticket-form"><div class="form-grid"><div><label>Nome do solicitante</label><input readonly value="${state.user.name}"></div><div><label>Unidade / Departamento</label><input readonly value="${state.user.unit} / ${state.user.department}"></div><div><label>Serviço</label><select id="service" required><option value="">Selecione um serviço</option>${services}</select></div><div><label>Subcategoria</label><select id="subcategory" required disabled><option>Escolha primeiro um serviço</option></select></div><div><label>Tipo de chamado</label><input id="type" readonly value="Será definido automaticamente"><p class="readonly-note">Classificação automática.</p></div><div><label>SLA de resolução</label><input id="sla" readonly value="Selecione prioridade e subcategoria"><p class="readonly-note">Prazo calculado automaticamente.</p></div>
            
            <div>
    <label>Criticidade</label>
    <input
        id="criticality"
        readonly
        value="Será definida automaticamente"
    >
    <p class="readonly-note">
        Definida pela configuração da subcategoria.
    </p>
</div>
            
            <div class="full"><label>Descrição</label><textarea id="description" required placeholder="Descreva o motivo do chamado com suas palavras."></textarea></div></div><div class="actions"><button type="reset" class="secondary">Limpar</button><button class="primary">Criar chamado</button></div></form></section>`)}
function mine(){const list=tickets().filter(t=>t.requester===state.user.username).sort((a,b)=>new Date(b.openedAt)-new Date(a.openedAt));return shell(`<div class="page-head"><div><h2>Meus chamados</h2><p>Acompanhe os tickets registrados em seu nome.</p></div><button class="primary" data-view="new">+ Abrir novo chamado</button></div><section class="card">${list.length?table(list,false):'<div class="empty">Você ainda não possui chamados cadastrados.</div>'}</section>`)}

function table(list, tech) {
    return `
        <div class="table-wrap">
            <table class="tickets">
                <thead>
                    <tr>
                        <th>Ticket</th>
                        <th>Solicitante</th>
                        <th>Serviço</th>
                        <th>Aberto em</th>
                        <th>Status</th>

                        ${
                            tech
                                ? `
                                    <th>SLA</th>
                                    <th>Responsável</th>
                                    <th>Ação</th>
                                `
                                : ''
                        }
                    </tr>
                </thead>

                <tbody>
                    ${
                        list
                            .map(
                                t => `
                                    <tr>
                                        <td>
                                            <button
                                                class="ticket-link"
                                                data-ticket="${t.id}"
                                            >
                                                #2026-${t.id}
                                            </button>
                                        </td>

                                        <td>
                                            ${t.requester}
                                        </td>

                                        <td>
                                            ${t.service}
                                        </td>

                                        <td>
                                            ${formatDate(t.openedAt)}
                                        </td>

                                        <td>
                                            ${badge(t.status)}
                                        </td>

                                        ${
                                            tech
                                                ? `
                                                    <td>
                                                        ${slaInfo(t)}
                                                    </td>

                                                    <td>
                                                        ${
                                                            t.responsible ||
                                                            '<span class="muted">Não atribuído</span>'
                                                        }
                                                    </td>

                                                    <td>
                                                        ${
                                                            !t.responsible
                                                                ? `
                                                                    <button
                                                                        class="primary capture"
                                                                        data-capture="${t.id}"
                                                                    >
                                                                        Capturar
                                                                    </button>
                                                                `
                                                                : `
                                                                    <button
                                                                        class="secondary"
                                                                        data-ticket="${t.id}"
                                                                    >
                                                                        Visualizar
                                                                    </button>
                                                                `
                                                        }
                                                    </td>
                                                `
                                                : ''
                                        }
                                    </tr>
                                `
                            )
                            .join('')
                    }
                </tbody>
            </table>
        </div>
    `;
}
function queue(){const list=tickets().sort((a,b)=>new Date(a.openedAt)-new Date(b.openedAt));return shell(`<div class="page-head"><div><h2>Fila de chamados</h2><p>Chamados em ordem de abertura. Capture um ticket para assumir o atendimento.</p></div></div><section class="card">${table(list,true)}</section>`)}
function usersPage(){const list=directory();return shell(`<div class="page-head"><div><h2>Cadastro de usuários</h2><p>Base local que simula a futura consulta ao Active Directory.</p></div></div><section class="card"><h3 style="margin-top:0">Adicionar usuário</h3><form id="user-form"><div class="form-grid"><div><label>Usuário (AD)</label><input id="new-username" required placeholder="nome.sobrenome"></div><div><label>Senha de acesso</label><input id="new-password" type="password" required placeholder="Defina uma senha"></div><div><label>Nome completo</label><input id="new-name" required placeholder="Nome do colaborador"></div><div><label>Unidade</label><input id="new-unit" required placeholder="Ex.: Matriz"></div><div class="full"><label>Departamento</label><input id="new-department" required placeholder="Ex.: Financeiro"></div></div><div class="actions"><button class="primary">Cadastrar usuário</button></div></form></section><section class="card" style="margin-top:24px"><h3 style="margin-top:0">Usuários cadastrados</h3><div class="table-wrap"><table class="tickets"><thead><tr><th>Usuário</th><th>Nome</th><th>Unidade</th><th>Departamento</th><th>Acesso</th></tr></thead><tbody>${list.map(u=>`<tr><td><strong>${u.username}</strong></td><td>${u.name}</td><td>${u.unit}</td><td>${u.department}</td><td><span class="badge done">Ativo</span></td></tr>`).join('')}</tbody></table></div></section>`)}

function adminPage(){
    return shell(`
        <div class="page-head">
            <div>
                <h2>Administração</h2>
                <p>Gerenciamento do Portal de Serviços.</p>
            </div>
        </div>

        <section class="card">
            <h3 style="margin-top:0">Módulo Administrativo</h3>

            <p>
                Esta área será utilizada para administrar
                usuários e a Central de Serviços.
            </p>

            <div class="actions">
                <button class="primary" data-admin="users">
                    Usuários
                </button>

                <button class="secondary" data-admin="catalog">
                    Central de Serviços
                </button>
            </div>
        </section>
    `);
}

function adminCatalogPage(){

    const services = state.services
        .slice()
        .sort((a,b) =>
            (a.name || '').localeCompare(
                b.name || '',
                'pt-BR'
            )
        );

    return shell(`
        <div class="page-head">

            <div>
                <h2>Central de Serviços</h2>

                <p>
                    Gerenciamento dos serviços disponíveis no Portal.
                </p>
            </div>

            <div class="actions">

    <button
        class="primary"
        type="button"
        data-admin="new-service"
    >
        + Novo serviço
    </button>

    <button
        class="secondary"
        data-view="admin"
    >
        Voltar
    </button>

    </div>

        </div>

        <section class="card">

            <h3 style="margin-top:0">
                Serviços cadastrados
            </h3>

            <div class="table-wrap">

                <table class="tickets">

                    <thead>

                        <tr>
                            <th>Serviço</th>
                            <th>Subcategorias</th>
                            <th>Status</th>
                            <th>Ação</th>
                        </tr>

                    </thead>

                    <tbody>

                        ${
                            services.length
                                ? services
                                    .map(service => `
                                        <tr>

                                            <td>
                                                <strong>
                                                    ${service.name}
                                                </strong>
                                            </td>

                                            <td>
                                                ${
                                                    service.subcategories?.length || 0
                                                }
                                            </td>

                                            <td>
                                                ${
                                                    service.active
                                                        ? '<span class="badge done">Ativo</span>'
                                                        : '<span class="badge">Inativo</span>'
                                                }
                                            </td>

                                           <td>

    <div style="display:flex;gap:8px;flex-wrap:wrap">

        <button
            class="secondary"
            type="button"
            data-edit-service="${service.firestoreId}"
        >
            Editar
        </button>

        <button
            class="secondary"
            type="button"
            data-toggle-service="${service.firestoreId}"
        >
            ${
                service.active
                    ? 'Desativar'
                    : 'Ativar'
            }
        </button>

    </div>

</td>

                                        </tr>
                                    `)
                                    .join('')
                                : `
                                    <tr>
                                        <td colspan="4">
                                            Nenhum serviço cadastrado.
                                        </td>
                                    </tr>
                                `
                        }

                    </tbody>

                </table>

            </div>

        </section>
    `);
}

function adminNewServicePage(){

    return shell(`
        <div class="page-head">

            <div>
                <h2>Novo serviço</h2>

                <p>
                    Cadastre o serviço e suas subcategorias.
                </p>
            </div>

            <button
                class="secondary"
                data-view="admin-catalog"
            >
                Voltar
            </button>

        </div>

        <section class="card">

            <form id="admin-service-form">

                <div class="form-grid">

                    <div class="full">

                        <label>
                            Nome do serviço
                        </label>

                        <input
                            id="admin-service-name"
                            type="text"
                            required
                            maxlength="100"
                            placeholder="Ex.: Computadores"
                        >

                    </div>

                    <div class="full">

                        <label>
                            Status do serviço
                        </label>

                        <select id="admin-service-active">

                            <option value="true">
                                Ativo
                            </option>

                            <option value="false">
                                Inativo
                            </option>

                        </select>

                    </div>

                </div>

                <hr>

                                <div class="page-head">

                    <div>

                        <h3>
                            Subcategorias
                        </h3>

                        <p>
                            Cadastre as categorias e defina
                            o tipo e o SLA de cada uma.
                        </p>

                    </div>

                </div>


                <div id="admin-subcategories">

                    <div
    class="subcategory-editor"
    style="
        margin-top:18px;
        padding:20px;
        border:1px solid #d7e0eb;
        border-radius:10px;
        background:rgba(240, 244, 249, 0.55);
    "
>

    <h4
        class="subcategory-title"
        style="
            margin:0 0 18px 0;
            font-size:15px;
        "
    >
        Subcategoria 1
    </h4>

    <div class="form-grid">

                            <div class="full">

                                <label>
                                    Nome da subcategoria
                                </label>

                                <input
                                    type="text"
                                    class="admin-subcategory-name"
                                    maxlength="100"
                                    placeholder="Ex.: Computador não liga"
                                >

                            </div>


                            <div>

                                <label>
                                    Tipo
                                </label>

                                <select class="admin-subcategory-type">

                                    <option value="Incidente">
                                        Incidente
                                    </option>

                                    <option value="Requisição">
                                        Requisição
                                    </option>

                                </select>

                            </div>


                            <div>

                                <label>
                                    Criticidade
                                </label>

                                <select class="admin-subcategory-criticality">

                                    <option value="Baixa">
                                        Baixa
                                    </option>

                                    <option value="Média">
                                        Média
                                    </option>

                                    <option value="Alta">
                                        Alta
                                    </option>

                                    <option value="Crítica">
                                        Crítica
                                    </option>

                                </select>

                            </div>


                            <div>

                                <label>
                                    SLA
                                </label>

                                <div
                                    style="
                                        display:flex;
                                        gap:8px;
                                        align-items:center
                                    "
                                >

                                    <input
                                        type="number"
                                        class="admin-subcategory-sla"
                                        min="1"
                                        step="1"
                                        placeholder="2"
                                    >

                                    <span>
                                        horas
                                    </span>

                                </div>

                            </div>


                            <div>

                                <label>
                                    Status
                                </label>

                                <select class="admin-subcategory-active">

                                    <option value="true">
                                        Ativa
                                    </option>

                                    <option value="false">
                                        Inativa
                                    </option>

                                </select>

                            </div>

                        </div>

                    </div>

                </div>


                <div style="margin-top:16px">

                    <button
                        type="button"
                        class="secondary"
                        id="admin-add-subcategory"
                    >
                        + Nova subcategoria
                    </button>

                </div>


                <div class="actions">

                    <button
                        type="reset"
                        class="secondary"
                    >
                        Limpar
                    </button>

                    <button
                        type="submit"
                        class="primary"
                    >
                        Criar serviço
                    </button>

                </div>


            </form>


        </section>
    `);
}

function adminEditServicePage(service){

    const subcategories =
        service.subcategories || [];

    const subcategoryConfig =
        service.subcategoryConfig || {};

    const subcategoryStatus =
        service.subcategoryStatus || {};

    const editors =
        subcategories.length
            ? subcategories
                .map(
                    (subcategory, index) => {

                        const config =
                            subcategoryConfig[
                                subcategory
                            ] || {};

                        const active =
                            subcategoryStatus[
                                subcategory
                            ] !== false;

                        return `
                            <div
    class="subcategory-editor"
    style="
        margin-top:18px;
        padding:20px;
        border:1px solid #d7e0eb;
        border-radius:10px;
        background:rgba(240, 244, 249, 0.55);
    "
> 

                                <h4
    class="subcategory-title"
    style="
        margin:0 0 18px 0;
        font-size:15px;
    "
>
 Subcategoria ${index + 1}
</h4>

                                <div class="form-grid">

                                    <div>
                                        <label>
                                            Nome da subcategoria
                                        </label>

                                        <input
                                            class="admin-subcategory-name"
                                            value="${subcategory}"
                                            required
                                        >
                                    </div>

                                    <div>
                                        <label>
                                            Tipo
                                        </label>

                                        <select
                                            class="admin-subcategory-type"
                                            required
                                        >
                                            <option
                                                value="Incidente"
                                                ${
                                                    config.type === 'Incidente'
                                                        ? 'selected'
                                                        : ''
                                                }
                                            >
                                                Incidente
                                            </option>

                                            <option
                                                value="Requisição"
                                                ${
                                                    config.type === 'Requisição'
                                                        ? 'selected'
                                                        : ''
                                                }
                                            >
                                                Requisição
                                            </option>
                                        </select>
                                    </div>

                                    <div>
                                        <label>
                                            Criticidade
                                        </label>

                                        <select
                                            class="admin-subcategory-criticality"
                                            required
                                        >
                                            <option
                                                value="Baixa"
                                                ${
                                                    config.criticality === 'Baixa'
                                                        ? 'selected'
                                                        : ''
                                                }
                                            >
                                                Baixa
                                            </option>

                                            <option
                                                value="Média"
                                                ${
                                                    config.criticality === 'Média'
                                                        ? 'selected'
                                                        : ''
                                                }
                                            >
                                                Média
                                            </option>

                                            <option
                                                value="Alta"
                                                ${
                                                    config.criticality === 'Alta'
                                                        ? 'selected'
                                                        : ''
                                                }
                                            >
                                                Alta
                                            </option>
                                        </select>
                                    </div>

                                    <div>
                                        <label>
                                            SLA de resolução (horas)
                                        </label>

                                        <input
                                            type="number"
                                            class="admin-subcategory-sla"
                                            min="1"
                                            value="${config.sla || ''}"
                                            required
                                        >
                                    </div>

                                    <div>
                                        <label>
                                            Status
                                        </label>

                                        <select
                                            class="admin-subcategory-active"
                                            required
                                        >
                                            <option
                                                value="true"
                                                ${
                                                    active
                                                        ? 'selected'
                                                        : ''
                                                }
                                            >
                                                Ativa
                                            </option>

                                            <option
                                                value="false"
                                                ${
                                                    !active
                                                        ? 'selected'
                                                        : ''
                                                }
                                            >
                                                Inativa
                                            </option>
                                        </select>
                                    </div>

                                </div>

                            </div>
                        `;
                    }
                )
                .join('')
            : `
            
                <div
    class="subcategory-editor"
    style="
        margin-top:18px;
        padding:20px;
        border:1px solid #d7e0eb;
        border-radius:10px;
        background:rgba(240, 244, 249, 0.55);
    "
> 

                    <h4
    class="subcategory-title"
    style="
        margin:0 0 18px 0;
        font-size:15px;
    "
>

                    <div class="form-grid">

                        <div>
                            <label>
                                Nome da subcategoria
                            </label>

                            <input
                                class="admin-subcategory-name"
                                required
                            >
                        </div>

                        <div>
                            <label>
                                Tipo
                            </label>

                            <select
                                class="admin-subcategory-type"
                                required
                            >
                                <option value="Incidente">
                                    Incidente
                                </option>

                                <option value="Requisição">
                                    Requisição
                                </option>
                            </select>
                        </div>

                        <div>
                            <label>
                                Criticidade
                            </label>

                            <select
                                class="admin-subcategory-criticality"
                                required
                            >
                                <option value="Baixa">
                                    Baixa
                                </option>

                                <option value="Média">
                                    Média
                                </option>

                                <option value="Alta">
                                    Alta
                                </option>
                            </select>
                        </div>

                        <div>
                            <label>
                                SLA de resolução (horas)
                            </label>

                            <input
                                type="number"
                                class="admin-subcategory-sla"
                                min="1"
                                required
                            >
                        </div>

                        <div>
                            <label>
                                Status
                            </label>

                            <select
                                class="admin-subcategory-active"
                                required
                            >
                                <option value="true">
                                    Ativa
                                </option>

                                <option value="false">
                                    Inativa
                                </option>
                            </select>
                        </div>

                    </div>

                </div>
            `;

    return shell(`
        <div class="page-head">

            <div>

                <h2>Editar serviço</h2>

                <p>
                    Altere as configurações do serviço e de suas subcategorias.
                </p>

            </div>

        </div>

        <section class="card">

            <form id="admin-edit-service-form">

                <div class="form-grid">

                    <div>
                        <label>
                            Nome do serviço
                        </label>

                        <input
                            id="admin-edit-service-name"
                            value="${service.name || ''}"
                            required
                        >
                    </div>

                    <div>
                        <label>
                            Status do serviço
                        </label>

                        <select
                            id="admin-edit-service-active"
                            required
                        >
                            <option
                                value="true"
                                ${
                                    service.active !== false
                                        ? 'selected'
                                        : ''
                                }
                            >
                                Ativo
                            </option>

                            <option
                                value="false"
                                ${
                                    service.active === false
                                        ? 'selected'
                                        : ''
                                }
                            >
                                Inativo
                            </option>
                        </select>
                    </div>

                </div>

                <div style="margin-top:24px">

                    <h3>
                        Subcategorias
                    </h3>

                    <div id="edit-subcategories-container">
                        ${editors}
                    </div>

                    <button
                        type="button"
                        class="secondary"
                        id="add-edit-subcategory"
                        style="margin-top:18px"
                    >
                        + Nova subcategoria
                    </button>

                </div>

                <div class="actions">

                    <button
                        type="button"
                        class="secondary"
                        data-view="admin-catalog"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="primary"
                    >
                        Salvar alterações
                    </button>

                </div>

            </form>

        </section>
    `);
}

function adminUsersPage() {

    const list = state.users
        .slice()
        .sort((a, b) =>
            (a.name || '').localeCompare(
                b.name || '',
                'pt-BR'
            )
        );

    return shell(`
        <div class="page-head">

            <div>
                <h2>Usuários</h2>
                <p>Usuários cadastrados no Portal de Serviços.</p>
            </div>

            <button
                class="secondary"
                data-view="admin"
            >
                Voltar
            </button>

        </div>

        <section class="card">

            <h3 style="margin-top:0">
                Usuários cadastrados
            </h3>

            ${
                list.length
                    ? `
                        <div class="table-wrap">

                            <table class="tickets">

                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>E-mail</th>
                                        <th>Perfil</th>
                                        <th>Unidade</th>
                                        <th>Departamento</th>
                                        <th>Status</th>
                                        <th>Ação</th>
                                    </tr>
                                </thead>

                                <tbody>

                                    ${list.map(u => {

                                        const ativo =
                                            u.active !== false;

                                        const role =
                                            u.role === 'admin'
                                                ? 'Administrador'
                                                : u.role === 'technician'
                                                    ? 'Técnico'
                                                    : 'Solicitante';

                                        return `
                                            <tr>

                                                <td>
                                                    <strong>
                                                        ${u.name || 'Não informado'}
                                                    </strong>
                                                </td>

                                                <td>
                                                    ${u.email || 'Não informado'}
                                                </td>

                                                <td>
                                                    ${role}
                                                </td>

                                                <td>
                                                    ${u.unit || 'Não definido'}
                                                </td>

                                                <td>
                                                    ${u.department || 'Não definido'}
                                                </td>

                                                <td>
                                                    <span class="badge ${ativo ? 'done' : 'analysis'}">
                                                        ${ativo ? 'Ativo' : 'Inativo'}
                                                    </span>
                                                </td>

                                                <td>
                                                    <button
                                                        class="secondary"
                                                        data-edit-user="${u.firestoreId}"
                                                    >
                                                        Editar
                                                    </button>
                                                </td>

                                            </tr>
                                        `;

                                    }).join('')}

                                </tbody>

                            </table>

                        </div>
                    `
                    : `
                        <div class="empty">
                            Nenhum usuário cadastrado.
                        </div>
                    `
            }

        </section>
    `);
}

function adminEditUserPage(user) {

    const role =
        user.role === 'technician'
            ? 'technician'
            : 'requester';

    const ativo =
        user.active !== false;

    return shell(`
        <div class="page-head">

            <div>
                <h2>Editar usuário</h2>
                <p>Altere os dados e permissões do usuário.</p>
            </div>

            <button
                class="secondary"
                data-view="admin-users"
            >
                Voltar
            </button>

        </div>

        <section class="card">

            <form id="edit-user-form">

                <div class="form-grid">

                    <div>
                        <label>Nome</label>

                        <input
                            id="edit-user-name"
                            type="text"
                            required
                            value="${user.name || ''}"
                        >
                    </div>

                    <div>
                        <label>E-mail</label>

                        <input
                            type="email"
                            readonly
                            value="${user.email || ''}"
                        >
                    </div>

                    <div>
                        <label>Perfil</label>

                        <select
                            id="edit-user-role"
                            required
                        >
                            <option
                                value="requester"
                                ${role === 'requester' ? 'selected' : ''}
                            >
                                Solicitante
                            </option>

                            <option
                                value="technician"
                                ${role === 'technician' ? 'selected' : ''}
                            >
                                Técnico
                            </option>
                        </select>
                    </div>

                    <div>
                        <label>Status</label>

                        <select
                            id="edit-user-active"
                            required
                        >
                            <option
                                value="true"
                                ${ativo ? 'selected' : ''}
                            >
                                Ativo
                            </option>

                            <option
                                value="false"
                                ${!ativo ? 'selected' : ''}
                            >
                                Inativo
                            </option>
                        </select>
                    </div>

                    <div>
                        <label>Unidade</label>

                        <input
                            id="edit-user-unit"
                            type="text"
                            value="${user.unit || ''}"
                        >
                    </div>

                    <div>
                        <label>Departamento</label>

                        <input
                            id="edit-user-department"
                            type="text"
                            value="${user.department || ''}"
                        >
                    </div>

                </div>

                <div class="actions">

                    <button
                        type="button"
                        class="secondary"
                        data-view="admin-users"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="primary"
                    >
                        Salvar alterações
                    </button>

                </div>

            </form>

        </section>
    `);
}

function detail(){

    const t = tickets().find(
        x => x.id === state.selected
    );

    if(!t)
        return mine();

    const tech =
        state.user.role === 'technician';

    const result =
        slaResult(t);

    const canFinish =
        tech &&
        t.responsible === state.user.name &&
        t.status !== 'Concluído';

    return shell(`
        <div class="page-head">

            <div>

                <button
                    class="ticket-link"
                    data-view="${tech ? 'queue' : 'mine'}"
                >
                    ← Voltar
                </button>

                <h2 style="margin-top:12px">
                    Chamado #2026-${t.id}
                </h2>

                <p>
                    ${badge(t.status)}
                </p>

            </div>

            ${canFinish ? `
                <div
                    style="
                        display:flex;
                        flex-direction:column;
                        gap:10px;
                        min-width:320px;
                    "
                >

                    <label for="solution">
                        Solução / procedimento realizado
                    </label>

                    <textarea id="solution" rows="4" minlength="15"
                        placeholder="Descreva o que foi feito para resolver o chamado..."
                    >${t.solution || ''}</textarea>

                    <button
                        class="primary"
                        id="finish"
                    >
                        Concluir chamado
                    </button>

                </div>
            ` : ''}

        </div>

        <section class="card">

            <div class="detail-grid">

                <div>
                    <span>Solicitante</span>
                    <strong>${t.requester}</strong>
                </div>

                <div>
                    <span>Serviço</span>
                    <strong>${t.service}</strong>
                </div>

                <div>
                    <span>Subcategoria</span>
                    <strong>${t.subcategory}</strong>
                </div>

                <div>
                    <span>Tipo</span>
                    <strong>${t.type}</strong>
                </div>

                <div>
    <span>Criticidade / SLA</span>
    <strong>
        ${t.criticality || 'Não informada'} · ${t.sla || 'Não definido'} horas
    </strong>
</div>

                <div>
                    <span>Responsável</span>
                    <strong>
                        ${t.responsible || 'Não atribuído'}
                    </strong>
                </div>

                <div>
                    <span>Prazo limite</span>
                    <strong>
                        ${formatDate(deadline(t))}
                    </strong>
                </div>

                ${t.closedAt ? `
                    <div>
                        <span>Encerrado em</span>
                        <strong>
                            ${formatDate(t.closedAt)}
                        </strong>
                    </div>

                    <div>
                        <span>Resultado da SLA</span>
                        <strong
                            class="${result === 'Dentro da SLA'
                                ? 'sla-ok'
                                : 'sla-late'}"
                        >
                            ${result}
                        </strong>
                    </div>
                ` : ''}

            </div>

            <label>
                Descrição
            </label>

            <p>
                ${t.description}
            </p>

            ${t.solution ? `
                <label>
                    Solução / procedimento realizado
                </label>

                <p>
                    ${t.solution}
                </p>
            ` : ''}

            <h3>
                Andamento
            </h3>

            <div class="timeline">

                <div class="event">

                    <strong>
                        Chamado criado
                    </strong>

                    <time>
                        ${formatDate(t.openedAt)}
                    </time>

                </div>

                ${t.responsible ? `
                    <div class="event">

                        <strong>
                            Capturado por ${t.responsible}
                        </strong>

                        <time>
                            Atualização registrada no ambiente de teste
                        </time>

                    </div>
                ` : ''}

                ${t.status === 'Concluído' ? `
                    <div class="event">

                        <strong>
                            Chamado concluído · ${result}
                        </strong>

                        <time>
                            ${formatDate(t.closedAt)}
                        </time>

                    </div>
                ` : ''}

            </div>

        </section>
    `);
}
function render(){

    let page =
        !state.user
            ? login()
            : state.view === 'new'
                ? newTicket()
                : state.view === 'mine'
                    ? mine()
                    : state.view === 'queue'
                        ? queue()
                        : state.view === 'admin'
                            ? adminPage()
                            : state.view === 'admin-users'
                                ? adminUsersPage()
                                    : state.view === 'admin-catalog'
    ? adminCatalogPage()
: state.view === 'admin-new-service'
    ? adminNewServicePage()
    : state.view === 'admin-edit-service'
        ? adminEditServicePage(state.selected)
        : state.view === 'admin-user-edit'
            ? adminEditUserPage(state.selected)
            : detail();

$('#app').innerHTML = page;

    bind();
}
function updateForm(){

    const serviceName =
        $('#service')?.value;

    const subcategory =
        $('#subcategory')?.value;

    if(
        !serviceName ||
        !subcategory
    ){

        $('#type').value =
            'Será definido automaticamente';

        $('#criticality').value =
            'Será definida automaticamente';

        $('#sla').value =
            'Selecione uma subcategoria';

        return;
    }

    const service =
        state.services.find(
            item =>
                item.name === serviceName
        );

    if(!service){

        $('#type').value =
            'Não configurado';

        $('#criticality').value =
            'Não configurada';

        $('#sla').value =
            'Não configurado';

        return;
    }

    const config =
        service.subcategoryConfig?.[subcategory];

    if(!config){

        $('#type').value =
            'Não configurado';

        $('#criticality').value =
            'Não configurada';

        $('#sla').value =
            'Não configurado';

        return;
    }

    $('#type').value =
        config.type || 'Não configurado';

    $('#criticality').value =
        config.criticality || 'Não configurada';

    $('#sla').value =
        config.sla
            ? `${config.sla} horas`
            : 'Não configurado';
}


async function bind(){

    console.log('BIND EXECUTADO', state.user);

    if(!state.user){
        const createAccount = $('#create-account');

    if(createAccount){

    createAccount.onclick = () => {

        $('#app').innerHTML = cadastro();

        bind();
    };
    }

    const backToLogin = $('#back-to-login');

    if(backToLogin){

    backToLogin.onclick = () => {

        $('#app').innerHTML = login();

        bind();
    };
    }

    

        const loginForm = $('#login-form');

        if(loginForm){

            loginForm.onsubmit = async e => {

                e.preventDefault();

                const email = $('#email').value.trim();
                const password = $('#password').value;

                const error = $('#login-error');

                error.innerHTML = '';

                try {

                    await signInWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );

                } catch(err) {

                    console.error(
                        'Erro no login:',
                        err
                    );

                    let message =
                        'Não foi possível realizar o login.';

                    if(
                        err.code === 'auth/invalid-credential' ||
                        err.code === 'auth/wrong-password' ||
                        err.code === 'auth/user-not-found'
                    ){
                        message =
                            'E-mail ou senha inválidos.';
                    }

                    if(err.code === 'auth/too-many-requests'){
                        message =
                            'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
                    }

                    error.innerHTML = `
                        <div class="message error">
                            ${message}
                        </div>
                    `;
                }
            };
        }

        const googleLogin = $('#google-login');

        if(googleLogin){

            googleLogin.onclick = async () => {

                const error = $('#login-error');

                error.innerHTML = '';

                try {

                    await signInWithPopup(
                        auth,
                        googleProvider
                    );

                } catch(err) {

                    console.error(
                        'Erro no login Google:',
                        err
                    );

                    let message =
                        'Não foi possível entrar com o Google.';

                    if(
                        err.code ===
                        'auth/popup-closed-by-user'
                    ){
                        message =
                            'A janela de login foi fechada.';
                    }

                    error.innerHTML = `
                        <div class="message error">
                            ${message}
                        </div>
                    `;
                }
            };
        }

                const registerForm = $('#register-form');

        if(registerForm){

            registerForm.onsubmit = async e => {

                e.preventDefault();

                const name =
                    $('#register-name').value.trim();

                const email =
                    $('#register-email').value.trim();

                const password =
                    $('#register-password').value;

                const confirmPassword =
                    $('#register-password-confirm').value;

                const error =
                    $('#register-error');

                error.innerHTML = '';

                if(password !== confirmPassword){

                    error.innerHTML = `
                        <div class="message error">
                            As senhas não conferem.
                        </div>
                    `;

                    return;
                }

                try {

                    const credential =
                        await createUserWithEmailAndPassword(
                            auth,
                            email,
                            password
                        );

                    const user =
                        credential.user;

                    await setDoc(
                        doc(db, 'users', user.uid),
                        {
                            name,
                            email: user.email,
                            role: 'requester',
                            active: true
                        }
                    );

                } catch(err){

                    console.error(
                        'Erro ao criar conta:',
                        err
                    );

                    error.innerHTML = `
                        <div class="message error">
                            Não foi possível criar a conta.
                        </div>
                    `;
                }
            };
        }

        return;
    }

    /*
     * A partir daqui o usuário já está autenticado.
     */

    $('#logout').onclick = async () => {

        try {

            await signOut(auth);

        } catch(err) {

            console.error(err);
        }

        state.user = null;
        state.view = 'new';
        state.selected = null;

        render();
    };

    document
        .querySelectorAll('[data-view]')
        .forEach(b =>
            b.onclick = () => {

                state.view = b.dataset.view;
                state.selected = null;

                render();
            }
        );

        document
        .querySelectorAll('[data-admin]')
    .forEach(b => {

        b.onclick = async () => {

            if(state.user.role !== 'admin'){
                return;
            }

            if(b.dataset.admin === 'users'){

                try {

                    await loadUsers();

                    state.view = 'admin-users';
                    state.selected = null;

                    render();

                } catch(err) {

                    console.error(
                        'Erro ao carregar usuários:',
                        err
                    );

                    state.message =
                        'Não foi possível carregar os usuários.';

                    render();
                }
            }
            if(b.dataset.admin === 'new-service'){

    state.view = 'admin-new-service';
    state.selected = null;

    render();

    return;
}

  if(b.dataset.admin === 'catalog'){

    if(state.user.role !== 'admin') return;

    try{

        await loadServices();

        state.view = 'admin-catalog';
        state.selected = null;

        render();

    }catch(err){

        console.error(
            'Erro ao carregar serviços:',
            err
        );

        alert(
            'Não foi possível carregar a Central de Serviços.'
        );
    }

    document.querySelectorAll('[data-toggle-service]').forEach(button => {

    button.onclick = async () => {

        if(state.user.role !== 'admin') return;

        const service = state.services.find(
            item => item.firestoreId === button.dataset.toggleService
        );

        if(!service) return;

        try {

            await updateDoc(
                doc(db, 'services', service.firestoreId),
                {
                    active: !service.active
                }
            );

            await loadServices();

            render();

        } catch(err) {

            console.error(
                'Erro ao alterar status do serviço:',
                err
            );

            alert(
                'Não foi possível alterar o status do serviço.'
            );
        }
    };

});

    return;
}

        };

    });

           const addSubcategory =
        $('#admin-add-subcategory');

    if(addSubcategory){

        addSubcategory.onclick = () => {

            const container =
                $('#admin-subcategories');

            const first =
                container?.querySelector(
                    '.subcategory-editor'
                );

            if(!container || !first){
                return;
            }

            const clone =
                first.cloneNode(true);

            clone
                .querySelectorAll('input')
                .forEach(input => {
                    input.value = '';
                });

            clone
                .querySelectorAll('select')
                .forEach(select => {
                    select.selectedIndex = 0;
                });

            container.appendChild(clone);

            const editors =
                container.querySelectorAll(
                    '.subcategory-editor'
                );

            editors.forEach(
                (editor, index) => {

                    const title =
                        editor.querySelector(
                            '.subcategory-title'
                        );

                    if(title){

                        title.textContent =
                            `Subcategoria ${index + 1}`;
                    }
                }
            );
        };
    }

  const addEditSubcategory =
    $('#add-edit-subcategory');

if(addEditSubcategory){

    addEditSubcategory.onclick = () => {

        const container =
            $('#edit-subcategories-container');

        const first =
            container?.querySelector(
                '.subcategory-editor'
            );

        if(!container || !first){
            return;
        }

        const clone =
            first.cloneNode(true);

        clone
            .querySelectorAll('input')
            .forEach(input => {

                input.value = '';
            });

        clone
            .querySelectorAll('select')
            .forEach(select => {

                select.selectedIndex = 0;
            });

        const removeButton =
            document.createElement('button');

        removeButton.type =
            'button';

        removeButton.className =
            'secondary';

        removeButton.textContent =
            'Remover';

        removeButton.style.marginTop =
            '16px';

        removeButton.onclick = () => {

            clone.remove();

            const editors =
                container.querySelectorAll(
                    '.subcategory-editor'
                );

            editors.forEach(
                (editor, index) => {

                    const title =
                        editor.querySelector(
                            '.subcategory-title'
                        );

                    if(title){

                        title.textContent =
                            `Subcategoria ${index + 1}`;
                    }
                }
            );
        };

        clone.appendChild(
            removeButton
        );

        container.appendChild(
            clone
        );

        const editors =
            container.querySelectorAll(
                '.subcategory-editor'
            );

        editors.forEach(
            (editor, index) => {

                const title =
                    editor.querySelector(
                        '.subcategory-title'
                    );

                if(title){

                    title.textContent =
                        `Subcategoria ${index + 1}`;
                }
            }
        );
    };
}

        document
        .querySelectorAll('[data-edit-service]')
        .forEach(b => {

            b.onclick = () => {

                if(state.user.role !== 'admin'){
                    return;
                }

                const service =
                    state.services.find(
                        item =>
                            item.firestoreId ===
                            b.dataset.editService
                    );

                if(!service){

                    console.error(
                        'Serviço não encontrado:',
                        b.dataset.editService
                    );

                    return;
                }

                state.selected = service;

                state.view =
                    'admin-edit-service';

                render();
            };

        });

    document
    .querySelectorAll('[data-edit-user]')
    .forEach(b => {

        b.onclick = () => {

            if(state.user.role !== 'admin'){
                return;
            }

            const user =
                state.users.find(
                    u => u.firestoreId === b.dataset.editUser
                );

            if(!user){
                console.error(
                    'Usuário não encontrado:',
                    b.dataset.editUser
                );

                return;
            }

            state.selected = user;
            state.view = 'admin-user-edit';

            render();
        };

    });

    document
        .querySelectorAll('[data-ticket]')
        .forEach(b =>
            b.onclick = () => {

                state.selected = Number(
                    b.dataset.ticket
                );

                state.view = 'detail';

                render();
            }
        );

    document.querySelectorAll('[data-capture]').forEach(b =>
    b.onclick = async () => {

        const t = state.tickets.find(
            x => x.id === Number(b.dataset.capture)
        );

        if (!t) {
            console.error('Chamado não encontrado:', b.dataset.capture);
            return;
        }

        try {

            await updateDoc(
                doc(db, 'tickets', t.firestoreId),
                {
                    responsible: state.user.name,
                    status: 'Em análise'
                }
            );

            await loadTickets();

            render();

        } catch (err) {

            console.error(
                'Erro ao capturar chamado:',
                err
            );

            alert(
                'Não foi possível capturar o chamado. ' +
                'Verifique o acesso ao Firestore.'
            );
        }
    }
    );

    if($('#user-form'))
        $('#user-form').onsubmit = e => {

            e.preventDefault();

            const list = directory();

            const username =
                $('#new-username')
                    .value
                    .trim()
                    .toLowerCase();

            if(
                list.some(
                    u => u.username === username
                )
            ){
                alert(
                    'Este usuário já está cadastrado.'
                );

                return;
            }

            list.push({
                username,
                password:
                    $('#new-password').value,
                name:
                    $('#new-name')
                        .value
                        .trim(),
                unit:
                    $('#new-unit')
                        .value
                        .trim(),
                department:
                    $('#new-department')
                        .value
                        .trim()
            });

            saveDirectory(list);

            render();
        };

    const editUserForm = $('#edit-user-form');

    if(editUserForm){

        editUserForm.onsubmit = async e => {

            e.preventDefault();

            const user = state.selected;

            if(!user){
                alert('Usuário não encontrado.');
                return;
            }

            const name =
                $('#edit-user-name').value.trim();

            const role =
                $('#edit-user-role').value;

            const active =
                $('#edit-user-active').value === 'true';

            const unit =
                $('#edit-user-unit').value.trim();

            const department =
                $('#edit-user-department').value.trim();

            try{

                await updateDoc(
                    doc(db, 'users', user.firestoreId),
                    {
                        name,
                        role,
                        active,
                        unit,
                        department
                    }
                );

                await loadUsers();

                state.selected = null;
                state.view = 'admin-users';

                render();

            }catch(err){

                console.error(
                    'Erro ao atualizar usuário:',
                    err
                );

                alert(
                    'Não foi possível salvar as alterações. ' +
                    'Verifique o acesso ao Firestore.'
                );
            }
        };
    }

        /*
     * Formulário de criação de serviço
     */

    const adminServiceForm =
        $('#admin-service-form');

    if(adminServiceForm){

        adminServiceForm.onsubmit = async e => {

            e.preventDefault();

            const serviceName =
                $('#admin-service-name')
                    .value
                    .trim();

            const serviceActive =
                $('#admin-service-active')
                    .value === 'true';

            const editors =
                document.querySelectorAll(
                    '.subcategory-editor'
                );

            const subcategories = [];
            const subcategoryStatus = {};
            const subcategoryConfig = {};

            for(const editor of editors){

                const name =
                    editor
                        .querySelector(
                            '.admin-subcategory-name'
                        )
                        ?.value
                        .trim();

                const type =
                    editor
                        .querySelector(
                            '.admin-subcategory-type'
                        )
                        ?.value;

                const criticality =
                    editor
                        .querySelector(
                            '.admin-subcategory-criticality'
                        )
                        ?.value;

                const sla =
                    Number(
                        editor
                            .querySelector(
                                '.admin-subcategory-sla'
                            )
                            ?.value
                    );

                const active =
                    editor
                        .querySelector(
                            '.admin-subcategory-active'
                        )
                        ?.value === 'true';

                if(!name){

                    alert(
                        'Informe o nome de todas as subcategorias.'
                    );

                    return;
                }

                if(!Number.isInteger(sla) || sla < 1){

                    alert(
                        `Informe um SLA válido para a subcategoria "${name}".`
                    );

                    return;
                }

                if(
                    subcategories.some(
                        item =>
                            item.toLowerCase() ===
                            name.toLowerCase()
                    )
                ){

                    alert(
                        `A subcategoria "${name}" está duplicada.`
                    );

                    return;
                }

                subcategories.push(name);

                subcategoryStatus[name] =
                    active;

                subcategoryConfig[name] = {
                    type,
                    criticality,
                    sla,
                    active
                };
            }

            if(!subcategories.length){

                alert(
                    'Cadastre pelo menos uma subcategoria.'
                );

                return;
            }

            const existingService =
                state.services.find(
                    service =>
                        (service.name || '')
                            .trim()
                            .toLowerCase() ===
                        serviceName.toLowerCase()
                );

            if(existingService){

                alert(
                    'Já existe um serviço com esse nome.'
                );

                return;
            }

            try{

                await addDoc(
                    collection(
                        db,
                        'services'
                    ),
                    {
                        name: serviceName,
                        active: serviceActive,
                        subcategories,
                        subcategoryStatus,
                        subcategoryConfig
                    }
                );

                await loadServices();

                state.view =
                    'admin-catalog';

                state.selected = null;

                render();

            }catch(err){

                console.error(
                    'Erro ao criar serviço:',
                    err
                );

                alert(
                    'Não foi possível criar o serviço. ' +
                    'Verifique o acesso ao Firestore.'
                );
            }
        };
    }


    /*
 * Formulário de edição de serviço
 */

const adminEditServiceForm =
    $('#admin-edit-service-form');

if(adminEditServiceForm){

    adminEditServiceForm.onsubmit = async e => {

        e.preventDefault();

        const service =
            state.selected;

        if(!service){

            alert(
                'Serviço não encontrado.'
            );

            return;
        }

        const serviceName =
            $('#admin-edit-service-name')
                .value
                .trim();

        const serviceActive =
            $('#admin-edit-service-active')
                .value === 'true';

        const editors =
            document.querySelectorAll(
                '#edit-subcategories-container .subcategory-editor'
            );

        const subcategories = [];
        const subcategoryStatus = {};
        const subcategoryConfig = {};

        for(const editor of editors){

            const name =
                editor
                    .querySelector(
                        '.admin-subcategory-name'
                    )
                    ?.value
                    .trim();

            const type =
                editor
                    .querySelector(
                        '.admin-subcategory-type'
                    )
                    ?.value;

            const criticality =
                editor
                    .querySelector(
                        '.admin-subcategory-criticality'
                    )
                    ?.value;

            const sla =
                Number(
                    editor
                        .querySelector(
                            '.admin-subcategory-sla'
                        )
                        ?.value
                );

            const active =
                editor
                    .querySelector(
                        '.admin-subcategory-active'
                    )
                    ?.value === 'true';

            if(!name){

                alert(
                    'Informe o nome de todas as subcategorias.'
                );

                return;
            }

            if(!Number.isInteger(sla) || sla < 1){

                alert(
                    `Informe um SLA válido para a subcategoria "${name}".`
                );

                return;
            }

            if(
                subcategories.some(
                    item =>
                        item.toLowerCase() ===
                        name.toLowerCase()
                )
            ){

                alert(
                    `A subcategoria "${name}" está duplicada.`
                );

                return;
            }

            subcategories.push(name);

            subcategoryStatus[name] =
                active;

            subcategoryConfig[name] = {

                type,

                criticality,

                sla,

                active
            };
        }

        if(!subcategories.length){

            alert(
                'O serviço precisa possuir pelo menos uma subcategoria.'
            );

            return;
        }

        const existingService =
            state.services.find(
                item =>
                    item.firestoreId !==
                        service.firestoreId &&
                    (item.name || '')
                        .trim()
                        .toLowerCase() ===
                    serviceName.toLowerCase()
            );

        if(existingService){

            alert(
                'Já existe outro serviço com esse nome.'
            );

            return;
        }

        try{

            await updateDoc(
                doc(
                    db,
                    'services',
                    service.firestoreId
                ),
                {
                    name: serviceName,
                    active: serviceActive,
                    subcategories,
                    subcategoryStatus,
                    subcategoryConfig
                }
            );

            await loadServices();

            state.selected = null;

            state.view =
                'admin-catalog';

            render();

        }catch(err){

            console.error(
                'Erro ao atualizar serviço:',
                err
            );

            alert(
                'Não foi possível salvar as alterações do serviço. ' +
                'Verifique o acesso ao Firestore.'
            );
        }
    };
}


    /*
     * Formulário de criação de chamado
     */

    const ticketForm = $('#ticket-form');

    if(ticketForm){

        ticketForm.onsubmit = async e => {

            e.preventDefault();

            const service =
                $('#service').value;

            const subcategory =
                $('#subcategory').value;

            const selectedService =
    state.services.find(
        item =>
            item.name === service
    );

const config =
    selectedService
        ?.subcategoryConfig
        ?. [subcategory];

if(!config){

    alert(
        'A subcategoria selecionada não possui uma configuração válida.'
    );

    return;
}

const type =
    config.type;

const criticality =
    config.criticality;

const sla =
    config.sla;

            const list =
                tickets();

            const id =
                Math.max(
                    ...list.map(x => x.id),
                    1000
                ) + 1;

const ticket = {

    id,

    requester:
        state.user.username,

    service,

    subcategory,

    type,

    criticality,

    sla,

    status:
        'Aberto',

    responsible:
        null,

    openedAt:
        new Date().toISOString(),

    description:
        $('#description').value
};

            try {

                await addDoc(
                    collection(
                        db,
                        'tickets'
                    ),
                    ticket
                );

                await loadTickets();

                showSuccess(ticket);

            } catch(err) {

                console.error(
                    'Erro ao criar chamado:',
                    err
                );

                alert(
                    'Não foi possível criar o chamado. ' +
                    'Verifique o acesso ao Firestore.'
                );
            }
        };
    }

   $('#service').onchange = e => {

    const service =
        state.services.find(
            item =>
                item.name === e.target.value
        );

    const subs =
        service?.subcategories || [];

    const activeSubs =
        subs.filter(
            subcategory =>
                service.subcategoryStatus?.[subcategory] !== false
        );

    $('#subcategory').disabled =
        !activeSubs.length;

    $('#subcategory').innerHTML =
        '<option value="">Selecione uma subcategoria</option>' +
        activeSubs
            .map(
                subcategory =>
                    `<option value="${subcategory}">
                        ${subcategory}
                    </option>`
            )
            .join('');

    updateForm();
};

    $('#subcategory').onchange =
        updateForm;

    if($('#finish')){
  $('#finish').onclick = async () => {
    const t = tickets().find(x => x.id === state.selected);

    if(!t){
      alert('Chamado não encontrado.');
      return;
    }

    const solution = $('#solution')?.value.trim() || '';

    if(!solution){
      alert('Informe a solução/procedimento realizado antes de concluir o chamado.');
      $('#solution')?.focus();
      return;
    }

    if(solution.length < 15){
      alert('A descrição da solução deve ter no mínimo 15 caracteres.');
      $('#solution')?.focus();
      return;
    }

    const button = $('#finish');

    button.disabled = true;
    button.textContent = 'Concluindo...';

    try{
      await updateDoc(
        doc(db, 'tickets', t.firestoreId),
        {
          solution,
          status: 'Concluído',
          closedAt: new Date().toISOString()
        }
      );

      await loadTickets();

      state.selected = null;
      state.view = 'queue';

      render();

    } catch(err){
      console.error('Erro ao concluir chamado:', err);

      button.disabled = false;
      button.textContent = 'Concluir chamado';

      alert(
        'Não foi possível concluir o chamado. ' +
        'Verifique o acesso ao Firestore.'
      );
    }
  };
    }
}
function showSuccess(t){

    const modal =
        document.createElement('div');

    modal.className =
        'modal';

    modal.innerHTML = `
        <div class="modal-box">

            <h2>
                ✓ Chamado criado com sucesso
            </h2>

            <p class="number">
                #2026-${t.id}
            </p>

            <div class="confirm-list">

                <strong>
                    ${t.service}
                </strong>
                ·
                ${t.subcategory}

                <br>

                Tipo:
                ${t.type}

                <br>

                Criticidade:
                ${t.criticality || 'Não informada'}

                <br>

                SLA de resolução:
                ${t.sla || 'Não definido'} horas

                <br>

                Status:
                Aberto

            </div>

            <div class="actions">

                <button
                    class="primary"
                    id="go-mine"
                >
                    Ver meus chamados
                </button>

            </div>

        </div>
    `;

    document.body.append(
        modal
    );

    $('#go-mine').onclick = () => {

        modal.remove();

        state.view =
            'mine';

        render();
    };
}
window.localTicketApi={createTicket(payload){const list=tickets(),id=Math.max(...list.map(x=>x.id),1000)+1;const type=payload.type||typeFor(payload.subcategory),priority=payload.priority||'Média';const ticket={id,status:'Aberto',responsible:null,openedAt:new Date().toISOString(),sla:slas[type][priority],...payload,type,priority};list.push(ticket);save(list);return ticket},getTickets(){return tickets()}};
onAuthStateChanged(auth, async user => {

    if(!user){

        state.user = null;
        state.view = 'new';
        state.selected = null;

        render();
        return;
    }

    try {

        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

  if(!userSnap.exists()){

    console.warn(
        'Perfil ainda não disponível no Firestore. Aguardando sincronização...'
    );

    await new Promise(
        resolve => setTimeout(resolve, 1000)
    );

    const retrySnap = await getDoc(userRef);

    if(!retrySnap.exists()){

        console.error(
            'Usuário autenticado, mas sem perfil no Firestore:',
            user.uid
        );

        state.user = null;

        render();

        $('#login-error').innerHTML = `
            <div class="message error">
                Seu usuário foi autenticado, mas ainda não possui
                um perfil cadastrado no sistema.
            </div>
        `;

        await signOut(auth);

        return;
    }

    userSnap = retrySnap;
}

        const profile = userSnap.data();

        if(profile.active === false){

    await signOut(auth);

    state.user = null;
    state.view = 'new';
    state.selected = null;

    render();

    $('#login-error').innerHTML = `
        <div class="message error">
            Seu acesso ao Portal está inativo.
        </div>
    `;

    return;
}

        state.user = {
            id: user.uid,
            email: user.email,
            name: profile.name || user.displayName || user.email.split('@')[0],
            username: profile.username || user.email.split('@')[0],
            role: profile.role || 'requester',
            unit: profile.unit || 'Não definido',
            department: profile.department || 'Não definido'
        };

        if(state.user.role === 'admin'){

    state.view = 'admin';

}else if(state.user.role === 'technician'){

    state.view = 'queue';

}else{

    state.view = 'new';
}

                await loadTickets();
                await loadServices();

        render();

    } catch(err) {

        console.error(
            'Erro ao carregar perfil do usuário:',
            err
        );

        state.user = null;

        render();
    }
});