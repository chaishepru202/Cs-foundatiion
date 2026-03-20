import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Home, 
  PieChart, 
  ArrowLeftRight, 
  LayoutGrid, 
  Settings, 
  Plus, 
  ChevronLeft, 
  ChevronDown,
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  MoreHorizontal,
  GraduationCap,
  Car,
  UtensilsCrossed,
  Stethoscope,
  Shirt,
  Fuel,
  Briefcase,
  Building2,
  Users,
  UserPlus,
  Trash2,
  ShieldCheck,
  Phone,
  Droplet,
  MapPin,
  Award,
  LogOut,
  LogIn,
  Download,
  Upload,
  Activity,
  Search,
  Newspaper,
  ScrollText,
  FileText,
  Image as ImageIcon,
  X,
  User as UserIcon,
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart as RePieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
} from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, compareDesc } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Transaction, Category, Budget, Member, MemberType, News, Donor, FoundationRule, MemberDonation, PublicDonation, SlideshowImage } from './types';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User,
  updateProfile
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy,
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  setDoc,
  getDoc,
  getDocs
} from 'firebase/firestore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In a real app, you might show a toast or alert here
}

const CATEGORY_ICONS: Record<Category, any> = {
  Food: UtensilsCrossed,
  Salary: Building2,
  Medicine: Stethoscope,
  Restaurant: UtensilsCrossed,
  Cloth: Shirt,
  Fuel: Fuel,
  Transportation: Car,
  Education: GraduationCap,
  Office: Briefcase,
  House: Home,
  Other: MoreHorizontal,
};

const CATEGORY_COLORS: Record<Category, string> = {
  Food: '#FCAC12',
  Salary: '#3861FB',
  Medicine: '#FD3C4A',
  Restaurant: '#FCAC12',
  Cloth: '#7F3DFF',
  Fuel: '#00A86B',
  Transportation: '#FD3C4A',
  Education: '#7F3DFF',
  Office: '#FCAC12',
  House: '#3861FB',
  Other: '#919191',
};

function ConfirmModal({ 
  show, 
  title, 
  message, 
  onConfirm, 
  onCancel 
}: { 
  show: boolean, 
  title: string, 
  message: string, 
  onConfirm: () => void | Promise<void>, 
  onCancel: () => void 
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
      >
        <div className="p-8 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
            <AlertTriangle size={40} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">{title}</h3>
          <p className="text-gray-500 font-medium leading-relaxed">{message}</p>
        </div>
        <div className="flex border-t border-gray-100">
          <button 
            onClick={onCancel}
            className="flex-1 py-5 text-gray-500 font-bold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 py-5 text-red-500 font-bold hover:bg-red-50 transition-colors border-l border-gray-100"
          >
            Confirm
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'graph' | 'funds' | 'members' | 'donors' | 'news' | 'rules' | 'settings' | 'donation'>('home');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [rules, setRules] = useState<FoundationRule[]>([]);
  const [memberDonations, setMemberDonations] = useState<MemberDonation[]>([]);
  const [publicDonations, setPublicDonations] = useState<PublicDonation[]>([]);
  const [slideshow, setSlideshow] = useState<SlideshowImage[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAddNewsModal, setShowAddNewsModal] = useState(false);
  const [showAddDonorModal, setShowAddDonorModal] = useState(false);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [showManageSlideshowModal, setShowManageSlideshowModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Listeners
  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setBudgets([]);
      setMembers([]);
      return;
    }

    const qTransactions = query(collection(db, 'transactions'), where('userId', '==', user.uid));
    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction));
      setTransactions(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));

    const qBudgets = query(collection(db, 'budgets'), where('userId', '==', user.uid));
    const unsubBudgets = onSnapshot(qBudgets, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Budget);
      if (data.length === 0) {
        // Initialize default budgets if none exist
        const defaultBudgets: Budget[] = [
          { category: 'Transportation', limit: 1000, spent: 0, userId: user.uid },
          { category: 'Education', limit: 2000, spent: 0, userId: user.uid },
          { category: 'Food', limit: 1500, spent: 0, userId: user.uid },
          { category: 'Restaurant', limit: 800, spent: 0, userId: user.uid },
        ];
        defaultBudgets.forEach(b => {
          addDoc(collection(db, 'budgets'), b).catch(e => handleFirestoreError(e, OperationType.CREATE, 'budgets'));
        });
      } else {
        setBudgets(data);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'budgets'));

    const qMembers = query(collection(db, 'members'), where('userId', '==', user.uid));
    const unsubMembers = onSnapshot(qMembers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Member));
      setMembers(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'members'));

    const qNews = query(collection(db, 'news'), orderBy('date', 'desc'));
    const unsubNews = onSnapshot(qNews, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as News));
      setNews(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'news'));

    const qSlideshow = query(collection(db, 'slideshow'), orderBy('date', 'desc'));
    const unsubSlideshow = onSnapshot(qSlideshow, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SlideshowImage));
      setSlideshow(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'slideshow'));

    const qDonors = query(collection(db, 'donors'), orderBy('joinedDate', 'desc'));
    const unsubDonors = onSnapshot(qDonors, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Donor));
      setDonors(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'donors'));

    const qRules = query(collection(db, 'rules'), orderBy('date', 'desc'));
    const unsubRules = onSnapshot(qRules, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FoundationRule));
      setRules(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'rules'));

    const qMemberDonations = query(collection(db, 'memberDonations'), orderBy('date', 'desc'));
    const unsubMemberDonations = onSnapshot(qMemberDonations, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MemberDonation));
      setMemberDonations(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'memberDonations'));

    const qPublicDonations = query(collection(db, 'publicDonations'), orderBy('date', 'desc'));
    const unsubPublicDonations = onSnapshot(qPublicDonations, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PublicDonation));
      setPublicDonations(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'publicDonations'));

    return () => {
      unsubTransactions();
      unsubBudgets();
      unsubMembers();
      unsubNews();
      unsubDonors();
      unsubRules();
      unsubMemberDonations();
      unsubPublicDonations();
    };
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setAuthError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        // Just ignore this, the user closed the popup
        return;
      }
      console.error('Login failed:', error);
      setAuthError(error.message || 'Login failed. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTab('home');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Update budget spent amounts dynamically
  const dynamicBudgets = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);

    return budgets.map(budget => {
      const spent = transactions
        .filter(t => 
          t.type === 'expense' && 
          t.category === budget.category &&
          isWithinInterval(parseISO(t.date), { start, end })
        )
        .reduce((acc, curr) => acc + curr.amount, 0);
      return { ...budget, spent };
    });
  }, [transactions, budgets]);

  const totalBalance = useMemo(() => {
    const transactionTotal = transactions.reduce((acc, curr) => {
      return curr.type === 'income' ? acc + curr.amount : acc - curr.amount;
    }, 0);
    
    const memberDonationTotal = memberDonations.reduce((acc, curr) => acc + curr.amount, 0);
    const verifiedPublicDonationTotal = publicDonations
      .filter(d => d.status === 'verified')
      .reduce((acc, curr) => acc + curr.amount, 0);
      
    return transactionTotal + memberDonationTotal + verifiedPublicDonationTotal;
  }, [transactions, memberDonations, publicDonations]);

  const monthlySavings = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    
    const transactionSavings = transactions
      .filter(t => isWithinInterval(parseISO(t.date), { start, end }))
      .reduce((acc, curr) => curr.type === 'income' ? acc + curr.amount : acc - curr.amount, 0);
      
    const memberDonationSavings = memberDonations
      .filter(d => isWithinInterval(parseISO(d.date), { start, end }))
      .reduce((acc, curr) => acc + curr.amount, 0);
      
    const verifiedPublicDonationSavings = publicDonations
      .filter(d => d.status === 'verified' && isWithinInterval(parseISO(d.date), { start, end }))
      .reduce((acc, curr) => acc + curr.amount, 0);
      
    return transactionSavings + memberDonationSavings + verifiedPublicDonationSavings;
  }, [transactions, memberDonations, publicDonations]);

  const handleAddTransaction = async (t: Omit<Transaction, 'id' | 'userId'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'transactions'), { ...t, userId: user.uid });
      setShowAddModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
    }
  };

  const handleUpdateBudget = async (category: Category, limit: number) => {
    if (!user) return;
    try {
      const q = query(collection(db, 'budgets'), where('userId', '==', user.uid), where('category', '==', category));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        await updateDoc(doc(db, 'budgets', snapshot.docs[0].id), { limit });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'budgets');
    }
  };

  const handleAddMember = async (m: Omit<Member, 'id' | 'joinedDate' | 'userId'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'members'), { 
        ...m, 
        userId: user.uid,
        joinedDate: new Date().toISOString() 
      });
      setShowAddMemberModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'members');
    }
  };

  const handleDeleteMember = async (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Remove Member',
      message: 'Are you sure you want to remove this member?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'members', id));
          setConfirmModal(prev => ({ ...prev, show: false }));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `members/${id}`);
        }
      }
    });
  };

  const handleAddNews = async (n: Omit<News, 'id' | 'userId'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'news'), { ...n, userId: user.uid });
      setShowAddNewsModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'news');
    }
  };

  const handleDeleteNews = async (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Delete News',
      message: 'Are you sure you want to delete this news item?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'news', id));
          setConfirmModal(prev => ({ ...prev, show: false }));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `news/${id}`);
        }
      }
    });
  };

  const handleAddDonor = async (d: Omit<Donor, 'id' | 'userId' | 'joinedDate'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'donors'), { 
        ...d, 
        userId: user.uid,
        joinedDate: new Date().toISOString()
      });
      setShowAddDonorModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'donors');
    }
  };

  const handleUpdateDonor = async (id: string, data: Partial<Donor>) => {
    try {
      await updateDoc(doc(db, 'donors', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `donors/${id}`);
    }
  };

  const handleDeleteDonor = async (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Remove Donor',
      message: 'Are you sure you want to remove this donor? This action cannot be undone.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'donors', id));
          setConfirmModal(prev => ({ ...prev, show: false }));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `donors/${id}`);
        }
      }
    });
  };

  const handleAddRule = async (title: string, pdfData: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'rules'), {
        title,
        pdfData,
        uploadedBy: user.displayName || 'Admin',
        date: new Date().toISOString()
      });
      setShowAddRuleModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'rules');
    }
  };

  const handleDeleteRule = async (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Delete Rule',
      message: 'Are you sure you want to delete this rule?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'rules', id));
          setConfirmModal(prev => ({ ...prev, show: false }));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `rules/${id}`);
        }
      }
    });
  };

  const handleAddMemberDonation = async (donation: Omit<MemberDonation, 'id'>) => {
    try {
      await addDoc(collection(db, 'memberDonations'), donation);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'memberDonations');
    }
  };

  const handleAddPublicDonation = async (donation: Omit<PublicDonation, 'id'>) => {
    try {
      await addDoc(collection(db, 'publicDonations'), donation);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'publicDonations');
    }
  };

  const handleVerifyPublicDonation = async (id: string) => {
    try {
      await updateDoc(doc(db, 'publicDonations', id), { status: 'verified' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `publicDonations/${id}`);
    }
  };

  const handleAddSlideshowImage = async (url: string, title?: string, description?: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'slideshow'), {
        url,
        title,
        description,
        date: new Date().toISOString(),
        uploadedBy: user.displayName || user.email || 'Admin'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'slideshow');
    }
  };

  const handleDeleteSlideshowImage = async (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Delete Slideshow Image',
      message: 'Are you sure you want to remove this image from the slideshow?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'slideshow', id));
          setConfirmModal(prev => ({ ...prev, show: false }));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `slideshow/${id}`);
        }
      }
    });
  };

  const isAdmin = useMemo(() => {
    return user?.email?.toLowerCase() === "chaishepru303@gmail.com";
  }, [user]);

  if (!isAuthReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-10 rounded-[48px] shadow-2xl text-center space-y-8"
        >
          <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center mx-auto shadow-lg shadow-primary/10 overflow-hidden border border-gray-100 relative">
            <img 
              src="/logo.png" 
              alt="CS Foundation Logo" 
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<span class="text-primary font-bold text-xl">CS</span>';
              }}
            />
          </div>
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
              Official Platform
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tighter leading-none">
              CS <span className="text-primary">Foundation</span>
            </h1>
            <p className="text-gray-500 font-medium text-lg italic">"সেবাই মোদের মুল মন্ত্র"</p>
            <div className="h-1 w-12 bg-primary/20 mx-auto rounded-full" />
          </div>
          
          {authError && (
            <div className="p-4 bg-expense/10 text-expense rounded-2xl text-sm font-bold">
              {authError}
            </div>
          )}

          <div className="space-y-3">
            <button 
              onClick={handleLogin}
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95"
            >
              <LogIn size={20} />
              <span>Sign in with Google</span>
            </button>
            <button 
              onClick={handleLogin}
              className="w-full py-4 bg-white text-primary border-2 border-primary/20 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-primary/5 transition-all active:scale-95"
            >
              <UserPlus size={20} />
              <span>Sign up with Google</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 overflow-hidden relative">
      {/* Desktop Sidebar */}
      <nav className="hidden md:flex flex-col w-64 bg-white border-r border-gray-100 p-6 z-40">
        <div className="flex items-center gap-3 mb-10 px-2 group cursor-default">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center overflow-hidden shadow-lg shadow-primary/20 shrink-0 group-hover:scale-105 transition-transform">
            <img 
              src="/logo.png" 
              alt="CS Foundation Logo" 
              className="w-full h-full object-contain p-1"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<span class="text-white font-black text-xl tracking-tighter">CS</span>';
              }}
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-gray-900 tracking-tight leading-none">
              CS <span className="text-primary">Foundation</span>
            </h1>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Management</span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <SidebarButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={Home} label="Dashboard" />
          <SidebarButton active={activeTab === 'news'} onClick={() => setActiveTab('news')} icon={Newspaper} label="News" />
          <SidebarButton active={activeTab === 'donation'} onClick={() => setActiveTab('donation')} icon={Heart} label="Donation" />
          <SidebarButton active={activeTab === 'graph'} onClick={() => setActiveTab('graph')} icon={PieChart} label="Reports" />
          <SidebarButton active={activeTab === 'members'} onClick={() => setActiveTab('members')} icon={Users} label="Member List" />
          <SidebarButton active={activeTab === 'donors'} onClick={() => setActiveTab('donors')} icon={Droplet} label="Blood Donors" />
          <SidebarButton active={activeTab === 'funds'} onClick={() => setActiveTab('funds')} icon={ArrowLeftRight} label="Foundation Funds" />
          <SidebarButton active={activeTab === 'rules'} onClick={() => setActiveTab('rules')} icon={ScrollText} label="Foundation Rules" />
          <SidebarButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={Settings} label="Settings" />
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          className="mt-auto w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95"
        >
          <Plus size={20} />
          <span>Add Transaction</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0 relative">
        <Header user={user} onLogout={handleLogout} activeTab={activeTab} />
        <div className="max-w-5xl mx-auto w-full">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <HomeView 
                totalBalance={totalBalance} 
                monthlySavings={monthlySavings}
                transactions={transactions}
                budgets={dynamicBudgets}
                members={members}
                memberDonations={memberDonations}
                publicDonations={publicDonations}
                onDeleteTransaction={handleDeleteTransaction}
              />
            )}
            {activeTab === 'graph' && (
              <ReportsView 
                transactions={transactions} 
                memberDonations={memberDonations}
                publicDonations={publicDonations}
                onDeleteTransaction={handleDeleteTransaction} 
                onBack={() => setActiveTab('home')}
              />
            )}
            {activeTab === 'members' && (
              <MemberListView 
                members={members} 
                onAddMember={() => setShowAddMemberModal(true)} 
                onDeleteMember={handleDeleteMember}
              />
            )}
            {activeTab === 'donors' && (
              <BloodDonorsView 
                donors={donors} 
                onAddDonor={() => setShowAddDonorModal(true)} 
                onDeleteDonor={handleDeleteDonor}
                onUpdateDonor={handleUpdateDonor}
                isAdmin={isAdmin}
                user={user}
                setConfirmModal={setConfirmModal}
              />
            )}
            {activeTab === 'news' && (
              <NewsView 
                news={news} 
                slideshow={slideshow}
                onAddNews={() => setShowAddNewsModal(true)} 
                onManageSlideshow={() => setShowManageSlideshowModal(true)}
                onDeleteNews={handleDeleteNews}
                isAdmin={isAdmin}
              />
            )}
            {activeTab === 'funds' && (
              <TransactionsView 
                transactions={transactions} 
                memberDonations={memberDonations}
                publicDonations={publicDonations}
                onDeleteTransaction={handleDeleteTransaction} 
              />
            )}
            {activeTab === 'rules' && (
              <FoundationRulesView 
                rules={rules} 
                isAdmin={isAdmin} 
                onAddRule={() => setShowAddRuleModal(true)} 
                onDeleteRule={handleDeleteRule} 
              />
            )}
            {activeTab === 'donation' && (
              <DonationView 
                members={members}
                memberDonations={memberDonations}
                publicDonations={publicDonations}
                onAddMemberDonation={handleAddMemberDonation}
                onAddPublicDonation={handleAddPublicDonation}
                onVerifyPublicDonation={handleVerifyPublicDonation}
                isAdmin={isAdmin}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsView 
                user={user}
                transactions={transactions}
                budgets={budgets}
                members={members}
                donors={donors}
                onLogout={handleLogout}
                setConfirmModal={setConfirmModal}
                onClearData={async () => {
                  try {
                    // Delete transactions
                    const tQuery = query(collection(db, 'transactions'), where('userId', '==', user.uid));
                    const tSnapshot = await getDocs(tQuery);
                    const tDeletes = tSnapshot.docs.map(d => deleteDoc(d.ref));

                    // Delete budgets
                    const bQuery = query(collection(db, 'budgets'), where('userId', '==', user.uid));
                    const bSnapshot = await getDocs(bQuery);
                    const bDeletes = bSnapshot.docs.map(d => deleteDoc(d.ref));

                    // Delete members
                    const mQuery = query(collection(db, 'members'), where('userId', '==', user.uid));
                    const mSnapshot = await getDocs(mQuery);
                    const mDeletes = mSnapshot.docs.map(d => deleteDoc(d.ref));

                    // Delete donors
                    const dQuery = query(collection(db, 'donors'), where('userId', '==', user.uid));
                    const dSnapshot = await getDocs(dQuery);
                    const dDeletes = dSnapshot.docs.map(d => deleteDoc(d.ref));

                    await Promise.all([...tDeletes, ...bDeletes, ...mDeletes, ...dDeletes]);
                  } catch (error) {
                    handleFirestoreError(error, OperationType.DELETE, 'all_data');
                  }
                }} 
              />
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile FAB */}
      <button 
        onClick={() => setShowAddModal(true)}
        className="md:hidden absolute bottom-20 left-1/2 -translate-x-1/2 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform active:scale-95 z-50"
      >
        <Plus size={32} />
      </button>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden h-20 bg-white border-t border-gray-100 flex items-center justify-around px-4 z-40">
        <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={Home} label="Home" />
        <NavButton active={activeTab === 'news'} onClick={() => setActiveTab('news')} icon={Newspaper} label="News" />
        <NavButton active={activeTab === 'donation'} onClick={() => setActiveTab('donation')} icon={Heart} label="Donation" />
        <div className="w-12" /> {/* Spacer for FAB */}
        <NavButton active={activeTab === 'members'} onClick={() => setActiveTab('members')} icon={Users} label="Members" />
        <NavButton active={activeTab === 'rules'} onClick={() => setActiveTab('rules')} icon={ScrollText} label="Rules" />
        <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={Settings} label="Settings" />
      </nav>

      {/* Modals */}
      <AnimatePresence>
        {showAddModal && (
          <AddTransactionModal 
            onClose={() => setShowAddModal(false)} 
            onSubmit={handleAddTransaction} 
          />
        )}
        {showAddMemberModal && (
          <AddMemberModal 
            onClose={() => setShowAddMemberModal(false)} 
            onSubmit={handleAddMember} 
          />
        )}
        {showAddNewsModal && (
          <AddNewsModal 
            onClose={() => setShowAddNewsModal(false)} 
            onSubmit={handleAddNews}
            authorName={user?.displayName || 'Admin'}
          />
        )}
        {showManageSlideshowModal && (
          <ManageSlideshowModal 
            images={slideshow}
            onClose={() => setShowManageSlideshowModal(false)}
            onAdd={handleAddSlideshowImage}
            onDelete={handleDeleteSlideshowImage}
          />
        )}
        {showAddDonorModal && (
          <AddDonorModal 
            onClose={() => setShowAddDonorModal(false)} 
            onSubmit={handleAddDonor}
          />
        )}
        {showAddRuleModal && (
          <AddRuleModal 
            onClose={() => setShowAddRuleModal(false)} 
            onSubmit={handleAddRule} 
          />
        )}
        <ConfirmModal 
          show={confirmModal.show}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(prev => ({ ...prev, show: false }))}
        />
      </AnimatePresence>
    </div>
  );
}

function ProfileDropdown({ user, onLogout }: { user: User | null, onLogout: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 pr-3 rounded-full bg-white border border-gray-100 hover:bg-gray-50 transition-all shadow-sm group"
      >
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20 group-hover:border-primary/40 transition-all">
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <UserIcon size={16} className="text-primary" />
          )}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter leading-none">Account</p>
          <p className="text-xs font-bold text-gray-700 truncate max-w-[80px]">{user.displayName?.split(' ')[0] || 'User'}</p>
        </div>
        <ChevronDown size={14} className={cn("text-gray-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-[100] overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-gray-50 mb-1">
              <p className="text-xs font-bold text-gray-900 truncate">{user.displayName || 'User'}</p>
              <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
            </div>
            
            <button 
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="w-full px-4 py-3 flex items-center gap-3 text-red-500 hover:bg-red-50 transition-colors text-sm font-bold"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Header({ user, onLogout, activeTab }: { user: User | null, onLogout: () => void, activeTab: string }) {
  const tabNames: Record<string, string> = {
    home: 'Dashboard',
    news: 'News Feed',
    donation: 'Donation Center',
    graph: 'Reports & Analytics',
    members: 'Member Directory',
    donors: 'Blood Donors',
    funds: 'Foundation Funds',
    settings: 'Settings'
  };

  return (
    <header className="sticky top-0 bg-gray-50/80 backdrop-blur-md z-30 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="md:hidden w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center overflow-hidden shadow-lg shadow-primary/20 shrink-0">
          <img 
            src="/logo.png" 
            alt="CS Foundation Logo" 
            className="w-full h-full object-contain p-1"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement!.innerHTML = '<span class="text-white font-black text-sm tracking-tighter">CS</span>';
            }}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 leading-none mb-1">{tabNames[activeTab] || 'CS Foundation'}</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
      <ProfileDropdown user={user} onLogout={onLogout} />
    </header>
  );
}

function SidebarButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all font-medium",
        active ? "bg-primary/10 text-primary" : "text-gray-500 hover:bg-gray-50"
      )}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );
}

function NavButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-colors",
        active ? "text-primary" : "text-gray-400"
      )}
    >
      <Icon size={24} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function HomeView({ 
  totalBalance, 
  monthlySavings, 
  transactions, 
  budgets, 
  members, 
  memberDonations,
  publicDonations,
  onDeleteTransaction 
}: { 
  totalBalance: number, 
  monthlySavings: number, 
  transactions: Transaction[], 
  budgets: Budget[], 
  members: Member[], 
  memberDonations: MemberDonation[],
  publicDonations: PublicDonation[],
  onDeleteTransaction: (id: string) => void 
}) {
  const monthlyIncome = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    
    const transactionIncome = transactions
      .filter(t => t.type === 'income' && isWithinInterval(parseISO(t.date), { start, end }))
      .reduce((acc, curr) => acc + curr.amount, 0);
      
    const memberDonationIncome = memberDonations
      .filter(d => isWithinInterval(parseISO(d.date), { start, end }))
      .reduce((acc, curr) => acc + curr.amount, 0);
      
    const publicDonationIncome = publicDonations
      .filter(d => d.status === 'verified' && isWithinInterval(parseISO(d.date), { start, end }))
      .reduce((acc, curr) => acc + curr.amount, 0);
      
    return transactionIncome + memberDonationIncome + publicDonationIncome;
  }, [transactions, memberDonations, publicDonations]);

  const monthlyExpense = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return transactions
      .filter(t => t.type === 'expense' && isWithinInterval(parseISO(t.date), { start, end }))
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [transactions]);

  const recentTransactions = useMemo(() => {
    const merged = [
      ...transactions.map(t => ({ ...t, source: 'transaction' })),
      ...memberDonations.map(d => ({ 
        id: d.id, 
        amount: d.amount, 
        date: d.date, 
        category: 'Donation' as Category, 
        type: 'income' as const, 
        note: `Member Donation: ${d.memberName}`,
        source: 'donation' 
      })),
      ...publicDonations
        .filter(d => d.status === 'verified')
        .map(d => ({ 
          id: d.id, 
          amount: d.amount, 
          date: d.date, 
          category: 'Donation' as Category, 
          type: 'income' as const, 
          note: `Public Donation: ${d.donorName}`,
          source: 'donation' 
        }))
    ].sort((a, b) => compareDesc(parseISO(a.date), parseISO(b.date)));

    return merged.slice(0, 5);
  }, [transactions, memberDonations, publicDonations]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-6 md:p-10 space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-primary p-8 rounded-[40px] text-white shadow-xl shadow-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center overflow-hidden border border-white/20 shrink-0">
            <img 
              src="/logo.png" 
              alt="CS Foundation Logo" 
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<span class="text-primary font-bold text-lg">CS</span>';
              }}
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold">CS Foundation</h2>
            <p className="text-sm opacity-80 font-medium">সেবাই মোদের মুল মন্ত্র (CS Foundation)</p>
          </div>
        </div>
        <div className="relative z-10 text-right">
          <p className="text-xs opacity-70 font-bold uppercase tracking-widest mb-1">Total Balance</p>
          <p className="text-4xl font-bold">${totalBalance.toLocaleString()}</p>
        </div>
      </div>

      {/* Income & Expense Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-income rounded-[32px] p-6 text-white shadow-lg shadow-income/20 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <ArrowUpCircle size={24} />
          </div>
          <div>
            <p className="text-xs opacity-80 font-medium">Monthly Income</p>
            <p className="text-2xl font-bold">${monthlyIncome.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-expense rounded-[32px] p-6 text-white shadow-lg shadow-expense/20 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <ArrowDownCircle size={24} />
          </div>
          <div>
            <p className="text-xs opacity-80 font-medium">Monthly Expense</p>
            <p className="text-2xl font-bold">${monthlyExpense.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Savings Card */}
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-50 flex flex-col justify-center">
          <p className="text-xs text-gray-400 font-medium mb-1">Monthly Savings</p>
          <h2 className="text-4xl font-bold mb-8">${monthlySavings.toLocaleString()}</h2>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-gray-400">Earned</span>
                <span className="font-bold">${monthlyIncome.toLocaleString()}</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-income transition-all duration-1000" 
                  style={{ width: monthlyIncome > 0 ? '100%' : '0%' }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-gray-400">Spend</span>
                <span className="font-bold">${monthlyExpense.toLocaleString()}</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-expense transition-all duration-1000" 
                  style={{ width: `${Math.min((monthlyExpense / (monthlyIncome || 1)) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

      {/* Mission Section */}
      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-50 flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-expense/10 flex items-center justify-center text-expense">
          <Droplet size={32} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-expense">রক্ত দিন জীবন বাঁচান</h3>
          <p className="text-sm text-gray-400">Give Blood, Save Life. Join our mission to help those in need of blood donation.</p>
        </div>
      </div>

      {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-50 flex flex-col gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Total Members</p>
              <h4 className="text-xl font-bold">{members.length}</h4>
            </div>
          </div>
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-50 flex flex-col gap-3">
            <div className="w-12 h-12 rounded-2xl bg-expense/10 flex items-center justify-center text-expense">
              <Droplet size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Blood Donors</p>
              <h4 className="text-xl font-bold">{members.filter(m => m.memberType === 'Blood Donor').length}</h4>
            </div>
          </div>
        </div>

        {/* Top Spending Section */}
        <section className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-50">
          <h3 className="text-lg font-bold mb-6">Top Spending</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-6">
            {(['House', 'Transportation', 'Office', 'Education', 'Medicine'] as Category[]).map((cat) => {
              const Icon = CATEGORY_ICONS[cat] || MoreHorizontal;
              return (
                <div key={cat} className="flex flex-col items-center gap-3 group cursor-pointer">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center transition-all group-hover:bg-primary/10 group-hover:scale-105">
                    <Icon size={28} className="text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-gray-500">{cat}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Recent Transactions */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">Recent Transactions</h3>
          <button className="text-primary text-sm font-bold hover:underline">See All</button>
        </div>
        <div className="space-y-4">
          {recentTransactions.map((t) => {
            const Icon = CATEGORY_ICONS[t.category] || MoreHorizontal;
            return (
              <div key={t.id} className="flex items-center justify-between bg-white p-4 rounded-3xl shadow-sm border border-gray-50 group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                    <Icon size={24} style={{ color: CATEGORY_COLORS[t.category] }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t.description || t.category}</p>
                    <p className="text-[10px] text-gray-400">{format(parseISO(t.date), 'MMM dd, yyyy')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className={cn("text-sm font-bold", t.type === 'income' ? "text-income" : "text-expense")}>
                    {t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()}
                  </p>
                  <button 
                    onClick={() => onDeleteTransaction(t.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-expense transition-all"
                  >
                    <Plus className="rotate-45" size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Fund Allocation */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">Fund Allocation</h3>
          <button className="text-primary text-sm font-bold hover:underline">View All</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map((budget) => {
            const Icon = CATEGORY_ICONS[budget.category] || MoreHorizontal;
            const percentage = (budget.spent / budget.limit) * 100;
            return (
              <div key={budget.category} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50 space-y-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                    <Icon size={24} className="text-expense" />
                  </div>
                  <div>
                    <p className="text-base font-bold">{budget.category}</p>
                    <p className="text-xs text-gray-400">Allocated: ${budget.limit.toLocaleString()}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all duration-700", percentage > 90 ? "bg-expense" : "bg-primary")} 
                      style={{ width: `${Math.min(percentage, 100)}%` }} 
                    />
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span>${budget.spent.toLocaleString()}</span>
                    <span className="text-gray-400">${budget.limit.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </motion.div>
  );
}

function ReportsView({ 
  transactions, 
  memberDonations,
  publicDonations,
  onDeleteTransaction, 
  onBack 
}: { 
  transactions: Transaction[], 
  memberDonations: MemberDonation[],
  publicDonations: PublicDonation[],
  onDeleteTransaction: (id: string) => void, 
  onBack: () => void 
}) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const filteredMemberDonations = useMemo(() => {
    return memberDonations.filter(d => d.date.startsWith(selectedMonth));
  }, [memberDonations, selectedMonth]);

  const filteredPublicDonations = useMemo(() => {
    return publicDonations.filter(d => d.status === 'verified' && d.date.startsWith(selectedMonth));
  }, [publicDonations, selectedMonth]);

  const totalIncome = useMemo(() => {
    const transactionIncome = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((acc, curr) => acc + curr.amount, 0);
      
    const memberIncome = filteredMemberDonations.reduce((acc, curr) => acc + curr.amount, 0);
    const publicIncome = filteredPublicDonations.reduce((acc, curr) => acc + curr.amount, 0);
    
    return transactionIncome + memberIncome + publicIncome;
  }, [filteredTransactions, filteredMemberDonations, filteredPublicDonations]);

  const totalExpense = useMemo(() => {
    return filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [filteredTransactions]);

  const savings = totalIncome - totalExpense;

  const data = useMemo(() => {
    const categories: Record<string, number> = {};
    filteredTransactions.filter(t => t.type === 'expense').forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [filteredTransactions]);

  const months = useMemo(() => {
    const uniqueMonths = new Set<string>();
    transactions.forEach(t => uniqueMonths.add(t.date.substring(0, 7)));
    memberDonations.forEach(d => uniqueMonths.add(d.date.substring(0, 7)));
    publicDonations.forEach(d => uniqueMonths.add(d.date.substring(0, 7)));
    // Add current month if not present
    uniqueMonths.add(format(new Date(), 'yyyy-MM'));
    return Array.from(uniqueMonths).sort().reverse();
  }, [transactions, memberDonations, publicDonations]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-6 md:p-10 space-y-8"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Financial Reports</h1>
        </div>
        <select 
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="p-3 rounded-2xl border border-gray-100 bg-white font-bold text-sm outline-none focus:border-primary transition-colors"
        >
          {months.map(m => (
            <option key={m} value={m}>{format(parseISO(m + '-01'), 'MMMM yyyy')}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-income/10 flex items-center justify-center text-income">
              <TrendingUp size={20} />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Income</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">${totalIncome.toLocaleString()}</p>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-expense/10 flex items-center justify-center text-expense">
              <TrendingDown size={20} />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Expense</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">${totalExpense.toLocaleString()}</p>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <DollarSign size={20} />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Net Savings</p>
          </div>
          <p className={cn("text-3xl font-bold", savings >= 0 ? "text-income" : "text-expense")}>
            {savings < 0 && '-'}${Math.abs(savings).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Category Breakdown */}
        <div className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-50 flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-8">
            <h3 className="text-lg font-bold">Category Distribution</h3>
            <BarChart3 className="text-gray-300" size={20} />
          </div>
          
          <div className="relative w-full aspect-square max-w-[280px] mb-8">
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={data}
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name as Category] || '#7F3DFF'} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
                  />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center border-4 border-dashed border-gray-100 rounded-full">
                <p className="text-xs text-gray-300 font-bold">No Data</p>
              </div>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Spent</p>
              <p className="text-2xl font-bold">${totalExpense.toLocaleString()}</p>
            </div>
          </div>

          <div className="w-full grid grid-cols-2 gap-4">
            {data.map((item) => (
              <div key={item.name} className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[item.name as Category] }} />
                <div className="overflow-hidden">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{item.name}</p>
                  <p className="text-sm font-bold truncate">${item.value.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions in Report */}
        <div className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-50 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold">Transaction History</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{filteredTransactions.length} Items</p>
          </div>
          
          <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar pr-2">
            {filteredTransactions.map((t) => {
              const Icon = CATEGORY_ICONS[t.category] || MoreHorizontal;
              return (
                <div key={t.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                      t.type === 'income' ? "bg-income/10" : "bg-expense/10"
                    )}>
                      <Icon size={24} style={{ color: t.type === 'income' ? '#00A86B' : CATEGORY_COLORS[t.category] }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{t.description || t.category}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">
                        {format(parseISO(t.date), 'MMM dd')} • {t.category}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className={cn(
                      "text-sm font-bold",
                      t.type === 'income' ? "text-income" : "text-expense"
                    )}>
                      {t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()}
                    </p>
                    <button 
                      onClick={() => onDeleteTransaction(t.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-expense transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredTransactions.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 py-20">
                <BarChart3 size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-bold">No transactions for this month</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function MemberListView({ members, onAddMember, onDeleteMember }: { members: Member[], onAddMember: () => void, onDeleteMember: (id: string) => void }) {
  const [filter, setFilter] = useState<'all' | 'admin' | 'blood'>('all');
  const [selectedBlood, setSelectedBlood] = useState<string>('A+');

  const [searchTerm, setSearchTerm] = useState('');

  const filteredMembers = useMemo(() => {
    let result = members;
    if (filter === 'admin') result = result.filter(m => m.role === 'admin');
    if (filter === 'blood') result = result.filter(m => m.bloodGroup === selectedBlood);
    
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(m => 
        m.name.toLowerCase().includes(lowerSearch) || 
        m.phoneNumber.includes(searchTerm) ||
        m.email.toLowerCase().includes(lowerSearch)
      );
    }
    return result;
  }, [members, filter, selectedBlood, searchTerm]);

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="flex flex-col h-full"
    >
      <div className="bg-primary p-6 pb-24 rounded-b-[48px] text-white space-y-8">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Users size={20} />
          </div>
          <h2 className="text-lg font-bold">Foundation Members</h2>
          <button 
            onClick={onAddMember}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <UserPlus size={20} />
          </button>
        </div>
        
        <div className="text-center space-y-1">
          <h1 className="text-4xl font-bold">{members.length}</h1>
          <p className="text-sm opacity-60">Total Registered Members</p>
        </div>

        <div className="flex justify-center">
          <button 
            onClick={onAddMember}
            className="bg-white text-primary px-6 py-3 rounded-2xl font-bold text-sm shadow-xl shadow-black/10 flex items-center gap-2 hover:scale-105 transition-transform active:scale-95"
          >
            <UserPlus size={18} />
            REGISTER NEW MEMBER
          </button>
        </div>
      </div>

      <div className="-mt-12 px-6 space-y-6 pb-10">
        <div className="bg-white rounded-3xl p-4 shadow-sm space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search by name, phone or email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-2xl outline-none font-medium focus:ring-2 ring-primary/20 transition-all"
            />
          </div>
          
          <div className="flex p-1 bg-gray-50 rounded-2xl overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setFilter('all')}
              className={cn(
                "flex-1 py-2 text-[10px] font-bold rounded-xl transition-all whitespace-nowrap px-4",
                filter === 'all' ? "bg-white text-primary shadow-sm" : "text-gray-400"
              )}
            >
              ALL
            </button>
            <button 
              onClick={() => setFilter('admin')}
              className={cn(
                "flex-1 py-2 text-[10px] font-bold rounded-xl transition-all whitespace-nowrap px-4",
                filter === 'admin' ? "bg-white text-primary shadow-sm" : "text-gray-400"
              )}
            >
              ADMINS
            </button>
            <button 
              onClick={() => setFilter('blood')}
              className={cn(
                "flex-1 py-2 text-[10px] font-bold rounded-xl transition-all whitespace-nowrap px-4",
                filter === 'blood' ? "bg-white text-primary shadow-sm" : "text-gray-400"
              )}
            >
              BLOOD DONORS
            </button>
          </div>
        </div>

        {filter === 'blood' && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {bloodGroups.map(bg => (
              <button
                key={bg}
                onClick={() => setSelectedBlood(bg)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                  selectedBlood === bg ? "bg-expense text-white shadow-md shadow-expense/20" : "bg-white text-gray-400 border border-gray-100"
                )}
              >
                {bg}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {filteredMembers.map((member) => (
            <div key={member.id} className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-50 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-primary">
                  <Users size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold">{member.name}</p>
                    {member.role === 'admin' && (
                      <ShieldCheck size={16} className="text-primary" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <span className="opacity-60">Email:</span> {member.email}
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Phone size={12} className="opacity-60" /> {member.phoneNumber}
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Droplet size={12} className="text-expense opacity-80" /> {member.bloodGroup}
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Award size={12} className="text-primary opacity-80" /> {member.memberType}
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 w-full mt-1">
                      <MapPin size={12} className="opacity-60" /> {member.address}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                  member.role === 'admin' ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500"
                )}>
                  {member.role}
                </div>
                {member.role !== 'admin' && (
                  <button 
                    onClick={() => onDeleteMember(member.id)}
                    className="p-2 text-gray-300 hover:text-expense transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function AddMemberModal({ onClose, onSubmit }: { onClose: () => void, onSubmit: (m: Omit<Member, 'id' | 'joinedDate' | 'userId'>) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [memberType, setMemberType] = useState<MemberType>('General Member');
  const [role, setRole] = useState<'admin' | 'member'>('member');

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="relative w-full max-w-lg bg-white rounded-t-[40px] md:rounded-[40px] p-8 space-y-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Add New Member</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <Plus className="rotate-45" size={24} />
          </button>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">Full Name</label>
            <input 
              type="text" 
              placeholder="Enter name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold focus:border-primary transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">Blood Group</label>
              <select 
                value={bloodGroup}
                onChange={e => setBloodGroup(e.target.value)}
                className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold focus:border-primary transition-colors appearance-none"
              >
                <option value="">Select</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">Phone Number</label>
              <input 
                type="tel" 
                placeholder="017..."
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">Email Address</label>
            <input 
              type="email" 
              placeholder="Enter email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold focus:border-primary transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">Address</label>
            <input 
              type="text" 
              placeholder="Enter full address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold focus:border-primary transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">Member Type</label>
            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => setMemberType('General Member')}
                className={cn(
                  "py-4 rounded-2xl font-bold border-2 transition-all text-[10px]",
                  memberType === 'General Member' ? "border-primary bg-primary/5 text-primary" : "border-gray-100 text-gray-400"
                )}
              >
                General
              </button>
              <button 
                onClick={() => setMemberType('Lifetime Member')}
                className={cn(
                  "py-4 rounded-2xl font-bold border-2 transition-all text-[10px]",
                  memberType === 'Lifetime Member' ? "border-primary bg-primary/5 text-primary" : "border-gray-100 text-gray-400"
                )}
              >
                Lifetime
              </button>
              <button 
                onClick={() => setMemberType('Blood Donor')}
                className={cn(
                  "py-4 rounded-2xl font-bold border-2 transition-all text-[10px]",
                  memberType === 'Blood Donor' ? "border-expense bg-expense/5 text-expense" : "border-gray-100 text-gray-400"
                )}
              >
                Blood Donor
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">Role</label>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setRole('member')}
                className={cn(
                  "py-4 rounded-2xl font-bold border-2 transition-all",
                  role === 'member' ? "border-primary bg-primary/5 text-primary" : "border-gray-100 text-gray-400"
                )}
              >
                Member
              </button>
              <button 
                onClick={() => setRole('admin')}
                className={cn(
                  "py-4 rounded-2xl font-bold border-2 transition-all",
                  role === 'admin' ? "border-primary bg-primary/5 text-primary" : "border-gray-100 text-gray-400"
                )}
              >
                Admin
              </button>
            </div>
          </div>

          <button 
            onClick={() => {
              if (!name || !email || !bloodGroup || !phoneNumber || !address) return alert('Please fill all fields');
              onSubmit({ name, email, role, bloodGroup, phoneNumber, address, memberType });
            }}
            className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95"
          >
            Add Member
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function TransactionsView({ 
  transactions, 
  memberDonations,
  publicDonations,
  onDeleteTransaction 
}: { 
  transactions: Transaction[], 
  memberDonations: MemberDonation[],
  publicDonations: PublicDonation[],
  onDeleteTransaction: (id: string) => void 
}) {
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  const allTransactions = useMemo(() => {
    const merged = [
      ...transactions.map(t => ({ ...t, source: 'transaction' })),
      ...memberDonations.map(d => ({ 
        id: d.id, 
        amount: d.amount, 
        date: d.date, 
        category: 'Donation' as Category, 
        type: 'income' as const, 
        description: `Member Donation: ${d.memberName}`,
        source: 'donation' 
      })),
      ...publicDonations
        .filter(d => d.status === 'verified')
        .map(d => ({ 
          id: d.id, 
          amount: d.amount, 
          date: d.date, 
          category: 'Donation' as Category, 
          type: 'income' as const, 
          description: `Public Donation: ${d.donorName}`,
          source: 'donation' 
        }))
    ].sort((a, b) => compareDesc(parseISO(a.date), parseISO(b.date)));

    if (filter === 'all') return merged;
    return merged.filter(t => t.type === filter);
  }, [transactions, memberDonations, publicDonations, filter]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-6 md:p-10 space-y-8"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Transactions</h2>
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
          {(['all', 'income', 'expense'] as const).map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-lg transition-all capitalize",
                filter === f ? "bg-primary text-white" : "text-gray-400"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {allTransactions.map((t) => {
          const Icon = CATEGORY_ICONS[t.category] || MoreHorizontal;
          return (
            <div key={t.id} className="flex items-center justify-between bg-white p-5 rounded-[32px] shadow-sm border border-gray-50 group">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <Icon size={28} style={{ color: CATEGORY_COLORS[t.category] }} />
                </div>
                <div>
                  <p className="text-base font-bold">{t.description || t.category}</p>
                  <p className="text-xs text-gray-400">{format(parseISO(t.date), 'MMMM dd, yyyy • HH:mm')}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <p className={cn("text-lg font-bold", t.type === 'income' ? "text-income" : "text-expense")}>
                  {t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()}
                </p>
                {(t as any).source === 'transaction' && (
                  <button 
                    onClick={() => onDeleteTransaction(t.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-expense transition-all p-2"
                  >
                    <Plus className="rotate-45" size={20} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {allTransactions.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <ArrowLeftRight size={48} className="mx-auto mb-4 opacity-20" />
            <p>No transactions found</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SettingsView({ user, transactions, budgets, members, donors, onLogout, onClearData, setConfirmModal }: { 
  user: User, 
  transactions: Transaction[], 
  budgets: Budget[], 
  members: Member[],
  donors: Donor[],
  onLogout: () => void, 
  onClearData: () => Promise<void>,
  setConfirmModal: React.Dispatch<React.SetStateAction<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>>
}) {
  const [name, setName] = useState(user.displayName || 'User');

  const handleSaveName = async () => {
    try {
      await updateProfile(user, { displayName: name });
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile.');
    }
  };

  const handleExportData = () => {
    const data = {
      transactions,
      budgets,
      members,
      donors,
      exportDate: new Date().toISOString(),
      userId: user.uid
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `csforg_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        setConfirmModal({
          show: true,
          title: 'Import Data',
          message: 'This will import data and potentially create duplicates. Continue?',
          onConfirm: async () => {
            // Import transactions
            if (data.transactions) {
              for (const t of data.transactions) {
                const { id, ...tData } = t;
                await addDoc(collection(db, 'transactions'), { ...tData, userId: user.uid });
              }
            }
            // Import budgets
            if (data.budgets) {
              for (const b of data.budgets) {
                await addDoc(collection(db, 'budgets'), { ...b, userId: user.uid });
              }
            }
            // Import members
            if (data.members) {
              for (const m of data.members) {
                const { id, ...mData } = m;
                await addDoc(collection(db, 'members'), { ...mData, userId: user.uid });
              }
            }
            // Import donors
            if (data.donors) {
              for (const d of data.donors) {
                const { id, ...dData } = d;
                await addDoc(collection(db, 'donors'), { ...dData, userId: user.uid });
              }
            }
            setConfirmModal(prev => ({ ...prev, show: false }));
            window.location.reload();
          }
        });
      } catch (error) {
        console.error('Error importing data:', error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-6 md:p-10 space-y-8"
    >
      <h2 className="text-2xl font-bold">Settings</h2>

      <div className="space-y-6">
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-50 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">Profile Name</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold focus:border-primary transition-colors"
            />
          </div>
          <div className="flex flex-col gap-4">
            <button 
              onClick={handleSaveName}
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95"
            >
              Save Changes
            </button>
            <button 
              onClick={onLogout}
              className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-50 space-y-6">
          <h3 className="text-lg font-bold text-primary">Data Management</h3>
          <p className="text-sm text-gray-400">Export your data to a local file or import from a backup.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={handleExportData}
              className="flex items-center justify-center gap-3 py-4 bg-primary/10 text-primary rounded-2xl font-bold hover:bg-primary/20 transition-all"
            >
              <Download size={20} />
              Export to Local Disk
            </button>
            <label className="flex items-center justify-center gap-3 py-4 bg-income/10 text-income rounded-2xl font-bold hover:bg-income/20 transition-all cursor-pointer">
              <Upload size={20} />
              Import from Local Disk
              <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
            </label>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-50 space-y-6">
          <p className="text-sm text-gray-400">Clearing data will remove all transactions and budgets permanently.</p>
          <button 
            onClick={() => {
              setConfirmModal({
                show: true,
                title: 'Clear All Data',
                message: 'Are you sure you want to clear all data? This cannot be undone.',
                onConfirm: async () => {
                  await onClearData();
                  localStorage.clear();
                  setConfirmModal(prev => ({ ...prev, show: false }));
                  window.location.reload();
                }
              });
            }}
            className="w-full py-4 border-2 border-expense text-expense rounded-2xl font-bold hover:bg-expense hover:text-white transition-all"
          >
            Clear All Data
          </button>
        </div>

        <div className="text-center text-gray-300 text-xs">
          <p>CS Foundation v1.0.0</p>
          <p>© 2026 CS Foundation</p>
        </div>
      </div>
    </motion.div>
  );
}

function AddTransactionModal({ onClose, onSubmit }: { onClose: () => void, onSubmit: (t: Omit<Transaction, 'id' | 'userId'>) => void }) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState<Category>('Food' as Category);
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    onSubmit({
      amount: parseFloat(amount),
      type,
      category,
      description,
      date: new Date().toISOString()
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 md:p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="w-full max-w-lg bg-white rounded-[40px] p-8 md:p-10 space-y-8 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Add Transaction</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <ChevronLeft className="rotate-90" />
          </button>
        </div>
        
        <div className="space-y-2">
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Amount</p>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-bold text-primary">$</span>
            <input 
              autoFocus
              type="number" 
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="text-5xl md:text-6xl font-bold w-full outline-none placeholder:text-gray-100"
            />
          </div>
        </div>

        <div className="bg-gray-50 rounded-[32px] p-6 md:p-8 space-y-8">
          <div className="flex gap-4">
            <button 
              onClick={() => setType('expense')}
              className={cn("flex-1 py-4 rounded-2xl font-bold transition-all shadow-sm", type === 'expense' ? "bg-expense text-white shadow-expense/20" : "bg-white text-gray-400")}
            >
              Expense
            </button>
            <button 
              onClick={() => setType('income')}
              className={cn("flex-1 py-4 rounded-2xl font-bold transition-all shadow-sm", type === 'income' ? "bg-income text-white shadow-income/20" : "bg-white text-gray-400")}
            >
              Income
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Category</label>
              <select 
                value={category}
                onChange={e => setCategory(e.target.value as Category)}
                className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-white font-bold text-gray-700 cursor-pointer hover:border-primary/30 transition-colors"
              >
                <option value="Food">Food</option>
                <option value="Transportation">Transportation</option>
                <option value="Education">Education</option>
                <option value="Salary">Salary</option>
                <option value="Medicine">Medicine</option>
                <option value="Restaurant">Restaurant</option>
                <option value="Cloth">Cloth</option>
                <option value="Fuel">Fuel</option>
                <option value="Office">Office</option>
                <option value="House">House</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Description</label>
              <input 
                type="text" 
                placeholder="What was this for?"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-white font-bold text-gray-700 hover:border-primary/30 transition-colors"
              />
            </div>
          </div>

          <button 
            onClick={handleSubmit}
            className="w-full py-5 bg-primary text-white rounded-2xl font-bold text-lg shadow-xl shadow-primary/30 hover:scale-[1.02] transition-transform active:scale-95"
          >
            Save Transaction
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function NewsCard({ item, isAdmin, onDeleteNews }: { item: News, isAdmin: boolean, onDeleteNews: (id: string) => void, key?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all relative group cursor-pointer",
        isExpanded ? "p-8" : "hover:bg-gray-50"
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
            isExpanded ? "bg-primary text-white" : "bg-primary/10 text-primary"
          )}>
            <Newspaper size={24} />
          </div>
          <h3 className={cn(
            "text-xl font-bold transition-colors",
            isExpanded ? "text-gray-900" : "text-gray-700"
          )}>
            {item.title}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onDeleteNews(item.id);
              }}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={18} />
            </button>
          )}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            className="text-gray-400"
          >
            <ChevronDown size={20} />
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-8 space-y-6">
              {item.imageUrl && (
                <div className="rounded-2xl overflow-hidden border border-gray-100">
                  <img 
                    src={item.imageUrl} 
                    alt={item.title} 
                    className="w-full h-auto max-h-[400px] object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <p className="text-gray-600 leading-relaxed whitespace-pre-wrap text-lg">{item.content}</p>
              
              <div className="flex items-center justify-between text-sm text-gray-400 font-medium pt-6 border-t border-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {item.author[0].toUpperCase()}
                  </div>
                  <span>{item.author}</span>
                </div>
                <span>{new Date(item.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DonationView({ 
  members, 
  memberDonations, 
  publicDonations, 
  onAddMemberDonation, 
  onAddPublicDonation,
  onVerifyPublicDonation,
  isAdmin 
}: { 
  members: Member[], 
  memberDonations: MemberDonation[], 
  publicDonations: PublicDonation[], 
  onAddMemberDonation: (donation: Omit<MemberDonation, 'id'>) => Promise<void>,
  onAddPublicDonation: (donation: Omit<PublicDonation, 'id'>) => Promise<void>,
  onVerifyPublicDonation: (id: string) => Promise<void>,
  isAdmin: boolean 
}) {
  const [activeSubTab, setActiveSubTab] = useState<'members' | 'public'>('members');
  const [showMemberDonationModal, setShowMemberDonationModal] = useState(false);
  const [showPublicDonationModal, setShowPublicDonationModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const PAYMENT_METHODS = ['bKash', 'Nagad', 'Rocket', 'Bank Transfer', 'Cash'];

  const PAYMENT_DETAILS = {
    bkash: { name: 'bKash', number: '01XXXXXXXXX', type: 'Personal' },
    nagad: { name: 'Nagad', number: '01XXXXXXXXX', type: 'Personal' },
    rocket: { name: 'Rocket', number: '01XXXXXXXXX', type: 'Personal' },
    bank: { name: 'Bank Account', accountName: 'CS Foundation', accountNumber: 'XXXXXXXXXXXX', bankName: 'Example Bank', branch: 'Example Branch' }
  };

  const handleMemberDonation = (member: Member) => {
    setSelectedMember(member);
    setShowMemberDonationModal(true);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-6 md:p-10 space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Donation Center</h1>
          <p className="text-sm text-gray-400 font-medium">Support CS Foundation</p>
        </div>
        
        <div className="flex p-1 bg-gray-100 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveSubTab('members')}
            className={cn(
              "px-6 py-2 text-xs font-bold rounded-xl transition-all",
              activeSubTab === 'members' ? "bg-white text-primary shadow-sm" : "text-gray-400"
            )}
          >
            MEMBER MONTHLY
          </button>
          <button 
            onClick={() => setActiveSubTab('public')}
            className={cn(
              "px-6 py-2 text-xs font-bold rounded-xl transition-all",
              activeSubTab === 'public' ? "bg-white text-primary shadow-sm" : "text-gray-400"
            )}
          >
            PUBLIC DONATION
          </button>
        </div>
      </div>

      {activeSubTab === 'members' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Member Donations</p>
              <p className="text-3xl font-bold text-gray-900">
                ${memberDonations.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Members</p>
              <p className="text-3xl font-bold text-gray-900">{members.length}</p>
            </div>
            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">This Month</p>
              <p className="text-3xl font-bold text-primary">
                ${memberDonations
                  .filter(d => d.month === format(new Date(), 'yyyy-MM'))
                  .reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-50">
            <h3 className="text-lg font-bold mb-6">Member Monthly Status</h3>
            <div className="space-y-4">
              {members.map(member => {
                const currentMonth = format(new Date(), 'yyyy-MM');
                const isPaid = memberDonations.some(d => d.memberId === member.id && d.month === currentMonth);
                
                return (
                  <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group transition-all hover:bg-white hover:shadow-md border border-transparent hover:border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm">
                        <UserIcon size={24} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{member.name}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{member.memberType}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {isPaid ? (
                        <div className="flex items-center gap-2 px-3 py-1 bg-income/10 text-income rounded-full text-[10px] font-bold uppercase">
                          <ShieldCheck size={14} />
                          <span>Paid</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-1 bg-expense/10 text-expense rounded-full text-[10px] font-bold uppercase">
                          <AlertTriangle size={14} />
                          <span>Unpaid</span>
                        </div>
                      )}
                      <button 
                        onClick={() => handleMemberDonation(member)}
                        className="p-2 hover:bg-primary/10 text-primary rounded-xl transition-colors"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E2136E]/10 flex items-center justify-center text-[#E2136E]">
                  <span className="font-bold text-xs">bKash</span>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Personal</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{PAYMENT_DETAILS.bkash.number}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Send Money</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F6921E]/10 flex items-center justify-center text-[#F6921E]">
                  <span className="font-bold text-xs">Nagad</span>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Personal</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{PAYMENT_DETAILS.nagad.number}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Send Money</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#8C3494]/10 flex items-center justify-center text-[#8C3494]">
                  <span className="font-bold text-xs">Rocket</span>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Personal</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{PAYMENT_DETAILS.rocket.number}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Send Money</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Building2 size={20} />
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Bank</p>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{PAYMENT_DETAILS.bank.accountNumber}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">{PAYMENT_DETAILS.bank.bankName}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <button 
              onClick={() => setShowPublicDonationModal(true)}
              className="bg-primary text-white px-8 py-4 rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 flex items-center gap-2 hover:scale-105 transition-transform active:scale-95"
            >
              <Heart size={20} />
              SUBMIT DONATION RECORD
            </button>
          </div>

          <div className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-50">
            <h3 className="text-lg font-bold mb-6">Recent Public Donations</h3>
            <div className="space-y-6">
              {publicDonations.map(donation => (
                <div key={donation.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Heart size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{donation.donorName}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">
                        {format(parseISO(donation.date), 'MMM dd, yyyy')} • {donation.paymentMethod}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <p className="text-sm font-bold text-income">+${donation.amount.toLocaleString()}</p>
                      <p className={cn(
                        "text-[10px] font-bold uppercase tracking-tighter",
                        donation.status === 'verified' ? "text-income" : "text-expense"
                      )}>
                        {donation.status}
                      </p>
                    </div>
                    {isAdmin && donation.status === 'pending' && (
                      <button 
                        onClick={() => onVerifyPublicDonation(donation.id)}
                        className="px-3 py-1 bg-income/10 text-income rounded-lg text-[10px] font-bold uppercase hover:bg-income hover:text-white transition-colors"
                      >
                        Verify
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {publicDonations.length === 0 && (
                <div className="text-center py-10 text-gray-300">
                  <Heart size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-bold">No public donations yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Member Donation Modal */}
      <AnimatePresence>
        {showMemberDonationModal && selectedMember && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="bg-primary p-8 text-white relative">
                <button 
                  onClick={() => setShowMemberDonationModal(false)}
                  className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
                <h3 className="text-xl font-bold">Member Donation</h3>
                <p className="text-sm opacity-80">Record monthly donation for {selectedMember.name}</p>
              </div>
              
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  await onAddMemberDonation({
                    memberId: selectedMember.id,
                    memberName: selectedMember.name,
                    amount: Number(formData.get('amount')),
                    month: formData.get('month') as string,
                    date: new Date().toISOString(),
                    paymentMethod: formData.get('paymentMethod') as string,
                    transactionId: formData.get('transactionId') as string,
                    status: 'verified'
                  });
                  setShowMemberDonationModal(false);
                }}
                className="p-8 space-y-6"
              >
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Month</label>
                    <input 
                      type="month" 
                      name="month"
                      defaultValue={format(new Date(), 'yyyy-MM')}
                      required
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-transparent focus:border-primary focus:bg-white outline-none transition-all font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Amount</label>
                    <input 
                      type="number" 
                      name="amount"
                      placeholder="Enter amount"
                      required
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-transparent focus:border-primary focus:bg-white outline-none transition-all font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Payment Method</label>
                    <select 
                      name="paymentMethod"
                      required
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-transparent focus:border-primary focus:bg-white outline-none transition-all font-bold text-sm"
                    >
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Transaction ID (Optional)</label>
                    <input 
                      type="text" 
                      name="transactionId"
                      placeholder="Enter transaction ID"
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-transparent focus:border-primary focus:bg-white outline-none transition-all font-bold text-sm"
                    />
                  </div>
                </div>
                
                <button 
                  type="submit"
                  className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95"
                >
                  RECORD DONATION
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Public Donation Modal */}
      <AnimatePresence>
        {showPublicDonationModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="bg-primary p-8 text-white relative">
                <button 
                  onClick={() => setShowPublicDonationModal(false)}
                  className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
                <h3 className="text-xl font-bold">Public Donation</h3>
                <p className="text-sm opacity-80">Submit your donation record for verification</p>
              </div>
              
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  await onAddPublicDonation({
                    donorName: formData.get('donorName') as string,
                    donorPhone: formData.get('donorPhone') as string,
                    amount: Number(formData.get('amount')),
                    date: new Date().toISOString(),
                    paymentMethod: formData.get('paymentMethod') as string,
                    transactionId: formData.get('transactionId') as string,
                    message: formData.get('message') as string,
                    status: 'pending'
                  });
                  setShowPublicDonationModal(false);
                }}
                className="p-8 space-y-6"
              >
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Your Name</label>
                    <input 
                      type="text" 
                      name="donorName"
                      placeholder="Enter your name"
                      required
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-transparent focus:border-primary focus:bg-white outline-none transition-all font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <input 
                      type="tel" 
                      name="donorPhone"
                      placeholder="Enter phone number"
                      required
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-transparent focus:border-primary focus:bg-white outline-none transition-all font-bold text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Amount</label>
                      <input 
                        type="number" 
                        name="amount"
                        placeholder="Amount"
                        required
                        className="w-full p-4 bg-gray-50 rounded-2xl border border-transparent focus:border-primary focus:bg-white outline-none transition-all font-bold text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Method</label>
                      <select 
                        name="paymentMethod"
                        required
                        className="w-full p-4 bg-gray-50 rounded-2xl border border-transparent focus:border-primary focus:bg-white outline-none transition-all font-bold text-sm"
                      >
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Transaction ID</label>
                    <input 
                      type="text" 
                      name="transactionId"
                      placeholder="Enter transaction ID"
                      required
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-transparent focus:border-primary focus:bg-white outline-none transition-all font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Message (Optional)</label>
                    <textarea 
                      name="message"
                      placeholder="Your message..."
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-transparent focus:border-primary focus:bg-white outline-none transition-all font-bold text-sm h-24 resize-none"
                    />
                  </div>
                </div>
                
                <button 
                  type="submit"
                  className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95"
                >
                  SUBMIT RECORD
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Slideshow({ 
  images, 
  isAdmin, 
  onManage 
}: { 
  images: SlideshowImage[], 
  isAdmin: boolean, 
  onManage: () => void
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [images.length]);

  if (images.length === 0) {
    return isAdmin ? (
      <button 
        onClick={onManage}
        className="w-full h-64 rounded-[40px] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 transition-all group"
      >
        <ImageIcon size={48} className="mb-4 group-hover:scale-110 transition-transform" />
        <p className="font-bold">Add Slideshow Images</p>
      </button>
    ) : null;
  }

  return (
    <div className="relative w-full h-64 md:h-96 rounded-[40px] overflow-hidden shadow-2xl group">
      <AnimatePresence mode="wait">
        <motion.img
          key={images[currentIndex].id}
          src={images[currentIndex].url}
          alt={images[currentIndex].title || 'Slideshow'}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.8 }}
          className="w-full h-full object-cover"
        />
      </AnimatePresence>
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-8 md:p-12">
        {images[currentIndex].title && (
          <motion.h3 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-2xl md:text-4xl font-bold text-white mb-2"
          >
            {images[currentIndex].title}
          </motion.h3>
        )}
        {images[currentIndex].description && (
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-white/80 text-sm md:text-lg font-medium max-w-2xl line-clamp-2"
          >
            {images[currentIndex].description}
          </motion.p>
        )}
      </div>

      {isAdmin && (
        <button 
          onClick={onManage}
          className="absolute top-6 right-6 p-3 bg-white/20 backdrop-blur-md text-white rounded-2xl hover:bg-white/40 transition-all opacity-0 group-hover:opacity-100"
        >
          <Settings size={20} />
        </button>
      )}

      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                currentIndex === idx ? "w-8 bg-white" : "bg-white/40"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ManageSlideshowModal({ 
  images, 
  onClose, 
  onAdd, 
  onDelete 
}: { 
  images: SlideshowImage[], 
  onClose: () => void, 
  onAdd: (url: string, title?: string, description?: string) => void,
  onDelete: (id: string) => void
}) {
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert('Image size must be less than 500KB');
        return;
      }
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewImageUrl(reader.result as string);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdd = () => {
    if (!newImageUrl) return;
    onAdd(newImageUrl, newTitle, newDescription);
    setNewImageUrl(null);
    setNewTitle('');
    setNewDescription('');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="w-full max-w-4xl bg-white rounded-[40px] p-8 md:p-12 space-y-8 shadow-2xl my-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold">Manage Slideshow</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Add New Section */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900">Add New Image</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Photo</label>
                {newImageUrl ? (
                  <div className="relative rounded-3xl overflow-hidden border border-gray-100 group aspect-video">
                    <img src={newImageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => setNewImageUrl(null)}
                      className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-gray-200 rounded-3xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <ImageIcon size={48} className="text-gray-300 mb-4" />
                    <p className="text-sm text-gray-500 font-bold">Click to upload photo</p>
                    <p className="text-[10px] text-gray-400 mt-1">Max 500KB</p>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                  </label>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Title (Optional)</label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Image Title"
                  className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold text-gray-700 focus:border-primary/30 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Description (Optional)</label>
                <textarea 
                  rows={2}
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Short description..."
                  className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold text-gray-700 focus:border-primary/30 transition-colors resize-none"
                />
              </div>

              <button 
                disabled={!newImageUrl || isUploading}
                onClick={handleAdd}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-lg shadow-xl shadow-primary/30 hover:scale-[1.02] transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Uploading...' : 'Add to Slideshow'}
              </button>
            </div>
          </div>

          {/* Current Images Section */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900">Current Images ({images.length})</h3>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {images.map((img) => (
                <div key={img.id} className="flex gap-4 p-4 bg-gray-50 rounded-3xl border border-gray-100 group">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{img.title || 'No Title'}</p>
                    <p className="text-xs text-gray-400 line-clamp-2 mt-1">{img.description || 'No description'}</p>
                  </div>
                  <button 
                    onClick={() => onDelete(img.id)}
                    className="p-2 text-gray-300 hover:text-expense hover:bg-expense/10 rounded-xl transition-all self-center"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
              {images.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p className="font-medium">No images in slideshow</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function NewsView({ news, slideshow, onAddNews, onManageSlideshow, onDeleteNews, isAdmin }: { news: News[], slideshow: SlideshowImage[], onAddNews: () => void, onManageSlideshow: () => void, onDeleteNews: (id: string) => void, isAdmin: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-6 md:p-10 space-y-10"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">News</h1>
          <p className="text-gray-500 mt-2">Latest updates from CS Foundation</p>
        </div>
        {isAdmin && (
          <button 
            onClick={onAddNews}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform active:scale-95"
          >
            <Plus size={20} />
            <span>Add News</span>
          </button>
        )}
      </div>

      <Slideshow 
        images={slideshow} 
        isAdmin={isAdmin} 
        onManage={onManageSlideshow}
      />

      <div className="grid grid-cols-1 gap-4">
        {news.length === 0 ? (
          <div className="bg-white rounded-[32px] p-12 text-center border border-gray-100">
            <Newspaper size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-400 font-medium">No news updates yet.</p>
          </div>
        ) : (
          news.map((item) => (
            <NewsCard 
              key={item.id} 
              item={item} 
              isAdmin={isAdmin} 
              onDeleteNews={onDeleteNews} 
            />
          ))
        )}
      </div>
    </motion.div>
  );
}

function AddNewsModal({ onClose, onSubmit, authorName }: { onClose: () => void, onSubmit: (n: Omit<News, 'id' | 'userId'>) => void, authorName: string }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState(authorName);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert('Image size must be less than 500KB');
        return;
      }
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!title || !content || !author) return;
    const newsData: any = {
      title,
      content,
      author,
      date: new Date().toISOString()
    };
    if (imageUrl) newsData.imageUrl = imageUrl;
    onSubmit(newsData);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="w-full max-w-lg bg-white rounded-[40px] p-8 md:p-10 space-y-6 shadow-2xl my-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Add News Update</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <ChevronLeft className="rotate-90" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Title</label>
            <input 
              autoFocus
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="News Title"
              className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold text-gray-700 focus:border-primary/30 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Content</label>
            <textarea 
              rows={4}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write your news update here..."
              className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold text-gray-700 focus:border-primary/30 transition-colors resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Photo (Optional)</label>
            <div className="flex flex-col gap-3">
              {imageUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-gray-100 group">
                  <img src={imageUrl} alt="Preview" className="w-full h-40 object-cover" />
                  <button 
                    onClick={() => setImageUrl(undefined)}
                    className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-xs text-gray-500 font-medium">Click to upload photo</p>
                    <p className="text-[10px] text-gray-400 mt-1">Max 500KB</p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                </label>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Author Name</label>
            <input 
              type="text" 
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="Author Name"
              className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold text-gray-700 focus:border-primary/30 transition-colors"
            />
          </div>

          <button 
            disabled={isUploading}
            onClick={handleSubmit}
            className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-lg shadow-xl shadow-primary/30 hover:scale-[1.02] transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading...' : 'Publish News'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const DISTRICTS = ['Chittagong', 'Dhaka', 'Sylhet', 'Rajshahi', 'Khulna', 'Barisal', 'Rangpur', 'Mymensingh'];

function BloodDonorsView({ 
  donors, 
  onAddDonor, 
  onDeleteDonor, 
  onUpdateDonor,
  isAdmin,
  user,
  setConfirmModal
}: { 
  donors: Donor[], 
  onAddDonor: () => void, 
  onDeleteDonor: (id: string) => void, 
  onUpdateDonor: (id: string, data: Partial<Donor>) => void,
  isAdmin: boolean,
  user: any,
  setConfirmModal: React.Dispatch<React.SetStateAction<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>>
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('All');

  const bloodGroups = ['All', ...BLOOD_GROUPS];

  const getDonationStatus = (lastDonated?: string) => {
    if (!lastDonated) return { ready: true, text: 'Ready to Donate', subtext: 'Available' };
    
    const lastDate = parseISO(lastDonated);
    const today = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(today.getMonth() - 3);

    if (lastDate < threeMonthsAgo) {
      return { ready: true, text: 'Ready to Donate', subtext: 'Available' };
    } else {
      const diffTime = Math.abs(today.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const diffMonths = Math.floor(diffDays / 30);
      
      let timeText = '';
      if (diffMonths > 0) {
        timeText = `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
      } else {
        timeText = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      }

      return { 
        ready: false, 
        text: `Last Donation: ${timeText}`, 
        subtext: 'Hidden',
        canDonateText: "Can't Donate Now !"
      };
    }
  };

  const filteredDonors = donors.filter(d => {
    const status = getDonationStatus(d.lastDonated);
    const isOwnProfile = user?.uid === d.userId;
    const isVisible = status.ready || isAdmin || isOwnProfile;
    
    if (!isVisible) return false;

    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         d.phoneNumber.includes(searchTerm) ||
                         d.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGroup = selectedGroup === 'All' || d.bloodGroup === selectedGroup;
    const matchesDistrict = selectedDistrict === 'All' || d.district === selectedDistrict;
    return matchesSearch && matchesGroup && matchesDistrict;
  });

  const handleMarkAsDonated = (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Donated Today',
      message: 'Are you sure you want to mark this donor as "Donated Today"? They will be hidden for 3 months.',
      onConfirm: async () => {
        await onUpdateDonor(id, { lastDonated: new Date().toISOString() });
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col h-full bg-[#F5F5F5]"
    >
      {/* Header matching screenshot */}
      <div className="bg-[#D32F2F] p-4 flex items-center justify-between shadow-lg relative z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => window.history.back()} className="text-white p-1">
            <ChevronLeft size={32} />
          </button>
          <div className="relative">
            <select 
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="bg-transparent text-white font-bold text-lg outline-none appearance-none pr-8 cursor-pointer"
            >
              <option value="All" className="text-gray-900">Select District</option>
              {DISTRICTS.map(d => <option key={d} value={d} className="text-gray-900">{d}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-white pointer-events-none" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search size={24} className="text-white" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              placeholder="Search..."
            />
          </div>
          <button 
            onClick={onAddDonor}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      {/* Blood Group Filter */}
      <div className="bg-white p-2 flex gap-2 overflow-x-auto no-scrollbar shadow-sm border-b border-gray-100">
        {bloodGroups.map(group => (
          <button
            key={group}
            onClick={() => setSelectedGroup(group)}
            className={cn(
              "px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all",
              selectedGroup === group ? "bg-[#D32F2F] text-white shadow-md" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            )}
          >
            {group}
          </button>
        ))}
      </div>

      {/* Donor List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredDonors.map((donor) => {
          const status = getDonationStatus(donor.lastDonated);
          const isOwnProfile = user?.uid === donor.userId;

          return (
            <motion.div 
              layout
              key={donor.id}
              className="bg-white rounded-lg shadow-sm border border-gray-100 flex overflow-hidden group"
            >
              {/* Left: Blood Group */}
              <div className="w-20 bg-[#D32F2F] flex items-center justify-center text-white font-bold text-3xl">
                {donor.bloodGroup}
              </div>

              {/* Center: Info */}
              <div className="flex-1 p-3 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white">
                        <UserIcon size={12} />
                      </div>
                      <h3 className="font-bold text-[#D32F2F] uppercase text-sm">{donor.name}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Building2 size={14} className="text-gray-400" />
                      <span className="text-xs font-medium">{donor.district || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Activity size={14} className="text-gray-400" />
                      <span className="text-xs font-medium">{status.text}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-gray-400" />
                      <span className={cn(
                        "text-xs font-bold",
                        status.ready ? "text-green-600" : "text-gray-400"
                      )}>
                        {status.subtext}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    {(isAdmin || isOwnProfile) && (
                      <button 
                        onClick={() => onDeleteDonor(donor.id)}
                        className="p-1 text-gray-300 hover:text-[#D32F2F] transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <a 
                      href={`tel:${donor.phoneNumber}`}
                      className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white shadow-md hover:scale-110 transition-transform"
                    >
                      <Phone size={20} />
                    </a>
                  </div>
                </div>

                {/* Bottom Action for User/Admin */}
                {(isOwnProfile || isAdmin) && status.ready && (
                  <button 
                    onClick={() => handleMarkAsDonated(donor.id)}
                    className="mt-2 w-full py-1.5 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-blue-100 transition-colors"
                  >
                    Mark as Donated Today
                  </button>
                )}
                {!status.ready && (
                  <div className="mt-2 w-full py-1.5 bg-gray-50 text-gray-400 rounded-md text-[10px] font-bold uppercase tracking-wider text-center">
                    {status.canDonateText}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {filteredDonors.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-300">
              <Search size={24} />
            </div>
            <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">No donors found</p>
          </div>
        )}
      </div>

      {/* Floating Add Button for Mobile if not using header button */}
      <button 
        onClick={onAddDonor}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#D32F2F] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95 z-30 md:hidden"
      >
        <Plus size={28} />
      </button>
    </motion.div>
  );
}

function AddDonorModal({ onClose, onSubmit }: { onClose: () => void, onSubmit: (d: Omit<Donor, 'id' | 'joinedDate' | 'userId'>) => void }) {
  const [name, setName] = useState('');
  const [bloodGroup, setBloodGroup] = useState('A+');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState(DISTRICTS[0]);
  const [lastDonated, setLastDonated] = useState('');

  const handleSubmit = () => {
    if (!name || !phoneNumber || !address || !district) {
      alert('Please fill in all required fields');
      return;
    }
    const donorData: any = {
      name,
      bloodGroup,
      phoneNumber,
      address,
      district,
    };
    if (lastDonated) donorData.lastDonated = lastDonated;
    onSubmit(donorData);
  };

  const bloodGroups = BLOOD_GROUPS;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white w-full max-w-lg rounded-[48px] p-10 shadow-2xl relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-expense/5 rounded-full -mr-16 -mt-16" />
        
        <div className="flex items-center justify-between mb-10 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-expense/10 flex items-center justify-center text-expense">
              <Droplet size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Become a Donor</h2>
              <p className="text-sm text-gray-400 font-medium">Join our life-saving community.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-2xl transition-colors">
            <Plus className="rotate-45 text-gray-400" size={24} />
          </button>
        </div>

        <div className="space-y-6 relative z-10">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Full Name</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold text-gray-700 focus:border-primary/30 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Blood Group</label>
              <select 
                value={bloodGroup}
                onChange={e => setBloodGroup(e.target.value)}
                className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold text-gray-700 focus:border-primary/30 transition-colors appearance-none"
              >
                {bloodGroups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Phone Number</label>
              <input 
                type="tel" 
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="01XXX-XXXXXX"
                className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold text-gray-700 focus:border-primary/30 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">District</label>
            <select 
              value={district}
              onChange={e => setDistrict(e.target.value)}
              className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold text-gray-700 focus:border-primary/30 transition-colors appearance-none"
            >
              {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Address</label>
            <input 
              type="text" 
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Enter your current address"
              className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold text-gray-700 focus:border-primary/30 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Last Donation Date (Optional)</label>
            <input 
              type="date" 
              value={lastDonated}
              onChange={e => setLastDonated(e.target.value)}
              className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold text-gray-700 focus:border-primary/30 transition-colors"
            />
          </div>

          <button 
            onClick={handleSubmit}
            className="w-full py-4 bg-expense text-white rounded-2xl font-bold text-lg shadow-xl shadow-expense/30 hover:scale-[1.02] transition-transform active:scale-95 mt-4"
          >
            Register as Donor
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function FoundationRulesView({ rules, isAdmin, onAddRule, onDeleteRule }: { 
  rules: FoundationRule[], 
  isAdmin: boolean, 
  onAddRule: () => void, 
  onDeleteRule: (id: string) => void 
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-24"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/5">
            <ScrollText size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Foundation Rules</h2>
            <p className="text-sm text-gray-400 font-medium">Official guidelines and documentation.</p>
          </div>
        </div>
        {isAdmin && (
          <button 
            onClick={onAddRule}
            className="p-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform active:scale-95"
          >
            <Plus size={24} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rules.map(rule => (
          <motion.div 
            key={rule.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-[32px] shadow-xl border border-gray-100 group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
            
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-primary">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 group-hover:text-primary transition-colors">{rule.title}</h3>
                  <p className="text-xs text-gray-400 font-medium">Uploaded by {rule.uploadedBy} • {format(parseISO(rule.date), 'MMM d, yyyy')}</p>
                </div>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => onDeleteRule(rule.id)}
                  className="p-2 text-gray-300 hover:text-expense hover:bg-expense/5 rounded-xl transition-all"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>

            <div className="mt-6 flex items-center gap-3 relative z-10">
              <a 
                href={rule.pdfData} 
                download={`${rule.title}.pdf`}
                className="flex-1 py-3 bg-gray-50 text-gray-600 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/10 hover:text-primary transition-all"
              >
                <Download size={16} />
                Download PDF
              </a>
              <button 
                onClick={() => {
                  const win = window.open();
                  if (win) {
                    win.document.write(`<iframe src="${rule.pdfData}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                  }
                }}
                className="flex-1 py-3 bg-primary/5 text-primary rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/10 transition-all"
              >
                <Search size={16} />
                View Online
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {rules.length === 0 && (
        <div className="text-center py-20 bg-white rounded-[48px] border-2 border-dashed border-gray-100">
          <div className="w-20 h-20 rounded-3xl bg-gray-50 flex items-center justify-center mx-auto mb-4 text-gray-300">
            <ScrollText size={40} />
          </div>
          <h3 className="text-xl font-bold text-gray-900">No rules uploaded yet</h3>
          <p className="text-gray-400 font-medium">Foundation guidelines will appear here.</p>
        </div>
      )}
    </motion.div>
  );
}

function AddRuleModal({ onClose, onSubmit }: { onClose: () => void, onSubmit: (title: string, pdfData: string) => void }) {
  const [title, setTitle] = useState('');
  const [pdfData, setPdfData] = useState('');
  const [fileName, setFileName] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Please select a PDF file');
        return;
      }
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setPdfData(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!title || !pdfData) {
      alert('Please provide a title and select a PDF file');
      return;
    }
    onSubmit(title, pdfData);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white w-full max-w-lg rounded-[48px] p-10 shadow-2xl relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16" />
        
        <div className="flex items-center justify-between mb-10 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <ScrollText size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Upload Rule</h2>
              <p className="text-sm text-gray-400 font-medium">Add a new foundation guideline.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-2xl transition-colors">
            <Plus className="rotate-45 text-gray-400" size={24} />
          </button>
        </div>

        <div className="space-y-6 relative z-10">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Rule Title</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Foundation Constitution"
              className="w-full p-4 rounded-2xl border border-gray-100 outline-none bg-gray-50 font-bold text-gray-700 focus:border-primary/30 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">PDF File</label>
            <div className="relative">
              <input 
                type="file" 
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id="pdf-upload"
              />
              <label 
                htmlFor="pdf-upload"
                className="w-full p-8 rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-gray-400 group-hover:text-primary shadow-sm transition-colors">
                  <Upload size={24} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-700">{fileName || 'Click to select PDF'}</p>
                  <p className="text-xs text-gray-400 font-medium">Maximum size 1MB</p>
                </div>
              </label>
            </div>
          </div>

          <button 
            onClick={handleSubmit}
            className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95 mt-4"
          >
            Upload Document
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
