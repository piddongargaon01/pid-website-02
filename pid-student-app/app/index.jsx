import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import * as Device from 'expo-device'; // ← NEW - commented out due to version issue
// expo-notifications: APK build mein use hoga
import { useRouter } from 'expo-router';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert,
  Animated,
  KeyboardAvoidingView,
  Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebase';
import { registerForPushNotifications } from '../utils/notifications';

// ─── OTP Generator ───
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Send OTP via Resend ───
async function sendOTPEmail(toEmail, toName, otpCode) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer re_ULTJxdxn_ExLEMNvLqBLAXiRN4GsYvV27',
      },
      body: JSON.stringify({
        from: 'PID App <noreply@patelinstitutedgn.in>',
        to: [toEmail],
        subject: 'PID App - Login OTP',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f0f4fa; padding: 20px; border-radius: 16px;">
            <div style="background: #1B1464; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
              <h1 style="color: #C9A44E; margin: 0; font-size: 28px; letter-spacing: 3px;">PID</h1>
              <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 13px;">Patel Institute Dongargaon</p>
            </div>
            <div style="background: #fff; padding: 24px; border-radius: 12px;">
              <p style="color: #0B1826; font-size: 15px; margin-bottom: 8px;">Namaste <strong>${toName}</strong>!</p>
              <p style="color: #6B7F99; font-size: 14px; margin-bottom: 20px;">Aapka PID Student App login OTP hai:</p>
              <div style="background: #1B1464; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
                <h2 style="color: #C9A44E; font-size: 36px; letter-spacing: 8px; margin: 0; font-weight: 900;">${otpCode}</h2>
              </div>
              <p style="color: #DC2626; font-size: 13px; text-align: center;">⏰ Ye OTP 5 minutes mein expire ho jayega</p>
              <hr style="border: none; border-top: 1px solid #E8EFF8; margin: 16px 0;">
              <p style="color: #B0C4DC; font-size: 11px; text-align: center;">Agar aapne login request nahi ki toh is email ko ignore karo.</p>
            </div>
            <p style="color: #B0C4DC; font-size: 11px; text-align: center; margin-top: 12px;">Knowledge is Power — Patel Institute Dongargaon</p>
          </div>
        `,
      }),
    });
    const data = await response.json();
    console.log('Resend response:', JSON.stringify(data));
    return !!data.id;
  } catch (e) {
    console.error('Email error:', e);
    return false;
  }
}

// ─── FCM Token Save Function ─── NEW
async function saveFCMToken(userRole, userData) {
  if (userData?.id) {
    await registerForPushNotifications(userData.id, userRole);
  }
}

export default function Login() {
  const router = useRouter();
  const [step, setStep] = useState('email');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpExpiry, setOtpExpiry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [studentData, setStudentData] = useState(null);
  const [teacherData, setTeacherData] = useState(null);
  const [otpInputs, setOtpInputs] = useState(['', '', '', '', '', '']);
  const [userName, setUserName] = useState('');
  const inputRefs = useRef([]);
  const timerRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // ─── Auto Login Check ───
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const role = await AsyncStorage.getItem('pid_user_role');
          if (role === 'teacher') {
            router.replace('/teacher-dashboard');
          } else if (role === 'student') {
            router.replace('/dashboard');
          } else {
            const teachersSnap = await new Promise(resolve => {
              const unsub = onSnapshot(collection(db, 'teachers'), snap => {
                unsub(); resolve(snap);
              });
            });
            const userEmail = user.email?.toLowerCase().trim() || '';
            const isTeacher = teachersSnap.docs.some(d => {
              const tEmail = (d.data().email || d.data().teacherEmail || '').toLowerCase().trim();
              return tEmail === userEmail;
            });
            if (isTeacher) {
              await AsyncStorage.setItem('pid_user_role', 'teacher');
              router.replace('/teacher-dashboard');
            } else {
              await AsyncStorage.setItem('pid_user_role', 'student');
              router.replace('/dashboard');
            }
          }
          return;
        } catch (e) {
          console.error('Auto login error:', e);
        }
      }
      setCheckingAuth(false);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setResendTimer(t => t - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [resendTimer]);

  // ─── Check Email in Firebase ───
  async function checkEmail() {
    const trimEmail = email.trim().toLowerCase();
    if (!trimEmail || !trimEmail.includes('@')) {
      Alert.alert('Error', 'Valid email address likho!');
      return;
    }
    setLoading(true);
    try {
      let foundStudent = null;
      let foundTeacher = null;

      await new Promise(resolve => {
        const unsub = onSnapshot(collection(db, 'students'), snap => {
          unsub();
          foundStudent = snap.docs.find(d =>
            d.data().studentEmail?.toLowerCase() === trimEmail
          );
          resolve();
        });
      });

      await new Promise(resolve => {
        const unsub = onSnapshot(collection(db, 'teachers'), snap => {
          unsub();
          foundTeacher = snap.docs.find(d => {
            const tEmail = (d.data().email || d.data().teacherEmail || '').toLowerCase().trim();
            return tEmail === trimEmail;
          });
          resolve();
        });
      });

      if (!foundStudent && !foundTeacher) {
        Alert.alert(
          'Email Not Found',
          'Ye email PID mein registered nahi hai!\n\nAdmin se contact karo.'
        );
        setLoading(false);
        return;
      }

      const sData = foundStudent ? { id: foundStudent.id, ...foundStudent.data() } : null;
      const tData = foundTeacher ? { id: foundTeacher.id, ...foundTeacher.data() } : null;
      setStudentData(sData);
      setTeacherData(tData);

      const name = sData?.studentName || tData?.name || 'User';
      setUserName(name);

      const newOtp = generateOTP();
      const expiry = Date.now() + 5 * 60 * 1000;
      setGeneratedOtp(newOtp);
      setOtpExpiry(expiry);

      const sent = await sendOTPEmail(trimEmail, name, newOtp);

      setStep('otp');
      setResendTimer(60);
      setOtpInputs(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 500);
      if (!sent) {
        console.log('Email send nahi hua, OTP:', newOtp);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Kuch problem aayi. Dobara try karo!');
    }
    setLoading(false);
  }

  // ─── OTP Input Handler ───
  function handleOtpInput(text, index) {
    const newInputs = [...otpInputs];
    newInputs[index] = text.slice(-1);
    setOtpInputs(newInputs);
    setOtp(newInputs.join(''));
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    if (newInputs.every(v => v !== '') && newInputs.join('').length === 6) {
      verifyOTP(newInputs.join(''));
    }
  }

  function handleOtpBackspace(key, index) {
    if (key === 'Backspace' && !otpInputs[index] && index > 0) {
      const newInputs = [...otpInputs];
      newInputs[index - 1] = '';
      setOtpInputs(newInputs);
      inputRefs.current[index - 1]?.focus();
    }
  }

  // ─── Verify OTP ───
  async function verifyOTP(otpToVerify = otp) {
    if (otpToVerify.length !== 6) {
      Alert.alert('Error', '6 digit OTP enter karo!');
      return;
    }
    if (Date.now() > otpExpiry) {
      Alert.alert('Expired', 'OTP expire ho gaya! Dobara bhejo.');
      setStep('email');
      return;
    }
    if (otpToVerify !== generatedOtp) {
      Alert.alert('Wrong OTP', 'Galat OTP! Dobara check karo.');
      setOtpInputs(['', '', '', '', '', '']);
      setOtp('');
      inputRefs.current[0]?.focus();
      return;
    }
    setLoading(true);
    if (studentData && teacherData) {
      setStep('role');
      setLoading(false);
      return;
    }
    if (studentData) { await loginUser('student'); return; }
    if (teacherData) { await loginUser('teacher'); return; }
    setLoading(false);
  }

  // ─── Login User ───
  async function loginUser(userRole) {
    setLoading(true);
    try {
      const password = 'PID_2026_' + email.trim().replace(/[^a-z0-9]/gi, '');
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } catch (e) {
        if (
          e.code === 'auth/user-not-found' ||
          e.code === 'auth/invalid-credential' ||
          e.code === 'auth/wrong-password' ||
          e.code === 'auth/invalid-login-credentials'
        ) {
          try {
            await createUserWithEmailAndPassword(auth, email.trim(), password);
          } catch (e2) {
            if (e2.code === 'auth/email-already-in-use') {
              const { updatePassword, signInWithEmailAndPassword: signIn } = await import('firebase/auth');
              const tryPasswords = [
                'PID_DEFAULT_2026_' + email.trim(),
                email.trim() + '123456',
                '123456',
              ];
              let loggedIn = false;
              for (const tryPass of tryPasswords) {
                try {
                  await signInWithEmailAndPassword(auth, email.trim(), tryPass);
                  loggedIn = true;
                  break;
                } catch { }
              }
              if (!loggedIn) {
                throw new Error('Password mismatch');
              }
            } else throw e2;
          }
        } else if (e.code === 'auth/email-already-in-use') {
          await signInWithEmailAndPassword(auth, email.trim(), password);
        } else throw e;
      }

      // ─── FCM Token Save Karo (Login ke baad) ─── NEW
      const userData = userRole === 'student' ? studentData : teacherData;
      await saveFCMToken(userRole, userData);

      await AsyncStorage.setItem('pid_user_role', userRole);
      if (userRole === 'teacher') {
        router.replace('/teacher-dashboard');
      } else {
        router.replace('/dashboard');
      }
    } catch (e) {
      console.error('Login error:', e);
      Alert.alert('Error', 'Login nahi hua. Dobara try karo!');
    }
    setLoading(false);
  }

  // ─── Resend OTP ───
  async function resendOTP() {
    if (resendTimer > 0) return;
    setLoading(true);
    const newOtp = generateOTP();
    const expiry = Date.now() + 5 * 60 * 1000;
    setGeneratedOtp(newOtp);
    setOtpExpiry(expiry);
    const sent = await sendOTPEmail(email.trim(), userName, newOtp);
    if (!sent) {
      Alert.alert('OTP (Testing)', `Naya OTP:\n\n${newOtp}`);
    }
    setResendTimer(60);
    setOtpInputs(['', '', '', '', '', '']);
    setOtp('');
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
    setLoading(false);
  }

  if (checkingAuth) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1B1464', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(201,164,78,0.4)' }}>
          <FontAwesome5 name="graduation-cap" size={36} color="#C9A44E" />
        </View>
        <Text style={{ fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: 3 }}>PID</Text>
        <Text style={{ fontSize: 12, color: '#C9A44E', fontWeight: '700' }}>Knowledge is Power</Text>
        <ActivityIndicator color="#C9A44E" size="small" style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>

          {/* Logo */}
          <Animated.View style={[styles.logoArea, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.logoWrap}>
              <FontAwesome5 name="graduation-cap" size={40} color="#C9A44E" />
            </View>
            <Text style={styles.logoTitle}>PID</Text>
            <Text style={styles.logoSub}>Patel Institute Dongargaon</Text>
            <Text style={styles.logoTagline}>Knowledge is Power</Text>
          </Animated.View>

          {/* Card */}
          <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

            {/* ─── Email Step ─── */}
            {step === 'email' && (
              <View>
                <Text style={styles.cardTitle}>Login Karo</Text>
                <Text style={styles.cardSub}>Apna registered email daalo — OTP aayega</Text>

                <View style={styles.inputWrap}>
                  <FontAwesome5 name="envelope" size={16} color="#6B7F99" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email address"
                    placeholderTextColor="#B0C4DC"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                  onPress={checkEmail}
                  disabled={loading}>
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <>
                      <FontAwesome5 name="paper-plane" size={15} color="#fff" />
                      <Text style={styles.primaryBtnText}>OTP Bhejo</Text>
                    </>
                  }
                </TouchableOpacity>

                <View style={styles.infoBox}>
                  <FontAwesome5 name="info-circle" size={12} color="#1B1464" />
                  <Text style={styles.infoText}>
                    Sirf PID mein registered email se login ho sakta hai.
                  </Text>
                </View>
              </View>
            )}

            {/* ─── OTP Step ─── */}
            {step === 'otp' && (
              <View>
                <TouchableOpacity style={styles.backBtn} onPress={() => { setStep('email'); setOtpInputs(['', '', '', '', '', '']); }}>
                  <FontAwesome5 name="arrow-left" size={14} color="#1B1464" />
                  <Text style={styles.backBtnText}>Back</Text>
                </TouchableOpacity>

                <Text style={styles.cardTitle}>OTP Enter Karo</Text>
                <Text style={styles.cardSub}>
                  <Text style={{ fontWeight: '800', color: '#1B1464' }}>{email}</Text>
                  {'\n'}pe 6-digit OTP bheja gaya hai
                </Text>

                <View style={styles.otpRow}>
                  {otpInputs.map((val, i) => (
                    <TextInput
                      key={i}
                      ref={ref => inputRefs.current[i] = ref}
                      style={[styles.otpBox, val && styles.otpBoxFilled]}
                      value={val}
                      onChangeText={text => handleOtpInput(text, i)}
                      onKeyPress={({ nativeEvent }) => handleOtpBackspace(nativeEvent.key, i)}
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                    />
                  ))}
                </View>

                <Text style={styles.otpInfo}>OTP 5 minutes mein expire ho jayega</Text>

                <TouchableOpacity
                  style={[styles.primaryBtn, (loading || otp.length < 6) && { opacity: 0.6 }]}
                  onPress={() => verifyOTP()}
                  disabled={loading || otp.length < 6}>
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <>
                      <FontAwesome5 name="check-circle" size={15} color="#fff" />
                      <Text style={styles.primaryBtnText}>Verify OTP</Text>
                    </>
                  }
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.resendBtn, resendTimer > 0 && { opacity: 0.5 }]}
                  onPress={resendOTP}
                  disabled={resendTimer > 0 || loading}>
                  <FontAwesome5 name="redo" size={12} color={resendTimer > 0 ? '#B0C4DC' : '#1B1464'} />
                  <Text style={[styles.resendText, { color: resendTimer > 0 ? '#B0C4DC' : '#1B1464' }]}>
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'OTP Dobara Bhejo'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ─── Role Step ─── */}
            {step === 'role' && (
              <View>
                <Text style={styles.cardTitle}>Role Select Karo</Text>
                <Text style={styles.cardSub}>Aap kaise login karna chahte hain?</Text>

                <TouchableOpacity style={styles.roleCard} onPress={() => loginUser('student')} disabled={loading}>
                  <View style={[styles.roleIcon, { backgroundColor: '#EFF6FF' }]}>
                    <FontAwesome5 name="user-graduate" size={24} color="#1B1464" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roleTitle}>Student</Text>
                    <Text style={styles.roleSub}>{studentData?.studentName}</Text>
                    <Text style={styles.roleSub}>Class {studentData?.class} · {studentData?.board}</Text>
                  </View>
                  <FontAwesome5 name="chevron-right" size={16} color="#B0C4DC" />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.roleCard, { marginTop: 10 }]} onPress={() => loginUser('teacher')} disabled={loading}>
                  <View style={[styles.roleIcon, { backgroundColor: '#ECFDF5' }]}>
                    <FontAwesome5 name="chalkboard-teacher" size={24} color="#059669" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roleTitle}>Teacher</Text>
                    <Text style={styles.roleSub}>{teacherData?.name}</Text>
                    <Text style={styles.roleSub}>{teacherData?.subject}</Text>
                  </View>
                  <FontAwesome5 name="chevron-right" size={16} color="#B0C4DC" />
                </TouchableOpacity>

                {loading && <ActivityIndicator color="#1B1464" style={{ marginTop: 20 }} />}
              </View>
            )}

          </Animated.View>

          <Text style={styles.footer}>Patel Institute Dongargaon © 2026</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B1464' },
  container: { flex: 1, backgroundColor: '#1B1464', justifyContent: 'center', padding: 20 },
  logoArea: { alignItems: 'center', marginBottom: 28 },
  logoWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 2, borderColor: 'rgba(201,164,78,0.4)' },
  logoTitle: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: 3 },
  logoSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: 4 },
  logoTagline: { fontSize: 11, color: '#C9A44E', fontWeight: '700', marginTop: 4, letterSpacing: 1 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 24, elevation: 8 },
  cardTitle: { fontSize: 22, fontWeight: '900', color: '#0B1826', marginBottom: 6 },
  cardSub: { fontSize: 13, color: '#6B7F99', lineHeight: 20, marginBottom: 20 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F4FA', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1.5, borderColor: '#E0E8F4', marginBottom: 16 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#0B1826', paddingVertical: 12 },
  primaryBtn: { backgroundColor: '#1B1464', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12 },
  infoText: { flex: 1, fontSize: 12, color: '#1B1464', lineHeight: 18 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#1B1464' },
  otpRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 12 },
  otpBox: { width: 46, height: 56, borderRadius: 14, borderWidth: 2, borderColor: '#E0E8F4', backgroundColor: '#F0F4FA', textAlign: 'center', fontSize: 22, fontWeight: '900', color: '#0B1826' },
  otpBoxFilled: { borderColor: '#1B1464', backgroundColor: '#EFF6FF', color: '#1B1464' },
  otpInfo: { fontSize: 11, color: '#B0C4DC', textAlign: 'center', marginBottom: 16 },
  resendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  resendText: { fontSize: 13, fontWeight: '700' },
  roleCard: { backgroundColor: '#F8FAFD', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderColor: '#E0E8F4' },
  roleIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  roleTitle: { fontSize: 16, fontWeight: '800', color: '#0B1826' },
  roleSub: { fontSize: 12, color: '#6B7F99', marginTop: 2 },
  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 20 },
});