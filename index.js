const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { GoogleGenerativeAI } = require("@google/generative-ai"); // AI 도구 가져오기

const io = require('socket.io')(http, {
  cors: { origin: "*" },
  maxHttpBufferSize: 1e8 
});

app.use(express.static('public'));

// AI 설정 (Render에 숨겨둔 키를 가져옵니다)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);// gemini-pro-vision 지우고 아래 걸로 복구!
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

let history = [];

io.on('connection', (socket) => {
  socket.emit('history', history);

  // ... 기존 그리기 기능들 ...
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
        history = history.filter(item => item.strokeId !== targetStrokeId);
      } else {
        const index = history.indexOf(lastItem);
        if (index > -1) history.splice(index, 1);
      }
      io.emit('clear');
      io.emit('history', history);
    }
  });

  socket.on('clear', () => {
    history = [];
    io.emit('clear');
  });

  // ✨ [NEW] AI에게 맞춰보라고 시키기!
  socket.on('guess_request', async (imageBase64) => {
    try {
      console.log("AI가 그림을 보는 중...");
      
      // 이미지 데이터 정리 (앞에 'data:image/png;base64,' 떼어내기)
      const base64Data = imageBase64.replace(/^data:image\/(png|jpeg);base64,/, "");

      // AI에게 질문
      const prompt = "이 그림이 뭔지 한 단어로 짧게 한국어로 맞춰봐. (예: 고양이, 사과)";
      const image = {
        inlineData: {
          data: base64Data,
          mimeType: "image/png",
        },
      };

      const result = await model.generateContent([prompt, image]);
      const response = await result.response;
      const text = response.text();

      // 정답을 모든 사람에게 알리기
      io.emit('guess_result', text);
      
    } catch (error) {
      console.error(error);
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`AI 화가 서버 준비 완료! 포트: ${PORT}`);
});
