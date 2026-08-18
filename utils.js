// ============================================
// FUNGSI UTILITY - TERPUSAT
// ============================================
// CATATAN: SUPABASE_CONFIG sudah didefinisikan di config.js
// JANGAN deklarasikan ulang di sini!

// ============================================
// ✅ TIME AGO - AKURAT (LANGSUNG HITUNG SELISIH)
// ============================================
function timeAgo(date) {
    const now = new Date();
    const past = new Date(date);
    const diff = Math.floor((now - past) / 1000);

    if (diff < 10) return 'baru saja';
    if (diff < 60) return Math.floor(diff) + ' detik lalu';
    if (diff < 3600) {
        const minutes = Math.floor(diff / 60);
        return minutes + ' menit lalu';
    }
    if (diff < 86400) {
        const hours = Math.floor(diff / 3600);
        return hours + ' jam lalu';
    }
    if (diff < 604800) {
        const days = Math.floor(diff / 86400);
        return days + ' hari lalu';
    }
    if (diff < 2592000) {
        const weeks = Math.floor(diff / 604800);
        return weeks + ' minggu lalu';
    }
    
    return past.toLocaleDateString('id-ID', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
    });
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
// UTILITY - ERROR HANDLING TERPUSAT
// ============================================

function showError(message, title = 'Terjadi Kesalahan') {
    let toast = document.getElementById('errorToast');
    
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'errorToast';
        toast.className = 'fixed bottom-4 right-4 z-50 max-w-sm w-full bg-white rounded-2xl shadow-2xl border-l-4 border-red-500 p-4 transform transition-all duration-500 translate-x-full opacity-0';
        toast.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-500">
                    <i class="fa-solid fa-circle-exclamation"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-slate-800 text-sm" id="errorTitle">${title}</h4>
                    <p class="text-sm text-slate-600 mt-0.5" id="errorMessage">${message}</p>
                </div>
                <button onclick="closeErrorToast()" class="flex-shrink-0 text-slate-400 hover:text-slate-600">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
        document.body.appendChild(toast);
    }

    document.getElementById('errorTitle').textContent = title;
    document.getElementById('errorMessage').textContent = message;

    setTimeout(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
        toast.classList.add('translate-x-0', 'opacity-100');
    }, 100);

    if (window.errorTimeout) clearTimeout(window.errorTimeout);
    window.errorTimeout = setTimeout(() => {
        closeErrorToast();
    }, 5000);
}

function closeErrorToast() {
    const toast = document.getElementById('errorToast');
    if (toast) {
        toast.classList.add('translate-x-full', 'opacity-0');
        toast.classList.remove('translate-x-0', 'opacity-100');
    }
}

function handleSupabaseError(error, context = '') {
    console.error(`❌ Error${context ? ' di ' + context : ''}:`, error);

    const errorMessages = {
        '23505': 'Data sudah ada. Silakan gunakan data lain.',
        '23503': 'Data tidak ditemukan atau tidak valid.',
        '42P01': 'Tabel tidak ditemukan. Hubungi admin.',
        '42501': 'Anda tidak memiliki izin untuk melakukan ini.',
        'PGRST116': 'Data tidak ditemukan.',
        'auth/invalid-credentials': 'Email atau password salah.',
        'auth/email-not-confirmed': 'Email belum dikonfirmasi. Cek kotak masuk Anda.',
        'auth/user-not-found': 'Akun tidak ditemukan.',
        'auth/weak-password': 'Password terlalu lemah. Minimal 6 karakter.',
    };

    let userMessage = errorMessages[error.code] || error.message || 'Terjadi kesalahan. Silakan coba lagi.';
    showError(userMessage, '⚠️ ' + (context || 'Gagal'));
}

async function fetchWithErrorHandling(query, context = '') {
    try {
        const result = await query;
        if (result.error) {
            handleSupabaseError(result.error, context);
            return { data: null, error: result.error };
        }
        return { data: result.data, error: null };
    } catch (err) {
        handleSupabaseError(err, context);
        return { data: null, error: err };
    }
}

function showEmpty(containerId, message = 'Tidak ada data.', icon = 'fa-regular fa-folder-open') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="${icon} text-3xl text-slate-300 block mb-2"></i>
                <p class="text-slate-400 text-sm">${message}</p>
            </div>
        `;
    }
}

function validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return true;

    const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
    let isValid = true;
    let firstError = null;

    inputs.forEach(input => {
        input.classList.remove('border-red-500');
        let errorEl = input.parentElement.querySelector('.error-message');
        if (errorEl) errorEl.remove();

        const value = input.value.trim();
        if (!value) {
            input.classList.add('border-red-500');
            errorEl = document.createElement('p');
            errorEl.className = 'error-message text-xs text-red-500 mt-1';
            errorEl.textContent = 'Kolom ini wajib diisi.';
            input.parentElement.appendChild(errorEl);
            isValid = false;
            if (!firstError) firstError = input;
        }
    });

    if (!isValid && firstError) {
        firstError.focus();
    }

    return isValid;
}

// ============================================
// LOADING STATE - KOMPONEN REUSABLE
// ============================================

function injectSkeletonStyles() {
    if (document.getElementById('skeleton-styles')) return;

    const style = document.createElement('style');
    style.id = 'skeleton-styles';
    style.textContent = `
        .skeleton-card, .skeleton-item, .skeleton-book, .skeleton-row {
            opacity: 0.7;
            pointer-events: none;
        }
        .skeleton-card .bg-slate-200,
        .skeleton-item .bg-slate-200,
        .skeleton-book .bg-slate-200,
        .skeleton-row .bg-slate-200 {
            background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s ease-in-out infinite;
        }
        @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
        .animate-pulse {
            animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
        }
    `;
    document.head.appendChild(style);
}

function showSkeletonGrid(containerId, count = 6, type = 'card') {
    const container = document.getElementById(containerId);
    if (!container) return;

    let skeletonHtml = '';
    
    if (type === 'card') {
        for (let i = 0; i < count; i++) {
            skeletonHtml += `
                <div class="skeleton-card bg-white rounded-2xl p-5 border border-emerald-100/60 shadow-sm">
                    <div class="flex items-start gap-4">
                        <div class="w-16 h-20 rounded-lg bg-slate-200 flex-shrink-0"></div>
                        <div class="flex-1 space-y-3">
                            <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                            <div class="h-3 bg-slate-200 rounded w-1/2"></div>
                            <div class="h-3 bg-slate-200 rounded w-2/3"></div>
                            <div class="flex gap-2">
                                <div class="h-6 bg-slate-200 rounded w-16"></div>
                                <div class="h-6 bg-slate-200 rounded w-16"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    } else if (type === 'list') {
        for (let i = 0; i < count; i++) {
            skeletonHtml += `
                <div class="skeleton-item bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                    <div class="flex items-start gap-4">
                        <div class="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0"></div>
                        <div class="flex-1 space-y-2">
                            <div class="h-4 bg-slate-200 rounded w-1/3"></div>
                            <div class="h-3 bg-slate-200 rounded w-2/3"></div>
                            <div class="h-3 bg-slate-200 rounded w-1/2"></div>
                        </div>
                    </div>
                </div>
            `;
        }
    } else if (type === 'book') {
        for (let i = 0; i < count; i++) {
            skeletonHtml += `
                <div class="skeleton-book rounded-2xl overflow-hidden bg-white border border-emerald-100/60 shadow-sm">
                    <div class="aspect-[2/3] bg-slate-200"></div>
                    <div class="p-3 space-y-2">
                        <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                        <div class="h-3 bg-slate-200 rounded w-1/2"></div>
                        <div class="flex justify-between">
                            <div class="h-3 bg-slate-200 rounded w-1/3"></div>
                            <div class="h-3 bg-slate-200 rounded w-1/4"></div>
                        </div>
                    </div>
                </div>
            `;
        }
    } else if (type === 'community') {
        for (let i = 0; i < count; i++) {
            skeletonHtml += `
                <div class="skeleton-card bg-white rounded-2xl p-5 border border-emerald-100/60 shadow-sm">
                    <div class="flex items-start gap-3">
                        <div class="w-12 h-12 rounded-xl bg-slate-200 flex-shrink-0"></div>
                        <div class="flex-1 space-y-2">
                            <div class="h-4 bg-slate-200 rounded w-2/3"></div>
                            <div class="h-3 bg-slate-200 rounded w-1/3"></div>
                            <div class="h-3 bg-slate-200 rounded w-full"></div>
                        </div>
                    </div>
                    <div class="mt-4 pt-4 border-t border-slate-100 flex justify-between">
                        <div class="h-3 bg-slate-200 rounded w-1/4"></div>
                        <div class="h-6 bg-slate-200 rounded w-20"></div>
                    </div>
                </div>
            `;
        }
    }

    container.innerHTML = skeletonHtml;
}

function showSkeletonList(containerId, count = 5) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let skeletonHtml = '';
    for (let i = 0; i < count; i++) {
        skeletonHtml += `
            <div class="skeleton-item bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <div class="flex items-start gap-4">
                    <div class="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0"></div>
                    <div class="flex-1 space-y-2">
                        <div class="h-4 bg-slate-200 rounded w-1/3"></div>
                        <div class="h-3 bg-slate-200 rounded w-2/3"></div>
                        <div class="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                </div>
            </div>
        `;
    }
    container.innerHTML = skeletonHtml;
}

function showSkeletonTable(containerId, rows = 5) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let skeletonHtml = '';
    for (let i = 0; i < rows; i++) {
        skeletonHtml += `
            <div class="skeleton-row flex items-center justify-between p-4 border-b border-slate-100">
                <div class="flex-1 space-y-2">
                    <div class="h-4 bg-slate-200 rounded w-1/2"></div>
                    <div class="h-3 bg-slate-200 rounded w-1/4"></div>
                </div>
                <div class="flex gap-2">
                    <div class="h-8 bg-slate-200 rounded w-16"></div>
                </div>
            </div>
        `;
    }
    container.innerHTML = skeletonHtml;
}

function showSkeletonContent(containerId, lines = 5) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let skeletonHtml = `
        <div class="space-y-4">
            <div class="h-8 bg-slate-200 rounded w-2/3"></div>
            <div class="h-4 bg-slate-200 rounded w-1/3"></div>
    `;

    for (let i = 0; i < lines; i++) {
        skeletonHtml += `<div class="h-4 bg-slate-200 rounded w-full"></div>`;
    }

    skeletonHtml += `</div>`;
    container.innerHTML = skeletonHtml;
}

function showLoadingSpinner(containerId, message = 'Memuat...') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-12">
            <i class="fa-solid fa-spinner fa-spin text-3xl text-emerald-600 mb-3 block"></i>
            <p class="text-slate-500 text-sm">${message}</p>
        </div>
    `;
}

function showButtonLoading(buttonId, text = 'Memproses...') {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    btn.disabled = true;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> ${text}`;
}

function hideButtonLoading(buttonId) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    btn.disabled = false;
    if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
    }
}

async function generateMemberId(levelKey) {
    const prefixMap = {
        'tamu': 'YATA-T',
        'penulis': 'YATA-P',
        'penulis_profesional': 'YATA-PP',
        'mentor': 'YATA-M'
    };
    
    const prefix = prefixMap[levelKey] || 'YATA-T';
    
    const now = new Date();
    const tanggal = String(now.getDate()).padStart(2, '0');
    const bulan = String(now.getMonth() + 1).padStart(2, '0');
    const tahun = String(now.getFullYear()).slice(-2);
    const dateSuffix = `${tanggal}${bulan}${tahun}`;
    
    try {
        const { count, error } = await _supabase
            .from('yata_profiles')
            .select('*', { count: 'exact', head: true })
            .ilike('member_id', `${prefix}-%`);
        
        if (error) {
            console.error('Error counting members:', error);
            const timestamp = String(Date.now()).slice(-2);
            return `${prefix}-${timestamp}${dateSuffix}`;
        }
        
        const number = (count || 0) + 1;
        const urutan = number < 10 ? `0${number}` : String(number);
        
        return `${prefix}-${urutan}${dateSuffix}`;
        
    } catch (err) {
        console.error('Generate member ID error:', err);
        const timestamp = String(Date.now()).slice(-2);
        return `${prefix}-${timestamp}${dateSuffix}`;
    }
}

function formatMemberId(memberId) {
    if (!memberId) {
        const now = new Date();
        const tanggal = String(now.getDate()).padStart(2, '0');
        const bulan = String(now.getMonth() + 1).padStart(2, '0');
        const tahun = String(now.getFullYear()).slice(-2);
        return `YATA-T-01${tanggal}${bulan}${tahun}`;
    }
    return memberId;
}

function getKTAValidDate() {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 2);
    return date.toLocaleDateString('id-ID', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
    });
}

// ============================================
// RATE LIMITING - CEGAH SPAM
// ============================================

const RATE_LIMITS = {
    comment: 30,
    testimonial: 60,
    contact: 60,
    notification: 60,
    message: 60,
    login: 5,
    register: 10,
    campaign: 60,
    like: 3,
};

function checkRateLimit(action, customCooldown = null) {
    const cooldown = customCooldown || RATE_LIMITS[action] || 30;
    const key = `rate_limit_${action}`;
    const lastAttempt = localStorage.getItem(key);
    const now = Date.now();

    if (lastAttempt) {
        const elapsed = (now - parseInt(lastAttempt)) / 1000;
        if (elapsed < cooldown) {
            const waitTime = Math.ceil(cooldown - elapsed);
            return {
                allowed: false,
                waitTime: waitTime,
                message: `Mohon tunggu ${waitTime} detik sebelum mencoba lagi.`
            };
        }
    }

    return { allowed: true, waitTime: 0, message: '' };
}

function saveRateLimit(action) {
    const key = `rate_limit_${action}`;
    localStorage.setItem(key, Date.now().toString());
}

function withRateLimit(action, callback, customCooldown = null) {
    const result = checkRateLimit(action, customCooldown);
    
    if (!result.allowed) {
        showError(result.message, '⏳ Terlalu Cepat');
        return false;
    }

    saveRateLimit(action);
    
    if (typeof callback === 'function') {
        callback();
    }
    
    return true;
}

function resetRateLimit(action) {
    const key = `rate_limit_${action}`;
    localStorage.removeItem(key);
}

function getGuestId() {
    let guestId = localStorage.getItem('guest_id');
    if (!guestId) {
        guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        localStorage.setItem('guest_id', guestId);
    }
    return guestId;
}

function getUserId() {
    const user = window.currentUser || null;
    if (user) {
        return user.id;
    }
    return getGuestId();
}

async function ensureGuestProfile(userId) {
    try {
        const { data: existing, error } = await _supabase
            .from('yata_profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle();
            
        if (!existing && userId.startsWith('guest_')) {
            await _supabase
                .from('yata_profiles')
                .insert([{
                    id: userId,
                    full_name: 'Tamu',
                    username: 'tamu_' + Date.now(),
                    role: 'guest',
                    member_level: 'Tamu',
                }]);
        }
        return true;
    } catch (err) {
        console.error('Ensure guest profile error:', err);
        return false;
    }
}

// ============================================
// FITUR SHARE - MEDIA SOSIAL
// ============================================

function openShareDialog(title, url, type = 'karya') {
    let dialog = document.getElementById('shareDialog');
    if (dialog) {
        dialog.remove();
    }

    dialog = document.createElement('div');
    dialog.id = 'shareDialog';
    dialog.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4';
    dialog.innerHTML = `
        <div class="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 relative shadow-2xl modal-enter" onclick="event.stopPropagation()">
            <button onclick="closeShareDialog()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-2xl">
                <i class="fa-solid fa-xmark"></i>
            </button>

            <div class="text-center mb-6">
                <span class="text-emerald-600 text-sm font-bold uppercase tracking-wider">Bagikan</span>
                <h3 class="text-xl font-black text-slate-800 mt-1">${title}</h3>
                <p class="text-xs text-slate-500 mt-1">Bagikan ${type} ini ke media sosial</p>
            </div>

            <div class="grid grid-cols-4 gap-3 mb-4">
                <button onclick="shareToWhatsApp('${url}')" class="bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition flex flex-col items-center gap-1 text-xs">
                    <i class="fa-brands fa-whatsapp text-2xl"></i>
                    <span>WhatsApp</span>
                </button>
                <button onclick="shareToTwitter('${url}', '${title}')" class="bg-black hover:bg-gray-800 text-white font-bold py-3 rounded-xl transition flex flex-col items-center gap-1 text-xs">
                    <i class="fa-brands fa-x-twitter text-2xl"></i>
                    <span>Twitter/X</span>
                </button>
                <button onclick="shareToFacebook('${url}')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition flex flex-col items-center gap-1 text-xs">
                    <i class="fa-brands fa-facebook text-2xl"></i>
                    <span>Facebook</span>
                </button>
                <button onclick="shareToTelegram('${url}', '${title}')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition flex flex-col items-center gap-1 text-xs">
                    <i class="fa-brands fa-telegram text-2xl"></i>
                    <span>Telegram</span>
                </button>

                <button onclick="shareToThreads('${url}', '${title}')" class="bg-black hover:bg-gray-800 text-white font-bold py-3 rounded-xl transition flex flex-col items-center gap-1 text-xs">
                    <i class="fa-brands fa-threads text-2xl"></i>
                    <span>Threads</span>
                </button>
                <button onclick="shareToInstagram('${url}')" class="bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white font-bold py-3 rounded-xl transition flex flex-col items-center gap-1 text-xs">
                    <i class="fa-brands fa-instagram text-2xl"></i>
                    <span>Instagram</span>
                </button>
                <button onclick="copyLink('${url}')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition flex flex-col items-center gap-1 text-xs">
                    <i class="fa-solid fa-copy text-2xl"></i>
                    <span>Copy Link</span>
                </button>
                <button onclick="shareToEmail('${url}', '${title}')" class="bg-slate-500 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition flex flex-col items-center gap-1 text-xs">
                    <i class="fa-solid fa-envelope text-2xl"></i>
                    <span>Email</span>
                </button>
            </div>

            <div class="border-t border-slate-200 pt-4">
                <div class="flex items-center gap-2 bg-slate-50 rounded-xl p-3">
                    <input type="text" id="shareLinkInput" value="${url}" readonly class="flex-1 bg-transparent text-sm text-slate-600 outline-none" />
                    <button onclick="copyLink('${url}')" class="text-emerald-600 hover:text-emerald-700 font-semibold text-sm whitespace-nowrap">
                        <i class="fa-regular fa-copy mr-1"></i> Copy
                    </button>
                </div>
                <p class="text-xs text-slate-400 mt-2 text-center">🔗 Link siap dibagikan</p>
            </div>

            <button onclick="closeShareDialog()" class="w-full mt-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition text-sm">
                Tutup
            </button>
        </div>
    `;

    document.body.appendChild(dialog);
    document.body.style.overflow = 'hidden';

    dialog.addEventListener('click', function(e) {
        if (e.target === this) closeShareDialog();
    });
}

function closeShareDialog() {
    const dialog = document.getElementById('shareDialog');
    if (dialog) {
        dialog.remove();
        document.body.style.overflow = 'auto';
    }
}

function shareToWhatsApp(url) {
    const encodedUrl = encodeURIComponent(url);
    window.open(`https://wa.me/?text=${encodedUrl}`, '_blank');
}

function shareToTwitter(url, title) {
    const encodedText = encodeURIComponent(`${title}\n\n${url}`);
    window.open(`https://twitter.com/intent/tweet?text=${encodedText}`, '_blank');
}

function shareToFacebook(url) {
    const encodedUrl = encodeURIComponent(url);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
}

function shareToTelegram(url, title) {
    const encodedText = encodeURIComponent(`${title}\n\n${url}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodedText}`, '_blank');
}

function shareToThreads(url, title) {
    const encodedText = encodeURIComponent(`${title}\n\n${url}`);
    window.open(`https://threads.net/intent/post?text=${encodedText}`, '_blank');
}

function shareToInstagram(url) {
    navigator.clipboard.writeText(url).then(() => {
        showError('✅ Link disalin! Buka Instagram dan bagikan di Story/Post.', 'Info');
        setTimeout(closeShareDialog, 1500);
    }).catch(() => {
        window.open('https://www.instagram.com/', '_blank');
        showError('📱 Buka Instagram dan bagikan link ini: ' + url, 'Info');
        setTimeout(closeShareDialog, 3000);
    });
}

function shareToEmail(url, title) {
    const subject = encodeURIComponent(`YATA: ${title}`);
    const body = encodeURIComponent(`Halo,\n\nSaya ingin berbagi ${title} dari YATA:\n\n${url}\n\nYATA — Kata yang Menggerakkan`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
}

function copyLink(url) {
    navigator.clipboard.writeText(url).then(() => {
        showError('✅ Link berhasil disalin!', 'Sukses');
        setTimeout(closeShareDialog, 1000);
    }).catch(() => {
        const input = document.getElementById('shareLinkInput');
        if (input) {
            input.select();
            document.execCommand('copy');
            showError('✅ Link berhasil disalin!', 'Sukses');
            setTimeout(closeShareDialog, 1000);
        }
    });
}

// ============================================
// FUNGSI KHUSUS MENTORING - TAMBAHAN BARU
// ============================================

/**
 * Format status partisipasi mentoring
 */
function getMentoringStatusLabel(status) {
    const labels = {
        pending: '⏳ Menunggu Konfirmasi',
        approved: '✅ Diterima',
        rejected: '❌ Ditolak',
        completed: '✅ Selesai'
    };
    return labels[status] || '⏳ Menunggu';
}

/**
 * Format status sesi mentoring
 */
function getMentoringSessionStatusLabel(status) {
    const labels = {
        draft: '📝 Draft',
        published: '✅ Published',
        ongoing: '🔄 Sedang Berlangsung',
        completed: '✅ Selesai',
        cancelled: '❌ Dibatalkan'
    };
    return labels[status] || '📝 Draft';
}

/**
 * Format level mentoring
 */
function getMentoringLevelLabel(level) {
    const labels = {
        pemula: '🌱 Pemula',
        menengah: '📈 Menengah',
        lanjutan: '🚀 Lanjutan'
    };
    return labels[level] || '🌱 Pemula';
}

/**
 * Format kategori mentoring dengan icon
 */
function getMentoringCategoryIcon(category) {
    const icons = {
        'menulis-cerpen': '📝',
        'menulis-puisi': '📖',
        'menulis-novel': '📚',
        'teknik-menulis': '✍️',
        'editorial': '🔍',
        'umum': '📌'
    };
    return icons[category] || '📌';
}

/**
 * Format harga mentoring
 */
function formatMentoringPrice(price) {
    if (price === 0) return '🆓 Gratis';
    return '💰 Rp' + (price || 0).toLocaleString('id-ID');
}

/**
 * Format kuota peserta mentoring
 */
function formatMentoringQuota(current, max) {
    if (!max || max === 0) return `${current || 0} / ∞`;
    return `${current || 0} / ${max}`;
}

/**
 * Cek apakah user bisa menjadi mentor
 */
function canUserBeMentor(memberLevel) {
    const allowedLevels = ['Penulis', 'Penulis Profesional', 'Mentor'];
    return allowedLevels.includes(memberLevel);
}

/**
 * Cek apakah user bisa mengikuti mentoring (semua member bisa)
 */
function canUserJoinMentoring(memberLevel) {
    return true;
}

/**
 * Generate slug untuk mentoring dari judul
 */
function generateMentoringSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Validasi slug mentoring
 */
function isValidMentoringSlug(slug) {
    return /^[a-z0-9-]+$/.test(slug) && slug.length >= 3;
}

/**
 * Get status badge class untuk mentoring
 */
function getMentoringStatusClass(status) {
    const classes = {
        pending: 'status-pending',
        approved: 'status-approved',
        rejected: 'status-rejected',
        completed: 'status-completed',
        draft: 'status-draft',
        published: 'status-published',
        ongoing: 'status-ongoing',
        cancelled: 'status-cancelled'
    };
    return classes[status] || 'status-pending';
}

/**
 * Get level badge class untuk mentoring
 */
function getMentoringLevelClass(level) {
    const classes = {
        pemula: 'level-pemula',
        menengah: 'level-menengah',
        lanjutan: 'level-lanjutan'
    };
    return classes[level] || 'level-pemula';
}

/**
 * Format waktu untuk jadwal mentoring
 */
function formatMentoringSchedule(schedule, startDate) {
    if (schedule) return schedule;
    if (startDate) {
        return new Date(startDate).toLocaleDateString('id-ID', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
    }
    return 'TBA';
}

/**
 * Cek apakah sesi mentoring sudah penuh
 */
function isMentoringFull(currentParticipants, maxParticipants) {
    if (!maxParticipants || maxParticipants === 0) return false;
    return currentParticipants >= maxParticipants;
}

// ============================================
// INJECT SKELETON STYLES
// ============================================
if (typeof document !== 'undefined') {
    injectSkeletonStyles();
}