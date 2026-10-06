import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  orderBy,
  where,
  getDoc,
  setDoc,
  getDocs,
  limit
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { db, auth } from '../firebase';
import { User, Reading, Invoice, OperationType, FirestoreErrorInfo, UserRole } from '../types';

export function useFirebase() {
  const [users, setUsers] = useState<User[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email || undefined,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId || undefined,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data() as User;
          const isAdminEmail = firebaseUser.email === 'borbjo637@gmail.com';
          
          if (isAdminEmail && userData.role !== 'admin') {
            const updatedUser = { ...userData, role: 'admin' as const };
            await updateDoc(userRef, { role: 'admin' });
            setCurrentUser({ id: userSnap.id, ...updatedUser });
          } else {
            setCurrentUser({ id: userSnap.id, ...userData });
          }
        } else {
          // Create user if not exists
          const isAdminEmail = firebaseUser.email === 'borbjo637@gmail.com';
          const ids = await generateNextIds();
          const newUser: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'Usuario',
            role: isAdminEmail ? 'admin' : 'user',
            createdAt: Timestamp.now(),
            address: '',
            phone: firebaseUser.phoneNumber || '',
            ...ids
          };
          await setDoc(userRef, newUser);
          setCurrentUser(newUser);
        }
      } else {
        setCurrentUser(null);
        setUsers([]);
        setReadings([]);
        setInvoices([]);
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    // Users: Only admins and lecturadores can see all users
    let unsubscribeUsers = () => {};
    if (currentUser.role === 'admin' || currentUser.role === 'lecturador') {
      const qUsers = query(collection(db, 'users'), orderBy('name'));
      unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));
    } else {
      setUsers([currentUser]);
    }

    // Readings: Customers only see their own
    const qReadings = currentUser.role === 'admin' || currentUser.role === 'lecturador'
      ? query(collection(db, 'readings'), orderBy('date', 'desc'))
      : query(collection(db, 'readings'), where('userId', '==', currentUser.id), orderBy('date', 'desc'));
    
    const unsubscribeReadings = onSnapshot(qReadings, (snapshot) => {
      setReadings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reading)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'readings'));

    // Invoices: Customers only see their own
    const qInvoices = currentUser.role === 'admin' || currentUser.role === 'lecturador'
      ? query(collection(db, 'invoices'), orderBy('date', 'desc'))
      : query(collection(db, 'invoices'), where('userId', '==', currentUser.id), orderBy('date', 'desc'));

    const unsubscribeInvoices = onSnapshot(qInvoices, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'invoices'));

    return () => {
      unsubscribeUsers();
      unsubscribeReadings();
      unsubscribeInvoices();
    };
  }, [currentUser]);

  const generateNextIds = async () => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(1));
    const snap = await getDocs(q);
    let lastNum = 0;
    if (!snap.empty) {
      const lastUser = snap.docs[0].data() as User;
      if (lastUser.customerNumber) {
        lastNum = parseInt(lastUser.customerNumber.split('-')[1]) || 0;
      }
    }
    const nextNum = lastNum + 1;
    return {
      customerNumber: `CL-${String(nextNum).padStart(4, '0')}`,
      meterId: `MD-${String(1000 + nextNum).padStart(4, '0')}`
    };
  };

  const addUser = async (userData: Omit<User, 'id' | 'createdAt' | 'customerNumber' | 'meterId'>) => {
    try {
      const ids = await generateNextIds();
      await addDoc(collection(db, 'users'), { 
        ...userData, 
        ...ids,
        createdAt: Timestamp.now() 
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'users');
    }
  };

  const updateUser = async (userId: string, userData: Partial<User>) => {
    try {
      await updateDoc(doc(db, 'users', userId), userData);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
    }
  };

  const addReading = async (readingData: Omit<Reading, 'id'>) => {
    try {
      const docRef = await addDoc(collection(db, 'readings'), readingData);
      return docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'readings');
      throw err;
    }
  };

  const addInvoice = async (invoiceData: Omit<Invoice, 'id'>) => {
    try {
      const docRef = await addDoc(collection(db, 'invoices'), invoiceData);
      return docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'invoices');
      throw err;
    }
  };

  const updateInvoiceStatus = async (invoiceId: string, status: 'pending' | 'paid') => {
    try {
      await updateDoc(doc(db, 'invoices', invoiceId), { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `invoices/${invoiceId}`);
    }
  };

  const login = async (identifier: string, pass: string) => {
    const email = identifier.includes('@') ? identifier : `${identifier}@aguaread.com`;
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const register = async (emailOrUsername: string, pass: string, name: string, role: UserRole = 'user', extraData: Partial<User> = {}) => {
    const email = emailOrUsername.includes('@') ? emailOrUsername : `${emailOrUsername}@aguaread.com`;
    const username = emailOrUsername.includes('@') ? emailOrUsername.split('@')[0] : emailOrUsername;
    
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const userRef = doc(db, 'users', cred.user.uid);
    const ids = await generateNextIds();
    const newUser: User = {
      id: cred.user.uid,
      name,
      username,
      email: emailOrUsername.includes('@') ? emailOrUsername : (extraData.email || ''),
      role,
      createdAt: Timestamp.now(),
      address: extraData.address || '',
      phone: extraData.phone || '',
      ...ids
    };
    await setDoc(userRef, newUser);
    return cred;
  };

  const findUserByCustomerAndMeter = async (customerNumber: string, meterId: string) => {
    try {
      const q = query(
        collection(db, 'users'), 
        where('customerNumber', '==', customerNumber),
        where('meterId', '==', meterId),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as User;
    } catch (err) {
      console.error('Error finding user:', err);
      return null;
    }
  };

  const getInvoicesByUserId = async (userId: string) => {
    try {
      const q = query(
        collection(db, 'invoices'), 
        where('userId', '==', userId), 
        orderBy('date', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
    } catch (err) {
      console.error('Error getting invoices:', err);
      return [];
    }
  };

  const resetPassword = async (email: string) => {
    return sendPasswordResetEmail(auth, email);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  };

  const logout = () => signOut(auth);

  return {
    users,
    readings,
    invoices,
    currentUser,
    loading,
    addUser,
    updateUser,
    deleteUser,
    addReading,
    addInvoice,
    updateInvoiceStatus,
    login,
    register,
    resetPassword,
    loginWithGoogle,
    logout,
    findUserByCustomerAndMeter,
    getInvoicesByUserId
  };
}
