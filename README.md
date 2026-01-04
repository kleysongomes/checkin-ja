# Check-in JA - Escola Sabatina Jovem

Uma aplicação Web Mobile-First moderna para gestão de presença, gamificação e estatísticas missionárias do Ministério Jovem.

## Sobre o Projeto

O **Check-in JA** foi desenvolvido para modernizar a chamada da Escola Sabatina. Focando na experiência do usuário (UX), ele elimina o papel e traz uma interface fluida e gamificada.

O sistema permite que os jovens marquem presença, respondam a perguntas de termômetro missionário (Lição, PG, Estudos, Missão) e visualizem um **Ranking em tempo real** e um **Dashboard** de acompanhamento histórico.

## Funcionalidades Principais

- **Check-in Inteligente**: Validação automática de dia (Sábado) e horário (até 12h).
- **Optimistic UI**: Feedback visual instantâneo sem recarregamento de página.
- **Dashboard Missionário**: Acompanhamento histórico (Semanal e Mensal).
- **Ranking Gamificado**: Pódio visual para o Top 3 e lista de honra.
- **Design Premium**: Glassmorphism, animações suaves e layout responsivo.
- **Segurança**: Bloqueio de check-ins duplicados ou fora de hora.

## Tecnologias Utilizadas

- **Frontend**: Next.js (App Router), React, TypeScript  
- **Estilização**: Tailwind CSS, clsx, tailwind-merge  
- **Backend / DB**: Firebase Firestore  
- **Animações**: Framer Motion  
- **Ícones**: Lucide React  
- **Feedback**: React Hot Toast  

## Como Rodar o Projeto

### 1. Pré-requisitos

- Node.js v18 ou superior  
- Git  

### 2. Clonar o Repositório

```bash
git clone https://github.com/SEU_USUARIO/checkin-ja.git
cd checkin-ja
```

### 3. Instalar Dependências

```bash
npm install
```

### 4. Configurar Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=sua_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu_projeto_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=seu_app_id
```

### 5. Iniciar o Servidor

```bash
npm run dev
```

Acesse: **http://localhost:3000**

## Regras de Segurança do Firebase

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /alunos/{document=**} {
      allow read, write: if true;
    }
    match /estatisticas/{document=**} {
      allow read, write: if true;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Modo de Teste

No arquivo `src/app/page.tsx`:

```ts
const MODO_TESTE = true; // false em produção
```

Quando ativo, ignora validações de dia e horário.

## Estrutura do Banco de Dados

### Coleção: alunos

```json
{
  "nome": "Nome do Jovem",
  "presencas": 15,
  "ultimoCheckin": "Timestamp",
  "historico": ["Timestamp", "Timestamp"]
}
```

### Coleção: estatisticas

```json
{
  "alunoId": "ID_DO_ALUNO",
  "nome": "Nome do Jovem",
  "data": "Timestamp",
  "licao": true,
  "pg": false,
  "estudo": true,
  "missao": false
}
```

## Deploy

Este projeto está pronto para deploy na **Vercel**:

1. Crie uma conta na Vercel  
2. Importe o repositório do GitHub  
3. Configure as variáveis de ambiente  
4. Clique em **Deploy** 🚀
