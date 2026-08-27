// ============================================
// UTILS.JS - VERSI LENGKAP (DIPERBAIKI)
// ============================================

// ============================================
// KONSTANTA REPUTASI LEVEL
// ============================================

const REPUTATION_LEVELS = {
    premium: { min: 150, label: '🌟 Premium', dailyLimit: Infinity, badge: 'premium' },
    trusted: { min: 100, label: '✅ Terpercaya', dailyLimit: 10, badge: 'trusted' },
    standard: { min: 60, label: '📝 Standar', dailyLimit: 5, badge: 'standard' },
    improving: { min: 30, label: '⚠️ Perlu Perbaikan', dailyLimit: 2, badge: 'improving' },
    limited: { min: 0, label: '🚫 Terbatas', dailyLimit: 1, badge: 'limited' }
};

// ============================================
// FUNGSI REPUTASI
// ============================================

function getReputationLevel(reputation) {
    if (reputation >= 150) return REPUTATION_LEVELS.premium;
    if (reputation >= 100) return REPUTATION_LEVELS.trusted;
    if (reputation >= 60) return REPUTATION_LEVELS.standard;
    if (reputation >= 30) return REPUTATION_LEVELS.improving;
    return REPUTATION_LEVELS.limited;
}

async function calculateReputation(userId) {
    try {
        const supabase = window._supabase;
        if (!supabase) {
            console.error('❌ Supabase client not available');
            return { reputation: 100, totalWritings: 0, totalViews: 0, totalLikes: 0 };
        }

        const { data: writings, error } = await supabase
            .from('yata_writings')
            .select('views, likes, comments_count, word_count, created_at')
            .eq('author_id', userId)
            .eq('status', 'published');

        if (error) throw error;

        let reputation = 100;
        let totalWritings = writings?.length || 0;
        let totalViews = 0;
        let totalLikes = 0;

        if (writings && writings.length > 0) {
            writings.forEach(w => {
                totalViews += (w.views || 0);
                totalLikes += (w.likes || 0);
            });

            reputation += Math.min(totalWritings, 20);
            reputation += Math.min(Math.floor(totalViews / 10), 30);
            reputation += Math.min(totalLikes, 30);

            const likeRatio = totalViews > 0 ? (totalLikes / totalViews) * 100 : 0;
            if (likeRatio > 10) reputation += 10;
            if (likeRatio > 20) reputation += 10;

            const avgViews = totalWritings > 0 ? totalViews / totalWritings : 0;
            if (totalWritings > 10 && avgViews < 3) {
                reputation -= 20;
            } else if (totalWritings > 5 && avgViews < 5) {
                reputation -= 10;
            }
        } else {
            reputation -= 2;
        }

        reputation = Math.max(0, Math.min(200, Math.round(reputation)));

        await supabase
            .from('yata_profiles')
            .update({ 
                reputation: reputation,
                total_published: totalWritings,
                total_views_received: totalViews,
                total_likes_received: totalLikes,
                last_reputation_update: new Date().toISOString()
            })
            .eq('id', userId);

        return { reputation, totalWritings, totalViews, totalLikes };

    } catch (err) {
        console.error('Calculate reputation error:', err);
        return { reputation: 100, totalWritings: 0, totalViews: 0, totalLikes: 0 };
    }
}

async function checkPublishEligibility(userId) {
    try {
        const supabase = window._supabase;
        if (!supabase) {
            return {
                allowed: true,
                remaining: '∞',
                dailyLimit: '∞',
                used: 0,
                reputation: 100,
                level: getReputationLevel(100),
                message: '⚠️ Gagal mengecek reputasi'
            };
        }

        const { data: profile, error } = await supabase
            .from('yata_profiles')
            .select('reputation')
            .eq('id', userId)
            .single();

        if (error) throw error;

        const reputation = profile?.reputation || 100;
        const level = getReputationLevel(reputation);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { count, error: countError } = await supabase
            .from('yata_writings')
            .select('*', { count: 'exact', head: true })
            .eq('author_id', userId)
            .eq('status', 'published')
            .gte('created_at', today.toISOString());

        if (countError) throw countError;

        const used = count || 0;
        const dailyLimit = level.dailyLimit === Infinity ? Infinity : level.dailyLimit;
        const remaining = dailyLimit === Infinity ? Infinity : dailyLimit - used;
        const allowed = remaining > 0 || dailyLimit === Infinity;

        return {
            allowed: allowed,
            remaining: remaining === Infinity ? '∞' : remaining,
            dailyLimit: dailyLimit === Infinity ? '∞' : dailyLimit,
            used: used,
            reputation: reputation,
            level: level,
            message: allowed 
                ? `✅ Reputasi ${reputation} | Sisa ${remaining === Infinity ? '∞' : remaining} publikasi hari ini`
                : `⚠️ Batas publikasi tercapai (${dailyLimit}/hari). Tingkatkan reputasi untuk kuota lebih banyak!`
        };

    } catch (err) {
        console.error('Check eligibility error:', err);
        return {
            allowed: true,
            remaining: '∞',
            dailyLimit: '∞',
            used: 0,
            reputation: 100,
            level: getReputationLevel(100),
            message: '⚠️ Gagal mengecek reputasi'
        };
    }
}

// ============================================
// FUNGSI KTA
// ============================================

function getKTAValidDate() {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 2);
    return date.toLocaleDateString('id-ID', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
    });
}

function formatMemberId(memberId) {
    if (!memberId) {
        const now = new Date();
        const tanggal = String(now.getDate()).padStart(2, '0');
        const bulan = String(now.getMonth() + 1).padStart(2, '0');
        const tahun = String(now.getFullYear()).slice(-2);
        return `Yatta-T-01${tanggal}${bulan}${tahun}`;
    }
    return memberId;
}

// ============================================
// FUNGSI SHOW ERROR
// ============================================

function showError(message, title = 'Terjadi Kesalahan') {
    console.error(`❌ ${title}: ${message}`);
    
    let toast = document.getElementById('errorToast');
    if (toast) {
        const titleEl = document.getElementById('errorTitle');
        const msgEl = document.getElementById('errorMessage');
        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;
        toast.classList.remove('translate-x-full', 'opacity-0');
        toast.classList.add('translate-x-0', 'opacity-100');
        return;
    }
    
    alert(`${title}\n\n${message}`);
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

// ============================================
// FUNGSI TIME AGO
// ============================================

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
// FUNGSI RATE LIMITING
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
    favorite: 3,
    create_mentoring: 60,
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

function resetRateLimit(action) {
    const key = `rate_limit_${action}`;
    localStorage.removeItem(key);
}

// ============================================
// FUNGSI GUEST
// ============================================

function getGuestId() {
    let guestId = localStorage.getItem('guest_id');
    if (!guestId) {
        guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        localStorage.setItem('guest_id', guestId);
    }
    return guestId;
}

async function ensureGuestProfile(userId) {
    try {
        const supabase = window._supabase;
        if (!supabase) {
            console.warn('⚠️ Supabase client not available');
            return false;
        }
        
        const { data: existing, error } = await supabase
            .from('yata_profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle();
            
        if (!existing && userId.startsWith('guest_')) {
            await supabase
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
// FUNGSI FAVORIT
// ============================================

async function toggleFavorite(writingId, userId) {
    try {
        const supabase = window._supabase;
        if (!supabase) {
            throw new Error('Supabase client not available');
        }
        
        const { data: existing, error: checkError } = await supabase
            .from('yata_favorites')
            .select('id')
            .eq('user_id', userId)
            .eq('writing_id', writingId)
            .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
            const { error: deleteError } = await supabase
                .from('yata_favorites')
                .delete()
                .eq('id', existing.id);

            if (deleteError) throw deleteError;
            return { action: 'removed', message: '✅ Dihapus dari favorit' };
        } else {
            const { error: insertError } = await supabase
                .from('yata_favorites')
                .insert([{ user_id: userId, writing_id: writingId }]);

            if (insertError) throw insertError;
            return { action: 'added', message: '✅ Ditambahkan ke favorit' };
        }
    } catch (err) {
        console.error('Toggle favorite error:', err);
        throw err;
    }
}

async function getFavoriteIds(userId) {
    try {
        const supabase = window._supabase;
        if (!supabase) return new Set();
        
        const { data, error } = await supabase
            .from('yata_favorites')
            .select('writing_id')
            .eq('user_id', userId);

        if (error) throw error;
        return new Set(data.map(f => f.writing_id));
    } catch (err) {
        console.error('Get favorites error:', err);
        return new Set();
    }
}

// ============================================
// FUNGSI SHARE
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
            <button onclick="closeShareDialog()" class="w-full mt-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition text-sm">Tutup</button>
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

// ============================================
// FUNGSI SKELETON
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

// ============================================
// FUNGSI MENTORING
// ============================================

function getMentoringStatusLabel(status) {
    const labels = {
        pending: '⏳ Menunggu Konfirmasi',
        approved: '✅ Diterima',
        rejected: '❌ Ditolak',
        completed: '✅ Selesai'
    };
    return labels[status] || '⏳ Menunggu';
}

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

function getMentoringLevelLabel(level) {
    const labels = {
        pemula: '🌱 Pemula',
        menengah: '📈 Menengah',
        lanjutan: '🚀 Lanjutan'
    };
    return labels[level] || '🌱 Pemula';
}

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

function formatMentoringPrice(price) {
    if (price === 0) return '🆓 Gratis';
    return '💰 Rp' + (price || 0).toLocaleString('id-ID');
}

function canUserBeMentor(memberLevel) {
    const allowedLevels = ['Penulis', 'Penulis Profesional', 'Mentor'];
    return allowedLevels.includes(memberLevel);
}

function generateMentoringSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function isValidMentoringSlug(slug) {
    return /^[a-z0-9-]+$/.test(slug) && slug.length >= 3;
}

// ============================================
// INJECT SKELETON STYLES
// ============================================

if (typeof document !== 'undefined') {
    injectSkeletonStyles();
}

console.log('✅ utils.js loaded successfully');