const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const nodemailer = require("nodemailer");

if (process.env.NODE_ENV === 'development') {
  const electronReload = require('electron-reload');

  const ignored1 = /frontend\/node_modules|[/\\]\./;  // all folder frontend/node_modules => frontend/node_modules
  const ignored2 = /configs|[/\\]\./;                 // all folder configs => configs
  const ignoredNode = /node_modules|[/\\]\./;

  electronReload(__dirname, {
    ignored: [ignored1, ignored2, ignoredNode]
  });
}

const userDataPath = app.getPath('userData');
const configDir = path.join(userDataPath, 'configs');
console.log('userDataPath', userDataPath);

function appendHistoryFile(content) {
  const historyFile = path.join(userDataPath, 'send_history.txt');
  fs.appendFileSync(historyFile, content + '\n');
}

let win = null;
let senderInfo = {
  server: 'smtp.example.com',
  port: '465',
  ssl: true,
  user_email: 'user@example.com',
  password: 'password',
  display_name: 'User Name 👻',
  interval: 10
};
let email_template = null;
let transporter = null;
let current_send = '无';
let wait_list = [];
let success_list = [];
let failed_list = [];

ipcMain.on('ipc-sender-info', (event, message) => {
  // 将 senderInfo 写入到 configs/sender_info.json 文件中
  fs.writeFileSync(path.join(configDir, 'sender_info.json'), message);

  senderInfo = JSON.parse(message);
});

ipcMain.on('ipc-send-once', (event, message) => {
  const toInfo = JSON.parse(message);

  email_template = {
    subject: toInfo.subject,
    content: toInfo.html
  };
  // 将 email_template 写入到 configs/email_template.json 文件中
  fs.writeFileSync(path.join(configDir, 'email_template.json'), JSON.stringify(email_template));

  const email_list = toInfo.email_list;
  // 将 email_list 写入到 configs/email_list.json 文件中
  fs.writeFileSync(path.join(configDir, 'email_list.json'), JSON.stringify(email_list));

  current_send = '无';
  success_list = [];
  failed_list = [];
  wait_list = [];

  if (email_list.length === 0) {
    current_send = '没有待发送的邮箱';
    sendStatus();
    return;
  }

  // 判断成员是否有 @ 符号
  if (email_list[0].indexOf('@') !== -1) {
    wait_list.push(email_list[0]);
  } else {
    failed_list.push(email_list[0]);
  }

  if (wait_list.length === 0) {
    sendStatus();
    return;
  }

  appendHistoryFile(`${new Date().toLocaleString()} 开始一次性发送...`);

  transporter = nodemailer.createTransport({
    host: senderInfo.server,
    port: senderInfo.port,
    secure: senderInfo.ssl,
    auth: {
      user: senderInfo.user_email,
      pass: senderInfo.password,
    },
  });

  startSendMail();
});

ipcMain.on('ipc-send-auto', (event, message) => {
  const toInfo = JSON.parse(message);

  email_template = {
    subject: toInfo.subject,
    content: toInfo.html
  };
  // 将 email_template 写入到 configs/email_template.json 文件中
  fs.writeFileSync(path.join(configDir, 'email_template.json'), JSON.stringify(email_template));

  const email_list = toInfo.email_list;
  // 将 email_list 写入到 configs/email_list.json 文件中
  fs.writeFileSync(path.join(configDir, 'email_list.json'), JSON.stringify(email_list));

  current_send = '无';
  success_list = [];
  failed_list = [];
  wait_list = [];

  for (let i = 0; i < email_list.length; i++) {
    // 判断成员是否有 @ 符号
    if (email_list[i].indexOf('@') === -1) {
      failed_list.push(email_list[i]);
      continue;
    }
    wait_list.push(email_list[i]);
  }

  if (wait_list.length === 0) {
    sendStatus();
    return;
  }

  appendHistoryFile(`${new Date().toLocaleString()} 开始自动发送...`);

  transporter = nodemailer.createTransport({
    host: senderInfo.server,
    port: senderInfo.port,
    secure: senderInfo.ssl,
    auth: {
      user: senderInfo.user_email,
      pass: senderInfo.password,
    },
  });

  startSendMail();
});

function sendStatus() {
  win.webContents.send('send-status', JSON.stringify({
    current_send: current_send,
    success_list: success_list,
    failed_list: failed_list,
    wait_list: wait_list
  }));
}

async function startSendMail() {
  if (wait_list.length === 0) {
    current_send = '无';
    sendStatus();
    return;
  }

  // 从 wait_list 中取出第一个成员
  current_send = wait_list.shift();
  sendStatus();

  const index = current_send.lastIndexOf(',');
  let to_name = null;
  let to_email = null;
  if (index === -1) {
    to_email = current_send.trim();
  } else {
    to_name = current_send.substring(0, index).trim();
    to_email = current_send.substring(index + 1).trim();
  }

  // 如果 to_email 不包含 @ 符号，则跳过
  if (to_email.indexOf('@') === -1) {
    failed_list.push(current_send);
    startSendMail();
    return;
  }

  let mailOptions = null;
  if (to_name !== null) {
    // 替换 subject 和 html 中的 {{name}} 为 to_name
    const subject = email_template.subject.replace(/{{name}}/g, to_name);
    const html = email_template.content.replace(/{{name}}/g, to_name);

    mailOptions = {
      from: `"${senderInfo.display_name}" <${senderInfo.user_email}>`,
      to: `"${to_name}" <${to_email}>`,
      subject: subject,
      html: html,
      attachDataUrls : true  // 此项为 true 时会将 html 中 base64 编码的图片转换为附件
    };
  } else {
    // 替换 subject 和 html 中的 {{name}} 为 friend
    const subject = email_template.subject.replace(/{{name}}/g, 'friend');
    const html = email_template.content.replace(/{{name}}/g, 'friend');

    mailOptions = {
      from: `"${senderInfo.display_name}" <${senderInfo.user_email}>`,
      to: `${to_email}`,
      subject: subject,
      html: html,
    };
  }

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      // console.error(error);
      failed_list.push(current_send);

      appendHistoryFile(`${new Date().toLocaleString()} 发送失败 [${current_send}] ${error.message}`);
    } else {
      // console.log('Email sent: ' + info.response);
      success_list.push(current_send);

      appendHistoryFile(`${new Date().toLocaleString()} 发送成功 [${current_send}]`);
    }

    if (wait_list.length === 0) {
      current_send = '全部处理完成';
      appendHistoryFile(`${new Date().toLocaleString()} 全部发送完成`);
      sendStatus();
      return;
    }

    current_send = '等待下一次发送...';
    sendStatus();

    setTimeout(() => {
      startSendMail();
    }, senderInfo.interval * 1000);
  });
}

function createWindow () {
  // 当前目录下不存在 configs 目录就创建该目录
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
  }

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('frontend/dist/index.html');

  // 当前目录下存在 configs/sender_info.json 就加载该配置，并发送给渲染进程
  if (fs.existsSync(path.join(configDir, 'sender_info.json'))) {
    senderInfo = JSON.parse(fs.readFileSync(path.join(configDir, 'sender_info.json')), 'utf-8');
    win.webContents.send('sender-info-init', JSON.stringify(senderInfo));
  }

  // 当前目录下存在 configs/email_template.json 就加载该配置，并发送给渲染进程
  if (fs.existsSync(path.join(configDir, 'email_template.json'))) {
    const emailTemplate = fs.readFileSync(path.join(configDir, 'email_template.json'), 'utf-8');
    win.webContents.send('email-template-init', emailTemplate);
  }

  // 当前目录下存在 configs/email_list.json 就加载该配置，并发送给渲染进程
  if (fs.existsSync(path.join(configDir, 'email_list.json'))) {
    const emailList = fs.readFileSync(path.join(configDir, 'email_list.json'), 'utf-8');
    win.webContents.send('email-list-init', emailList);
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});