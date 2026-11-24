import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Eye,
  EyeOff,
  LayoutDashboard,
  KeyRound,
  LogOut,
  MapPin,
  Moon,
  Pencil,
  Plus,
  QrCode,
  Search,
  Save,
  ShieldCheck,
  Sun,
  Users,
  X,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import './App.css'

type DashboardRole = 'admin' | 'facility'

interface DashboardUser {
  id: string
  fullName: string
  email: string
  role: DashboardRole | 'traveler'
}

interface Session {
  token: string
  user: DashboardUser
}

interface Paged<T> {
  items: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface FacilityInfo {
  _id: string
  name: string
  category: string
  city: string
  address?: string
  status: string
  accessEnabled: boolean
  description?: string
  pointsPerVisit?: number
  pointsPerHour?: number
  capacityLimit?: number | null
  currentOccupancy?: number
  amenities?: string[]
  photos?: string[]
  latitude?: number
  longitude?: number
  operatingHours?: { dayOfWeek: number; open: string; close: string; closed: boolean }[]
  holidayClosures?: { date: string; reason?: string }[]
  timeZone?: string
  acceptedAccessMethods?: string[]
  owner?: { fullName: string; email: string } | null
  activeQr?: { id: string; createdAt: string } | null
}

interface AccessInfo {
  _id: string
  traveler?: { fullName: string; email: string } | null
  facility?: { name: string; city?: string } | null
  pointsCharged?: number | null
  hoursUsed?: number | null
  accessMethod?: string | null
  accessedAt?: string
}

interface ProfileInfo extends DashboardUser {
  isEmailVerified: boolean
  phoneNumber: string | null
  city: string | null
  country: string | null
  dateOfBirth: string | null
  bloodGroup: string | null
  emergencyContact: { name: string; phoneNumber: string; relationship: string } | null
  profilePhotoUrl: string | null
  createdAt: string
  updatedAt: string
}

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
const CURRENT_YEAR = new Date().getFullYear()
const DATA_MODE_KEY = 'onepass-dashboard-data-mode'
const REMEMBER_EMAIL_KEY = 'onepass-dashboard-remembered-email'
const THEME_MODE_KEY = 'onepass-dashboard-theme'

async function request<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const usesDemoData = sessionStorage.getItem(DATA_MODE_KEY) === 'demo' &&
    (path.startsWith('/dashboard/') || path.startsWith('/facility-qr/'))
  const dataPath = usesDemoData
    ? `${API_BASE}/demo${path}`
    : `${API_BASE}${path}`
  const response = await fetch(dataPath, { ...init, headers })
  const result = await response.json().catch(() => null) as {
    success?: boolean
    message?: string
    data?: T
  } | null

  if (!response.ok || !result?.success || result.data === undefined) {
    throw new Error(result?.message || 'The request could not be completed.')
  }
  return result.data
}

async function requestAction(token: string, path: string, init?: RequestInit): Promise<void> {
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const result = await response.json().catch(() => null) as {
    success?: boolean
    message?: string
  } | null
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || 'The request could not be completed.')
  }
}

async function publicRequest(path: string, body: Record<string, string>): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => null) as {
    success?: boolean
    message?: string
  } | null

  if (!response.ok || !result?.success) {
    throw new Error(result?.message || 'The request could not be completed.')
  }
}

function readSession(): Session | null {
  try {
    const saved = sessionStorage.getItem('onepass-dashboard-session')
    if (!saved) return null
    const value = JSON.parse(saved) as Session
    if (!value.token || !value.user || !['admin', 'facility'].includes(value.user.role)) return null
    return value
  } catch {
    return null
  }
}

function useResource<T>(token: string, path: string) {
  const [resource, setResource] = useState<{
    key: string
    data: T | null
    loading: boolean
    error: string
  }>({ key: '', data: null, loading: true, error: '' })
  const [refreshKey, setRefreshKey] = useState(0)
  const key = `${token}:${path}:${refreshKey}`

  useEffect(() => {
    let active = true
    request<T>(token, path)
      .then((value) => {
        if (active) setResource({ key, data: value, loading: false, error: '' })
      })
      .catch((cause: unknown) => {
        if (active) {
          setResource({
            key,
            data: null,
            loading: false,
            error: cause instanceof Error ? cause.message : 'Unable to load data.',
          })
        }
      })

    return () => { active = false }
  }, [key, path, token])

  const current = resource.key === key
  return {
    data: current ? resource.data : null,
    loading: !current || resource.loading,
    error: current ? resource.error : '',
    reload: () => setRefreshKey((value) => value + 1),
  }
}

function App() {
  const [session, setSession] = useState<Session | null>(readSession)

  useEffect(() => {
    if (session) sessionStorage.setItem('onepass-dashboard-session', JSON.stringify(session))
    else sessionStorage.removeItem('onepass-dashboard-session')
  }, [session])

  const home = session?.user.role === 'admin' ? '/admin' : '/facility'
  function logout() {
    sessionStorage.removeItem(DATA_MODE_KEY)
    setSession(null)
  }
  function updateSessionProfile(profile: ProfileInfo) {
    setSession((current) => current
      ? { ...current, user: { ...current.user, fullName: profile.fullName, email: profile.email } }
      : current)
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={session ? <Navigate to={home} replace /> : <LoginPage onLogin={setSession} />} />
        <Route path="/register" element={session ? <Navigate to={home} replace /> : <RegisterPage />} />
        <Route path="/forgot-password" element={session ? <Navigate to={home} replace /> : <ForgotPasswordPage />} />
        <Route path="/admin" element={<RoleGate session={session} role="admin"><DashboardLayout session={session!} onLogout={logout} /></RoleGate>}>
          <Route index element={<AdminOverview token={session?.token || ''} />} />
          <Route path="analytics" element={<AdminAnalytics token={session?.token || ''} />} />
          <Route path="users" element={<AdminUsers token={session?.token || ''} />} />
          <Route path="facilities" element={<AdminFacilities token={session?.token || ''} />} />
          <Route path="facility-qr" element={<AdminFacilityQRs token={session?.token || ''} />} />
          <Route path="approvals" element={<AdminFacilities token={session?.token || ''} initialStatus="pending" />} />
          <Route path="transactions" element={<AdminTransactions token={session?.token || ''} />} />
          <Route path="access-points" element={<AdminAccessPoints token={session?.token || ''} />} />
          <Route path="audit-logs" element={<AdminAuditLogs token={session?.token || ''} />} />
          <Route path="accesses" element={<AdminAccesses token={session?.token || ''} />} />
          <Route path="profile" element={<AccountSettings token={session?.token || ''} onProfileUpdated={updateSessionProfile} onLogout={logout} />} />
        </Route>
        <Route path="/facility" element={<RoleGate session={session} role="facility"><DashboardLayout session={session!} onLogout={logout} /></RoleGate>}>
          <Route index element={<FacilityOverview token={session?.token || ''} />} />
          <Route path="facilities" element={<FacilityList token={session?.token || ''} />} />
          <Route path="facilities/:facilityId/accesses" element={<FacilityHistory token={session?.token || ''} />} />
          <Route path="profile" element={<AccountSettings token={session?.token || ''} onProfileUpdated={updateSessionProfile} onLogout={logout} />} />
        </Route>
        <Route path="*" element={<Navigate to={session ? home : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function RoleGate({ session, role, children }: { session: Session | null; role: DashboardRole; children: ReactNode }) {
  if (!session) return <Navigate to="/login" replace />
  if (session.user.role !== role) return <Navigate to={session.user.role === 'admin' ? '/admin' : '/facility'} replace />
  return children
}

function LoginPage({ onLogin }: { onLogin: (session: Session) => void }) {
  const location = useLocation()
  const signupNotice = location.state as { email?: string; accountCreated?: boolean; passwordReset?: boolean } | null
  const [email, setEmail] = useState(signupNotice?.email || localStorage.getItem(REMEMBER_EMAIL_KEY) || '')
  const [rememberEmail, setRememberEmail] = useState(Boolean(localStorage.getItem(REMEMBER_EMAIL_KEY)))
  const [password, setPassword] = useState('')
  const [dataMode, setDataMode] = useState<'demo' | 'live'>(
    sessionStorage.getItem(DATA_MODE_KEY) === 'live' ? 'live' : 'demo'
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const result = await response.json() as {
        success: boolean
        message?: string
        data?: { token: string; user: DashboardUser }
      }
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || 'Unable to sign in.')
      }
      if (!['admin', 'facility'].includes(result.data.user.role)) {
        throw new Error('This dashboard is for admin and facility accounts. Use the OnePass mobile app for your account.')
      }
      sessionStorage.setItem(DATA_MODE_KEY, dataMode)
      if (rememberEmail) localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim())
      else localStorage.removeItem(REMEMBER_EMAIL_KEY)
      onLogin({ token: result.data.token, user: result.data.user })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-lockup">
          <div className="brand-mark"><span>1</span></div>
          <div><strong>onepass</strong><small>CONTROL CENTER</small></div>
        </div>
        <div className="login-copy">
          <p className="eyebrow">WELCOME BACK</p>
          <h1>Your operations,<br /><span>in one place.</span></h1>
          <p>Sign in with your admin or facility account to manage OnePass.</p>
        </div>
        <form className="login-form" onSubmit={submit}>
          {signupNotice?.accountCreated && <div className="success-message" role="status">Account verified. Sign in with your new credentials.</div>}
          {signupNotice?.passwordReset && <div className="success-message" role="status">Password reset successfully. Sign in with your new password.</div>}
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" />
          <div className="password-label-row"><label htmlFor="password">Password</label><NavLink to="/forgot-password">Forgot password?</NavLink></div>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
          <label className="remember-email"><input type="checkbox" checked={rememberEmail} onChange={(event) => { setRememberEmail(event.target.checked); if (!event.target.checked) localStorage.removeItem(REMEMBER_EMAIL_KEY) }} /> Remember my email on this device</label>
          <fieldset className="data-mode-selector">
            <legend>Dashboard data</legend>
            <label><input type="radio" name="dashboard-data-mode" checked={dataMode === 'demo'} onChange={() => setDataMode('demo')} /><span><b>Sample data</b><small>Use isolated demo records for dashboard screens.</small></span></label>
            <label><input type="radio" name="dashboard-data-mode" checked={dataMode === 'live'} onChange={() => setDataMode('live')} /><span><b>Live OnePass data</b><small>Load records from the existing backend.</small></span></label>
          </fieldset>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button button-primary login-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'} <ChevronRight size={17} />
          </button>
        </form>
        <div className="login-create">Don’t have a dashboard account? <NavLink to="/register">Create account</NavLink></div>
        <div className="login-foot"><ShieldCheck size={15} /> Secure access for OnePass teams</div>
      </section>
      <aside className="login-aside">
        <div className="aside-orbit orbit-one" /><div className="aside-orbit orbit-two" />
        <div className="aside-content">
          <span className="aside-label">THE ONEPASS NETWORK</span>
          <h2>Make every<br />visit count.</h2>
          <p>Manage people, places and access activity from a single workspace built for your team.</p>
          <div className="aside-metrics">
            <div><Users size={17} /><span><b>People</b><small>One connected community</small></span></div>
            <div><MapPin size={17} /><span><b>Places</b><small>Facilities at a glance</small></span></div>
            <div><Activity size={17} /><span><b>Activity</b><small>Access, clearly tracked</small></span></div>
          </div>
        </div>
        <span className="aside-version">ONEPASS · OPERATIONS PLATFORM</span>
      </aside>
    </main>
  )
}

function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'email' | 'reset'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await publicRequest('/auth/forgot-password', { email })
      setMessage('If an eligible account exists, a password-reset code will be sent to this email.')
      setStep('reset')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send the reset code.')
    } finally {
      setLoading(false)
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (newPassword.length < 8 || newPassword.length > 72 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Use 8–72 characters with uppercase, lowercase and a number.')
      return
    }

    setLoading(true)
    try {
      await publicRequest('/auth/reset-password', { email, otp, newPassword, confirmPassword })
      navigate('/login', { replace: true, state: { email, passwordReset: true } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to reset the password.')
    } finally {
      setLoading(false)
    }
  }

  async function resendOtp() {
    setLoading(true)
    setError('')
    try {
      await publicRequest('/auth/forgot-password', { email })
      setMessage('If an eligible account exists, a new password-reset code will be sent.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to resend the reset code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <NavLink to="/login" className="brand-lockup">
          <div className="brand-mark"><span>1</span></div>
          <div><strong>onepass</strong><small>CONTROL CENTER</small></div>
        </NavLink>
        <div className="login-copy">
          <p className="eyebrow">{step === 'email' ? 'ACCOUNT RECOVERY' : 'RESET PASSWORD'}</p>
          <h1>{step === 'email' ? <>Get back<br /><span>into your account.</span></> : <>Choose a new<br /><span>password.</span></>}</h1>
          <p>{step === 'email' ? 'We’ll send a one-time code to the email address on your account.' : `Enter the code sent to ${email} and choose a new password.`}</p>
        </div>
        {step === 'email' ? <form className="login-form" onSubmit={sendOtp}>
          <label htmlFor="reset-email">Email address</label>
          <input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" />
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button button-primary login-submit" type="submit" disabled={loading}>{loading ? 'Sending code…' : 'Send reset code'} <ChevronRight size={17} /></button>
        </form> : <form className="login-form" onSubmit={resetPassword}>
          {message && <div className="success-message" role="status">{message}</div>}
          <label htmlFor="reset-otp">One-time code</label>
          <input id="reset-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" />
          <label htmlFor="new-password">New password</label>
          <input id="new-password" type="password" autoComplete="new-password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" />
          <label htmlFor="confirm-new-password">Confirm new password</label>
          <input id="confirm-new-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter it again" />
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button button-primary login-submit" type="submit" disabled={loading || otp.length !== 6}>{loading ? 'Updating password…' : 'Reset password'} <ChevronRight size={17} /></button>
          <button className="resend-code" type="button" onClick={resendOtp} disabled={loading}>Resend code</button>
        </form>}
        <div className="login-create"><NavLink to="/login">Back to sign in</NavLink></div>
        <div className="login-foot"><ShieldCheck size={15} /> Secure access for OnePass teams</div>
      </section>
      <aside className="login-aside">
        <div className="aside-orbit orbit-one" /><div className="aside-orbit orbit-two" />
        <div className="aside-content">
          <span className="aside-label">SECURE ACCOUNT RECOVERY</span>
          <h2>Reset it.<br />Get back in.</h2>
          <p>A short-lived one-time code helps verify your email before your password is changed.</p>
          <div className="aside-metrics">
            <div><ShieldCheck size={17} /><span><b>One-time verification</b><small>Codes expire after 10 minutes</small></span></div>
            <div><Check size={17} /><span><b>Password protection</b><small>Choose a new secure password</small></span></div>
          </div>
        </div>
        <span className="aside-version">ONEPASS · OPERATIONS PLATFORM</span>
      </aside>
    </main>
  )
}

function RegisterPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState<'admin' | 'facility'>('facility')
  const [step, setStep] = useState<'details' | 'verify'>('details')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function submitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8 || password.length > 72 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Use 8–72 characters with uppercase, lowercase and a number.')
      return
    }

    setLoading(true)
    try {
      await publicRequest('/auth/dashboard/register', { fullName, email, password, role })
      setMessage(`A verification code was sent to ${email}.`)
      setStep('verify')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start registration.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await publicRequest('/auth/dashboard/verify-registration-otp', { email, otp })
      navigate('/login', { replace: true, state: { email, accountCreated: true } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to verify this account.')
    } finally {
      setLoading(false)
    }
  }

  async function resendCode() {
    setLoading(true)
    setError('')
    try {
      await publicRequest('/auth/resend-registration-otp', { email })
      setMessage(`A new verification code was sent to ${email}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to resend the code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card register-card">
        <NavLink to="/login" className="brand-lockup">
          <div className="brand-mark"><span>1</span></div>
          <div><strong>onepass</strong><small>CONTROL CENTER</small></div>
        </NavLink>
        <div className="login-copy register-copy">
          <p className="eyebrow">{step === 'details' ? 'GET STARTED' : 'EMAIL VERIFICATION'}</p>
          <h1>{step === 'details' ? <>Create your<br /><span>dashboard account.</span></> : <>Check your<br /><span>inbox.</span></>}</h1>
          <p>{step === 'details' ? 'Choose the account type and enter your details.' : `Enter the 6-digit code sent to ${email}.`}</p>
        </div>
        {step === 'details' ? <form className="login-form" onSubmit={submitDetails}>
          <fieldset className="role-selector">
            <legend>Account type</legend>
            <div className="role-options">
              <label className={role === 'facility' ? 'selected' : ''}>
                <input type="radio" name="role" value="facility" checked={role === 'facility'} onChange={() => setRole('facility')} />
                <Building2 size={16} /><span><b>Facility</b><small>Manage facility access</small></span>
              </label>
              <label className={role === 'admin' ? 'selected' : ''}>
                <input type="radio" name="role" value="admin" checked={role === 'admin'} onChange={() => setRole('admin')} />
                <ShieldCheck size={16} /><span><b>Admin</b><small>Platform management</small></span>
              </label>
            </div>
          </fieldset>
          <label htmlFor="signup-name">Full name</label>
          <input id="signup-name" autoComplete="name" required minLength={2} maxLength={80} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" />
          <label htmlFor="signup-email">Email address</label>
          <input id="signup-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" />
          <label htmlFor="signup-password">Password</label>
          <div className="password-input-wrap"><input id="signup-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /><button className="password-visibility" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
          <label htmlFor="signup-confirm">Confirm password</label>
          <div className="password-input-wrap"><input id="signup-confirm" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" /><button className="password-visibility" type="button" aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirmPassword} onClick={() => setShowConfirmPassword((value) => !value)}>{showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
          {role === 'admin' && <p className="signup-note admin-note"><ShieldCheck size={14} /> Admin registration is restricted to the authorized email.</p>}
          {role === 'facility' && <p className="signup-note"><Building2 size={14} /> A OnePass admin must assign locations to your account.</p>}
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button button-primary login-submit" type="submit" disabled={loading}>{loading ? 'Sending code…' : 'Continue'} <ChevronRight size={17} /></button>
        </form> : <form className="login-form" onSubmit={verifyEmail}>
          {message && <div className="success-message" role="status">{message}</div>}
          <label htmlFor="signup-otp">Verification code</label>
          <input id="signup-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" />
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button button-primary login-submit" type="submit" disabled={loading || otp.length !== 6}>{loading ? 'Verifying…' : 'Verify and create account'} <ChevronRight size={17} /></button>
          <button className="resend-code" type="button" onClick={resendCode} disabled={loading}>Resend verification code</button>
        </form>}
        <div className="login-create">Already have an account? <NavLink to="/login">Sign in</NavLink></div>
        <div className="login-foot"><ShieldCheck size={15} /> Secure access for OnePass teams</div>
      </section>
      <aside className="login-aside">
        <div className="aside-orbit orbit-one" /><div className="aside-orbit orbit-two" />
        <div className="aside-content">
          <span className="aside-label">THE ONEPASS NETWORK</span>
          <h2>One platform.<br />The right access.</h2>
          <p>Every account is verified and receives only the permissions allowed for its role.</p>
          <div className="aside-metrics">
            <div><ShieldCheck size={17} /><span><b>Admin access</b><small>Only the authorized email can register</small></span></div>
            <div><Building2 size={17} /><span><b>Facility access</b><small>Manage locations assigned to your account</small></span></div>
          </div>
        </div>
        <span className="aside-version">ONEPASS · OPERATIONS PLATFORM</span>
      </aside>
    </main>
  )
}

function DashboardLayout({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const isAdmin = session.user.role === 'admin'
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem(THEME_MODE_KEY) === 'dark')
  const dataMode = sessionStorage.getItem(DATA_MODE_KEY) === 'demo' ? 'demo' : 'live'
  useEffect(() => {
    localStorage.setItem(THEME_MODE_KEY, darkMode ? 'dark' : 'light')
  }, [darkMode])
  const navGroups = isAdmin ? [
    { label: 'Workspace', items: [
      { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/admin/analytics', label: 'Analytics', icon: Activity },
    ] },
    { label: 'Management', items: [
      { to: '/admin/users', label: 'Users & accounts', icon: Users },
      { to: '/admin/approvals', label: 'Facility approvals', icon: Check },
      { to: '/admin/facilities', label: 'Facilities & venues', icon: Building2 },
    ] },
    { label: 'Operations', items: [
      { to: '/admin/facility-qr', label: 'Facility QR generator', icon: QrCode },
      { to: '/admin/access-points', label: 'Access points', icon: QrCode },
      { to: '/admin/transactions', label: 'Transactions & billing', icon: CreditCard },
      { to: '/admin/audit-logs', label: 'Audit logs', icon: ShieldCheck },
    ] },
  ] : [
    { label: 'Workspace', items: [
      { to: '/facility', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/facility/facilities', label: 'My facilities', icon: Building2 },
    ] },
  ]
  const title = isAdmin ? 'Admin workspace' : 'Facility workspace'
  const location = useLocation()
  const topbarPages = isAdmin ? [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/analytics', label: 'Analytics', icon: Activity, end: false },
    { to: '/admin/users', label: 'Users', icon: Users, end: false },
    { to: '/admin/facilities', label: 'Facilities', icon: Building2, end: false },
    { to: '/admin/transactions', label: 'Transactions', icon: CreditCard, end: false },
  ] : [
    { to: '/facility', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/facility/facilities', label: 'Facilities', icon: Building2, end: false },
    { to: '/facility/profile', label: 'Profile', icon: Users, end: false },
  ]
  const pageLabels: Record<string, string> = {
    '/admin': 'Overview',
    '/admin/analytics': 'Analytics',
    '/admin/users': 'Users & Accounts',
    '/admin/approvals': 'Facility Approvals',
    '/admin/facilities': 'Facilities & Venues',
    '/admin/facility-qr': 'Facility QR Generator',
    '/admin/transactions': 'Transactions & Billing',
    '/admin/access-points': 'Access Points',
    '/admin/audit-logs': 'Audit Logs',
    '/admin/accesses': 'Access Activity',
    '/admin/profile': 'Profile & Settings',
    '/facility': 'Overview',
    '/facility/facilities': 'My Facilities',
    '/facility/profile': 'Profile & Settings',
  }
  const currentPage = location.pathname.startsWith('/facility/facilities/')
    ? 'Facility Access History'
    : pageLabels[location.pathname] || title
  const initial = session.user.fullName?.trim().charAt(0).toUpperCase() || 'U'

  return (
    <div className={`dashboard-app${darkMode ? ' dark-mode' : ''}`}>
      <aside className="sidebar">
        <NavLink to={isAdmin ? '/admin' : '/facility'} className="sidebar-brand">
          <div className="brand-mark"><span>1</span></div><strong>onepass</strong>
        </NavLink>
        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace-switch"><span className={`workspace-icon ${isAdmin ? 'admin-icon' : ''}`}>{isAdmin ? <ShieldCheck size={17} /> : <Building2 size={17} />}</span><span><b>{title}</b><small>{isAdmin ? 'Full platform access' : 'Your locations'}</small></span></div>
        <nav className="side-nav" aria-label="Main navigation">
          {navGroups.map((group) => <div className="nav-group" key={group.label}>
            <span className="nav-section">{group.label}</span>
            {group.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} title={label} aria-label={label} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === 'Access points' && <span className="nav-dot" />}
              </NavLink>
            ))}
          </div>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-note"><span className="help-icon"><CircleHelp size={17} /></span><span><b>Need a hand?</b><small>Contact your OnePass team.</small></span></div>
          <div className="profile-row">
            <NavLink className="profile-link" to={`${isAdmin ? '/admin' : '/facility'}/profile`} title="Profile and account settings" aria-label="Open profile and account settings">
              <span className="avatar">{initial}</span>
              <span className="profile-details"><b>{session.user.fullName}</b><small>{session.user.email}</small></span>
            </NavLink>
            <button type="button" className="icon-button logout-button" onClick={onLogout} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="topbar-navigation">
            <nav className="topbar-page-nav" aria-label="Dashboard pages">
              {topbarPages.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} title={label} aria-label={`Go to ${label}`} className={({ isActive }) => `topbar-page-link${isActive ? ' active' : ''}`}>
                  <Icon size={15} strokeWidth={1.9} /><span>{label}</span>
                </NavLink>
              ))}
            </nav>
            <span className="topbar-current-page" title={currentPage}>{currentPage}</span>
          </div>
          <div className="topbar-right">
            <button type="button" className={`theme-toggle${darkMode ? ' is-dark' : ''}`} onClick={() => setDarkMode((current) => !current)} role="switch" aria-checked={darkMode} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
              <span className="theme-toggle-thumb" aria-hidden="true">{darkMode ? <Moon size={12} /> : <Sun size={12} />}</span>
            </button>
            <label className="data-mode-control"><span>DATA</span><select aria-label="Dashboard data source" value={dataMode} onChange={(event) => { sessionStorage.setItem(DATA_MODE_KEY, event.target.value); window.location.reload() }}><option value="demo">Sample</option><option value="live">Live</option></select></label>
            <span className={`status-dot${dataMode === 'demo' ? ' demo-dot' : ''}`} />
            {dataMode === 'demo' ? 'Demo data · temporary changes' : 'All systems operational'}
            <NavLink className="top-avatar-link" to={`${isAdmin ? '/admin' : '/facility'}/profile`} title="Open profile and settings" aria-label="Open profile and settings">
              <span className="top-avatar">{initial}</span>
            </NavLink>
          </div>
        </header>
        <main className="page-content"><Outlet /></main>
        <footer className="page-footer"><span>© {CURRENT_YEAR} OnePass</span><span>Control center <i /> Secure dashboard</span></footer>
      </div>
    </div>
  )
}

function AccountSettings({ token, onProfileUpdated, onLogout }: { token: string; onProfileUpdated: (profile: ProfileInfo) => void; onLogout: () => void }) {
  const { data, loading, error, reload } = useResource<{ user: ProfileInfo }>(token, '/auth/me')
  const profile = data?.user
  const [form, setForm] = useState({
    fullName: '',
    phoneNumber: '',
    city: '',
    country: '',
    dateOfBirth: '',
    bloodGroup: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelationship: '',
  })
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState('')
  const [profileError, setProfileError] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [profileEditorOpen, setProfileEditorOpen] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordChanged, setPasswordChanged] = useState(false)
  const [passwordStep, setPasswordStep] = useState<'closed' | 'email' | 'otp'>('closed')
  const [passwordEmail, setPasswordEmail] = useState('')
  const [passwordOtp, setPasswordOtp] = useState('')
  const [sendingPasswordOtp, setSendingPasswordOtp] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailOtp, setEmailOtp] = useState('')
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [emailChangeError, setEmailChangeError] = useState('')
  const [emailChangeMessage, setEmailChangeMessage] = useState('')
  const [emailChangeLoading, setEmailChangeLoading] = useState(false)
  const [emailChangeOpen, setEmailChangeOpen] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    if (!profile) return
    setForm({
      fullName: profile.fullName || '',
      phoneNumber: profile.phoneNumber || '',
      city: profile.city || '',
      country: profile.country || '',
      dateOfBirth: profile.dateOfBirth || '',
      bloodGroup: profile.bloodGroup || '',
      emergencyName: profile.emergencyContact?.name || '',
      emergencyPhone: profile.emergencyContact?.phoneNumber || '',
      emergencyRelationship: profile.emergencyContact?.relationship || '',
    })
  }, [profile])

  useEffect(() => {
    if (profileEditorOpen) {
      document.getElementById('profile-editor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [profileEditorOpen])

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    setPhotoError('')
    if (!profile?.profilePhotoUrl) {
      setPhotoUrl(null)
      return () => { cancelled = true }
    }

    fetch(`${API_BASE}${profile.profilePhotoUrl}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load your profile photo.')
        return response.blob()
      })
      .then((image) => {
        objectUrl = URL.createObjectURL(image)
        if (!cancelled) setPhotoUrl(objectUrl)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setPhotoError(cause instanceof Error ? cause.message : 'Unable to load your profile photo.')
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [profile?.profilePhotoUrl, token])

  if (loading) return <LoadingState />
  if (error || !profile) return <ErrorState message={error || 'No profile data was returned.'} retry={reload} />

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileError('')
    setProfileMessage('')
    const hasEmergencyContact = Boolean(
      form.emergencyName.trim() || form.emergencyPhone.trim() || form.emergencyRelationship.trim()
    )
    if (hasEmergencyContact && (!form.emergencyName.trim() || !form.emergencyPhone.trim())) {
      setProfileError('Emergency contact name and phone number are both required.')
      return
    }

    setSavingProfile(true)
    try {
      const result = await request<{ user: ProfileInfo }>(token, '/auth/me', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: form.fullName,
          phoneNumber: form.phoneNumber.trim() || null,
          city: form.city.trim() || null,
          country: form.country.trim() || null,
          dateOfBirth: form.dateOfBirth || null,
          bloodGroup: form.bloodGroup || null,
          emergencyContact: hasEmergencyContact
            ? {
              name: form.emergencyName,
              phoneNumber: form.emergencyPhone,
              relationship: form.emergencyRelationship,
            }
            : null,
        }),
      })
      onProfileUpdated(result.user)
      setProfileMessage('Profile details saved.')
      setProfileEditorOpen(false)
      reload()
    } catch (cause) {
      setProfileError(cause instanceof Error ? cause.message : 'Unable to save profile details.')
    } finally {
      setSavingProfile(false)
    }
  }

  function startPasswordChange() {
    setPasswordError('')
    setPasswordMessage('')
    setPasswordEmail('')
    setPasswordOtp('')
    setPasswordStep('email')
  }

  function cancelPasswordChange() {
    setPasswordError('')
    setPasswordMessage('')
    setPasswordEmail('')
    setPasswordOtp('')
    setPasswordStep('closed')
  }

  async function sendPasswordChangeOTP(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError('')
    setPasswordMessage('')
    const currentProfile = profile
    if (!currentProfile) {
      setPasswordError('Account profile is unavailable. Reload the page and try again.')
      return
    }
    if (!currentProfile.isEmailVerified) {
      setPasswordError('Verify your account email before changing your password.')
      return
    }
    if (passwordEmail.trim().toLowerCase() !== currentProfile.email.trim().toLowerCase()) {
      setPasswordError('Enter the verified email address connected to this account.')
      return
    }

    setSendingPasswordOtp(true)
    try {
      await requestAction(token, '/auth/me/password-otp', {
        method: 'POST',
        body: JSON.stringify({ email: passwordEmail.trim() }),
      })
      setPasswordMessage(`A verification code was sent to ${currentProfile.email}.`)
      setPasswordStep('otp')
    } catch (cause) {
      setPasswordError(cause instanceof Error ? cause.message : 'Unable to send a password verification code.')
    } finally {
      setSendingPasswordOtp(false)
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError('')
    setPasswordMessage('')
    const formElement = event.currentTarget
    const values = new FormData(formElement)
    const newPassword = String(values.get('newPassword') || '')
    const confirmPassword = String(values.get('confirmPassword') || '')
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    setSavingPassword(true)
    try {
      await requestAction(token, '/auth/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ otp: passwordOtp, newPassword, confirmPassword }),
      })
      formElement.reset()
      setPasswordOtp('')
      setPasswordStep('closed')
      setPasswordChanged(true)
      setPasswordMessage('Password changed. Sign in again to continue.')
    } catch (cause) {
      setPasswordError(cause instanceof Error ? cause.message : 'Unable to change password.')
    } finally {
      setSavingPassword(false)
    }
  }

  async function resendPasswordChangeOTP() {
    setPasswordError('')
    const currentProfile = profile
    if (!currentProfile) {
      setPasswordError('Account profile is unavailable. Reload the page and try again.')
      return
    }
    setSendingPasswordOtp(true)
    try {
      await requestAction(token, '/auth/me/password-otp', {
        method: 'POST',
        body: JSON.stringify({ email: passwordEmail.trim() }),
      })
      setPasswordMessage(`A new verification code was sent to ${currentProfile.email}.`)
    } catch (cause) {
      setPasswordError(cause instanceof Error ? cause.message : 'Unable to resend the verification code.')
    } finally {
      setSendingPasswordOtp(false)
    }
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setPhotoError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Choose a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Profile photo must be 5 MB or smaller.')
      return
    }

    const body = new FormData()
    body.append('photo', file)
    try {
      const response = await fetch(`${API_BASE}/auth/me/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      })
      const result = await response.json() as { success?: boolean; message?: string }
      if (!response.ok || !result.success) throw new Error(result.message || 'Unable to update your profile photo.')
      reload()
    } catch (cause) {
      setPhotoError(cause instanceof Error ? cause.message : 'Unable to update your profile photo.')
    }
  }

  async function removePhoto() {
    setPhotoError('')
    try {
      await request<{ user: ProfileInfo }>(token, '/auth/me/photo', { method: 'DELETE' })
      reload()
    } catch (cause) {
      setPhotoError(cause instanceof Error ? cause.message : 'Unable to remove your profile photo.')
    }
  }

  async function sendEmailChangeOTP(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEmailChangeError('')
    setEmailChangeMessage('')
    setEmailChangeLoading(true)
    try {
      const result = await request<{ email: string; expiresIn: string }>(
        token,
        '/auth/admin/email-change/request-otp',
        {
          method: 'POST',
          body: JSON.stringify({ newEmail, currentPassword: emailPassword }),
        }
      )
      setNewEmail(result.email)
      setEmailOtpSent(true)
      setEmailChangeMessage(`A verification code was sent to ${result.email}. Your current login stays active until verification.`)
    } catch (cause) {
      setEmailChangeError(cause instanceof Error ? cause.message : 'Unable to send the verification code.')
    } finally {
      setEmailChangeLoading(false)
    }
  }

  async function verifyEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEmailChangeError('')
    setEmailChangeMessage('')
    setEmailChangeLoading(true)
    try {
      const result = await request<{ user: ProfileInfo }>(
        token,
        '/auth/admin/email-change/verify-otp',
        {
          method: 'POST',
          body: JSON.stringify({ newEmail, otp: emailOtp }),
        }
      )
      if (localStorage.getItem(REMEMBER_EMAIL_KEY) === profile?.email) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, result.user.email)
      }
      onProfileUpdated(result.user)
      setEmailPassword('')
      setEmailOtp('')
      setEmailOtpSent(false)
      setEmailChangeOpen(false)
      setEmailChangeMessage('Admin login email updated. Use the new email the next time you sign in.')
      reload()
    } catch (cause) {
      setEmailChangeError(cause instanceof Error ? cause.message : 'Unable to update the Admin login email.')
    } finally {
      setEmailChangeLoading(false)
    }
  }

  function cancelEmailChange() {
    setEmailChangeOpen(false)
    setEmailOtpSent(false)
    setNewEmail('')
    setEmailPassword('')
    setEmailOtp('')
    setEmailChangeError('')
    setEmailChangeMessage('')
  }

  return <>
    <PageHeading eyebrow="ACCOUNT" title="Profile & settings" description="Review your account details and open only the settings you want to update." />
    <div className="settings-layout">
      <div className="settings-main-column">
      <section className="panel settings-panel">
        <div className="settings-section-heading"><div><h2>Profile information</h2><p>Your account identity is loaded from OnePass.</p></div><span className="status-badge">{profile.role}</span></div>
        <div className="profile-summary">
          <div className="profile-photo-wrap">{photoUrl ? <img className="profile-photo" src={photoUrl} alt={`${profile.fullName}'s profile`} /> : <span className="profile-photo-fallback">{profile.fullName.charAt(0).toUpperCase()}</span>}</div>
          <div className="profile-summary-info"><b>{profile.fullName}</b><span>{profile.email}</span><small>{profile.isEmailVerified ? 'Email verified' : 'Email not verified'} · Member since {formatDate(profile.createdAt)}</small></div>
        </div>
        <div className="profile-action-row">
          <label className="button button-outline photo-upload-button" htmlFor="profile-photo"><Camera size={15} /> Change photo</label>
          <input id="profile-photo" className="photo-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} />
          {profile.profilePhotoUrl && <button className="button button-outline" type="button" onClick={removePhoto}>Remove photo</button>}
          <button className="button button-primary" type="button" onClick={() => { setProfileEditorOpen((open) => !open); setProfileError(''); setProfileMessage('') }} aria-expanded={profileEditorOpen}>
            {profileEditorOpen ? <X size={15} /> : <Pencil size={15} />}{profileEditorOpen ? 'Close editor' : 'Edit profile'}
          </button>
        </div>
        {photoError && <div className="form-error" role="alert">{photoError}</div>}
        {!profileEditorOpen && <div className="profile-facts">
          <div><small>Phone</small><b>{profile.phoneNumber || 'Not added'}</b></div>
          <div><small>Location</small><b>{[profile.city, profile.country].filter(Boolean).join(', ') || 'Not added'}</b></div>
          <div><small>Date of birth</small><b>{profile.dateOfBirth ? formatDate(profile.dateOfBirth) : 'Not provided'}</b></div>
          <div><small>Blood group</small><b>{profile.bloodGroup || 'Not provided'}</b></div>
        </div>}
        {profileError && <div className="form-error" role="alert">{profileError}</div>}
        {profileMessage && <div className="success-message" role="status">{profileMessage}</div>}
        {profileEditorOpen && <form id="profile-editor" className="settings-form" onSubmit={saveProfile}>
          <div className="profile-form-grid">
            <label>Full name<input required minLength={2} maxLength={80} value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} /></label>
            <label>Email address<input value={profile.email} readOnly aria-describedby="email-account-note" /><small id="email-account-note">Email changes require a separate verified workflow.</small></label>
            <label>Phone number<input type="tel" maxLength={25} value={form.phoneNumber} onChange={(event) => updateField('phoneNumber', event.target.value)} /></label>
            <label>Account role<input value={profile.role} readOnly /></label>
            <label>City<input maxLength={80} value={form.city} onChange={(event) => updateField('city', event.target.value)} /></label>
            <label>Country<input maxLength={80} value={form.country} onChange={(event) => updateField('country', event.target.value)} /></label>
            <label>Date of birth<input type="date" value={form.dateOfBirth} onChange={(event) => updateField('dateOfBirth', event.target.value)} /></label>
            <label>Blood group<select value={form.bloodGroup} onChange={(event) => updateField('bloodGroup', event.target.value)}><option value="">Not provided</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => <option key={group} value={group}>{group}</option>)}</select></label>
          </div>
          <fieldset className="emergency-fieldset"><legend>Emergency contact <small>Optional</small></legend><div className="profile-form-grid">
            <label>Contact name<input maxLength={80} value={form.emergencyName} onChange={(event) => updateField('emergencyName', event.target.value)} /></label>
            <label>Contact phone<input type="tel" maxLength={25} value={form.emergencyPhone} onChange={(event) => updateField('emergencyPhone', event.target.value)} /></label>
            <label>Relationship<input maxLength={40} value={form.emergencyRelationship} onChange={(event) => updateField('emergencyRelationship', event.target.value)} /></label>
          </div></fieldset>
          <div className="settings-actions"><button className="button button-primary" disabled={savingProfile}><Save size={15} />{savingProfile ? 'Saving…' : 'Save profile'}</button></div>
        </form>}
      </section>
      <section className="panel settings-panel profile-account-panel">
        <div className="settings-section-heading"><div><h2>Account overview</h2><p>Verification and account timeline.</p></div><span className="security-icon"><ShieldCheck size={17} /></span></div>
        <div className="account-detail-list">
          <div><span>Account role</span><b>{profile.role}</b></div>
          <div><span>Email status</span><b className={profile.isEmailVerified ? 'account-verified' : 'account-unverified'}>{profile.isEmailVerified ? 'Verified' : 'Not verified'}</b></div>
          <div><span>Member since</span><b>{formatDate(profile.createdAt)}</b></div>
          <div><span>Last profile update</span><b>{formatDate(profile.updatedAt)}</b></div>
        </div>
      </section>
      <section className="panel settings-panel emergency-contact-panel">
        <div className="settings-section-heading">
          <div><h2>Emergency contact</h2><p>Someone OnePass can contact if needed.</p></div>
          <button className="button button-outline" type="button" onClick={() => setProfileEditorOpen(true)}><Pencil size={14} />{profile.emergencyContact ? 'Edit contact' : 'Add contact'}</button>
        </div>
        {profile.emergencyContact ? <div className="account-detail-list">
          <div><span>Name</span><b>{profile.emergencyContact.name}</b></div>
          <div><span>Phone</span><b>{profile.emergencyContact.phoneNumber}</b></div>
          <div><span>Relationship</span><b>{profile.emergencyContact.relationship || 'Not provided'}</b></div>
        </div> : <p className="profile-empty-note">No emergency contact has been added.</p>}
      </section>
      </div>
      <div className="settings-side-column">
        <section className="panel settings-panel security-panel">
          <div className="settings-section-heading"><div><h2>Password & security</h2><p>Protect your account with an email verification code.</p></div><span className="security-icon"><KeyRound size={17} /></span></div>
          {passwordChanged ? <div className="security-complete">
            {passwordMessage && <div className="success-message" role="status">{passwordMessage}</div>}
            <button className="button button-outline" type="button" onClick={onLogout}><LogOut size={15} /> Sign out</button>
          </div> : passwordStep === 'closed' ? <div className="security-collapsed">
            <p>{profile.isEmailVerified ? `A one-time code will be sent to your verified email (${profile.email}).` : 'Verify your account email before changing your password.'}</p>
            <button className="button button-outline" type="button" disabled={!profile.isEmailVerified} onClick={startPasswordChange}><KeyRound size={15} /> Change password</button>
          </div> : passwordStep === 'email' ? <form className="settings-form" onSubmit={sendPasswordChangeOTP}>
            <label>Verified account email<input type="email" autoComplete="email" required value={passwordEmail} onChange={(event) => setPasswordEmail(event.target.value)} placeholder="Enter your account email" /></label>
            {passwordError && <div className="form-error" role="alert">{passwordError}</div>}
            <div className="profile-action-row">
              <button className="button button-primary" disabled={sendingPasswordOtp}><KeyRound size={15} />{sendingPasswordOtp ? 'Sending code…' : 'Send email code'}</button>
              <button className="button button-outline" type="button" disabled={sendingPasswordOtp} onClick={cancelPasswordChange}>Cancel</button>
            </div>
          </form> : <form className="settings-form" onSubmit={changePassword}>
            <div className="success-message" role="status">{passwordMessage || `Enter the verification code sent to ${profile.email}.`}</div>
            <label>Email verification code<input inputMode="numeric" autoComplete="one-time-code" name="otp" maxLength={6} pattern="[0-9]{6}" required value={passwordOtp} onChange={(event) => setPasswordOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" /></label>
            <label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={72} pattern="(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).{8,72}" title="Use 8–72 characters with uppercase, lowercase, and a number." required /></label>
            <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /></label>
            {passwordError && <div className="form-error" role="alert">{passwordError}</div>}
            <div className="profile-action-row">
              <button className="button button-primary" disabled={savingPassword || sendingPasswordOtp || passwordOtp.length !== 6}><KeyRound size={15} />{savingPassword ? 'Updating…' : 'Update password'}</button>
              <button className="button button-outline" type="button" disabled={sendingPasswordOtp} onClick={resendPasswordChangeOTP}>{sendingPasswordOtp ? 'Sending…' : 'Resend code'}</button>
              <button className="button button-outline" type="button" disabled={savingPassword || sendingPasswordOtp} onClick={cancelPasswordChange}>Cancel</button>
            </div>
          </form>}
          <div className="security-note"><ShieldCheck size={16} /><span>Your password is never saved in dashboard storage.</span></div>
        </section>
        {profile.role === 'admin' && <section className="panel settings-panel email-change-panel">
          <div className="settings-section-heading"><div><h2>Admin login email</h2><p>Verify a new address before it replaces your current login email.</p></div><span className="security-icon"><ShieldCheck size={17} /></span></div>
          {!emailChangeOpen ? <div className="security-collapsed">
            <p>{profile.email}{emailChangeMessage ? ` · ${emailChangeMessage}` : ''}</p>
            <button className="button button-outline" type="button" onClick={() => { setEmailChangeOpen(true); setEmailChangeError(''); setEmailChangeMessage(''); setNewEmail(''); setEmailPassword(''); setEmailOtp(''); setEmailOtpSent(false) }}><Pencil size={15} /> Change login email</button>
          </div> : !emailOtpSent ? <form className="settings-form" onSubmit={sendEmailChangeOTP}>
            <label>Current login email<input value={profile.email} readOnly /></label>
            <label>New login email<input type="email" autoComplete="email" required value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label>
            <label>Current password<input type="password" autoComplete="current-password" required value={emailPassword} onChange={(event) => setEmailPassword(event.target.value)} /></label>
            {emailChangeError && <div className="form-error" role="alert">{emailChangeError}</div>}
            {emailChangeMessage && <div className="success-message" role="status">{emailChangeMessage}</div>}
            <div className="profile-action-row">
              <button className="button button-primary" disabled={emailChangeLoading}>{emailChangeLoading ? 'Sending code…' : 'Send verification code'}</button>
              <button className="button button-outline" type="button" onClick={cancelEmailChange}>Cancel</button>
            </div>
          </form> : <form className="settings-form" onSubmit={verifyEmailChange}>
            <div className="success-message" role="status">Enter the six-digit code sent to <b>{newEmail}</b>. Your current email remains active until the code is verified.</div>
            <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={emailOtp} onChange={(event) => setEmailOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
            {emailChangeError && <div className="form-error" role="alert">{emailChangeError}</div>}
            {emailChangeMessage && <div className="success-message" role="status">{emailChangeMessage}</div>}
            <div className="profile-action-row">
              <button className="button button-primary" disabled={emailChangeLoading || emailOtp.length !== 6}>{emailChangeLoading ? 'Verifying…' : 'Verify and update email'}</button>
              <button className="button button-outline" type="button" onClick={() => { setEmailOtpSent(false); setEmailPassword(''); setEmailOtp(''); setEmailChangeError(''); setEmailChangeMessage('') }}>Use a different email</button>
              <button className="button button-outline" type="button" onClick={cancelEmailChange}>Cancel</button>
            </div>
          </form>}
        </section>}
      </div>
    </div>
  </>
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action && <div className="heading-action">{action}</div>}</div>
}

function StatCard({ label, value, note, icon: Icon, accent = 'blue', trend, highlighted = false, to, onClick, selected = false }: { label: string; value: string | number; note: string; icon: typeof Users; accent?: string; trend?: 'up' | 'down'; highlighted?: boolean; to?: string; onClick?: () => void; selected?: boolean }) {
  const className = `stat-card${highlighted ? ' stat-card-highlight' : ''}${selected ? ' is-selected' : ''}`
  const content = <>
    <span className="stat-top"><span>{label}</span><span className={`stat-icon ${accent}`}><Icon size={19} strokeWidth={1.8} /></span></span>
    <strong className="stat-value">{value}</strong>
    <span className="stat-note">{trend && <span className={`trend ${trend}`}>{trend === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}</span>}{note}</span>
  </>
  return to
    ? <NavLink className="stat-card-link" to={to} aria-label={`${label}: ${value}. ${note}. View details.`}><article className={className}>{content}</article></NavLink>
    : onClick
      ? <button className={`${className} stat-card-action`} type="button" onClick={onClick} aria-pressed={selected} aria-label={`${label}: ${value}. ${note}. Filter details.`}>{content}</button>
      : <article className={className}>{content}</article>
}

function LoadingState() {
  return <div className="loading-state"><span className="spinner" /> Loading dashboard data…</div>
}

function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="error-state"><div><b>We couldn’t load this data</b><p>{message}</p></div>{retry && <button className="button button-outline" onClick={retry}>Try again</button>}</div>
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="empty-state"><div className="empty-icon"><CircleHelp size={22} /></div><b>{title}</b><p>{message}</p></div>
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value || 0)
}

function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function formatTime(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

function StatusBadge({ value }: { value?: string }) {
  const status = (value || 'unknown').toLowerCase()
  return <span className={`status-badge ${status.replace(/[^a-z-]/g, '-')}`}><i />{status.replace(/_/g, ' ')}</span>
}

interface AdminOverviewData {
  overview: {
    users: number
    facilities: number
    activeFacilities: number
    accessEnabledFacilities: number
    activeQRCodes: number
    totalAccesses: number
    todayAccesses: number
    totalTransactions: number
    completedPoints: number
    activeOnePassSubscriptions: number
    activeFacilityPackages: number
    completedTransactions: number
  }
  usersByRole: Record<string, number>
  facilitiesByStatus: Record<string, number>
  activity: { date: string; checkIns: number }[]
}

function AccessActivityChart({ activity, todayAccesses, title, description }: {
  activity: AdminOverviewData['activity']
  todayAccesses: number
  title: string
  description: string
}) {
  const maxActivity = Math.max(1, ...activity.map((item) => item.checkIns))

  return <article className="panel activity-panel">
    <div className="panel-heading"><div><h2>{title}</h2><p>{description}</p></div><span className="panel-period">LAST 7 DAYS</span></div>
    <div className="chart-area">
      {activity.map((item) => <div className="chart-column" key={item.date} title={`${item.checkIns} check-ins`}><span className="chart-count">{item.checkIns || ''}</span><div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(4, (item.checkIns / maxActivity) * 100)}%` }} /></div><span className="chart-day">{new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(`${item.date}T12:00:00Z`))}</span></div>)}
    </div>
    <div className="chart-footnote"><span><i className="legend-dot" /> Facility check-ins</span><b>{formatNumber(todayAccesses)} <small>today</small></b></div>
  </article>
}

function AdminOverview({ token }: { token: string }) {
  const { data, loading, error, reload } = useResource<AdminOverviewData>(token, '/dashboard/admin/overview')
  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error || 'No overview data was returned.'} retry={reload} />
  const facilityStatusRows = [
    { label: 'Active', value: data.facilitiesByStatus.active || 0, tone: 'teal' },
    { label: 'Pending', value: data.facilitiesByStatus.pending || 0, tone: 'orange' },
    { label: 'Suspended', value: data.facilitiesByStatus.suspended || 0, tone: 'red' },
    { label: 'Inactive', value: data.facilitiesByStatus.inactive || 0, tone: 'slate' },
  ]
  const maxFacilityStatus = Math.max(1, ...facilityStatusRows.map((row) => row.value))

  return <>
    <PageHeading eyebrow="PLATFORM OVERVIEW" title="Good day, admin." description="Here’s what’s happening across your OnePass network." action={<span className="date-chip"><Activity size={15} />{sessionStorage.getItem(DATA_MODE_KEY) === 'demo' ? 'Sample dashboard data' : 'Live platform data'}</span>} />
    <section className="stats-grid">
      <StatCard label="Total users" value={formatNumber(data.overview.users)} note={`${formatNumber(data.usersByRole.traveler || 0)} user accounts`} icon={Users} accent="violet" highlighted to="/admin/users" />
      <StatCard label="Facilities" value={formatNumber(data.overview.facilities)} note={`${formatNumber(data.overview.activeFacilities)} active locations`} icon={Building2} accent="teal" to="/admin/facilities" />
      <StatCard label="Access check-ins" value={formatNumber(data.overview.totalAccesses)} note={`${formatNumber(data.overview.todayAccesses)} today`} icon={QrCode} accent="orange" trend="up" to="/admin/accesses" />
      <StatCard label="Points processed" value={formatNumber(data.overview.completedPoints)} note={`${formatNumber(data.overview.completedTransactions)} completed transactions`} icon={CreditCard} accent="blue" to="/admin/transactions?status=completed" />
    </section>
    <section className="dashboard-grid">
      <AccessActivityChart activity={data.activity} todayAccesses={data.overview.todayAccesses} title="Access activity" description="Daily check-ins across the last 7 days" />
      <article className="panel distribution-panel overview-status-panel">
        <div className="panel-heading"><div><h2>Facility status</h2><p>Locations by current operating state</p></div><span className="snapshot-icon facilities"><Building2 size={17} /></span></div>
        <div className="distribution-list compact-distribution">{facilityStatusRows.map((row) => <div className="distribution-row" key={row.label}><div className="distribution-label"><span>{row.label}</span><b>{formatNumber(row.value)}</b></div><div className="distribution-track"><span className={`distribution-fill ${row.tone}`} style={{ width: `${Math.max(3, (row.value / maxFacilityStatus) * 100)}%` }} /></div></div>)}</div>
      </article>
    </section>
    <div className="insight-strip"><span className="insight-mark"><ShieldCheck size={18} /></span><p><b>{sessionStorage.getItem(DATA_MODE_KEY) === 'demo' ? 'This is sample data.' : 'Your network is up to date.'}</b> {sessionStorage.getItem(DATA_MODE_KEY) === 'demo' ? 'Demo changes are temporary and do not update OnePass records.' : 'Dashboard metrics are calculated directly from current OnePass records.'}</p><span className="insight-tag">{sessionStorage.getItem(DATA_MODE_KEY) === 'demo' ? 'DEMO' : 'LIVE'}</span></div>
  </>
}

function AdminAnalytics({ token }: { token: string }) {
  const { data, loading, error, reload } = useResource<AdminOverviewData>(token, '/dashboard/admin/overview')
  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error || 'No analytics data was returned.'} retry={reload} />

  const roleRows = [
    { label: 'Users', value: data.usersByRole.traveler || 0, tone: 'blue' },
    { label: 'Facility accounts', value: data.usersByRole.facility || 0, tone: 'teal' },
    { label: 'Admins', value: data.usersByRole.admin || 0, tone: 'violet' },
  ]
  const statusRows = [
    { label: 'Active', value: data.facilitiesByStatus.active || 0, tone: 'teal' },
    { label: 'Pending approval', value: data.facilitiesByStatus.pending || 0, tone: 'orange' },
    { label: 'Suspended', value: data.facilitiesByStatus.suspended || 0, tone: 'red' },
    { label: 'Inactive', value: data.facilitiesByStatus.inactive || 0, tone: 'slate' },
  ]
  const maxUsers = Math.max(1, ...roleRows.map((row) => row.value))
  const maxFacilities = Math.max(1, ...statusRows.map((row) => row.value))

  return <>
    <PageHeading eyebrow="NETWORK INSIGHTS" title="Analytics" description="Explore account, facility, access and points activity." action={<NavLink className="button button-primary" to="/admin/approvals"><Check size={16} /> Review facilities</NavLink>} />
    <section className="stats-grid">
      <StatCard label="Total users" value={formatNumber(data.overview.users)} note="Across all account roles" icon={Users} accent="violet" to="/admin/users" />
      <StatCard label="Access check-ins" value={formatNumber(data.overview.totalAccesses)} note={`${formatNumber(data.overview.todayAccesses)} today`} icon={QrCode} accent="orange" to="/admin/accesses" />
      <StatCard label="Points processed" value={formatNumber(data.overview.completedPoints)} note="Completed ledger activity" icon={CreditCard} accent="blue" to="/admin/transactions?status=completed" />
      <StatCard label="Pending approvals" value={formatNumber(data.facilitiesByStatus.pending || 0)} note="Facilities awaiting review" icon={Building2} accent="teal" to="/admin/approvals" />
    </section>
    <section className="analytics-grid">
      <AccessActivityChart activity={data.activity} todayAccesses={data.overview.todayAccesses} title="Check-in trend" description="Daily access over the last seven days" />
      <article className="panel distribution-panel">
        <div className="panel-heading"><div><h2>Account mix</h2><p>Registered accounts by role</p></div><span className="snapshot-icon users"><Users size={17} /></span></div>
        <div className="distribution-list">{roleRows.map((row) => <div className="distribution-row" key={row.label}><div className="distribution-label"><span>{row.label}</span><b>{formatNumber(row.value)}</b></div><div className="distribution-track"><span className={`distribution-fill ${row.tone}`} style={{ width: `${Math.max(3, (row.value / maxUsers) * 100)}%` }} /></div></div>)}</div>
      </article>
      <article className="panel distribution-panel facility-status-panel">
        <div className="panel-heading"><div><h2>Facility status</h2><p>Current review and access status</p></div><span className="snapshot-icon facilities"><Building2 size={17} /></span></div>
        <div className="distribution-list">{statusRows.map((row) => <div className="distribution-row" key={row.label}><div className="distribution-label"><span>{row.label}</span><b>{formatNumber(row.value)}</b></div><div className="distribution-track"><span className={`distribution-fill ${row.tone}`} style={{ width: `${Math.max(3, (row.value / maxFacilities) * 100)}%` }} /></div></div>)}</div>
      </article>
      <article className="panel analytics-callout"><span className="insight-mark"><ShieldCheck size={18} /></span><div><b>Decisions backed by data</b><p>Use the review queue to approve new facilities and inspect their submitted details.</p><NavLink className="text-link" to="/admin/approvals">Open review queue <ChevronRight size={15} /></NavLink></div></article>
    </section>
  </>
}

function SearchToolbar({ value, onChange, onSearch, placeholder = 'Search records...' }: { value: string; onChange: (value: string) => void; onSearch: () => void; placeholder?: string }) {
  return <form className="search-toolbar" onSubmit={(event) => { event.preventDefault(); onSearch() }}><div className="search-field"><Search size={17} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /><button type="submit">Search</button></div></form>
}

function Pager({ pagination, onPage }: { pagination: Paged<unknown>['pagination']; onPage: (page: number) => void }) {
  if (!pagination.total) return null
  return <div className="pager"><span>Showing <b>{(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)}</b> of <b>{formatNumber(pagination.total)}</b></span><div><button className="icon-button" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button><span>Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span><button className="icon-button" disabled={pagination.page >= pagination.totalPages} onClick={() => onPage(pagination.page + 1)} aria-label="Next page"><ChevronRight size={17} /></button></div></div>
}

function usePagedPath(base: string, page: number, search: string, filters = '') {
  const params = new URLSearchParams({ page: String(page), limit: '10' })
  if (search.trim()) params.set('search', search.trim())
  if (filters) new URLSearchParams(filters).forEach((value, key) => params.set(key, value))
  return `${base}?${params.toString()}`
}

interface AdminUser {
  _id: string
  fullName: string
  email: string
  role: string
  city?: string
  lastLoginDeviceType?: 'mobile' | 'pc/laptop' | 'unknown'
  isEmailVerified: boolean
  createdAt: string
}

function AdminUsers({ token }: { token: string }) {
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const path = usePagedPath('/dashboard/admin/users', page, search, role ? `role=${role}` : '')
  const { data, loading, error, reload } = useResource<Paged<AdminUser>>(token, path)
  const summary = useResource<AdminOverviewData>(token, '/dashboard/admin/overview')
  const roleRows = summary.data ? [
    { label: 'Users', value: summary.data.usersByRole.traveler || 0, tone: 'blue' },
    { label: 'Facility accounts', value: summary.data.usersByRole.facility || 0, tone: 'teal' },
    { label: 'Admins', value: summary.data.usersByRole.admin || 0, tone: 'violet' },
  ] : []
  const maxRoleCount = Math.max(1, ...roleRows.map((row) => row.value))
  function filterByRole(nextRole: string) {
    setPage(1)
    setRole(nextRole)
  }
  return <>
    <PageHeading eyebrow="PEOPLE & CREDENTIALS" title="Users & Credential Accounts" description="Review account identities, roles, device types, and verification status across OnePass." />
    {summary.error && <ErrorState message={summary.error} retry={summary.reload} />}
    {summary.data && <section className="stats-grid list-summary-grid">
      <StatCard label="Total accounts" value={formatNumber(summary.data.overview.users)} note="All account roles" icon={Users} accent="blue" highlighted onClick={() => filterByRole('')} selected={!role} />
      <StatCard label="User accounts" value={formatNumber(summary.data.usersByRole.traveler || 0)} note="OnePass members" icon={Users} accent="violet" onClick={() => filterByRole('traveler')} selected={role === 'traveler'} />
      <StatCard label="Facility accounts" value={formatNumber(summary.data.usersByRole.facility || 0)} note="Facility operators" icon={Building2} accent="teal" onClick={() => filterByRole('facility')} selected={role === 'facility'} />
      <StatCard label="Admin accounts" value={formatNumber(summary.data.usersByRole.admin || 0)} note="Platform administrators" icon={ShieldCheck} accent="orange" onClick={() => filterByRole('admin')} selected={role === 'admin'} />
    </section>}
    {summary.data && <section className="panel distribution-panel account-role-panel">
      <div className="panel-heading"><div><h2>Account role mix</h2><p>Registered accounts grouped by permission role</p></div><span className="snapshot-icon users"><Users size={17} /></span></div>
      <div className="distribution-list">{roleRows.map((row) => <div className="distribution-row" key={row.label}><div className="distribution-label"><span>{row.label}</span><b>{formatNumber(row.value)}</b></div><div className="distribution-track"><span className={`distribution-fill ${row.tone}`} style={{ width: `${(row.value / maxRoleCount) * 100}%` }} /></div></div>)}</div>
    </section>}
    <section className="panel data-panel">
      <div className="panel-heading table-heading"><div><h2>User directory</h2><p>Personal account details are limited to what’s needed for administration.</p></div><span className="result-count">{data ? formatNumber(data.pagination.total) : '—'} records</span></div>
      <div className="data-filter-toolbar">
        <SearchToolbar value={draft} onChange={setDraft} onSearch={() => { setPage(1); setSearch(draft) }} placeholder="Search name, email or city" />
        <label className="filter-control">Role<select value={role} onChange={(event) => { setPage(1); setRole(event.target.value) }}><option value="">All roles</option><option value="traveler">User</option><option value="facility">Facility</option><option value="admin">Admin</option></select></label>
      </div>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={reload} /> : !data?.items.length ? <EmptyState title="No users found" message="Try a different search or clear the current filter." /> :
        <div className="table-scroll"><table><thead><tr><th>USER</th><th>ROLE</th><th>CITY</th><th>DEVICE TYPE</th><th>VERIFICATION</th><th>JOINED</th></tr></thead><tbody>
          {data.items.map((user) => <tr key={user._id}><td><div className="identity-cell"><div className="avatar small">{user.fullName?.charAt(0) || 'U'}</div><span><b>{user.fullName}</b><small>{user.email}</small></span></div></td><td><span className={`role-pill ${user.role}`}>{user.role === 'traveler' ? 'User' : user.role}</span></td><td>{user.city || '—'}</td><td className="device-type-cell">{user.lastLoginDeviceType === 'mobile' ? 'Mobile' : user.lastLoginDeviceType === 'pc/laptop' ? 'PC/Laptop' : 'Unknown'}</td><td><StatusBadge value={user.isEmailVerified ? 'verified' : 'pending'} /></td><td>{formatDate(user.createdAt)}</td></tr>)}
        </tbody></table></div>}
      {data && <Pager pagination={data.pagination} onPage={setPage} />}
    </section>
  </>
}

interface AdminFacility extends FacilityInfo {
  createdAt: string
  isTestData: boolean
}

interface FacilityInfoQR {
  facility: {
    id: string
    name: string
    category: string
    address: string
    city: string
    description: string
    amenities: string[]
    operatingHours: string[]
    timeZone: string
    latitude?: number
    longitude?: number
  }
  payload: string
}

function AdminFacilities({ token, initialStatus = '' }: { token: string; initialStatus?: string }) {
  const location = useLocation()
  const routeStatus = new URLSearchParams(location.search).get('status') || initialStatus
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(routeStatus)
  const [selectedFacility, setSelectedFacility] = useState<AdminFacility | null>(null)
  const path = usePagedPath('/dashboard/admin/facilities', page, search, status ? `status=${status}` : '')
  const { data, loading, error, reload } = useResource<Paged<AdminFacility>>(token, path)
  const summary = useResource<AdminOverviewData>(token, '/dashboard/admin/overview')
  useEffect(() => {
    setPage(1)
    setStatus(routeStatus)
  }, [routeStatus])
  function filterByStatus(nextStatus: string) {
    setPage(1)
    setStatus(nextStatus)
  }
  return <>
    <PageHeading eyebrow={initialStatus ? 'REVIEW QUEUE' : 'NETWORK'} title={initialStatus ? (status === 'pending' ? 'Facility approvals' : 'Facility review') : 'Connected Facilities & Venues'} description={initialStatus ? 'Review facility submissions and record an approval decision.' : 'Review facility ownership, operating status, and access readiness across your network.'} action={!initialStatus && <NavLink className="button button-outline" to="/admin/facility-qr"><QrCode size={16} /> Generate facility QR</NavLink>} />
    {summary.error && <ErrorState message={summary.error} retry={summary.reload} />}
    {summary.data && <section className="stats-grid facility-stats list-summary-grid">
      <StatCard label="Total facilities" value={formatNumber(summary.data.overview.facilities)} note="Registered locations" icon={Building2} accent="blue" onClick={() => filterByStatus('')} selected={!status} />
      <StatCard label="Active" value={formatNumber(summary.data.facilitiesByStatus.active || 0)} note="Currently approved" icon={Activity} accent="teal" highlighted onClick={() => filterByStatus('active')} selected={status === 'active'} />
      <StatCard label="Pending review" value={formatNumber(summary.data.facilitiesByStatus.pending || 0)} note="Awaiting an admin decision" icon={Check} accent="orange" onClick={() => filterByStatus('pending')} selected={status === 'pending'} />
      <StatCard label="Suspended" value={formatNumber(summary.data.facilitiesByStatus.suspended || 0)} note="Access temporarily disabled" icon={ShieldCheck} accent="violet" onClick={() => filterByStatus('suspended')} selected={status === 'suspended'} />
    </section>}
    <section className="panel data-panel">
      <div className="panel-heading table-heading"><div><h2>{status === 'pending' ? 'Pending submissions' : 'Facility directory'}</h2><p>{status === 'pending' ? 'These facilities are waiting for an admin decision.' : 'All facilities registered on the OnePass network.'}</p></div><span className="result-count">{data ? formatNumber(data.pagination.total) : '—'} records</span></div>
      <div className="data-filter-toolbar">
        <SearchToolbar value={draft} onChange={setDraft} onSearch={() => { setPage(1); setSearch(draft) }} placeholder="Search facility, city or category" />
        <label className="filter-control">Status<select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value) }}><option value="">All statuses</option><option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="inactive">Inactive</option></select></label>
      </div>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={reload} /> : !data?.items.length ? <EmptyState title="No facilities found" message="Try changing your search terms." /> :
        <div className="facility-card-grid admin-facility-grid">{data.items.map((facility) => <article className="facility-card admin-facility-card" key={facility._id}>
          <div className="facility-card-top"><span className="facility-card-icon"><Building2 size={20} /></span><StatusBadge value={facility.status} /></div>
          <h2>{facility.name}</h2><p className="facility-category">{facility.category}{facility.isTestData ? ' · test data' : ''}</p>
          <div className="facility-location"><MapPin size={15} /><span>{facility.city}{facility.address ? ` · ${facility.address}` : ''}</span></div>
          <div className="admin-facility-owner"><span>Account owner</span><b>{facility.owner?.fullName || 'Unassigned'}</b>{facility.owner?.email && <small>{facility.owner.email}</small>}</div>
          <div className="facility-card-meta"><span><QrCode size={15} /> Access</span><StatusBadge value={facility.accessEnabled ? 'enabled' : 'disabled'} /></div>
          <div className="facility-card-actions"><NavLink className="button button-outline" to={`/admin/facility-qr?facilityId=${encodeURIComponent(facility._id)}`}><QrCode size={14} /> Info QR</NavLink><button className="button button-outline" onClick={() => setSelectedFacility(facility)}>{facility.status === 'active' ? 'Suspend facility' : facility.status === 'pending' ? 'Review & approve' : 'Activate facility'}</button></div>
        </article>)}</div>}
      {data && <Pager pagination={data.pagination} onPage={setPage} />}
    </section>
    {selectedFacility && <FacilityStatusDialog token={token} facility={selectedFacility} onClose={() => setSelectedFacility(null)} onSaved={() => { reload(); summary.reload() }} />}
  </>
}

function AdminFacilityQRs({ token }: { token: string }) {
  const location = useLocation()
  const requestedFacilityId = new URLSearchParams(location.search).get('facilityId') || ''
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [selectedFacilityId, setSelectedFacilityId] = useState(requestedFacilityId)
  const path = usePagedPath('/dashboard/admin/facilities', page, search)
  const { data, loading, error, reload } = useResource<Paged<AdminFacility>>(token, path)

  useEffect(() => {
    setSelectedFacilityId(requestedFacilityId)
  }, [requestedFacilityId])

  return <>
    <PageHeading eyebrow="FACILITY MATERIALS" title="Facility QR generator" description="Create a unique information QR for any facility. Scanning it shows the facility details; it does not grant access or replace check-in QR codes." action={<NavLink className="button button-outline" to="/admin/facilities"><Building2 size={16} /> View facilities</NavLink>} />
    <div className="facility-qr-layout">
      <section className="panel data-panel">
        <div className="panel-heading table-heading"><div><h2>Choose a facility</h2><p>Select any facility in the system to generate its details QR.</p></div><span className="result-count">{data ? `${formatNumber(data.pagination.total)} facilities` : '—'}</span></div>
        <div className="data-filter-toolbar">
          <SearchToolbar value={draft} onChange={setDraft} onSearch={() => { setPage(1); setSearch(draft) }} placeholder="Search facility, city or category" />
          <button className="button button-outline toolbar-refresh" type="button" onClick={reload}>Refresh</button>
        </div>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={reload} /> : !data?.items.length ? <EmptyState title="No facilities found" message="Try another search, or add a facility first." /> :
          <div className="facility-card-grid admin-facility-grid facility-qr-card-grid">{data.items.map((facility) => <article className={`facility-card admin-facility-card${selectedFacilityId === facility._id ? ' selected-qr-facility' : ''}`} key={facility._id}>
            <div className="facility-card-top"><span className="facility-card-icon"><Building2 size={20} /></span><StatusBadge value={facility.status} /></div>
            <h2>{facility.name}</h2><p className="facility-category">{facility.category}</p>
            <div className="facility-location"><MapPin size={15} /><span>{facility.city}{facility.address ? ` · ${facility.address}` : ''}</span></div>
            <div className="facility-card-actions"><button className="button button-primary" type="button" onClick={() => setSelectedFacilityId(facility._id)}><QrCode size={15} />{selectedFacilityId === facility._id ? 'Selected' : 'Generate info QR'}</button></div>
          </article>)}</div>}
        {data && <Pager pagination={data.pagination} onPage={setPage} />}
      </section>
      {selectedFacilityId
        ? <FacilityInfoQRPreview token={token} facilityId={selectedFacilityId} />
        : <section className="panel facility-qr-preview"><EmptyState title="Select a facility" message="Choose a facility to preview its unique information QR." /></section>}
    </div>
  </>
}

function FacilityInfoQRPreview({ token, facilityId }: { token: string; facilityId: string }) {
  const { data, loading, error, reload } = useResource<FacilityInfoQR>(token, `/dashboard/admin/facilities/${encodeURIComponent(facilityId)}/info-qr`)

  return <section className="panel facility-qr-preview">
    <div className="panel-heading"><div><h2>Information QR</h2><p>Unique to this facility; safe to scan without OnePass sign-in.</p></div><span className="facility-card-icon"><QrCode size={19} /></span></div>
    {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={reload} /> : data ? <>
      <div className="facility-qr-code"><QRCodeSVG value={data.payload} size={240} level="M" includeMargin title={`${data.facility.name} information QR`} /></div>
      <div className="facility-qr-details">
        <span className="facility-category">{data.facility.category}</span>
        <h3>{data.facility.name}</h3>
        <p><MapPin size={14} />{[data.facility.address, data.facility.city].filter(Boolean).join(', ')}</p>
        {data.facility.description && <p className="facility-qr-description">{data.facility.description}</p>}
        {data.facility.amenities.length > 0 && <div className="facility-qr-detail-row"><b>Amenities</b><span>{data.facility.amenities.join(' · ')}</span></div>}
        {data.facility.operatingHours.length > 0 && <div className="facility-qr-detail-row"><b>Operating hours</b><span>{data.facility.operatingHours.join(' · ')}</span></div>}
        <small>Facility ID: {data.facility.id}</small>
      </div>
      <div className="facility-qr-notice"><ShieldCheck size={15} /><span>This QR contains facility listing details only. It is not a facility access token.</span></div>
    </> : null}
  </section>
}

function FacilityStatusDialog({ token, facility, onClose, onSaved }: { token: string; facility: AdminFacility; onClose: () => void; onSaved: () => void }) {
  const status = facility.status === 'active' ? 'suspended' : 'active'
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await request(token, `/dashboard/admin/facilities/${encodeURIComponent(facility._id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason }),
      })
      onSaved()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update facility status.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="qr-modal form-modal" role="dialog" aria-modal="true" aria-labelledby="facility-status-title">
      <div className="modal-heading"><div><span className="eyebrow">ADMIN REVIEW</span><h2 id="facility-status-title">{status === 'active' ? 'Approve facility' : 'Suspend facility'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <p className="modal-subtitle">{facility.name} · {facility.city}</p>
      <form className="editor-form" onSubmit={submit}>
        <label htmlFor="status-reason">Reason for this status change</label>
        <textarea id="status-reason" required maxLength={250} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Add a short audit note" />
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button button-primary full-button" disabled={loading}>{loading ? 'Saving…' : status === 'active' ? 'Approve and activate' : 'Suspend facility'}</button>
      </form>
    </section>
  </div>
}

interface AdminTransaction {
  _id: string
  traveler?: { fullName: string; email: string } | null
  type: string
  status: string
  points: number
  description: string
  source: string
  createdAt: string
}

function AdminTransactions({ token }: { token: string }) {
  const location = useLocation()
  const routeFilters = new URLSearchParams(location.search)
  const routeStatus = routeFilters.get('status') || ''
  const routeType = routeFilters.get('type') || ''
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState(routeStatus)
  const [type, setType] = useState(routeType)
  const filters = new URLSearchParams()
  if (status) filters.set('status', status)
  if (type) filters.set('type', type)
  const path = usePagedPath('/dashboard/admin/transactions', page, '', filters.toString())
  const { data, loading, error, reload } = useResource<Paged<AdminTransaction>>(token, path)
  const summary = useResource<AdminOverviewData>(token, '/dashboard/admin/overview')
  useEffect(() => {
    setPage(1)
    setStatus(routeStatus)
    setType(routeType)
  }, [routeStatus, routeType])
  function filterTransactions(nextStatus: string, nextType: string) {
    setPage(1)
    setStatus(nextStatus)
    setType(nextType)
  }
  return <>
    <PageHeading eyebrow="ACTIVITY & FINANCE" title="Transactions & Billing Ledger" description="Review OnePass point movements, active subscriptions, and transaction outcomes." />
    {summary.error && <ErrorState message={summary.error} retry={summary.reload} />}
    {summary.data && <section className="stats-grid list-summary-grid">
      <StatCard label="Points processed" value={formatNumber(summary.data.overview.completedPoints)} note={`${formatNumber(summary.data.overview.completedTransactions)} completed transactions`} icon={CreditCard} accent="blue" highlighted onClick={() => filterTransactions('completed', '')} selected={status === 'completed' && !type} />
      <StatCard label="Completed transactions" value={formatNumber(summary.data.overview.completedTransactions)} note="Successful ledger entries" icon={Activity} accent="teal" onClick={() => filterTransactions('completed', '')} selected={status === 'completed' && !type} />
      <StatCard label="Active OnePass passes" value={formatNumber(summary.data.overview.activeOnePassSubscriptions)} note="Current subscriptions" icon={QrCode} accent="violet" onClick={() => filterTransactions('', 'purchase')} selected={type === 'purchase' && !status} />
      <StatCard label="Facility packages" value={formatNumber(summary.data.overview.activeFacilityPackages)} note="Active facility plans" icon={Building2} accent="orange" onClick={() => filterTransactions('', 'package_access')} selected={type === 'package_access' && !status} />
    </section>}
    <section className="panel data-panel">
      <div className="panel-heading table-heading"><div><h2>Recent transactions</h2><p>Point movements are shown as points, not currency.</p></div><span className="result-count">{data ? formatNumber(data.pagination.total) : '—'} records</span></div>
      <div className="data-filter-toolbar transaction-filter-toolbar">
        <label className="filter-control">Status<select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value) }}><option value="">All statuses</option><option value="pending">Pending</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="reversed">Reversed</option></select></label>
        <label className="filter-control">Type<select value={type} onChange={(event) => { setPage(1); setType(event.target.value) }}><option value="">All types</option><option value="purchase">Purchase</option><option value="bonus">Bonus</option><option value="debit">Debit</option><option value="pass_debit">Pass debit</option><option value="package_access">Package access</option><option value="refund">Refund</option><option value="admin_credit">Admin credit</option><option value="adjustment">Adjustment</option></select></label>
        <button className="button button-outline toolbar-refresh" onClick={reload}>Refresh</button>
      </div>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={reload} /> : !data?.items.length ? <EmptyState title="No transactions yet" message="Transactions will appear here as activity occurs." /> :
        <div className="table-scroll"><table><thead><tr><th>USER</th><th>TYPE</th><th>DESCRIPTION</th><th>POINTS</th><th>STATUS</th><th>DATE</th></tr></thead><tbody>
          {data.items.map((transaction) => <tr key={transaction._id}><td>{transaction.traveler ? <span className="owner-cell"><b>{transaction.traveler.fullName}</b><small>{transaction.traveler.email}</small></span> : '—'}</td><td><span className="type-label">{transaction.type.replace(/_/g, ' ')}</span></td><td className="description-cell">{transaction.description || transaction.source.replace(/_/g, ' ')}</td><td className="points-cell">{transaction.points.toLocaleString()} <small>pts</small></td><td><StatusBadge value={transaction.status} /></td><td>{formatTime(transaction.createdAt)}</td></tr>)}
        </tbody></table></div>}
      {data && <Pager pagination={data.pagination} onPage={setPage} />}
    </section>
  </>
}

function AccessTable({ accesses }: { accesses: AccessInfo[] }) {
  if (!accesses.length) return <EmptyState title="No check-ins yet" message="Facility access activity will appear here." />
  return <div className="table-scroll"><table><thead><tr><th>USER</th><th>FACILITY</th><th>ACCESS METHOD</th><th>HOURS</th><th>POINTS</th><th>DATE</th></tr></thead><tbody>
    {accesses.map((access) => <tr key={access._id}><td>{access.traveler ? <span className="owner-cell"><b>{access.traveler.fullName}</b><small>{access.traveler.email}</small></span> : '—'}</td><td>{access.facility?.name || '—'}</td><td><span className="type-label">{access.accessMethod?.replace(/_/g, ' ') || '—'}</span></td><td>{access.hoursUsed ?? '—'}</td><td className="points-cell">{access.pointsCharged !== undefined && access.pointsCharged !== null ? <>{access.pointsCharged.toLocaleString()} <small>pts</small></> : '—'}</td><td>{formatTime(access.accessedAt)}</td></tr>)}
  </tbody></table></div>
}

function AdminAccessPoints({ token }: { token: string }) {
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [accessEnabled, setAccessEnabled] = useState('')
  const [hasActiveQr, setHasActiveQr] = useState('')
  const facilityFilters = new URLSearchParams()
  if (status) facilityFilters.set('status', status)
  if (accessEnabled) facilityFilters.set('accessEnabled', accessEnabled)
  if (hasActiveQr) facilityFilters.set('hasActiveQr', hasActiveQr)
  const facilitiesPath = usePagedPath('/dashboard/admin/facilities', page, search, facilityFilters.toString())
  const facilities = useResource<Paged<AdminFacility>>(token, facilitiesPath)
  const activity = useResource<Paged<AccessInfo>>(token, usePagedPath('/dashboard/admin/accesses', 1, ''))
  const summary = useResource<AdminOverviewData>(token, '/dashboard/admin/overview')

  function refresh() {
    facilities.reload()
    activity.reload()
    summary.reload()
  }

  function filterFacilitiesByAccess(nextAccess: string, nextQr: string) {
    setPage(1)
    setStatus('')
    setAccessEnabled(nextAccess)
    setHasActiveQr(nextQr)
  }

  return <>
    <PageHeading eyebrow="OPERATIONS" title="Access Points & QR Check-ins" description="Manage facility QR entry points and review recorded check-ins across OnePass." action={<NavLink className="button button-outline" to="/admin/accesses"><Activity size={16} /> View all check-ins</NavLink>} />
    {summary.error && <ErrorState message={summary.error} retry={summary.reload} />}
    {summary.data && <section className="stats-grid list-summary-grid">
      <StatCard label="Access-enabled facilities" value={formatNumber(summary.data.overview.accessEnabledFacilities)} note="Configured for QR entry" icon={Building2} accent="blue" highlighted onClick={() => filterFacilitiesByAccess('true', '')} selected={accessEnabled === 'true' && !hasActiveQr} />
      <StatCard label="Active QR codes" value={formatNumber(summary.data.overview.activeQRCodes)} note="Stored facility access codes" icon={QrCode} accent="teal" onClick={() => filterFacilitiesByAccess('', 'true')} selected={hasActiveQr === 'true'} />
      <StatCard label="Check-ins today" value={formatNumber(summary.data.overview.todayAccesses)} note="Since midnight UTC" icon={Activity} accent="violet" to="/admin/accesses?period=today" />
      <StatCard label="Total check-ins" value={formatNumber(summary.data.overview.totalAccesses)} note="Recorded facility visits" icon={Users} accent="orange" to="/admin/accesses" />
    </section>}
    <section className="access-points-layout">
      <div className="panel data-panel">
        <div className="panel-heading table-heading"><div><h2>Facility QR access points</h2><p>QR codes are stored as secure tokens; their raw values are never shown here.</p></div><span className="result-count">{facilities.data ? formatNumber(facilities.data.pagination.total) : '—'} facilities</span></div>
        <div className="data-filter-toolbar">
          <SearchToolbar value={draft} onChange={setDraft} onSearch={() => { setPage(1); setSearch(draft) }} placeholder="Search facility, city or category" />
          <label className="filter-control">Status<select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); setAccessEnabled(''); setHasActiveQr('') }}><option value="">All statuses</option><option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="inactive">Inactive</option></select></label>
          <label className="filter-control">QR code<select value={hasActiveQr} onChange={(event) => { setPage(1); setHasActiveQr(event.target.value); setAccessEnabled('') }}><option value="">All QR states</option><option value="true">Active QR</option><option value="false">No active QR</option></select></label>
          <label className="filter-control">Access<select value={accessEnabled} onChange={(event) => { setPage(1); setAccessEnabled(event.target.value); setHasActiveQr('') }}><option value="">All access</option><option value="true">Enabled</option><option value="false">Disabled</option></select></label>
          <button className="button button-outline toolbar-refresh" onClick={refresh}>Refresh</button>
        </div>
        {facilities.loading ? <LoadingState /> : facilities.error ? <ErrorState message={facilities.error} retry={facilities.reload} /> : !facilities.data?.items.length ? <EmptyState title="No access points found" message="Try changing the status or search filters." /> :
          <div className="facility-card-grid admin-facility-grid access-point-grid">{facilities.data.items.map((facility) => <article className="facility-card admin-facility-card access-point-card" key={facility._id}>
            <div className="facility-card-top"><span className="facility-card-icon"><QrCode size={20} /></span><StatusBadge value={facility.status} /></div>
            <h2>{facility.name}</h2><p className="facility-category">{facility.category}</p>
            <div className="facility-location"><MapPin size={15} /><span>{facility.city}{facility.address ? ` · ${facility.address}` : ''}</span></div>
            <div className="admin-facility-owner"><span>QR access</span><b>{facility.activeQr ? 'QR code generated' : 'No QR code generated'}</b><small>{facility.activeQr ? `Created ${formatDate(facility.activeQr.createdAt)}` : facility.accessEnabled ? 'A facility QR code can be generated by its facility account.' : 'This directory listing does not support QR access.'}</small></div>
            <div className="facility-card-meta"><span><ShieldCheck size={15} /> Access status</span><StatusBadge value={facility.accessEnabled && facility.status === 'active' ? 'enabled' : 'disabled'} /></div>
            <div className="facility-card-actions"><NavLink className="button button-outline" to="/admin/accesses">View check-in activity</NavLink></div>
          </article>)}</div>}
        {facilities.data && <Pager pagination={facilities.data.pagination} onPage={setPage} />}
      </div>
      <section className="panel recent-panel access-point-activity">
        <div className="panel-heading"><div><h2>Latest check-ins</h2><p>Recent successful facility access records</p></div><NavLink className="text-link" to="/admin/accesses">Full history <ChevronRight size={15} /></NavLink></div>
        {activity.loading ? <LoadingState /> : activity.error ? <ErrorState message={activity.error} retry={activity.reload} /> : !activity.data?.items.length ? <EmptyState title="No check-ins yet" message="Successful facility check-ins will appear here." /> :
          <div className="access-event-list">{activity.data.items.slice(0, 6).map((access) => <article className="access-event-row" key={access._id}>
            <span className="avatar small">{access.traveler?.fullName?.charAt(0) || 'U'}</span>
            <div className="access-event-content"><b>{access.traveler?.fullName || 'Unknown user'}</b><span>{access.facility?.name || 'Unknown facility'} · {formatTime(access.accessedAt)}</span><small>{access.accessMethod?.replace(/_/g, ' ') || 'Access method not recorded'}</small></div>
            <StatusBadge value="completed" />
          </article>)}</div>}
      </section>
    </section>
  </>
}

interface AuditActivityRecord {
  id: string
  createdAt: string
  actorName: string
  actorEmail: string
  activity: string
  resource: string
  source: 'access' | 'transaction'
  status: string
  points: number | null
}

function AdminAuditLogs({ token }: { token: string }) {
  const [source, setSource] = useState('')
  const [status, setStatus] = useState('')
  const [visibleCount, setVisibleCount] = useState(20)
  const transactions = useResource<Paged<AdminTransaction>>(token, '/dashboard/admin/transactions?page=1&limit=100')
  const accesses = useResource<Paged<AccessInfo>>(token, '/dashboard/admin/accesses?page=1&limit=100')
  const summary = useResource<AdminOverviewData>(token, '/dashboard/admin/overview')
  const records: AuditActivityRecord[] = [
    ...(transactions.data?.items || []).map((transaction) => ({
      id: transaction._id,
      createdAt: transaction.createdAt,
      actorName: transaction.traveler?.fullName || 'Unknown user',
      actorEmail: transaction.traveler?.email || '',
      activity: transaction.description || transaction.type.replace(/_/g, ' '),
      resource: transaction.source.replace(/_/g, ' '),
      source: 'transaction' as const,
      status: transaction.status,
      points: transaction.points,
    })),
    ...(accesses.data?.items || []).map((access) => ({
      id: access._id,
      createdAt: access.accessedAt || '',
      actorName: access.traveler?.fullName || 'Unknown user',
      actorEmail: access.traveler?.email || '',
      activity: `Facility check-in · ${access.accessMethod?.replace(/_/g, ' ') || 'method unavailable'}`,
      resource: access.facility?.name || 'Unknown facility',
      source: 'access' as const,
      status: 'completed',
      points: access.pointsCharged === undefined || access.pointsCharged === null ? null : -access.pointsCharged,
    })),
  ].sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
  const filteredRecords = records.filter((record) =>
    (!source || record.source === source) &&
    (!status || record.status === status)
  )
  const visibleRecords = filteredRecords.slice(0, visibleCount)
  const sourceTotal = (transactions.data?.pagination.total || 0) + (accesses.data?.pagination.total || 0)

  function refresh() {
    transactions.reload()
    accesses.reload()
    summary.reload()
  }

  return <>
    <PageHeading eyebrow="SECURITY & GOVERNANCE" title="Audit Logs & Activity" description="Review recorded check-ins and transaction activity from the selected data source." action={<button className="button button-outline" onClick={refresh}>Refresh records</button>} />
    <div className="audit-disclaimer" role="note"><ShieldCheck size={18} /><p><b>Source-record view, not an immutable security log.</b> OnePass currently stores access and transaction records; admin-action history, severity alerts, and cryptographic chain proofs are not available.</p></div>
    {summary.error && <ErrorState message={summary.error} retry={summary.reload} />}
    {transactions.error && <ErrorState message={transactions.error} retry={transactions.reload} />}
    {accesses.error && <ErrorState message={accesses.error} retry={accesses.reload} />}
    {summary.data && <section className="stats-grid list-summary-grid">
      <StatCard label="Recorded events" value={formatNumber(summary.data.overview.totalAccesses + summary.data.overview.totalTransactions)} note="Check-ins and transactions" icon={Activity} accent="blue" highlighted onClick={() => { setSource(''); setStatus(''); setVisibleCount(20) }} selected={!source && !status} />
      <StatCard label="Access records" value={formatNumber(summary.data.overview.totalAccesses)} note="Successful facility check-ins" icon={QrCode} accent="teal" onClick={() => { setSource('access'); setStatus(''); setVisibleCount(20) }} selected={source === 'access' && !status} />
      <StatCard label="Transactions" value={formatNumber(summary.data.overview.totalTransactions)} note={`${formatNumber(summary.data.overview.completedTransactions)} completed`} icon={CreditCard} accent="violet" onClick={() => { setSource('transaction'); setStatus(''); setVisibleCount(20) }} selected={source === 'transaction' && !status} />
      <StatCard label="Points processed" value={formatNumber(summary.data.overview.completedPoints)} note="Completed ledger movement" icon={Users} accent="orange" onClick={() => { setSource('transaction'); setStatus('completed'); setVisibleCount(20) }} selected={source === 'transaction' && status === 'completed'} />
    </section>}
    {summary.data && <section className="audit-insights">
      <AccessActivityChart activity={summary.data.activity} todayAccesses={summary.data.overview.todayAccesses} title="Access event velocity" description="Recorded check-ins over the last 7 days" />
      <article className="panel distribution-panel audit-source-panel">
        <div className="panel-heading"><div><h2>Recorded data sources</h2><p>Available operational records</p></div><span className="snapshot-icon facilities"><ShieldCheck size={17} /></span></div>
        <div className="distribution-list">
          <div className="distribution-row"><div className="distribution-label"><span>Successful access records</span><b>{formatNumber(summary.data.overview.totalAccesses)}</b></div><div className="distribution-track"><span className="distribution-fill blue" style={{ width: `${summary.data.overview.totalAccesses ? Math.max(3, (summary.data.overview.totalAccesses / Math.max(1, sourceTotal)) * 100) : 0}%` }} /></div></div>
          <div className="distribution-row"><div className="distribution-label"><span>Transaction records</span><b>{formatNumber(summary.data.overview.totalTransactions)}</b></div><div className="distribution-track"><span className="distribution-fill violet" style={{ width: `${summary.data.overview.totalTransactions ? Math.max(3, (summary.data.overview.totalTransactions / Math.max(1, sourceTotal)) * 100) : 0}%` }} /></div></div>
        </div>
        <div className="audit-source-note">These are source records only; they do not include admin setting changes or device telemetry.</div>
      </article>
    </section>}
    <section className="panel data-panel audit-table-panel">
      <div className="panel-heading table-heading"><div><h2>Recent operational records</h2><p>Latest access and transaction entries. Record IDs are shown as stored; no hash verification is implied.</p></div><span className="result-count">{formatNumber(sourceTotal)} records</span></div>
      <div className="data-filter-toolbar audit-filter-toolbar">
        <label className="filter-control">Record source<select value={source} onChange={(event) => { setSource(event.target.value); setVisibleCount(20) }}><option value="">All sources</option><option value="access">Access records</option><option value="transaction">Transactions</option></select></label>
        <label className="filter-control">Status<select value={status} onChange={(event) => { setStatus(event.target.value); setVisibleCount(20) }}><option value="">All statuses</option><option value="completed">Completed</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="reversed">Reversed</option></select></label>
      </div>
      {transactions.loading || accesses.loading ? <LoadingState /> : !visibleRecords.length ? <EmptyState title="No activity records" message="Access and transaction records will appear here when activity is recorded." /> :
        <div className="table-scroll"><table><thead><tr><th>RECORD ID</th><th>TIMESTAMP</th><th>ACTOR</th><th>ACTIVITY</th><th>RESOURCE</th><th>SOURCE</th><th>STATUS</th><th className="text-right">POINTS</th></tr></thead><tbody>
          {visibleRecords.map((record) => <tr key={`${record.source}-${record.id}`}><td className="audit-record-id" title={record.id}>{record.id.slice(-8)}</td><td>{formatTime(record.createdAt)}</td><td><span className="owner-cell"><b>{record.actorName}</b>{record.actorEmail && <small>{record.actorEmail}</small>}</span></td><td className="description-cell">{record.activity}</td><td>{record.resource}</td><td><span className={`role-pill ${record.source === 'access' ? 'facility' : ''}`}>{record.source}</span></td><td><StatusBadge value={record.status} /></td><td className="points-cell text-right">{record.points === null ? '—' : `${record.points > 0 ? '+' : ''}${formatNumber(record.points)} pts`}</td></tr>)}
        </tbody></table></div>}
      {!transactions.loading && !accesses.loading && visibleRecords.length > 0 && <div className="audit-table-footer"><span>Showing latest {visibleRecords.length} of {formatNumber(filteredRecords.length)} loaded records</span>{filteredRecords.length > visibleCount && <button className="button button-outline" onClick={() => setVisibleCount((count) => count + 20)}>Show 20 more</button>}</div>}
    </section>
  </>
}

function AdminAccesses({ token }: { token: string }) {
  const location = useLocation()
  const routePeriod = new URLSearchParams(location.search).get('period') || ''
  const [page, setPage] = useState(1)
  const [period, setPeriod] = useState(routePeriod)
  const path = usePagedPath('/dashboard/admin/accesses', page, '', period ? `period=${period}` : '')
  const { data, loading, error, reload } = useResource<Paged<AccessInfo>>(token, path)
  const summary = useResource<AdminOverviewData>(token, '/dashboard/admin/overview')
  useEffect(() => {
    setPage(1)
    setPeriod(routePeriod)
  }, [routePeriod])
  function filterByPeriod(nextPeriod: string) {
    setPage(1)
    setPeriod(nextPeriod)
  }
  return <>
    <PageHeading eyebrow="NETWORK OPERATIONS" title="Access Activity" description="Review recorded check-ins and facility access activity across OnePass." />
    {summary.error && <ErrorState message={summary.error} retry={summary.reload} />}
    {summary.data && <section className="stats-grid list-summary-grid">
      <StatCard label="Total check-ins" value={formatNumber(summary.data.overview.totalAccesses)} note="Recorded facility visits" icon={QrCode} accent="blue" highlighted onClick={() => filterByPeriod('')} selected={!period} />
      <StatCard label="Today's check-ins" value={formatNumber(summary.data.overview.todayAccesses)} note="Since midnight UTC" icon={Activity} accent="teal" onClick={() => filterByPeriod('today')} selected={period === 'today'} />
      <StatCard label="Active facilities" value={formatNumber(summary.data.overview.activeFacilities)} note="Currently approved" icon={Building2} accent="violet" to="/admin/facilities?status=active" />
      <StatCard label="Points processed" value={formatNumber(summary.data.overview.completedPoints)} note="Completed ledger activity" icon={CreditCard} accent="orange" to="/admin/transactions?status=completed" />
    </section>}
    {summary.data && <AccessActivityChart activity={summary.data.activity} todayAccesses={summary.data.overview.todayAccesses} title="Access activity trend" description="Daily check-ins across the last 7 days" />}
    <section className="panel data-panel">
      <div className="panel-heading table-heading"><div><h2>Check-in history</h2><p>Access events are scoped to successful facility visits.</p></div><span className="result-count">{data ? formatNumber(data.pagination.total) : '—'} records</span></div>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={reload} /> : !data?.items.length ? <EmptyState title="No access activity" message="Completed facility check-ins will appear here." /> : <AccessTable accesses={data.items} />}
      {data && <Pager pagination={data.pagination} onPage={setPage} />}
    </section>
  </>
}

interface FacilityOverviewData {
  overview: {
    facilities: number
    activeFacilities: number
    totalCheckIns: number
    todayCheckIns: number
    activeQRCodes: number
    pointsUsedAtVisits: number
  }
  facilities: FacilityInfo[]
  recentAccesses: AccessInfo[]
}

function FacilityOverview({ token }: { token: string }) {
  const { data, loading, error, reload } = useResource<FacilityOverviewData>(token, '/dashboard/facility/overview')
  const [recentPeriod, setRecentPeriod] = useState('')
  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error || 'No overview data was returned.'} retry={reload} />
  const today = new Date().toISOString().slice(0, 10)
  const recentAccesses = recentPeriod === 'today'
    ? data.recentAccesses.filter((access) => access.accessedAt?.slice(0, 10) === today)
    : data.recentAccesses
  function showRecentAccesses(period: string) {
    setRecentPeriod(period)
    document.getElementById('facility-recent-checkins')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return <>
    <PageHeading eyebrow="FACILITY OVERVIEW" title="Welcome back." description="Your locations and recent access activity, all together." action={<NavLink className="button button-primary" to="/facility/facilities"><Building2 size={16} /> View facilities</NavLink>} />
    <section className="stats-grid facility-stats">
      <StatCard label="My facilities" value={data.overview.facilities} note={`${data.overview.activeFacilities} currently active`} icon={Building2} accent="teal" to="/facility/facilities" />
      <StatCard label="Total check-ins" value={formatNumber(data.overview.totalCheckIns)} note="Across your facilities" icon={QrCode} accent="blue" onClick={() => showRecentAccesses('')} selected={!recentPeriod} />
      <StatCard label="Today's check-ins" value={formatNumber(data.overview.todayCheckIns)} note="Since midnight UTC" icon={Activity} accent="orange" trend="up" onClick={() => showRecentAccesses('today')} selected={recentPeriod === 'today'} />
      <StatCard label="Active QR codes" value={data.overview.activeQRCodes} note="One per active facility" icon={ShieldCheck} accent="violet" to="/facility/facilities" />
      <StatCard label="Points used" value={formatNumber(data.overview.pointsUsedAtVisits)} note="Across all check-ins" icon={CreditCard} accent="blue" onClick={() => showRecentAccesses('')} />
    </section>
    <section className="panel recent-panel" id="facility-recent-checkins">
      <div className="panel-heading"><div><h2>Recent check-ins</h2><p>Latest activity at your facilities</p></div><NavLink className="text-link" to="/facility/facilities">Manage facilities <ChevronRight size={15} /></NavLink></div>
      {recentPeriod === 'today' && <p className="recent-filter-note">Showing today’s check-ins from the latest activity records.</p>}
      {recentAccesses.length ? <AccessTable accesses={recentAccesses} /> : <EmptyState title={recentPeriod === 'today' ? 'No recent check-ins today' : 'No check-ins yet'} message="Check-ins from your facilities will appear here." />}
    </section>
    <div className="insight-strip"><span className="insight-mark"><QrCode size={18} /></span><p><b>QR tokens are shown only once.</b> Save or print a newly generated code right away. Replacing it immediately invalidates the previous code.</p><span className="insight-tag">SECURE</span></div>
  </>
}

function FacilityList({ token }: { token: string }) {
  const { data, loading, error, reload } = useResource<FacilityOverviewData>(token, '/dashboard/facility/overview')
  const [selected, setSelected] = useState<FacilityInfo | null>(null)
  const [editing, setEditing] = useState<FacilityInfo | null | undefined>(undefined)
  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error || 'No facility data was returned.'} retry={reload} />
  return <>
    <PageHeading eyebrow="YOUR LOCATIONS" title="My facilities" description="Create locations, update listing details, manage access codes and review check-ins." action={<button className="button button-primary" onClick={() => setEditing(null)}><Plus size={16} /> Add facility</button>} />
    {!data.facilities.length ? <section className="panel"><EmptyState title="No facilities assigned" message="There are no facilities linked to this account yet. Contact your OnePass administrator for access." /></section> :
      <div className="facility-card-grid">{data.facilities.map((facility) => <article className="facility-card" key={facility._id}>
        <div className="facility-card-top"><span className="facility-card-icon"><Building2 size={20} /></span><StatusBadge value={facility.status} /></div>
        <h2>{facility.name}</h2><p className="facility-category">{facility.category}</p>
        <div className="facility-location"><MapPin size={15} /><span>{facility.city}{facility.address ? ` · ${facility.address}` : ''}</span></div>
        {facility.capacityLimit && <div className="occupancy-line"><span>Live occupancy</span><b>{facility.currentOccupancy || 0} / {facility.capacityLimit}</b></div>}
        <div className="facility-card-meta"><span><CreditCard size={15} /> Points per visit</span><b>{formatNumber(facility.pointsPerVisit || 0)} pts</b></div>
        <div className="facility-card-meta"><span><QrCode size={15} /> Access QR</span><StatusBadge value={facility.activeQr ? 'active' : 'not generated'} /></div>
        <div className="facility-card-actions">
          <NavLink className="button button-outline" to={`/facility/facilities/${facility._id}/accesses`}>Check-ins <ChevronRight size={15} /></NavLink>
          <button className="button button-outline" type="button" onClick={() => setEditing(facility)}><Pencil size={15} /> Edit</button>
          <button className="button button-primary" type="button" disabled={!facility.accessEnabled || facility.status !== 'active'} onClick={() => setSelected(facility)}><QrCode size={15} /> {facility.activeQr ? 'Replace QR' : 'Create QR'}</button>
        </div>
        {!facility.accessEnabled && <p className="card-note">QR access is not enabled for this location.</p>}
      </article>)}</div>}
    {selected && <QrModal token={token} facility={selected} onClose={() => setSelected(null)} onGenerated={reload} />}
    {editing !== undefined && <FacilityEditor token={token} facility={editing} onClose={() => setEditing(undefined)} onSaved={reload} />}
  </>
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ACCESS_METHODS = [
  { value: 'wallet_points', label: 'Wallet points' },
  { value: 'onepass_pass', label: 'OnePass pass' },
  { value: 'facility_package', label: 'Facility package' },
]

function FacilityEditor({ token, facility, onClose, onSaved }: { token: string; facility: FacilityInfo | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: facility?.name || '',
    description: facility?.description || '',
    category: facility?.category || '',
    address: facility?.address || '',
    city: facility?.city || '',
    pointsPerVisit: String(facility?.pointsPerVisit || 1),
    pointsPerHour: String(facility?.pointsPerHour || 1),
    capacityLimit: facility?.capacityLimit ? String(facility.capacityLimit) : '',
    latitude: facility?.latitude === undefined ? '' : String(facility.latitude),
    longitude: facility?.longitude === undefined ? '' : String(facility.longitude),
    amenities: facility?.amenities?.join(', ') || '',
    photos: facility?.photos?.join('\n') || '',
    timeZone: facility?.timeZone || 'UTC',
    holidays: facility?.holidayClosures?.map((closure) =>
      `${closure.date.slice(0, 10)}, ${closure.reason || ''}`.trim()
    ).join('\n') || '',
  })
  const [hours, setHours] = useState(() => WEEKDAYS.map((_, dayOfWeek) => {
    const saved = facility?.operatingHours?.find((entry) => entry.dayOfWeek === dayOfWeek)
    return saved || {
      dayOfWeek,
      open: '08:00',
      close: '20:00',
      closed: Boolean(facility?.operatingHours?.length),
    }
  }))
  const [hoursEnabled, setHoursEnabled] = useState(Boolean(facility?.operatingHours?.length))
  const [methods, setMethods] = useState<string[]>(
    facility?.acceptedAccessMethods?.length
      ? facility.acceptedAccessMethods
      : ACCESS_METHODS.map(({ value }) => value)
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function toggleMethod(method: string) {
    setMethods((current) => current.includes(method)
      ? current.filter((value) => value !== method)
      : [...current, method])
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const holidayClosures = form.holidays.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
        const [date, ...reason] = line.split(',')
        const dateValue = new Date(`${date.trim()}T00:00:00.000Z`)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim()) || Number.isNaN(dateValue.getTime()) || dateValue.toISOString().slice(0, 10) !== date.trim()) {
          throw new Error('Enter each holiday as YYYY-MM-DD, followed by an optional reason.')
        }
        return { date: `${date.trim()}T00:00:00.000Z`, reason: reason.join(',').trim() }
      })
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        pointsPerVisit: Number(form.pointsPerVisit),
        pointsPerHour: Number(form.pointsPerHour),
        capacityLimit: form.capacityLimit ? Number(form.capacityLimit) : null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        amenities: form.amenities.split(',').map((item) => item.trim()).filter(Boolean),
        photos: form.photos.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
        operatingHours: hoursEnabled ? hours : [],
        holidayClosures,
        timeZone: form.timeZone.trim(),
        acceptedAccessMethods: methods,
      }
      await request(token, facility
        ? `/dashboard/facility/facilities/${encodeURIComponent(facility._id)}`
        : '/dashboard/facility/facilities', {
        method: facility ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      })
      onSaved()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save facility details.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="qr-modal facility-editor-modal" role="dialog" aria-modal="true" aria-labelledby="facility-editor-title">
      <div className="modal-heading"><div><span className="eyebrow">FACILITY PROFILE</span><h2 id="facility-editor-title">{facility ? 'Edit facility' : 'Add facility'}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <p className="modal-subtitle">{facility ? 'Changes to facility access and listing details are saved to your account.' : 'New facilities are submitted to OnePass for admin review.'}</p>
      <form className="editor-form" onSubmit={submit}>
        <div className="editor-grid">
          <label>Facility name<input required maxLength={120} value={form.name} onChange={(event) => updateField('name', event.target.value)} /></label>
          <label>Category<input required value={form.category} onChange={(event) => updateField('category', event.target.value)} placeholder="Gym, library, pool…" /></label>
          <label>City<input required value={form.city} onChange={(event) => updateField('city', event.target.value)} /></label>
          <label>Street address<input required maxLength={300} value={form.address} onChange={(event) => updateField('address', event.target.value)} /></label>
          <label className="editor-full">Description<textarea maxLength={1000} value={form.description} onChange={(event) => updateField('description', event.target.value)} /></label>
          <label>Points per visit<input type="number" min="1" step="1" required value={form.pointsPerVisit} onChange={(event) => updateField('pointsPerVisit', event.target.value)} /></label>
          <label>Points per hour<input type="number" min="1" step="1" required value={form.pointsPerHour} onChange={(event) => updateField('pointsPerHour', event.target.value)} /></label>
          <label>Capacity limit<input type="number" min="1" step="1" value={form.capacityLimit} onChange={(event) => updateField('capacityLimit', event.target.value)} placeholder="No limit" /></label>
          <label>Time zone<input required value={form.timeZone} onChange={(event) => updateField('timeZone', event.target.value)} placeholder="Asia/Karachi" /></label>
          <label>Latitude<input type="number" min="-90" max="90" step="any" value={form.latitude} onChange={(event) => updateField('latitude', event.target.value)} /></label>
          <label>Longitude<input type="number" min="-180" max="180" step="any" value={form.longitude} onChange={(event) => updateField('longitude', event.target.value)} /></label>
          <label className="editor-full">Amenities <small>Separate items with commas.</small><input value={form.amenities} onChange={(event) => updateField('amenities', event.target.value)} placeholder="Showers, lockers, Wi-Fi" /></label>
          <label className="editor-full">Photo URLs <small>One HTTP or HTTPS image URL per line (up to 8).</small><textarea value={form.photos} onChange={(event) => updateField('photos', event.target.value)} /></label>
          <fieldset className="editor-full access-methods"><legend>Accepted access methods</legend>{ACCESS_METHODS.map(({ value, label }) => <label key={value}><input type="checkbox" checked={methods.includes(value)} onChange={() => toggleMethod(value)} />{label}</label>)}</fieldset>
          <fieldset className="editor-full hours-fieldset"><legend>Operating hours <small>Local facility time</small></legend><label className="hours-enable"><input type="checkbox" checked={hoursEnabled} onChange={(event) => setHoursEnabled(event.target.checked)} /> Enforce a weekly operating schedule</label>{hoursEnabled ? <div className="hours-grid">{hours.map((entry, index) => <div className="hours-row" key={entry.dayOfWeek}><b>{WEEKDAYS[index]}</b><input aria-label={`${WEEKDAYS[index]} opening time`} type="time" value={entry.open} disabled={entry.closed} onChange={(event) => setHours((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, open: event.target.value } : item))} /><span>to</span><input aria-label={`${WEEKDAYS[index]} closing time`} type="time" value={entry.close} disabled={entry.closed} onChange={(event) => setHours((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, close: event.target.value } : item))} /><label><input type="checkbox" checked={entry.closed} onChange={(event) => setHours((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, closed: event.target.checked } : item))} /> Closed</label></div>)}</div> : <p className="hours-unlimited-note">No weekly schedule is configured; access is available any time except listed holiday closures.</p>}</fieldset>
          <label className="editor-full">Holiday closures <small>One date per line: YYYY-MM-DD, optional reason.</small><textarea value={form.holidays} onChange={(event) => updateField('holidays', event.target.value)} placeholder={'2026-12-25, Holiday'} /></label>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="editor-actions"><button className="button button-outline" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={loading}>{loading ? 'Saving…' : facility ? 'Save changes' : 'Submit facility'}</button></div>
      </form>
    </section>
  </div>
}

function QrModal({ token, facility, onClose, onGenerated }: { token: string; facility: FacilityInfo; onClose: () => void; onGenerated: () => void }) {
  const [generated, setGenerated] = useState<{ token: string; qr: { createdAt: string } } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    if (facility.activeQr && !window.confirm('Replacing this QR code will immediately revoke the existing code. Continue?')) return
    setLoading(true)
    setError('')
    setGenerated(null)
    try {
      const result = await request<{ token: string; qr: { createdAt: string } }>(token, '/facility-qr/generate', {
        method: 'POST',
        body: JSON.stringify({ facilityId: facility._id }),
      })
      setGenerated(result)
      onGenerated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not generate the QR code.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title">
      <div className="modal-heading"><div><span className="eyebrow">FACILITY ACCESS</span><h2 id="qr-title">{generated ? 'Your new QR code' : 'Manage access QR'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <p className="modal-subtitle">{facility.name} · {facility.city}</p>
      {error && <div className="form-error" role="alert">{error}</div>}
      {generated ? <div className="qr-result">
        <div className="qr-print-area"><QRCodeSVG value={generated.token} size={220} level="M" includeMargin /><b>{facility.name}</b><small>OnePass facility access</small></div>
        <div className="one-time-note"><ShieldCheck size={17} /><span><b>Save this code now.</b> The token is not stored in readable form and cannot be shown again after you close this window.</span></div>
        <code className="token-display">{generated.token}</code>
        <button className="button button-primary full-button" onClick={() => window.print()}><QrCode size={16} /> Print this QR code</button>
      </div> : <div className="qr-intro">
        <div className="qr-placeholder"><QrCode size={35} /></div>
        <p>{facility.activeQr ? 'A QR code is active for this facility. Replace it to generate a new printable code; the current code will stop working immediately.' : 'Generate a secure QR code for users to check in at this facility.'}</p>
        <button className="button button-primary full-button" onClick={generate} disabled={loading}>{loading ? 'Generating…' : facility.activeQr ? 'Replace active QR code' : 'Generate QR code'} <ChevronRight size={16} /></button>
      </div>}
    </section>
  </div>
}

function FacilityHistory({ token }: { token: string }) {
  const { facilityId = '' } = useParams()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const path = `/dashboard/facility/facilities/${encodeURIComponent(facilityId)}/accesses?page=${page}&limit=20`
  const { data, loading, error, reload } = useResource<Paged<AccessInfo>>(token, path)
  return <>
    <PageHeading eyebrow="FACILITY ACTIVITY" title="Check-in history" description="Successful access events for this facility." action={<button className="button button-outline" onClick={() => navigate('/facility/facilities')}><ChevronLeft size={16} /> All facilities</button>} />
    <section className="panel data-panel">
      <div className="panel-heading table-heading"><div><h2>Access records</h2><p>User and visit details for your facility.</p></div><span className="result-count">{data ? formatNumber(data.pagination.total) : '—'} records</span></div>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={reload} /> : !data?.items.length ? <EmptyState title="No check-ins found" message="Access activity for this facility will appear here." /> : <AccessTable accesses={data.items} />}
      {data && <Pager pagination={data.pagination} onPage={setPage} />}
    </section>
  </>
}

export default App
