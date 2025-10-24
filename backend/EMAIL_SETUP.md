# Configuração de E-mail

Este sistema usa SMTP para envio de e-mails. Siga as instruções abaixo para configurar.

## Configuração do Gmail

### 1. Habilitar Verificação em 2 Etapas

1. Acesse [myaccount.google.com](https://myaccount.google.com)
2. Vá em **Segurança**
3. Ative **Verificação em duas etapas**

### 2. Criar Senha de App

1. Acesse [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Selecione **E-mail** como app
3. Selecione **Outro** como dispositivo e nomeie (ex: "Sistema de Orçamentos")
4. Clique em **Gerar**
5. **Copie a senha de 16 caracteres** (ela não será mostrada novamente)

### 3. Configurar o Backend

No arquivo `.env` do backend, adicione:

```env
# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_PASSWORD=sua-senha-de-app-aqui
```

**IMPORTANTE**: Use a senha de app gerada no passo 2, NÃO use sua senha do Gmail!

### 4. Configurar o Frontend

1. Acesse **Configurações** no sistema
2. Preencha o campo **Email** com o e-mail do Gmail que você configurou
3. Clique em **Salvar**

## Outros Provedores de E-mail

### Outlook/Hotmail

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_PASSWORD=sua-senha
```

### Yahoo

```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_PASSWORD=sua-senha-de-app
```

## Testando o E-mail

1. Cadastre um cliente com e-mail válido
2. Crie um orçamento para este cliente
3. Abra o orçamento na visualização
4. Selecione as vias desejadas
5. Clique no botão de **envelope** (📧)
6. Aguarde a mensagem de sucesso

## Solução de Problemas

### "E-mail da empresa não configurado"
- Configure o e-mail em **Configurações** → **Informações da Empresa** → **Email**

### "Falha na autenticação do e-mail"
- Verifique se a senha de app está correta no `.env`
- Certifique-se de que a verificação em 2 etapas está ativa
- Gere uma nova senha de app se necessário

### "Não foi possível conectar ao servidor de e-mail"
- Verifique sua conexão com a internet
- Confirme se o SMTP_HOST e SMTP_PORT estão corretos
- Verifique se não há firewall bloqueando a porta 587

### "Cliente sem e-mail cadastrado"
- Edite o cadastro do cliente
- Adicione um e-mail válido
- Tente enviar novamente

## Estrutura do E-mail Enviado

O e-mail inclui:
- ✅ Logo da empresa (configurada em Configurações)
- ✅ Mensagem personalizada com nome do cliente
- ✅ PDF anexado com o orçamento
- ✅ Link alternativo caso não consiga abrir o anexo
- ✅ Layout responsivo e profissional
- ✅ Assinatura "Janio Retífica"

## Segurança

- ⚠️ **NUNCA** compartilhe sua senha de app
- ⚠️ Adicione o arquivo `.env` ao `.gitignore`
- ⚠️ Use senhas de app específicas, não sua senha principal
- ⚠️ Revogue senhas de app que não estiverem em uso
