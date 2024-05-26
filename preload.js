const { ipcRenderer } = require('electron');

function updateLastUpdated() {
  const statusColumn = document.getElementById('status-column');
  const toggleBtn = document.getElementById('toggle-btn');
  const lastUpdatedElement = document.getElementById('last-updated');
  if (!lastUpdatedElement) {
    console.error('找不到元素 last-updated');
    return;
  }

  const now = new Date();
  lastUpdatedElement.textContent = '更新时间：' + now.toLocaleString();

  if (statusColumn.style.display === 'none') {
    toggleBtn.click();
  }

  // 页面滚动到顶部
  window.scrollTo(0, 0);
}

ipcRenderer.on('sender-info-init', (event, message) => {
  const senderInfo = JSON.parse(message);
  document.getElementById('server').value = senderInfo.server;
  document.getElementById('port').value = senderInfo.port;
  document.getElementById('ssl').checked = senderInfo.ssl;
  document.getElementById('user-email').value = senderInfo.user_email;
  document.getElementById('password').value = senderInfo.password;
  document.getElementById('display-name').value = senderInfo.display_name;
  document.getElementById('interval').value = senderInfo.interval;
});

ipcRenderer.on('email-template-init', (event, message) => {
  const emailTemplate = JSON.parse(message);
  document.getElementById('subject').value = emailTemplate.subject;
  // document.getElementById('content').value = emailTemplate.content;
  document.getElementById('editor').innerHTML = emailTemplate.content;
});

ipcRenderer.on('email-list-init', (event, message) => {
  const emailList = JSON.parse(message);
  if (emailList.length > 0) {
    document.getElementById('email-list').value = emailList.join('\n');
  } else {
    document.getElementById('email-list').value = 'name,name@example.com';
  }
});

ipcRenderer.on('send-complete', (event, message) => {
  console.log(message);
  alert('发送完成！');
});

ipcRenderer.on('send-status', (event, message) => {
  console.log(message);
  const sendStatus = JSON.parse(message);
  const current_send = document.getElementById('current-send');
  const wait_list = document.getElementById('wait-list');
  const success_list = document.getElementById('success-list');
  const failed_list = document.getElementById('failed-list');
  const wait_process = document.getElementById('wait-process');
  const success_process = document.getElementById('success-process');
  const failed_process = document.getElementById('failed-process');

  current_send.textContent = sendStatus.current_send;
  wait_list.innerHTML = sendStatus.wait_list.map(item => `<li>${item}</li>`).join('');
  success_list.innerHTML = sendStatus.success_list.map(item => `<li>${item}</li>`).join('');
  failed_list.innerHTML = sendStatus.failed_list.map(item => `<li>${item}</li>`).join('');

  let all_send_count = sendStatus.wait_list.length + sendStatus.success_list.length + sendStatus.failed_list.length;
  if (sendStatus.current_send.indexOf('@') !== -1) {
    all_send_count += 1;
  }

  wait_process.textContent = `（${sendStatus.wait_list.length}）`;
  success_process.textContent = `（${sendStatus.success_list.length}/${all_send_count}）`;
  failed_process.textContent = `（${sendStatus.failed_list.length}）`;

  updateLastUpdated();
});

window.addEventListener('DOMContentLoaded', () => {
  const set_sender_info = document.getElementById('set-sender-info');
  if (set_sender_info) {
    set_sender_info.addEventListener('click', () => {
      const server = document.getElementById('server').value;
      const port = document.getElementById('port').value;
      const ssl = document.getElementById('ssl').checked;
      const user_email = document.getElementById('user-email').value;
      const password = document.getElementById('password').value;
      const display_name = document.getElementById('display-name').value;
      const interval = parseInt(document.getElementById('interval').value);

      const senderInfo = {
        server: server,
        port: port,
        ssl: ssl,
        user_email: user_email,
        password: password,
        display_name: display_name,
        interval: interval
      };
      ipcRenderer.send('ipc-sender-info', JSON.stringify(senderInfo));
    });
  } else {
    console.error('找不到元素 set-sender-info');
  }

  const send_once = document.getElementById('send-once');
  if (send_once) {
    send_once.addEventListener('click', () => {
      document.getElementById('export-html').click();
      updateLastUpdated();

      let email_list = document.getElementById('email-list').value;
      email_list = email_list.split('\n').filter(item => item.trim() !== '');
      const subject = document.getElementById('subject').value;
      // const content = document.getElementById('content').value;
      const content = document.getElementById('editor-output').value;

      const toInfo = {
        email_list: email_list,
        subject: subject,
        html: content
      };
      ipcRenderer.send('ipc-send-once', JSON.stringify(toInfo));
    });
  } else {
    console.error('找不到元素 send-once');
  }

  const send_auto = document.getElementById('send-auto');
  if (send_auto) {
    send_auto.addEventListener('click', () => {
      document.getElementById('export-html').click();
      updateLastUpdated();

      let email_list = document.getElementById('email-list').value;
      email_list = email_list.split('\n').filter(item => item.trim() !== '');
      const subject = document.getElementById('subject').value;
      // const content = document.getElementById('content').value;
      const content = document.getElementById('editor-output').value;

      const toInfo = {
        email_list: email_list,
        subject: subject,
        html: content
      };
      ipcRenderer.send('ipc-send-auto', JSON.stringify(toInfo));
    });
  } else {
    console.error('找不到元素 send-auto');
  }
})