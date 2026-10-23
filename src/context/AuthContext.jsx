import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Lắng nghe thay đổi trạng thái xác thực từ Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            setUserProfile(userDocSnap.data());
          } else {
            setUserProfile(null);
          }
        } catch (error) {
          console.error('Lỗi khi tải hồ sơ người dùng từ Firestore:', error);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Đăng nhập bằng Email và Password
  const login = async (email, password) => {
    return await signInWithEmailAndPassword(auth, email, password);
  };

  // Đăng ký tài khoản mới và lưu thông tin hồ sơ vào Firestore
  const register = async (email, password, additionalData = {}) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const role = additionalData.role === 'mentor' ? 'mentor' : 'mentee';
    const profileData = {
      uid: user.uid,
      email: user.email,
      fullName: additionalData.fullName || '',
      role: role,
      skills: Array.isArray(additionalData.skills) ? additionalData.skills : [],
      bio: additionalData.bio || '',
      avatar: additionalData.avatar || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Cập nhật displayName và photoURL trên Firebase Auth nếu có
    if (additionalData.fullName || additionalData.avatar) {
      await updateProfile(user, {
        displayName: additionalData.fullName || user.displayName,
        photoURL: additionalData.avatar || user.photoURL,
      });
    }

    // Lưu bản ghi vào collection 'users' trên Firestore
    await setDoc(doc(db, 'users', user.uid), profileData);
    setUserProfile(profileData);

    return userCredential;
  };

  // Đăng xuất khỏi hệ thống
  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
  };

  const value = {
    currentUser,
    userProfile,
    loading,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-gray-600">Đang khởi tạo phiên đăng nhập...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

// Custom hook để sử dụng AuthContext một cách thuận tiện
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider');
  }
  return context;
};
