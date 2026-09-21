# Portal ITSM — Ambiente de Teste

Protótipo local para demonstrar abertura e tratamento básico de chamados. Os dados ficam no armazenamento local do navegador.

## Como executar

Abra o arquivo `index.html` em um navegador. Não há instalação de dependências, servidor ou banco de dados necessário: os dados são mantidos no armazenamento local do navegador.

Para testar o fluxo conversacional, clique em **Experimentar assistente de TI** na tela de login ou abra `chatbot.html`. O chatbot guia a abertura do chamado e registra o ticket na mesma fila da equipe técnica.

## Contas de demonstração

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Solicitante | solicitante@teste.local | 123456 |
| Técnico 1 | tecnico1@teste.local | 123456 |
| Técnico 2 | tecnico2@teste.local | 123456 |

## Integração futura da automação

O arquivo `app.js` expõe uma API local em `window.localTicketApi`. A automação pode chamar:

```js
window.localTicketApi.createTicket({
  requester: 'João da Silva', service: 'Impressora',
  subcategory: 'Impressora não funciona', priority: 'Média',
  description: 'A impressora não está imprimindo.'
});
```

Para uma integração externa real, esta é a única camada que deve ser substituída por uma rota HTTP local, por exemplo `POST /api/tickets`.
