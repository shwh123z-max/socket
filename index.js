const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 소켓 서버 설정
const io = require('socket.io')(http, {
  cors: { origin: "*" },
  maxHttpBufferSize: 1e8 // 대용량 이미지 전송 허용
});

app.use(express.static('public'));
app.get('/api/config', (req, res) => {
  res.json({ kakaoKey: process.env.KAKAO_KEY });
});

// 🤖 AI 설정
// (Render에 저장된 GEMINI_KEY를 가져옵니다)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

// ★ 모델 설정: 아까 성공했던 가장 안정적인 모델 사용
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

// 그림 기록 저장소
let history = [];

io.on('connection', (socket) => {
  // 1. 접속하면 지금까지 그려진 그림 전송
  socket.emit('history', history);

  // 2. 선 그리기
  socket.on('drawing', (data) => {
    history.push({ ...data, type: 'line', id: socket.id });
    socket.broadcast.emit('drawing', data);
  });

  // 3. 이미지 업로드
  socket.on('image', (data) => {
    history.push({ ...data, type: 'image', id: socket.id });
    socket.broadcast.emit('image', data);
  });

  // 4. 텍스트 입력
  socket.on('text', (data) => {
    history.push({ ...data, type: 'text', id: socket.id });
    socket.broadcast.emit('text', data);
  });

  // 5. 실행 취소 (Undo)
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
      
      // 화면 갱신
      io.emit('clear');
      io.emit('history', history);
    }
  });

  // 6. 전체 지우기
  socket.on('clear', () => {
    history = [];
    io.emit('clear');
  });

  // 🤖 7. AI에게 그림 맞추기 요청 (대화형 프롬프트 적용)
  socket.on('guess_request', async (imageBase64) => {
    try {
      console.log("AI가 그림을 보는 중...");
      
      // 이미지 데이터 정리
      const base64Data = imageBase64.replace(/^data:image\/(png|jpeg);base64,/, "");

      // ★ 여기가 핵심! 친구처럼 말하게 시키는 주문(프롬프트)
      const prompt = `
        만약 글자를 썼으면 대화하고, 그림이 무엇인지 친구랑 대화하듯이 한국어로 자연스럽게 이야기 해.
        딱딱하게 단어만 말하지 말고, 드립쳐도 돼.
        
        글자는 약 5문장 정도로 해줘."
      `;

      const image = {
        inlineData: {
          data: base64Data,
          mimeType: "image/png",
        },
      };

      // AI에게 질문 던지기
      const result = await model.generateContent([prompt, image]);
      const response = await result.response;
      const text = response.text();

      // AI의 대답을 채팅창으로 전송
      io.emit('guess_result', text);
      
    } catch (error) {
      console.error(error);
      // 에러 나면 채팅창에 알려주기
      io.emit('guess_result', "앗, 잠시만요! 눈이 침침해서 잘 안 보여요... 다시 물어봐주세요! 😵");
    }
  });
});

// 서버 시작 포트 설정
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`서버 준비 완료! 포트: ${PORT}`);
});
