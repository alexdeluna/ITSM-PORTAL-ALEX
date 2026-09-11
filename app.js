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
    tickets:[]
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
function directory(){const stored=localStorage.getItem('itsm-demo-users');if(!stored){localStorage.setItem('itsm-demo-users',JSON.stringify(directorySeed));return [...directorySeed]}const list=JSON.parse(stored),migrated=list.map(u=>({...u,password:u.password||'123456'}));if(JSON.stringify(list)!==JSON.stringify(migrated))localStorage.setItem('itsm-demo-users',JSON.stringify(migrated));return migrated}
function saveDirectory(list){localStorage.setItem('itsm-demo-users',JSON.stringify(list))}
function formatDate(v){const d=new Date(v);return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${String(d.getFullYear()).slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`}
function deadline(t){return new Date(new Date(t.openedAt).getTime()+t.sla*60*60*1000)}
function slaResult(t){return t.closedAt?(new Date(t.closedAt)<=deadline(t)?'Dentro da SLA':'Em atraso'):null}
function slaInfo(t){const result=slaResult(t);return result?`<strong class="${result==='Dentro da SLA'?'sla-ok':'sla-late'}">${result}</strong><br><span class="muted">Encerrado: ${formatDate(t.closedAt)}</span>`:`<span class="muted">Limite: ${formatDate(deadline(t))}</span>`}
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
function shell(content){const tech=state.user.role==='technician';return `<div class="shell"><header class="topbar"><div class="brand"><div class="mark">TI</div><div><h1>Portal de Serviços</h1><p>Ambiente local de demonstração</p></div></div><div class="userbar"><span>${state.user.name}</span><button class="logout" id="logout">Sair</button></div></header><div class="layout"><aside class="sidebar"><div class="nav-label">${tech?'EQUIPE DE SUPORTE':'SOLICITANTE'}</div>${tech?`<button class="nav ${state.view==='queue'?'active':''}" data-view="queue">Fila de chamados</button><button class="nav ${state.view==='users'?'active':''}" data-view="users">Cadastro de usuários</button>`:`<button class="nav ${state.view==='new'?'active':''}" data-view="new">Abrir novo chamado</button><button class="nav ${state.view==='mine'?'active':''}" data-view="mine">Meus chamados</button>`}</aside><main class="main">${content}</main></div></div>`}
function newTicket(){const services=Object.keys(catalog).map(x=>`<option>${x}</option>`).join('');return shell(`<div class="page-head"><div><h2>Abrir novo chamado</h2><p>Informe os dados para registrar sua solicitação.</p></div></div><section class="card"><form id="ticket-form"><div class="form-grid"><div><label>Nome do solicitante</label><input readonly value="${state.user.name}"></div><div><label>Unidade / Departamento</label><input readonly value="${state.user.unit} / ${state.user.department}"></div><div><label>Serviço</label><select id="service" required><option value="">Selecione um serviço</option>${services}</select></div><div><label>Subcategoria</label><select id="subcategory" required disabled><option>Escolha primeiro um serviço</option></select></div><div><label>Tipo de chamado</label><input id="type" readonly value="Será definido automaticamente"><p class="readonly-note">Classificação automática.</p></div><div><label>SLA de resolução</label><input id="sla" readonly value="Selecione prioridade e subcategoria"><p class="readonly-note">Prazo calculado automaticamente.</p></div><div class="full"><label>Prioridade</label><div class="priority"><label><input type="radio" name="priority" value="Baixa" required> Baixa</label><label><input type="radio" name="priority" value="Média"> Média</label><label><input type="radio" name="priority" value="Alta"> Alta</label></div></div><div class="full"><label>Descrição</label><textarea id="description" required placeholder="Descreva o motivo do chamado com suas palavras."></textarea></div></div><div class="actions"><button type="reset" class="secondary">Limpar</button><button class="primary">Criar chamado</button></div></form></section>`)}
function mine(){const list=tickets().filter(t=>t.requester===state.user.username).sort((a,b)=>new Date(b.openedAt)-new Date(a.openedAt));return shell(`<div class="page-head"><div><h2>Meus chamados</h2><p>Acompanhe os tickets registrados em seu nome.</p></div><button class="primary" data-view="new">+ Abrir novo chamado</button></div><section class="card">${list.length?table(list,false):'<div class="empty">Você ainda não possui chamados cadastrados.</div>'}</section>`)}
function table(list,tech){return `<div class="table-wrap"><table class="tickets"><thead><tr><th>Ticket</th><th>Solicitante</th><th>Serviço</th><th>Aberto em</th><th>Status</th>${tech?'<th>SLA</th><th>Responsável</th><th>Ação</th>':''}</tr></thead><tbody>${list.map(t=>`<tr><td><button class="ticket-link" data-ticket="${t.id}">#2026-${t.id}</button></td><td>${t.requester}</td><td>${t.service}</td><td>${formatDate(t.openedAt)}</td><td>${badge(t.status)}</td>${tech?`<td>${slaInfo(t)}</td><td>${t.responsible||'<span class="muted">Não atribuído</span>'}</td><td>${!t.responsible?`<button class="primary capture" data-capture="${t.id}">Capturar</button>`:`<button class="secondary" data-ticket="${t.id}">Visualizar</button>`}</td>`:''}</tr>`).join('')}</tbody></table></div>`}
function queue(){const list=tickets().sort((a,b)=>new Date(a.openedAt)-new Date(b.openedAt));return shell(`<div class="page-head"><div><h2>Fila de chamados</h2><p>Chamados em ordem de abertura. Capture um ticket para assumir o atendimento.</p></div></div><section class="card">${table(list,true)}</section>`)}
function usersPage(){const list=directory();return shell(`<div class="page-head"><div><h2>Cadastro de usuários</h2><p>Base local que simula a futura consulta ao Active Directory.</p></div></div><section class="card"><h3 style="margin-top:0">Adicionar usuário</h3><form id="user-form"><div class="form-grid"><div><label>Usuário (AD)</label><input id="new-username" required placeholder="nome.sobrenome"></div><div><label>Senha de acesso</label><input id="new-password" type="password" required placeholder="Defina uma senha"></div><div><label>Nome completo</label><input id="new-name" required placeholder="Nome do colaborador"></div><div><label>Unidade</label><input id="new-unit" required placeholder="Ex.: Matriz"></div><div class="full"><label>Departamento</label><input id="new-department" required placeholder="Ex.: Financeiro"></div></div><div class="actions"><button class="primary">Cadastrar usuário</button></div></form></section><section class="card" style="margin-top:24px"><h3 style="margin-top:0">Usuários cadastrados</h3><div class="table-wrap"><table class="tickets"><thead><tr><th>Usuário</th><th>Nome</th><th>Unidade</th><th>Departamento</th><th>Acesso</th></tr></thead><tbody>${list.map(u=>`<tr><td><strong>${u.username}</strong></td><td>${u.name}</td><td>${u.unit}</td><td>${u.department}</td><td><span class="badge done">Ativo</span></td></tr>`).join('')}</tbody></table></div></section>`)}
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

                    <textarea
                        id="solution"
                        rows="4"
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
                    <span>Prioridade / SLA</span>
                    <strong>
                        ${t.priority} · ${t.sla} horas
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
function render(){let page=!state.user?login():state.view==='new'?newTicket():state.view==='mine'?mine():state.view==='queue'?queue():state.view==='users'?usersPage():detail();$('#app').innerHTML=page;bind()}
function updateForm(){const sub=$('#subcategory')?.value,priority=document.querySelector('input[name="priority"]:checked')?.value;if(!sub)return;const type=typeFor(sub);$('#type').value=type;$('#sla').value=priority?`${slas[type][priority]} horas`:'Selecione uma prioridade'}
function bind(){

    console.log('BIND EXECUTADO', state.user);

    if(!state.user){

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

            const priority =
                document.querySelector(
                    'input[name="priority"]:checked'
                )?.value;

            if(!priority){

                alert(
                    'Selecione uma prioridade.'
                );

                return;
            }

            const type =
                typeFor(subcategory);

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

                priority,

                sla:
                    slas[type][priority],

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

    if($('#service')){

        $('#service').onchange = e => {

            const subs =
                catalog[e.target.value] || [];

            $('#subcategory').disabled =
                !subs.length;

            $('#subcategory').innerHTML =
                '<option value="">Selecione uma subcategoria</option>' +
                subs
                    .map(
                        x => `<option>${x}</option>`
                    )
                    .join('');

            updateForm();
        };

        $('#subcategory').onchange =
            updateForm;

        document
            .querySelectorAll(
                'input[name="priority"]'
            )
            .forEach(
                x =>
                    x.onchange =
                        updateForm
            );
    }

    if($('#finish'))
        $('#finish').onclick = () => {

            const list =
                tickets();

            const t =
                list.find(
                    x =>
                        x.id === state.selected
                );

            t.status =
                'Concluído';

            t.closedAt =
                new Date().toISOString();

            save(list);

            render();
        };
}
function showSuccess(t){const modal=document.createElement('div');modal.className='modal';modal.innerHTML=`<div class="modal-box"><h2>✓ Chamado criado com sucesso</h2><p class="number">#2026-${t.id}</p><div class="confirm-list"><strong>${t.service}</strong> · ${t.subcategory}<br>Tipo: ${t.type}<br>Prioridade: ${t.priority}<br>SLA de resolução: ${t.sla} horas<br>Status: Aberto</div><div class="actions"><button class="primary" id="go-mine">Ver meus chamados</button></div></div>`;document.body.append(modal);$('#go-mine').onclick=()=>{modal.remove();state.view='mine';render()}}
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

        const profile = userSnap.data();

        state.user = {
            id: user.uid,
            email: user.email,
            name: profile.name || user.displayName || user.email.split('@')[0],
            username: profile.username || user.email.split('@')[0],
            role: profile.role || 'requester',
            unit: profile.unit || 'Não definido',
            department: profile.department || 'Não definido'
        };

        state.view =
            state.user.role === 'technician'
                ? 'queue'
                : 'new';

                await loadTickets();

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
