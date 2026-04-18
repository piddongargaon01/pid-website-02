import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../firebase';

export function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let notifsUnsub1 = null;
    let notifsUnsub2 = null;
    let testsUnsub = null;
    let studentsUnsub = null;
    let notifs1 = [];
    let notifs2 = [];

    const authUnsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setUnreadCount(0); return; }

      studentsUnsub = onSnapshot(collection(db, 'students'), async (s) => {
        const found = s.docs.find(d =>
          d.data().studentEmail?.toLowerCase() === user.email?.toLowerCase()
        );
        if (!found) return;
        const st = { id: found.id, ...found.data() };
        const sc = (st.class || '').trim();
        const sm = (st.medium || '').trim();
        const sb = st.board === 'CG Board' ? 'CG' : (st.board || '').trim();

        const classOk = (fc) => {
          if (!fc || fc === 'all') return true;
          const fcT = fc.trim();
          if (fcT === sc) return true;
          if (fcT.startsWith(sc + '-')) return true;
          const p = fcT.split('-');
          if (p[0] !== sc) return false;
          if (p.length === 1) return true;
          if (p[1] && sm) {
            const medOk = (p[1] === 'Eng' && sm === 'English') ||
              ((p[1] === 'Hin' || p[1] === 'Hindi') && sm === 'Hindi');
            if (!medOk) return false;
          }
          const bp = p.slice(2);
          if (bp.length > 0 && sb) {
            if (!bp.some(x => x === sb || x === 'All')) return false;
          }
          return true;
        };

        const calculateBadge = async () => {
          const lastVisitRaw = await AsyncStorage.getItem('pid_last_notif_visit');
          const lastVisit = lastVisitRaw ? parseInt(lastVisitRaw) : 0;

          const allNotifs = [...notifs1, ...notifs2];
          const filtered = allNotifs.filter(n => {
            const fc = (n.forClass || n.classFilter || 'all');
            return classOk(fc);
          });

          const newCount = filtered.filter(n => {
            const t = n.createdAt?.seconds
              ? n.createdAt.seconds * 1000
              : n.createdAt?.toMillis?.() || 0;
            return t > lastVisit;
          }).length;

          const today = new Date().toISOString().split('T')[0];
          if (testsUnsub) testsUnsub();
          testsUnsub = onSnapshot(
            query(collection(db, 'online_tests'), where('isActive', '==', true)),
            async (ts) => {
              const tests = ts.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(t => classOk(t.forClass) && (!t.scheduledDate || t.scheduledDate <= today));
              const doneRaw = await AsyncStorage.getItem('pid_done_tests');
              const doneTests = new Set(doneRaw ? JSON.parse(doneRaw) : []);
              const pendingTests = tests.filter(t => !doneTests.has(t.id)).length;
              setUnreadCount(newCount + pendingTests);
            }
          );
        };

        if (notifsUnsub1) notifsUnsub1();
        notifsUnsub1 = onSnapshot(collection(db, 'notifications'), async (ns) => {
          notifs1 = ns.docs.map(d => ({ id: d.id, ...d.data() }));
          await calculateBadge();
        });

        if (notifsUnsub2) notifsUnsub2();
        notifsUnsub2 = onSnapshot(collection(db, 'scheduled_notifications'), async (ns) => {
          notifs2 = ns.docs.map(d => {
            const data = d.data();
            return {
              id: 's_' + d.id,
              message: data.message || '',
              title: data.title || '',
              type: data.notifType || data.type || 'general',
              forClass: data.classFilter || data.forClass || 'all',
              scheduledDate: data.date || data.scheduledDate || '',
              scheduledTime: data.time || data.scheduledTime || '',
              sentBy: data.sentBy || 'Admin',
              createdAt: data.createdAt,
            };
          });
          await calculateBadge();
        });
      });
    });

    return () => {
      authUnsub();
      if (notifsUnsub1) notifsUnsub1();
      if (notifsUnsub2) notifsUnsub2();
      if (testsUnsub) testsUnsub();
      if (studentsUnsub) studentsUnsub();
    };
  }, []);

  return unreadCount;
}
