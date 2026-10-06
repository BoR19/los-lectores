import React, { useState, useRef } from 'react';
import { 
  Users, 
  Camera, 
  FileText, 
  LayoutDashboard, 
  LogOut, 
  Plus, 
  Search, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Share2, 
  Download,
  Menu,
  X,
  ChevronRight,
  Phone,
  MapPin,
  Droplets,
  MessageSquare,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Pencil,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import { Timestamp } from 'firebase/firestore';
import { auth } from './firebase';
import { useFirebase } from './hooks/useFirebase';
import { extractMeterReading } from './services/geminiService';
import { Button, Card, Input, Badge, Modal } from './components/UI';
import { User, Reading, Invoice } from './types';
import { cn } from './lib/utils';

type View = 'dashboard' | 'users' | 'readings' | 'billing' | 'public-consultation';

export default function App() {
  const { 
    users, readings, invoices, currentUser, loading, 
    addUser, updateUser, deleteUser, addReading, addInvoice, updateInvoiceStatus,
    login, register, resetPassword, loginWithGoogle, logout,
    findUserByCustomerAndMeter, getInvoicesByUserId
  } = useFirebase();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [capturedReading, setCapturedReading] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ 
    name: '', 
    username: '',
    email: '',
    address: '', 
    phone: '', 
    role: 'user' as const,
    lastReadingValue: 0,
    lastReadingDate: ''
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Consultation state
  const [consultationCustomerNumber, setConsultationCustomerNumber] = useState('');
  const [consultationMeterId, setConsultationMeterId] = useState('');
  const [consultationResult, setConsultationResult] = useState<{ user: User, invoices: Invoice[] } | null>(null);
  const [consultationLoading, setConsultationLoading] = useState(false);
  const [consultationError, setConsultationError] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';
  const isLecturador = currentUser?.role === 'lecturador' || isAdmin;

  // Redirection logic based on role
  React.useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'admin') setCurrentView('dashboard');
      else if (currentUser.role === 'lecturador') setCurrentView('readings');
      else setCurrentView('users'); // Mi Perfil
    }
  }, [currentUser]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditingUser && editingUserId) {
        await updateUser(editingUserId, newUser);
      } else {
        await addUser(newUser);
      }
      setIsUserModalOpen(false);
      setIsEditingUser(false);
      setEditingUserId(null);
      setNewUser({ name: '', username: '', email: '', address: '', phone: '', role: 'user', lastReadingValue: 0, lastReadingDate: '' });
    } catch (err) {
      console.error('Error saving user:', err);
    }
  };

  const handleEditUser = (user: User) => {
    setNewUser({
      name: user.name,
      username: user.username || '',
      email: user.email || '',
      address: user.address,
      phone: user.phone,
      role: user.role,
      lastReadingValue: user.lastReadingValue || 0,
      lastReadingDate: user.lastReadingDate || ''
    });
    setEditingUserId(user.id);
    setIsEditingUser(true);
    setIsUserModalOpen(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('¿Estás seguro de eliminar este usuario?')) {
      try {
        await deleteUser(userId);
      } catch (err) {
        console.error('Error deleting user:', err);
      }
    }
  };

  const startCamera = async () => {
    setIsCameraModalOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      // Fallback to file input if camera fails
      fileInputRef.current?.click();
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraModalOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      stopCamera();
      handleCapture(dataUrl);
    }
  };

  const handleCapture = async (imageData: string) => {
    setOcrLoading(true);
    try {
      const extractedValue = await extractMeterReading(imageData);
      setCapturedReading(Number(extractedValue));
    } catch (err) {
      console.error('OCR Error:', err);
    } finally {
      setOcrLoading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleCapture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveReading = async () => {
    if (!selectedUser || capturedReading === null) return;
    
    try {
      const lastReading = readings.find(r => r.userId === selectedUser.id);
      const previousValue = lastReading ? lastReading.value : (selectedUser.lastReadingValue || 0);
      
      if (capturedReading < previousValue) {
        alert(`Error: La lectura actual (${capturedReading}) no puede ser menor que la anterior (${previousValue}).`);
        return;
      }
      
      const consumption = capturedReading - previousValue;
      const finalConsumption = Math.max(0, consumption);
      
      const readingId = await addReading({
        userId: selectedUser.id,
        lecturadorId: currentUser!.id,
        value: capturedReading,
        date: Timestamp.now(),
        previousValue: previousValue,
        consumption: finalConsumption
      });

      // Update user historical data automatically
      await updateUser(selectedUser.id, {
        lastReadingValue: capturedReading,
        lastReadingDate: format(new Date(), 'yyyy-MM-dd')
      });

      // Auto generate invoice
      const tariff = 1; // 1 Bs per m3
      await addInvoice({
        userId: selectedUser.id,
        readingId: readingId,
        amount: finalConsumption * tariff,
        status: 'pending',
        date: Timestamp.now(),
        dueDate: Timestamp.fromDate(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)),
        consumption: finalConsumption
      });

      setCapturedReading(null);
      setSelectedUser(null);
      setCurrentView('billing');
    } catch (err) {
      console.error('Error saving reading:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-slate-600 font-medium">Cargando AquaRead...</p>
        </div>
      </div>
    );
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginLoading) return;
    setLoginLoading(true);
    setLoginError(null);
    try {
      if (authMode === 'login') {
        await login(email, password);
      } else if (authMode === 'register') {
        await register(email, password, name);
      } else {
        await resetPassword(email);
        setLoginError('Se ha enviado un correo para restablecer tu contraseña.');
        setAuthMode('login');
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      setLoginError(error.message || 'Ocurrió un error. Por favor, intenta de nuevo.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (loginLoading) return;
    setLoginLoading(true);
    setLoginError(null);
    try {
      await loginWithGoogle();
    } catch (error: any) {
      console.error("Google Login Error:", error);
      setLoginError('Error al iniciar sesión con Google.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    setConsultationLoading(true);
    setConsultationError(null);
    setConsultationResult(null);
    try {
      const user = await findUserByCustomerAndMeter(consultationCustomerNumber, consultationMeterId);
      if (user) {
        const userInvoices = await getInvoicesByUserId(user.id);
        setConsultationResult({ user, invoices: userInvoices });
      } else {
        setConsultationError('Datos incorrectos. Por favor verifique su número de cliente y medidor.');
      }
    } catch (err) {
      console.error('Error in consultation:', err);
      setConsultationError('Ocurrió un error al consultar la deuda.');
    } finally {
      setConsultationLoading(false);
    }
  };

  if (!currentUser && currentView !== 'public-consultation') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 p-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="inline-flex p-4 bg-blue-100 rounded-2xl mb-4">
              <Droplets className="h-10 w-10 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">AquaRead</h1>
            <p className="text-slate-500">
              {authMode === 'login' ? 'Inicia sesión en tu cuenta' : 
               authMode === 'register' ? 'Crea una cuenta nueva' : 
               'Restablecer contraseña'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 ml-1">Nombre</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input 
                    required
                    placeholder="Tu nombre"
                    className="pl-10 h-12 rounded-xl"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 ml-1">Usuario o Correo</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input 
                  required
                  placeholder="usuario123"
                  className="pl-10 h-12 rounded-xl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {authMode !== 'forgot' && (
              <div className="space-y-1">
                <div className="flex justify-between items-center px-1">
                  <label className="text-sm font-semibold text-slate-700">Contraseña</label>
                  {authMode === 'login' && (
                    <button 
                      type="button"
                      onClick={() => setAuthMode('forgot')}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input 
                    required
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-12 rounded-xl"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}

            {loginError && (
              <div className={cn(
                "p-3 rounded-lg text-sm",
                loginError.includes('enviado') ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-red-50 text-red-600 border border-red-100"
              )}>
                {loginError}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 text-lg font-bold rounded-xl mt-2"
              loading={loginLoading}
            >
              {authMode === 'login' ? 'Iniciar sesión' : 
               authMode === 'register' ? 'Registrarse' : 
               'Enviar enlace'}
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500 uppercase tracking-wider text-xs font-bold">Otras opciones</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              variant="outline" 
              className="w-full h-12 rounded-xl flex items-center justify-center gap-3 font-semibold"
              onClick={handleGoogleLogin}
              disabled={loginLoading}
            >
              <img src="https://www.google.com/favicon.ico" className="h-5 w-5" alt="Google" />
              Acceso Administrador (Google)
            </Button>
            
            <Button 
              variant="ghost" 
              className="w-full h-12 rounded-xl flex items-center justify-center gap-3 font-bold text-blue-600"
              onClick={() => setCurrentView('public-consultation')}
            >
              <Search className="h-5 w-5" />
              Consultar mi deuda
            </Button>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500">
              {authMode === 'login' ? (
                <>¿No tienes una cuenta? <button onClick={() => setAuthMode('register')} className="text-blue-600 font-bold hover:underline">Regístrate</button></>
              ) : (
                <>¿Ya tienes una cuenta? <button onClick={() => setAuthMode('login')} className="text-blue-600 font-bold hover:underline">Inicia sesión</button></>
              )}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (currentView === 'public-consultation' && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 md:p-8">
        <div className="w-full max-w-2xl space-y-8">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="h-8 w-8 text-blue-600" />
              <span className="font-bold text-2xl text-slate-900">AquaRead</span>
            </div>
            <Button variant="ghost" onClick={() => setCurrentView('dashboard')}>
              <LogOut className="h-4 w-4 mr-2" />
              Volver al Login
            </Button>
          </header>

          <Card className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-slate-900">Consulta de Deuda</h1>
              <p className="text-slate-500">Ingresa tus datos para ver tus facturas pendientes</p>
            </div>

            <form onSubmit={handleConsultation} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Número de Cliente</label>
                  <Input 
                    required
                    placeholder="Ej: CL-0001"
                    className="h-14 text-lg rounded-2xl"
                    value={consultationCustomerNumber}
                    onChange={(e) => setConsultationCustomerNumber(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Número de Medidor</label>
                  <Input 
                    required
                    placeholder="Ej: MD-1001"
                    className="h-14 text-lg rounded-2xl"
                    value={consultationMeterId}
                    onChange={(e) => setConsultationMeterId(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              {consultationError && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                  {consultationError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  type="submit" 
                  className="flex-1 h-14 text-lg font-bold rounded-2xl"
                  loading={consultationLoading}
                >
                  Consultar Deuda
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="h-14 text-lg font-bold rounded-2xl px-8"
                  onClick={() => {
                    setConsultationCustomerNumber('');
                    setConsultationMeterId('');
                    setConsultationResult(null);
                    setConsultationError(null);
                  }}
                >
                  Limpiar
                </Button>
              </div>
            </form>
          </Card>

          <AnimatePresence>
            {consultationResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card className="p-6 bg-blue-600 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">Cliente</p>
                      <h2 className="text-2xl font-bold">{consultationResult.user.name}</h2>
                      <p className="text-blue-100 text-sm mt-1">{consultationResult.user.address}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-100 text-sm">Deuda Total</p>
                      <p className="text-4xl font-black">
                        {consultationResult.invoices
                          .filter(i => i.status === 'pending')
                          .reduce((acc, curr) => acc + curr.amount, 0)
                          .toFixed(2)} Bs
                      </p>
                    </div>
                  </div>
                </Card>

                <Card title="Detalle de Facturas">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">Periodo</th>
                          <th className="px-6 py-4 font-semibold">Consumo</th>
                          <th className="px-6 py-4 font-semibold">Importe</th>
                          <th className="px-6 py-4 font-semibold">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {consultationResult.invoices.map(invoice => (
                          <tr key={invoice.id}>
                            <td className="px-6 py-4">
                              <p className="text-sm font-semibold text-slate-900">{format(invoice.date.toDate(), 'MMMM yyyy', { locale: es })}</p>
                              <p className="text-xs text-slate-500">Vence: {format(invoice.dueDate?.toDate() || new Date(), 'dd/MM/yyyy')}</p>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">{invoice.consumption} m³</td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-900">{invoice.amount.toFixed(2)} Bs</td>
                            <td className="px-6 py-4">
                              <Badge variant={invoice.status === 'paid' ? 'success' : 'warning'}>
                                {invoice.status === 'paid' ? 'Pagada' : 'Pendiente'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                        {consultationResult.invoices.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No se encontraron facturas.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  const handleLogout = () => logout();

  const generatePDF = (invoice: Invoice, user: User) => {
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 150] // Thermal ticket size
    });

    doc.setFontSize(14);
    doc.text('AQUAREAD - RECIBO', 40, 10, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Comunidad de Agua', 40, 15, { align: 'center' });
    doc.line(5, 20, 75, 20);

    doc.text(`Factura #: ${invoice.id.slice(0, 8)}`, 5, 30);
    doc.text(`Fecha: ${format(invoice.date.toDate(), 'dd/MM/yyyy')}`, 5, 35);
    doc.text(`Cliente: ${user.name}`, 5, 42);
    doc.text(`N° Cliente: ${user.customerNumber || 'N/A'}`, 5, 47);
    doc.text(`Medidor: ${user.meterId || 'N/A'}`, 5, 52);
    doc.text(`Dirección: ${user.address}`, 5, 57);

    doc.line(5, 65, 75, 65);
    doc.text('CONCEPTO', 5, 75);
    doc.text('CANT', 45, 75);
    doc.text('TOTAL', 65, 75);
    
    doc.text('Consumo Agua', 5, 85);
    doc.text(`${invoice.consumption} m3`, 45, 85);
    doc.text(`${invoice.amount.toFixed(2)} Bs`, 65, 85);

    doc.line(5, 95, 75, 95);
    doc.setFontSize(12);
    doc.text(`TOTAL A PAGAR: ${invoice.amount.toFixed(2)} Bs`, 40, 105, { align: 'center' });
    
    doc.setFontSize(8);
    doc.text('¡Gracias por su pago puntual!', 40, 120, { align: 'center' });
    doc.text('Vencimiento: ' + format(invoice.dueDate?.toDate() || new Date(), 'dd/MM/yyyy'), 40, 125, { align: 'center' });

    doc.save(`Factura_${user.name}_${invoice.id.slice(0, 8)}.pdf`);
  };

  const shareWhatsApp = (invoice: Invoice, user: User) => {
    const message = `Hola ${user.name}, tu factura de agua de AquaRead está lista.\n\n` +
      `Consumo: ${invoice.consumption} m3\n` +
      `Total: ${invoice.amount.toFixed(2)} Bs\n` +
      `Estado: ${invoice.status === 'paid' ? 'PAGADA' : 'PENDIENTE'}\n` +
      `Vencimiento: ${format(invoice.dueDate?.toDate() || new Date(), 'dd/MM/yyyy')}\n\n` +
      `Por favor, realiza tu pago a la brevedad. ¡Gracias!`;
    
    const url = `https://wa.me/${user.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.meterId && u.meterId.includes(searchTerm))
  );

  const stats = {
    totalUsers: users.length,
    pendingInvoices: invoices.filter(i => i.status === 'pending').length,
    paidInvoices: invoices.filter(i => i.status === 'paid').length,
    totalIncome: invoices.filter(i => i.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0),
  };

  const chartData = readings.slice(0, 6).reverse().map(r => ({
    date: format(r.date.toDate(), 'MMM', { locale: es }),
    consumo: r.consumption || 0
  }));

  const SidebarItem = ({ icon: Icon, label, view }: { icon: any, label: string, view: View }) => (
    <button
      onClick={() => {
        setCurrentView(view);
        setIsSidebarOpen(false);
      }}
      className={cn(
        'flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200',
        currentView === view 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
          : 'text-slate-600 hover:bg-slate-100'
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="font-medium">{label}</span>
      {currentView === view && <ChevronRight className="h-4 w-4 ml-auto" />}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Droplets className="h-6 w-6 text-blue-600" />
          <span className="font-bold text-xl text-slate-900">AquaRead</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {(isSidebarOpen || window.innerWidth >= 768) && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={cn(
              "fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 p-6 flex flex-col gap-8 md:sticky md:h-screen",
              !isSidebarOpen && "hidden md:flex"
            )}
          >
            <div className="hidden md:flex items-center gap-3 px-2">
              <div className="p-2 bg-blue-600 rounded-xl">
                <Droplets className="h-6 w-6 text-white" />
              </div>
              <span className="font-bold text-2xl text-slate-900">AquaRead</span>
            </div>

    <nav className="flex flex-col gap-2 flex-1">
      {isAdmin && <SidebarItem icon={LayoutDashboard} label="Dashboard" view="dashboard" />}
      <SidebarItem icon={Users} label={isAdmin ? "Usuarios" : "Mi Perfil"} view="users" />
      {isLecturador && <SidebarItem icon={Camera} label="Lecturas" view="readings" />}
      <SidebarItem icon={FileText} label="Facturación" view="billing" />
    </nav>

            <div className="pt-6 border-t border-slate-100">
              <div className="flex items-center gap-3 px-2 mb-6">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                  {currentUser.name[0]}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-900">{currentUser.name}</span>
                  <span className="text-xs text-slate-500 capitalize">{currentUser.role}</span>
                </div>
              </div>
              <Button variant="outline" className="w-full justify-start text-red-600 border-red-100 hover:bg-red-50" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar sesión
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {currentView === 'dashboard' && isAdmin && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <header>
                <h1 className="text-3xl font-bold text-slate-900">Bienvenido, {currentUser.name}</h1>
                <p className="text-slate-500">Resumen general de la comunidad</p>
              </header>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 flex items-center gap-4">
                  <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><Users /></div>
                  <div>
                    <p className="text-sm text-slate-500">Usuarios</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.totalUsers}</p>
                  </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                  <div className="p-3 bg-amber-50 rounded-xl text-amber-600"><Clock /></div>
                  <div>
                    <p className="text-sm text-slate-500">Pendientes</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.pendingInvoices}</p>
                  </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600"><CheckCircle2 /></div>
                  <div>
                    <p className="text-sm text-slate-500">Pagadas</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.paidInvoices}</p>
                  </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                  <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600"><TrendingUp /></div>
                  <div>
                    <p className="text-sm text-slate-500">Ingresos</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.totalIncome.toFixed(0)} Bs</p>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card title="Consumo Mensual (m³)">
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="consumo" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card title="Últimas Lecturas">
                  <div className="space-y-4">
                    {readings.slice(0, 5).map(reading => {
                      const user = users.find(u => u.id === reading.userId);
                      return (
                        <div key={reading.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                              <Camera className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{user?.name || 'Usuario'}</p>
                              <p className="text-xs text-slate-500">{format(reading.date.toDate(), 'PPp', { locale: es })}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-blue-600">{reading.value} m³</p>
                            <p className="text-xs text-slate-400">Lectura actual</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </motion.div>
          )}

          {currentView === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">{isAdmin ? "Usuarios" : "Mi Perfil"}</h1>
                  <p className="text-slate-500">{isAdmin ? "Administra los clientes de la comunidad" : "Información de tu cuenta"}</p>
                </div>
                {isAdmin && (
                  <Button onClick={() => setIsUserModalOpen(true)} className="sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Usuario
                  </Button>
                )}
              </div>

              <Card className="p-0">
                <div className="p-4 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Buscar por nombre o medidor..." 
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="px-6 py-4 font-semibold">Nombre / Dirección</th>
                        <th className="px-6 py-4 font-semibold">Medidor</th>
                        <th className="px-6 py-4 font-semibold">Teléfono</th>
                        {(isLecturador || isAdmin) && <th className="px-6 py-4 font-semibold text-right">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map(user => (
                        <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {user.address}
                            </p>
                            <div className="flex gap-2 mt-1">
                              {user.customerNumber && <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-100">{user.customerNumber}</Badge>}
                              {user.username && <p className="text-[10px] text-blue-500 font-mono">@{user.username}</p>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-600 font-mono">{user.meterId || 'N/A'}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {user.phone}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isLecturador && (
                                <Button variant="ghost" size="sm" onClick={() => {
                                  setSelectedUser(user);
                                  setCurrentView('readings');
                                }}>
                                  Lectura
                                </Button>
                              )}
                              {isAdmin && (
                                <>
                                  <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDeleteUser(user.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {currentView === 'readings' && isLecturador && (
            <motion.div
              key="readings"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="text-center">
                <h1 className="text-3xl font-bold text-slate-900">Nueva Lectura</h1>
                <p className="text-slate-500">Captura la imagen del medidor para procesar</p>
              </div>

              {selectedUser ? (
                <Card className="p-6 border-blue-200 bg-blue-50/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                        {selectedUser.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{selectedUser.name}</h3>
                        <p className="text-sm text-slate-500">Medidor: {selectedUser.meterId}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>Cambiar</Button>
                  </div>
                </Card>
              ) : (
                <Card className="p-8 text-center border-dashed border-2">
                  <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 mb-4">Selecciona un usuario primero</p>
                  <Button onClick={() => setCurrentView('users')}>Ir a Usuarios</Button>
                </Card>
              )}

              {selectedUser && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Button 
                      className="h-32 flex flex-col gap-2 text-lg" 
                      onClick={startCamera}
                    >
                      <Camera className="h-8 w-8" />
                      Abrir Cámara
                    </Button>
                    <div className="relative">
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={onFileChange}
                      />
                      <Button 
                        variant="outline" 
                        className="h-32 w-full flex flex-col gap-2 text-lg"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImageIcon className="h-8 w-8" />
                        Subir Imagen
                      </Button>
                    </div>
                  </div>

                  {ocrLoading && (
                    <Card className="p-8 flex flex-col items-center gap-4">
                      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                      <p className="text-slate-600 font-medium">Analizando imagen con IA...</p>
                    </Card>
                  )}

                  {capturedReading !== null && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      <Card className="p-6 space-y-6">
                        <div className="text-center">
                          <p className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-2">Lectura Detectada</p>
                          <div className="relative inline-block">
                            <Input 
                              type="number" 
                              value={capturedReading} 
                              onChange={(e) => setCapturedReading(Number(e.target.value))}
                              className="text-4xl font-bold text-center h-20 w-48 bg-slate-50 border-none focus:ring-0"
                            />
                            <div className="absolute -right-8 bottom-4 text-slate-400 font-bold">m³</div>
                          </div>
                        </div>

                        <div className="flex gap-4">
                          <Button variant="outline" className="flex-1" onClick={() => setCapturedReading(null)}>Reintentar</Button>
                          <Button className="flex-1" onClick={handleSaveReading}>Guardar Lectura</Button>
                        </div>
                      </Card>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {currentView === 'billing' && (
            <motion.div
              key="billing"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Facturación</h1>
                <p className="text-slate-500">Historial de facturas y estados de pago</p>
              </div>

              <Card className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="px-6 py-4 font-semibold">Usuario</th>
                        <th className="px-6 py-4 font-semibold">Consumo</th>
                        <th className="px-6 py-4 font-semibold">Monto</th>
                        <th className="px-6 py-4 font-semibold">Estado</th>
                        <th className="px-6 py-4 font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.map(invoice => {
                        const user = users.find(u => u.id === invoice.userId);
                        return (
                          <tr key={invoice.id}>
                            <td className="px-6 py-4">
                              <p className="text-sm font-semibold text-slate-900">{user?.name || 'Usuario'}</p>
                              <p className="text-xs text-slate-500">{format(invoice.date.toDate(), 'PP', { locale: es })}</p>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">{invoice.consumption} m³</td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-900">{invoice.amount.toFixed(2)} Bs</td>
                            <td className="px-6 py-4">
                              <Badge variant={invoice.status === 'paid' ? 'success' : 'warning'}>
                                {invoice.status === 'paid' ? 'Pagada' : 'Pendiente'}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" onClick={() => generatePDF(invoice, user!)}>
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => shareWhatsApp(invoice, user!)}>
                                  <MessageSquare className="h-4 w-4" />
                                </Button>
                                {isAdmin && invoice.status === 'pending' && (
                                  <Button variant="outline" size="sm" onClick={() => updateInvoiceStatus(invoice.id, 'paid')}>
                                    Cobrar
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <Modal 
        isOpen={isUserModalOpen} 
        onClose={() => {
          setIsUserModalOpen(false);
          setIsEditingUser(false);
          setEditingUserId(null);
          setNewUser({ name: '', username: '', email: '', address: '', phone: '', role: 'user', lastReadingValue: 0, lastReadingDate: '' });
        }} 
        title={isEditingUser ? "Editar Usuario" : "Nuevo Usuario"}
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {isEditingUser && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">N° Cliente</p>
                <p className="text-sm font-mono font-bold text-blue-600">{(users.find(u => u.id === editingUserId))?.customerNumber || 'Pendiente'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID Medidor</p>
                <p className="text-sm font-mono font-bold text-slate-600">{(users.find(u => u.id === editingUserId))?.meterId || 'Pendiente'}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Completo</label>
              <Input 
                required
                value={newUser.name}
                onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                placeholder="Ej: Juan Pérez"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Usuario (Username)</label>
              <Input 
                required
                value={newUser.username}
                onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                placeholder="juan123"
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Lectura Anterior</label>
              <Input 
                type="number"
                value={newUser.lastReadingValue}
                onChange={(e) => setNewUser({...newUser, lastReadingValue: Number(e.target.value)})}
                placeholder="0"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Fecha Última Lectura</label>
              <Input 
                type="date"
                value={newUser.lastReadingDate}
                onChange={(e) => setNewUser({...newUser, lastReadingDate: e.target.value})}
                className="rounded-xl"
                required={newUser.lastReadingValue > 0}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Correo Electrónico (Opcional)</label>
            <Input 
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({...newUser, email: e.target.value})}
              placeholder="correo@ejemplo.com"
              className="rounded-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Dirección</label>
            <Input 
              required
              value={newUser.address}
              onChange={(e) => setNewUser({...newUser, address: e.target.value})}
              placeholder="Calle Principal #123"
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Teléfono</label>
              <Input 
                required
                value={newUser.phone}
                onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                placeholder="999888777"
                className="rounded-xl"
              />
            </div>
          </div>
          {isAdmin && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Rol</label>
              <select 
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={newUser.role}
                onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
              >
                <option value="user">Cliente</option>
                <option value="lecturador">Lector</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          )}
          <Button type="submit" className="w-full py-4 rounded-xl font-bold mt-4">
            {isEditingUser ? "Actualizar Usuario" : "Guardar Usuario"}
          </Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isCameraModalOpen} 
        onClose={stopCamera} 
        title="Cámara en Tiempo Real"
      >
        <div className="space-y-4">
          <div className="aspect-video bg-black rounded-2xl overflow-hidden relative">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="flex gap-4">
            <Button variant="outline" onClick={stopCamera} className="flex-1 rounded-xl">
              Cancelar
            </Button>
            <Button onClick={capturePhoto} className="flex-1 rounded-xl flex items-center justify-center gap-2">
              <Camera className="h-5 w-5" />
              Capturar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
