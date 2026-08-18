// ============================================
// KONFIGURASI SUPABASE - TERPUSAT
// ============================================

const SUPABASE_CONFIG = {
    url: 'https://fowkcubpplwpljfjjcfy.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvd2tjdWJwcGx3cGxqZmpqY2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzOTI1NzcsImV4cCI6MjEwMDk2ODU3N30.bgh3fbdJnS0h_cwRTe_exKP2NmKugOTUJDNocpt4cy4'
};

// ============================================
// FUNGSI UTILITY - TERPUSAT
// ============================================

// Format waktu (time ago)
function timeAgo(date) {
    const now = new Date();
    const past = new Date(date);
    const diff = Math.floor((now - past) / 1000);

    if (diff < 60) return 'baru saja';
    if (diff < 3600) return Math.floor(diff / 60) + ' menit lalu';
    if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
    if (diff < 604800) return Math.floor(diff / 86400) + ' hari lalu';
    if (diff < 2592000) return Math.floor(diff / 604800) + ' minggu lalu';
    return past.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Generate ID Anggota
function generateMemberId(prefix, count) {
    const padded = String(count).padStart(5, '0');
    return `${prefix}-${padded}`;
}

// Get Level Icon
function getLevelIcon(level) {
    const icons = {
        'Tamu': '🌱',
        'Penulis': '✍️',
        'Penulis Profesional': '📚',
        'Mentor': '🌟'
    };
    return icons[level] || '🌱';
}

// ============================================
// CARA MENGGUNAKAN DI FILE LAIN:
// ============================================
// 1. Tambahkan di <head>:
//    <script src="config.js"></script>
//
// 2. Gunakan:
//    const _supabase = supabase.createClient(
//        SUPABASE_CONFIG.url, 
//        SUPABASE_CONFIG.anonKey
//    );
//
// 3. Fungsi timeAgo() sudah tersedia global
//    timeAgo('2026-01-01T00:00:00Z')