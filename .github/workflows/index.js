const express = require('express');
const app = express();
const http = require('http').createServer(app);

const io = require('socket.io')(http, {
  cors: { origin: "*" },
  maxHttpBufferSize: 1e8 
});

app.use(express.static('public'));

let history = [];

io.on('connection', (socket) => {
  socket.emit('history', history);

  // --- 데이터 받을 때 'strokeId(세트 번호)'도 같이 저장 ---
  socket.on('drawing', (data) => {
    history.push({ ...data, type: 'line', id: socket.id });
    socket.broadcast.emit('drawing', data);
  });

  socket.on('image', (data) => {
    history.push({ ...data, type: 'image', id: socket.id });
    socket.broadcast.emit('image', data);
  });

  socket.on('text', (data) => {
    history.push({ ...data, type: 'text', id: socket.id });
    socket.broadcast.emit('text', data);
  });

  // --- Undo: 한 획(세트) 전체 삭제 ---
  socket.on('undo', () => {
    let lastItem = null;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].id === socket.id) {
        lastItem = history[i];
        break;
      }
    }

    if (lastItem) {
      const targetStrokeId = lastItem.strokeId;

      if (targetStrokeId) {
        // [선 그리기] 같은 세트 번호 가진 애들 싹 다 삭제
        history = history.filter(item => item.strokeId !== targetStrokeId);
      } else {
        // [사진/텍스트] 단일 항목 삭제
        const index = history.indexOf(lastItem);
        if (index > -1) history.splice(index, 1);
      }

      console.log(`↩️ Undo 완료!`);
      
      // 화면 갱신
      io.emit('clear');
      io.emit('history', history);
    }
  });

  socket.on('clear', () => {
    history = [];
    io.emit('clear');
  });
});

// ▼▼▼ 여기가 Render 배포의 핵심입니다! ▼▼▼
// Render가 주는 포트(process.env.PORT)를 쓰거나, 없으면 3000을 씁니다.
const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
  console.log(`서버 준비 완료! 포트 번호: ${PORT}`);
});
  socket.on('undo', () => {
    // 1. 내 기록 중 가장 마지막 것 찾기
    let lastItem = null;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].id === socket.id) {
        lastItem = history[i];
        break;
      }
    }

    if (lastItem) {
      // 2. 그 녀석의 '세트 번호(strokeId)'가 뭔지 확인
      const targetStrokeId = lastItem.strokeId;

      if (targetStrokeId) {
        // [선 그리기인 경우] 같은 세트 번호 가진 애들 싹 다 삭제
        history = history.filter(item => item.strokeId !== targetStrokeId);
      } else {
        // [사진이나 텍스트인 경우] 그냥 그 하나만 삭제 (얘네는 세트가 없음)
        const index = history.indexOf(lastItem);
        if (index > -1) history.splice(index, 1);
      }

      console.log(`↩️ Undo 완료! (세트번호: ${targetStrokeId || '단일항목'})`);
      
      // 3. 화면 갱신
      io.emit('clear');
      io.emit('history', history);
    }
  });

  socket.on('clear', () => {
    history = [];
    io.emit('clear');
  });
});

http.listen(3000, () => {
  console.log('서버 준비 완료 (Undo 그룹 삭제 적용)');
});


on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

jobs:
  build:

    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]
        # See supported Node.js release schedule at https://nodejs.org/en/about/releases/

    steps:
    - uses: actions/checkout@v4
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    - run: npm ci
    - run: npm run build --if-present
    - run: npm test
