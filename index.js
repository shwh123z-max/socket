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
  // 접속 시 히스토리 전송
  socket.emit('history', history);

  // --- 1. 그리기 ---
  socket.on('drawing', (data) => {
    history.push({ ...data, type: 'line', id: socket.id });
    socket.broadcast.emit('drawing', data);
  });

  // --- 2. 이미지 ---
  socket.on('image', (data) => {
    history.push({ ...data, type: 'image', id: socket.id });
    socket.broadcast.emit('image', data);
  });

  // --- 3. 텍스트 ---
  socket.on('text', (data) => {
    history.push({ ...data, type: 'text', id: socket.id });
    socket.broadcast.emit('text', data);
  });

  // --- 4. Undo (실행 취소) ---
  socket.on('undo', () => {
    let lastItem = null;
    // 내 기록 중 가장 마지막 것 찾기
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

  // --- 5. 전체 지우기 ---
  socket.on('clear', () => {
    history = [];
    io.emit('clear');
  });
});

// ▼▼▼ 여기가 Render 배포의 핵심입니다! ▼▼▼
const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
  console.log(`서버 준비 완료! 포트 번호: ${PORT}`);
});
