
// =====================================================================================
// SCRIPT DE BACKEND (GOOGLE APPS SCRIPT) - TODESCHINI APP (CORRIGIDO E ATUALIZADO)
// =====================================================================================
// Instruções CRÍTICAS:
// 1. Copie este código para o arquivo 'Código.gs'.
// 2. Salve o projeto.
// 3. Clique em "Implantar" > "Nova implantação" (NÃO use "Gerenciar implantações").
// 4. Selecione o tipo "App da Web".
// 5. Em "Descrição", coloque "Versão Corrigida PDF".
// 6. Em "Executar como", selecione "Eu".
// 7. Em "Quem pode acessar", selecione "Qualquer pessoa".
// 8. Clique em "Implantar".
// 9. A URL deve ser a mesma se você fez "Nova implantação" sobre a anterior corretamente,
//    mas se mudar, atualize no frontend.
// =====================================================================================

const SHEET_REQUISITIONS = "Requisicoes";
const SHEET_PARTS = "Pecas";
const SHEET_USERS = "Usuarios";
const EMAIL_SUBJECT_PREFIX = "[Todeschini App] ";

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'login') return handleLogin(data);
    if (action === 'createUser') return handleCreateUser(data);
    if (action === 'updateUser') return handleUpdateUser(data);
    if (action === 'deleteUser') return handleDeleteUser(data);
    if (action === 'changePassword') return handleChangePassword(data);
    if (action === 'getUsers') return handleGetUsers();

    if (action === 'savePartsRequest') return handleSavePartsRequest(data);
    if (action === 'getPartsRequests') return handleGetPartsRequests();
    if (action === 'deletePartsRequest') return handleDeletePartsRequest(data);

    if (action === 'delete') return handleDeleteRequisition(data);
    if (action === 'getImage') return handleGetImage(data);
    
    return handleSaveRequisition(data);

  } catch (error) {
    return responseJSON({ status: 'error', message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'getPartsRequests') return handleGetPartsRequests();
  if (action === 'getUsers') return handleGetUsers();
  return handleGetRequisitions();
}

// --- USUÁRIOS ---

function handleLogin(data) {
  const sheet = getSheet(SHEET_USERS);
  const users = sheet.getDataRange().getValues();
  
  for (let i = 1; i < users.length; i++) {
    if (users[i][0] == data.username && users[i][1] == data.password) {
      return responseJSON({ 
        status: 'success', 
        user: { 
          username: users[i][0], 
          name: users[i][2], 
          role: users[i][3],
          email: users[i].length > 4 ? users[i][4] : '',
          receiveNotifications: users[i].length > 5 ? users[i][5] : false
        } 
      });
    }
  }
  return responseJSON({ status: 'error', message: 'Usuário ou senha incorretos' });
}

function handleCreateUser(data) {
  const sheet = getSheet(SHEET_USERS);
  const users = sheet.getDataRange().getValues();
  
  for (let i = 1; i < users.length; i++) {
    if (users[i][0] == data.username) {
      return responseJSON({ status: 'error', message: 'Usuário já existe' });
    }
  }

  // Garante que estamos escrevendo nas colunas certas, mesmo se a planilha estiver vazia
  sheet.appendRow([
    data.username, 
    data.password, 
    data.name, 
    data.role, 
    data.email || '', 
    data.receiveNotifications || false
  ]);
  
  return responseJSON({ status: 'success', message: 'Usuário criado' });
}

function handleUpdateUser(data) {
  const sheet = getSheet(SHEET_USERS);
  const users = sheet.getDataRange().getValues();
  
  for (let i = 1; i < users.length; i++) {
    if (users[i][0] == data.username) {
      const row = i + 1;
      const newPassword = data.password ? data.password : users[i][1];
      
      sheet.getRange(row, 2).setValue(newPassword);
      sheet.getRange(row, 3).setValue(data.name);
      sheet.getRange(row, 4).setValue(data.role);
      
      // Garante que as colunas 5 e 6 existem antes de escrever
      if (sheet.getMaxColumns() < 6) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(), 6 - sheet.getMaxColumns());
      }
      
      sheet.getRange(row, 5).setValue(data.email || '');
      sheet.getRange(row, 6).setValue(data.receiveNotifications || false);
      
      return responseJSON({ status: 'success', message: 'Usuário atualizado' });
    }
  }
  return responseJSON({ status: 'error', message: 'Usuário não encontrado' });
}

function handleGetUsers() {
  const sheet = getSheet(SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  const users = [];
  
  for (let i = 1; i < data.length; i++) {
    users.push({
      username: data[i][0],
      name: data[i][2],
      role: data[i][3],
      email: data[i].length > 4 ? data[i][4] : '',
      receiveNotifications: data[i].length > 5 ? data[i][5] : false
    });
  }
  return responseJSON({ status: 'success', users: users });
}

function handleDeleteUser(data) {
  const sheet = getSheet(SHEET_USERS);
  const users = sheet.getDataRange().getValues();
  for (let i = 1; i < users.length; i++) {
    if (users[i][0] == data.username) {
      sheet.deleteRow(i + 1);
      return responseJSON({ status: 'success', message: 'Usuário excluído' });
    }
  }
  return responseJSON({ status: 'error', message: 'Usuário não encontrado' });
}

function handleChangePassword(data) {
  const sheet = getSheet(SHEET_USERS);
  const users = sheet.getDataRange().getValues();
  for (let i = 1; i < users.length; i++) {
    if (users[i][0] == data.username) {
      if (data.oldPassword && users[i][1] != data.oldPassword) {
         return responseJSON({ status: 'error', message: 'Senha atual incorreta' });
      }
      sheet.getRange(i + 1, 2).setValue(data.newPassword);
      return responseJSON({ status: 'success', message: 'Senha alterada' });
    }
  }
  return responseJSON({ status: 'error', message: 'Usuário não encontrado' });
}

// --- REQUISIÇÕES ---

function handleSaveRequisition(data) {
  const sheet = getSheet(SHEET_REQUISITIONS);
  const rows = sheet.getDataRange().getValues();
  let rowIndex = -1;
  let finalNumber = data.requisitionNumber;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == data.id) {
      rowIndex = i + 1;
      break;
    }
  }

  // Lógica de numeração automática baseada no tipo (Produção R- / Fábrica F-)
  if (rowIndex === -1 && (!data.requisitionNumber || data.requisitionNumber === 'R-1000' || data.requisitionNumber === 'F-1')) {
     const prefix = data.type === 'Fábrica' ? 'F-' : 'R-';
     const startNum = data.type === 'Fábrica' ? 0 : 1000;
     let maxNum = startNum;
     
     for (let i = 1; i < rows.length; i++) {
        const numStr = String(rows[i][1]);
        if (numStr.startsWith(prefix)) {
           const num = parseInt(numStr.replace(prefix, ''));
           if (!isNaN(num) && num > maxNum) maxNum = num;
        }
     }
     finalNumber = prefix + (maxNum + 1);
  }

  const rowData = [
    data.id,
    finalNumber,
    data.date,
    data.clientName,
    data.environment,
    data.fitter,
    data.purchaseOrder,
    data.responsible,
    JSON.stringify(data.services),
    JSON.stringify(data.deliveryItems),
    JSON.stringify(data.photos),
    data.status,
    data.createdAt,
    data.createdBy,
    data.dateInProgress || '',
    data.dateDone || '',
    data.canceledBy || '',
    data.type || 'Produção'
  ];

  if (rowIndex === -1) {
    sheet.appendRow(rowData);
  } else {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  }

  let driveError = null;
  if (data.photos && data.photos.length > 0) {
    try {
      const updatedPhotos = processPhotos(data.photos, finalNumber);
      const currentRow = rowIndex === -1 ? sheet.getLastRow() : rowIndex;
      sheet.getRange(currentRow, 11).setValue(JSON.stringify(updatedPhotos));
    } catch (e) {
      driveError = e.toString();
    }
  }

  let emailError = null;
  if (data.notificationEmails && data.notificationEmails.length > 0) {
    try {
      sendRequisitionEmail(data, finalNumber, data.notificationEmails);
    } catch (e) {
      emailError = e.toString();
    }
  }

  return responseJSON({ 
    status: 'success', 
    finalNumber: finalNumber,
    driveError: driveError,
    emailError: emailError
  });
}

function handleGetRequisitions() {
  const sheet = getSheet(SHEET_REQUISITIONS);
  const rows = sheet.getDataRange().getValues();
  const requisitions = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    requisitions.push({
      id: r[0],
      requisitionNumber: r[1],
      date: r[2],
      clientName: r[3],
      environment: r[4],
      fitter: r[5],
      purchaseOrder: r[6],
      responsible: r[7],
      services: parseJSONSafe(r[8]),
      deliveryItems: parseJSONSafe(r[9]),
      photos: parseJSONSafe(r[10]),
      status: r[11],
      createdAt: r[12],
      createdBy: r[13],
      dateInProgress: r[14],
      dateDone: r[15],
      canceledBy: r[16],
      type: r[17] || 'Produção'
    });
  }
  return responseJSON(requisitions);
}

function handleDeleteRequisition(data) {
  const sheet = getSheet(SHEET_REQUISITIONS);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == data.id) {
      sheet.deleteRow(i + 1);
      return responseJSON({ status: 'success' });
    }
  }
  return responseJSON({ status: 'error', message: 'Não encontrado' });
}

function handleGetImage(data) {
  try {
    const file = DriveApp.getFileById(data.fileId);
    const blob = file.getBlob();
    const b64 = Utilities.base64Encode(blob.getBytes());
    return responseJSON({
      status: 'success',
      dataUrl: 'data:' + blob.getContentType() + ';base64,' + b64
    });
  } catch (err) {
    return responseJSON({ status: 'error', message: 'Erro imagem: ' + err.toString() });
  }
}

// --- PEÇAS ---

function handleSavePartsRequest(data) {
  const sheet = getSheet(SHEET_PARTS);
  const rows = sheet.getDataRange().getValues();
  let rowIndex = -1;
  let finalNumber = data.requestNumber;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == data.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1 && (!data.requestNumber || data.requestNumber === 'P-1000' || data.requestNumber === 'P-0001')) {
     let maxNum = 0;
     for (let i = 1; i < rows.length; i++) {
        const numStr = String(rows[i][1]);
        if (numStr.startsWith('P-')) {
           const num = parseInt(numStr.replace('P-', ''));
           if (!isNaN(num) && num > maxNum) maxNum = num;
        }
     }
     finalNumber = 'P-' + ('0000' + (maxNum + 1)).slice(-4);
  }

  let driveError = null;
  let photoPart = data.photoPart;
  let photoLabel = data.photoLabel;

  try {
     if (photoPart && photoPart.dataUrl) {
        const processed = processPhotos([photoPart], finalNumber + "_PECA");
        photoPart = processed[0];
     }
     if (photoLabel && photoLabel.dataUrl) {
        const processed = processPhotos([photoLabel], finalNumber + "_ETIQUETA");
        photoLabel = processed[0];
     }
  } catch (e) {
     driveError = e.toString();
  }

  const rowData = [
    data.id,
    finalNumber,
    data.date,
    data.clientName,
    data.fitter,
    data.mjf,
    data.type,
    data.status,
    JSON.stringify(data.items || []),
    JSON.stringify(photoPart || {}),
    JSON.stringify(photoLabel || {}),
    data.createdAt,
    data.createdBy
  ];

  if (rowIndex === -1) {
    sheet.appendRow(rowData);
  } else {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  }

  let emailError = null;
  if (data.notificationEmails && data.notificationEmails.length > 0) {
    try {
      sendPartsEmail(data, finalNumber, data.notificationEmails, photoPart, photoLabel);
    } catch (e) {
      emailError = e.toString();
    }
  }

  return responseJSON({ 
    status: 'success', 
    finalNumber: finalNumber,
    driveError: driveError,
    emailError: emailError
  });
}

function handleGetPartsRequests() {
  const sheet = getSheet(SHEET_PARTS);
  const rows = sheet.getDataRange().getValues();
  const requests = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    requests.push({
      id: r[0],
      requestNumber: r[1],
      date: r[2],
      clientName: r[3],
      fitter: r[4],
      mjf: r[5],
      type: r[6],
      status: r[7],
      items: parseJSONSafe(r[8]),
      photoPart: parseJSONSafe(r[9]),
      photoLabel: parseJSONSafe(r[10]),
      createdAt: r[11],
      createdBy: r[12]
    });
  }
  return responseJSON(requests);
}

function handleDeletePartsRequest(data) {
  const sheet = getSheet(SHEET_PARTS);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == data.id) {
      sheet.deleteRow(i + 1);
      return responseJSON({ status: 'success' });
    }
  }
  return responseJSON({ status: 'error', message: 'Não encontrado' });
}

// --- UTILITÁRIOS ---

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === SHEET_USERS) sheet.appendRow(['Username', 'Password', 'Name', 'Role', 'Email', 'ReceiveNotifications']);
    if (name === SHEET_REQUISITIONS) sheet.appendRow(['ID', 'Numero', 'Data', 'Cliente', 'Ambiente', 'Montador', 'OC', 'Responsavel', 'Servicos', 'Entregas', 'Fotos', 'Status', 'CriadoEm', 'CriadoPor', 'DataProgresso', 'DataConclusao', 'CanceladoPor', 'Tipo']);
    if (name === SHEET_PARTS) sheet.appendRow(['ID', 'Numero', 'Data', 'Cliente', 'Montador', 'MJF', 'Tipo', 'Status', 'Itens', 'FotoPeca', 'FotoEtiqueta', 'CriadoEm', 'CriadoPor']);
  }
  return sheet;
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function parseJSONSafe(str) {
  try { return JSON.parse(str); } catch (e) { return null; }
}

function processPhotos(photos, prefix) {
  const folderName = "Todeschini_App_Images";
  let folder;
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  return photos.map((photo, index) => {
    if (photo.url && photo.url.includes('google.com')) return photo;
    if (photo.dataUrl) {
      const data = photo.dataUrl.split(',')[1];
      const blob = Utilities.newBlob(Utilities.base64Decode(data), 'image/jpeg', `${prefix}_${index + 1}.jpg`);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return { id: photo.id, url: file.getDownloadUrl(), caption: photo.caption };
    }
    return photo;
  });
}

// --- E-MAILS COM PDF ---

function sendRequisitionEmail(data, number, recipients) {
  const subject = `[${data.type || 'Requisição'}] ${EMAIL_SUBJECT_PREFIX}Nova Requisição ${number} - ${data.clientName}`;
  
  let htmlBody = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2 style="color: #c00;">Nova Requisição de ${data.type || 'Serviço/Entrega'}</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr><td><strong>Número:</strong></td><td>${number}</td></tr>
        <tr><td><strong>Status:</strong></td><td>${data.status}</td></tr>
        <tr><td><strong>Cliente:</strong></td><td>${data.clientName}</td></tr>
        <tr><td><strong>Montador:</strong></td><td>${data.fitter}</td></tr>
        <tr><td><strong>Ambiente:</strong></td><td>${data.environment}</td></tr>
        <tr><td><strong>OC:</strong></td><td>${data.purchaseOrder}</td></tr>
      </table>
      
      <h3 style="background: #eee; padding: 5px;">${data.type === 'Fábrica' ? 'Peças' : 'Serviços'}</h3>
      <ul>
        ${data.services.map(s => `<li><strong>${s.quantity}x</strong> ${s.description} <br><small>${s.specification || ''} ${s.reason ? '| Motivo: ' + s.reason : ''}</small></li>`).join('')}
      </ul>
      
      <h3 style="background: #eee; padding: 5px;">Entregas</h3>
      <ul>
        ${data.deliveryItems.map(i => `<li><strong>${i.quantity}x</strong> ${i.description} <br><small>Forn: ${i.supplier || '-'} | OK: ${i.deliveryOk}</small></li>`).join('')}
      </ul>
      
      <hr>
      <p style="font-size: 12px; color: #999;">Enviado automaticamente pelo App Todeschini.</p>
    </div>
  `;

  if (data.status === 'Cancelada') {
     htmlBody = `<h2 style="color:red; text-align:center;">REQUISIÇÃO CANCELADA</h2>` + htmlBody;
  }

  // Gera PDF do HTML
  const pdfBlob = Utilities.newBlob(htmlBody, 'text/html').getAs('application/pdf').setName(`Requisicao_${number}.pdf`);

  MailApp.sendEmail({
    to: recipients.join(','),
    subject: subject,
    htmlBody: htmlBody,
    attachments: [pdfBlob]
  });
}

function sendPartsEmail(data, number, recipients, photoPart, photoLabel) {
  const subject = `${EMAIL_SUBJECT_PREFIX}Pedido de Peça ${number} - ${data.clientName}`;
  
  let htmlBody = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2 style="color: #c00;">Novo Pedido de Peça</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr><td><strong>Número:</strong></td><td>${number}</td></tr>
        <tr><td><strong>Tipo:</strong></td><td>${data.type}</td></tr>
        <tr><td><strong>Cliente:</strong></td><td>${data.clientName}</td></tr>
        <tr><td><strong>Montador:</strong></td><td>${data.fitter}</td></tr>
        <tr><td><strong>MJF:</strong></td><td>${data.mjf}</td></tr>
      </table>
      
      <h3 style="background: #eee; padding: 5px;">Itens</h3>
      <ul>
        ${(data.items || []).map(i => `<li><strong>${i.quantity}x</strong> ${i.description} <br><small>Cor: ${i.color}</small></li>`).join('')}
      </ul>
      
      <hr>
  `;

  if (photoPart && photoPart.url) {
     htmlBody += `<p><strong>Foto da Peça:</strong> <a href="${photoPart.url}">Visualizar</a></p>`;
  }
  if (photoLabel && photoLabel.url) {
     htmlBody += `<p><strong>Foto da Etiqueta:</strong> <a href="${photoLabel.url}">Visualizar</a></p>`;
  }

  htmlBody += `<p style="font-size: 12px; color: #999;">Enviado automaticamente pelo App Todeschini.</p></div>`;

  // Gera PDF do HTML
  const pdfBlob = Utilities.newBlob(htmlBody, 'text/html').getAs('application/pdf').setName(`PedidoPeca_${number}.pdf`);

  MailApp.sendEmail({
    to: recipients.join(','),
    subject: subject,
    htmlBody: htmlBody,
    attachments: [pdfBlob]
  });
}
