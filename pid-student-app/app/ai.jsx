import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
    addDoc, collection, deleteDoc, doc,
    onSnapshot, orderBy, query, serverTimestamp, where
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    Animated, Easing, Image, KeyboardAvoidingView,
    Platform, Pressable, ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebase';
import { useUnreadCount } from '../hooks/useUnreadCount';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SUBJECTS = ['General', 'Physics', 'Chemistry', 'Mathematics', 'Biology'];
const LANGUAGES = [
  { key: 'hinglish', label: 'HI+EN' },
  { key: 'hindi',    label: 'हिंदी' },
  { key: 'english',  label: 'EN' },
];

const T = {
  navy:    '#0C1F36',
  navy2:   '#162544',
  accent:  '#1349A8',
  gold:    '#D4A843',
  bg:      '#F0F4FA',
  card:    '#FFFFFF',
  text:    '#0B1826',
  text2:   '#374151',
  text3:   '#6B7F99',
  border:  '#D4DEF0',
  success: '#059669',
  danger:  '#DC2626',
  purple:  '#7C3AED',
  orange:  '#D98D04',
};

function BottomNav({ active }) {
  const router = useRouter();
  const unreadCount = useUnreadCount();
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: 'home', lib: 'ion' },
    { id: 'batches', label: 'Batches', icon: 'chalkboard-teacher', lib: 'fa5' },
    { id: 'ai', label: 'AI', icon: 'robot', lib: 'fa5' },
    { id: 'notifications', label: 'Alerts', icon: 'bell', lib: 'fa5' },
    { id: 'performance', label: 'Rank', icon: 'chart-line', lib: 'fa5' },
    { id: 'profile', label: 'Profile', icon: 'person-circle', lib: 'ion' },
  ];
  return (
    <View style={styles.navBar}>
      {tabs.map(tab => {
        const isActive = active === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.navItem}
            onPress={() => router.push(`/${tab.id}`)}
          >
            <View style={[styles.navIconWrap, isActive && styles.navIconWrapActive]}>
              {tab.lib === 'fa5' ? (
                <FontAwesome5 name={tab.icon} size={16} color={isActive ? '#1B1464' : '#6B7F99'} />
              ) : (
                <Ionicons name={tab.icon} size={20} color={isActive ? '#1B1464' : '#6B7F99'} />
              )}
              {tab.id === 'notifications' && unreadCount > 0 && (
                <View style={styles.navBadge}>
                  <Text style={styles.navBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.navText, isActive && styles.navTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

async function callGemini(parts) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  const data = await res.json();
  console.log('Gemini:', JSON.stringify(data).slice(0, 200));
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function ThinkingDots({ text }) {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  useEffect(() => {
    dots.forEach((d, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: -7, duration: 280, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(d, { toValue: 0,  duration: 280, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
          Animated.delay(500),
        ])
      ).start();
    });
  }, []);
  return (
    <View style={styles.aiBubbleWrap}>
      <View style={styles.aiAvatar}><FontAwesome5 name="robot" size={11} color="#fff" /></View>
      <View style={styles.aiBubble}>
        <Text style={styles.aiLabel}>AI Teacher</Text>
        <View style={{ flexDirection: 'row', gap: 5, marginTop: 6, alignItems: 'center' }}>
          {dots.map((d, i) => (
            <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: T.success, transform: [{ translateY: d }] }} />
          ))}
        </View>
        {!!text && <Text style={styles.thinkText}>{text}</Text>}
      </View>
    </View>
  );
}

function FadeIn({ children, delay = 0 }) {
  const anim  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim,  { toValue: 1, duration: 300, delay, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 300, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity: anim, transform: [{ translateY: slide }] }}>{children}</Animated.View>;
}

function RingChart({ val, size = 96, stroke = 8, color = T.gold }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: '#D4DEF040', position: 'absolute' }} />
      <View style={{ width: size - stroke * 2, height: size - stroke * 2, borderRadius: (size - stroke * 2) / 2, position: 'absolute', backgroundColor: T.card }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: 'transparent', borderTopColor: color, borderRightColor: val > 25 ? color : 'transparent', borderBottomColor: val > 50 ? color : 'transparent', borderLeftColor: val > 75 ? color : 'transparent', position: 'absolute', transform: [{ rotate: '-90deg' }] }} />
      <Text style={{ fontSize: 18, fontWeight: '900', color }}>{val}%</Text>
    </View>
  );
}

export default function AIScreen() {
  // ─── Auth & Student data fetch ───
  const [student, setStudent] = useState(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    // Student data fetch karo email se
    const unsub = onSnapshot(collection(db, 'students'), snap => {
      const found = snap.docs.find(d => d.data().studentEmail?.toLowerCase() === user.email?.toLowerCase());
      if (found) setStudent({ id: found.id, ...found.data() });
    });
    return () => unsub();
  }, []);

  const [subTab, setSubTab]       = useState('doubt');
  const [subject, setSubject]     = useState('General');
  const [language, setLanguage]   = useState('hinglish');

  // Doubt
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState('');
  const [dLoading,   setDLoading]   = useState(false);
  const [isTyping,   setIsTyping]   = useState(false);
  const [thinkText,  setThinkText]  = useState('');
  const [imgBase64,  setImgBase64]  = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const [showAttach, setShowAttach] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const scrollRef   = useRef(null);
  const typingRef   = useRef(null);

  // History
  const [doubtHistory,     setDoubtHistory]     = useState([]);
  const [showDoubtHistory, setShowDoubtHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);

  // Quiz
  const [quizState,      setQuizState]      = useState('setup');
  const [quizSubject,    setQuizSubject]    = useState('');
  const [quizCount,      setQuizCount]      = useState(5);
  const [quizDifficulty, setQuizDifficulty] = useState('medium');
  const [quizQs,         setQuizQs]         = useState([]);
  const [quizIdx,        setQuizIdx]        = useState(0);
  const [quizAns,        setQuizAns]        = useState({});
  const [quizExpl,       setQuizExpl]       = useState(false);
  const [quizScore,      setQuizScore]      = useState(0);
  const [quizErr,        setQuizErr]        = useState('');
  const [quizTopic,      setQuizTopic]      = useState('');
  const [quizHistory,    setQuizHistory]    = useState([]);
  const [showQuizHist,   setShowQuizHist]   = useState(false);

  const thinkSteps = ['Samajh raha hoon...', 'Concept analyze kar raha hoon...', 'Solution prepare kar raha hoon...', 'Answer likh raha hoon...'];

  const langLabel = language === 'hindi' ? 'Hindi' : language === 'english' ? 'English' : 'Hinglish';

  const sampleQs = {
    General:     ['Newton ka 3rd Law kya hai?', 'Solve: 2x + 5 = 15', 'Photosynthesis explain karo'],
    Physics:     ['Newton ke 3 laws batao', 'Electromagnetic induction?', 'Refraction kya hai?'],
    Chemistry:   ['pH scale kya hai?', 'Ionic vs covalent bond?', 'Mole concept samjhao'],
    Mathematics: ['2x²-5x+3=0 solve karo', 'Pythagorean theorem?', 'd/dx of x³+2x?'],
    Biology:     ['Photosynthesis process?', 'DNA replication?', 'Osmosis vs diffusion?'],
  };

  // ─── Firebase Listeners ───
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // Doubt history — uid field se
    const dq = query(
      collection(db, 'doubt_history'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc')
    );
    const u1 = onSnapshot(dq, snap => {
      setDoubtHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.log('doubt history err:', err.message));

    // Quiz history — uid field se
    const qq = query(
      collection(db, 'quiz_history'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc')
    );
    const u2 = onSnapshot(qq, snap => {
      setQuizHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.log('quiz history err:', err.message));

    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, isTyping, dLoading]);

  useEffect(() => {
    return () => { if (typingRef.current) clearInterval(typingRef.current); };
  }, []);

  // ─── Image Handlers ───
  async function pickGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { alert('Gallery permission chahiye'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
    if (!result.canceled) { setImgBase64(result.assets[0].base64); setImgPreview(result.assets[0].uri); setShowAttach(false); }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { alert('Camera permission chahiye'); return; }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
    if (!result.canceled) { setImgBase64(result.assets[0].base64); setImgPreview(result.assets[0].uri); setShowAttach(false); }
  }

  function removeImage() { setImgPreview(null); setImgBase64(null); }
  function clearDoubtChat() {
    setMessages([]); setActiveSessionId(null);
    if (typingRef.current) { clearInterval(typingRef.current); typingRef.current = null; }
    setIsTyping(false);
  }

  async function deleteDoubt(id) {
    try { await deleteDoc(doc(db, 'doubt_history', id)); } catch (e) { console.error(e); }
  }

  // ─── Send Message ───
  async function sendMessage() {
    if ((!input.trim() && !imgBase64) || dLoading) return;
    const msgText = input.trim();
    const imgPrev = imgPreview;
    const imgData = imgBase64;
    setInput(''); removeImage();
    setMessages(p => [...p, { role: 'user', text: msgText, image: imgPrev, time: new Date() }]);
    setDLoading(true);

    let ti = 0;
    setThinkText(thinkSteps[0]);
    const thinkInt = setInterval(() => { ti = (ti + 1) % thinkSteps.length; setThinkText(thinkSteps[ti]); }, 2500);

    try {
      const hist = messages.slice(-6).map(m => `${m.role === 'user' ? 'Student' : 'Teacher'}: ${m.text}`).join('\n');
      const prompt = `Tu ek expert Indian teacher hai Patel Institute Dongargaon ka.\nStudent: ${student?.studentName || 'Student'}, Class ${student?.class || '12'}, Board: ${student?.board || 'CG Board'}\nSubject: ${subject}, Language: ${langLabel}\n\nConcise jawab do — simple questions pe 2-4 lines, complex pe step-by-step.\n${hist ? `Previous:\n${hist}\n\n` : ''}Student: ${msgText || 'Is image ko solve karo.'}`;

      const parts = [];
      if (imgData) parts.push({ inlineData: { mimeType: 'image/jpeg', data: imgData } });
      parts.push({ text: prompt });

      const answer = await callGemini(parts);
      clearInterval(thinkInt); setThinkText(''); setDLoading(false);

      // Save to Firebase — uid use karo
      try {
        const uid = auth.currentUser?.uid;
        if (uid && msgText) {
          await addDoc(collection(db, 'doubt_history'), {
            uid,
            studentId: student?.id || uid,
            studentName: student?.studentName || '',
            subject,
            question: msgText,
            answer: answer || '',
            language,
            createdAt: serverTimestamp(),
          });
        }
      } catch (se) { console.error('Save:', se); }

      // Typing animation
      setMessages(p => [...p, { role: 'ai', text: '', time: new Date() }]);
      setIsTyping(true);
      const words = answer.split(/(\s+)/);
      let wi = 0;
      typingRef.current = setInterval(() => {
        wi += 3;
        if (wi >= words.length) {
          clearInterval(typingRef.current); typingRef.current = null;
          setMessages(p => { const u = [...p]; u[u.length - 1] = { ...u[u.length - 1], text: answer }; return u; });
          setIsTyping(false);
        } else {
          setMessages(p => { const u = [...p]; u[u.length - 1] = { ...u[u.length - 1], text: words.slice(0, wi).join('') }; return u; });
        }
      }, 20);
    } catch (e) {
      clearInterval(thinkInt); setThinkText(''); setDLoading(false);
      setMessages(p => [...p, { role: 'ai', text: 'Error aa gaya. Dobara try karo.', time: new Date() }]);
    }
  }

  // ─── Quiz ───
  async function genQuiz() {
    if (!quizSubject) { setQuizErr('Subject select karo!'); return; }
    setQuizErr(''); setQuizState('loading');
    setQuizQs([]); setQuizAns({}); setQuizIdx(0); setQuizExpl(false); setQuizScore(0);
    try {
      const r = await callGemini([{
        text: `Generate ${quizCount} MCQ questions for ${quizSubject}${quizTopic ? `, Topic: ${quizTopic}` : ''}, Class ${student?.class || '12'}, ${quizDifficulty} difficulty, Indian curriculum. Language: ${langLabel}. Return ONLY JSON array: [{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}]`
      }]);
      let t = r.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const si = t.indexOf('['), ei = t.lastIndexOf(']');
      if (si !== -1 && ei !== -1) t = t.substring(si, ei + 1);
      const v = JSON.parse(t).filter(q => q.question && q.options?.length === 4 && typeof q.correct === 'number');
      if (!v.length) throw new Error('No valid questions');
      setQuizQs(v); setQuizState('active');
    } catch (e) {
      console.error('Quiz error:', e);
      setQuizErr('Quiz generate nahi hua. Dobara try karo.'); setQuizState('setup');
    }
  }

  function selAns(qi, oi) {
    if (quizAns[qi] !== undefined) return;
    setQuizAns(p => ({ ...p, [qi]: oi })); setQuizExpl(true);
  }

  function nextQ() {
    setQuizExpl(false);
    if (quizIdx < quizQs.length - 1) { setQuizIdx(quizIdx + 1); }
    else {
      let s = 0;
      quizQs.forEach((q, i) => { if (quizAns[i] === q.correct) s++; });
      setQuizScore(s); setQuizState('results');
      saveQuizHistory(s);
    }
  }

  async function saveQuizHistory(score) {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const total = quizQs.length;
      const pct = Math.round((score / total) * 100);
      await addDoc(collection(db, 'quiz_history'), {
        uid,
        studentId: student?.id || uid,
        studentName: student?.studentName || '',
        subject: quizSubject,
        difficulty: quizDifficulty,
        score, total,
        percentage: pct,
        grade: pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'F',
        language,
        createdAt: serverTimestamp(),
      });
    } catch (e) { console.error('Quiz save:', e); }
  }

  async function deleteQuizEntry(id) {
    try { await deleteDoc(doc(db, 'quiz_history', id)); } catch (e) { console.error(e); }
  }

  function resetQuiz() {
    setQuizState('setup'); setQuizQs([]); setQuizAns({});
    setQuizIdx(0); setQuizExpl(false); setQuizScore(0); setQuizErr('');
  }

  const currentSamples = sampleQs[subject] || sampleQs['General'];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIcon}>
            <FontAwesome5 name="robot" size={16} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Portal</Text>
            <Text style={styles.headerSub}>Gemini Flash · Personalized Tutor</Text>
          </View>
        </View>
        <View style={styles.subTabRow}>
          {[
            { id: 'doubt', label: 'Doubt Solver', icon: 'comments' },
            { id: 'quiz',  label: 'AI Quiz',      icon: 'brain' },
          ].map(t => (
            <TouchableOpacity key={t.id} onPress={() => setSubTab(t.id)} style={[styles.subTab, subTab === t.id && styles.subTabActive]}>
              <FontAwesome5 name={t.icon} size={11} color={subTab === t.id ? T.accent : 'rgba(255,255,255,0.6)'} />
              <Text style={[styles.subTabText, subTab === t.id && styles.subTabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ═══ DOUBT SOLVER ═══ */}
      {subTab === 'doubt' && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={10}>

          {/* Controls */}
          <View style={styles.controlsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              {SUBJECTS.map(s => (
                <TouchableOpacity key={s} onPress={() => setSubject(s)} style={[styles.chip, subject === s && styles.chipActive]}>
                  <Text style={[styles.chipText, subject === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.langActionRow}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {LANGUAGES.map(la => (
                <TouchableOpacity key={la.key} onPress={() => setLanguage(la.key)} style={[styles.langBtn, language === la.key && styles.langBtnActive]}>
                  <Text style={[styles.langText, language === la.key && styles.langTextActive]}>{la.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity onPress={() => setShowDoubtHistory(!showDoubtHistory)} style={styles.histBtn}>
                <FontAwesome5 name="history" size={10} color={T.orange} />
                <Text style={styles.histBtnText}>{doubtHistory.length}</Text>
              </TouchableOpacity>
              {messages.length > 0 && (
                <TouchableOpacity onPress={clearDoubtChat} style={styles.newChatBtn}>
                  <FontAwesome5 name="plus" size={10} color={T.text3} />
                  <Text style={styles.newChatText}>New</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* History Panel */}
          {showDoubtHistory && (
            <FadeIn>
              <View style={styles.historyPanel}>
                <View style={styles.historyPanelHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <FontAwesome5 name="history" size={12} color={T.orange} />
                    <Text style={styles.historyPanelTitle}>History</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowDoubtHistory(false)}>
                    <FontAwesome5 name="times" size={14} color={T.text3} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                  {doubtHistory.length === 0
                    ? <Text style={styles.emptyText}>Koi history nahi hai</Text>
                    : doubtHistory.map(ses => (
                        <View key={ses.id} style={styles.historyItem}>
                          <TouchableOpacity style={{ flex: 1 }} onPress={() => {
                            setSelectedHistory(ses);
                            setShowDoubtHistory(false);
                          }}>
                            <Text style={styles.historyItemQ} numberOfLines={1}>{ses.question || 'Doubt'}</Text>
                            <View style={{ flexDirection: 'row', gap: 6, marginTop: 3 }}>
                              <View style={styles.subjectBadge}>
                                <Text style={styles.subjectBadgeText}>{ses.subject || 'General'}</Text>
                              </View>
                              <Text style={styles.historyItemDate}>
                                {ses.createdAt?.toDate?.()?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) || ''}
                              </Text>
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => deleteDoubt(ses.id)} style={styles.deleteBtn}>
                            <FontAwesome5 name="trash" size={10} color={T.danger} />
                          </TouchableOpacity>
                        </View>
                      ))
                  }
                </ScrollView>
              </View>
            </FadeIn>
          )}

          {/* Messages */}
          <ScrollView ref={scrollRef} style={styles.msgList} contentContainerStyle={{ padding: 16, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            {messages.length === 0 && (
              <FadeIn>
                <View style={styles.emptyState}>
                  <View style={styles.emptyStateIcon}>
                    <FontAwesome5 name="robot" size={22} color="#fff" />
                  </View>
                  <Text style={styles.emptyStateTitle}>Kya doubt hai? Pucho!</Text>
                  <Text style={styles.emptyStateSub}>Text likho, photo attach karo, ya neeche se choose karo</Text>
                  <View style={styles.sampleQsWrap}>
                    {currentSamples.map((q, i) => (
                      <TouchableOpacity key={i} onPress={() => setInput(q)} style={styles.sampleQ}>
                        <Text style={styles.sampleQText}>{q}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </FadeIn>
            )}

            {messages.map((msg, i) => (
              <FadeIn key={i}>
                <View style={{ marginBottom: 14 }}>
                  {msg.role === 'user' ? (
                    <View style={styles.userBubbleWrap}>
                      <View style={styles.userBubble}>
                        {msg.image && <Image source={{ uri: msg.image }} style={styles.msgImage} resizeMode="cover" />}
                        {!!msg.text && <Text style={styles.userText}>{msg.text}</Text>}
                        <Text style={styles.msgTime}>
                          {msg.time?.toLocaleTimeString?.('en-IN', { hour: '2-digit', minute: '2-digit' }) || ''}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.aiBubbleWrap}>
                      <View style={styles.aiAvatar}><FontAwesome5 name="robot" size={11} color="#fff" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.aiLabel}>AI Teacher · {langLabel}</Text>
                        <View style={[styles.aiBubble, isTyping && i === messages.length - 1 && styles.aiBubbleTyping]}>
                          <Text style={styles.aiText}>{msg.text}</Text>
                        </View>
                        <Text style={styles.msgTimeSub}>
                          {msg.time?.toLocaleTimeString?.('en-IN', { hour: '2-digit', minute: '2-digit' }) || ''}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </FadeIn>
            ))}

            {dLoading && <ThinkingDots text={thinkText} />}
          </ScrollView>

          {/* History Detail Modal */}
          {selectedHistory && (
            <View style={styles.histDetailOverlay}>
              <View style={styles.histDetailBox}>
                {/* Header */}
                <View style={styles.histDetailHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.subjectBadge}>
                      <Text style={styles.subjectBadgeText}>{selectedHistory.subject || 'General'}</Text>
                    </View>
                    <Text style={styles.histDetailDate}>
                      {selectedHistory.createdAt?.toDate?.()?.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) || ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedHistory(null)} style={styles.histDetailClose}>
                    <FontAwesome5 name="times" size={14} color={T.text3} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                  {/* Question bubble */}
                  <View style={styles.histDetailUserWrap}>
                    <View style={styles.histDetailUserBubble}>
                      <Text style={styles.histDetailUserText}>{selectedHistory.question}</Text>
                    </View>
                  </View>

                  {/* Answer bubble */}
                  <View style={styles.aiBubbleWrap}>
                    <View style={styles.aiAvatar}>
                      <FontAwesome5 name="robot" size={11} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.aiLabel}>AI Teacher</Text>
                      <View style={styles.aiBubble}>
                        <Text style={styles.aiText}>{selectedHistory.answer}</Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>

                {/* Continue button */}
                <TouchableOpacity
                  style={styles.histDetailContinueBtn}
                  onPress={() => {
                    setInput(selectedHistory.question);
                    setSubject(selectedHistory.subject || 'General');
                    setSelectedHistory(null);
                  }}>
                  <FontAwesome5 name="reply" size={13} color="#fff" />
                  <Text style={styles.histDetailContinueBtnText}>Iske baare mein aur puchho</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Image Preview */}
          {imgPreview && (
            <View style={styles.imgPreviewBar}>
              <Image source={{ uri: imgPreview }} style={styles.imgPreviewThumb} />
              <View style={{ flex: 1 }}>
                <Text style={styles.imgReadyText}>Photo ready</Text>
                <Text style={styles.imgReadySub}>Send karo</Text>
              </View>
              <TouchableOpacity onPress={removeImage}>
                <FontAwesome5 name="times" size={16} color={T.danger} />
              </TouchableOpacity>
            </View>
          )}

          {/* Attach Menu */}
          {showAttach && (
            <Pressable style={styles.attachOverlay} onPress={() => setShowAttach(false)}>
              <FadeIn>
                <View style={styles.attachMenu}>
                  <TouchableOpacity style={styles.attachItem} onPress={takePhoto}>
                    <View style={[styles.attachIconBox, { backgroundColor: '#ECFDF5' }]}>
                      <FontAwesome5 name="camera" size={15} color={T.success} />
                    </View>
                    <Text style={styles.attachItemText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.attachItem} onPress={pickGallery}>
                    <View style={[styles.attachIconBox, { backgroundColor: '#EFF6FF' }]}>
                      <FontAwesome5 name="image" size={15} color={T.accent} />
                    </View>
                    <Text style={styles.attachItemText}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              </FadeIn>
            </Pressable>
          )}

          {/* Input Bar */}
          <View style={styles.inputBar}>
            <View style={styles.inputInner}>
              <TouchableOpacity onPress={() => setShowAttach(!showAttach)} style={styles.attachTrigger}>
                <FontAwesome5 name="paperclip" size={16} color={T.text3} />
              </TouchableOpacity>
              <TextInput
                style={styles.textInput}
                placeholder="Apna doubt yahan likho..."
                placeholderTextColor={T.text3}
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={2000}
              />
              <TouchableOpacity
                onPress={sendMessage}
                disabled={dLoading || (!input.trim() && !imgBase64)}
                style={[styles.sendBtn, (dLoading || (!input.trim() && !imgBase64)) && styles.sendBtnDisabled]}>
                <FontAwesome5 name="arrow-up" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

        </KeyboardAvoidingView>
      )}

      {/* ═══ QUIZ ═══ */}
      {subTab === 'quiz' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

          {quizState === 'setup' && (
            <>
              <View style={styles.quizHeader}>
                <View>
                  <Text style={styles.quizHeaderTitle}>AI Quiz Generator</Text>
                  <Text style={styles.quizHeaderSub}>Gemini AI se MCQs generate karo</Text>
                </View>
                <TouchableOpacity onPress={() => setShowQuizHist(!showQuizHist)} style={styles.histBtn}>
                  <FontAwesome5 name="history" size={10} color={T.orange} />
                  <Text style={styles.histBtnText}>History ({quizHistory.length})</Text>
                </TouchableOpacity>
              </View>

              {showQuizHist && (
                <FadeIn>
                  <View style={[styles.historyPanel, { marginBottom: 14 }]}>
                    <View style={styles.historyPanelHeader}>
                      <Text style={[styles.historyPanelTitle, { color: T.purple }]}>Past Quizzes</Text>
                      <TouchableOpacity onPress={() => setShowQuizHist(false)}>
                        <FontAwesome5 name="times" size={14} color={T.text3} />
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
                      {quizHistory.length === 0
                        ? <Text style={styles.emptyText}>Koi quiz history nahi hai.</Text>
                        : quizHistory.map(qh => {
                            const gc = qh.percentage >= 80 ? T.success : qh.percentage >= 60 ? T.orange : T.danger;
                            return (
                              <View key={qh.id} style={styles.quizHistItem}>
                                <View style={[styles.quizHistRing, { borderColor: gc }]}>
                                  <Text style={[styles.quizHistPct, { color: gc }]}>{qh.percentage}%</Text>
                                  <Text style={[styles.quizHistGrade, { color: gc }]}>{qh.grade}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.quizHistSubject}>{qh.subject}</Text>
                                  <Text style={styles.quizHistMeta}>
                                    {qh.score}/{qh.total} · {qh.difficulty} · {qh.createdAt?.toDate?.()?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) || ''}
                                  </Text>
                                </View>
                                <TouchableOpacity onPress={() => deleteQuizEntry(qh.id)} style={styles.deleteBtn}>
                                  <FontAwesome5 name="trash" size={11} color={T.danger} />
                                </TouchableOpacity>
                              </View>
                            );
                          })
                      }
                    </ScrollView>
                  </View>
                </FadeIn>
              )}

              <View style={styles.quizSetupCard}>
                <Text style={styles.formLabel}>Language</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  {[{ v: 'hinglish', l: 'Hinglish' }, { v: 'hindi', l: 'हिंदी' }, { v: 'english', l: 'English' }].map(la => (
                    <TouchableOpacity key={la.v} onPress={() => setLanguage(la.v)} style={[styles.langCard, language === la.v && styles.langCardActive]}>
                      <Text style={[styles.langCardText, language === la.v && { color: T.purple }]}>{la.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.formLabel}>Subject *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {['Physics', 'Chemistry', 'Mathematics', 'Biology'].map(s => (
                    <TouchableOpacity key={s} onPress={() => setQuizSubject(s)} style={[styles.chip, quizSubject === s && styles.chipActivePurple]}>
                      <Text style={[styles.chipText, quizSubject === s && { color: '#fff' }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.formLabel}>Topic / Chapter (Optional)</Text>
                <TextInput
                  style={styles.topicInput}
                  placeholder="e.g. Newton Laws, Gravitation, Trigonometry..."
                  placeholderTextColor={T.text3}
                  value={quizTopic}
                  onChangeText={setQuizTopic}
                />

                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Questions</Text>
                    <View style={styles.selectRow}>
                      {[5, 10, 15].map(n => (
                        <TouchableOpacity key={n} onPress={() => setQuizCount(n)} style={[styles.countBtn, quizCount === n && styles.countBtnActive]}>
                          <Text style={[styles.countBtnText, quizCount === n && { color: '#fff' }]}>{n}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Level</Text>
                    <View style={styles.selectRow}>
                      {[{ d: 'easy', l: 'Easy' }, { d: 'medium', l: 'Med' }, { d: 'hard', l: 'Hard' }].map(({ d, l }) => (
                        <TouchableOpacity key={d} onPress={() => setQuizDifficulty(d)} style={[styles.countBtn, quizDifficulty === d && styles.countBtnActive]}>
                          <Text style={[styles.countBtnText, quizDifficulty === d && { color: '#fff' }]}>{l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {!!quizErr && <Text style={styles.errText}>{quizErr}</Text>}

                <TouchableOpacity onPress={genQuiz} style={styles.generateBtn}>
                  <FontAwesome5 name="magic" size={14} color="#fff" />
                  <Text style={styles.generateBtnText}>Generate Quiz</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {quizState === 'loading' && (
            <View style={styles.quizLoading}>
              <FontAwesome5 name="brain" size={40} color={T.purple} />
              <Text style={styles.quizLoadingText}>Generating Questions...</Text>
              <Text style={styles.quizLoadingSub}>Gemini AI kaam kar raha hai...</Text>
            </View>
          )}

          {quizState === 'active' && quizQs[quizIdx] && (() => {
            const q = quizQs[quizIdx];
            const sel = quizAns[quizIdx];
            const pct = ((quizIdx + (sel !== undefined ? 1 : 0)) / quizQs.length) * 100;
            return (
              <>
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={styles.qCounter}>Q{quizIdx + 1}/{quizQs.length}</Text>
                    <View style={styles.subjectPill}><Text style={styles.subjectPillText}>{quizSubject}</Text></View>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: T.purple }]} />
                  </View>
                </View>

                <FadeIn key={quizIdx}>
                  <View style={styles.questionCard}>
                    <Text style={styles.questionText}>{q.question}</Text>
                    <View style={{ gap: 10, marginTop: 4 }}>
                      {q.options.map((o, oi) => {
                        const isSel = sel === oi;
                        const isCorr = q.correct === oi;
                        const label = ['A', 'B', 'C', 'D'][oi];
                        let cardStyle = styles.optionDefault;
                        let labelStyle = styles.optionLabelDefault;
                        let textColor = T.text;
                        if (sel !== undefined) {
                          if (isCorr) { cardStyle = styles.optionCorrect; labelStyle = styles.optionLabelCorrect; textColor = T.success; }
                          else if (isSel) { cardStyle = styles.optionWrong; labelStyle = styles.optionLabelWrong; textColor = T.danger; }
                        } else if (isSel) { cardStyle = styles.optionSelected; labelStyle = styles.optionLabelSelected; textColor = T.accent; }
                        return (
                          <TouchableOpacity key={oi} onPress={() => selAns(quizIdx, oi)} disabled={sel !== undefined} style={cardStyle}>
                            <View style={labelStyle}>
                              <Text style={[styles.optionLabelText, { color: textColor }]}>
                                {sel !== undefined && isCorr ? '✓' : sel !== undefined && isSel ? '✗' : label}
                              </Text>
                            </View>
                            <Text style={[styles.optionText, { color: textColor }]}>{o}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {quizExpl && q.explanation && (
                      <FadeIn>
                        <View style={[styles.explanationBox, { backgroundColor: sel === q.correct ? '#F0FDF4' : '#FEF2F2', borderColor: sel === q.correct ? '#86EFAC' : '#FCA5A5' }]}>
                          <Text style={{ color: sel === q.correct ? T.success : T.danger, fontWeight: '800', marginBottom: 4 }}>
                            {sel === q.correct ? 'Correct!' : `Wrong → ${['A','B','C','D'][q.correct]}`}
                          </Text>
                          <Text style={{ color: T.text2, fontSize: 13, lineHeight: 20 }}>{q.explanation}</Text>
                        </View>
                      </FadeIn>
                    )}

                    {sel !== undefined && (
                      <TouchableOpacity onPress={nextQ} style={styles.nextBtn}>
                        <Text style={styles.nextBtnText}>{quizIdx < quizQs.length - 1 ? 'Next Question →' : 'View Results'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </FadeIn>
              </>
            );
          })()}

          {quizState === 'results' && (() => {
            const pct = Math.round((quizScore / quizQs.length) * 100);
            const gc = pct >= 80 ? T.success : pct >= 60 ? T.orange : T.danger;
            return (
              <>
                <FadeIn>
                  <View style={styles.resultCard}>
                    <Text style={styles.resultTitle}>Quiz Complete!</Text>
                    <View style={{ marginVertical: 16 }}>
                      <RingChart val={pct} size={110} stroke={9} color={gc} />
                    </View>
                    <Text style={[styles.resultScore, { color: gc }]}>{quizScore}/{quizQs.length}</Text>
                    <Text style={styles.resultPct}>{pct}%</Text>
                    <TouchableOpacity onPress={resetQuiz} style={[styles.generateBtn, { marginTop: 16 }]}>
                      <FontAwesome5 name="redo" size={13} color="#fff" />
                      <Text style={styles.generateBtnText}>Play Again</Text>
                    </TouchableOpacity>
                  </View>
                </FadeIn>

                <Text style={styles.reviewTitle}>Review Answers</Text>
                {quizQs.map((q, i) => {
                  const ir = quizAns[i] === q.correct;
                  return (
                    <View key={i} style={[styles.reviewCard, { borderLeftColor: ir ? T.success : T.danger }]}>
                      <Text style={styles.reviewQ}>Q{i + 1}. {q.question}</Text>
                      <Text style={[styles.reviewAns, { color: T.success }]}>✓ {['A','B','C','D'][q.correct]}. {q.options[q.correct]}</Text>
                      {!ir && <Text style={[styles.reviewAns, { color: T.danger }]}>✗ {['A','B','C','D'][quizAns[i]]}. {q.options[quizAns[i]]}</Text>}
                      {q.explanation && <Text style={styles.reviewExpl}>{q.explanation}</Text>}
                    </View>
                  );
                })}
              </>
            );
          })()}

        </ScrollView>
      )}

      <BottomNav active="ai" />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.navy, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  headerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(212,168,67,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#E8EDF5' },
  headerSub: { fontSize: 11, color: '#6B7F99', marginTop: 1 },
  subTabRow: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 4 },
  subTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10 },
  subTabActive: { backgroundColor: '#fff' },
  subTabText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  subTabTextActive: { color: T.accent },
  controlsRow: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#E0E8F4', marginRight: 8, borderWidth: 1.5, borderColor: '#E0E8F4' },
  chipActive: { backgroundColor: T.accent, borderColor: T.accent },
  chipActivePurple: { backgroundColor: T.purple, borderColor: T.purple },
  chipText: { fontSize: 12, fontWeight: '700', color: T.text3 },
  chipTextActive: { color: '#fff' },
  langActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  langBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: '#E0E8F4', borderWidth: 1.5, borderColor: '#E0E8F4' },
  langBtnActive: { backgroundColor: '#ECFDF5', borderColor: T.success },
  langText: { fontSize: 11, fontWeight: '700', color: T.text3 },
  langTextActive: { color: T.success },
  histBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  histBtnText: { fontSize: 10, fontWeight: '700', color: T.orange },
  newChatBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: T.card, borderWidth: 1, borderColor: T.border },
  newChatText: { fontSize: 10, fontWeight: '700', color: T.text3 },
  historyPanel: { marginHorizontal: 12, marginBottom: 8, backgroundColor: '#FFFDF7', borderRadius: 14, borderWidth: 1.5, borderColor: '#FDE68A', padding: 12 },
  historyPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  historyPanelTitle: { fontSize: 13, fontWeight: '700', color: T.orange },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.card, borderRadius: 10, borderWidth: 1, borderColor: T.border, padding: 10, marginBottom: 6 },
  historyItemQ: { fontSize: 12, fontWeight: '700', color: T.text },
  historyItemDate: { fontSize: 10, color: T.text3 },
  subjectBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: '#ECFDF5' },
  subjectBadgeText: { fontSize: 9, fontWeight: '800', color: T.success },
  deleteBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5' },
  emptyText: { fontSize: 13, color: T.text3, textAlign: 'center', padding: 16 },
  msgList: { flex: 1 },
  emptyState: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 16 },
  emptyStateIcon: { width: 52, height: 52, borderRadius: 14, marginBottom: 14, backgroundColor: T.success, alignItems: 'center', justifyContent: 'center' },
  emptyStateTitle: { fontSize: 17, fontWeight: '800', color: T.text, marginBottom: 6 },
  emptyStateSub: { fontSize: 13, color: T.text3, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  sampleQsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  sampleQ: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: T.card, borderWidth: 1, borderColor: T.border },
  sampleQText: { fontSize: 12, color: T.text2, fontWeight: '600' },
  userBubbleWrap: { alignItems: 'flex-end' },
  userBubble: { maxWidth: '80%', backgroundColor: T.accent, borderRadius: 18, borderBottomRightRadius: 4, padding: 12 },
  msgImage: { width: 160, height: 160, borderRadius: 10, marginBottom: 8 },
  userText: { fontSize: 14, lineHeight: 22, color: '#fff' },
  msgTime: { fontSize: 9, color: 'rgba(255,255,255,0.5)', textAlign: 'right', marginTop: 4 },
  aiBubbleWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  aiAvatar: { width: 28, height: 28, borderRadius: 8, marginTop: 16, backgroundColor: T.success, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  aiLabel: { fontSize: 10, fontWeight: '700', color: T.success, marginBottom: 3 },
  aiBubble: { backgroundColor: '#fff', borderRadius: 4, borderTopRightRadius: 18, borderBottomRightRadius: 18, borderBottomLeftRadius: 18, padding: 12, borderWidth: 1, borderColor: T.border },
  aiBubbleTyping: { borderColor: T.success },
  aiText: { fontSize: 14, lineHeight: 22, color: T.text },
  msgTimeSub: { fontSize: 9, color: T.text3, marginTop: 3 },
  thinkText: { fontSize: 12, color: T.success, fontWeight: '500', marginTop: 4 },
  imgPreviewBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: T.card, borderTopWidth: 1, borderTopColor: T.border },
  imgPreviewThumb: { width: 44, height: 44, borderRadius: 8, borderWidth: 1.5, borderColor: T.border },
  imgReadyText: { fontSize: 13, fontWeight: '700', color: T.text },
  imgReadySub: { fontSize: 11, color: T.text3 },
  attachOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  attachMenu: { margin: 12, marginBottom: 80, backgroundColor: T.card, borderRadius: 16, padding: 8, elevation: 8, borderWidth: 1, borderColor: T.border, alignSelf: 'flex-start' },
  attachItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10 },
  attachIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  attachItemText: { fontSize: 14, fontWeight: '600', color: T.text },
  inputBar: { paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E8EFF8' },
  inputInner: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, backgroundColor: '#fff', borderWidth: 1.5, borderColor: T.border, borderRadius: 18, paddingHorizontal: 4, paddingVertical: 4 },
  attachTrigger: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  textInput: { flex: 1, fontSize: 14, color: T.text, paddingHorizontal: 4, paddingVertical: 8, maxHeight: 120, lineHeight: 20 },
  sendBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: T.success, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtnDisabled: { backgroundColor: T.border },
  quizHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  quizHeaderTitle: { fontSize: 17, fontWeight: '800', color: T.text },
  quizHeaderSub: { fontSize: 11, color: T.text3, marginTop: 1 },
  quizSetupCard: { backgroundColor: T.card, borderRadius: 18, padding: 20, borderWidth: 2, borderColor: T.purple },
  formLabel: { fontSize: 11, fontWeight: '700', color: T.text3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  langCard: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 2, borderColor: T.border, backgroundColor: T.card },
  langCardActive: { borderColor: T.purple, backgroundColor: '#FAF5FF' },
  langCardText: { fontSize: 11, fontWeight: '700', color: T.text3, marginTop: 3 },
  selectRow: { flexDirection: 'row', gap: 6 },
  countBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg },
  countBtnActive: { backgroundColor: T.purple, borderColor: T.purple },
  countBtnText: { fontSize: 12, fontWeight: '700', color: T.text3 },
  errText: { fontSize: 13, color: T.danger, fontWeight: '600', marginBottom: 10 },
  topicInput: { backgroundColor: T.bg, borderRadius: 12, padding: 12, fontSize: 14, color: T.text, borderWidth: 1.5, borderColor: T.border, marginBottom: 16 },
  histDetailOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 100 },
  histDetailBox: { backgroundColor: T.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, maxHeight: '85%' },
  histDetailHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  histDetailDate: { fontSize: 11, color: T.text3, marginTop: 4 },
  histDetailClose: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },
  histDetailUserWrap: { alignItems: 'flex-end', marginBottom: 14 },
  histDetailUserBubble: { maxWidth: '80%', backgroundColor: T.accent, borderRadius: 18, borderBottomRightRadius: 4, padding: 12 },
  histDetailUserText: { fontSize: 14, lineHeight: 22, color: '#fff', fontWeight: '600' },
  histDetailContinueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.success, borderRadius: 14, padding: 14, marginTop: 16 },
  histDetailContinueBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.purple, borderRadius: 14, padding: 15 },
  generateBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  quizLoading: { alignItems: 'center', paddingTop: 60, gap: 12 },
  quizLoadingText: { fontSize: 17, fontWeight: '700', color: T.text },
  quizLoadingSub: { fontSize: 13, color: T.text3 },
  qCounter: { fontSize: 14, fontWeight: '700', color: T.text },
  subjectPill: { backgroundColor: '#FAF5FF', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 20 },
  subjectPillText: { fontSize: 11, fontWeight: '700', color: T.purple },
  progressBar: { height: 5, backgroundColor: '#E9D5FF', borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99 },
  questionCard: { backgroundColor: T.card, borderRadius: 20, padding: 20, borderWidth: 2, borderColor: '#E9D5FF' },
  questionText: { fontSize: 15, fontWeight: '700', lineHeight: 24, color: T.text, marginBottom: 16 },
  optionDefault: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 2, borderColor: T.border, backgroundColor: T.card },
  optionSelected: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 2, borderColor: T.accent, backgroundColor: '#EFF6FF' },
  optionCorrect: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 2, borderColor: T.success, backgroundColor: '#F0FDF4' },
  optionWrong: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 2, borderColor: T.danger, backgroundColor: '#FEF2F2' },
  optionLabelDefault: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8EFF8' },
  optionLabelSelected: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: T.accent },
  optionLabelCorrect: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: T.success },
  optionLabelWrong: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: T.danger },
  optionLabelText: { fontSize: 12, fontWeight: '800' },
  optionText: { fontSize: 14, fontWeight: '600', flex: 1 },
  explanationBox: { borderRadius: 14, padding: 14, marginTop: 14, borderWidth: 1 },
  nextBtn: { backgroundColor: T.purple, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 18 },
  nextBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  resultCard: { backgroundColor: T.card, borderRadius: 22, padding: 28, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: T.border },
  resultTitle: { fontSize: 20, fontWeight: '800', color: T.text, marginBottom: 4 },
  resultScore: { fontSize: 24, fontWeight: '900' },
  resultPct: { fontSize: 13, color: T.text3, fontWeight: '700', marginTop: 2 },
  reviewTitle: { fontSize: 15, fontWeight: '700', color: T.text, marginBottom: 12 },
  reviewCard: { backgroundColor: T.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.border, borderLeftWidth: 4 },
  reviewQ: { fontSize: 13, fontWeight: '700', color: T.text, marginBottom: 6 },
  reviewAns: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  reviewExpl: { fontSize: 11, color: T.text3, marginTop: 4, lineHeight: 17 },
  quizHistItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.card, borderRadius: 10, borderWidth: 1, borderColor: T.border, padding: 10, marginBottom: 6 },
  quizHistRing: { width: 48, height: 48, borderRadius: 10, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  quizHistPct: { fontSize: 13, fontWeight: '900', lineHeight: 16 },
  quizHistGrade: { fontSize: 9, fontWeight: '700' },
  quizHistSubject: { fontSize: 13, fontWeight: '700', color: T.text },
  quizHistMeta: { fontSize: 11, color: T.text3, marginTop: 2 },
  navBar: { backgroundColor: '#fff', flexDirection: 'row', paddingTop: 10, paddingBottom: 45, borderTopWidth: 1, borderTopColor: '#E8EFF8', elevation: 8 },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  navIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navIconWrapActive: { backgroundColor: '#EFF6FF' },
  navItemActive: {},
  navText: { fontSize: 10, color: T.text3, marginTop: 2 },
  navTextActive: { color: T.gold },
  navBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#DC2626', borderRadius: 10, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  navBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
});