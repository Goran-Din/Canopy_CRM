export const translations = {
  en: {
    // Navigation
    dashboard: 'Dashboard',
    jobs: 'Jobs',
    timesheet: 'Timesheet',
    profile: 'Profile',

    // Clock
    clockIn: 'Clock In',
    clockOut: 'Clock Out',
    clockedIn: 'Clocked In',
    clockedOut: 'Clocked Out',
    clockedInSince: 'Clocked in since',
    notClockedIn: 'Not clocked in',

    // Jobs
    startJob: 'Start Job',
    completeJob: 'Complete Job',
    todaysJobs: "Today's Jobs",
    noJobsToday: 'No jobs scheduled for today',
    jobDetails: 'Job Details',
    openInMaps: 'Open in Maps',
    jobChecklist: 'Job Checklist',

    // Photos
    beforePhoto: 'Before Photo',
    afterPhoto: 'After Photo',
    duringPhoto: 'During Photo',
    addPhoto: 'Add Photo',
    photos: 'Photos',

    // Notes
    addNote: 'Add Note',
    notes: 'Notes',
    enterNotes: 'Enter notes...',
    saveNotes: 'Save Notes',

    // Time
    today: 'Today',
    thisWeek: 'This Week',
    hours: 'Hours',
    minutes: 'Minutes',
    totalHours: 'Total Hours',
    daily: 'Daily',

    // Status
    scheduled: 'Scheduled',
    inProgress: 'In Progress',
    completed: 'Completed',
    pending: 'Pending',
    onHold: 'On Hold',

    // Common
    save: 'Save',
    cancel: 'Cancel',
    back: 'Back',
    loading: 'Loading...',
    noData: 'No data available',
    checklist: 'Checklist',
    address: 'Address',
    property: 'Property',
    status: 'Status',
    date: 'Date',
    time: 'Time',
    description: 'Description',
    customer: 'Customer',

    // Profile
    language: 'Language',
    english: 'English',
    spanish: 'Spanish',
    logOut: 'Log Out',
    myProfile: 'My Profile',
    name: 'Name',
    role: 'Role',
    crew: 'Crew',

    // Login
    signIn: 'Sign In',
    email: 'Email',
    password: 'Password',
    signingIn: 'Signing in...',
    loginFailed: 'Login failed. Please try again.',
    crewPortal: 'Crew Portal',

    // Route
    currentRoute: 'Current Route',
    stops: 'Stops',
    stop: 'Stop',
    noRoute: 'No route assigned today',
  },
  es: {
    // Navigation
    dashboard: 'Inicio',
    jobs: 'Trabajos',
    timesheet: 'Horas',
    profile: 'Perfil',

    // Clock
    clockIn: 'Registrar Entrada',
    clockOut: 'Registrar Salida',
    clockedIn: 'Entrada Registrada',
    clockedOut: 'Salida Registrada',
    clockedInSince: 'Entrada desde',
    notClockedIn: 'Sin entrada registrada',

    // Jobs
    startJob: 'Iniciar Trabajo',
    completeJob: 'Completar Trabajo',
    todaysJobs: 'Trabajos de Hoy',
    noJobsToday: 'No hay trabajos programados para hoy',
    jobDetails: 'Detalles del Trabajo',
    openInMaps: 'Abrir en Mapas',
    jobChecklist: 'Lista de Tareas',

    // Photos
    beforePhoto: 'Foto Antes',
    afterPhoto: 'Foto Despu\u00e9s',
    duringPhoto: 'Foto Durante',
    addPhoto: 'Agregar Foto',
    photos: 'Fotos',

    // Notes
    addNote: 'Agregar Nota',
    notes: 'Notas',
    enterNotes: 'Escribir notas...',
    saveNotes: 'Guardar Notas',

    // Time
    today: 'Hoy',
    thisWeek: 'Esta Semana',
    hours: 'Horas',
    minutes: 'Minutos',
    totalHours: 'Horas Totales',
    daily: 'Diario',

    // Status
    scheduled: 'Programado',
    inProgress: 'En Progreso',
    completed: 'Completado',
    pending: 'Pendiente',
    onHold: 'En Espera',

    // Common
    save: 'Guardar',
    cancel: 'Cancelar',
    back: 'Volver',
    loading: 'Cargando...',
    noData: 'Sin datos disponibles',
    checklist: 'Lista de Verificaci\u00f3n',
    address: 'Direcci\u00f3n',
    property: 'Propiedad',
    status: 'Estado',
    date: 'Fecha',
    time: 'Hora',
    description: 'Descripci\u00f3n',
    customer: 'Cliente',

    // Profile
    language: 'Idioma',
    english: 'Ingl\u00e9s',
    spanish: 'Espa\u00f1ol',
    logOut: 'Cerrar Sesi\u00f3n',
    myProfile: 'Mi Perfil',
    name: 'Nombre',
    role: 'Rol',
    crew: 'Equipo',

    // Login
    signIn: 'Iniciar Sesi\u00f3n',
    email: 'Correo Electr\u00f3nico',
    password: 'Contrase\u00f1a',
    signingIn: 'Iniciando sesi\u00f3n...',
    loginFailed: 'Error de inicio de sesi\u00f3n. Intente de nuevo.',
    crewPortal: 'Portal de Equipo',

    // Route
    currentRoute: 'Ruta Actual',
    stops: 'Paradas',
    stop: 'Parada',
    noRoute: 'Sin ruta asignada hoy',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
export type Language = keyof typeof translations;
