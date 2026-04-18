import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebase';
import { useUnreadCount } from '../hooks/useUnreadCount';

// ─── Bottom Nav ───
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
          <TouchableOpacity key={tab.id} style={styles.navTab} onPress={() => router.push('/' + tab.id)}>
            <View style={[styles.navIconWrap, isActive && styles.navIconWrapActive]}>
              {tab.lib === 'ion'
                ? <Ionicons name={tab.icon} size={20} color={isActive ? '#1B1464' : '#6B7F99'} />
                : <FontAwesome5 name={tab.icon} size={16} color={isActive ? '#1B1464' : '#6B7F99'} />
              }
              {tab.id === 'notifications' && unreadCount > 0 && (
                <View style={styles.navBadge}>
                  <Text style={styles.navBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function Tests() {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completedTests, setCompletedTests] = useState([]);
  const [activeTest, setActiveTest] = useState(null);
  const [testPhase, setTestPhase] = useState('idle');
  const [testAnswers, setTestAnswers] = useState({});
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [testTimeLeft, setTestTimeLeft] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('pid_done_tests').then(val => {
      if (val) setCompletedTests(JSON.parse(val));
    });

    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { router.replace('/'); return; }
      onSnapshot(collection(db, 'students'), s => {
        const found = s.docs.find(d => d.data().studentEmail?.toLowerCase() === user.email.toLowerCase());
        if (!found) { setLoading(false); return; }
        if (found) {
          const st = { id: found.id, ...found.data() };
          setStudent(st);
          onSnapshot(collection(db, 'online_tests'), ts => {
            const all = ts.docs.map(d => ({ id: d.id, ...d.data() }));
            const today = new Date().toISOString().split('T')[0];
            const sc = (st.class || '').trim();
            const sm = (st.medium || '').trim();
            const sb = st.board === 'CG Board' ? 'CG' : (st.board || '').trim();
            const classOk = (fc) => {
              if (!fc || fc === 'all') return true;
              const fcTrim = fc.trim();
              // Direct class match
              if (fcTrim === sc) return true;
              const p = fcTrim.split('-');
              // Class match check
              if (p[0] !== sc) return false;
              // Agar sirf class hai (e.g. "12th") toh match
              if (p.length === 1) return true;
              // Medium check
              if (p[1] && sm) {
                const medOk =
                  (p[1] === 'Eng' && sm === 'English') ||
                  (p[1] === 'English' && sm === 'English') ||
                  ((p[1] === 'Hin' || p[1] === 'Hindi') && sm === 'Hindi');
                if (!medOk) return false;
              }
              // Board check
              const bp = p.slice(2);
              if (bp.length > 0 && sb) {
                const bOk = bp.some(x =>
                  x === sb ||
                  x === 'All' ||
                  x === 'all' ||
                  (x === 'CG' && sb === 'CG') ||
                  (x === 'CBSE' && sb === 'CBSE') ||
                  (x === 'ICSE' && sb === 'ICSE')
                );
                if (!bOk) return false;
              }
              return true;
            };
 const now = new Date();
const filtered = all.filter(t => {
  // Class filter
  if (!classOk(t.forClass)) return false;

  // Schedule time check — dono hain toh start time aana chahiye
  if (t.scheduledDate && t.scheduledTime) {
    const startTime = new Date(`${t.scheduledDate}T${t.scheduledTime}:00`);
    return now >= startTime; // ← sirf start check, koi end nahi
  }

  // Sirf date hai
  if (t.scheduledDate) return t.scheduledDate <= today;

  // Kuch nahi → isActive dekho
  return t.isActive;
});
            // logs removed
            // logs removed
            filtered.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
            setTests(filtered);
            setLoading(false);
          });
        }
      });
    });
    return () => { unsub(); if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startTest(t) {
    if (!t.questions || t.questions.length === 0) {
      Alert.alert('Error', 'Is test mein questions nahi hain.');
      return;
    }
    setActiveTest(t);
    setTestAnswers({});
    setCurrentQIdx(0);
    const secs = (t.duration || 30) * 60;
    setTestTimeLeft(secs);
    setTestPhase('running');
    timerRef.current = setInterval(() => {
      setTestTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); setTestPhase('result'); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  async function submitTest() {
    clearInterval(timerRef.current);
    setTestPhase('result');

    // Result Firebase mein save karo
    try {
      if (student?.id && activeTest?.id) {
        const qs = activeTest.questions || [];
        let correct = 0;
        qs.forEach((q, i) => { if (testAnswers[i] === q.correctAnswer) correct++; });
        const total = qs.length;
        const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

        const { addDoc, collection: col, serverTimestamp: st } = await import('firebase/firestore');

        // quiz_history mein save karo (performance section ke liye)
        await addDoc(col(db, 'quiz_history'), {
          uid: auth.currentUser?.uid,
          studentId: student.id,
          studentName: student.studentName || '',
          studentClass: student.class || student.presentClass || '',
          studentBoard: student.board || '',
          studentMedium: student.medium || '',
          examId: activeTest.id,
          examTitle: activeTest.title || '',
          testId: activeTest.id,
          title: activeTest.title || '',
          subject: activeTest.subject || '',
          score: correct,
          correctAnswers: correct,
          total: total,
          totalQuestions: total,
          percentage: pct,
          grade: pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'F',
          answers: testAnswers,
          createdAt: st(),
        });

        // online_test_results mein bhi save karo (admin panel ke liye)
        await addDoc(col(db, 'online_test_results'), {
          testId: activeTest.id,
          testTitle: activeTest.title || '',
          studentId: student.id,
          studentName: student.studentName || '',
          studentClass: student.class || student.presentClass || '',
          correctAnswers: correct,
          totalQuestions: total,
          percentage: pct,
          answers: testAnswers,
          submittedAt: st(),
        });

        console.log('Result saved!', correct, '/', total);
      }
    } catch (e) {
      console.error('Result save error:', e);
    }
  }

  async function goBack() {
    if (activeTest?.id) {
      const newDone = [...new Set([...completedTests, activeTest.id])];
      setCompletedTests(newDone);
      await AsyncStorage.setItem('pid_done_tests', JSON.stringify(newDone));
    }
    setTestPhase('idle');
    setActiveTest(null);
    setTestAnswers({});
    setCurrentQIdx(0);
    setTestTimeLeft(0);
  }

  const mins = Math.floor(testTimeLeft / 60);
  const secs = testTimeLeft % 60;
  const timeLow = testTimeLeft < 60;

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#1B1464" />
      </View>
    );
  }

  // ═══ RESULT SCREEN ═══
  if (testPhase === 'result' && activeTest) {
    const qs = activeTest.questions || [];
    let correct = 0;
    qs.forEach((q, i) => { if (testAnswers[i] === q.correctAnswer) correct++; });
    const pct = qs.length > 0 ? Math.round((correct / qs.length) * 100) : 0;
    const grade = pct >= 90 ? 'A+' : pct >= 75 ? 'A' : pct >= 60 ? 'B' : pct >= 40 ? 'C' : 'D';
    const gc = pct >= 75 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626';
    const gcBg = pct >= 75 ? '#ECFDF5' : pct >= 50 ? '#FFF7ED' : '#FEF2F2';

    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <FontAwesome5 name="trophy" size={18} color="#C9A44E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Test Result</Text>
              <Text style={styles.headerSub}>{activeTest.title}</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

            {/* Score Card */}
            <View style={[styles.scoreCard, { borderColor: gc }]}>
              <View style={[styles.gradeCircle, { backgroundColor: gcBg, borderColor: gc }]}>
                <Text style={[styles.gradeText, { color: gc }]}>{grade}</Text>
              </View>
              <Text style={[styles.scorePct, { color: gc }]}>{pct}%</Text>
              <Text style={styles.scoreSubText}>{correct}/{qs.length} correct answers</Text>

              <View style={styles.scoreStatsRow}>
                {[
                  { label: 'Correct', val: correct, color: '#059669', bg: '#ECFDF5', icon: 'check-circle' },
                  { label: 'Wrong', val: qs.length - correct, color: '#DC2626', bg: '#FEF2F2', icon: 'times-circle' },
                  { label: 'Total', val: qs.length, color: '#1B1464', bg: '#EFF6FF', icon: 'list' },
                ].map((s, i) => (
                  <View key={i} style={[styles.scoreStat, { backgroundColor: s.bg }]}>
                    <FontAwesome5 name={s.icon} size={16} color={s.color} />
                    <Text style={[styles.scoreStatVal, { color: s.color }]}>{s.val}</Text>
                    <Text style={styles.scoreStatLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>

              {/* Progress bar */}
              <View style={styles.resultProgressBg}>
                <View style={[styles.resultProgressFill, { width: `${pct}%`, backgroundColor: gc }]} />
              </View>
            </View>

            {/* Review */}
            <Text style={styles.sectionLabel}>Answer Review</Text>
            {qs.map((q, i) => {
              const ua = testAnswers[i];
              const isC = ua === q.correctAnswer;
              return (
                <View key={i} style={[styles.reviewCard, { borderLeftColor: isC ? '#059669' : '#DC2626' }]}>
                  <View style={styles.reviewHeader}>
                    <View style={[styles.reviewNum, { backgroundColor: isC ? '#ECFDF5' : '#FEF2F2' }]}>
                      <FontAwesome5 name={isC ? 'check' : 'times'} size={11} color={isC ? '#059669' : '#DC2626'} />
                    </View>
                    <Text style={styles.reviewQ}>Q{i + 1}: {q.question}</Text>
                  </View>
                  <View style={styles.reviewAns}>
                    <FontAwesome5 name="check-circle" size={11} color="#059669" />
                    <Text style={[styles.reviewAnsText, { color: '#059669' }]}>{q.options?.[q.correctAnswer]}</Text>
                  </View>
                  {ua !== undefined && !isC && (
                    <View style={styles.reviewAns}>
                      <FontAwesome5 name="times-circle" size={11} color="#DC2626" />
                      <Text style={[styles.reviewAnsText, { color: '#DC2626' }]}>Your: {q.options?.[ua]}</Text>
                    </View>
                  )}
                  {q.explanation && (
                    <View style={styles.explanationBox}>
                      <FontAwesome5 name="lightbulb" size={11} color="#D97706" />
                      <Text style={styles.explanationText}>{q.explanation}</Text>
                    </View>
                  )}
                </View>
              );
            })}

            <TouchableOpacity style={styles.backBtn} onPress={goBack}>
              <FontAwesome5 name="arrow-left" size={14} color="#fff" />
              <Text style={styles.backBtnText}>Back to Tests</Text>
            </TouchableOpacity>

          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  // ═══ RUNNING SCREEN ═══
  if (testPhase === 'running' && activeTest) {
    const qs = activeTest.questions || [];
    const q = qs[currentQIdx];
    const answeredCount = Object.keys(testAnswers).length;
    const progress = (currentQIdx / qs.length) * 100;

    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.container}>

          {/* Timer Bar */}
          <View style={styles.timerBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.testTitleSmall} numberOfLines={1}>{activeTest.title}</Text>
              <Text style={styles.answeredText}>{answeredCount}/{qs.length} answered</Text>
            </View>
            <View style={[styles.timerBox, { backgroundColor: timeLow ? '#DC2626' : 'rgba(255,255,255,0.15)' }]}>
              <FontAwesome5 name="clock" size={12} color="#fff" />
              <Text style={styles.timerText}>
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.submitBtnSmall}
              onPress={() => Alert.alert('Submit', 'Test submit karo?', [
                { text: 'Cancel' },
                { text: 'Submit', style: 'destructive', onPress: submitTest }
              ])}>
              <Text style={styles.submitBtnSmallText}>Submit</Text>
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View style={styles.testProgressBg}>
            <View style={[styles.testProgressFill, { width: `${progress}%` }]} />
          </View>

          {/* Question Dots */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dotsScroll} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}>
            {qs.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setCurrentQIdx(i)}
                style={[styles.dot, {
                  backgroundColor: i === currentQIdx ? '#1B1464' : testAnswers[i] !== undefined ? '#ECFDF5' : '#F0F4FA',
                  borderColor: i === currentQIdx ? '#1B1464' : testAnswers[i] !== undefined ? '#059669' : '#D4DEF0',
                }]}>
                <Text style={[styles.dotText, {
                  color: i === currentQIdx ? '#fff' : testAnswers[i] !== undefined ? '#059669' : '#6B7F99'
                }]}>{i + 1}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Question */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            <View style={styles.questionCard}>
              <View style={styles.qHeader}>
                <View style={styles.qNum}>
                  <Text style={styles.qNumText}>{currentQIdx + 1}</Text>
                </View>
                <Text style={styles.qOf}>of {qs.length}</Text>
                {activeTest.subject && (
                  <View style={styles.subjectPill}>
                    <Text style={styles.subjectPillText}>{activeTest.subject}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.questionText}>{q?.question}</Text>

              <View style={{ gap: 10 }}>
                {(q?.options || []).map((opt, oi) => {
                  const sel = testAnswers[currentQIdx] === oi;
                  return (
                    <TouchableOpacity
                      key={oi}
                      onPress={() => setTestAnswers(prev => ({ ...prev, [currentQIdx]: oi }))}
                      style={[styles.option, sel && styles.optionSelected]}>
                      <View style={[styles.optLabel, sel && styles.optLabelSelected]}>
                        <Text style={[styles.optLabelText, { color: sel ? '#fff' : '#6B7F99' }]}>
                          {['A', 'B', 'C', 'D'][oi]}
                        </Text>
                      </View>
                      <Text style={[styles.optText, { color: sel ? '#1B1464' : '#0B1826', fontWeight: sel ? '700' : '500' }]}>
                        {opt}
                      </Text>
                      {sel && <FontAwesome5 name="check-circle" size={16} color="#1B1464" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Nav Buttons */}
            <View style={styles.qNavRow}>
              <TouchableOpacity
                onPress={() => { if (currentQIdx > 0) setCurrentQIdx(i => i - 1); }}
                style={[styles.qNavBtn, { opacity: currentQIdx === 0 ? 0.4 : 1 }]}>
                <FontAwesome5 name="arrow-left" size={14} color="#1B1464" />
                <Text style={styles.qNavBtnText}>Prev</Text>
              </TouchableOpacity>

              {currentQIdx < qs.length - 1
                ? <TouchableOpacity
                    onPress={() => setCurrentQIdx(i => i + 1)}
                    style={[styles.qNavBtn, styles.qNavBtnPrimary]}>
                    <Text style={[styles.qNavBtnText, { color: '#fff' }]}>Next</Text>
                    <FontAwesome5 name="arrow-right" size={14} color="#fff" />
                  </TouchableOpacity>
                : <TouchableOpacity
                    onPress={submitTest}
                    style={[styles.qNavBtn, styles.qNavBtnSuccess]}>
                    <FontAwesome5 name="check" size={14} color="#fff" />
                    <Text style={[styles.qNavBtnText, { color: '#fff' }]}>Finish</Text>
                  </TouchableOpacity>
              }
            </View>
          </ScrollView>

        </View>
      </SafeAreaView>
    );
  }

  // ═══ TEST LIST ═══
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <FontAwesome5 name="pencil-alt" size={18} color="#C9A44E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Online Tests</Text>
            <Text style={styles.headerSub}>{tests.length} Active Tests</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          {tests.length === 0
            ? <View style={styles.emptyBox}>
                <View style={styles.emptyIconWrap}>
                  <FontAwesome5 name="pencil-alt" size={32} color="#B0C4DC" />
                </View>
                <Text style={styles.emptyTitle}>Koi active test nahi hai</Text>
                <Text style={styles.emptySub}>Jab teacher test publish karega, yahan dikhega</Text>
              </View>
            : tests.map(t => {
                const isDone = completedTests.includes(t.id);
                return (
                  <View key={t.id} style={[styles.testCard, { borderLeftColor: isDone ? '#059669' : '#1B1464' }]}>

                    {/* Card Header */}
                    <View style={styles.testCardHeader}>
                      <View style={[styles.testIconWrap, { backgroundColor: isDone ? '#ECFDF5' : '#EFF6FF' }]}>
                        <FontAwesome5 name={isDone ? 'check-circle' : 'file-alt'} size={18} color={isDone ? '#059669' : '#1B1464'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.testTitle}>{t.title}</Text>
                        <View style={styles.testMeta}>
                          <View style={styles.metaChip}>
                            <FontAwesome5 name="book" size={9} color="#6B7F99" />
                            <Text style={styles.metaChipText}>{t.subject}</Text>
                          </View>
                          <View style={styles.metaChip}>
                            <FontAwesome5 name="clock" size={9} color="#6B7F99" />
                            <Text style={styles.metaChipText}>{t.duration || 30} mins</Text>
                          </View>
                          <View style={styles.metaChip}>
                            <FontAwesome5 name="question-circle" size={9} color="#6B7F99" />
                            <Text style={styles.metaChipText}>{t.totalQuestions || t.questions?.length || 0} Q</Text>
                          </View>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: isDone ? '#ECFDF5' : '#EFF6FF' }]}>
                        <Text style={[styles.statusBadgeText, { color: isDone ? '#059669' : '#1B1464' }]}>
                          {isDone ? 'Done' : t.testType || 'Test'}
                        </Text>
                      </View>
                    </View>

                    {/* Chapter/Topic */}
                    {(t.chapter || t.topic) && (
                      <View style={styles.chapterRow}>
                        <FontAwesome5 name="bookmark" size={10} color="#6B7F99" />
                        <Text style={styles.chapterText}>
                          {t.chapter}{t.topic ? ` — ${t.topic}` : ''}
                        </Text>
                      </View>
                    )}

                    {/* Difficulty */}
                    {t.difficulty && (
                      <View style={styles.diffRow}>
                        <FontAwesome5 name="signal" size={10} color={t.difficulty === 'hard' ? '#DC2626' : t.difficulty === 'medium' ? '#D97706' : '#059669'} />
                        <Text style={[styles.diffText, { color: t.difficulty === 'hard' ? '#DC2626' : t.difficulty === 'medium' ? '#D97706' : '#059669' }]}>
                          {t.difficulty?.charAt(0).toUpperCase() + t.difficulty?.slice(1)} Difficulty
                        </Text>
                      </View>
                    )}

                    {/* Schedule */}
                    {(t.scheduledDate || t.scheduledTime) && (
                      <View style={styles.scheduleRow}>
                        <FontAwesome5 name="calendar" size={10} color="#D97706" />
                        <Text style={styles.scheduleText}>
                          Available: {t.scheduledDate || ''}{t.scheduledTime ? ' at ' + t.scheduledTime : ''}
                        </Text>
                      </View>
                    )}

                    {/* Action */}
                    {isDone
                      ? <View style={styles.doneRow}>
                          <FontAwesome5 name="check-circle" size={14} color="#059669" />
                          <Text style={styles.doneText}>Test diya ja chuka hai</Text>
                        </View>
                      : <TouchableOpacity style={styles.startBtn} onPress={() => startTest(t)}>
                          <FontAwesome5 name="play" size={13} color="#fff" />
                          <Text style={styles.startBtnText}>Test Shuru Karo</Text>
                        </TouchableOpacity>
                    }
                  </View>
                );
              })
          }
        </ScrollView>

        <BottomNav active="dashboard" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B1464' },
  container: { flex: 1, backgroundColor: '#F0F4FA' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4FA' },

  // Header
  header: { backgroundColor: '#1B1464', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerIconWrap: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 12, color: '#C9A44E', marginTop: 2 },

  // Test Card
  testCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderLeftWidth: 4, elevation: 2 },
  testCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  testIconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  testTitle: { fontSize: 15, fontWeight: '800', color: '#0B1826', marginBottom: 6 },
  testMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0F4FA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  metaChipText: { fontSize: 11, color: '#6B7F99', fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  chapterText: { fontSize: 12, color: '#6B7F99' },
  diffRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  diffText: { fontSize: 12, fontWeight: '600' },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF7ED', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  scheduleText: { fontSize: 12, color: '#D97706', fontWeight: '600' },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1B1464', borderRadius: 12, padding: 13, marginTop: 6 },
  startBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  doneText: { color: '#059669', fontWeight: '700', fontSize: 13 },

  // Timer Bar
  timerBar: { backgroundColor: '#1B1464', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  testTitleSmall: { color: '#fff', fontWeight: '700', fontSize: 13 },
  answeredText: { color: '#C9A44E', fontSize: 11, marginTop: 2 },
  timerBox: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  timerText: { fontSize: 18, fontWeight: '900', color: '#fff', fontVariant: ['tabular-nums'] },
  submitBtnSmall: { backgroundColor: '#DC2626', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  submitBtnSmallText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  testProgressBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', backgroundColor: '#E8EFF8' },
  testProgressFill: { height: '100%', backgroundColor: '#C9A44E' },

  // Dots
  dotsScroll: { backgroundColor: '#fff', maxHeight: 54, borderBottomWidth: 1, borderBottomColor: '#E8EFF8' },
  dot: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  dotText: { fontSize: 12, fontWeight: '700' },

  // Question
  questionCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14, elevation: 2 },
  qHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  qNum: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#1B1464', alignItems: 'center', justifyContent: 'center' },
  qNumText: { fontSize: 14, fontWeight: '900', color: '#fff' },
  qOf: { fontSize: 13, color: '#6B7F99', fontWeight: '600' },
  subjectPill: { marginLeft: 'auto', backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  subjectPillText: { fontSize: 11, fontWeight: '700', color: '#1B1464' },
  questionText: { fontSize: 15, fontWeight: '700', lineHeight: 24, color: '#0B1826', marginBottom: 16 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 13, backgroundColor: '#F0F4FA', borderWidth: 1.5, borderColor: '#E0E8F4' },
  optionSelected: { backgroundColor: '#EFF6FF', borderColor: '#1B1464' },
  optLabel: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#E8EFF8', alignItems: 'center', justifyContent: 'center' },
  optLabelSelected: { backgroundColor: '#1B1464' },
  optLabelText: { fontSize: 12, fontWeight: '800' },
  optText: { flex: 1, fontSize: 14 },
  qNavRow: { flexDirection: 'row', gap: 12 },
  qNavBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F0F4FA', borderRadius: 13, padding: 14 },
  qNavBtnPrimary: { backgroundColor: '#1B1464' },
  qNavBtnSuccess: { backgroundColor: '#059669' },
  qNavBtnText: { fontWeight: '700', fontSize: 14, color: '#1B1464' },

  // Result
  scoreCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, elevation: 2, borderWidth: 2 },
  gradeCircle: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: 2 },
  gradeText: { fontSize: 32, fontWeight: '900' },
  scorePct: { fontSize: 36, fontWeight: '900', marginBottom: 4 },
  scoreSubText: { fontSize: 13, color: '#6B7F99', marginBottom: 16 },
  scoreStatsRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 16 },
  scoreStat: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 },
  scoreStatVal: { fontSize: 20, fontWeight: '900' },
  scoreStatLabel: { fontSize: 10, color: '#6B7F99', fontWeight: '600' },
  resultProgressBg: { height: 7, backgroundColor: '#F0F4FA', borderRadius: 99, overflow: 'hidden', width: '100%' },
  resultProgressFill: { height: '100%', borderRadius: 99 },

  // Review
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#6B7F99', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  reviewCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 4, elevation: 1 },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  reviewNum: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  reviewQ: { flex: 1, fontSize: 13, fontWeight: '700', color: '#0B1826', lineHeight: 20 },
  reviewAns: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  reviewAnsText: { fontSize: 12, fontWeight: '600', flex: 1 },
  explanationBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FFF7ED', borderRadius: 8, padding: 8, marginTop: 6 },
  explanationText: { flex: 1, fontSize: 11, color: '#D97706', lineHeight: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1B1464', borderRadius: 14, padding: 16, marginTop: 8 },
  backBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Empty
  emptyBox: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#F0F4FA', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#6B7F99' },
  emptySub: { fontSize: 13, color: '#B0C4DC', textAlign: 'center' },

  // Nav
  navBar: { backgroundColor: '#fff', flexDirection: 'row', paddingTop: 10, paddingBottom: 45, borderTopWidth: 1, borderTopColor: '#E8EFF8', elevation: 8 },
  navTab: { flex: 1, alignItems: 'center', gap: 3 },
  navIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navIconWrapActive: { backgroundColor: '#EFF6FF' },
  navLabel: { fontSize: 10, color: '#6B7F99', fontWeight: '600' },
  navLabelActive: { color: '#1B1464', fontWeight: '800' },
  navBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#DC2626', borderRadius: 10, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  navBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
});